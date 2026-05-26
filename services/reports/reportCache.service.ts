// services/reports/reportCache.service.ts
import NodeCache from "node-cache";
import Redis from "ioredis";
import { IReportDocument } from "../../models/report.model";

// Cache configuration interface
interface ICacheConfig {
  ttl: number; // Time to live in seconds
  maxKeys: number;
  checkperiod: number;
}

// Cache layer types
type CacheLayer = 'memory' | 'redis' | 'hybrid';

// Cache key patterns
interface ICacheKeys {
  REPORT_DATA: (reportId: string) => string;
  REPORT_LIST: (filters: string) => string;
  REPORT_SUMMARY: (projectId: string, reportType: string) => string;
  REPORT_ANALYTICS: (organizationId: string) => string;
  USER_REPORTS: (userId: string) => string;
  GENERATION_QUEUE: () => string;
}

export class ReportCacheService {
  private static memoryCache: NodeCache;
  private static redisClient: Redis | null = null;
  private static cacheLayer: CacheLayer = 'memory';
  
  // Cache configurations for different data types
  private static readonly CACHE_CONFIGS: Record<string, ICacheConfig> = {
    REPORT_DATA: { ttl: 3600, maxKeys: 1000, checkperiod: 600 }, // 1 hour
    REPORT_LIST: { ttl: 900, maxKeys: 500, checkperiod: 120 }, // 15 minutes
    REPORT_SUMMARY: { ttl: 1800, maxKeys: 200, checkperiod: 300 }, // 30 minutes
    REPORT_ANALYTICS: { ttl: 7200, maxKeys: 100, checkperiod: 600 }, // 2 hours
    USER_REPORTS: { ttl: 600, maxKeys: 1000, checkperiod: 120 }, // 10 minutes
    GENERATION_QUEUE: { ttl: 300, maxKeys: 100, checkperiod: 60 } // 5 minutes
  };

  // Cache key generators
  private static readonly KEYS: ICacheKeys = {
    REPORT_DATA: (reportId: string) => `report:data:${reportId}`,
    REPORT_LIST: (filters: string) => `report:list:${filters}`,
    REPORT_SUMMARY: (projectId: string, reportType: string) => `report:summary:${projectId}:${reportType}`,
    REPORT_ANALYTICS: (organizationId: string) => `report:analytics:${organizationId}`,
    USER_REPORTS: (userId: string) => `report:user:${userId}`,
    GENERATION_QUEUE: () => `report:queue:generation`
  };

  /**
   * Initialize caching service
   */
  static async initialize(options: {
    cacheLayer?: CacheLayer;
    redisUrl?: string;
    redisOptions?: any;
  } = {}) {
    try {
      this.cacheLayer = options.cacheLayer || 'memory';

      // Initialize memory cache
      this.memoryCache = new NodeCache({
        stdTTL: 1800, // Default 30 minutes
        checkperiod: 120,
        useClones: false,
        maxKeys: 2000
      });

      // Initialize Redis if specified
      if (this.cacheLayer === 'redis' || this.cacheLayer === 'hybrid') {
        if (options.redisUrl) {
          this.redisClient = new Redis(options.redisUrl, {
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            lazyConnect: true,
            ...options.redisOptions
          });

          // Test Redis connection
          await this.redisClient.ping();
          console.log('Redis cache connected successfully');
        } else {
          console.warn('Redis URL not provided, falling back to memory cache');
          this.cacheLayer = 'memory';
        }
      }

      console.log(`Report cache initialized with ${this.cacheLayer} layer`);
      
    } catch (error) {
      console.error('Failed to initialize cache, falling back to memory:', error);
      this.cacheLayer = 'memory';
    }
  }

