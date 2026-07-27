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
exports.archiveRisk = exports.getMyRisks = exports.addReviewComment = exports.updateMitigationAction = exports.addMitigationAction = exports.toggleCommentKeyInsight = exports.addComment = exports.updateRiskItem = exports.getRiskDetails = exports.createRiskItem = exports.getRiskRegisterSummary = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const riskRegister_model_1 = __importDefault(require("../models/riskRegister.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
// Helper function to check if user has access to risk register
const hasRiskRegisterAccess = (userRole) => {
    const allowedRoles = ['manager', 'projectCreator', 'organiser', 'reviewer'];
    return allowedRoles.includes(userRole);
};
// Helper function to get allowed risk types based on user role
const getAllowedRiskTypes = (userRole) => {
    const riskTypePermissions = {
        // ConnectGo staff roles - full access
        admin: [
            'operational', 'financial', 'strategic', 'compliance',
            'environmental', 'social', 'technical', 'reputational',
            'political', 'market', 'legal'
        ],
        owner: [
            'operational', 'financial', 'strategic', 'compliance',
            'environmental', 'social', 'technical', 'reputational',
            'political', 'market', 'legal'
        ],
        accountManager: [
            'operational', 'financial', 'strategic', 'compliance',
            'environmental', 'social', 'technical', 'reputational',
            'political', 'market', 'legal'
        ],
        // Client roles
        manager: [
            'operational', 'financial', 'strategic', 'compliance',
            'environmental', 'social', 'technical', 'reputational',
            'political', 'market', 'legal'
        ],
        projectCreator: [
            'operational', 'environmental', 'social', 'technical',
            'financial', 'market', 'reputational'
        ],
        organiser: [
            'operational', 'environmental', 'social', 'technical'
        ],
        reviewer: [], // Can view all but cannot create
    };
    return riskTypePermissions[userRole] || [];
};
// Helper function to check if user can create risks
const canCreateRisks = (userRole) => {
    return ['manager', 'projectCreator'].includes(userRole);
};
// Helper function to build user access filters for risks
const buildUserAccessFilters = (user) => {
    const filters = { archived: { $ne: true } };
    if (user.isConnectGoStaff) {
        return filters; // Admin can see all non-archived risks
    }
    if (user.primaryRole === 'manager') {
        // Managers can see risks for their organizations
        const accessibleOrganizations = user.roles
            .filter((r) => r.organization)
            .map((r) => r.organization);
        if (accessibleOrganizations.length > 0) {
            filters.organization = { $in: accessibleOrganizations };
        }
    }
    else if (user.primaryRole === 'projectCreator') {
        // Project creators can see risks for their assigned projects
        const accessibleProjects = user.roles
            .filter((r) => r.projects && r.projects.length > 0)
            .flatMap((r) => r.projects);
        if (accessibleProjects.length > 0) {
            filters.project = { $in: accessibleProjects };
        }
    }
    else if (user.primaryRole === 'organiser') {
        // Organisers can see risks for their assigned project sites
        const accessibleProjects = user.roles
            .filter((r) => r.projects && r.projects.length > 0)
            .flatMap((r) => r.projects);
        if (accessibleProjects.length > 0) {
            filters.$or = [
                { project: { $in: accessibleProjects } },
                { projectSite: { $exists: true, $ne: null } }
            ];
        }
    }
    else if (user.primaryRole === 'reviewer') {
        // Reviewers can see risks for projects they're reviewing
        const reviewProjects = user.roles
            .filter((r) => r.role === 'reviewer' && r.projects && r.projects.length > 0)
            .flatMap((r) => r.projects);
        if (reviewProjects.length > 0) {
            filters.project = { $in: reviewProjects };
        }
    }
    return filters;
};
// Helper function to get user-friendly risk source label
const getRiskSourceLabel = (source) => {
    const labels = {
        'manual': 'Manual Entry',
        'project_setup': 'Project Setup',
        'site_setup': 'Site Setup',
        'stakeholder_mapping': 'Stakeholder Mapping',
        'toc_stage1': 'Theory of Change - Stage 1',
        'toc_stage2': 'Theory of Change - Stage 2'
    };
    return labels[source] || source;
};
/**
 * Get risk register summary for dashboard
 * @route GET /api/v1/admin/dashboard/risks
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
const getRiskRegisterSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has access to risk register
        if (!req.user.isConnectGoStaff && !hasRiskRegisterAccess(req.user.primaryRole)) {
            const error = new Error('Access to risk register not permitted for your role');
            error.statusCode = 403;
            throw error;
        }
        // Build base filters based on user access
        const baseFilters = buildUserAccessFilters(req.user);
        // Add additional query filters
        const filters = Object.assign({}, baseFilters);
        if (req.query.projectId) {
            filters.project = new mongoose_1.default.Types.ObjectId(req.query.projectId);
        }
        if (req.query.projectSiteId) {
            filters.projectSite = new mongoose_1.default.Types.ObjectId(req.query.projectSiteId);
        }
        if (req.query.organizationId && req.user.isConnectGoStaff) {
            filters.organization = new mongoose_1.default.Types.ObjectId(req.query.organizationId);
        }
        if (req.query.riskScore)
            filters.riskScore = req.query.riskScore;
        if (req.query.riskType)
            filters.riskType = req.query.riskType;
        if (req.query.status)
            filters.status = req.query.status;
        if (req.query.riskSource)
            filters.riskSource = req.query.riskSource;
        if (req.query.owner) {
            filters.owner = new mongoose_1.default.Types.ObjectId(req.query.owner);
        }
        // Add review date range filters
        if (req.query.reviewDateFrom || req.query.reviewDateTo) {
            filters.reviewDate = {};
            if (req.query.reviewDateFrom) {
                filters.reviewDate.$gte = new Date(req.query.reviewDateFrom);
            }
            if (req.query.reviewDateTo) {
                // Add one day to include the entire end date
                const endDate = new Date(req.query.reviewDateTo);
                endDate.setDate(endDate.getDate() + 1);
                filters.reviewDate.$lt = endDate;
            }
        }
        // Get risks with aggregation
        const riskSummary = yield riskRegister_model_1.default.aggregate([
            { $match: filters },
            {
                $lookup: {
                    from: "projects",
                    localField: "project",
                    foreignField: "_id",
                    as: "projectInfo"
                }
            },
            {
                $lookup: {
                    from: "projectsites",
                    localField: "projectSite",
                    foreignField: "_id",
                    as: "siteInfo"
                }
            },
            {
                $lookup: {
                    from: "organizations",
                    localField: "organization",
                    foreignField: "_id",
                    as: "orgInfo"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "ownerInfo"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "comments.author",
                    foreignField: "_id",
                    as: "commentAuthors"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "comments.starredBy",
                    foreignField: "_id",
                    as: "commentStarredBy"
                }
            },
            {
                $addFields: {
                    isReviewOverdue: {
                        $and: [
                            { $lt: ["$reviewDate", new Date()] },
                            { $eq: ["$status", "open"] }
                        ]
                    },
                    daysUntilReview: {
                        $divide: [{ $subtract: ["$reviewDate", new Date()] }, 86400000]
                    },
                    // Map comment authors and starredBy to comments
                    comments: {
                        $map: {
                            input: "$comments",
                            as: "comment",
                            in: {
                                _id: "$$comment._id",
                                text: "$$comment.text",
                                isKeyInsight: "$$comment.isKeyInsight",
                                starredAt: "$$comment.starredAt",
                                createdAt: "$$comment.createdAt",
                                author: {
                                    $let: {
                                        vars: {
                                            authorMatch: {
                                                $arrayElemAt: [
                                                    {
                                                        $filter: {
                                                            input: "$commentAuthors",
                                                            as: "ca",
                                                            cond: { $eq: ["$$ca._id", "$$comment.author"] }
                                                        }
                                                    },
                                                    0
                                                ]
                                            }
                                        },
                                        in: {
                                            _id: "$$authorMatch._id",
                                            name: "$$authorMatch.name",
                                            email: "$$authorMatch.email"
                                        }
                                    }
                                },
                                starredBy: {
                                    $cond: {
                                        if: { $ifNull: ["$$comment.starredBy", false] },
                                        then: {
                                            $let: {
                                                vars: {
                                                    starredMatch: {
                                                        $arrayElemAt: [
                                                            {
                                                                $filter: {
                                                                    input: "$commentStarredBy",
                                                                    as: "csb",
                                                                    cond: { $eq: ["$$csb._id", "$$comment.starredBy"] }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    }
                                                },
                                                in: {
                                                    _id: "$$starredMatch._id",
                                                    name: "$$starredMatch.name",
                                                    email: "$$starredMatch.email"
                                                }
                                            }
                                        },
                                        else: null
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    riskType: 1,
                    riskDescription: 1,
                    riskSource: 1,
                    sourceReference: 1,
                    probability: 1,
                    consequences: 1,
                    riskScore: 1,
                    status: 1,
                    category: 1,
                    impactArea: 1,
                    identifiedDate: 1,
                    reviewDate: 1,
                    isReviewOverdue: 1,
                    daysUntilReview: 1,
                    mitigationStrategy: 1,
                    comments: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    project: {
                        _id: { $first: "$projectInfo._id" },
                        name: { $first: "$projectInfo.name" }
                    },
                    projectSite: {
                        _id: { $first: "$siteInfo._id" },
                        name: { $first: "$siteInfo.name" }
                    },
                    organization: {
                        _id: { $first: "$orgInfo._id" },
                        name: { $first: "$orgInfo.name" }
                    },
                    owner: {
                        _id: { $first: "$ownerInfo._id" },
                        name: { $first: "$ownerInfo.name" },
                        email: { $first: "$ownerInfo.email" }
                    }
                }
            },
            { $sort: { riskScore: -1, identifiedDate: -1 } }
        ]);
        // Calculate summary statistics
        const stats = {
            total: riskSummary.length,
            byScore: {
                high: riskSummary.filter(r => r.riskScore === 'high').length,
                medium: riskSummary.filter(r => r.riskScore === 'medium').length,
                low: riskSummary.filter(r => r.riskScore === 'low').length
            },
            byStatus: {
                open: riskSummary.filter(r => r.status === 'open').length,
                monitoring: riskSummary.filter(r => r.status === 'monitoring').length,
                closed: riskSummary.filter(r => r.status === 'closed').length,
                transferred: riskSummary.filter(r => r.status === 'transferred').length
            },
            byType: riskSummary.reduce((acc, risk) => {
                acc[risk.riskType] = (acc[risk.riskType] || 0) + 1;
                return acc;
            }, {}),
            bySource: riskSummary.reduce((acc, risk) => {
                acc[risk.riskSource] = (acc[risk.riskSource] || 0) + 1;
                return acc;
            }, {}),
            reviewOverdue: riskSummary.filter(r => r.isReviewOverdue).length,
            dueForReviewSoon: riskSummary.filter(r => r.daysUntilReview <= 7 && r.daysUntilReview > 0).length
        };
        res.status(200).json({
            success: true,
            data: {
                stats,
                risks: riskSummary
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getRiskRegisterSummary = getRiskRegisterSummary;
/**
 * Create new risk item
 * @route POST /api/v1/admin/dashboard/risks
 * @access Private (Manager, ProjectCreator only)
 */
const createRiskItem = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user can create risks
        if (!req.user.isConnectGoStaff && !canCreateRisks(req.user.primaryRole)) {
            const error = new Error('Risk creation not permitted for your role');
            error.statusCode = 403;
            throw error;
        }
        const { projectId, projectSiteId, organizationId, name, riskType, riskDescription, riskSource = 'manual', sourceReference, probability, consequences, owner, mitigationStrategy, category = 'current', impactArea = [], reviewDate, reviewFrequency = 'quarterly', comment // ✅ NEW: Single initial comment instead of notes
         } = req.body;
        // Validate required fields
        if (!projectId || !organizationId || !name || !riskType || !riskDescription ||
            !probability || !consequences || !owner || !mitigationStrategy || !reviewDate) {
            const error = new Error('Missing required fields. Review date is mandatory for all risks.');
            error.statusCode = 400;
            throw error;
        }
        // Validate riskSource
        const validRiskSources = ['manual', 'project_setup', 'site_setup', 'stakeholder_mapping', 'toc_stage1', 'toc_stage2'];
        if (!validRiskSources.includes(riskSource)) {
            const error = new Error(`Invalid risk source. Must be one of: ${validRiskSources.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }
        // Check if user can create this risk type
        const allowedRiskTypes = getAllowedRiskTypes(req.user.primaryRole);
        if (!req.user.isConnectGoStaff && !allowedRiskTypes.includes(riskType)) {
            const error = new Error(`Risk type '${riskType}' not permitted for your role`);
            error.statusCode = 403;
            throw error;
        }
        // Verify project exists and user has access
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check project access based on user role
        if (!req.user.isConnectGoStaff) {
            let hasAccess = false;
            if (req.user.primaryRole === 'manager') {
                // Managers can create risks for projects in their organizations
                const userOrganizations = req.user.roles
                    .filter(r => r.organization)
                    .map(r => { var _a; return (_a = r.organization) === null || _a === void 0 ? void 0 : _a.toString(); });
                hasAccess = userOrganizations.includes(project.organization.toString());
            }
            else if (req.user.primaryRole === 'projectCreator') {
                // Project creators can create risks for their assigned projects
                const userProjects = req.user.roles
                    .filter(r => r.projects && r.projects.length > 0)
                    .flatMap(r => r.projects)
                    .map(p => p === null || p === void 0 ? void 0 : p.toString());
                hasAccess = userProjects.includes(projectId);
            }
            if (!hasAccess) {
                const error = new Error('Not authorized to create risks for this project');
                error.statusCode = 403;
                throw error;
            }
        }
        // Verify project site exists and belongs to project (if provided)
        if (projectSiteId) {
            const projectSite = yield projectSite_model_1.default.findById(projectSiteId);
            if (!projectSite) {
                const error = new Error('Project site not found');
                error.statusCode = 404;
                throw error;
            }
            if (projectSite.project.toString() !== projectId) {
                const error = new Error('Project site does not belong to this project');
                error.statusCode = 400;
                throw error;
            }
        }
        // Calculate risk score
        const calculateRiskScore = (probability, consequences) => {
            const probabilityValues = {
                'very_low': 1, 'low': 2, 'medium': 3, 'high': 4, 'very_high': 5
            };
            const consequenceValues = {
                'negligible': 1, 'minor': 2, 'moderate': 3, 'major': 4, 'catastrophic': 5
            };
            const probValue = probabilityValues[probability] || 3;
            const consValue = consequenceValues[consequences] || 3;
            const score = probValue * consValue;
            if (score <= 6)
                return 'low';
            if (score <= 15)
                return 'medium';
            return 'high';
        };
        const riskScore = calculateRiskScore(probability, consequences);
        // Validate owner is a valid ObjectId
        if (!mongoose_1.default.Types.ObjectId.isValid(owner)) {
            const error = new Error('Owner must be a valid user ID');
            error.statusCode = 400;
            throw error;
        }
        // ✅ NEW: Prepare comments array with initial comment if provided
        const comments = [];
        if (comment && comment.trim()) {
            comments.push({
                text: comment.trim(),
                author: req.user._id,
                createdAt: new Date()
            });
        }
        // Create risk item
        const riskItem = new riskRegister_model_1.default({
            project: projectId,
            projectSite: projectSiteId || null,
            organization: organizationId,
            name,
            riskType,
            riskDescription,
            riskSource,
            sourceReference: sourceReference || undefined,
            probability,
            consequences,
            riskScore,
            owner,
            mitigationStrategy,
            category,
            impactArea,
            reviewDate: new Date(reviewDate),
            reviewFrequency, // ✅ ADD THIS LINE
            comments, // ✅ NEW: Add comments array
            creator: req.user._id,
            lastUpdatedBy: req.user._id
        });
        yield riskItem.save();
        // Populate the response
        yield riskItem.populate([
            { path: 'project', select: 'name status' },
            { path: 'projectSite', select: 'name status' },
            { path: 'organization', select: 'name country city' },
            { path: 'owner', select: 'name email' },
            { path: 'creator', select: 'name email' },
            { path: 'comments.author', select: 'name email' }
        ]);
        res.status(201).json({
            success: true,
            message: 'Risk item created successfully',
            data: riskItem
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createRiskItem = createRiskItem;
/**
 * Get detailed risk information
 * @route GET /api/v1/admin/dashboard/risks/:riskId
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
const getRiskDetails = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has access to risk register
        if (!req.user.isConnectGoStaff && !hasRiskRegisterAccess(req.user.primaryRole)) {
            const error = new Error('Access to risk register not permitted for your role');
            error.statusCode = 403;
            throw error;
        }
        const { riskId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(riskId)) {
            const error = new Error('Invalid risk ID format');
            error.statusCode = 400;
            throw error;
        }
        // Build access filters and find the risk
        const accessFilters = buildUserAccessFilters(req.user);
        const risk = yield riskRegister_model_1.default.findOne(Object.assign({ _id: riskId }, accessFilters))
            .populate('project', 'name status')
            .populate('projectSite', 'name status')
            .populate('organization', 'name country city')
            .populate('owner', 'name email')
            .populate('creator', 'name email')
            .populate('lastUpdatedBy', 'name email')
            .populate('mitigationActions.responsible', 'name email')
            .populate('riskHistory.updatedBy', 'name email')
            .populate('comments.author', 'name email')
            .populate('comments.starredBy', 'name email'); // ✅ NEW: Populate starredBy
        if (!risk) {
            const error = new Error('Risk not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        // Add calculated fields
        const riskWithCalculations = Object.assign(Object.assign({}, risk.toObject()), { riskSourceLabel: getRiskSourceLabel(risk.riskSource), isReviewOverdue: risk.reviewDate < new Date() && risk.status === 'open', daysUntilReview: Math.ceil((risk.reviewDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)), mitigationProgress: risk.mitigationActions.length > 0 ?
                Math.round((risk.mitigationActions.filter(a => a.status === 'completed').length / risk.mitigationActions.length) * 100) : 0 });
        res.status(200).json({
            success: true,
            data: riskWithCalculations
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getRiskDetails = getRiskDetails;
/**
 * Update risk item
 * @route PUT /api/v1/admin/dashboard/risks/:riskId
 * @access Private (Manager, ProjectCreator, Risk Owner)
 */
const updateRiskItem = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { riskId } = req.params;
        const updateData = req.body;
        // Build access filters
        const accessFilters = buildUserAccessFilters(req.user);
        const risk = yield riskRegister_model_1.default.findOne(Object.assign({ _id: riskId }, accessFilters));
        if (!risk) {
            const error = new Error('Risk not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        // Check if user can update this risk
        const canUpdate = req.user.isConnectGoStaff ||
            ['manager', 'projectCreator'].includes(req.user.primaryRole) ||
            risk.owner.toString() === req.user._id.toString();
        if (!canUpdate) {
            const error = new Error('Not authorized to update this risk');
            error.statusCode = 403;
            throw error;
        }
        // If updating risk type, check permissions
        if (updateData.riskType && !req.user.isConnectGoStaff) {
            const allowedRiskTypes = getAllowedRiskTypes(req.user.primaryRole);
            if (!allowedRiskTypes.includes(updateData.riskType)) {
                const error = new Error(`Risk type '${updateData.riskType}' not permitted for your role`);
                error.statusCode = 403;
                throw error;
            }
        }
        // Validate riskSource if provided
        if (updateData.riskSource) {
            const validRiskSources = ['manual', 'project_setup', 'site_setup', 'stakeholder_mapping', 'toc_stage1', 'toc_stage2'];
            if (!validRiskSources.includes(updateData.riskSource)) {
                const error = new Error(`Invalid risk source. Must be one of: ${validRiskSources.join(', ')}`);
                error.statusCode = 400;
                throw error;
            }
        }
        // Update allowed fields
        const fieldsToUpdate = [
            'name', 'riskType', 'riskDescription', 'riskSource', 'sourceReference',
            'probability', 'consequences', 'owner', 'mitigationStrategy', 'category',
            'impactArea', 'reviewDate', 'reviewFrequency', 'status', 'mitigationActions'
        ];
        fieldsToUpdate.forEach(field => {
            if (updateData[field] !== undefined) {
                risk[field] = updateData[field];
            }
        });
        if (updateData.reviewDate) {
            risk.reviewDate = new Date(updateData.reviewDate);
        }
        risk.lastUpdatedBy = req.user._id;
        yield risk.save();
        yield risk.populate([
            'project',
            'projectSite',
            'organization',
            'owner',
            'lastUpdatedBy',
            'comments.author' // ✅ NEW: Populate comment authors
        ]);
        res.status(200).json({
            success: true,
            message: 'Risk updated successfully',
            data: risk
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateRiskItem = updateRiskItem;
/**
 * ✅ NEW: Add comment to risk
 * @route POST /api/v1/admin/dashboard/risks/:riskId/comments
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer, Risk Owner)
 */
const addComment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { riskId } = req.params;
        const { text } = req.body;
        if (!text || !text.trim()) {
            const error = new Error('Comment text is required');
            error.statusCode = 400;
            throw error;
        }
        const accessFilters = buildUserAccessFilters(req.user);
        const risk = yield riskRegister_model_1.default.findOne(Object.assign({ _id: riskId }, accessFilters));
        if (!risk) {
            const error = new Error('Risk not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        // Anyone with access to view the risk can add comments
        // ✅ FIXED: Added isKeyInsight field
        const newComment = {
            text: text.trim(),
            author: req.user._id,
            isKeyInsight: false, // ✅ NEW: Default to false, can be starred later
            createdAt: new Date()
        };
        risk.comments.push(newComment);
        risk.lastUpdatedBy = req.user._id;
        yield risk.save();
        yield risk.populate('comments.author', 'name email');
        // Get the newly added comment
        const addedComment = risk.comments[risk.comments.length - 1];
        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            data: addedComment
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addComment = addComment;
/**
 * ✅ NEW: Toggle comment as key insight
 * @route PUT /api/v1/admin/dashboard/risks/:riskId/comments/:commentId/star
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
const toggleCommentKeyInsight = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { riskId, commentId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(riskId) || !mongoose_1.default.Types.ObjectId.isValid(commentId)) {
            const error = new Error('Invalid risk ID or comment ID format');
            error.statusCode = 400;
            throw error;
        }
        const accessFilters = buildUserAccessFilters(req.user);
        const risk = yield riskRegister_model_1.default.findOne(Object.assign({ _id: riskId }, accessFilters));
        if (!risk) {
            const error = new Error('Risk not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        // Find the comment
        const comment = risk.comments.find((c) => c._id.toString() === commentId);
        if (!comment) {
            const error = new Error('Comment not found');
            error.statusCode = 404;
            throw error;
        }
        // Toggle the key insight status
        comment.isKeyInsight = !comment.isKeyInsight;
        if (comment.isKeyInsight) {
            // Starring the comment
            comment.starredBy = req.user._id;
            comment.starredAt = new Date();
        }
        else {
            // Unstarring the comment
            comment.starredBy = undefined;
            comment.starredAt = undefined;
        }
        risk.lastUpdatedBy = req.user._id;
        yield risk.save();
        yield risk.populate('comments.author', 'name email');
        yield risk.populate('comments.starredBy', 'name email');
        res.status(200).json({
            success: true,
            message: comment.isKeyInsight ? 'Comment marked as key insight' : 'Comment unmarked as key insight',
            data: {
                comment,
                isKeyInsight: comment.isKeyInsight
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.toggleCommentKeyInsight = toggleCommentKeyInsight;
/**
 * Add mitigation action to risk
 * @route POST /api/v1/admin/dashboard/risks/:riskId/mitigation-actions
 * @access Private (Manager, ProjectCreator, Risk Owner)
 */
const addMitigationAction = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { riskId } = req.params;
        const { action, responsible, dueDate, notes } = req.body;
        if (!action) {
            const error = new Error('Action description is required');
            error.statusCode = 400;
            throw error;
        }
        const accessFilters = buildUserAccessFilters(req.user);
        const risk = yield riskRegister_model_1.default.findOne(Object.assign({ _id: riskId }, accessFilters));
        if (!risk) {
            const error = new Error('Risk not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        // Check if user can add mitigation actions
        const canAddActions = req.user.isConnectGoStaff ||
            ['manager', 'projectCreator'].includes(req.user.primaryRole) ||
            risk.owner.toString() === req.user._id.toString();
        if (!canAddActions) {
            const error = new Error('Not authorized to add mitigation actions to this risk');
            error.statusCode = 403;
            throw error;
        }
        risk.mitigationActions.push({
            action,
            responsible: responsible || undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            status: 'not_started',
            notes: notes || ''
        });
        risk.lastUpdatedBy = req.user._id;
        yield risk.save();
        res.status(201).json({
            success: true,
            message: 'Mitigation action added successfully',
            data: {
                action: risk.mitigationActions[risk.mitigationActions.length - 1],
                totalActions: risk.mitigationActions.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addMitigationAction = addMitigationAction;
/**
 * Update mitigation action status
 * @route PUT /api/v1/admin/dashboard/risks/:riskId/mitigation-actions/:actionId
 * @access Private (Manager, ProjectCreator, Risk Owner, Action Responsible)
 */
const updateMitigationAction = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { riskId, actionId } = req.params;
        const { status, notes } = req.body;
        const accessFilters = buildUserAccessFilters(req.user);
        const risk = yield riskRegister_model_1.default.findOne(Object.assign({ _id: riskId }, accessFilters));
        if (!risk) {
            const error = new Error('Risk not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        const action = risk.mitigationActions.find((a) => a._id.toString() === actionId);
        if (!action) {
            const error = new Error('Mitigation action not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user can update this action
        const canUpdateAction = req.user.isConnectGoStaff ||
            ['manager', 'projectCreator'].includes(req.user.primaryRole) ||
            risk.owner.toString() === req.user._id.toString() ||
            (action.responsible && action.responsible.toString() === req.user._id.toString());
        if (!canUpdateAction) {
            const error = new Error('Not authorized to update this mitigation action');
            error.statusCode = 403;
            throw error;
        }
        // Update action
        if (status)
            action.status = status;
        if (notes !== undefined)
            action.notes = notes;
        if (status === 'completed') {
            action.completedAt = new Date();
        }
        risk.lastUpdatedBy = req.user._id;
        yield risk.save();
        res.status(200).json({
            success: true,
            message: 'Mitigation action updated successfully',
            data: action
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateMitigationAction = updateMitigationAction;
/**
 * Add review comment to risk (Reviewer specific functionality)
 * @route POST /api/v1/admin/dashboard/risks/:riskId/review-comments
 * @access Private (Reviewer, Manager, Admin)
 * @deprecated Use addComment endpoint instead
 */
const addReviewComment = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { riskId } = req.params;
        const { comment } = req.body;
        if (!comment) {
            const error = new Error('Comment is required');
            error.statusCode = 400;
            throw error;
        }
        // Only reviewers, managers and admins can add review comments
        const canAddComment = req.user.isConnectGoStaff ||
            ['manager', 'reviewer'].includes(req.user.primaryRole);
        if (!canAddComment) {
            const error = new Error('Not authorized to add review comments');
            error.statusCode = 403;
            throw error;
        }
        const accessFilters = buildUserAccessFilters(req.user);
        const risk = yield riskRegister_model_1.default.findOne(Object.assign({ _id: riskId }, accessFilters));
        if (!risk) {
            const error = new Error('Risk not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        // ✅ UPDATED: Use new comment system
        const reviewComment = {
            text: `[REVIEW] ${comment.trim()}`,
            author: req.user._id,
            isKeyInsight: false,
            createdAt: new Date()
        };
        risk.comments.push(reviewComment);
        risk.lastUpdatedBy = req.user._id;
        yield risk.save();
        yield risk.populate('comments.author', 'name email');
        const addedComment = risk.comments[risk.comments.length - 1];
        res.status(201).json({
            success: true,
            message: 'Review comment added successfully',
            data: addedComment
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addReviewComment = addReviewComment;
/**
 * Get risks assigned to current user
 * @route GET /api/v1/dashboard/my-risks
 * @access Private (All authenticated users with risk access)
 */
const getMyRisks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff && !hasRiskRegisterAccess(req.user.primaryRole)) {
            const error = new Error('Access to risk register not permitted for your role');
            error.statusCode = 403;
            throw error;
        }
        // Find risks where user is owner or responsible for mitigation actions
        const baseFilters = buildUserAccessFilters(req.user);
        const myRisks = yield riskRegister_model_1.default.find(Object.assign(Object.assign({}, baseFilters), { $or: [
                { owner: req.user._id },
                { 'mitigationActions.responsible': req.user._id }
            ] }))
            .populate('project', 'name status')
            .populate('projectSite', 'name status')
            .populate('organization', 'name country city')
            .populate('owner', 'name email')
            .populate('comments.author', 'name email')
            .populate('comments.starredBy', 'name email'); // ✅ NEW: Populate starredBy
        // Calculate user-specific statistics
        const stats = {
            total: myRisks.length,
            asOwner: myRisks.filter(r => r.owner._id.toString() === req.user._id.toString()).length,
            byScore: {
                high: myRisks.filter(r => r.riskScore === 'high').length,
                medium: myRisks.filter(r => r.riskScore === 'medium').length,
                low: myRisks.filter(r => r.riskScore === 'low').length
            },
            byStatus: {
                open: myRisks.filter(r => r.status === 'open').length,
                monitoring: myRisks.filter(r => r.status === 'monitoring').length,
                closed: myRisks.filter(r => r.status === 'closed').length
            },
            bySource: myRisks.reduce((acc, risk) => {
                acc[risk.riskSource] = (acc[risk.riskSource] || 0) + 1;
                return acc;
            }, {}),
            overdue: myRisks.filter(r => r.reviewDate < new Date() && r.status === 'open').length
        };
        res.status(200).json({
            success: true,
            data: {
                stats,
                risks: myRisks
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyRisks = getMyRisks;
/**
 * Archive/Delete risk (Admin and Manager only)
 * @route DELETE /api/v1/admin/dashboard/risks/:riskId
 * @access Private (Admin, Manager only)
 */
const archiveRisk = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Only admins and managers can archive risks
        if (!req.user.isConnectGoStaff && req.user.primaryRole !== 'manager') {
            const error = new Error('Not authorized to archive risks');
            error.statusCode = 403;
            throw error;
        }
        const { riskId } = req.params;
        const accessFilters = buildUserAccessFilters(req.user);
        const risk = yield riskRegister_model_1.default.findOne(Object.assign({ _id: riskId }, accessFilters));
        if (!risk) {
            const error = new Error('Risk not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        // Archive the risk instead of deleting
        risk.archived = true;
        risk.archivedAt = new Date();
        risk.lastUpdatedBy = req.user._id;
        yield risk.save();
        res.status(200).json({
            success: true,
            message: 'Risk archived successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
exports.archiveRisk = archiveRisk;
exports.default = {
    getRiskRegisterSummary: exports.getRiskRegisterSummary,
    createRiskItem: exports.createRiskItem,
    getRiskDetails: exports.getRiskDetails,
    updateRiskItem: exports.updateRiskItem,
    addComment: exports.addComment,
    toggleCommentKeyInsight: exports.toggleCommentKeyInsight, // ✅ NEW
    addMitigationAction: // ✅ NEW
    exports.addMitigationAction,
    updateMitigationAction: exports.updateMitigationAction,
    addReviewComment: exports.addReviewComment,
    getMyRisks: exports.getMyRisks,
    archiveRisk: exports.archiveRisk
};
//# sourceMappingURL=riskManagement.controller.js.map