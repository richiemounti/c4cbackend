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
exports.getSiteSetupTasks = exports.getProjectSetupTasks = exports.getProjectSiteDetailForDashboard = exports.getProjectDetailForDashboard = void 0;
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const projectSetupTask_model_1 = __importDefault(require("../models/projectSetupTask.model"));
const projectSiteSetupTask_model_1 = __importDefault(require("../models/projectSiteSetupTask.model"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const theoryOfChangeStage_model_1 = __importDefault(require("../models/theoryOfChangeStage.model"));
const tocConsultationPlan_model_1 = __importDefault(require("../models/tocConsultationPlan.model"));
const review_model_1 = __importDefault(require("../models/review.model"));
const riskRegister_model_1 = __importDefault(require("../models/riskRegister.model"));
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Get comprehensive project details for dashboard
 * @route GET /api/v1/admin/dashboard/project/:projectId/detail
 * @access Private (Admin only)
 */
const getProjectDetailForDashboard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        // Get project with all related data
        const [project, projectSetup, sites, tocStages, stakeholderGroups, reviews, risks] = yield Promise.all([
            project_model_1.default.findById(projectId).populate(['organization', 'creator']),
            projectSetupTask_model_1.default.findOne({ project: projectId }),
            projectSite_model_1.default.find({ project: projectId, archived: { $ne: true } }),
            theoryOfChangeStage_model_1.default.find({ project: projectId, projectSite: null }).sort('stageNumber'),
            stakeholderGroup_model_1.default.find({ project: projectId, projectSite: null }).populate('category'),
            review_model_1.default.find({ project: projectId }).sort('-createdAt').limit(10),
            riskRegister_model_1.default.find({ project: projectId, archived: { $ne: true } }).sort('-createdAt').limit(10)
        ]);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Get site details with their setups
        const siteDetails = yield Promise.all(sites.map((site) => __awaiter(void 0, void 0, void 0, function* () {
            const [siteSetup, siteStakeholders, siteConsultationPlan] = yield Promise.all([
                projectSiteSetupTask_model_1.default.findOne({ projectSite: site._id }),
                stakeholderGroup_model_1.default.find({ projectSite: site._id }).populate('category'),
                tocConsultationPlan_model_1.default.findOne({ projectSite: site._id })
            ]);
            // Calculate consultation plan progress with virtual field access
            let consultationProgress = 0;
            let consultationComplete = false;
            if (siteConsultationPlan) {
                // Access virtual field safely
                const planDoc = siteConsultationPlan;
                consultationProgress = planDoc.completionPercentage || 0;
                consultationComplete = siteConsultationPlan.isCompleted;
            }
            return {
                _id: site._id,
                name: site.name,
                description: site.description,
                location: `${site.city || ''}, ${site.country || ''}`.trim().replace(/^,\s*/, ''),
                status: site.status,
                siteType: site.siteType,
                size: site.size,
                sizeUnit: site.sizeUnit,
                setupProgress: (siteSetup === null || siteSetup === void 0 ? void 0 : siteSetup.progress) || 0,
                setupComplete: (siteSetup === null || siteSetup === void 0 ? void 0 : siteSetup.isComplete) || false,
                stakeholderCount: siteStakeholders.length,
                completedStakeholders: siteStakeholders.filter((s) => s.completionStatus === 'completed').length,
                consultationPlanComplete: consultationComplete,
                consultationPlanProgress: consultationProgress,
                lastActivity: site.updatedAt
            };
        })));
        // Calculate overall project progress
        const setupProgress = projectSetup ? projectSetup.progress : 0;
        const sitesProgress = siteDetails.length > 0 ?
            siteDetails.reduce((sum, site) => sum + site.setupProgress, 0) / siteDetails.length : 0;
        const tocProgress = tocStages.length > 0 ?
            tocStages.reduce((sum, stage) => sum + stage.progress, 0) / tocStages.length : 0;
        const overallProgress = Math.round((setupProgress * 0.3) + (sitesProgress * 0.4) + (tocProgress * 0.3));
        // Determine project stage
        let projectStage = 'onboarding';
        if (projectSetup === null || projectSetup === void 0 ? void 0 : projectSetup.isComplete) {
            if (tocStages.length > 0) {
                if (project.status === 'active') {
                    projectStage = 'measure';
                }
                else if (project.status === 'completed') {
                    projectStage = 'learn';
                }
                else {
                    projectStage = 'design';
                }
            }
            else {
                projectStage = 'design';
            }
        }
        const projectDetail = {
            // Basic project info
            _id: project._id,
            name: project.name,
            description: project.description,
            location: project.location,
            status: project.status,
            stage: projectStage,
            startDate: project.startDate,
            endDate: project.endDate,
            progress: overallProgress,
            // Organization info
            organization: {
                _id: project.organization._id,
                name: project.organization.name,
                country: project.organization.country,
                city: project.organization.city
            },
            // Setup info
            setup: {
                progress: setupProgress,
                isComplete: (projectSetup === null || projectSetup === void 0 ? void 0 : projectSetup.isComplete) || false,
                completedTasks: (projectSetup === null || projectSetup === void 0 ? void 0 : projectSetup.tasks.filter((t) => t.isCompleted).length) || 0,
                totalTasks: (projectSetup === null || projectSetup === void 0 ? void 0 : projectSetup.tasks.filter((t) => t.isRequired).length) || 0,
                lastUpdated: projectSetup === null || projectSetup === void 0 ? void 0 : projectSetup.updatedAt
            },
            // Sites summary
            sites: {
                total: siteDetails.length,
                summary: siteDetails,
                averageProgress: sitesProgress
            },
            // Theory of Change
            theoryOfChange: {
                stages: tocStages.map((stage) => ({
                    _id: stage._id,
                    stageNumber: stage.stageNumber,
                    status: stage.status,
                    progress: stage.progress,
                    completedAt: stage.completedAt
                })),
                averageProgress: tocProgress
            },
            // Stakeholder mapping (project level)
            stakeholderMapping: {
                total: stakeholderGroups.length,
                completed: stakeholderGroups.filter((s) => s.completionStatus === 'completed').length,
                inProgress: stakeholderGroups.filter((s) => s.completionStatus === 'in_progress').length,
                notStarted: stakeholderGroups.filter((s) => s.completionStatus === 'not_started').length
            },
            // Recent reviews
            recentReviews: reviews.map((review) => ({
                _id: review._id,
                title: review.title,
                status: review.status,
                priority: review.priority,
                progress: review.progress,
                dueDate: review.dueDate,
                isOverdue: review.dueDate && review.dueDate < new Date(),
                createdAt: review.createdAt
            })),
            // Risk summary
            risks: {
                total: risks.length,
                high: risks.filter((r) => r.riskScore === 'high').length,
                medium: risks.filter((r) => r.riskScore === 'medium').length,
                low: risks.filter((r) => r.riskScore === 'low').length,
                recent: risks.slice(0, 5).map((risk) => ({
                    _id: risk._id,
                    name: risk.name,
                    riskType: risk.riskType,
                    riskScore: risk.riskScore,
                    status: risk.status,
                    owner: risk.owner,
                    createdAt: risk.createdAt
                }))
            },
            // Metadata
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            creator: ((_a = project.creator) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown'
        };
        res.status(200).json({
            success: true,
            data: projectDetail
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectDetailForDashboard = getProjectDetailForDashboard;
/**
 * Get comprehensive project site details for dashboard
 * @route GET /api/v1/admin/dashboard/project-site/:siteId/detail
 * @access Private (Admin only)
 */
const getProjectSiteDetailForDashboard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { siteId } = req.params;
        // Get site with all related data
        const [site, siteSetup, consultationPlan, tocStages, stakeholderGroups, reviews, risks] = yield Promise.all([
            projectSite_model_1.default.findById(siteId).populate('project'),
            projectSiteSetupTask_model_1.default.findOne({ projectSite: siteId }),
            tocConsultationPlan_model_1.default.findOne({ projectSite: siteId }),
            theoryOfChangeStage_model_1.default.find({ projectSite: siteId }).sort('stageNumber'),
            stakeholderGroup_model_1.default.find({ projectSite: siteId }).populate('category'),
            review_model_1.default.find({ projectSite: siteId }).sort('-createdAt').limit(10),
            riskRegister_model_1.default.find({ projectSite: siteId, archived: { $ne: true } }).sort('-createdAt').limit(10)
        ]);
        if (!site) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        // Calculate consultation progress safely
        let consultationProgress = 0;
        if (consultationPlan) {
            const planDoc = consultationPlan;
            consultationProgress = planDoc.completionPercentage || 0;
        }
        // Calculate overall site progress
        const setupProgress = siteSetup ? siteSetup.progress : 0;
        const stakeholderProgress = stakeholderGroups.length > 0 ?
            (stakeholderGroups.filter((s) => s.completionStatus === 'completed').length / stakeholderGroups.length) * 100 : 0;
        const tocProgress = tocStages.length > 0 ?
            tocStages.reduce((sum, stage) => sum + stage.progress, 0) / tocStages.length : 0;
        const overallProgress = Math.round((setupProgress * 0.25) +
            (consultationProgress * 0.25) +
            (stakeholderProgress * 0.25) +
            (tocProgress * 0.25));
        // Determine site stage
        let siteStage = 'onboarding';
        if (siteSetup === null || siteSetup === void 0 ? void 0 : siteSetup.isComplete) {
            if (consultationPlan === null || consultationPlan === void 0 ? void 0 : consultationPlan.isCompleted) {
                if (tocStages.length > 0) {
                    if (site.status === 'active') {
                        siteStage = 'measure';
                    }
                    else {
                        siteStage = 'design';
                    }
                }
                else {
                    siteStage = 'design';
                }
            }
            else {
                siteStage = 'design';
            }
        }
        // Build stakeholder breakdown by category
        const stakeholderByCategory = stakeholderGroups.reduce((acc, sg) => {
            var _a;
            const categoryName = ((_a = sg.category) === null || _a === void 0 ? void 0 : _a.name) || 'Uncategorized';
            if (!acc[categoryName]) {
                acc[categoryName] = { total: 0, completed: 0 };
            }
            acc[categoryName].total++;
            if (sg.completionStatus === 'completed') {
                acc[categoryName].completed++;
            }
            return acc;
        }, {});
        const siteDetail = {
            // Basic site info
            _id: site._id,
            name: site.name,
            description: site.description,
            address: site.address,
            region: site.region,
            city: site.city,
            country: site.country,
            coordinates: site.coordinates,
            size: site.size,
            sizeUnit: site.sizeUnit,
            siteType: site.siteType,
            status: site.status,
            stage: siteStage,
            progress: overallProgress,
            // Project reference
            project: {
                _id: site.project._id,
                name: site.project.name,
                status: site.project.status
            },
            // Site setup
            setup: {
                progress: setupProgress,
                isComplete: (siteSetup === null || siteSetup === void 0 ? void 0 : siteSetup.isComplete) || false,
                completedTasks: (siteSetup === null || siteSetup === void 0 ? void 0 : siteSetup.tasks.filter((t) => t.isCompleted).length) || 0,
                totalTasks: (siteSetup === null || siteSetup === void 0 ? void 0 : siteSetup.tasks.filter((t) => t.isRequired).length) || 0,
                lastUpdated: siteSetup === null || siteSetup === void 0 ? void 0 : siteSetup.updatedAt
            },
            // Consultation plan
            consultation: {
                isComplete: (consultationPlan === null || consultationPlan === void 0 ? void 0 : consultationPlan.isCompleted) || false,
                progress: consultationProgress,
                selectedStakeholders: (consultationPlan === null || consultationPlan === void 0 ? void 0 : consultationPlan.selectedStakeholderCount) || 0,
                status: (consultationPlan === null || consultationPlan === void 0 ? void 0 : consultationPlan.status) || 'not_started',
                lastUpdated: consultationPlan === null || consultationPlan === void 0 ? void 0 : consultationPlan.updatedAt
            },
            // Stakeholder mapping
            stakeholderMapping: {
                total: stakeholderGroups.length,
                completed: stakeholderGroups.filter((s) => s.completionStatus === 'completed').length,
                inProgress: stakeholderGroups.filter((s) => s.completionStatus === 'in_progress').length,
                notStarted: stakeholderGroups.filter((s) => s.completionStatus === 'not_started').length,
                progress: stakeholderProgress,
                byCategory: stakeholderByCategory
            },
            // Theory of Change stages
            theoryOfChange: {
                stages: tocStages.map((stage) => ({
                    _id: stage._id,
                    stageNumber: stage.stageNumber,
                    status: stage.status,
                    progress: stage.progress,
                    completedAt: stage.completedAt
                })),
                averageProgress: tocProgress
            },
            // Recent reviews
            recentReviews: reviews.map((review) => ({
                _id: review._id,
                title: review.title,
                status: review.status,
                priority: review.priority,
                progress: review.progress,
                dueDate: review.dueDate,
                isOverdue: review.dueDate && review.dueDate < new Date(),
                createdAt: review.createdAt
            })),
            // Risk summary
            risks: {
                total: risks.length,
                high: risks.filter((r) => r.riskScore === 'high').length,
                medium: risks.filter((r) => r.riskScore === 'medium').length,
                low: risks.filter((r) => r.riskScore === 'low').length,
                recent: risks.slice(0, 5).map((risk) => ({
                    _id: risk._id,
                    name: risk.name,
                    riskType: risk.riskType,
                    riskScore: risk.riskScore,
                    status: risk.status,
                    owner: risk.owner,
                    createdAt: risk.createdAt
                }))
            },
            // Site contacts
            contacts: site.contacts,
            // Metadata
            createdAt: site.createdAt,
            updatedAt: site.updatedAt,
            creator: site.creator
        };
        res.status(200).json({
            success: true,
            data: siteDetail
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectSiteDetailForDashboard = getProjectSiteDetailForDashboard;
/**
 * Get project setup tasks with completion status
 * @route GET /api/v1/admin/dashboard/project/:projectId/setup-tasks
 * @access Private (Admin only)
 */
const getProjectSetupTasks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const [project, projectSetup] = yield Promise.all([
            project_model_1.default.findById(projectId),
            projectSetupTask_model_1.default.findOne({ project: projectId })
        ]);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        if (!projectSetup) {
            return res.status(200).json({
                success: true,
                data: {
                    project: { _id: project._id, name: project.name },
                    setup: null,
                    tasks: [],
                    progress: 0,
                    isComplete: false
                }
            });
        }
        // Group tasks by step
        const tasksByStep = projectSetup.tasks.reduce((acc, task) => {
            const stepKey = task.step.toString();
            if (!acc[stepKey]) {
                acc[stepKey] = [];
            }
            acc[stepKey].push({
                _id: task._id,
                fieldName: task.fieldName,
                fieldLabel: task.fieldLabel,
                description: task.description,
                userFacingCopy: task.userFacingCopy,
                dataType: task.dataType,
                options: task.options,
                helperText: task.helperText,
                hoverText: task.hoverText,
                isRequired: task.isRequired,
                isCompleted: task.isCompleted,
                completedAt: task.completedAt,
                completedBy: task.completedBy,
                responseData: task.responseData,
                sortOrder: task.sortOrder
            });
            return acc;
        }, {});
        // Sort tasks within each step
        Object.keys(tasksByStep).forEach((step) => {
            tasksByStep[step].sort((a, b) => a.sortOrder - b.sortOrder);
        });
        res.status(200).json({
            success: true,
            data: {
                project: {
                    _id: project._id,
                    name: project.name,
                    status: project.status
                },
                setup: {
                    _id: projectSetup._id,
                    progress: projectSetup.progress,
                    isComplete: projectSetup.isComplete,
                    completedAt: projectSetup.completedAt,
                    lastUpdatedBy: projectSetup.lastUpdatedBy
                },
                tasksByStep,
                summary: {
                    totalTasks: projectSetup.tasks.length,
                    completedTasks: projectSetup.tasks.filter((t) => t.isCompleted).length,
                    requiredTasks: projectSetup.tasks.filter((t) => t.isRequired).length,
                    completedRequiredTasks: projectSetup.tasks.filter((t) => t.isRequired && t.isCompleted).length
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectSetupTasks = getProjectSetupTasks;
/**
 * Get project site setup tasks with completion status
 * @route GET /api/v1/admin/dashboard/project-site/:siteId/setup-tasks
 * @access Private (Admin only)
 */
const getSiteSetupTasks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { siteId } = req.params;
        const [site, siteSetup] = yield Promise.all([
            projectSite_model_1.default.findById(siteId).populate('project', 'name status'),
            projectSiteSetupTask_model_1.default.findOne({ projectSite: siteId })
        ]);
        if (!site) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        if (!siteSetup) {
            return res.status(200).json({
                success: true,
                data: {
                    site: { _id: site._id, name: site.name },
                    project: site.project,
                    setup: null,
                    tasks: [],
                    progress: 0,
                    isComplete: false
                }
            });
        }
        // Group tasks by step
        const tasksByStep = siteSetup.tasks.reduce((acc, task) => {
            const stepKey = task.step.toString();
            if (!acc[stepKey]) {
                acc[stepKey] = [];
            }
            acc[stepKey].push({
                _id: task._id,
                fieldName: task.fieldName,
                fieldLabel: task.fieldLabel,
                description: task.description,
                userFacingCopy: task.userFacingCopy,
                dataType: task.dataType,
                options: task.options,
                helperText: task.helperText,
                hoverText: task.hoverText,
                isRequired: task.isRequired,
                isCompleted: task.isCompleted,
                completedAt: task.completedAt,
                completedBy: task.completedBy,
                responseData: task.responseData,
                sortOrder: task.sortOrder
            });
            return acc;
        }, {});
        // Sort tasks within each step
        Object.keys(tasksByStep).forEach((step) => {
            tasksByStep[step].sort((a, b) => a.sortOrder - b.sortOrder);
        });
        res.status(200).json({
            success: true,
            data: {
                site: {
                    _id: site._id,
                    name: site.name,
                    status: site.status
                },
                project: site.project,
                setup: {
                    _id: siteSetup._id,
                    progress: siteSetup.progress,
                    isComplete: siteSetup.isComplete,
                    completedAt: siteSetup.completedAt,
                    lastUpdatedBy: siteSetup.lastUpdatedBy
                },
                tasksByStep,
                summary: {
                    totalTasks: siteSetup.tasks.length,
                    completedTasks: siteSetup.tasks.filter((t) => t.isCompleted).length,
                    requiredTasks: siteSetup.tasks.filter((t) => t.isRequired).length,
                    completedRequiredTasks: siteSetup.tasks.filter((t) => t.isRequired && t.isCompleted).length
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSiteSetupTasks = getSiteSetupTasks;
//# sourceMappingURL=dashboardDetails.controller.js.map