import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Conditional imports for Expo modules
let Battery: any = null;
let Device: any = null;

try {
  Battery = require('expo-battery');
} catch (error) {
  console.warn('[PerformanceOptimizer] expo-battery not available');
}

try {
  Device = require('expo-device');
} catch (error) {
  console.warn('[PerformanceOptimizer] expo-device not available');
}

interface PerformanceMetrics {
  batteryLevel: number;
  isLowPowerMode: boolean;
  networkType: string;
  deviceType: string;
  isCharging: boolean;
  memoryUsage?: number;
  cpuUsage?: number;
  lastUpdated: string;
}

interface OptimizationSettings {
  adaptiveSyncEnabled: boolean;
  batteryOptimizationEnabled: boolean;
  networkOptimizationEnabled: boolean;
  backgroundThrottlingEnabled: boolean;
  minBatteryForSync: number; // 0.0 to 1.0
  maxSyncDuration: number; // milliseconds
  throttleOnSlowNetwork: boolean;
}

interface SyncFrequencyConfig {
  high: number;    // High priority tasks
  normal: number;  // Normal priority tasks
  low: number;     // Low priority tasks
}

export class PerformanceOptimizer {
  private metrics: PerformanceMetrics = {
    batteryLevel: 1.0,
    isLowPowerMode: false,
    networkType: 'unknown',
    deviceType: 'unknown',
    isCharging: false,
    lastUpdated: new Date().toISOString(),
  };

  private settings: OptimizationSettings = {
    adaptiveSyncEnabled: true,
    batteryOptimizationEnabled: true,
    networkOptimizationEnabled: true,
    backgroundThrottlingEnabled: true,
    minBatteryForSync: 0.15, // 15%
    maxSyncDuration: 30000, // 30 seconds
    throttleOnSlowNetwork: true,
  };

  private baseSyncFrequencies: SyncFrequencyConfig = {
    high: 5 * 60 * 1000,    // 5 minutes
    normal: 15 * 60 * 1000, // 15 minutes
    low: 60 * 60 * 1000,    // 1 hour
  };

  private networkUnsubscribe?: (() => void) | null;
  private metricsUpdateInterval?: ReturnType<typeof setInterval>;
  private performanceHistory: Array<{ timestamp: string; metrics: Partial<PerformanceMetrics> }> = [];

