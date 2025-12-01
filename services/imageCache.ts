/**
 * Image Cache Service (Subtask 10.2)
 * Handles caching and preloading of poster images
 * Requirements: 7.5, 8.8
 */

import { Image } from 'react-native';

class ImageCacheService {
  private cache: Map<string, boolean> = new Map();
  private preloadQueue: Set<string> = new Set();
  private isPreloading = false;

  /**
   * Check if image is cached
   */
  isCached(uri: string): boolean {
    return this.cache.has(uri);
  }

  /**
   * Preload a single image
   */
  async preloadImage(uri: string): Promise<void> {
    if (this.cache.has(uri)) {
      return; // Already cached
    }

    try {
      await Image.prefetch(uri);
      this.cache.set(uri, true);
    } catch (error) {
      console.error(`Failed to preload image: ${uri}`, error);
      // Mark as failed but don't throw - graceful degradation
      this.cache.set(uri, false);
    }
  }

  /**
   * Preload multiple images in sequence
   */
  async preloadImages(uris: string[]): Promise<void> {
    const uncachedUris = uris.filter(uri => !this.cache.has(uri));
    
    if (uncachedUris.length === 0) {
      return;
    }

    // Add to preload queue
    uncachedUris.forEach(uri => this.preloadQueue.add(uri));

    // Start preloading if not already in progress
    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  /**
   * Process preload queue sequentially
   */
  private async processPreloadQueue(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.size === 0) {
      return;
    }

    this.isPreloading = true;

    try {
      // Process queue items one at a time
      for (const uri of this.preloadQueue) {
        await this.preloadImage(uri);
        this.preloadQueue.delete(uri);
      }
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Clear cache (useful for memory management)
   */
  clear(): void {
    this.cache.clear();
    this.preloadQueue.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): {
    cachedCount: number;
    queuedCount: number;
    isPreloading: boolean;
  } {
    return {
      cachedCount: this.cache.size,
      queuedCount: this.preloadQueue.size,
      isPreloading: this.isPreloading,
    };
  }
}

export const imageCacheService = new ImageCacheService();
