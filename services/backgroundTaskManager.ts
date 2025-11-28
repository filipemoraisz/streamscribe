import AsyncStorage from '@react-native-async-storage/async-storage';
import { performanceOptimizer } from './performanceOptimizer';

// Conditional imports for Expo modules
let TaskManager: any = null;
let BackgroundFetch: any = null;

try {
  TaskManager = require('expo-task-manager');
} catch (error) {
  console.warn('[BackgroundTaskManager] expo-task-manager not available');
}

try {
  BackgroundFetch = require('expo-background-fetch');
} catch (error) {
  console.warn('[BackgroundTaskManager] expo-background-fetch not available');
}

export interface BackgroundTask {
  id: string;
  name: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  handler: () => Promise<TaskResult>;
  interval: number;
  maxRetries: number;
  timeout: number;
  dependencies?: string[];
  fallbackHandler?: () => Promise<TaskResult>;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  retryCount: number;
  consecutiveFailures: number;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  timestamp: string;
}

export interface TaskExecution {
  taskId: string;
  startTime: string;
  endTime?: string;
  result?: TaskResult;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
}

interface TaskManagerState {
  isInitialized: boolean;
  isProcessing: boolean;
  activeExecutions: Map<string, TaskExecution>;
  taskQueue: string[];
  lastCleanup: string;
}

