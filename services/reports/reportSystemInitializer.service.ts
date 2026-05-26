// services/reports/reportSystemInitializer.service.ts
import ReportCacheService from "./reportCache.service";
import BackgroundReportGenerationService from "./backgroundGeneration.service";
import ReportSearchService from "./reportSearch.service";
import ReportDatabaseOptimization from "../../utils/database/reportOptimization";
import ReportSchedulerService from "./reportScheduler.service";

interface IInitializationConfig {
  cache: {
    enabled: boolean;
    layer: 'memory' | 'redis' | 'hybrid';
    redisUrl?: string;
    redisOptions?: any;
  };
  backgroundGeneration: {
    enabled: boolean;
    concurrency?: number;
  };
  database: {
    optimizeOnStartup: boolean;
    createIndexes: boolean;
    enableMonitoring: boolean;
  };
  scheduler: {
    enabled: boolean;
    intervalMinutes?: number;
  };
}

export class ReportSystemInitializer {
  private static initialized = false;
  private static config: IInitializationConfig = {
    cache: {
      enabled: true,
      layer: 'memory'
    },
    backgroundGeneration: {
      enabled: true,
      concurrency: 5
    },
    database: {
      optimizeOnStartup: true,
      createIndexes: true,
      enableMonitoring: false
    },
    scheduler: {
      enabled: true,
      intervalMinutes: 60
    }
  };

  /**
   * Initialize the complete report system
   */
  static async initialize(customConfig?: Partial<IInitializationConfig>): Promise<{
    success: boolean;
    initializedComponents: string[];
    errors: Array<{ component: string; error: string }>;
  }> {
    if (this.initialized) {
      console.log('Report system already initialized');
      return {
        success: true,
        initializedComponents: [],
        errors: []
      };
    }

    // Merge custom config
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    const initializedComponents: string[] = [];
    const errors: Array<{ component: string; error: string }> = [];

    console.log('Initializing Youth Impact Report System...');

    // 1. Initialize caching system
    if (this.config.cache.enabled) {
      try {
        await ReportCacheService.initialize({
          cacheLayer: this.config.cache.layer,
          redisUrl: this.config.cache.redisUrl,
          redisOptions: this.config.cache.redisOptions
        });
        initializedComponents.push('Cache Service');
        console.log('✅ Cache service initialized');
      } catch (error) {
        errors.push({ 
          component: 'Cache Service', 
          error: (error as Error).message 
        });
        console.error('❌ Cache service initialization failed:', error);
      }
    }

    // 2. Initialize background generation
    if (this.config.backgroundGeneration.enabled) {
      try {
        await BackgroundReportGenerationService.initialize();
        initializedComponents.push('Background Generation Service');
        console.log('✅ Background generation service initialized');
      } catch (error) {
        errors.push({ 
          component: 'Background Generation Service', 
          error: (error as Error).message 
        });
        console.error('❌ Background generation service initialization failed:', error);
      }
    }

    // 3. Setup database optimization
    if (this.config.database.createIndexes) {
      try {
        await ReportDatabaseOptimization.createOptimizedIndexes();
        initializedComponents.push('Database Indexes');
        console.log('✅ Database indexes created');
      } catch (error) {
        errors.push({ 
          component: 'Database Indexes', 
          error: (error as Error).message 
        });
        console.error('❌ Database index creation failed:', error);
      }
    }

    // 4. Setup search indexes
    try {
      await ReportSearchService.buildSearchIndex();
      initializedComponents.push('Search Indexes');
      console.log('✅ Search indexes built');
    } catch (error) {
      errors.push({ 
        component: 'Search Indexes', 
        error: (error as Error).message 
      });
      console.error('❌ Search index creation failed:', error);
    }

    // 5. Initialize scheduler
    if (this.config.scheduler.enabled) {
      try {
        // Setup periodic scheduler execution
        this.setupScheduler();
        initializedComponents.push('Report Scheduler');
        console.log('✅ Report scheduler initialized');
      } catch (error) {
        errors.push({ 
          component: 'Report Scheduler', 
          error: (error as Error).message 
        });
        console.error('❌ Report scheduler initialization failed:', error);
      }
    }

    // 6. Setup database monitoring
    if (this.config.database.enableMonitoring) {
      try {
        await ReportDatabaseOptimization.setupMonitoring();
        initializedComponents.push('Database Monitoring');
        console.log('✅ Database monitoring initialized');
      } catch (error) {
        errors.push({ 
          component: 'Database Monitoring', 
          error: (error as Error).message 
        });
        console.error('❌ Database monitoring initialization failed:', error);
      }
    }

    // 7. Run startup optimization
    if (this.config.database.optimizeOnStartup) {
      try {
        const optimization = await ReportDatabaseOptimization.optimizeBasedOnUsage();
        if (optimization.optimizationsApplied.length > 0) {
          console.log('✅ Database optimizations applied:', optimization.optimizationsApplied);
          initializedComponents.push('Database Optimization');
        }
      } catch (error) {
        errors.push({ 
          component: 'Database Optimization', 
          error: (error as Error).message 
        });
        console.error('❌ Database optimization failed:', error);
      }
    }

    this.initialized = true;

    // Log final initialization status
    const success = errors.length === 0;
    console.log(`\n🎉 Youth Impact Report System Initialization ${success ? 'COMPLETE' : 'PARTIAL'}`);
    console.log(`✅ Initialized: ${initializedComponents.join(', ')}`);
    
    if (errors.length > 0) {
      console.log(`❌ Failed: ${errors.map(e => e.component).join(', ')}`);
    }

    return {
      success,
      initializedComponents,
      errors
    };
  }

