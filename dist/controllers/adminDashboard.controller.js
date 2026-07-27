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
exports.getEntityTimeline = exports.generateReviews = exports.getReviewQueue = exports.getOrganizationsSummary = exports.getDashboardOverview = void 0;
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const organization_model_1 = __importDefault(require("../models/organization.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const projectSetupTask_model_1 = __importDefault(require("../models/projectSetupTask.model"));
const projectSiteSetupTask_model_1 = __importDefault(require("../models/projectSiteSetupTask.model"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const theoryOfChangeStage_model_1 = __importDefault(require("../models/theoryOfChangeStage.model"));
const tocConsultationPlan_model_1 = __importDefault(require("../models/tocConsultationPlan.model"));
const review_model_1 = __importDefault(require("../models/review.model"));
const riskRegister_model_1 = __importDefault(require("../models/riskRegister.model"));
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Get comprehensive dashboard overview
 * @route GET /api/v1/admin/dashboard/overview
 * @access Private (Admin only)
 */
const getDashboardOverview = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Admin access required');
            error.statusCode = 403;
            throw error;
        }
        // Execute all queries in parallel for better performance
        const [organizationStatsResult, projectStatsResult, siteStatsResult, userStatsResult, reviewStatsResult, riskStatsResult, progressByStageResult, recentActivityResult] = yield Promise.all([
            // Organization statistics
            organization_model_1.default.aggregate([
                { $match: { archived: { $ne: true } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        activeCount: { $sum: { $cond: [{ $ne: ["$status", "inactive"] }, 1, 0] } },
                        byCountry: { $push: "$country" }
                    }
                }
            ]),
            // Project statistics with stage breakdown
            project_model_1.default.aggregate([
                { $match: { archived: { $ne: true } } },
                {
                    $lookup: {
                        from: "projectsetups",
                        localField: "_id",
                        foreignField: "project",
                        as: "setup"
                    }
                },
                {
                    $lookup: {
                        from: "theoryofchangestages",
                        localField: "_id",
                        foreignField: "project",
                        as: "tocStages"
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        byStatus: { $push: "$status" },
                        setupComplete: {
                            $sum: {
                                $cond: [{ $eq: [{ $first: "$setup.isComplete" }, true] }, 1, 0]
                            }
                        },
                        withToCStages: {
                            $sum: {
                                $cond: [{ $gt: [{ $size: "$tocStages" }, 0] }, 1, 0]
                            }
                        }
                    }
                }
            ]),
            // Site statistics
            projectSite_model_1.default.aggregate([
                { $match: { archived: { $ne: true } } },
                {
                    $lookup: {
                        from: "projectsitesetups",
                        localField: "_id",
                        foreignField: "projectSite",
                        as: "setup"
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        byStatus: { $push: "$status" },
                        setupComplete: {
                            $sum: {
                                $cond: [{ $eq: [{ $first: "$setup.isComplete" }, true] }, 1, 0]
                            }
                        }
                    }
                }
            ]),
            // User statistics
            user_model_1.default.aggregate([
                { $match: { archived: { $ne: true } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        byRole: { $push: "$primaryRole" },
                        connectGoStaff: { $sum: { $cond: [{ $eq: ["$isConnectGoStaff", true] }, 1, 0] } }
                    }
                }
            ]),
            // Review statistics
            review_model_1.default.aggregate([
                { $match: { archived: { $ne: true } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                        inReview: { $sum: { $cond: [{ $eq: ["$status", "in_review"] }, 1, 0] } },
                        overdue: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $lt: ["$dueDate", new Date()] },
                                            { $not: { $in: ["$status", ["approved", "rejected", "cancelled"]] } }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        byPriority: { $push: "$priority" },
                        byEntityType: { $push: "$entityType" }
                    }
                }
            ]),
            // Risk statistics
            riskRegister_model_1.default.aggregate([
                { $match: { archived: { $ne: true }, status: { $ne: "closed" } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        highRisk: { $sum: { $cond: [{ $eq: ["$riskScore", "high"] }, 1, 0] } },
                        mediumRisk: { $sum: { $cond: [{ $eq: ["$riskScore", "medium"] }, 1, 0] } },
                        lowRisk: { $sum: { $cond: [{ $eq: ["$riskScore", "low"] }, 1, 0] } },
                        reviewOverdue: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $lt: ["$reviewDate", new Date()] },
                                            { $eq: ["$status", "open"] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),
            // Progress by Youth Impact stage
            organization_model_1.default.aggregate([
                {
                    $lookup: {
                        from: "projects",
                        localField: "_id",
                        foreignField: "organization",
                        as: "projects"
                    }
                },
                {
                    $lookup: {
                        from: "projectsetups",
                        localField: "projects._id",
                        foreignField: "project",
                        as: "projectSetups"
                    }
                },
                {
                    $lookup: {
                        from: "theoryofchangestages",
                        localField: "projects._id",
                        foreignField: "project",
                        as: "tocStages"
                    }
                },
                {
                    $addFields: {
                        stage: {
                            $cond: [
                                { $eq: [{ $size: "$projects" }, 0] },
                                "onboarding",
                                {
                                    $cond: [
                                        { $eq: [{ $size: { $filter: { input: "$projectSetups", cond: { $eq: ["$$this.isComplete", true] } } } }, 0] },
                                        "onboarding",
                                        {
                                            $cond: [
                                                { $eq: [{ $size: "$tocStages" }, 0] },
                                                "design",
                                                {
                                                    $cond: [
                                                        { $gt: [{ $size: { $filter: { input: "$projects", cond: { $eq: ["$$this.status", "active"] } } } }, 0] },
                                                        "measure",
                                                        {
                                                            $cond: [
                                                                { $gt: [{ $size: { $filter: { input: "$projects", cond: { $eq: ["$$this.status", "completed"] } } } }, 0] },
                                                                "learn",
                                                                "tell"
                                                            ]
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: "$stage",
                        count: { $sum: 1 },
                        organizations: { $push: { _id: "$_id", name: "$name" } }
                    }
                }
            ]),
            // Recent activity (last 30 days)
            project_model_1.default.aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
                { $lookup: { from: "organizations", localField: "organization", foreignField: "_id", as: "org" } },
                { $sort: { createdAt: -1 } },
                { $limit: 10 },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        status: 1,
                        createdAt: 1,
                        organizationName: { $first: "$org.name" }
                    }
                }
            ])
        ]);
        // Process results with proper typing
        const orgStats = organizationStatsResult[0] || { total: 0, activeCount: 0, byCountry: [] };
        const projStats = projectStatsResult[0] || { total: 0, byStatus: [], setupComplete: 0, withToCStages: 0 };
        const sitesStats = siteStatsResult[0] || { total: 0, byStatus: [], setupComplete: 0 };
        const usersStats = userStatsResult[0] || { total: 0, byRole: [], connectGoStaff: 0 };
        const revStats = reviewStatsResult[0] || { total: 0, pending: 0, inReview: 0, overdue: 0, byPriority: [], byEntityType: [] };
        const risksStats = riskStatsResult[0] || { total: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0, reviewOverdue: 0 };
        // Process stage data
        const stageData = progressByStageResult.reduce((acc, stage) => {
            acc[stage._id] = stage.count;
            return acc;
        }, { onboarding: 0, design: 0, measure: 0, learn: 0, tell: 0 });
        // Build response
        const dashboardData = {
            summary: {
                totalOrganizations: orgStats.total,
                totalProjects: projStats.total,
                totalSites: sitesStats.total,
                totalUsers: usersStats.total,
                pendingReviews: revStats.pending + revStats.inReview,
                overdueItems: revStats.overdue + risksStats.reviewOverdue,
                highRiskItems: risksStats.highRisk
            },
            projectsByStage: stageData,
            projectsByStatus: projStats.byStatus.reduce((acc, status) => {
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {}),
            setupProgress: {
                projectsWithSetup: projStats.setupComplete,
                sitesWithSetup: sitesStats.setupComplete,
                projectsWithToC: projStats.withToCStages
            },
            reviewBreakdown: {
                pending: revStats.pending,
                inReview: revStats.inReview,
                overdue: revStats.overdue,
                byPriority: revStats.byPriority.reduce((acc, priority) => {
                    acc[priority] = (acc[priority] || 0) + 1;
                    return acc;
                }, {}),
                byEntityType: revStats.byEntityType.reduce((acc, type) => {
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {})
            },
            riskBreakdown: {
                total: risksStats.total,
                high: risksStats.highRisk,
                medium: risksStats.mediumRisk,
                low: risksStats.lowRisk,
                reviewOverdue: risksStats.reviewOverdue
            },
            recentActivity: recentActivityResult.map((activity) => ({
                id: activity._id,
                type: 'project_created',
                title: `Project "${activity.name}" created`,
                organization: activity.organizationName,
                date: activity.createdAt,
                status: activity.status
            }))
        };
        res.status(200).json({
            success: true,
            data: dashboardData
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getDashboardOverview = getDashboardOverview;
/**
 * Get organizations summary for dashboard
 * @route GET /api/v1/admin/dashboard/organizations
 * @access Private (Admin only)
 */
const getOrganizationsSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Admin access required');
            error.statusCode = 403;
            throw error;
        }
        // Build filters
        const filters = { archived: { $ne: true } };
        if (req.query.stage)
            filters.stage = req.query.stage;
        if (req.query.country)
            filters.country = req.query.country;
        if (req.query.status)
            filters.status = req.query.status;
        const organizations = yield organization_model_1.default.aggregate([
            { $match: filters },
            {
                $lookup: {
                    from: "projects",
                    localField: "_id",
                    foreignField: "organization",
                    as: "projects"
                }
            },
            {
                $lookup: {
                    from: "projectsites",
                    localField: "projects._id",
                    foreignField: "project",
                    as: "sites"
                }
            },
            {
                $lookup: {
                    from: "projectsetups",
                    localField: "projects._id",
                    foreignField: "project",
                    as: "projectSetups"
                }
            },
            {
                $lookup: {
                    from: "theoryofchangestages",
                    localField: "projects._id",
                    foreignField: "project",
                    as: "tocStages"
                }
            },
            {
                $addFields: {
                    projectCount: { $size: "$projects" },
                    siteCount: { $size: "$sites" },
                    setupCompleteCount: {
                        $size: {
                            $filter: {
                                input: "$projectSetups",
                                cond: { $eq: ["$$this.isComplete", true] }
                            }
                        }
                    },
                    averageSetupProgress: {
                        $cond: [
                            { $gt: [{ $size: "$projectSetups" }, 0] },
                            { $avg: "$projectSetups.progress" },
                            0
                        ]
                    },
                    stage: {
                        $cond: [
                            { $eq: [{ $size: "$projects" }, 0] },
                            "onboarding",
                            {
                                $cond: [
                                    { $eq: ["$setupCompleteCount", 0] },
                                    "onboarding",
                                    {
                                        $cond: [
                                            { $eq: [{ $size: "$tocStages" }, 0] },
                                            "design",
                                            {
                                                $cond: [
                                                    { $gt: [{ $size: { $filter: { input: "$projects", cond: { $eq: ["$$this.status", "active"] } } } }, 0] },
                                                    "measure",
                                                    {
                                                        $cond: [
                                                            { $gt: [{ $size: { $filter: { input: "$projects", cond: { $eq: ["$$this.status", "completed"] } } } }, 0] },
                                                            "learn",
                                                            "tell"
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    country: 1,
                    city: 1,
                    projectCount: 1,
                    siteCount: 1,
                    stage: 1,
                    progress: { $round: ["$averageSetupProgress", 0] },
                    lastActivity: "$updatedAt",
                    status: {
                        $cond: [
                            { $eq: ["$projectCount", 0] },
                            "onboarding",
                            {
                                $cond: [
                                    { $gt: [{ $size: { $filter: { input: "$projects", cond: { $eq: ["$$this.status", "completed"] } } } }, 0] },
                                    "completed",
                                    "active"
                                ]
                            }
                        ]
                    }
                }
            },
            { $sort: { name: 1 } }
        ]);
        res.status(200).json({
            success: true,
            count: organizations.length,
            data: organizations
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getOrganizationsSummary = getOrganizationsSummary;
/**
 * Get review queue for dashboard
 * @route GET /api/v1/admin/dashboard/reviews
 * @access Private (Admin only)
 */
const getReviewQueue = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Admin access required');
            error.statusCode = 403;
            throw error;
        }
        // Build filters
        const filters = { archived: { $ne: true } };
        if (req.query.status)
            filters.status = req.query.status;
        if (req.query.priority)
            filters.priority = req.query.priority;
        if (req.query.entityType)
            filters.entityType = req.query.entityType;
        if (req.query.assignedTo)
            filters.assignedTo = req.query.assignedTo;
        if (req.query.overdue === 'true') {
            filters.dueDate = { $lt: new Date() };
            filters.status = { $nin: ['approved', 'rejected', 'cancelled'] };
        }
        const reviews = yield review_model_1.default.find(filters)
            .populate('project', 'name')
            .populate('projectSite', 'name')
            .populate('organization', 'name')
            .populate('assignedTo', 'name email')
            .populate('creator', 'name')
            .sort({ priority: -1, dueDate: 1, createdAt: -1 })
            .limit(100);
        const processedReviews = reviews.map((review) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                _id: review._id,
                entityType: review.entityType,
                title: review.title,
                description: review.description,
                organization: ((_a = review.organization) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                project: ((_b = review.project) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown',
                projectId: (_c = review.project) === null || _c === void 0 ? void 0 : _c._id, // ADD THIS - Include the actual project ID
                site: (_d = review.projectSite) === null || _d === void 0 ? void 0 : _d.name,
                siteId: (_e = review.projectSite) === null || _e === void 0 ? void 0 : _e._id, // Also include site ID if needed
                status: review.status,
                priority: review.priority,
                progress: review.progress,
                completedTasks: review.completedTasks,
                totalTasks: review.totalTasks,
                assignedTo: (_f = review.assignedTo) === null || _f === void 0 ? void 0 : _f.name,
                dueDate: review.dueDate,
                isOverdue: review.dueDate && review.dueDate < new Date() && !['approved', 'rejected', 'cancelled'].includes(review.status),
                lastUpdated: review.updatedAt,
                commentCount: review.comments.length
            });
        });
        res.status(200).json({
            success: true,
            count: processedReviews.length,
            data: processedReviews
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReviewQueue = getReviewQueue;
/**
 * Generate dashboard reviews from incomplete tasks
 * @route POST /api/v1/admin/dashboard/reviews/generate
 * @access Private (Admin only)
 */
const generateReviews = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Admin access required');
            error.statusCode = 403;
            throw error;
        }
        const reviewsToCreate = [];
        // 1. Check incomplete project setups
        const incompleteProjectSetups = yield projectSetupTask_model_1.default.find({
            isComplete: false,
            progress: { $gt: 0 }
        }).populate('project');
        for (const setup of incompleteProjectSetups) {
            const existingReview = yield review_model_1.default.findOne({
                entityType: 'project_setup',
                entityId: setup._id,
                status: { $nin: ['approved', 'rejected', 'cancelled'] }
            });
            if (!existingReview && setup.project) {
                reviewsToCreate.push({
                    entityType: 'project_setup',
                    entityId: setup._id,
                    project: setup.project._id,
                    organization: setup.project.organization,
                    title: `${setup.project.name} - Project Setup Review`,
                    description: `Review and approve project setup completion for ${setup.project.name}`,
                    priority: setup.progress < 25 ? 'high' : setup.progress < 50 ? 'medium' : 'low',
                    progress: setup.progress,
                    completedTasks: setup.tasks.filter((t) => t.isCompleted).length,
                    totalTasks: setup.tasks.filter((t) => t.isRequired).length,
                    dueDate: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days
                    creator: req.user._id
                });
            }
        }
        // 2. Check incomplete site setups
        const incompleteSiteSetups = yield projectSiteSetupTask_model_1.default.find({
            isComplete: false,
            progress: { $gt: 0 }
        }).populate(['project', 'projectSite']);
        for (const setup of incompleteSiteSetups) {
            const existingReview = yield review_model_1.default.findOne({
                entityType: 'site_setup',
                entityId: setup._id,
                status: { $nin: ['approved', 'rejected', 'cancelled'] }
            });
            if (!existingReview && setup.project && setup.projectSite) {
                reviewsToCreate.push({
                    entityType: 'site_setup',
                    entityId: setup._id,
                    project: setup.project._id,
                    projectSite: setup.projectSite._id,
                    organization: setup.project.organization,
                    title: `${setup.projectSite.name} - Site Setup Review`,
                    description: `Review and approve site setup completion for ${setup.projectSite.name}`,
                    priority: setup.progress < 25 ? 'high' : setup.progress < 50 ? 'medium' : 'low',
                    progress: setup.progress,
                    completedTasks: setup.tasks.filter((t) => t.isCompleted).length,
                    totalTasks: setup.tasks.filter((t) => t.isRequired).length,
                    dueDate: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)), // 5 days
                    creator: req.user._id
                });
            }
        }
        // 3. Check incomplete consultation plans
        const incompleteConsultationPlans = yield tocConsultationPlan_model_1.default.find({
            isCompleted: false
        }).populate(['project', 'projectSite']);
        for (const plan of incompleteConsultationPlans) {
            const existingReview = yield review_model_1.default.findOne({
                entityType: 'consultation_plan',
                entityId: plan._id,
                status: { $nin: ['approved', 'rejected', 'cancelled'] }
            });
            if (!existingReview && plan.project && plan.projectSite) {
                const completionPercentage = plan.completionPercentage || 0;
                reviewsToCreate.push({
                    entityType: 'consultation_plan',
                    entityId: plan._id,
                    project: plan.project._id,
                    projectSite: plan.projectSite._id,
                    organization: plan.project.organization,
                    title: `${plan.projectSite.name} - Consultation Plan Review`,
                    description: `Review and approve consultation plan for ${plan.projectSite.name}`,
                    priority: completionPercentage < 50 ? 'high' : 'medium',
                    progress: completionPercentage,
                    completedTasks: 0,
                    totalTasks: 1,
                    dueDate: new Date(Date.now() + (10 * 24 * 60 * 60 * 1000)), // 10 days
                    creator: req.user._id
                });
            }
        }
        // 4. Check incomplete stakeholder mappings
        const incompleteStakeholders = yield stakeholderGroup_model_1.default.find({
            completionStatus: { $in: ['not_started', 'in_progress'] }
        }).populate(['project', 'projectSite']);
        // Group by project/site
        const stakeholderByProjectSite = incompleteStakeholders.reduce((acc, sg) => {
            var _a;
            const key = `${sg.project._id}_${((_a = sg.projectSite) === null || _a === void 0 ? void 0 : _a._id) || 'null'}`;
            if (!acc[key]) {
                acc[key] = {
                    project: sg.project,
                    projectSite: sg.projectSite,
                    groups: []
                };
            }
            acc[key].groups.push(sg);
            return acc;
        }, {});
        for (const [, data] of Object.entries(stakeholderByProjectSite)) {
            const projectSiteData = data;
            const existingReview = yield review_model_1.default.findOne({
                entityType: 'stakeholder_mapping',
                project: projectSiteData.project._id,
                projectSite: ((_a = projectSiteData.projectSite) === null || _a === void 0 ? void 0 : _a._id) || null,
                status: { $nin: ['approved', 'rejected', 'cancelled'] }
            });
            if (!existingReview) {
                const completedGroups = projectSiteData.groups.filter((g) => g.completionStatus === 'completed').length;
                const progress = Math.round((completedGroups / projectSiteData.groups.length) * 100);
                reviewsToCreate.push({
                    entityType: 'stakeholder_mapping',
                    entityId: projectSiteData.project._id, // Use project ID as entity
                    project: projectSiteData.project._id,
                    projectSite: ((_b = projectSiteData.projectSite) === null || _b === void 0 ? void 0 : _b._id) || null,
                    organization: projectSiteData.project.organization,
                    title: `${((_c = projectSiteData.projectSite) === null || _c === void 0 ? void 0 : _c.name) || projectSiteData.project.name} - Stakeholder Mapping Review`,
                    description: `Review and approve stakeholder mapping completion`,
                    priority: progress < 50 ? 'high' : 'medium',
                    progress: progress,
                    completedTasks: completedGroups,
                    totalTasks: projectSiteData.groups.length,
                    dueDate: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)), // 14 days
                    creator: req.user._id
                });
            }
        }
        // Create reviews in batch
        const createdReviews = yield review_model_1.default.insertMany(reviewsToCreate);
        res.status(201).json({
            success: true,
            message: `Generated ${createdReviews.length} review items`,
            data: {
                created: createdReviews.length,
                projectSetups: reviewsToCreate.filter((r) => r.entityType === 'project_setup').length,
                siteSetups: reviewsToCreate.filter((r) => r.entityType === 'site_setup').length,
                consultationPlans: reviewsToCreate.filter((r) => r.entityType === 'consultation_plan').length,
                stakeholderMappings: reviewsToCreate.filter((r) => r.entityType === 'stakeholder_mapping').length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.generateReviews = generateReviews;
/**
 * Get project/site timeline for detail pages
 * @route GET /api/v1/admin/dashboard/timeline/:entityType/:entityId
 * @access Private (Admin only)
 */
const getEntityTimeline = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { entityType, entityId } = req.params;
        const timeline = [];
        if (entityType === 'project') {
            // Get project details
            const project = yield project_model_1.default.findById(entityId).populate('organization creator');
            if (!project) {
                const error = new Error('Project not found');
                error.statusCode = 404;
                throw error;
            }
            // Project creation
            timeline.push({
                id: `project_created_${project._id}`,
                type: 'project_created',
                title: 'Project Created',
                description: `Project "${project.name}" was created`,
                date: project.createdAt,
                user: ((_a = project.creator) === null || _a === void 0 ? void 0 : _a.name) || 'System',
                status: 'completed'
            });
            // Project setup milestones
            const projectSetup = yield projectSetupTask_model_1.default.findOne({ project: entityId });
            if (projectSetup) {
                timeline.push({
                    id: `setup_started_${project._id}`,
                    type: 'setup_started',
                    title: 'Setup Started',
                    description: 'Project setup was initialized',
                    date: projectSetup.createdAt,
                    status: 'completed'
                });
                if (projectSetup.isComplete) {
                    timeline.push({
                        id: `setup_completed_${project._id}`,
                        type: 'setup_completed',
                        title: 'Setup Completed',
                        description: 'All required project setup tasks completed',
                        date: projectSetup.completedAt,
                        status: 'completed'
                    });
                }
            }
            // Sites added
            const sites = yield projectSite_model_1.default.find({ project: entityId }).sort('createdAt');
            sites.forEach((site) => {
                timeline.push({
                    id: `site_added_${site._id}`,
                    type: 'site_added',
                    title: 'Site Added',
                    description: `Site "${site.name}" was added to the project`,
                    date: site.createdAt,
                    status: 'completed'
                });
            });
            // Theory of Change stages
            const tocStages = yield theoryOfChangeStage_model_1.default.find({ project: entityId }).sort('createdAt');
            tocStages.forEach((stage) => {
                timeline.push({
                    id: `toc_stage_${stage._id}`,
                    type: 'toc_stage_initialized',
                    title: `Theory of Change Stage ${stage.stageNumber}`,
                    description: `Stage ${stage.stageNumber} was initialized`,
                    date: stage.createdAt,
                    status: stage.status === 'completed' ? 'completed' : 'in_progress'
                });
                if (stage.completedAt) {
                    timeline.push({
                        id: `toc_completed_${stage._id}`,
                        type: 'toc_stage_completed',
                        title: `Stage ${stage.stageNumber} Completed`,
                        description: `Theory of Change Stage ${stage.stageNumber} was completed`,
                        date: stage.completedAt,
                        status: 'completed'
                    });
                }
            });
            // Reviews
            const reviews = yield review_model_1.default.find({ project: entityId }).sort('createdAt');
            reviews.forEach((review) => {
                timeline.push({
                    id: `review_${review._id}`,
                    type: 'review_created',
                    title: 'Review Created',
                    description: review.title,
                    date: review.createdAt,
                    status: review.status === 'approved' ? 'completed' : 'in_progress',
                    priority: review.priority
                });
                if (review.status === 'approved' && review.completedAt) {
                    timeline.push({
                        id: `review_approved_${review._id}`,
                        type: 'review_approved',
                        title: 'Review Approved',
                        description: `${review.title} was approved`,
                        date: review.completedAt,
                        status: 'completed'
                    });
                }
            });
        }
        else if (entityType === 'projectSite') {
            // Similar logic for project sites
            const site = yield projectSite_model_1.default.findById(entityId).populate('project');
            if (!site) {
                const error = new Error('Project site not found');
                error.statusCode = 404;
                throw error;
            }
            // Site creation
            timeline.push({
                id: `site_created_${site._id}`,
                type: 'site_created',
                title: 'Site Created',
                description: `Site "${site.name}" was created`,
                date: site.createdAt,
                status: 'completed'
            });
            // Site setup
            const siteSetup = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: entityId });
            if (siteSetup) {
                timeline.push({
                    id: `site_setup_started_${site._id}`,
                    type: 'setup_started',
                    title: 'Site Setup Started',
                    description: 'Site setup was initialized',
                    date: siteSetup.createdAt,
                    status: 'completed'
                });
                if (siteSetup.isComplete) {
                    timeline.push({
                        id: `site_setup_completed_${site._id}`,
                        type: 'setup_completed',
                        title: 'Site Setup Completed',
                        description: 'All required site setup tasks completed',
                        date: siteSetup.completedAt,
                        status: 'completed'
                    });
                }
            }
            // Consultation plan
            const consultationPlan = yield tocConsultationPlan_model_1.default.findOne({ projectSite: entityId });
            if (consultationPlan) {
                timeline.push({
                    id: `consultation_started_${site._id}`,
                    type: 'consultation_started',
                    title: 'Consultation Planning Started',
                    description: 'Consultation plan was created',
                    date: consultationPlan.createdAt,
                    status: consultationPlan.isCompleted ? 'completed' : 'in_progress'
                });
                if (consultationPlan.isCompleted) {
                    timeline.push({
                        id: `consultation_completed_${site._id}`,
                        type: 'consultation_completed',
                        title: 'Consultation Planning Completed',
                        description: 'Consultation plan was finalized',
                        date: consultationPlan.completedAt,
                        status: 'completed'
                    });
                }
            }
            // Stakeholder mapping
            const stakeholderGroups = yield stakeholderGroup_model_1.default.find({ projectSite: entityId }).sort('createdAt');
            if (stakeholderGroups.length > 0) {
                timeline.push({
                    id: `stakeholder_mapping_started_${site._id}`,
                    type: 'stakeholder_mapping_started',
                    title: 'Stakeholder Mapping Started',
                    description: `Stakeholder mapping initiated with ${stakeholderGroups.length} groups`,
                    date: stakeholderGroups[0].createdAt,
                    status: 'completed'
                });
                const completedGroups = stakeholderGroups.filter((g) => g.completionStatus === 'completed');
                if (completedGroups.length === stakeholderGroups.length) {
                    const latestCompletedDate = Math.max(...completedGroups.map((g) => g.updatedAt.getTime()));
                    timeline.push({
                        id: `stakeholder_mapping_completed_${site._id}`,
                        type: 'stakeholder_mapping_completed',
                        title: 'Stakeholder Mapping Completed',
                        description: 'All stakeholder groups completed',
                        date: new Date(latestCompletedDate),
                        status: 'completed'
                    });
                }
            }
        }
        // Sort timeline by date (newest first)
        timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        res.status(200).json({
            success: true,
            count: timeline.length,
            data: timeline
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getEntityTimeline = getEntityTimeline;
exports.default = {
    getDashboardOverview: exports.getDashboardOverview,
    getOrganizationsSummary: exports.getOrganizationsSummary,
    getReviewQueue: exports.getReviewQueue,
    generateReviews: exports.generateReviews,
    getEntityTimeline: exports.getEntityTimeline
};
//# sourceMappingURL=adminDashboard.controller.js.map