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
exports.getStageStatusWithConsultation = exports.getLogicModel = exports.getWorkplan = exports.completeStage = exports.getStagesByProject = exports.getStageProgress = exports.initializeStage = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const theoryOfChangeStage_model_1 = __importDefault(require("../models/theoryOfChangeStage.model"));
const stakeholderAction_model_1 = __importDefault(require("../models/stakeholderAction.model"));
const socialImpact_model_1 = __importDefault(require("../models/socialImpact.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const theoryOfChange_service_1 = require("../services/theoryOfChange.service");
const tocConsultationPlan_model_1 = __importDefault(require("../models/tocConsultationPlan.model"));
// Type guard to check if user is authenticated
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Initialize a new Theory of Change stage for a project or project site
 * @route POST /api/v1/theoryOfChange/stages/initialize
 * @access Private
 */
const initializeStage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId, projectSiteId, stageNumber } = req.body;
        // Validate required fields
        if (!projectId || !stageNumber) {
            const error = new Error('Project ID and stage number are required');
            error.statusCode = 400;
            throw error;
        }
        // Validate stage number
        if (stageNumber !== 1 && stageNumber !== 2) {
            const error = new Error('Stage number must be either 1 or 2');
            error.statusCode = 400;
            throw error;
        }
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId).session(session);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // If project site is specified, check if it exists and belongs to the project
        if (projectSiteId) {
            const projectSite = yield projectSite_model_1.default.findById(projectSiteId).session(session);
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
            // MODIFIED: Check if consultation plan is completed for THIS SPECIFIC SITE only
            if (stageNumber === 1 || stageNumber === 2) {
                const consultationPlan = yield tocConsultationPlan_model_1.default.findOne({
                    projectSite: projectSiteId,
                    isCompleted: true
                }).session(session);
                if (!consultationPlan) {
                    const error = new Error(`Consultation planning must be completed for this site (${projectSite.name}) before starting Theory of Change stages.`);
                    error.statusCode = 400;
                    throw error;
                }
            }
        }
        // If no projectSiteId, this is a project-level stage (no consultation plan requirement)
        // OR you might want to require consultation plans for all sites in this case too
        // Uncomment below if you want project-level stages to require all sites to have consultation plans:
        /*
        else {
          // For project-level stages, check if all sites have completed consultation plans
          const allProjectSites = await ProjectSite.find({ project: projectId });
          
          if (allProjectSites.length > 0) {
            const completedConsultationPlans = await TOCConsultationPlan.find({
              project: projectId,
              isCompleted: true
            });
            
            const completedSiteIds = completedConsultationPlans.map(plan => plan.projectSite.toString());
            const allSiteIds = allProjectSites.map(site => site._id.toString());
            
            const missingConsultationSites = allSiteIds.filter(siteId => !completedSiteIds.includes(siteId));
            
            if (missingConsultationSites.length > 0) {
              const missingSites = allProjectSites
                .filter(site => missingConsultationSites.includes(site._id.toString()))
                .map(site => site.name);
              
              const error = new Error(
                `For project-level Theory of Change stages, consultation planning must be completed for all sites. Missing consultation plans for: ${missingSites.join(', ')}`
              ) as CustomError;
              error.statusCode = 400;
              throw error;
            }
          }
        }
        */
        // Check if stage already exists for this project/site
        const existingStage = yield theoryOfChangeStage_model_1.default.findOne({
            project: projectId,
            projectSite: projectSiteId || null,
            stageNumber
        }).session(session);
        if (existingStage) {
            const error = new Error(`Theory of Change Stage ${stageNumber} already exists for this project/site`);
            error.statusCode = 409;
            throw error;
        }
        // Initialize the stage
        const newStage = yield theoryOfChangeStage_model_1.default.create({
            project: projectId,
            projectSite: projectSiteId || null,
            stageNumber,
            status: 'not_started',
            progress: 0,
            creator: req.user._id,
            lastUpdatedBy: req.user._id
        });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: `Theory of Change Stage ${stageNumber} initialized successfully`,
            data: newStage
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.initializeStage = initializeStage;
/**
 * Get progress details for a specific Theory of Change stage
 * @route GET /api/v1/theoryOfChange/stages/:stageId
 * @access Private
 */