  /**
   * Initialize the performance optimizer
   */
  async initialize(): Promise<void> {
    try {
      console.log('[PerformanceOptimizer] Initializing performance optimizer');
      
      // Load saved settings
      await this.loadSettings();
      
      // Load performance history
      await this.loadPerformanceHistory();
      
      // Update initial metrics
      await this.updateMetrics();
      
      // Set up network monitoring
      this.setupNetworkMonitoring();
      
      // Set up periodic metrics updates
      this.setupMetricsUpdates();
      
      console.log('[PerformanceOptimizer] Performance optimizer initialized');
    } catch (error) {
      console.error('[PerformanceOptimizer] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load optimization settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const settingsData = await AsyncStorage.getItem('performance_optimizer_settings');
      if (settingsData) {
        this.settings = { ...this.settings, ...JSON.parse(settingsData) };
      }
    } catch (error) {
      console.error('[PerformanceOptimizer] Failed to load settings:', error);
    }
  }

  /**
   * Save optimization settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem('performance_optimizer_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('[PerformanceOptimizer] Failed to save settings:', error);
    }
  }

  /**
   * Load performance history from storage
   */
  private async loadPerformanceHistory(): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem('performance_history');
      if (historyData) {
        this.performanceHistory = JSON.parse(historyData);
        // Keep only last 100 entries
        this.performanceHistory = this.performanceHistory.slice(-100);
      }
    } catch (error) {
      console.error('[PerformanceOptimizer] Failed to load performance history:', error);
    }
  }

  /**
   * Save performance history to storage
   */
  private async savePerformanceHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('performance_history', JSON.stringify(this.performanceHistory));
    } catch (error) {
      console.error('[PerformanceOptimizer] Failed to save performance history:', error);
    }
  }

  /**
   * Set up network state monitoring
   */
  private setupNetworkMonitoring(): void {
    this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const networkType = this.getNetworkTypeString(state);
      if (networkType !== this.metrics.networkType) {
        console.log(`[PerformanceOptimizer] Network changed: ${this.metrics.networkType} -> ${networkType}`);
        this.metrics.networkType = networkType;
        this.metrics.lastUpdated = new Date().toISOString();
        this.recordPerformanceSnapshot();
      }
    });
  }

  /**
   * Set up periodic metrics updates
   */
  private setupMetricsUpdates(): void {
    // Update metrics every 2 minutes
    this.metricsUpdateInterval = setInterval(async () => {
      await this.updateMetrics();
    }, 2 * 60 * 1000);
  }

  /**
   * Update performance metrics
   */
  async updateMetrics(): Promise<void> {
    try {
      const previousMetrics = { ...this.metrics };
      
      // Update battery metrics
      if (Battery) {
        this.metrics.batteryLevel = await Battery.getBatteryLevelAsync();
        this.metrics.isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();
        this.metrics.isCharging = (await Battery.getBatteryStateAsync()) === Battery.BatteryState.CHARGING;
      }
      
      // Update device type
      if (Device) {
        this.metrics.deviceType = Device.deviceType ? Device.DeviceType[Device.deviceType] : 'unknown';
      }
      
      this.metrics.lastUpdated = new Date().toISOString();
      
      // Record significant changes
      if (this.hasSignificantChange(previousMetrics, this.metrics)) {
        this.recordPerformanceSnapshot();
      }
      
    } catch (error) {
      console.error('[PerformanceOptimizer] Failed to update metrics:', error);
    }
  }

  /**
   * Check if there's a significant change in metrics
   */
  private hasSignificantChange(previous: PerformanceMetrics, current: PerformanceMetrics): boolean {
    // Battery level change > 5%
    if (Math.abs(previous.batteryLevel - current.batteryLevel) > 0.05) return true;
    
    // Low power mode change
    if (previous.isLowPowerMode !== current.isLowPowerMode) return true;
    
    // Charging state change
    if (previous.isCharging !== current.isCharging) return true;
    
    // Network type change
    if (previous.networkType !== current.networkType) return true;
    
    return false;
  }

  /**
   * Record a performance snapshot
   */
  private recordPerformanceSnapshot(): void {
    this.performanceHistory.push({
      timestamp: new Date().toISOString(),
      metrics: { ...this.metrics }
    });
    
    // Keep only last 100 entries
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
    
    this.savePerformanceHistory();
  }

  /**
   * Get network type as string
   */
  private getNetworkTypeString(state: NetInfoState): string {
    if (!state.isConnected) return 'offline';
    
    switch (state.type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return `cellular_${state.details?.cellularGeneration || 'unknown'}`;
      case 'ethernet':
        return 'ethernet';
      case 'bluetooth':
        return 'bluetooth';
      default:
        return 'unknown';
    }
  }

  /**
   * Get adaptive sync frequency based on current conditions
   */
  getAdaptiveSyncFrequency(priority: 'high' | 'normal' | 'low'): number {
    if (!this.settings.adaptiveSyncEnabled) {
      return this.baseSyncFrequencies[priority];
    }
    
    let frequency = this.baseSyncFrequencies[priority];
    
    // Battery optimization
    if (this.settings.batteryOptimizationEnabled) {
      if (this.metrics.batteryLevel < 0.2) {
        frequency *= 3; // Triple interval when battery < 20%
      } else if (this.metrics.batteryLevel < 0.5) {
        frequency *= 2; // Double interval when battery < 50%
      }
      
      if (this.metrics.isLowPowerMode) {
        frequency *= 2; // Double interval in low power mode
      }
      
      if (this.metrics.isCharging) {
        frequency *= 0.8; // Reduce interval when charging
      }
    }
    
    // Network optimization
    if (this.settings.networkOptimizationEnabled) {
      if (this.metrics.networkType.includes('cellular_2G') || this.metrics.networkType.includes('cellular_3G')) {
        frequency *= 2; // Double interval on slow networks
      } else if (this.metrics.networkType === 'wifi') {
        frequency *= 0.9; // Slightly reduce interval on WiFi
      }
    }
    
    // Device type optimization
    if (this.metrics.deviceType === 'TABLET') {
      frequency *= 0.9; // Tablets can handle more frequent syncs
    }
    
    return Math.max(frequency, 60 * 1000); // Minimum 1 minute
  }

  /**
   * Check if sync should be throttled
   */
  shouldThrottleSync(priority: 'high' | 'normal' | 'low' = 'normal'): boolean {
    if (!this.settings.backgroundThrottlingEnabled) {
      return false;
    }
    
    // Always throttle if battery is critically low
    if (this.metrics.batteryLevel < this.settings.minBatteryForSync) {
      console.log(`[PerformanceOptimizer] Throttling sync - battery too low: ${this.metrics.batteryLevel}`);
      return true;
    }
    
    // Throttle in low power mode for non-high priority tasks
    if (this.metrics.isLowPowerMode && priority !== 'high') {
      console.log('[PerformanceOptimizer] Throttling sync - low power mode');
      return true;
    }
    
    // Throttle on slow networks for low priority tasks
    if (this.settings.throttleOnSlowNetwork && priority === 'low') {
      if (this.metrics.networkType.includes('2G') || this.metrics.networkType === 'offline') {
        console.log('[PerformanceOptimizer] Throttling sync - slow/no network');
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get optimal batch size for sync operations
   */
  getOptimalBatchSize(baseBatchSize: number): number {
    let batchSize = baseBatchSize;
    
    // Reduce batch size on low battery
    if (this.metrics.batteryLevel < 0.3) {
      batchSize = Math.floor(batchSize * 0.5);
    }
    
    // Reduce batch size in low power mode
    if (this.metrics.isLowPowerMode) {
      batchSize = Math.floor(batchSize * 0.6);
    }
    
    // Reduce batch size on slow networks
    if (this.metrics.networkType.includes('2G') || this.metrics.networkType.includes('3G')) {
      batchSize = Math.floor(batchSize * 0.7);
    }
    
    return Math.max(batchSize, 1); // Minimum 1 item
  }

  /**
   * Check if background processing should be paused
   */
  shouldPauseBackgroundProcessing(): boolean {
    // Pause if battery is critically low
    if (this.metrics.batteryLevel < 0.1) {
      return true;
    }
    
    // Pause if offline
    if (this.metrics.networkType === 'offline') {
      return true;
    }
    
    return false;
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.batteryLevel < 0.2) {
      recommendations.push('Battery is low. Consider reducing sync frequency or enabling battery optimization.');
    }
    
    if (this.metrics.isLowPowerMode) {
      recommendations.push('Low Power Mode is enabled. Background sync will be limited.');
    }
    
    if (this.metrics.networkType.includes('2G') || this.metrics.networkType.includes('3G')) {
      recommendations.push('Slow network detected. Sync operations may be throttled.');
    }
    
    if (!this.settings.adaptiveSyncEnabled) {
      recommendations.push('Enable adaptive sync for better battery life and performance.');
    }
    
    return recommendations;
  }

  /**
   * Update optimization settings
   */
  async updateSettings(newSettings: Partial<OptimizationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
    console.log('[PerformanceOptimizer] Settings updated:', newSettings);
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current settings
   */
  getSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): Array<{ timestamp: string; metrics: Partial<PerformanceMetrics> }> {
    return [...this.performanceHistory];
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics(): {
    avgBatteryLevel: number;
    lowPowerModePercentage: number;
    networkDistribution: Record<string, number>;
    chargingPercentage: number;
  } {
    if (this.performanceHistory.length === 0) {
      return {
        avgBatteryLevel: this.metrics.batteryLevel,
        lowPowerModePercentage: this.metrics.isLowPowerMode ? 100 : 0,
        networkDistribution: { [this.metrics.networkType]: 100 },
        chargingPercentage: this.metrics.isCharging ? 100 : 0,
      };
    }
    
    const totalEntries = this.performanceHistory.length;
    let totalBattery = 0;
    let lowPowerCount = 0;
    let chargingCount = 0;
    const networkCounts: Record<string, number> = {};
    
    this.performanceHistory.forEach(entry => {
      if (entry.metrics.batteryLevel !== undefined) {
        totalBattery += entry.metrics.batteryLevel;
      }
      if (entry.metrics.isLowPowerMode) {
        lowPowerCount++;
      }
      if (entry.metrics.isCharging) {
        chargingCount++;
      }
      if (entry.metrics.networkType) {
        networkCounts[entry.metrics.networkType] = (networkCounts[entry.metrics.networkType] || 0) + 1;
      }
    });
    
    // Convert network counts to percentages
    const networkDistribution: Record<string, number> = {};
    Object.entries(networkCounts).forEach(([type, count]) => {
      networkDistribution[type] = (count / totalEntries) * 100;
    });
    
    return {
      avgBatteryLevel: totalBattery / totalEntries,
      lowPowerModePercentage: (lowPowerCount / totalEntries) * 100,
      networkDistribution,
      chargingPercentage: (chargingCount / totalEntries) * 100,
    };
  }

  /**
   * Reset performance history
   */
  async resetPerformanceHistory(): Promise<void> {
    this.performanceHistory = [];
    await this.savePerformanceHistory();
    console.log('[PerformanceOptimizer] Performance history reset');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = undefined;
    }
    
    console.log('[PerformanceOptimizer] Performance optimizer destroyed');
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();