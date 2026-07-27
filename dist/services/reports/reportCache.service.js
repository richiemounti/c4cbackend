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
exports.ReportCacheService = void 0;
// services/reports/reportCache.service.ts
const node_cache_1 = __importDefault(require("node-cache"));
const ioredis_1 = __importDefault(require("ioredis"));
class ReportCacheService {
    /**
     * Initialize caching service
     */
    static initialize() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                this.cacheLayer = options.cacheLayer || 'memory';
                // Initialize memory cache
                this.memoryCache = new node_cache_1.default({
                    stdTTL: 1800, // Default 30 minutes
                    checkperiod: 120,
                    useClones: false,
                    maxKeys: 2000
                });
                // Initialize Redis if specified
                if (this.cacheLayer === 'redis' || this.cacheLayer === 'hybrid') {
                    if (options.redisUrl) {
                        this.redisClient = new ioredis_1.default(options.redisUrl, Object.assign({ retryDelayOnFailover: 100, enableReadyCheck: false, lazyConnect: true }, options.redisOptions));
                        // Test Redis connection
                        yield this.redisClient.ping();
                        console.log('Redis cache connected successfully');
                    }
                    else {
                        console.warn('Redis URL not provided, falling back to memory cache');
                        this.cacheLayer = 'memory';
                    }
                }
                console.log(`Report cache initialized with ${this.cacheLayer} layer`);
            }
            catch (error) {
                console.error('Failed to initialize cache, falling back to memory:', error);
                this.cacheLayer = 'memory';
            }
        });
    }
    /**
     * Cache report data
     */
    static cacheReportData(reportId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureInitialized();
            const key = this.KEYS.REPORT_DATA(reportId);
            const config = this.CACHE_CONFIGS.REPORT_DATA;
            try {
                if (this.cacheLayer === 'redis' && this.redisClient) {
                    yield this.redisClient.setex(key, config.ttl, JSON.stringify(data));
                }
                if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
                    this.memoryCache.set(key, data, config.ttl);
                }
            }
            catch (error) {
                console.error('Failed to cache report data:', error);
            }
        });
    }
    /**
     * Get cached report data
     */
    static getCachedReportData(reportId) {
        return __awaiter(this, void 0, void 0, function* () {
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
                        const redisData = yield this.redisClient.get(key);
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
            }
            catch (error) {
                console.error('Failed to get cached report data:', error);
                return null;
            }
        });
    }
    /**
     * Cache report list with filters
     */
    static cacheReportList(filters, data) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    yield this.redisClient.setex(key, config.ttl, JSON.stringify(cacheData));
                }
                if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
                    this.memoryCache.set(key, cacheData, config.ttl);
                }
            }
            catch (error) {
                console.error('Failed to cache report list:', error);
            }
        });
    }
    /**
     * Get cached report list
     */
    static getCachedReportList(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const filterHash = this.hashFilters(filters);
            const key = this.KEYS.REPORT_LIST(filterHash);
            try {
                // Try memory cache first
                if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
                    const memoryData = this.memoryCache.get(key);
                    if (memoryData) {
                        return memoryData.data;
                    }
                }
                // Try Redis cache
                if (this.cacheLayer === 'redis' || this.cacheLayer === 'hybrid') {
                    if (this.redisClient) {
                        const redisData = yield this.redisClient.get(key);
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
            }
            catch (error) {
                console.error('Failed to get cached report list:', error);
                return null;
            }
        });
    }
    /**
     * Cache report summary statistics
     */
    static cacheReportSummary(projectId, reportType, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.KEYS.REPORT_SUMMARY(projectId, reportType);
            const config = this.CACHE_CONFIGS.REPORT_SUMMARY;
            try {
                if (this.cacheLayer === 'redis' && this.redisClient) {
                    yield this.redisClient.setex(key, config.ttl, JSON.stringify(data));
                }
                if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
                    this.memoryCache.set(key, data, config.ttl);
                }
            }
            catch (error) {
                console.error('Failed to cache report summary:', error);
            }
        });
    }
    /**
     * Get cached report summary
     */
    static getCachedReportSummary(projectId, reportType) {
        return __awaiter(this, void 0, void 0, function* () {
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
                        const redisData = yield this.redisClient.get(key);
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
            }
            catch (error) {
                console.error('Failed to get cached report summary:', error);
                return null;
            }
        });
    }
    /**
     * Invalidate cache for specific report
     */
    static invalidateReport(reportId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Invalidate specific report data
                const reportKey = this.KEYS.REPORT_DATA(reportId);
                if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
                    this.memoryCache.del(reportKey);
                }
                if (this.cacheLayer === 'redis' && this.redisClient) {
                    yield this.redisClient.del(reportKey);
                }
                // Invalidate related caches (report lists, summaries)
                yield this.invalidateRelatedCaches(reportId);
            }
            catch (error) {
                console.error('Failed to invalidate report cache:', error);
            }
        });
    }
    /**
     * Invalidate all caches for a project
     */
    static invalidateProjectCaches(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    const keys = yield this.redisClient.keys(`*project:${projectId}*`);
                    const summaryKeys = yield this.redisClient.keys(`*summary:${projectId}*`);
                    const allKeys = [...keys, ...summaryKeys];
                    if (allKeys.length > 0) {
                        yield this.redisClient.del(...allKeys);
                    }
                }
                // Also invalidate report lists that might contain this project's reports
                yield this.invalidateReportLists();
            }
            catch (error) {
                console.error('Failed to invalidate project caches:', error);
            }
        });
    }
    /**
     * Clear all report-related caches
     */
    static clearAllCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.cacheLayer === 'memory' || this.cacheLayer === 'hybrid') {
                    this.memoryCache.flushAll();
                }
                if (this.cacheLayer === 'redis' && this.redisClient) {
                    yield this.redisClient.flushdb();
                }
                console.log('All report caches cleared');
            }
            catch (error) {
                console.error('Failed to clear all caches:', error);
            }
        });
    }
    /**
     * Get cache statistics
     */
    static getCacheStats() {
        return __awaiter(this, void 0, void 0, function* () {
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
                        const info = yield this.redisClient.info('memory');
                        const keyspace = yield this.redisClient.info('keyspace');
                        stats.redis.connected = true;
                        stats.redis.memory = this.parseRedisMemory(info);
                        stats.redis.keys = this.parseRedisKeys(keyspace);
                    }
                    catch (error) {
                        stats.redis.connected = false;
                    }
                }
                return stats;
            }
            catch (error) {
                console.error('Failed to get cache stats:', error);
                return null;
            }
        });
    }
    // Private helper methods
    static hashFilters(filters) {
        const crypto = require('crypto');
        const filterString = JSON.stringify(filters, Object.keys(filters).sort());
        return crypto.createHash('md5').update(filterString).digest('hex');
    }
    static invalidateRelatedCaches(reportId) {
        return __awaiter(this, void 0, void 0, function* () {
            // This would invalidate report lists and summaries that might include this report
            // Implementation depends on how you want to handle cache invalidation strategy
            yield this.invalidateReportLists();
        });
    }
    static invalidateReportLists() {
        return __awaiter(this, void 0, void 0, function* () {
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
                    const keys = yield this.redisClient.keys('report:list:*');
                    if (keys.length > 0) {
                        yield this.redisClient.del(...keys);
                    }
                }
            }
            catch (error) {
                console.error('Failed to invalidate report lists:', error);
            }
        });
    }
    static parseRedisMemory(info) {
        const match = info.match(/used_memory:(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }
    static parseRedisKeys(keyspace) {
        const match = keyspace.match(/keys=(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }
    static ensureInitialized() {
        if (!this.memoryCache) {
            this.memoryCache = new node_cache_1.default({
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
    static cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.redisClient) {
                    yield this.redisClient.quit();
                }
                if (this.memoryCache) {
                    this.memoryCache.close();
                }
                console.log('Report cache service cleaned up');
            }
            catch (error) {
                console.error('Error during cache cleanup:', error);
            }
        });
    }
}
exports.ReportCacheService = ReportCacheService;
ReportCacheService.redisClient = null;
ReportCacheService.cacheLayer = 'memory';
// Cache configurations for different data types
ReportCacheService.CACHE_CONFIGS = {
    REPORT_DATA: { ttl: 3600, maxKeys: 1000, checkperiod: 600 }, // 1 hour
    REPORT_LIST: { ttl: 900, maxKeys: 500, checkperiod: 120 }, // 15 minutes
    REPORT_SUMMARY: { ttl: 1800, maxKeys: 200, checkperiod: 300 }, // 30 minutes
    REPORT_ANALYTICS: { ttl: 7200, maxKeys: 100, checkperiod: 600 }, // 2 hours
    USER_REPORTS: { ttl: 600, maxKeys: 1000, checkperiod: 120 }, // 10 minutes
    GENERATION_QUEUE: { ttl: 300, maxKeys: 100, checkperiod: 60 } // 5 minutes
};
// Cache key generators
ReportCacheService.KEYS = {
    REPORT_DATA: (reportId) => `report:data:${reportId}`,
    REPORT_LIST: (filters) => `report:list:${filters}`,
    REPORT_SUMMARY: (projectId, reportType) => `report:summary:${projectId}:${reportType}`,
    REPORT_ANALYTICS: (organizationId) => `report:analytics:${organizationId}`,
    USER_REPORTS: (userId) => `report:user:${userId}`,
    GENERATION_QUEUE: () => `report:queue:generation`
};
exports.default = ReportCacheService;
//# sourceMappingURL=reportCache.service.js.map