  /**
   * Cache report data
   */
  static async cacheReportData(reportId: string, data: any): Promise<void> {
    this.ensureInitialized();
    const key = this.KEYS.REPORT_DATA(reportId);
    const config = this.CACHE_CONFIGS.REPORT_DATA;

    try {
      if (this.cacheLayer === 'redis' && this.redisClient) {
        await this.redisClient.setex(key, config.ttl, JSON.stringify(data));
      }
      
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        this.memoryCache.set(key, data, config.ttl);
      }
    } catch (error) {
      console.error('Failed to cache report data:', error);
    }
  }

  /**
   * Get cached report data
   */
  static async getCachedReportData(reportId: string): Promise<any | null> {
    this.ensureInitialized();
    const key = this.KEYS.REPORT_DATA(reportId);

    try {
      // Try memory cache first (fastest)
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        const memoryData = this.memoryCache.get(key);
        if (memoryData) {
          return memoryData;
        }
      }

      // Try Redis cache
      if (this.cacheLayer === 'redis' || this.cacheLayer === 'hybrid') {
        if (this.redisClient) {
          const redisData = await this.redisClient.get(key);
          if (redisData) {
            const parsedData = JSON.parse(redisData);
            
            // Store in memory cache for faster future access
            if (this.cacheLayer === 'hybrid') {
              this.memoryCache.set(key, parsedData, this.CACHE_CONFIGS.REPORT_DATA.ttl);
            }
            
            return parsedData;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get cached report data:', error);
      return null;
    }
  }

  /**
   * Cache report list with filters
   */
  static async cacheReportList(filters: any, data: any): Promise<void> {
    const filterHash = this.hashFilters(filters);
    const key = this.KEYS.REPORT_LIST(filterHash);
    const config = this.CACHE_CONFIGS.REPORT_LIST;

    try {
      const cacheData = {
        filters,
        data,
        cachedAt: new Date().toISOString()
      };

      if (this.cacheLayer === 'redis' && this.redisClient) {
        await this.redisClient.setex(key, config.ttl, JSON.stringify(cacheData));
      }
      
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        this.memoryCache.set(key, cacheData, config.ttl);
      }
    } catch (error) {
      console.error('Failed to cache report list:', error);
    }
  }

  /**
   * Get cached report list
   */
  static async getCachedReportList(filters: any): Promise<any | null> {
    const filterHash = this.hashFilters(filters);
    const key = this.KEYS.REPORT_LIST(filterHash);

    try {
      // Try memory cache first
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        const memoryData = this.memoryCache.get(key);
        if (memoryData) {
          return (memoryData as any).data;
        }
      }

      // Try Redis cache
      if (this.cacheLayer === 'redis' || this.cacheLayer === 'hybrid') {
        if (this.redisClient) {
          const redisData = await this.redisClient.get(key);
          if (redisData) {
            const parsedData = JSON.parse(redisData);
            
            // Store in memory cache
            if (this.cacheLayer === 'hybrid') {
              this.memoryCache.set(key, parsedData, this.CACHE_CONFIGS.REPORT_LIST.ttl);
            }
            
            return parsedData.data;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get cached report list:', error);
      return null;
    }
  }

  /**
   * Cache report summary statistics
   */
  static async cacheReportSummary(projectId: string, reportType: string, data: any): Promise<void> {
    const key = this.KEYS.REPORT_SUMMARY(projectId, reportType);
    const config = this.CACHE_CONFIGS.REPORT_SUMMARY;

    try {
      if (this.cacheLayer === 'redis' && this.redisClient) {
        await this.redisClient.setex(key, config.ttl, JSON.stringify(data));
      }
      
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        this.memoryCache.set(key, data, config.ttl);
      }
    } catch (error) {
      console.error('Failed to cache report summary:', error);
    }
  }

  /**
   * Get cached report summary
   */
  static async getCachedReportSummary(projectId: string, reportType: string): Promise<any | null> {
    const key = this.KEYS.REPORT_SUMMARY(projectId, reportType);

    try {
      // Try memory cache first
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        const memoryData = this.memoryCache.get(key);
        if (memoryData) {
          return memoryData;
        }
      }

      // Try Redis cache
      if (this.cacheLayer === 'redis' || this.cacheLayer === 'hybrid') {
        if (this.redisClient) {
          const redisData = await this.redisClient.get(key);
          if (redisData) {
            const parsedData = JSON.parse(redisData);
            
            // Store in memory cache
            if (this.cacheLayer === 'hybrid') {
              this.memoryCache.set(key, parsedData, this.CACHE_CONFIGS.REPORT_SUMMARY.ttl);
            }
            
            return parsedData;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get cached report summary:', error);
      return null;
    }
  }

  /**
   * Invalidate cache for specific report
   */
  static async invalidateReport(reportId: string): Promise<void> {
    try {
      // Invalidate specific report data
      const reportKey = this.KEYS.REPORT_DATA(reportId);
      
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        this.memoryCache.del(reportKey);
      }
      
      if (this.cacheLayer === 'redis' && this.redisClient) {
        await this.redisClient.del(reportKey);
      }

      // Invalidate related caches (report lists, summaries)
      await this.invalidateRelatedCaches(reportId);
      
    } catch (error) {
      console.error('Failed to invalidate report cache:', error);
    }
  }

  /**
   * Invalidate all caches for a project
   */
  static async invalidateProjectCaches(projectId: string): Promise<void> {
    try {
      // Get all cache keys and invalidate project-related ones
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        const keys = this.memoryCache.keys();
        keys.forEach(key => {
          if (key.includes(`project:${projectId}`) || key.includes(`summary:${projectId}`)) {
            this.memoryCache.del(key);
          }
        });
      }

      if (this.cacheLayer === 'redis' && this.redisClient) {
        const keys = await this.redisClient.keys(`*project:${projectId}*`);
        const summaryKeys = await this.redisClient.keys(`*summary:${projectId}*`);
        const allKeys = [...keys, ...summaryKeys];
        
        if (allKeys.length > 0) {
          await this.redisClient.del(...allKeys);
        }
      }

      // Also invalidate report lists that might contain this project's reports
      await this.invalidateReportLists();
      
    } catch (error) {
      console.error('Failed to invalidate project caches:', error);
    }
  }

  /**
   * Clear all report-related caches
   */
  static async clearAllCaches(): Promise<void> {
    try {
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        this.memoryCache.flushAll();
      }
      
      if (this.cacheLayer === 'redis' && this.redisClient) {
        await this.redisClient.flushdb();
      }
      
      console.log('All report caches cleared');
    } catch (error) {
      console.error('Failed to clear all caches:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<any> {
    try {
      const stats = {
        layer: this.cacheLayer,
        memory: {
          keys: 0,
          hits: 0,
          misses: 0,
          ksize: 0,
          vsize: 0
        },
        redis: {
          connected: false,
          memory: 0,
          keys: 0
        }
      };

      // Memory cache stats
      if (this.memoryCache) {
        const memStats = this.memoryCache.getStats();
        stats.memory = {
          keys: memStats.keys,
          hits: memStats.hits,
          misses: memStats.misses,
          ksize: memStats.ksize,
          vsize: memStats.vsize
        };
      }

      // Redis cache stats
      if (this.redisClient) {
        try {
          const info = await this.redisClient.info('memory');
          const keyspace = await this.redisClient.info('keyspace');
          
          stats.redis.connected = true;
          stats.redis.memory = this.parseRedisMemory(info);
          stats.redis.keys = this.parseRedisKeys(keyspace);
        } catch (error) {
          stats.redis.connected = false;
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }

  // Private helper methods
  private static hashFilters(filters: any): string {
    const crypto = require('crypto');
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    return crypto.createHash('md5').update(filterString).digest('hex');
  }

  private static async invalidateRelatedCaches(reportId: string): Promise<void> {
    // This would invalidate report lists and summaries that might include this report
    // Implementation depends on how you want to handle cache invalidation strategy
    await this.invalidateReportLists();
  }

  private static async invalidateReportLists(): Promise<void> {
    try {
      if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
        const keys = this.memoryCache.keys();
        keys.forEach(key => {
          if (key.startsWith('report:list:')) {
            this.memoryCache.del(key);
          }
        });
      }

      if (this.cacheLayer === 'redis' && this.redisClient) {
        const keys = await this.redisClient.keys('report:list:*');
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      }
    } catch (error) {
      console.error('Failed to invalidate report lists:', error);
    }
  }

  private static parseRedisMemory(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private static parseRedisKeys(keyspace: string): number {
    const match = keyspace.match(/keys=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private static ensureInitialized() {
    if (!this.memoryCache) {
      this.memoryCache = new NodeCache({
        stdTTL: 1800, // Default 30 minutes
        checkperiod: 120,
        useClones: false,
        maxKeys: 2000
      });
      console.log('Memory cache auto-initialized');
    }
  }

  /**
   * Cleanup method for graceful shutdown
   */
  static async cleanup(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      
      if (this.memoryCache) {
        this.memoryCache.close();
      }
      
      console.log('Report cache service cleaned up');
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }
}

export default ReportCacheService;