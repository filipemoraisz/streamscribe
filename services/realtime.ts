import { RealtimeChannel, RealtimeClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { 
  RealTimeUpdate, 
  ConnectionState, 
  SyncAction, 
  QueueStatus, 
  SyncError,
  SyncResult 
} from '../types';
import { EnhancedSyncQueue } from './enhancedSyncQueue';

type UpdateCallback = (update: RealTimeUpdate) => void;
type ConnectionCallback = (connected: boolean) => void;

export class RealTimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
  };
  private enhancedSyncQueue?: EnhancedSyncQueue;
  private updateCallbacks: UpdateCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private networkUnsubscribe?: (() => void) | null;
  private deviceId: string = '';
  private isNetworkAvailable: boolean = true;
  private lastHeartbeatResponse?: string;
  private missedHeartbeats: number = 0;
  
  // Constants for reconnection logic
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 1000; // 1 second
  private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly MAX_MISSED_HEARTBEATS = 3;

  constructor() {
    this.initializeDeviceId();
    this.setupNetworkMonitoring();
  }

  private async initializeDeviceId(): Promise<void> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      this.deviceId = deviceId;
      
      // Initialize enhanced sync queue with device ID
      this.enhancedSyncQueue = new EnhancedSyncQueue(deviceId);
    } catch (error) {
      console.error('Failed to initialize device ID:', error);
      this.deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.enhancedSyncQueue = new EnhancedSyncQueue(this.deviceId);
    }
  }



  private setupNetworkMonitoring(): void {
    // Monitor network state changes
    this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasNetworkAvailable = this.isNetworkAvailable;
      this.isNetworkAvailable = state.isConnected ?? false;
      
      console.log(`Network state changed: ${wasNetworkAvailable} -> ${this.isNetworkAvailable}`);
      
      if (!wasNetworkAvailable && this.isNetworkAvailable) {
        // Network came back online
        console.log('Network reconnected, attempting to reconnect real-time service');
        this.handleNetworkRecovery();
      } else if (wasNetworkAvailable && !this.isNetworkAvailable) {
        // Network went offline
        console.log('Network disconnected');
        this.handleNetworkLoss();
      }
    });
  }

  private handleNetworkRecovery(): void {
    // Reset reconnection attempts when network recovers
    this.connectionState.reconnectAttempts = 0;
    
    // If we're not connected, try to reconnect immediately
    if (!this.connectionState.isConnected && !this.connectionState.isConnecting) {
      this.connect();
    }
  }

  private handleNetworkLoss(): void {
    // Don't attempt reconnections when network is unavailable
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    // Update connection state but don't trigger callbacks yet
    // (we'll wait for the actual connection to fail)
  }

  // Connection Management
  async connect(): Promise<void> {
    if (this.connectionState.isConnected || this.connectionState.isConnecting) {
      return;
    }

    this.connectionState.isConnecting = true;
    this.notifyConnectionChange(false);

    try {
      // Supabase handles connection automatically when we create channels
      // We'll simulate connection success and set up subscriptions
      console.log('Initializing real-time connection');
      
      this.connectionState.isConnected = true;
      this.connectionState.isConnecting = false;
      this.connectionState.reconnectAttempts = 0;
      this.connectionState.lastConnected = new Date().toISOString();
      
      this.notifyConnectionChange(true);
      this.startHeartbeat();
      this.processSyncQueue();
      this.setupUserSubscriptions();
      
    } catch (error) {
      console.error('Failed to connect to real-time service:', error);
      this.connectionState.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    console.log('Disconnecting from real-time service');
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // Unsubscribe from all channels
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();

    // Supabase channels handle disconnection automatically
    
    // Update connection state
    this.connectionState.isConnected = false;
    this.connectionState.isConnecting = false;
    this.notifyConnectionChange(false);
  }

  isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  private handleConnectionLoss(): void {
    this.connectionState.isConnected = false;
    this.connectionState.isConnecting = false;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    
    this.notifyConnectionChange(false);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    // Don't attempt reconnection if network is unavailable
    if (!this.isNetworkAvailable) {
      console.log('Network unavailable, skipping reconnection attempt');
      return;
    }

    if (this.connectionState.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached');
      return;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, this.connectionState.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );
    
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const totalDelay = delay + jitter;

    console.log(`Scheduling reconnection attempt ${this.connectionState.reconnectAttempts + 1} in ${Math.round(totalDelay)}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connectionState.reconnectAttempts++;
      this.connect();
    }, totalDelay);
  }

  private startHeartbeat(): void {
    this.missedHeartbeats = 0;
    this.lastHeartbeatResponse = new Date().toISOString();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState.isConnected) {
        this.performHeartbeatCheck();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private performHeartbeatCheck(): void {
    const now = new Date().toISOString();
    
    // Check if we've missed too many heartbeats
    if (this.lastHeartbeatResponse) {
      const lastResponse = new Date(this.lastHeartbeatResponse);
      const timeSinceLastResponse = Date.now() - lastResponse.getTime();
      
      if (timeSinceLastResponse > this.HEARTBEAT_INTERVAL * 2) {
        this.missedHeartbeats++;
        console.log(`Missed heartbeat ${this.missedHeartbeats}/${this.MAX_MISSED_HEARTBEATS}`);
        
        if (this.missedHeartbeats >= this.MAX_MISSED_HEARTBEATS) {
          console.log('Too many missed heartbeats, treating as connection loss');
          this.handleConnectionLoss();
          return;
        }
      } else {
        // Reset missed heartbeats if we got a recent response
        this.missedHeartbeats = 0;
      }
    }
    
    // Send heartbeat by checking connection status
    // Supabase handles heartbeats internally, but we can monitor the connection
    try {
      // Check if we have active channels as a proxy for connection health
      if (this.channels.size > 0) {
        this.lastHeartbeatResponse = now;
        this.missedHeartbeats = 0;
      }
    } catch (error) {
      console.error('Heartbeat check failed:', error);
      this.missedHeartbeats++;
    }
  }

  // Real-time Subscriptions
  subscribeToUserData(userId: string): void {
    if (!userId) {
      console.error('Cannot subscribe to user data: userId is required');
      return;
    }

    console.log(`Setting up user data subscriptions for user: ${userId}`);
    
    // Subscribe to all user-related tables
    this.subscribeToWatchlistUpdates(userId);
    this.subscribeToProgressUpdates(userId);
    this.subscribeToPreferenceUpdates(userId);
  }

  subscribeToWatchlistUpdates(userId: string): void {
    const channelName = `watchlist_${userId}`;
    
    if (this.channels.has(channelName)) {
      console.log(`Already subscribed to watchlist updates for user: ${userId}`);
      return;
    }

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'watchlist',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Watchlist update received:', payload);
          this.handleWatchlistUpdate(payload, userId);
        }
      )
      .subscribe((status) => {
        console.log(`Watchlist subscription status: ${status}`);
      });

    this.channels.set(channelName, channel);
  }

  subscribeToProgressUpdates(userId: string): void {
    const channelName = `progress_${userId}`;
    
    if (this.channels.has(channelName)) {
      console.log(`Already subscribed to progress updates for user: ${userId}`);
      return;
    }

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'episode_progress',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Episode progress update received:', payload);
          this.handleProgressUpdate(payload, userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'show_progress',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Show progress update received:', payload);
          this.handleProgressUpdate(payload, userId);
        }
      )
      .subscribe((status) => {
        console.log(`Progress subscription status: ${status}`);
      });

    this.channels.set(channelName, channel);
  }

  subscribeToPreferenceUpdates(userId: string): void {
    const channelName = `preferences_${userId}`;
    
    if (this.channels.has(channelName)) {
      console.log(`Already subscribed to preference updates for user: ${userId}`);
      return;
    }

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('User preferences update received:', payload);
          this.handlePreferenceUpdate(payload, userId);
        }
      )
      .subscribe((status) => {
        console.log(`Preferences subscription status: ${status}`);
      });

    this.channels.set(channelName, channel);
  }

  unsubscribeFromUser(userId: string): void {
    const channelNames = [
      `watchlist_${userId}`,
      `progress_${userId}`,
      `preferences_${userId}`,
    ];

    channelNames.forEach(channelName => {
      const channel = this.channels.get(channelName);
      if (channel) {
        console.log(`Unsubscribing from ${channelName}`);
        channel.unsubscribe();
        this.channels.delete(channelName);
      }
    });
  }

  // Update Handlers
  private handleWatchlistUpdate(payload: any, userId: string): void {
    try {
      const update: RealTimeUpdate = {
        id: `watchlist_${payload.new?.id || payload.old?.id}_${Date.now()}`,
        type: 'watchlist',
        userId,
        timestamp: new Date().toISOString(),
        data: {
          action: this.getActionFromPayload(payload),
          item: payload.new || payload.old,
          eventType: payload.eventType,
        },
      };

      this.notifyUpdate(update);
    } catch (error) {
      console.error('Error handling watchlist update:', error);
    }
  }

  private handleProgressUpdate(payload: any, userId: string): void {
    try {
      const update: RealTimeUpdate = {
        id: `progress_${payload.new?.id || payload.old?.id}_${Date.now()}`,
        type: 'progress',
        userId,
        timestamp: new Date().toISOString(),
        data: {
          action: this.getActionFromPayload(payload),
          progress: payload.new || payload.old,
          eventType: payload.eventType,
          table: payload.table,
        },
      };

      this.notifyUpdate(update);
    } catch (error) {
      console.error('Error handling progress update:', error);
    }
  }

  private handlePreferenceUpdate(payload: any, userId: string): void {
    try {
      const update: RealTimeUpdate = {
        id: `preferences_${userId}_${Date.now()}`,
        type: 'watchlist', // Using watchlist type for now, can be extended
        userId,
        timestamp: new Date().toISOString(),
        data: {
          action: this.getActionFromPayload(payload),
          preferences: payload.new || payload.old,
          eventType: payload.eventType,
        },
      };

      this.notifyUpdate(update);
    } catch (error) {
      console.error('Error handling preference update:', error);
    }
  }

  private getActionFromPayload(payload: any): 'add' | 'remove' | 'update' {
    switch (payload.eventType) {
      case 'INSERT':
        return 'add';
      case 'DELETE':
        return 'remove';
      case 'UPDATE':
        return 'update';
      default:
        return 'update';
    }
  }

  // Event Handling
  onUpdate(callback: UpdateCallback): void {
    this.updateCallbacks.push(callback);
  }

  onConnectionChange(callback: ConnectionCallback): void {
    this.connectionCallbacks.push(callback);
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  private notifyUpdate(update: RealTimeUpdate): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in update callback:', error);
      }
    });
  }

  // Sync Queue Management
  queueAction(action: Omit<SyncAction, 'id' | 'timestamp' | 'retryCount' | 'deviceId' | 'priority'>, priority: 'high' | 'normal' | 'low' = 'normal'): string {
    if (!this.enhancedSyncQueue) {
      console.error('Enhanced sync queue not initialized');
      return '';
    }

    const actionId = this.enhancedSyncQueue.queueAction(action, priority);

    // If connected, process immediately for high priority actions
    if (this.connectionState.isConnected && priority === 'high') {
      this.processSyncQueue();
    }

    return actionId;
  }

  // Queue real-time specific actions with appropriate priorities
  queueRealTimeProgressUpdate(payload: any): string {
    return this.queueAction({
      type: 'real_time_progress',
      payload,
    }, 'high'); // Progress updates are high priority for real-time sync
  }

  queueRealTimeWatchlistUpdate(payload: any): string {
    return this.queueAction({
      type: 'real_time_watchlist',
      payload,
    }, 'normal'); // Watchlist updates are normal priority
  }

  // Queue actions with optimistic updates
  async queueProgressUpdateWithOptimisticUI(
    payload: any,
    originalData: any,
    optimisticData: any
  ): Promise<{ actionId: string; optimisticUpdateId: string }> {
    if (!this.enhancedSyncQueue) {
      throw new Error('Enhanced sync queue not initialized');
    }

    const result = await this.enhancedSyncQueue.queueActionWithOptimisticUpdate(
      {
        type: 'real_time_progress',
        payload,
      },
      originalData,
      optimisticData,
      'high'
    );

    // If connected, process immediately
    if (this.connectionState.isConnected) {
      this.processSyncQueue();
    }

    return result;
  }

  async queueWatchlistUpdateWithOptimisticUI(
    payload: any,
    originalData: any,
    optimisticData: any
  ): Promise<{ actionId: string; optimisticUpdateId: string }> {
    if (!this.enhancedSyncQueue) {
      throw new Error('Enhanced sync queue not initialized');
    }

    const result = await this.enhancedSyncQueue.queueActionWithOptimisticUpdate(
      {
        type: 'real_time_watchlist',
        payload,
      },
      originalData,
      optimisticData,
      'normal'
    );

    // If connected, process immediately
    if (this.connectionState.isConnected) {
      this.processSyncQueue();
    }

    return result;
  }

  queueStreamingAvailabilityUpdate(payload: any): string {
    return this.queueAction({
      type: 'streaming_availability_update',
      payload,
    }, 'low'); // Streaming updates are low priority (not time-critical)
  }

  queueEpisodeReleaseUpdate(payload: any): string {
    return this.queueAction({
      type: 'episode_release_update',
      payload,
    }, 'normal'); // Episode releases are normal priority
  }

  async processSyncQueue(): Promise<void> {
    if (!this.enhancedSyncQueue || !this.connectionState.isConnected) {
      return;
    }

    const queueStatus = this.enhancedSyncQueue.getQueueStatus();
    if (queueStatus.pendingActions === 0) {
      return;
    }

    console.log(`Processing ${queueStatus.pendingActions} queued actions`);
    
    // Create batches for efficient processing
    const batches = this.enhancedSyncQueue.createBatches();
    const processedActionIds: string[] = [];
    
    // Process batches in priority order
    for (const batch of batches) {
      try {
        console.log(`Processing ${batch.priority} priority batch with ${batch.actions.length} actions`);
        
        const batchResult = await this.processBatch(batch.actions);
        processedActionIds.push(...batchResult.processedIds);
        
        // Confirm optimistic updates for successful actions
        batchResult.processedIds.forEach(actionId => {
          if (this.enhancedSyncQueue) {
            this.enhancedSyncQueue.confirmOptimisticUpdate(actionId);
          }
        });

        // Rollback optimistic updates for failed actions
        batchResult.failedIds.forEach(actionId => {
          if (this.enhancedSyncQueue) {
            this.enhancedSyncQueue.rollbackOptimisticUpdate(actionId, 'Sync processing failed');
          }
        });
        
      } catch (error) {
        console.error(`Failed to process batch ${batch.id}:`, error);
        
        // Handle batch failure - retry individual actions
        for (const action of batch.actions) {
          try {
            await this.processAction(action);
            processedActionIds.push(action.id);
          } catch (actionError) {
            console.error(`Failed to process individual action ${action.id}:`, actionError);
            // Action will remain in queue for retry
          }
        }
      }
    }

    // Clear processed actions from queue
    if (processedActionIds.length > 0) {
      this.enhancedSyncQueue.clearProcessedActions(processedActionIds);
    }
  }

  /**
   * Process a batch of actions efficiently
   */
  private async processBatch(actions: SyncAction[]): Promise<{ processedIds: string[], failedIds: string[] }> {
    const processedIds: string[] = [];
    const failedIds: string[] = [];

    // Group actions by type for batch processing
    const actionsByType = new Map<string, SyncAction[]>();
    actions.forEach(action => {
      if (!actionsByType.has(action.type)) {
        actionsByType.set(action.type, []);
      }
      actionsByType.get(action.type)!.push(action);
    });

    // Process each type as a batch
    for (const [actionType, typeActions] of actionsByType) {
      try {
        const result = await this.processBatchByType(actionType, typeActions);
        processedIds.push(...result.processedIds);
        failedIds.push(...result.failedIds);
      } catch (error) {
        console.error(`Failed to process batch for type ${actionType}:`, error);
        failedIds.push(...typeActions.map(a => a.id));
      }
    }

    return { processedIds, failedIds };
  }

  /**
   * Process actions of the same type as a batch
   */
  private async processBatchByType(actionType: string, actions: SyncAction[]): Promise<{ processedIds: string[], failedIds: string[] }> {
    const processedIds: string[] = [];
    const failedIds: string[] = [];

    // Use enhanced sync queue's conflict resolution for critical action types
    if (['real_time_progress', 'progress_update', 'real_time_watchlist', 'watchlist_change'].includes(actionType)) {
      if (this.enhancedSyncQueue) {
        const batchResult = await this.enhancedSyncQueue.processBatchWithConflictResolution(actions);
        
        // Process the resolved actions
        for (const resolvedAction of batchResult.processedActions) {
          try {
            await this.processAction(resolvedAction);
            processedIds.push(resolvedAction.id);
          } catch (error) {
            console.error(`Failed to process resolved action ${resolvedAction.id}:`, error);
            failedIds.push(resolvedAction.id);
          }
        }
        
        // Add failed actions from conflict resolution
        batchResult.errors.forEach(error => {
          failedIds.push(error.actionId);
        });
        
        // Log conflict resolutions
        if (batchResult.conflictResolutions.length > 0) {
          console.log(`[RealTimeManager] Resolved ${batchResult.conflictResolutions.length} conflicts in batch`);
        }
        
        return { processedIds, failedIds };
      }
    }

    // Fallback to individual processing for other action types
    switch (actionType) {
      case 'real_time_progress':
      case 'progress_update':
        for (const action of actions) {
          try {
            await this.processProgressAction(action);
            processedIds.push(action.id);
          } catch (error) {
            console.error(`Failed to process progress action ${action.id}:`, error);
            failedIds.push(action.id);
          }
        }
        break;

      case 'real_time_watchlist':
      case 'watchlist_change':
        for (const action of actions) {
          try {
            await this.processWatchlistAction(action);
            processedIds.push(action.id);
          } catch (error) {
            console.error(`Failed to process watchlist action ${action.id}:`, error);
            failedIds.push(action.id);
          }
        }
        break;

      default:
        // Process other actions individually
        for (const action of actions) {
          try {
            await this.processAction(action);
            processedIds.push(action.id);
          } catch (error) {
            console.error(`Failed to process action ${action.id}:`, error);
            failedIds.push(action.id);
          }
        }
    }

    return { processedIds, failedIds };
  }

  private async processAction(action: SyncAction): Promise<void> {
    console.log(`Processing action: ${action.type}`, action.payload);
    
    switch (action.type) {
      case 'real_time_progress':
      case 'progress_update':
        await this.processProgressAction(action);
        break;
      case 'real_time_watchlist':
      case 'watchlist_change':
        await this.processWatchlistAction(action);
        break;
      case 'preference_update':
        await this.processPreferenceAction(action);
        break;
      case 'streaming_availability_update':
        await this.processStreamingAvailabilityAction(action);
        break;
      case 'episode_release_update':
        await this.processEpisodeReleaseAction(action);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Process progress update actions
   */
  private async processProgressAction(action: SyncAction): Promise<void> {
    const { showId, seasonNumber, episodeNumber, watched, userId } = action.payload;
    
    const { error } = await supabase
      .from('episode_progress')
      .upsert({
        user_id: userId,
        show_id: showId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        watched,
        watched_date: watched ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        device_id: action.deviceId,
        sync_timestamp: action.originalTimestamp || action.timestamp,
      });
    
    if (error) {
      throw new Error(`Failed to update episode progress: ${error.message}`);
    }
  }

  /**
   * Process watchlist change actions
   */
  private async processWatchlistAction(action: SyncAction): Promise<void> {
    const { itemId, userId, operation, itemData } = action.payload;
    
    switch (operation) {
      case 'add':
        const { error: addError } = await supabase
          .from('watchlist')
          .insert({
            user_id: userId,
            item_id: itemId,
            item_type: itemData?.type || 'movie',
            added_date: new Date().toISOString(),
            device_id: action.deviceId,
            sync_timestamp: action.originalTimestamp || action.timestamp,
          });
        
        if (addError && !addError.message.includes('duplicate')) {
          throw new Error(`Failed to add to watchlist: ${addError.message}`);
        }
        break;
        
      case 'remove':
        const { error: removeError } = await supabase
          .from('watchlist')
          .delete()
          .match({ user_id: userId, item_id: itemId });
        
        if (removeError) {
          throw new Error(`Failed to remove from watchlist: ${removeError.message}`);
        }
        break;

      case 'update':
        const { error: updateError } = await supabase
          .from('watchlist')
          .update({
            ...itemData,
            updated_at: new Date().toISOString(),
            device_id: action.deviceId,
            sync_timestamp: action.originalTimestamp || action.timestamp,
          })
          .match({ user_id: userId, item_id: itemId });
        
        if (updateError) {
          throw new Error(`Failed to update watchlist item: ${updateError.message}`);
        }
        break;
    }
  }

  /**
   * Process preference update actions
   */
  private async processPreferenceAction(action: SyncAction): Promise<void> {
    const { userId, preferences } = action.payload;
    
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
        device_id: action.deviceId,
        sync_timestamp: action.originalTimestamp || action.timestamp,
      });
    
    if (error) {
      throw new Error(`Failed to update preferences: ${error.message}`);
    }
  }

  /**
   * Process streaming availability update actions
   */
  private async processStreamingAvailabilityAction(action: SyncAction): Promise<void> {
    const { itemId, availabilityData } = action.payload;
    
    const { error } = await supabase
      .from('streaming_availability')
      .upsert({
        item_id: itemId,
        ...availabilityData,
        updated_at: new Date().toISOString(),
        sync_timestamp: action.originalTimestamp || action.timestamp,
      });
    
    if (error) {
      throw new Error(`Failed to update streaming availability: ${error.message}`);
    }
  }

  /**
   * Process episode release update actions
   */
  private async processEpisodeReleaseAction(action: SyncAction): Promise<void> {
    const { showId, episodeData } = action.payload;
    
    const { error } = await supabase
      .from('episode_cache')
      .upsert({
        show_id: showId,
        ...episodeData,
        updated_at: new Date().toISOString(),
        sync_timestamp: action.originalTimestamp || action.timestamp,
      });
    
    if (error) {
      throw new Error(`Failed to update episode cache: ${error.message}`);
    }
  }

  getQueueStatus(): QueueStatus {
    if (!this.enhancedSyncQueue) {
      return {
        pendingActions: 0,
        lastSyncTime: this.connectionState.lastConnected || '',
        isProcessing: false,
        errors: [],
      };
    }

    return this.enhancedSyncQueue.getQueueStatus();
  }

  /**
   * Get enhanced queue status with additional information
   */
  getEnhancedQueueStatus() {
    return this.enhancedSyncQueue?.getQueueStatus() || null;
  }

  /**
   * Get queue statistics for monitoring
   */
  getQueueStatistics() {
    return this.enhancedSyncQueue?.getQueueStatistics() || null;
  }

  /**
   * Get device tracker information
   */
  getDeviceTracker(deviceId?: string) {
    if (!this.enhancedSyncQueue) return null;
    return deviceId 
      ? this.enhancedSyncQueue.getDeviceTracker(deviceId)
      : this.enhancedSyncQueue.getAllDeviceTrackers();
  }

  /**
   * Get conflict resolution history
   */
  getConflictHistory() {
    return this.enhancedSyncQueue?.getConflictHistory() || [];
  }

  /**
   * Get conflict statistics
   */
  getConflictStatistics() {
    return this.enhancedSyncQueue?.getConflictStatistics() || null;
  }

  /**
   * Clear old conflict logs
   */
  async clearOldConflictLogs(olderThanDays: number = 7): Promise<void> {
    if (this.enhancedSyncQueue) {
      await this.enhancedSyncQueue.clearOldConflictLogs(olderThanDays);
    }
  }

  /**
   * Register for sync status updates
   */
  onSyncStatusChange(actionId: string, callback: (status: any) => void): void {
    if (this.enhancedSyncQueue) {
      this.enhancedSyncQueue.onSyncStatusChange(actionId, callback);
    }
  }

  /**
   * Unregister sync status updates
   */
  offSyncStatusChange(actionId: string): void {
    if (this.enhancedSyncQueue) {
      this.enhancedSyncQueue.offSyncStatusChange(actionId);
    }
  }

  /**
   * Get pending optimistic updates
   */
  getPendingOptimisticUpdates() {
    return this.enhancedSyncQueue?.getPendingOptimisticUpdates() || [];
  }

  /**
   * Get optimistic update statistics
   */
  getOptimisticUpdateStatistics() {
    return this.enhancedSyncQueue?.getOptimisticUpdateStatistics() || null;
  }

  /**
   * Clear old optimistic update data
   */
  async clearOldOptimisticData(olderThanMinutes: number = 60): Promise<void> {
    if (this.enhancedSyncQueue) {
      await this.enhancedSyncQueue.clearOldOptimisticData(olderThanMinutes);
    }
  }

  // Additional connection utilities
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  isNetworkConnected(): boolean {
    return this.isNetworkAvailable;
  }

  forceReconnect(): void {
    console.log('Forcing reconnection');
    this.connectionState.reconnectAttempts = 0;
    this.disconnect();
    setTimeout(() => this.connect(), 1000);
  }

  private setupUserSubscriptions(): Promise<void> {
    return new Promise(async (resolve) => {
    try {
      // Get current user from Supabase session (more reliable than getUser)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (user) {
        console.log(`Setting up subscriptions for authenticated user: ${user.id}`);
        this.subscribeToUserData(user.id);
      } else {
        console.log('No authenticated user found, skipping subscriptions');
      }
      } catch (error) {
        console.error('Failed to setup user subscriptions:', error);
      }
      
      resolve();
    });
  }

  // Authentication handling
  handleUserChange(userId: string | null): Promise<void> {
    return new Promise((resolve) => {
    // Clear all existing subscriptions
    this.channels.forEach((channel, channelName) => {
      console.log(`Unsubscribing from ${channelName} due to user change`);
      channel.unsubscribe();
    });
    this.channels.clear();

      // Set up new subscriptions if user is authenticated
      if (userId && this.connectionState.isConnected) {
        console.log(`Setting up subscriptions for new user: ${userId}`);
        this.subscribeToUserData(userId);
      }
      
      resolve();
    });
  }

  // Subscription Management
  getActiveSubscriptions(): string[] {
    return Array.from(this.channels.keys());
  }

  getSubscriptionCount(): number {
    return this.channels.size;
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    
    // Unsubscribe from network monitoring
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    
    this.updateCallbacks = [];
    this.connectionCallbacks = [];
  }
}

// Singleton instance
export const realTimeManager = new RealTimeManager();