export class BackgroundTaskManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private state: TaskManagerState = {
    isInitialized: false,
    isProcessing: false,
    activeExecutions: new Map(),
    taskQueue: [],
    lastCleanup: new Date().toISOString(),
  };
  
  private processingInterval?: ReturnType<typeof setInterval>;
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private maxConcurrentTasks = 3;
  private taskHistory: TaskExecution[] = [];
  private maxHistorySize = 100;

  /**
   * Initialize the background task manager
   */
  async initialize(): Promise<void> {
    try {
      console.log('[BackgroundTaskManager] Initializing background task manager');
      
      if (!TaskManager || !BackgroundFetch) {
        console.warn('[BackgroundTaskManager] Required Expo modules not available');
        return;
      }
      
      // Load saved tasks and state
      await this.loadTasks();
      await this.loadTaskHistory();
      
      // Set up task processing
      this.setupTaskProcessing();
      
      // Set up periodic cleanup
      this.setupPeriodicCleanup();
      
      this.state.isInitialized = true;
      console.log('[BackgroundTaskManager] Background task manager initialized');
    } catch (error) {
      console.error('[BackgroundTaskManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Register a background task
   */
  async registerTask(task: Omit<BackgroundTask, 'id' | 'retryCount' | 'consecutiveFailures'>): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const backgroundTask: BackgroundTask = {
      id: taskId,
      retryCount: 0,
      consecutiveFailures: 0,
      ...task,
    };
    
    this.tasks.set(taskId, backgroundTask);
    
    // Register with Expo TaskManager if available
    if (TaskManager) {
      try {
        TaskManager.defineTask(task.name, async () => {
          return await this.executeTaskWrapper(taskId);
        });
        
        console.log(`[BackgroundTaskManager] Registered task: ${task.name} (${taskId})`);
      } catch (error) {
        console.error(`[BackgroundTaskManager] Failed to register task ${task.name}:`, error);
      }
    }
    
    // Save tasks to storage
    await this.saveTasks();
    
    // Schedule next run
    this.scheduleTask(taskId);
    
    return taskId;
  }

  /**
   * Unregister a background task
   */
  async unregisterTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`[BackgroundTaskManager] Task not found: ${taskId}`);
      return;
    }
    
    // Cancel if currently running
    const execution = this.state.activeExecutions.get(taskId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      this.state.activeExecutions.delete(taskId);
    }
    
    // Unregister from Expo TaskManager
    if (TaskManager) {
      try {
        TaskManager.undefineTask(task.name);
        console.log(`[BackgroundTaskManager] Unregistered task: ${task.name} (${taskId})`);
      } catch (error) {
        console.error(`[BackgroundTaskManager] Failed to unregister task ${task.name}:`, error);
      }
    }
    
    // Remove from tasks
    this.tasks.delete(taskId);
    
    // Remove from queue
    this.state.taskQueue = this.state.taskQueue.filter(id => id !== taskId);
    
    await this.saveTasks();
  }

  /**
   * Execute task wrapper for Expo TaskManager
   */
  private async executeTaskWrapper(taskId: string): Promise<any> {
    try {
      const result = await this.executeTask(taskId);
      
      if (result.success) {
        return BackgroundFetch?.BackgroundFetchResult?.NewData || 'success';
      } else {
        return BackgroundFetch?.BackgroundFetchResult?.Failed || 'failed';
      }
    } catch (error) {
      console.error(`[BackgroundTaskManager] Task wrapper error for ${taskId}:`, error);
      return BackgroundFetch?.BackgroundFetchResult?.Failed || 'failed';
    }
  }

  /**
   * Execute a specific task
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    if (!task.enabled) {
      console.log(`[BackgroundTaskManager] Task ${task.name} is disabled, skipping`);
      return {
        success: false,
        error: 'Task is disabled',
        duration: 0,
        timestamp: new Date().toISOString(),
      };
    }
    
    // Check if we should throttle this task
    if (performanceOptimizer.shouldThrottleSync(this.mapPriorityToOptimizerPriority(task.priority))) {
      console.log(`[BackgroundTaskManager] Throttling task ${task.name} due to performance constraints`);
      return {
        success: false,
        error: 'Task throttled due to performance constraints',
        duration: 0,
        timestamp: new Date().toISOString(),
      };
    }
    
    const execution: TaskExecution = {
      taskId,
      startTime: new Date().toISOString(),
      status: 'running',
    };
    
    this.state.activeExecutions.set(taskId, execution);
    
    const startTime = Date.now();
    let result: TaskResult;
    
    try {
      console.log(`[BackgroundTaskManager] Executing task: ${task.name} (${taskId})`);
      
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), task.timeout);
      });
      
      // Execute task with timeout
      const taskPromise = task.handler();
      const taskResult = await Promise.race([taskPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      
      result = {
        success: true,
        data: taskResult,
        duration,
        timestamp: new Date().toISOString(),
      };
      
      // Reset failure counters on success
      task.retryCount = 0;
      task.consecutiveFailures = 0;
      
      execution.status = 'completed';
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[BackgroundTaskManager] Task ${task.name} failed:`, error);
      
      result = {
        success: false,
        error: errorMessage,
        duration,
        timestamp: new Date().toISOString(),
      };
      
      // Update failure counters
      task.retryCount++;
      task.consecutiveFailures++;
      
      execution.status = errorMessage.includes('timeout') ? 'timeout' : 'failed';
      
      // Try fallback handler if available and not a timeout
      if (task.fallbackHandler && !errorMessage.includes('timeout')) {
        try {
          console.log(`[BackgroundTaskManager] Attempting fallback for task: ${task.name}`);
          const fallbackResult = await task.fallbackHandler();
          
          result = {
            success: true,
            data: fallbackResult,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          };
          
          execution.status = 'completed';
          console.log(`[BackgroundTaskManager] Fallback succeeded for task: ${task.name}`);
        } catch (fallbackError) {
          console.error(`[BackgroundTaskManager] Fallback failed for task ${task.name}:`, fallbackError);
        }
      }
    }
    
    // Update execution
    execution.endTime = new Date().toISOString();
    execution.result = result;
    
    // Update task timestamps
    task.lastRun = new Date().toISOString();
    
    // Schedule next run if task is still enabled and not exceeded max failures
    if (task.enabled && task.consecutiveFailures < 5) {
      this.scheduleTask(taskId);
    } else if (task.consecutiveFailures >= 5) {
      console.warn(`[BackgroundTaskManager] Disabling task ${task.name} due to consecutive failures`);
      task.enabled = false;
    }
    
    // Add to history
    this.addToHistory(execution);
    
    // Remove from active executions
    this.state.activeExecutions.delete(taskId);
    
    // Save updated task state
    await this.saveTasks();
    
    return result;
  }

  /**
   * Schedule a task for future execution
   */
  private scheduleTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled) return;
    
    // Calculate next run time based on priority and performance
    const adaptiveInterval = performanceOptimizer.getAdaptiveSyncFrequency(
      this.mapPriorityToOptimizerPriority(task.priority)
    );
    
    const nextRunTime = new Date(Date.now() + Math.max(task.interval, adaptiveInterval));
    task.nextRun = nextRunTime.toISOString();
    
    // Add to queue if not already there
    if (!this.state.taskQueue.includes(taskId)) {
      this.state.taskQueue.push(taskId);
      this.sortTaskQueue();
    }
  }

  /**
   * Sort task queue by priority and next run time
   */
  private sortTaskQueue(): void {
    this.state.taskQueue.sort((a, b) => {
      const taskA = this.tasks.get(a);
      const taskB = this.tasks.get(b);
      
      if (!taskA || !taskB) return 0;
      
      // Sort by priority first
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[taskA.priority] - priorityOrder[taskB.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by next run time
      const timeA = new Date(taskA.nextRun || 0).getTime();
      const timeB = new Date(taskB.nextRun || 0).getTime();
      
      return timeA - timeB;
    });
  }

  /**
   * Set up task processing loop
   */
  private setupTaskProcessing(): void {
    // Process tasks every minute
    this.processingInterval = setInterval(async () => {
      await this.processTaskQueue();
    }, 60 * 1000);
  }

  /**
   * Process the task queue
   */
  private async processTaskQueue(): Promise<void> {
    if (this.state.isProcessing || this.state.taskQueue.length === 0) {
      return;
    }
    
    // Check if we should pause background processing
    if (performanceOptimizer.shouldPauseBackgroundProcessing()) {
      console.log('[BackgroundTaskManager] Pausing task processing due to performance constraints');
      return;
    }
    
    this.state.isProcessing = true;
    
    try {
      const now = Date.now();
      const tasksToRun: string[] = [];
      
      // Find tasks that are ready to run
      for (const taskId of this.state.taskQueue) {
        if (this.state.activeExecutions.size >= this.maxConcurrentTasks) {
          break; // Don't exceed concurrent task limit
        }
        
        const task = this.tasks.get(taskId);
        if (!task || !task.enabled) {
          continue;
        }
        
        // Check if task is ready to run
        const nextRunTime = new Date(task.nextRun || 0).getTime();
        if (nextRunTime <= now) {
          tasksToRun.push(taskId);
        }
      }
      
      // Execute ready tasks
      for (const taskId of tasksToRun) {
        if (this.state.activeExecutions.size >= this.maxConcurrentTasks) {
          break;
        }
        
        // Remove from queue
        this.state.taskQueue = this.state.taskQueue.filter(id => id !== taskId);
        
        // Execute task (don't await - run concurrently)
        this.executeTask(taskId).catch(error => {
          console.error(`[BackgroundTaskManager] Task execution error for ${taskId}:`, error);
        });
      }
      
    } finally {
      this.state.isProcessing = false;
    }
  }

  /**
   * Set up periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    // Cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Perform cleanup operations
   */
  private async performCleanup(): Promise<void> {
    console.log('[BackgroundTaskManager] Performing periodic cleanup');
    
    try {
      // Clean up old task history
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
      this.taskHistory = this.taskHistory.filter(execution => {
        const executionTime = new Date(execution.startTime).getTime();
        return executionTime > cutoffTime;
      });
      
      // Limit history size
      if (this.taskHistory.length > this.maxHistorySize) {
        this.taskHistory = this.taskHistory.slice(-this.maxHistorySize);
      }
      
      // Clean up completed executions that are older than 1 hour
      const executionCutoff = Date.now() - (60 * 60 * 1000);
      for (const [taskId, execution] of this.state.activeExecutions) {
        const startTime = new Date(execution.startTime).getTime();
        if (execution.status !== 'running' && startTime < executionCutoff) {
          this.state.activeExecutions.delete(taskId);
        }
      }
      
      // Reset retry counts for tasks that haven't run recently
      const retryCutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      for (const task of this.tasks.values()) {
        const lastRun = task.lastRun ? new Date(task.lastRun).getTime() : 0;
        if (lastRun < retryCutoff && task.retryCount > 0) {
          task.retryCount = 0;
          console.log(`[BackgroundTaskManager] Reset retry count for task: ${task.name}`);
        }
      }
      
      this.state.lastCleanup = new Date().toISOString();
      
      // Save updated state
      await this.saveTasks();
      await this.saveTaskHistory();
      
    } catch (error) {
      console.error('[BackgroundTaskManager] Cleanup error:', error);
    }
  }

  /**
   * Add execution to history
   */
  private addToHistory(execution: TaskExecution): void {
    this.taskHistory.push({ ...execution });
    
    // Limit history size
    if (this.taskHistory.length > this.maxHistorySize) {
      this.taskHistory = this.taskHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Map task priority to performance optimizer priority
   */
  private mapPriorityToOptimizerPriority(priority: BackgroundTask['priority']): 'high' | 'normal' | 'low' {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'high';
      case 'normal':
        return 'normal';
      case 'low':
        return 'low';
    }
  }

  /**
   * Load tasks from storage
   */
  private async loadTasks(): Promise<void> {
    try {
      const tasksData = await AsyncStorage.getItem('background_task_manager_tasks');
      if (tasksData) {
        const tasksArray: BackgroundTask[] = JSON.parse(tasksData);
        this.tasks.clear();
        
        for (const task of tasksArray) {
          // Note: handlers and fallbackHandlers need to be re-registered
          // This is just for loading metadata
          this.tasks.set(task.id, task);
        }
        
        console.log(`[BackgroundTaskManager] Loaded ${this.tasks.size} tasks from storage`);
      }
    } catch (error) {
      console.error('[BackgroundTaskManager] Failed to load tasks:', error);
    }
  }

  /**
   * Save tasks to storage
   */
  private async saveTasks(): Promise<void> {
    try {
      const tasksArray = Array.from(this.tasks.values()).map(task => ({
        ...task,
        handler: undefined, // Don't serialize functions
        fallbackHandler: undefined,
      }));
      
      await AsyncStorage.setItem('background_task_manager_tasks', JSON.stringify(tasksArray));
    } catch (error) {
      console.error('[BackgroundTaskManager] Failed to save tasks:', error);
    }
  }

  /**
   * Load task history from storage
   */
  private async loadTaskHistory(): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem('background_task_manager_history');
      if (historyData) {
        this.taskHistory = JSON.parse(historyData);
        console.log(`[BackgroundTaskManager] Loaded ${this.taskHistory.length} history entries`);
      }
    } catch (error) {
      console.error('[BackgroundTaskManager] Failed to load task history:', error);
    }
  }

  /**
   * Save task history to storage
   */
  private async saveTaskHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('background_task_manager_history', JSON.stringify(this.taskHistory));
    } catch (error) {
      console.error('[BackgroundTaskManager] Failed to save task history:', error);
    }
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): TaskExecution[] {
    return Array.from(this.state.activeExecutions.values());
  }

  /**
   * Get task history
   */
  getTaskHistory(taskId?: string): TaskExecution[] {
    if (taskId) {
      return this.taskHistory.filter(execution => execution.taskId === taskId);
    }
    return [...this.taskHistory];
  }

  /**
   * Get task statistics
   */
  getTaskStatistics(taskId: string): {
    totalRuns: number;
    successRate: number;
    avgDuration: number;
    lastSuccess?: string;
    lastFailure?: string;
  } {
    const executions = this.getTaskHistory(taskId);
    
    if (executions.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        avgDuration: 0,
      };
    }
    
    const completedExecutions = executions.filter(e => e.result);
    const successfulExecutions = completedExecutions.filter(e => e.result?.success);
    
    const totalDuration = completedExecutions.reduce((sum, e) => sum + (e.result?.duration || 0), 0);
    const avgDuration = completedExecutions.length > 0 ? totalDuration / completedExecutions.length : 0;
    
    const lastSuccess = successfulExecutions
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0]?.startTime;
    
    const failedExecutions = completedExecutions.filter(e => !e.result?.success);
    const lastFailure = failedExecutions
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0]?.startTime;
    
    return {
      totalRuns: completedExecutions.length,
      successRate: completedExecutions.length > 0 ? (successfulExecutions.length / completedExecutions.length) * 100 : 0,
      avgDuration,
      lastSuccess,
      lastFailure,
    };
  }

  /**
   * Enable/disable a task
   */
  async setTaskEnabled(taskId: string, enabled: boolean): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    task.enabled = enabled;
    
    if (enabled) {
      // Reset failure counters when re-enabling
      task.consecutiveFailures = 0;
      task.retryCount = 0;
      this.scheduleTask(taskId);
    } else {
      // Remove from queue when disabling
      this.state.taskQueue = this.state.taskQueue.filter(id => id !== taskId);
    }
    
    await this.saveTasks();
    console.log(`[BackgroundTaskManager] Task ${task.name} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Force execute a task immediately
   */
  async forceExecuteTask(taskId: string): Promise<TaskResult> {
    console.log(`[BackgroundTaskManager] Force executing task: ${taskId}`);
    return await this.executeTask(taskId);
  }

  /**
   * Get manager state
   */
  getState(): TaskManagerState {
    return {
      ...this.state,
      activeExecutions: new Map(this.state.activeExecutions),
      taskQueue: [...this.state.taskQueue],
    };
  }

  /**
   * Cleanup and destroy the task manager
   */
  async destroy(): Promise<void> {
    console.log('[BackgroundTaskManager] Destroying background task manager');
    
    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    // Cancel all active executions
    for (const execution of this.state.activeExecutions.values()) {
      if (execution.status === 'running') {
        execution.status = 'cancelled';
      }
    }
    
    // Unregister all tasks
    for (const taskId of this.tasks.keys()) {
      await this.unregisterTask(taskId);
    }
    
    // Save final state
    await this.saveTasks();
    await this.saveTaskHistory();
    
    this.state.isInitialized = false;
    console.log('[BackgroundTaskManager] Background task manager destroyed');
  }
}

// Export singleton instance
export const backgroundTaskManager = new BackgroundTaskManager();