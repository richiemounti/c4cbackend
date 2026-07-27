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
exports.trackExportActivity = exports.autoSnapshot = exports.trackSession = exports.trackReportActivity = void 0;
const userActivityTracking_service_1 = __importDefault(require("../services/reports/userActivityTracking.service"));
/**
 * Middleware to automatically track report views and interactions
 */
const trackReportActivity = (activityType = 'view', actionName) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            // Skip if user is not authenticated
            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
                return next();
            }
            // Extract reportId from various possible locations
            const reportId = req.params.reportId ||
                req.params.id ||
                req.body.reportId ||
                req.query.reportId;
            if (!reportId) {
                return next();
            }
            // Record start time for duration tracking
            req.startTime = Date.now();
            // Default action name based on HTTP method and route
            const defaultAction = actionName || `${req.method.toLowerCase()}_${activityType}`;
            // Log the activity after response is sent
            res.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    // Skip if already logged or if it's an error response
                    if (req.activityLogged || res.statusCode >= 400) {
                        return;
                    }
                    // Calculate duration
                    const duration = req.startTime ? Date.now() - req.startTime : undefined;
                    // Determine description based on the endpoint
                    let description = `${req.method} ${req.path}`;
                    // Enhanced descriptions for specific endpoints
                    if (req.path.includes('/snapshots')) {
                        description = 'Viewed report snapshots';
                    }
                    else if (req.path.includes('/activity')) {
                        description = 'Viewed report activity';
                    }
                    else if (req.path.includes('/versions')) {
                        description = 'Viewed report version history';
                    }
                    else if (req.path.includes('/export')) {
                        description = 'Exported report';
                        activityType = 'export';
                    }
                    yield userActivityTracking_service_1.default.logActivity(reportId, req.user._id.toString(), activityType, defaultAction, {
                        description,
                        metadata: {
                            method: req.method,
                            path: req.path,
                            statusCode: res.statusCode,
                            responseSize: res.get('Content-Length'),
                            query: req.query
                        },
                        duration,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent'),
                        sessionId: req.get('X-Session-ID') || req.sessionID,
                        source: req.get('X-Client-Source') || 'web',
                        referrer: req.get('Referer'),
                        location: req.get('X-User-Location')
                    });
                    req.activityLogged = true;
                }
                catch (error) {
                    // Don't fail the request if activity logging fails
                    console.error('Failed to log activity:', error);
                }
            }));
            next();
        }
        catch (error) {
            // Don't fail the request if activity tracking setup fails
            console.error('Failed to setup activity tracking:', error);
            next();
        }
    });
};
exports.trackReportActivity = trackReportActivity;
/**
 * Middleware to track session start/heartbeat
 */
const trackSession = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
                return next();
            }
            const reportId = req.params.reportId || req.params.id;
            const sessionId = req.get('X-Session-ID') || req.sessionID;
            if (reportId && sessionId) {
                // Start or update session (non-blocking)
                userActivityTracking_service_1.default.startSession(reportId, req.user._id.toString(), sessionId).catch(error => {
                    console.error('Failed to track session:', error);
                });
            }
            next();
        }
        catch (error) {
            console.error('Failed to setup session tracking:', error);
            next();
        }
    });
};
exports.trackSession = trackSession;
/**
 * Middleware to automatically create snapshots on significant changes
 */
const autoSnapshot = (trigger = 'status_change') => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
                return next();
            }
            const reportId = req.params.reportId || req.params.id;
            if (!reportId) {
                return next();
            }
            // Create snapshot after successful response
            res.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    // Only create snapshot for successful requests
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        let reason = '';
                        let snapshotType = 'automatic';
                        switch (trigger) {
                            case 'approval':
                                reason = 'Automatic snapshot on approval';
                                snapshotType = 'approval';
                                break;
                            case 'status_change':
                                reason = 'Automatic snapshot on status change';
                                break;
                            case 'major_edit':
                                reason = 'Automatic snapshot on major edit';
                                break;
                        }
                        // Import here to avoid circular dependencies
                        const { default: ReportSnapshotService } = yield Promise.resolve().then(() => __importStar(require('../services/reports/reportSnapshot.service')));
                        yield ReportSnapshotService.createSnapshot(reportId, req.user._id.toString(), snapshotType, reason, false // Don't force if no changes
                        );
                    }
                }
                catch (error) {
                    // Don't fail the request if snapshot creation fails
                    console.error('Failed to create automatic snapshot:', error);
                }
            }));
            next();
        }
        catch (error) {
            console.error('Failed to setup auto snapshot:', error);
            next();
        }
    });
};
exports.autoSnapshot = autoSnapshot;
/**
 * Middleware to track export activities with enhanced metadata
 */
const trackExportActivity = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a._id)) {
                return next();
            }
            const reportId = req.params.reportId || req.params.id;
            if (!reportId) {
                return next();
            }
            // Track export completion
            res.on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const format = req.query.format || req.body.format || 'unknown';
                        const fileSize = res.get('Content-Length');
                        yield userActivityTracking_service_1.default.logActivity(reportId, req.user._id.toString(), 'export', `export_${format}`, {
                            description: `Exported report as ${format}`,
                            metadata: {
                                format,
                                fileSize: fileSize ? parseInt(fileSize) : undefined,
                                exportOptions: req.body.options || req.query
                            },
                            duration: req.startTime ? Date.now() - req.startTime : undefined,
                            ipAddress: req.ip,
                            userAgent: req.get('User-Agent'),
                            sessionId: req.get('X-Session-ID') || req.sessionID
                        });
                        // Also update report's export history
                        const Report = (yield Promise.resolve().then(() => __importStar(require('../models/report.model')))).default;
                        const report = yield Report.findById(reportId);
                        if (report) {
                            report.addExportRecord(format, req.user._id, fileSize ? parseInt(fileSize) : undefined);
                            yield report.save();
                        }
                    }
                }
                catch (error) {
                    console.error('Failed to track export activity:', error);
                }
            }));
            next();
        }
        catch (error) {
            console.error('Failed to setup export tracking:', error);
            next();
        }
    });
};
exports.trackExportActivity = trackExportActivity;
exports.default = {
    trackReportActivity: exports.trackReportActivity,
    trackSession: exports.trackSession,
    autoSnapshot: exports.autoSnapshot,
    trackExportActivity: exports.trackExportActivity
};
//# sourceMappingURL=reportActivity.middleware.js.map