const getStageProgress = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stageId } = req.params;
        // Find the stage
        const stage = yield theoryOfChangeStage_model_1.default.findById(stageId)
            .populate('project', 'name')
            .populate('projectSite', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name');
        if (!stage) {
            const error = new Error('Theory of Change stage not found');
            error.statusCode = 404;
            throw error;
        }
        // Get the latest progress
        let detailedProgress;
        try {
            detailedProgress = yield (0, theoryOfChange_service_1.calculateStageProgress)(stageId);
            // Update the stage progress
            stage.progress = detailedProgress.overallProgress;
            stage.status = detailedProgress.overallProgress === 100 ? 'completed' : (detailedProgress.overallProgress > 0 ? 'in_progress' : 'not_started');
            stage.lastUpdatedBy = req.user._id;
            if (stage.status === 'completed' && !stage.completedAt) {
                stage.completedAt = new Date();
            }
            yield stage.save();
        }
        catch (error) {
            console.error('Error calculating stage progress:', error);
            detailedProgress = {
                overallProgress: stage.progress,
                stakeholderProgress: [],
                themeProgress: []
            };
        }
        // Get related data based on stage number
        let relatedData = {};
        if (stage.stageNumber === 1) {
            // For Stage 1, get stakeholder actions
            const actions = yield stakeholderAction_model_1.default.find({ stage: stageId, archived: { $ne: true } })
                .populate('stakeholderGroup', 'name')
                .populate('themes', 'name') // ✅ CHANGED: from 'theme' to 'themes'
                .populate('subThemes', 'name') // ✅ CHANGED: from 'subTheme' to 'subThemes'
                .sort({ 'stakeholderGroup': 1, createdAt: 1 });
            relatedData = { actions };
        }
        else if (stage.stageNumber === 2) {
            // For Stage 2, get social impacts
            const impacts = yield socialImpact_model_1.default.find({ stage: stageId, archived: { $ne: true } })
                .populate('stakeholderGroup', 'name')
                .populate('themes', 'name') // ✅ CHANGED: from 'theme' to 'themes'
                .populate('subThemes', 'name') // ✅ CHANGED: from 'subTheme' to 'subThemes'
                .sort({ 'stakeholderGroup': 1, createdAt: 1 });
            relatedData = { impacts };
        }
        res.status(200).json({
            success: true,
            data: Object.assign({ stage, progress: detailedProgress }, relatedData)
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid stage ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getStageProgress = getStageProgress;
/**
 * Get all Theory of Change stages for a project or project site
 * @route GET /api/v1/theoryOfChange/stages/project/:projectId
 * @route GET /api/v1/theoryOfChange/stages/project/:projectId/site/:siteId
 * @access Private
 */
const getStagesByProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, siteId } = req.params;
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // If site is specified, check if it exists and belongs to the project
        if (siteId) {
            const projectSite = yield projectSite_model_1.default.findById(siteId);
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
        // Build the query
        const query = {
            project: projectId,
            archived: { $ne: true }
        };
        if (siteId) {
            query.projectSite = siteId;
        }
        else {
            query.projectSite = null; // Only get project-level stages when no site is specified
        }
        // Get all stages for this project/site
        const stages = yield theoryOfChangeStage_model_1.default.find(query)
            .sort('stageNumber')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name');
        // Check if both stages exist, initialize them if not
        const stage1Exists = stages.some(stage => stage.stageNumber === 1);
        const stage2Exists = stages.some(stage => stage.stageNumber === 2);
        // If user is authenticated, initialize missing stages
        if (isUserAuthenticated(req)) {
            const newStages = [];
            if (!stage1Exists) {
                const newStage1 = new theoryOfChangeStage_model_1.default({
                    project: projectId,
                    projectSite: siteId || null,
                    stageNumber: 1,
                    status: 'not_started',
                    progress: 0,
                    creator: req.user._id,
                    lastUpdatedBy: req.user._id
                });
                yield newStage1.save();
                newStages.push(newStage1);
            }
            if (!stage2Exists) {
                const newStage2 = new theoryOfChangeStage_model_1.default({
                    project: projectId,
                    projectSite: siteId || null,
                    stageNumber: 2,
                    status: 'not_started',
                    progress: 0,
                    creator: req.user._id,
                    lastUpdatedBy: req.user._id
                });
                yield newStage2.save();
                newStages.push(newStage2);
            }
            // Add newly created stages to the result
            if (newStages.length > 0) {
                stages.push(...newStages);
                stages.sort((a, b) => a.stageNumber - b.stageNumber);
            }
        }
        // Get summary stats for each stage
        const stagesWithSummary = yield Promise.all(stages.map((stage) => __awaiter(void 0, void 0, void 0, function* () {
            let summary;
            if (stage.stageNumber === 1) {
                // Count actions for Stage 1
                const actionCount = yield stakeholderAction_model_1.default.countDocuments({
                    stage: stage._id,
                    archived: { $ne: true }
                });
                // Count unique stakeholder groups with actions
                const uniqueStakeholders = yield stakeholderAction_model_1.default.distinct('stakeholderGroup', {
                    stage: stage._id,
                    archived: { $ne: true }
                });
                summary = {
                    actionCount,
                    stakeholderCount: uniqueStakeholders.length
                };
            }
            else if (stage.stageNumber === 2) {
                // Count impacts for Stage 2
                const impactCount = yield socialImpact_model_1.default.countDocuments({
                    stage: stage._id,
                    archived: { $ne: true }
                });
                // Count risk assessments
                const totalRisks = yield socialImpact_model_1.default.aggregate([
                    { $match: { stage: stage._id, archived: { $ne: true } } },
                    { $unwind: '$risks' },
                    { $count: 'totalRisks' }
                ]);
                summary = {
                    impactCount,
                    riskCount: totalRisks.length > 0 ? totalRisks[0].totalRisks : 0
                };
            }
            return Object.assign(Object.assign({}, stage.toObject()), { summary });
        })));
        res.status(200).json({
            success: true,
            count: stagesWithSummary.length,
            data: stagesWithSummary
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStagesByProject = getStagesByProject;
/**
 * Mark a Theory of Change stage as completed
 * @route PUT /api/v1/theoryOfChange/stages/:stageId/complete
 * @access Private
 */
const completeStage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { stageId } = req.params;
        // Find the stage
        const stage = yield theoryOfChangeStage_model_1.default.findById(stageId);
        if (!stage) {
            const error = new Error('Theory of Change stage not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if stage has enough content to be completed
        let canComplete = false;
        let requiredItems = 0;
        if (stage.stageNumber === 1) {
            // For Stage 1, require at least one action
            const actionCount = yield stakeholderAction_model_1.default.countDocuments({
                stage: stageId,
                archived: { $ne: true }
            });
            canComplete = actionCount > 0;
            requiredItems = actionCount;
        }
        else if (stage.stageNumber === 2) {
            // For Stage 2, require at least one impact with risks
            const impactCount = yield socialImpact_model_1.default.countDocuments({
                stage: stageId,
                archived: { $ne: true },
                'risks.0': { $exists: true } // At least one risk defined
            });
            canComplete = impactCount > 0;
            requiredItems = impactCount;
        }
        if (!canComplete) {
            const error = new Error(`Cannot complete stage: minimum required items not defined. Stage ${stage.stageNumber} requires ${stage.stageNumber === 1 ? 'at least one action' : 'at least one impact with risks'}`);
            error.statusCode = 400;
            throw error;
        }
        // Update the stage
        stage.status = 'completed';
        stage.progress = 100;
        stage.completedAt = new Date();
        stage.lastUpdatedBy = req.user._id;
        yield stage.save();
        res.status(200).json({
            success: true,
            message: `Theory of Change Stage ${stage.stageNumber} marked as completed`,
            data: {
                stage,
                itemCount: requiredItems
            }
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid stage ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.completeStage = completeStage;
/**
 * Generate a workplan from Stage 1 data
 * @route GET /api/v1/theoryOfChange/stages/:stageId/workplan
 * @access Private
 */
const getWorkplan = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stageId } = req.params;
        const workplan = yield (0, theoryOfChange_service_1.generateWorkplan)(stageId);
        res.status(200).json({
            success: true,
            data: workplan
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getWorkplan = getWorkplan;
/**
 * Generate a logic model from Stage 2 data
 * @route GET /api/v1/theoryOfChange/stages/:stageId/logicmodel
 * @access Private
 */
const getLogicModel = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stageId } = req.params;
        const logicModel = yield (0, theoryOfChange_service_1.generateLogicModel)(stageId);
        res.status(200).json({
            success: true,
            data: logicModel
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getLogicModel = getLogicModel;
// Also add this helper function to get comprehensive stage status including consultation plan
const getStageStatusWithConsultation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const { projectId, projectSiteId } = req.params;
        // Validate inputs
        if (!projectId) {
            const error = new Error('Project ID is required');
            error.statusCode = 400;
            throw error;
        }
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        let projectSite = null;
        if (projectSiteId) {
            projectSite = yield projectSite_model_1.default.findById(projectSiteId);
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
        // Get consultation plan status
        let consultationPlanStatus = {
            exists: false,
            isCompleted: false,
            completionPercentage: 0,
            canProceedToStage1: false
        };
        if (projectSiteId) {
            const consultationPlan = yield tocConsultationPlan_model_1.default.findOne({
                projectSite: projectSiteId
            });
            if (consultationPlan) {
                // Calculate completion percentage manually
                const hasSelectedStakeholders = consultationPlan.stakeholderGroups.some(sg => sg.isSelected);
                const hasAnsweredQuestions = Object.values(consultationPlan.consultationQuestions).some(q => q && typeof q === 'string' && q.trim() !== '');
                const hasPlannedDates = consultationPlan.plannedConsultationDates.startDate ||
                    consultationPlan.plannedConsultationDates.endDate ||
                    (consultationPlan.plannedConsultationDates.dateDescription && consultationPlan.plannedConsultationDates.dateDescription.trim() !== '');
                const sections = [hasSelectedStakeholders, hasAnsweredQuestions, hasPlannedDates];
                const completedSections = sections.filter(Boolean).length;
                const completionPercentage = Math.round((completedSections / 3) * 100);
                consultationPlanStatus = {
                    exists: true,
                    isCompleted: consultationPlan.isCompleted,
                    completionPercentage: completionPercentage,
                    canProceedToStage1: consultationPlan.isCompleted
                };
            }
        }
        else {
            // For project-level view, consultation plan is not required
            consultationPlanStatus.canProceedToStage1 = true;
        }
        // Get existing Theory of Change stages
        const stages = yield theoryOfChangeStage_model_1.default.find({
            project: projectId,
            projectSite: projectSiteId || null
        }).sort({ stageNumber: 1 });
        // Calculate stage accessibility
        // Both stages can be initialized if consultation plan is completed and stage doesn't exist
        const stageAccessibility = {
            stage1: {
                canInitialize: consultationPlanStatus.canProceedToStage1 && !stages.find(s => s.stageNumber === 1),
                exists: !!stages.find(s => s.stageNumber === 1),
                status: ((_a = stages.find(s => s.stageNumber === 1)) === null || _a === void 0 ? void 0 : _a.status) || null,
                progress: ((_b = stages.find(s => s.stageNumber === 1)) === null || _b === void 0 ? void 0 : _b.progress) || 0
            },
            stage2: {
                canInitialize: consultationPlanStatus.canProceedToStage1 && !stages.find(s => s.stageNumber === 2),
                exists: !!stages.find(s => s.stageNumber === 2),
                status: ((_c = stages.find(s => s.stageNumber === 2)) === null || _c === void 0 ? void 0 : _c.status) || null,
                progress: ((_d = stages.find(s => s.stageNumber === 2)) === null || _d === void 0 ? void 0 : _d.progress) || 0
            }
        };
        // Get summary stats for each stage
        const stagesWithSummary = yield Promise.all(stages.map((stage) => __awaiter(void 0, void 0, void 0, function* () {
            let summary;
            if (stage.stageNumber === 1) {
                // Count actions for Stage 1
                const actionCount = yield stakeholderAction_model_1.default.countDocuments({
                    stage: stage._id,
                    archived: { $ne: true }
                });
                // Count unique stakeholder groups with actions
                const uniqueStakeholders = yield stakeholderAction_model_1.default.distinct('stakeholderGroup', {
                    stage: stage._id,
                    archived: { $ne: true }
                });
                summary = {
                    actionCount,
                    stakeholderCount: uniqueStakeholders.length
                };
            }
            else if (stage.stageNumber === 2) {
                // Count impacts for Stage 2
                const impactCount = yield socialImpact_model_1.default.countDocuments({
                    stage: stage._id,
                    archived: { $ne: true }
                });
                // Count risk assessments
                const totalRisks = yield socialImpact_model_1.default.aggregate([
                    { $match: { stage: stage._id, archived: { $ne: true } } },
                    { $unwind: '$risks' },
                    { $count: 'totalRisks' }
                ]);
                summary = {
                    impactCount,
                    riskCount: totalRisks.length > 0 ? totalRisks[0].totalRisks : 0
                };
            }
            return Object.assign(Object.assign({}, stage.toObject()), { summary });
        })));
        res.status(200).json({
            success: true,
            data: {
                project: {
                    _id: project._id,
                    name: project.name,
                    location: project.location
                },
                projectSite: projectSite ? {
                    _id: projectSite._id,
                    name: projectSite.name,
                } : null,
                consultationPlan: consultationPlanStatus,
                stageAccessibility,
                stages: stagesWithSummary,
                overallProgress: {
                    consultationPlanCompleted: consultationPlanStatus.isCompleted,
                    stage1Completed: stageAccessibility.stage1.status === 'completed',
                    stage2Completed: stageAccessibility.stage2.status === 'completed',
                    canProceedToStage1: stageAccessibility.stage1.canInitialize || stageAccessibility.stage1.exists,
                    canProceedToStage2: stageAccessibility.stage2.canInitialize || stageAccessibility.stage2.exists
                }
            }
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getStageStatusWithConsultation = getStageStatusWithConsultation;
// Then update the export at the bottom to include the new functions
exports.default = {
    initializeStage: exports.initializeStage,
    getStageProgress: exports.getStageProgress,
    getStagesByProject: exports.getStagesByProject,
    completeStage: exports.completeStage,
    getWorkplan: exports.getWorkplan,
    getLogicModel: exports.getLogicModel,
    getStageStatusWithConsultation: exports.getStageStatusWithConsultation
};
//# sourceMappingURL=theoryOfChange.controller.js.map