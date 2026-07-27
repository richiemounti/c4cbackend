"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.ReportSystemInitializer = void 0;
// services/reports/reportSystemInitializer.service.ts
const reportCache_service_1 = __importDefault(require("./reportCache.service"));
const backgroundGeneration_service_1 = __importDefault(require("./backgroundGeneration.service"));
const reportSearch_service_1 = __importDefault(require("./reportSearch.service"));
const reportOptimization_1 = __importDefault(require("../../utils/database/reportOptimization"));
const reportScheduler_service_1 = __importDefault(require("./reportScheduler.service"));
class ReportSystemInitializer {
    /**
     * Initialize the complete report system
     */
    static initialize(customConfig) {
        return __awaiter(this, void 0, void 0, function* () {
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
                this.config = Object.assign(Object.assign({}, this.config), customConfig);
            }
            const initializedComponents = [];
            const errors = [];
            console.log('Initializing Youth Impact Report System...');
            // 1. Initialize caching system
            if (this.config.cache.enabled) {
                try {
                    yield reportCache_service_1.default.initialize({
                        cacheLayer: this.config.cache.layer,
                        redisUrl: this.config.cache.redisUrl,
                        redisOptions: this.config.cache.redisOptions
                    });
                    initializedComponents.push('Cache Service');
                    console.log('✅ Cache service initialized');
                }
                catch (error) {
                    errors.push({
                        component: 'Cache Service',
                        error: error.message
                    });
                    console.error('❌ Cache service initialization failed:', error);
                }
            }
            // 2. Initialize background generation
            if (this.config.backgroundGeneration.enabled) {
                try {
                    yield backgroundGeneration_service_1.default.initialize();
                    initializedComponents.push('Background Generation Service');
                    console.log('✅ Background generation service initialized');
                }
                catch (error) {
                    errors.push({
                        component: 'Background Generation Service',
                        error: error.message
                    });
                    console.error('❌ Background generation service initialization failed:', error);
                }
            }
            // 3. Setup database optimization
            if (this.config.database.createIndexes) {
                try {
                    yield reportOptimization_1.default.createOptimizedIndexes();
                    initializedComponents.push('Database Indexes');
                    console.log('✅ Database indexes created');
                }
                catch (error) {
                    errors.push({
                        component: 'Database Indexes',
                        error: error.message
                    });
                    console.error('❌ Database index creation failed:', error);
                }
            }
            // 4. Setup search indexes
            try {
                yield reportSearch_service_1.default.buildSearchIndex();
                initializedComponents.push('Search Indexes');
                console.log('✅ Search indexes built');
            }
            catch (error) {
                errors.push({
                    component: 'Search Indexes',
                    error: error.message
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
                }
                catch (error) {
                    errors.push({
                        component: 'Report Scheduler',
                        error: error.message
                    });
                    console.error('❌ Report scheduler initialization failed:', error);
                }
            }
            // 6. Setup database monitoring
            if (this.config.database.enableMonitoring) {
                try {
                    yield reportOptimization_1.default.setupMonitoring();
                    initializedComponents.push('Database Monitoring');
                    console.log('✅ Database monitoring initialized');
                }
                catch (error) {
                    errors.push({
                        component: 'Database Monitoring',
                        error: error.message
                    });
                    console.error('❌ Database monitoring initialization failed:', error);
                }
            }
            // 7. Run startup optimization
            if (this.config.database.optimizeOnStartup) {
                try {
                    const optimization = yield reportOptimization_1.default.optimizeBasedOnUsage();
                    if (optimization.optimizationsApplied.length > 0) {
                        console.log('✅ Database optimizations applied:', optimization.optimizationsApplied);
                        initializedComponents.push('Database Optimization');
                    }
                }
                catch (error) {
                    errors.push({
                        component: 'Database Optimization',
                        error: error.message
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
        });
    }
    /**
     * Get system health status
     */
    static getSystemHealth() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const components = {};
            const recommendations = [];
            // Check cache health
            try {
                const cacheStats = yield reportCache_service_1.default.getCacheStats();
                components.cache = {
                    status: cacheStats ? 'healthy' : 'unhealthy',
                    details: cacheStats
                };
                if (((_a = cacheStats === null || cacheStats === void 0 ? void 0 : cacheStats.memory) === null || _a === void 0 ? void 0 : _a.hits) < ((_b = cacheStats === null || cacheStats === void 0 ? void 0 : cacheStats.memory) === null || _b === void 0 ? void 0 : _b.misses)) {
                    recommendations.push('Cache hit rate is low - review caching strategy');
                }
            }
            catch (error) {
                components.cache = {
                    status: 'unhealthy',
                    details: { error: error.message }
                };
            }
            // Check background generation health
            try {
                const queueStats = yield backgroundGeneration_service_1.default.getQueueStats();
                const hasStuckJobs = queueStats.report.failed > 10 || queueStats.report.delayed > 5;
                components.backgroundGeneration = {
                    status: hasStuckJobs ? 'degraded' : 'healthy',
                    details: queueStats
                };
                if (hasStuckJobs) {
                    recommendations.push('High number of failed/delayed jobs - review queue health');
                }
            }
            catch (error) {
                components.backgroundGeneration = {
                    status: 'unhealthy',
                    details: { error: error.message }
                };
            }
            // Check database health
            try {
                const dbHealth = yield reportOptimization_1.default.getHealthMetrics();
                components.database = {
                    status: dbHealth.connectionHealth === 'poor' ? 'unhealthy' :
                        dbHealth.connectionHealth === 'fair' ? 'degraded' : 'healthy',
                    details: dbHealth
                };
                recommendations.push(...dbHealth.recommendations);
            }
            catch (error) {
                components.database = {
                    status: 'unhealthy',
                    details: { error: error.message }
                };
            }
            // Determine overall health
            const statuses = Object.values(components).map(c => c.status);
            const unhealthyCount = statuses.filter(s => s === 'unhealthy').length;
            const degradedCount = statuses.filter(s => s === 'degraded').length;
            let overall;
            if (unhealthyCount > 0) {
                overall = 'unhealthy';
            }
            else if (degradedCount > 0) {
                overall = 'degraded';
            }
            else {
                overall = 'healthy';
            }
            return {
                overall,
                components,
                recommendations: [...new Set(recommendations)] // Remove duplicates
            };
        });
    }
    /**
     * Graceful shutdown of all report services
     */
    static shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Shutting down Youth Impact Report System...');
            const shutdownTasks = [
                { name: 'Cache Service', task: () => reportCache_service_1.default.cleanup() },
                { name: 'Background Generation', task: () => backgroundGeneration_service_1.default.shutdown() }
            ];
            for (const { name, task } of shutdownTasks) {
                try {
                    yield task();
                    console.log(`✅ ${name} shut down gracefully`);
                }
                catch (error) {
                    console.error(`❌ ${name} shutdown failed:`, error);
                }
            }
            this.initialized = false;
            console.log('🏁 Report system shutdown complete');
        });
    }
    /**
     * Restart system components
     */
    static restart(components) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Restarting report system components...');
            if (!components || components.includes('cache')) {
                yield reportCache_service_1.default.clearAllCaches();
                console.log('✅ Cache cleared and restarted');
            }
            if (!components || components.includes('indexes')) {
                yield reportOptimization_1.default.createOptimizedIndexes();
                yield reportSearch_service_1.default.buildSearchIndex();
                console.log('✅ Indexes rebuilt');
            }
            console.log('🔄 Report system restart complete');
        });
    }
    /**
     * Get system metrics for monitoring
     */
    static getSystemMetrics() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const [cacheStats, queueStats, healthStatus] = yield Promise.all([
                    reportCache_service_1.default.getCacheStats(),
                    backgroundGeneration_service_1.default.getQueueStats(),
                    this.getSystemHealth()
                ]);
                // Calculate uptime (simplified - would track actual start time in production)
                const uptime = process.uptime();
                // Calculate cache hit rate
                const cacheHitRate = ((_a = cacheStats === null || cacheStats === void 0 ? void 0 : cacheStats.memory) === null || _a === void 0 ? void 0 : _a.hits) && ((_b = cacheStats === null || cacheStats === void 0 ? void 0 : cacheStats.memory) === null || _b === void 0 ? void 0 : _b.misses)
                    ? (cacheStats.memory.hits / (cacheStats.memory.hits + cacheStats.memory.misses)) * 100
                    : 0;
                // Calculate queue health score
                const totalJobs = queueStats.report.waiting + queueStats.report.active + queueStats.report.completed + queueStats.report.failed;
                const queueHealthScore = totalJobs > 0
                    ? ((queueStats.report.completed / totalJobs) * 100)
                    : 100;
                // Get report statistics
                const Report = (yield Promise.resolve().then(() => __importStar(require('../../models/report.model')))).default;
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const [totalReports, reportsToday] = yield Promise.all([
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
                        cacheSize: ((_c = cacheStats === null || cacheStats === void 0 ? void 0 : cacheStats.memory) === null || _c === void 0 ? void 0 : _c.keys) || 0
                    },
                    health: {
                        overall: healthStatus.overall,
                        components: Object.keys(healthStatus.components)
                    }
                };
            }
            catch (error) {
                console.error('Failed to get system metrics:', error);
                return {
                    uptime: 0,
                    performance: { cacheHitRate: 0, averageQueryTime: 0, queueHealthScore: 0 },
                    usage: { totalReports: 0, reportsGeneratedToday: 0, activeJobs: 0, cacheSize: 0 },
                    health: { overall: 'unhealthy', components: [] }
                };
            }
        });
    }
    /**
     * Setup periodic scheduler for system maintenance
     */
    static setupScheduler() {
        const intervalMs = (this.config.scheduler.intervalMinutes || 60) * 60 * 1000;
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Run scheduler service
                yield reportScheduler_service_1.default.runScheduler();
                // Periodic cache cleanup
                const cacheStats = yield reportCache_service_1.default.getCacheStats();
                if (((_a = cacheStats === null || cacheStats === void 0 ? void 0 : cacheStats.memory) === null || _a === void 0 ? void 0 : _a.keys) > 5000) {
                    console.log('Cache size limit reached, clearing old entries...');
                    // Could implement LRU eviction here
                }
                // Periodic health check
                const health = yield this.getSystemHealth();
                if (health.overall === 'unhealthy') {
                    console.warn('Report system health is unhealthy:', health.recommendations);
                }
            }
            catch (error) {
                console.error('Scheduler execution failed:', error);
            }
        }), intervalMs);
    }
    /**
     * Update system configuration
     */
    static updateConfig(newConfig) {
        this.config = Object.assign(Object.assign({}, this.config), newConfig);
        console.log('Report system configuration updated');
    }
    /**
     * Get current system configuration
     */
    static getConfig() {
        return Object.assign({}, this.config);
    }
    /**
     * Check if system is initialized
     */
    static isInitialized() {
        return this.initialized;
    }
    /**
     * Run system diagnostics
     */
    static runDiagnostics() {
        return __awaiter(this, void 0, void 0, function* () {
            const diagnostics = {
                systemInfo: {},
                performanceTest: {},
                configurationCheck: {},
                recommendations: []
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
                yield reportCache_service_1.default.getCacheStats();
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
                const perfTest = diagnostics.performanceTest;
                if (perfTest.cacheResponseTime && perfTest.cacheResponseTime > 100) {
                    diagnostics.recommendations.push('Cache response time is high - check Redis connection');
                }
            }
            catch (error) {
                diagnostics.recommendations.push(`Diagnostics failed: ${error.message}`);
            }
            return diagnostics;
        });
    }
}
exports.ReportSystemInitializer = ReportSystemInitializer;
ReportSystemInitializer.initialized = false;
ReportSystemInitializer.config = {
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
exports.default = ReportSystemInitializer;
//# sourceMappingURL=reportSystemInitializer.service.js.map