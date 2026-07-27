"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportDatabaseOptimization = void 0;
// utils/database/reportOptimization.ts
const mongoose_1 = __importDefault(require("mongoose"));
const report_model_1 = __importDefault(require("../../models/report.model"));
class ReportDatabaseOptimization {
    /**
     * Create optimized indexes for report collections
     */
    static createOptimizedIndexes() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('Creating optimized indexes for reports...');
                // Core report indexes
                yield report_model_1.default.collection.createIndexes([
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
                yield report_model_1.default.collection.createIndex({
                    title: 'text',
                    description: 'text',
                    'metadata.tags': 'text'
                }, {
                    name: 'report_text_search_idx',
                    weights: {
                        title: 10,
                        description: 5,
                        'metadata.tags': 3
                    },
                    background: true
                });
                console.log('Report indexes created successfully');
            }
            catch (error) {
                console.error('Failed to create report indexes:', error);
                throw error;
            }
        });
    }
    /**
     * Analyze query performance and suggest optimizations
     */
    static analyzeQueryPerformance() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Enable profiling (be careful in production)
                yield ((_a = mongoose_1.default.connection.db) === null || _a === void 0 ? void 0 : _a.admin().command({ profile: 2, slowms: 100 }));
                // Wait a bit to collect some data
                yield new Promise(resolve => setTimeout(resolve, 1000));
                // Get profiling data
                const profilingData = yield mongoose_1.default.connection.db
                    .collection('system.profile')
                    .find({ ns: `${mongoose_1.default.connection.name}.reports` })
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
                const indexStats = yield report_model_1.default.collection.indexStats().toArray();
                const indexUsage = indexStats.map((stat) => {
                    var _a;
                    return ({
                        indexName: stat.name,
                        usage: ((_a = stat.accesses) === null || _a === void 0 ? void 0 : _a.ops) || 0,
                        efficiency: this.calculateIndexEfficiency(stat)
                    });
                });
                // Generate recommendations
                const recommendations = this.generateRecommendations(slowQueries, indexUsage);
                // Disable profiling
                yield ((_b = mongoose_1.default.connection.db) === null || _b === void 0 ? void 0 : _b.admin().command({ profile: 0 }));
                return {
                    slowQueries,
                    indexUsage,
                    recommendations
                };
            }
            catch (error) {
                console.error('Failed to analyze query performance:', error);
                return {
                    slowQueries: [],
                    indexUsage: [],
                    recommendations: ['Performance analysis failed - check database permissions']
                };
            }
        });
    }
    /**
     * Optimize database based on usage patterns
     */
    static optimizeBasedOnUsage() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const optimizations = [];
                // 1. Analyze collection statistics
                const collStats = yield report_model_1.default.collection.stats();
                // 2. Check for unused indexes
                const indexUsage = yield this.getIndexUsageStats();
                const unusedIndexes = indexUsage.filter(idx => idx.usage === 0 && !idx.indexName.includes('_id_'));
                // 3. Drop unused indexes (be careful!)
                for (const unused of unusedIndexes) {
                    if (unused.indexName !== '_id_') {
                        try {
                            yield report_model_1.default.collection.dropIndex(unused.indexName);
                            optimizations.push(`Dropped unused index: ${unused.indexName}`);
                        }
                        catch (error) {
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
                const readWriteRatio = yield this.estimateReadWriteRatio();
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
            }
            catch (error) {
                console.error('Failed to optimize database:', error);
                return {
                    optimizationsApplied: [],
                    performanceGains: {}
                };
            }
        });
    }
    /**
     * Setup database monitoring for reports
     */
    static setupMonitoring() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create monitoring collection if it doesn't exist
                const monitoringCollection = mongoose_1.default.connection.db.collection('report_monitoring');
                // Set up periodic monitoring (every hour)
                setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const stats = yield this.collectPerformanceStats();
                        yield monitoringCollection.insertOne(Object.assign({ timestamp: new Date() }, stats));
                        // Keep only last 30 days of monitoring data
                        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                        yield monitoringCollection.deleteMany({ timestamp: { $lt: cutoff } });
                    }
                    catch (error) {
                        console.error('Monitoring collection failed:', error);
                    }
                }), 60 * 60 * 1000); // Every hour
                console.log('Database monitoring setup complete');
            }
            catch (error) {
                console.error('Failed to setup database monitoring:', error);
            }
        });
    }
    /**
     * Get database health metrics
     */
    static getHealthMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Collect various health metrics
                const [collStats, serverStatus, indexUsage] = yield Promise.all([
                    report_model_1.default.collection.stats(),
                    (_a = mongoose_1.default.connection.db) === null || _a === void 0 ? void 0 : _a.admin().serverStatus(),
                    this.getIndexUsageStats()
                ]);
                // Calculate performance score (0-100)
                let performanceScore = 100;
                // Penalize for high average document size
                if (collStats.avgObjSize > 512 * 1024)
                    performanceScore -= 20;
                if (collStats.avgObjSize > 1024 * 1024)
                    performanceScore -= 30;
                // Penalize for storage fragmentation
                const fragmentationRatio = collStats.storageSize / collStats.size;
                if (fragmentationRatio > 2)
                    performanceScore -= 15;
                if (fragmentationRatio > 3)
                    performanceScore -= 25;
                // Calculate index efficiency
                const totalIndexUsage = indexUsage.reduce((sum, idx) => sum + idx.usage, 0);
                const usedIndexes = indexUsage.filter(idx => idx.usage > 0).length;
                const indexEfficiency = usedIndexes / indexUsage.length * 100;
                if (indexEfficiency < 50)
                    performanceScore -= 20;
                if (indexEfficiency < 30)
                    performanceScore -= 35;
                // Determine connection health
                let connectionHealth = 'excellent';
                if (performanceScore < 80)
                    connectionHealth = 'good';
                if (performanceScore < 60)
                    connectionHealth = 'fair';
                if (performanceScore < 40)
                    connectionHealth = 'poor';
                // Generate recommendations
                const recommendations = [];
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
            }
            catch (error) {
                console.error('Failed to get health metrics:', error);
                return {
                    connectionHealth: 'poor',
                    performanceScore: 0,
                    indexEfficiency: 0,
                    queryLatency: { average: 0, p95: 0, p99: 0 },
                    recommendations: ['Health metrics collection failed']
                };
            }
        });
    }
    // Private helper methods
    static generateOptimizationSuggestions(profile) {
        var _a;
        const suggestions = [];
        if ((_a = profile.planSummary) === null || _a === void 0 ? void 0 : _a.includes('COLLSCAN')) {
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
    static calculateIndexEfficiency(indexStat) {
        var _a;
        // Simple efficiency calculation based on usage vs size
        const usage = ((_a = indexStat.accesses) === null || _a === void 0 ? void 0 : _a.ops) || 0;
        const size = indexStat.size || 1;
        return Math.min(100, (usage / size) * 1000); // Arbitrary scaling
    }
    static generateRecommendations(slowQueries, indexUsage) {
        const recommendations = [];
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
    static getIndexUsageStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const indexStats = yield report_model_1.default.collection.indexStats().toArray();
                return indexStats.map((stat) => {
                    var _a;
                    return ({
                        indexName: stat.name,
                        usage: ((_a = stat.accesses) === null || _a === void 0 ? void 0 : _a.ops) || 0,
                        efficiency: this.calculateIndexEfficiency(stat)
                    });
                });
            }
            catch (error) {
                return [];
            }
        });
    }
    static estimateReadWriteRatio() {
        return __awaiter(this, void 0, void 0, function* () {
            // This is a simplified estimation - in practice you'd use MongoDB metrics
            return {
                readPercentage: 75, // Assume reports are read more than written
                writePercentage: 25
            };
        });
    }
    static collectPerformanceStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const collStats = yield report_model_1.default.collection.stats();
                return {
                    totalDocuments: collStats.count,
                    avgDocumentSize: collStats.avgObjSize,
                    totalSize: collStats.size,
                    indexSize: collStats.totalIndexSize,
                    storageSize: collStats.storageSize
                };
            }
            catch (error) {
                return {};
            }
        });
    }
}
exports.ReportDatabaseOptimization = ReportDatabaseOptimization;
exports.default = ReportDatabaseOptimization;
//# sourceMappingURL=reportOptimization.js.map