  /**
   * Get system health status
   */
  static async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      details: any;
    }>;
    recommendations: string[];
  }> {
    const components: Record<string, any> = {};
    const recommendations: string[] = [];

    // Check cache health
    try {
      const cacheStats = await ReportCacheService.getCacheStats();
      components.cache = {
        status: cacheStats ? 'healthy' : 'unhealthy',
        details: cacheStats
      };
      
      if (cacheStats?.memory?.hits < cacheStats?.memory?.misses) {
        recommendations.push('Cache hit rate is low - review caching strategy');
      }
    } catch (error) {
      components.cache = {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }

    // Check background generation health
    try {
      const queueStats = await BackgroundReportGenerationService.getQueueStats();
      const hasStuckJobs = queueStats.report.failed > 10 || queueStats.report.delayed > 5;
      
      components.backgroundGeneration = {
        status: hasStuckJobs ? 'degraded' : 'healthy',
        details: queueStats
      };
      
      if (hasStuckJobs) {
        recommendations.push('High number of failed/delayed jobs - review queue health');
      }
    } catch (error) {
      components.backgroundGeneration = {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }

    // Check database health
    try {
      const dbHealth = await ReportDatabaseOptimization.getHealthMetrics();
      components.database = {
        status: dbHealth.connectionHealth === 'poor' ? 'unhealthy' : 
                dbHealth.connectionHealth === 'fair' ? 'degraded' : 'healthy',
        details: dbHealth
      };
      
      recommendations.push(...dbHealth.recommendations);
    } catch (error) {
      components.database = {
        status: 'unhealthy',
        details: { error: (error as Error).message }
      };
    }

    // Determine overall health
    const statuses = Object.values(components).map(c => c.status);
    const unhealthyCount = statuses.filter(s => s === 'unhealthy').length;
    const degradedCount = statuses.filter(s => s === 'degraded').length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      components,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    };
  }

  /**
   * Graceful shutdown of all report services
   */
  static async shutdown(): Promise<void> {
    console.log('Shutting down Youth Impact Report System...');

    const shutdownTasks = [
      { name: 'Cache Service', task: () => ReportCacheService.cleanup() },
      { name: 'Background Generation', task: () => BackgroundReportGenerationService.shutdown() }
    ];

    for (const { name, task } of shutdownTasks) {
      try {
        await task();
        console.log(`✅ ${name} shut down gracefully`);
      } catch (error) {
        console.error(`❌ ${name} shutdown failed:`, error);
      }
    }

    this.initialized = false;
    console.log('🏁 Report system shutdown complete');
  }

  /**
   * Restart system components
   */
  static async restart(components?: string[]): Promise<void> {
    console.log('Restarting report system components...');
    
    if (!components || components.includes('cache')) {
      await ReportCacheService.clearAllCaches();
      console.log('✅ Cache cleared and restarted');
    }

    if (!components || components.includes('indexes')) {
      await ReportDatabaseOptimization.createOptimizedIndexes();
      await ReportSearchService.buildSearchIndex();
      console.log('✅ Indexes rebuilt');
    }

    console.log('🔄 Report system restart complete');
  }

  /**
   * Get system metrics for monitoring
   */
  static async getSystemMetrics(): Promise<{
    uptime: number;
    performance: {
      cacheHitRate: number;
      averageQueryTime: number;
      queueHealthScore: number;
    };
    usage: {
      totalReports: number;
      reportsGeneratedToday: number;
      activeJobs: number;
      cacheSize: number;
    };
    health: {
      overall: string;
      components: string[];
    };
  }> {
    try {
      const [cacheStats, queueStats, healthStatus] = await Promise.all([
        ReportCacheService.getCacheStats(),
        BackgroundReportGenerationService.getQueueStats(),
        this.getSystemHealth()
      ]);

      // Calculate uptime (simplified - would track actual start time in production)
      const uptime = process.uptime();

      // Calculate cache hit rate
      const cacheHitRate = cacheStats?.memory?.hits && cacheStats?.memory?.misses
        ? (cacheStats.memory.hits / (cacheStats.memory.hits + cacheStats.memory.misses)) * 100
        : 0;

      // Calculate queue health score
      const totalJobs = queueStats.report.waiting + queueStats.report.active + queueStats.report.completed + queueStats.report.failed;
      const queueHealthScore = totalJobs > 0
        ? ((queueStats.report.completed / totalJobs) * 100)
        : 100;

      // Get report statistics
      const Report = (await import('../../models/report.model')).default;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [totalReports, reportsToday] = await Promise.all([
        Report.countDocuments({ archived: { $ne: true } }),
        Report.countDocuments({ 
          archived: { $ne: true },
          createdAt: { $gte: todayStart }
        })
      ]);

      return {
        uptime,
        performance: {
          cacheHitRate: Math.round(cacheHitRate),
          averageQueryTime: 0, // Would need query profiling
          queueHealthScore: Math.round(queueHealthScore)
        },
        usage: {
          totalReports,
          reportsGeneratedToday: reportsToday,
          activeJobs: queueStats.report.active + queueStats.batch.active + queueStats.regeneration.active,
          cacheSize: cacheStats?.memory?.keys || 0
        },
        health: {
          overall: healthStatus.overall,
          components: Object.keys(healthStatus.components)
        }
      };

    } catch (error) {
      console.error('Failed to get system metrics:', error);
      return {
        uptime: 0,
        performance: { cacheHitRate: 0, averageQueryTime: 0, queueHealthScore: 0 },
        usage: { totalReports: 0, reportsGeneratedToday: 0, activeJobs: 0, cacheSize: 0 },
        health: { overall: 'unhealthy', components: [] }
      };
    }
  }

  /**
   * Setup periodic scheduler for system maintenance
   */
  private static setupScheduler(): void {
    const intervalMs = (this.config.scheduler.intervalMinutes || 60) * 60 * 1000;

    setInterval(async () => {
      try {
        // Run scheduler service
        await ReportSchedulerService.runScheduler();

        // Periodic cache cleanup
        const cacheStats = await ReportCacheService.getCacheStats();
        if (cacheStats?.memory?.keys > 5000) {
          console.log('Cache size limit reached, clearing old entries...');
          // Could implement LRU eviction here
        }

        // Periodic health check
        const health = await this.getSystemHealth();
        if (health.overall === 'unhealthy') {
          console.warn('Report system health is unhealthy:', health.recommendations);
        }

      } catch (error) {
        console.error('Scheduler execution failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Update system configuration
   */
  static updateConfig(newConfig: Partial<IInitializationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Report system configuration updated');
  }

  /**
   * Get current system configuration
   */
  static getConfig(): IInitializationConfig {
    return { ...this.config };
  }

  /**
   * Check if system is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Run system diagnostics
   */
  static async runDiagnostics(): Promise<{
    systemInfo: any;
    performanceTest: any;
    configurationCheck: any;
    recommendations: string[];
  }> {
    const diagnostics = {
      systemInfo: {},
      performanceTest: {},
      configurationCheck: {},
      recommendations: [] as string[]
    };

    try {
      // System information
      diagnostics.systemInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        initialized: this.initialized
      };

      // Performance test
      const startTime = Date.now();
      await ReportCacheService.getCacheStats();
      diagnostics.performanceTest = {
        cacheResponseTime: Date.now() - startTime,
        timestamp: new Date()
      };

      // Configuration check
      diagnostics.configurationCheck = {
        cacheEnabled: this.config.cache.enabled,
        backgroundGenerationEnabled: this.config.backgroundGeneration.enabled,
        databaseOptimizationEnabled: this.config.database.optimizeOnStartup,
        schedulerEnabled: this.config.scheduler.enabled
      };

      // Generate recommendations
      if (!this.config.cache.enabled) {
        diagnostics.recommendations.push('Enable caching for better performance');
      }
      if (!this.config.backgroundGeneration.enabled) {
        diagnostics.recommendations.push('Enable background generation for large reports');
      }
      const perfTest = diagnostics.performanceTest as any;
      if (perfTest.cacheResponseTime && perfTest.cacheResponseTime > 100) {
        diagnostics.recommendations.push('Cache response time is high - check Redis connection');
      }

    } catch (error) {
      diagnostics.recommendations.push(`Diagnostics failed: ${(error as Error).message}`);
    }

    return diagnostics;
  }
}

export default ReportSystemInitializer;