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
exports.getIncidentStats = exports.getSupportEscalationStats = exports.markItemCompleted = exports.getWorkloadSummary = void 0;
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const review_model_1 = __importDefault(require("../models/review.model"));
const reviewHelpers_1 = require("../utils/reviewHelpers");
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Get workload summary for the admin dashboard.
 * Workload = escalated review count per account manager.
 * @route GET /api/v1/admin/workload/summary
 * @access Private - ConnectGo staff only
 */
const getWorkloadSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Staff access required');
            error.statusCode = 403;
            throw error;
        }
        // Active projects (not archived, not completed)
        const activeProjects = yield project_model_1.default.countDocuments({
            archived: { $ne: true },
            status: { $nin: ['completed', 'archived'] },
        });
        // Active sites
        const activeSites = yield projectSite_model_1.default.countDocuments({
            archived: { $ne: true },
            status: { $nin: ['completed', 'archived'] },
        });
        // Projects by stage for breakdown
        const projectsByStage = yield project_model_1.default.aggregate([
            { $match: { archived: { $ne: true } } },
            { $group: { _id: '$stage', count: { $sum: 1 } } },
        ]);
        const itemsByStage = {
            onboarding: 0,
            design: 0,
            measure: 0,
            learn: 0,
            tell: 0,
        };
        for (const entry of projectsByStage) {
            if (entry._id && itemsByStage.hasOwnProperty(entry._id)) {
                itemsByStage[entry._id] = entry.count;
            }
        }
        // Completed items (projects + sites marked completed)
        const completedProjects = yield project_model_1.default.countDocuments({ status: 'completed' });
        const completedSites = yield projectSite_model_1.default.countDocuments({ status: 'completed' });
        const completedItems = completedProjects + completedSites;
        const totalItems = activeProjects + activeSites;
        // Capacity is based on the most loaded account manager
        const amStats = yield (0, reviewHelpers_1.getAccountManagerWorkloadStats)();
        let overallCapacityStatus = 'green';
        let overallCapacityPercentage = 0;
        if (amStats.length > 0) {
            // Use the most loaded AM to represent overall capacity
            const mostLoaded = amStats.reduce((max, am) => am.escalatedCount > max.escalatedCount ? am : max);
            overallCapacityStatus = mostLoaded.capacityTier;
            overallCapacityPercentage = mostLoaded.capacityPercentage;
        }
        // Build workload items (active projects with org/stage info)
        const projectItems = yield project_model_1.default.find({
            archived: { $ne: true },
            status: { $nin: ['completed', 'archived'] },
        })
            .populate('organization', 'name')
            .select('name status stage organization')
            .limit(50)
            .lean();
        const items = projectItems.map((p) => {
            var _a, _b;
            return ({
                _id: p._id,
                type: 'project',
                name: p.name,
                organization: {
                    _id: (_a = p.organization) === null || _a === void 0 ? void 0 : _a._id,
                    name: ((_b = p.organization) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown',
                },
                status: p.status,
                stage: p.stage || 'onboarding',
                isCompleted: p.status === 'completed',
            });
        });
        res.status(200).json({
            success: true,
            data: {
                totalItems,
                activeProjects,
                activeSites,
                completedItems,
                capacityStatus: overallCapacityStatus,
                capacityPercentage: overallCapacityPercentage,
                itemsByStage,
                items,
                accountManagers: amStats, // Per-AM breakdown for the detailed view
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getWorkloadSummary = getWorkloadSummary;
/**
 * Mark a project or site as completed
 * @route POST /api/v1/admin/workload/:itemType/:itemId/complete
 * @access Private - ConnectGo staff only
 */
const markItemCompleted = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Staff access required');
            error.statusCode = 403;
            throw error;
        }
        const { itemType, itemId } = req.params;
        if (!['project', 'site'].includes(itemType)) {
            const error = new Error('Invalid item type. Must be "project" or "site"');
            error.statusCode = 400;
            throw error;
        }
        const Model = (itemType === 'project' ? project_model_1.default : projectSite_model_1.default);
        const item = yield Model.findById(itemId);
        if (!item) {
            const error = new Error(`${itemType} not found`);
            error.statusCode = 404;
            throw error;
        }
        item.status = 'completed';
        yield item.save();
        res.status(200).json({
            success: true,
            message: `${itemType} marked as completed`,
            data: item,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.markItemCompleted = markItemCompleted;
/**
 * Get support & escalation statistics.
 * Pulls from Review model as the source of truth for escalation data.
 * @route GET /api/v1/admin/support/stats
 * @access Private - ConnectGo staff only
 */
const getSupportEscalationStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Staff access required');
            error.statusCode = 403;
            throw error;
        }
        const totalEscalated = yield review_model_1.default.countDocuments({ status: 'escalated' });
        const resolvedEscalated = yield review_model_1.default.countDocuments({ status: 'resolved' });
        const totalReviews = yield review_model_1.default.countDocuments({});
        // Satisfaction = percentage of reviews that were resolved without escalation
        const directlyResolved = yield review_model_1.default.countDocuments({
            status: { $in: ['approved', 'resolved'] },
            escalatedTo: { $exists: false },
        });
        const overallSatisfaction = totalReviews > 0 ? Math.round((directlyResolved / totalReviews) * 100) : 0;
        res.status(200).json({
            success: true,
            data: {
                chatbotQuestions: 0, // Placeholder — wire to your chatbot system when ready
                clientIncidents: totalEscalated,
                satisfactionSurveys: 0, // Placeholder — wire to pulse survey when ready
                overallSatisfaction,
                categorizedSupport: [
                    { category: 'client_incidents', count: totalEscalated },
                    { category: 'satisfaction_surveys', count: 0 },
                    { category: 'chatbot_questions', count: 0 },
                ],
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSupportEscalationStats = getSupportEscalationStats;
/**
 * Get incident statistics.
 * @route GET /api/v1/admin/incidents/stats
 * @access Private - ConnectGo staff only
 */
const getIncidentStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Staff access required');
            error.statusCode = 403;
            throw error;
        }
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [total, open, resolved, critical, recent] = yield Promise.all([
            review_model_1.default.countDocuments({ status: 'escalated' }),
            review_model_1.default.countDocuments({ status: 'escalated' }),
            review_model_1.default.countDocuments({ status: 'resolved', escalatedTo: { $exists: true } }),
            review_model_1.default.countDocuments({ status: 'escalated', priority: 'critical' }),
            review_model_1.default.countDocuments({
                status: 'escalated',
                escalatedAt: { $gte: sevenDaysAgo },
            }),
        ]);
        res.status(200).json({
            success: true,
            data: {
                totalIncidents: total,
                openIncidents: open,
                resolvedIncidents: resolved,
                criticalIncidents: critical,
                recentIncidents: recent,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getIncidentStats = getIncidentStats;
exports.default = {
    getWorkloadSummary: exports.getWorkloadSummary,
    markItemCompleted: exports.markItemCompleted,
    getSupportEscalationStats: exports.getSupportEscalationStats,
    getIncidentStats: exports.getIncidentStats,
};
//# sourceMappingURL=workload.controller.js.map