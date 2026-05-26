// utils/database/reportOptimization.ts
import mongoose from "mongoose";
import Report from "../../models/report.model";

export class ReportDatabaseOptimization {
  
  /**
   * Create optimized indexes for report collections
   */
  static async createOptimizedIndexes(): Promise<void> {
    try {
      console.log('Creating optimized indexes for reports...');
      
      // Core report indexes
      await Report.collection.createIndexes([
        // Primary lookup patterns
        { 
          key: { organization: 1, reportType: 1, status: 1, createdAt: -1 },
          name: 'org_type_status_date_idx',
          background: true
        },
        { 
          key: { project: 1, reportType: 1, createdAt: -1 },
          name: 'project_type_date_idx',
          background: true
        },
        { 
          key: { projectSite: 1, reportType: 1, createdAt: -1 },
          name: 'site_type_date_idx',
          background: true,
          sparse: true
        },
        
        // User-centric indexes
        { 
          key: { creator: 1, status: 1, createdAt: -1 },
          name: 'creator_status_date_idx',
          background: true
        },
        { 
          key: { approvedBy: 1, approvedAt: -1 },
          name: 'approver_date_idx',
          background: true,
          sparse: true
        },
        
        // Status and workflow indexes
        { 
          key: { status: 1, updatedAt: -1 },
          name: 'status_updated_idx',
          background: true
        },
        { 
          key: { visibility: 1, organization: 1, createdAt: -1 },
          name: 'visibility_org_date_idx',
          background: true
        },
        
        // Metadata and search indexes
        { 
          key: { 'metadata.tags': 1, reportType: 1 },
          name: 'tags_type_idx',
          background: true,
          sparse: true
        },
        { 
          key: { entityType: 1, entityId: 1, reportType: 1 },
          name: 'entity_type_idx',
          background: true
        },
        
        // Version and history indexes
        { 
          key: { entityId: 1, reportType: 1, version: -1 },
          name: 'entity_type_version_idx',
          background: true
        },
        { 
          key: { archived: 1, archivedAt: -1 },
          name: 'archived_date_idx',
          background: true,
          sparse: true
        },
        
        // Performance optimization indexes
        { 
          key: { 'metadata.summary.totalItems': 1, reportType: 1 },
          name: 'size_type_idx',
          background: true,
          sparse: true
        },
        { 
          key: { 'metadata.summary.completionPercentage': 1, status: 1 },
          name: 'completion_status_idx',
          background: true,
          sparse: true
        }
      ]);

      // Text search index for content search
      await Report.collection.createIndex(
        {
          title: 'text',
          description: 'text',
          'metadata.tags': 'text'
        },
        {
          name: 'report_text_search_idx',
          weights: {
            title: 10,
            description: 5,
            'metadata.tags': 3
          },
          background: true
        }
      );

      console.log('Report indexes created successfully');
      
    } catch (error) {
      console.error('Failed to create report indexes:', error);
      throw error;
    }
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  static async analyzeQueryPerformance(): Promise<{
    slowQueries: Array<{
      query: any;
      executionTimeMs: number;
      suggestions: string[];
    }>;
    indexUsage: Array<{
      indexName: string;
      usage: number;
      efficiency: number;
    }>;
    recommendations: string[];
  }> {
    try {
      // Enable profiling (be careful in production)
      await mongoose.connection.db?.admin().command({ profile: 2, slowms: 100 });
      
      // Wait a bit to collect some data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get profiling data
      const profilingData = await mongoose.connection.db!
        .collection('system.profile')
        .find({ ns: `${mongoose.connection.name}.reports` })
        .sort({ ts: -1 })
        .limit(50)
        .toArray();

      // Analyze slow queries
      const slowQueries = profilingData
        .filter(profile => profile.millis > 100)
        .map(profile => ({
          query: profile.command,
          executionTimeMs: profile.millis,
          suggestions: this.generateOptimizationSuggestions(profile)
        }));

      // Get index usage statistics
      const indexStats = await (Report.collection as any).indexStats().toArray();
      const indexUsage = indexStats.map((stat: any) => ({
        indexName: stat.name,
        usage: stat.accesses?.ops || 0,
        efficiency: this.calculateIndexEfficiency(stat)
      }));

      // Generate recommendations
      const recommendations = this.generateRecommendations(slowQueries, indexUsage);

      // Disable profiling
      await mongoose.connection.db?.admin().command({ profile: 0 });

      return {
        slowQueries,
        indexUsage,
        recommendations
      };

    } catch (error) {
      console.error('Failed to analyze query performance:', error);
      return {
        slowQueries: [],
        indexUsage: [],
        recommendations: ['Performance analysis failed - check database permissions']
      };
    }
  }

  /**
   * Optimize database based on usage patterns
   */
  static async optimizeBasedOnUsage(): Promise<{
    optimizationsApplied: string[];
    performanceGains: any;
  }> {
    try {
      const optimizations: string[] = [];
      
      // 1. Analyze collection statistics
      const collStats = await (Report.collection as any).stats();
      
      // 2. Check for unused indexes
      const indexUsage = await this.getIndexUsageStats();
      const unusedIndexes = indexUsage.filter(idx => idx.usage === 0 && !idx.indexName.includes('_id_'));
      
      // 3. Drop unused indexes (be careful!)
      for (const unused of unusedIndexes) {
        if (unused.indexName !== '_id_') {
          try {
            await Report.collection.dropIndex(unused.indexName);
            optimizations.push(`Dropped unused index: ${unused.indexName}`);
          } catch (error) {
            console.warn(`Could not drop index ${unused.indexName}:`, error);
          }
        }
      }
      
      // 4. Analyze document size patterns
      const avgDocSize = collStats.avgObjSize;
      if (avgDocSize > 1024 * 1024) { // 1MB
        optimizations.push('Consider archiving large report data to separate collection');
      }
      
      // 5. Check for fragmentation
      if (collStats.storageSize > collStats.size * 2) {
        optimizations.push('Collection may benefit from compaction');
      }
      
      // 6. Suggest read preferences for heavy read workloads
      const readWriteRatio = await this.estimateReadWriteRatio();
      if (readWriteRatio.readPercentage > 80) {
        optimizations.push('Consider read preference optimization for heavy read workload');
      }

      return {
        optimizationsApplied: optimizations,
        performanceGains: {
          indexesDropped: unusedIndexes.length,
          estimatedSpaceSaved: unusedIndexes.length * 100, // Rough estimate in KB
          collectionStats: {
            totalSize: collStats.size,
            avgDocSize: collStats.avgObjSize,
            totalIndexSize: collStats.totalIndexSize
          }
        }
      };

    } catch (error) {
      console.error('Failed to optimize database:', error);
      return {
        optimizationsApplied: [],
        performanceGains: {}
      };
    }
  }

  /**
   * Setup database monitoring for reports
   */
  static async setupMonitoring(): Promise<void> {
    try {
      // Create monitoring collection if it doesn't exist
      const monitoringCollection = mongoose.connection.db!.collection('report_monitoring');
      
      // Set up periodic monitoring (every hour)
      setInterval(async () => {
        try {
          const stats = await this.collectPerformanceStats();
          await monitoringCollection.insertOne({
            timestamp: new Date(),
            ...stats
          });
          
          // Keep only last 30 days of monitoring data
          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          await monitoringCollection.deleteMany({ timestamp: { $lt: cutoff } });
          
        } catch (error) {
          console.error('Monitoring collection failed:', error);
        }
      }, 60 * 60 * 1000); // Every hour

      console.log('Database monitoring setup complete');
      
    } catch (error) {
      console.error('Failed to setup database monitoring:', error);
    }
  }

  /**
   * Get database health metrics
   */
  static async getHealthMetrics(): Promise<{
    connectionHealth: 'excellent' | 'good' | 'fair' | 'poor';
    performanceScore: number;
    indexEfficiency: number;
    queryLatency: {
      average: number;
      p95: number;
      p99: number;
    };
    recommendations: string[];
  }> {
    try {
      // Collect various health metrics
      const [collStats, serverStatus, indexUsage] = await Promise.all([
        (Report.collection as any).stats(),
        mongoose.connection.db?.admin().serverStatus(),
        this.getIndexUsageStats()
      ]);

      // Calculate performance score (0-100)
      let performanceScore = 100;
      
      // Penalize for high average document size
      if (collStats.avgObjSize > 512 * 1024) performanceScore -= 20;
      if (collStats.avgObjSize > 1024 * 1024) performanceScore -= 30;
      
      // Penalize for storage fragmentation
      const fragmentationRatio = collStats.storageSize / collStats.size;
      if (fragmentationRatio > 2) performanceScore -= 15;
      if (fragmentationRatio > 3) performanceScore -= 25;
      
      // Calculate index efficiency
      const totalIndexUsage = indexUsage.reduce((sum, idx) => sum + idx.usage, 0);
      const usedIndexes = indexUsage.filter(idx => idx.usage > 0).length;
      const indexEfficiency = usedIndexes / indexUsage.length * 100;
      
      if (indexEfficiency < 50) performanceScore -= 20;
      if (indexEfficiency < 30) performanceScore -= 35;

      // Determine connection health
      let connectionHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
      if (performanceScore < 80) connectionHealth = 'good';
      if (performanceScore < 60) connectionHealth = 'fair';
      if (performanceScore < 40) connectionHealth = 'poor';

      // Generate recommendations
      const recommendations: string[] = [];
      if (collStats.avgObjSize > 1024 * 1024) {
        recommendations.push('Consider archiving large reportData to separate collection');
      }
      if (fragmentationRatio > 2.5) {
        recommendations.push('Collection fragmentation detected - consider compaction');
      }
      if (indexEfficiency < 60) {
        recommendations.push('Remove unused indexes to improve write performance');
      }
      if (indexUsage.length > 20) {
        recommendations.push('High number of indexes may impact write performance');
      }

      return {
        connectionHealth,
        performanceScore: Math.max(0, performanceScore),
        indexEfficiency,
        queryLatency: {
          average: 0, // Would need query profiling data
          p95: 0,
          p99: 0
        },
        recommendations
      };

    } catch (error) {
      console.error('Failed to get health metrics:', error);
      return {
        connectionHealth: 'poor',
        performanceScore: 0,
        indexEfficiency: 0,
        queryLatency: { average: 0, p95: 0, p99: 0 },
        recommendations: ['Health metrics collection failed']
      };
    }
  }

  // Private helper methods
  private static generateOptimizationSuggestions(profile: any): string[] {
    const suggestions: string[] = [];
    
    if (profile.planSummary?.includes('COLLSCAN')) {
      suggestions.push('Query performed collection scan - add appropriate index');
    }
    
    if (profile.keysExamined > profile.docsExamined * 10) {
      suggestions.push('Index selectivity is low - consider compound index');
    }
    
    if (profile.hasSortStage) {
      suggestions.push('Query requires in-memory sort - add sort field to index');
    }
    
    return suggestions;
  }

  private static calculateIndexEfficiency(indexStat: any): number {
    // Simple efficiency calculation based on usage vs size
    const usage = indexStat.accesses?.ops || 0;
    const size = indexStat.size || 1;
    return Math.min(100, (usage / size) * 1000); // Arbitrary scaling
  }

  private static generateRecommendations(slowQueries: any[], indexUsage: any[]): string[] {
    const recommendations: string[] = [];
    
    if (slowQueries.length > 0) {
      recommendations.push(`Found ${slowQueries.length} slow queries - review query patterns`);
    }
    
    const unusedIndexes = indexUsage.filter(idx => idx.usage === 0).length;
    if (unusedIndexes > 0) {
      recommendations.push(`${unusedIndexes} unused indexes detected - consider removal`);
    }
    
    const lowEfficiencyIndexes = indexUsage.filter(idx => idx.efficiency < 10).length;
    if (lowEfficiencyIndexes > 0) {
      recommendations.push(`${lowEfficiencyIndexes} low-efficiency indexes - review necessity`);
    }
    
    return recommendations;
  }

  private static async getIndexUsageStats(): Promise<Array<{
    indexName: string;
    usage: number;
    efficiency: number;
  }>> {
    try {
      const indexStats = await (Report.collection as any).indexStats().toArray();
      return indexStats.map((stat: any) => ({
        indexName: stat.name,
        usage: stat.accesses?.ops || 0,
        efficiency: this.calculateIndexEfficiency(stat)
      }));
    } catch (error) {
      return [];
    }
  }

  private static async estimateReadWriteRatio(): Promise<{
    readPercentage: number;
    writePercentage: number;
  }> {
    // This is a simplified estimation - in practice you'd use MongoDB metrics
    return {
      readPercentage: 75, // Assume reports are read more than written
      writePercentage: 25
    };
  }

  private static async collectPerformanceStats(): Promise<any> {
    try {
      const collStats = await (Report.collection as any).stats();
      return {
        totalDocuments: collStats.count,
        avgDocumentSize: collStats.avgObjSize,
        totalSize: collStats.size,
        indexSize: collStats.totalIndexSize,
        storageSize: collStats.storageSize
      };
    } catch (error) {
      return {};
    }
  }
}

export default ReportDatabaseOptimization;