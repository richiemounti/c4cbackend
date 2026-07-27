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
exports.getPublicSurveyConsentForm = exports.getPublicSurveyData = exports.attachConsentFormToSurvey = exports.cloneSurvey = exports.deleteSurvey = exports.restoreSurvey = exports.archiveSurvey = exports.getSurveyQuestions = exports.getSurveySections = exports.getSurveyStructure = exports.getSurveyBuilderContext = exports.getFilteredQuestionsForSurvey = exports.getSampleSizeCalculation = exports.calculateSampleSize = exports.updateSurvey = exports.getSurvey = exports.getSurveys = exports.getStakeholderSurveyStats = exports.updateSurveyCategory = exports.getSurveysByProjectAndStage = exports.getSurveysByStakeholder = exports.createSurvey = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const survey_model_1 = __importDefault(require("../models/survey.model"));
const surveySection_model_1 = __importDefault(require("../models/surveySection.model"));
const surveyQuestion_model_1 = __importDefault(require("../models/surveyQuestion.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const question_model_1 = __importDefault(require("../models/question.model"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const theoryOfChangeStage_model_1 = __importDefault(require("../models/theoryOfChangeStage.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const authHelpers_1 = require("../lib/authHelpers");
const questionFiltering_service_1 = require("../services/questionFiltering.service");
const reviewHelpers_1 = require("../utils/reviewHelpers");
// ===============================
// ENHANCED SURVEY CRUD OPERATIONS
// ===============================
/**
 * Create a new survey with full context validation
 * @route POST /api/v1/surveys
 * @access Private
 */
const createSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { title, description, projectId, projectSiteId, stakeholderGroupId, stageId, category, customCategoryName, settings, isTemplate, templateCategory, estimatedDuration } = req.body;
        // Validate authentication
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Validate required fields
        if (!projectId || !stakeholderGroupId || !stageId) {
            const error = new Error('Project ID, stakeholder group ID, and stage ID are required');
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
        // Check if stakeholder group exists
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderGroupId).session(session);
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if theory of change stage exists
        const stage = yield theoryOfChangeStage_model_1.default.findById(stageId).session(session);
        if (!stage) {
            const error = new Error('Theory of change stage not found');
            error.statusCode = 404;
            throw error;
        }
        // Verify stakeholder group belongs to the same project
        if (stakeholderGroup.project.toString() !== projectId) {
            const error = new Error('Stakeholder group does not belong to this project');
            error.statusCode = 400;
            throw error;
        }
        // Verify stage belongs to the same project
        if (stage.project.toString() !== projectId) {
            const error = new Error('Theory of change stage does not belong to this project');
            error.statusCode = 400;
            throw error;
        }
        // Check if user has permission to create surveys for this project
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess) {
            const error = new Error('Not authorized to create surveys for this project');
            error.statusCode = 403;
            throw error;
        }
        // Validate category
        if (category === 'custom' && !customCategoryName) {
            const error = new Error('Custom category name is required when category is custom');
            error.statusCode = 400;
            throw error;
        }
        // Validate project site if provided
        if (projectSiteId) {
            const projectSite = yield projectSite_model_1.default.findById(projectSiteId).session(session);
            if (!projectSite || projectSite.project.toString() !== projectId) {
                const error = new Error('Invalid project site');
                error.statusCode = 400;
                throw error;
            }
        }
        // Create the survey with all required fields
        const newSurvey = new survey_model_1.default({
            title,
            description,
            project: projectId,
            projectSite: projectSiteId || null,
            theoryOfChangeStage: stageId,
            stakeholderGroup: stakeholderGroupId,
            category: category || 'custom',
            customCategoryName,
            settings: settings || {},
            isTemplate: isTemplate || false,
            templateCategory,
            estimatedDuration: estimatedDuration || 10,
            creator: req.user._id,
            lastUpdatedBy: req.user._id
        });
        yield newSurvey.save({ session });
        yield session.commitTransaction();
        // Populate the response
        const populatedSurvey = yield survey_model_1.default.findById(newSurvey._id)
            .populate('project', 'name')
            .populate('stakeholderGroup', 'name group')
            .populate('theoryOfChangeStage', 'stageNumber status')
            .populate('projectSite', 'name');
        res.status(201).json({
            success: true,
            message: 'Survey created successfully',
            data: populatedSurvey
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.createSurvey = createSurvey;
// ===============================
// ADDITIONAL SURVEY BUILDER METHODS
// ===============================
/**
 * Get surveys by stakeholder group with enhanced display
 * @route GET /api/v1/surveys/stakeholder/:stakeholderGroupId
 * @access Private
 */
const getSurveysByStakeholder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stakeholderGroupId } = req.params;
        const { includeArchived = false } = req.query;
        // Check if stakeholder group exists
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderGroupId)
            .populate('project', 'name');
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Check permissions
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, stakeholderGroup.project._id.toString());
        if (!hasAccess) {
            const error = new Error('Not authorized to access this stakeholder group');
            error.statusCode = 403;
            throw error;
        }
        // Build filter
        const filter = { stakeholderGroup: stakeholderGroupId };
        if (!includeArchived) {
            filter.archived = { $ne: true };
        }
        // Get surveys with enhanced population
        const surveys = yield survey_model_1.default.find(filter)
            .populate('project', 'name')
            .populate('stakeholderGroup', 'name group')
            .populate('theoryOfChangeStage', 'stageNumber status')
            .populate('projectSite', 'name')
            .populate('creator', 'name email')
            .sort({ category: 1, sequenceNumber: 1, createdAt: -1 });
        // Group surveys by category for easier frontend consumption
        const surveysByCategory = surveys.reduce((acc, survey) => {
            const categoryKey = survey.category === 'custom' ? survey.customCategoryName : survey.category;
            const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
            const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
            const displayName = `${survey.title} (${categoryName}${sequence})`;
            if (!acc[categoryKey]) {
                acc[categoryKey] = [];
            }
            acc[categoryKey].push({
                id: survey._id,
                title: survey.title,
                displayName: displayName,
                category: survey.category,
                customCategoryName: survey.customCategoryName,
                sequenceNumber: survey.sequenceNumber,
                status: survey.status,
                totalQuestions: survey.totalQuestions,
                estimatedDuration: survey.estimatedDuration,
                createdAt: survey.createdAt,
                updatedAt: survey.updatedAt
            });
            return acc;
        }, {});
        res.status(200).json({
            success: true,
            count: surveys.length,
            data: {
                surveys,
                surveysByCategory,
                categories: Object.keys(surveysByCategory)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSurveysByStakeholder = getSurveysByStakeholder;
/**
 * Get surveys by project and theory of change stage
 * @route GET /api/v1/surveys/project/:projectId/stage/:stageId
 * @access Private
 */
const getSurveysByProjectAndStage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, stageId } = req.params;
        const { includeArchived = false } = req.query;
        // Check permissions
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        // Validate project and stage
        const [project, stage] = yield Promise.all([
            project_model_1.default.findById(projectId),
            theoryOfChangeStage_model_1.default.findById(stageId)
        ]);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        if (!stage) {
            const error = new Error('Theory of change stage not found');
            error.statusCode = 404;
            throw error;
        }
        // Build filter
        const filter = {
            project: projectId,
            theoryOfChangeStage: stageId
        };
        if (!includeArchived) {
            filter.archived = { $ne: true };
        }
        // Get surveys with full population
        const surveys = yield survey_model_1.default.find(filter)
            .populate('project', 'name')
            .populate('stakeholderGroup', 'name group')
            .populate('theoryOfChangeStage', 'stageNumber status')
            .populate('projectSite', 'name')
            .populate('creator', 'name email')
            .sort({ 'stakeholderGroup.name': 1, category: 1, sequenceNumber: 1 });
        // Group by stakeholder for organized display
        const surveysByStakeholder = surveys.reduce((acc, survey) => {
            const stakeholderId = survey.stakeholderGroup._id.toString();
            const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
            const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
            const displayName = `${survey.title} (${categoryName}${sequence})`;
            if (!acc[stakeholderId]) {
                acc[stakeholderId] = {
                    stakeholderGroup: survey.stakeholderGroup,
                    surveys: []
                };
            }
            acc[stakeholderId].surveys.push(Object.assign(Object.assign({}, survey.toObject()), { displayName }));
            return acc;
        }, {});
        res.status(200).json({
            success: true,
            count: surveys.length,
            data: {
                project,
                stage,
                surveys,
                surveysByStakeholder: Object.values(surveysByStakeholder)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSurveysByProjectAndStage = getSurveysByProjectAndStage;
/**
 * Update survey category and naming
 * @route PUT /api/v1/surveys/:surveyId/category
 * @access Private
 */
const updateSurveyCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { surveyId } = req.params;
        const { category, customCategoryName } = req.body;
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Cannot update category of archived survey');
            error.statusCode = 400;
            throw error;
        }
        // Check permissions
        if (!(0, authHelpers_1.isCreatorOrHasAccess)(req, survey.creator, survey.project)) {
            const error = new Error('Not authorized to modify this survey');
            error.statusCode = 403;
            throw error;
        }
        // Validate category change
        if (category === 'custom' && !customCategoryName) {
            const error = new Error('Custom category name is required when category is custom');
            error.statusCode = 400;
            throw error;
        }
        // Update the survey
        survey.category = category;
        survey.customCategoryName = customCategoryName;
        if (req.user) {
            survey.lastUpdatedBy = req.user._id;
        }
        yield survey.save();
        const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
        const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
        const displayName = `${survey.title} (${categoryName}${sequence})`;
        res.status(200).json({
            success: true,
            message: 'Survey category updated successfully',
            data: {
                id: survey._id,
                title: survey.title,
                displayName: displayName,
                category: survey.category,
                customCategoryName: survey.customCategoryName,
                sequenceNumber: survey.sequenceNumber,
                status: survey.status,
                totalQuestions: survey.totalQuestions,
                estimatedDuration: survey.estimatedDuration,
                createdAt: survey.createdAt,
                updatedAt: survey.updatedAt
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateSurveyCategory = updateSurveyCategory;
/**
 * Get survey creation statistics for a stakeholder group
 * @route GET /api/v1/surveys/stats/stakeholder/:stakeholderGroupId
 * @access Private
 */
const getStakeholderSurveyStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { stakeholderGroupId } = req.params;
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderGroupId)
            .populate('project', 'name');
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Check permissions
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, stakeholderGroup.project._id.toString());
        if (!hasAccess) {
            const error = new Error('Not authorized to access this stakeholder group');
            error.statusCode = 403;
            throw error;
        }
        // Get comprehensive statistics
        const [totalSurveys, activeSurveys, archivedSurveys, categoryStats, recentActivity] = yield Promise.all([
            survey_model_1.default.countDocuments({ stakeholderGroup: stakeholderGroupId }),
            survey_model_1.default.countDocuments({
                stakeholderGroup: stakeholderGroupId,
                status: { $in: ['draft', 'published'] },
                archived: { $ne: true }
            }),
            survey_model_1.default.countDocuments({
                stakeholderGroup: stakeholderGroupId,
                archived: true
            }),
            survey_model_1.default.aggregate([
                { $match: { stakeholderGroup: new mongoose_1.default.Types.ObjectId(stakeholderGroupId) } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        avgDuration: { $avg: '$estimatedDuration' },
                        totalQuestions: { $sum: '$totalQuestions' }
                    }
                }
            ]),
            survey_model_1.default.find({ stakeholderGroup: stakeholderGroupId })
                .sort({ updatedAt: -1 })
                .limit(5)
                .select('title category customCategoryName status updatedAt')
        ]);
        // Calculate response statistics if available
        const responseStats = yield mongoose_1.default.model('SurveyResponse').aggregate([
            {
                $lookup: {
                    from: 'surveys',
                    localField: 'survey',
                    foreignField: '_id',
                    as: 'surveyInfo'
                }
            },
            { $unwind: '$surveyInfo' },
            { $match: { 'surveyInfo.stakeholderGroup': new mongoose_1.default.Types.ObjectId(stakeholderGroupId) } },
            {
                $group: {
                    _id: null,
                    totalResponses: { $sum: 1 },
                    completedResponses: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    avgCompletionRate: {
                        $avg: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    }
                }
            }
        ]);
        res.status(200).json({
            success: true,
            data: {
                stakeholderGroup,
                overview: {
                    totalSurveys,
                    activeSurveys,
                    archivedSurveys,
                    totalResponses: ((_a = responseStats[0]) === null || _a === void 0 ? void 0 : _a.totalResponses) || 0,
                    completedResponses: ((_b = responseStats[0]) === null || _b === void 0 ? void 0 : _b.completedResponses) || 0,
                    avgCompletionRate: ((_c = responseStats[0]) === null || _c === void 0 ? void 0 : _c.avgCompletionRate) || 0
                },
                categoryBreakdown: categoryStats,
                recentActivity
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStakeholderSurveyStats = getStakeholderSurveyStats;
/**
 * Get all surveys with enhanced filtering and context
 * @route GET /api/v1/surveys
 * @access Private
 */
const getSurveys = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { project, stakeholderGroup, theoryOfChangeStage, status, category, isTemplate, page = 1, limit = 50, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        // Build filter object
        const filter = { archived: { $ne: true } };
        if (project)
            filter.project = project;
        if (stakeholderGroup)
            filter.stakeholderGroup = stakeholderGroup;
        if (theoryOfChangeStage)
            filter.theoryOfChangeStage = theoryOfChangeStage;
        if (status)
            filter.status = status;
        if (category)
            filter.category = category;
        if (isTemplate !== undefined)
            filter.isTemplate = isTemplate === 'true';
        // Add search functionality
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { customCategoryName: { $regex: search, $options: 'i' } }
            ];
        }
        // If user is not ConnectGo staff, limit to accessible projects
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff) && !project) {
            const userProjects = yield project_model_1.default.find({
                $or: [
                    { creator: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id },
                    { 'team.user': (_c = req.user) === null || _c === void 0 ? void 0 : _c._id }
                ]
            }).select('_id');
            const projectIds = userProjects.map(p => p._id);
            if (projectIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    count: 0,
                    data: [],
                    pagination: { currentPage: 1, totalPages: 0, totalItems: 0 }
                });
            }
            filter.project = { $in: projectIds };
        }
        // Calculate pagination
        const skip = (Number(page) - 1) * Number(limit);
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        // Execute query with proper population
        const [surveys, totalCount] = yield Promise.all([
            survey_model_1.default.find(filter)
                .populate('project', 'name')
                .populate('stakeholderGroup', 'name group')
                .populate('theoryOfChangeStage', 'stageNumber status')
                .populate('projectSite', 'name')
                .populate('creator', 'name email')
                .sort(sort)
                .skip(skip)
                .limit(Number(limit)),
            survey_model_1.default.countDocuments(filter)
        ]);
        // Group surveys by stakeholder for enhanced display
        const surveysByStakeholder = surveys.reduce((acc, survey) => {
            const stakeholderId = survey.stakeholderGroup._id.toString();
            const categoryName = survey.category === 'custom' ?
                survey.customCategoryName : survey.category;
            const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
            const displayName = `${survey.title} (${categoryName}${sequence})`;
            if (!acc[stakeholderId]) {
                acc[stakeholderId] = {
                    stakeholderGroup: survey.stakeholderGroup,
                    surveys: []
                };
            }
            acc[stakeholderId].surveys.push(Object.assign(Object.assign({}, survey.toObject()), { displayName }));
            return acc;
        }, {});
        res.status(200).json({
            success: true,
            count: surveys.length,
            data: {
                surveys,
                surveysByStakeholder: Object.values(surveysByStakeholder)
            },
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalCount / Number(limit)),
                totalItems: totalCount,
                itemsPerPage: Number(limit)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSurveys = getSurveys;
/**
 * Get single survey with full context
 * @route GET /api/v1/surveys/:id
 * @access Private
 */
const getSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const surveyId = req.params.id;
        const survey = yield survey_model_1.default.findById(surveyId)
            .populate('project', 'name description')
            .populate('stakeholderGroup', 'name group description')
            .populate('theoryOfChangeStage', 'stageNumber status')
            .populate('projectSite', 'name description')
            .populate('creator', 'name email')
            .populate('lastUpdatedBy', 'name email');
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Survey is archived');
            error.statusCode = 410;
            throw error;
        }
        // Check if user has permission to access this survey
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project._id.toString());
        if (!hasAccess) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        // Add display name for consistent UI
        const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
        const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
        const displayName = `${survey.title} (${categoryName}${sequence})`;
        res.status(200).json({
            success: true,
            data: Object.assign(Object.assign({}, survey.toObject()), { displayName })
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid survey ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSurvey = getSurvey;
/**
 * Update survey with enhanced validation
 * @route PUT /api/v1/surveys/:id
 * @access Private
 */
const updateSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const surveyId = req.params.id;
        const { title, description, category, customCategoryName, status, settings, estimatedDuration } = req.body;
        // Find the survey — must use the same session so .save({ session }) works
        const survey = yield survey_model_1.default.findById(surveyId).session(session);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Cannot update an archived survey');
            error.statusCode = 400;
            throw error;
        }
        // Check permissions
        if (!(0, authHelpers_1.isCreatorOrHasAccess)(req, survey.creator, survey.project)) {
            const error = new Error('Not authorized to update this survey');
            error.statusCode = 403;
            throw error;
        }
        // Validate category change
        if (category === 'custom' && !customCategoryName) {
            const error = new Error('Custom category name is required when category is custom');
            error.statusCode = 400;
            throw error;
        }
        // Don't allow status changes to published if survey doesn't have questions
        if (status === 'published' && survey.status !== 'published') {
            const questionCount = yield surveyQuestion_model_1.default.countDocuments({ survey: surveyId }).session(session);
            if (questionCount === 0) {
                const error = new Error('Cannot publish a survey without questions');
                error.statusCode = 400;
                throw error;
            }
        }
        // ============================================================================
        // 🆕 TRACK STATUS CHANGE FOR AUTO-TRIGGER
        // ============================================================================
        const wasPublished = survey.status === 'published';
        const isNowPublished = status === 'published';
        const justPublished = !wasPublished && isNowPublished;
        // ============================================================================
        // Update fields
        if (title !== undefined)
            survey.title = title;
        if (description !== undefined)
            survey.description = description;
        if (category !== undefined)
            survey.category = category;
        if (customCategoryName !== undefined)
            survey.customCategoryName = customCategoryName;
        if (status !== undefined)
            survey.status = status;
        if (settings !== undefined)
            survey.settings = settings;
        if (estimatedDuration !== undefined)
            survey.estimatedDuration = estimatedDuration;
        if (req.user) {
            survey.lastUpdatedBy = req.user._id;
        }
        yield survey.save({ session });
        // ============================================================================
        // 🆕 ADD AUTO-TRIGGER HERE (AFTER SAVE, BEFORE COMMIT)
        // ============================================================================
        // AUTO-TRIGGER: Create review when survey is published
        if (justPublished) {
            try {
                // Populate necessary fields for review creation
                const populatedSurvey = yield survey_model_1.default.findById(surveyId)
                    .populate({
                    path: 'project',
                    populate: { path: 'organization' }
                })
                    .populate('projectSite')
                    .populate('stakeholderGroup')
                    .populate('theoryOfChangeStage')
                    .session(session);
                if (populatedSurvey && req.user) {
                    // Import the review helper at the top of the file
                    // import { createSurveyConfigReview } from '../utils/reviewHelpers';
                    yield (0, reviewHelpers_1.createSurveyConfigReview)(populatedSurvey, req.user._id);
                    console.log(`✅ Review auto-created for published survey: ${populatedSurvey.title}`);
                }
            }
            catch (reviewError) {
                // Non-blocking - log error but don't fail the request
                console.error('Failed to create review for survey config:', reviewError);
            }
        }
        // ============================================================================
        // END OF AUTO-TRIGGER
        // ============================================================================
        yield session.commitTransaction();
        // Return updated survey with populated fields
        const updatedSurvey = yield survey_model_1.default.findById(surveyId)
            .populate('project', 'name')
            .populate('stakeholderGroup', 'name group')
            .populate('theoryOfChangeStage', 'stageNumber status')
            .populate('projectSite', 'name');
        const categoryName = updatedSurvey.category === 'custom' ?
            updatedSurvey.customCategoryName : updatedSurvey.category;
        const sequence = updatedSurvey.sequenceNumber > 1 ? ` #${updatedSurvey.sequenceNumber}` : '';
        const displayName = `${updatedSurvey.title} (${categoryName}${sequence})`;
        res.status(200).json({
            success: true,
            message: 'Survey updated successfully',
            data: Object.assign(Object.assign({}, updatedSurvey.toObject()), { displayName })
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.updateSurvey = updateSurvey;
/**
 * Calculate sample size for survey
 * @route POST /api/v1/surveys/:id/calculate-sample-size
 * @access Private
 */
const calculateSampleSize = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const surveyId = req.params.id;
        const { populationSize, confidenceLevel = 95, marginOfError = 5 } = req.body;
        if (!populationSize || populationSize <= 0) {
            const error = new Error('Valid population size is required');
            error.statusCode = 400;
            throw error;
        }
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        // Calculate sample size using statistical formula
        const zScore = confidenceLevel === 99 ? 2.576 : confidenceLevel === 95 ? 1.96 : 1.645;
        const p = 0.5; // Maximum variability
        const e = marginOfError / 100;
        // Basic sample size formula: n = (Z² × p × (1-p)) / E²
        const basicSampleSize = Math.ceil((Math.pow(zScore, 2) * p * (1 - p)) / Math.pow(e, 2));
        // Adjust for finite population: n_adj = n / (1 + (n-1)/N)
        const adjustedSampleSize = Math.ceil(basicSampleSize / (1 + (basicSampleSize - 1) / populationSize));
        const finalSampleSize = Math.min(adjustedSampleSize, populationSize);
        // Update survey with calculation
        // Initialize settings if it doesn't exist
        if (!survey.settings) {
            survey.settings = {
                isPublic: false,
                requiresAuth: true,
                allowAnonymous: false,
                allowMultipleResponses: false,
                showProgressBar: true,
                allowSaveAndContinue: true,
                randomizeQuestions: false,
                sendConfirmationEmail: false,
                notifyOnResponse: false
            };
        }
        const newCalculation = {
            populationSize,
            confidenceLevel,
            marginOfError,
            recommendedSampleSize: finalSampleSize,
            calculatedAt: new Date()
        };
        // Keep settings.samplingCalculator as the current/latest for backward compat
        survey.settings.samplingCalculator = Object.assign(Object.assign({}, newCalculation), { isEnabled: true });
        // Push to history array, newest first, capped at 5
        const history = [...(survey.samplingCalculations || [])];
        history.unshift(newCalculation);
        if (history.length > 5)
            history.length = 5;
        survey.set('samplingCalculations', history);
        if (req.user) {
            survey.lastUpdatedBy = req.user._id;
        }
        yield survey.save();
        res.status(200).json({
            success: true,
            message: 'Sample size calculated successfully',
            data: {
                populationSize,
                confidenceLevel,
                marginOfError,
                recommendedSampleSize: finalSampleSize,
                calculationDetails: {
                    basicSampleSize,
                    adjustedSampleSize,
                    zScore
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.calculateSampleSize = calculateSampleSize;
/**
 * Get sample size calculation for survey
 * @route GET /api/v1/surveys/:id/sample-size
 * @access Private
 */
const getSampleSizeCalculation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const surveyId = req.params.id;
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        const current = (_a = survey.settings) === null || _a === void 0 ? void 0 : _a.samplingCalculator;
        const history = survey.samplingCalculations || [];
        if (!(current === null || current === void 0 ? void 0 : current.isEnabled) && history.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No sampling calculation found',
                data: null
            });
        }
        res.status(200).json({
            success: true,
            data: {
                current: (current === null || current === void 0 ? void 0 : current.isEnabled) ? current : null,
                history
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSampleSizeCalculation = getSampleSizeCalculation;
// ===============================
// SURVEY BUILDER SPECIFIC METHODS
// ===============================
/**
 * Get filtered questions for survey creation
 * @route GET /api/v1/surveys/builder/questions/filtered
 * @access Private
 */
const getFilteredQuestionsForSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stakeholderGroupId, stageId, projectId, projectSiteId, includeFrequentlyAsked, includeBespoke, themeIds, subThemeIds, questionType, searchTerm, page, limit } = req.query;
        // Validate required parameters
        if (!stakeholderGroupId || !stageId) {
            const error = new Error('Stakeholder group ID and stage ID are required');
            error.statusCode = 400;
            throw error;
        }
        // Check if user has access to the project
        if (projectId) {
            const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
            if (!hasAccess) {
                const error = new Error('Not authorized to access this project');
                error.statusCode = 403;
                throw error;
            }
        }
        // Parse array parameters
        const parsedThemeIds = themeIds ? themeIds.split(',') : undefined;
        const parsedSubThemeIds = subThemeIds ? subThemeIds.split(',') : undefined;
        const result = yield (0, questionFiltering_service_1.getFilteredQuestions)({
            stakeholderGroupId: stakeholderGroupId,
            stageId: stageId,
            projectId: projectId,
            projectSiteId: projectSiteId,
            includeFrequentlyAsked: includeFrequentlyAsked === 'true',
            themeIds: parsedThemeIds,
            subThemeIds: parsedSubThemeIds,
            questionType: questionType,
            searchTerm: searchTerm,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 50
        });
        // NEW: Add bespoke questions if requested and projectId is provided
        let bespokeQuestions = [];
        if (includeBespoke === 'true' && projectId) {
            bespokeQuestions = yield question_model_1.default.getAvailableBespokeQuestionsForProject(projectId);
        }
        res.status(200).json({
            success: true,
            message: 'Filtered questions retrieved successfully',
            data: Object.assign(Object.assign({}, result), { bespokeQuestions: bespokeQuestions, totalWithBespoke: result.totalCount + bespokeQuestions.length }),
            pagination: {
                currentPage: parseInt(page) || 1,
                totalPages: Math.ceil(result.totalCount / (parseInt(limit) || 50)),
                totalItems: result.totalCount,
                itemsPerPage: parseInt(limit) || 50
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getFilteredQuestionsForSurvey = getFilteredQuestionsForSurvey;
/**
 * Get survey creation context
 * @route GET /api/v1/surveys/builder/context/:stakeholderGroupId/:stageId
 * @access Private
 */
const getSurveyBuilderContext = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stakeholderGroupId, stageId } = req.params;
        const context = yield (0, questionFiltering_service_1.getSurveyCreationContext)(stakeholderGroupId, stageId);
        // Check if user has access to the project
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, context.stakeholderGroup.project.toString());
        if (!hasAccess) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        res.status(200).json({
            success: true,
            message: 'Survey creation context retrieved successfully',
            data: context
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSurveyBuilderContext = getSurveyBuilderContext;
// ===============================
// UPDATED STRUCTURAL METHODS
// ===============================
/**
 * Get full survey structure with sections and questions (ENHANCED)
 * @route GET /api/v1/surveys/:id/structure
 * @access Private
 */
const getSurveyStructure = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const surveyId = req.params.id;
        // Check if survey exists with full population
        const survey = yield survey_model_1.default.findById(surveyId)
            .populate('project', 'name description')
            .populate('stakeholderGroup', 'name group description')
            .populate('theoryOfChangeStage', 'stageNumber status')
            .populate('projectSite', 'name description')
            .populate('creator', 'name email');
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Survey is archived');
            error.statusCode = 410;
            throw error;
        }
        // Enhanced authorization check
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project._id.toString());
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        // Get all sections
        const sections = yield surveySection_model_1.default.find({
            survey: surveyId,
            archived: { $ne: true }
        }).sort('order');
        // Get all questions with enhanced population
        const questions = yield surveyQuestion_model_1.default.find({
            survey: surveyId,
            archived: { $ne: true }
        }).populate({
            path: 'question',
            select: 'text description type options scaleConfig matrixConfig validation targetAudience categories theme subThemes isStandardDemographic demographicType demographicCategory demographicMetadata isGlobalStandard conditionalLogic isBespoke bespokeMetadata'
        }).sort('order');
        // Organize questions by section
        const questionsMap = new Map();
        // First collect questions with no section
        const noSectionQuestions = questions.filter(q => !q.section);
        // Then group by section
        questions.forEach(question => {
            var _a;
            if (question.section) {
                const sectionId = question.section.toString();
                if (!questionsMap.has(sectionId)) {
                    questionsMap.set(sectionId, []);
                }
                (_a = questionsMap.get(sectionId)) === null || _a === void 0 ? void 0 : _a.push(question);
            }
        });
        // Build display name
        const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
        const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
        const displayName = `${survey.title} (${categoryName}${sequence})`;
        const structure = {
            survey: {
                _id: survey._id,
                title: survey.title,
                description: survey.description || undefined,
                status: survey.status,
                category: survey.category,
                customCategoryName: survey.customCategoryName || undefined,
                sequenceNumber: survey.sequenceNumber,
                settings: survey.settings,
                isTemplate: survey.isTemplate,
                estimatedDuration: survey.estimatedDuration,
                totalQuestions: survey.totalQuestions,
                displayName,
                project: survey.project,
                stakeholderGroup: survey.stakeholderGroup,
                theoryOfChangeStage: survey.theoryOfChangeStage,
                projectSite: survey.projectSite,
                creator: survey.creator,
                createdAt: survey.createdAt,
                updatedAt: survey.updatedAt
            },
            noSectionQuestions,
            sections: sections.map(section => ({
                _id: section._id,
                title: section.title,
                description: section.description || undefined,
                order: section.order,
                questions: questionsMap.get(section._id.toString()) || []
            })),
            totalSections: sections.length,
            totalQuestions: questions.length
        };
        res.status(200).json({
            success: true,
            data: structure
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid survey ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSurveyStructure = getSurveyStructure;
/**
 * Get survey sections (ENHANCED)
 * @route GET /api/v1/surveys/:id/sections
 * @access Private
 */
const getSurveySections = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const surveyId = req.params.id;
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Survey is archived');
            error.statusCode = 410;
            throw error;
        }
        // Enhanced authorization check
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        // Get sections with question counts
        const sections = yield surveySection_model_1.default.aggregate([
            {
                $match: {
                    survey: new mongoose_1.default.Types.ObjectId(surveyId),
                    archived: { $ne: true }
                }
            },
            {
                $lookup: {
                    from: 'surveyquestions',
                    localField: '_id',
                    foreignField: 'section',
                    as: 'questions'
                }
            },
            {
                $addFields: {
                    questionCount: { $size: '$questions' }
                }
            },
            {
                $project: {
                    questions: 0 // Remove the questions array, keep only count
                }
            },
            {
                $sort: { order: 1 }
            }
        ]);
        res.status(200).json({
            success: true,
            count: sections.length,
            data: sections
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid survey ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSurveySections = getSurveySections;
/**
 * Get survey questions (ENHANCED)
 * @route GET /api/v1/surveys/:id/questions
 * @access Private
 */
const getSurveyQuestions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const surveyId = req.params.id;
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Survey is archived');
            error.statusCode = 410;
            throw error;
        }
        // Enhanced authorization check
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        // Build query
        let query = surveyQuestion_model_1.default.find({
            survey: surveyId,
            archived: { $ne: true }
        });
        // Filter by section if provided
        if (req.query.section) {
            query = query.find({ section: req.query.section });
        }
        // Enhanced population with demographic info
        query = query.populate({
            path: 'question',
            select: 'text description type options scaleConfig matrixConfig validation targetAudience categories theme subThemes isStandardDemographic demographicType demographicCategory demographicMetadata isGlobalStandard conditionalLogic isBespoke bespokeMetadata'
        }).populate({
            path: 'section',
            select: 'title description order'
        });
        // Sort by order within sections
        query = query.sort('order');
        const questions = yield query;
        res.status(200).json({
            success: true,
            count: questions.length,
            data: questions
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid survey ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSurveyQuestions = getSurveyQuestions;
/**
 * Archive survey (ENHANCED)
 * @route DELETE /api/v1/surveys/:id
 * @access Private
 */
const archiveSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const surveyId = req.params.id;
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Survey is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Enhanced authorization check
        if (!(0, authHelpers_1.isCreatorOrHasAccess)(req, survey.creator, survey.project)) {
            const error = new Error('Not authorized to archive this survey');
            error.statusCode = 403;
            throw error;
        }
        // Don't allow archiving if survey has active responses
        const activeResponseCount = yield mongoose_1.default.model('SurveyResponse').countDocuments({
            survey: surveyId,
            status: { $in: ['started', 'inProgress'] }
        });
        if (activeResponseCount > 0) {
            const error = new Error('Cannot archive survey with active responses');
            error.statusCode = 400;
            throw error;
        }
        // Archive the survey
        survey.archived = true;
        survey.archivedAt = new Date();
        survey.status = 'archived';
        if (req.user) {
            survey.lastUpdatedBy = req.user._id;
        }
        yield survey.save({ session });
        yield session.commitTransaction();
        res.status(200).json({
            success: true,
            message: 'Survey archived successfully',
            data: survey
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.archiveSurvey = archiveSurvey;
/**
 * Restore archived survey (ENHANCED)
 * @route POST /api/v1/surveys/:id/restore
 * @access Private
 */
const restoreSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const surveyId = req.params.id;
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (!survey.archived) {
            const error = new Error('Survey is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Enhanced authorization check
        if (!(0, authHelpers_1.isCreatorOrHasAccess)(req, survey.creator, survey.project)) {
            const error = new Error('Not authorized to restore this survey');
            error.statusCode = 403;
            throw error;
        }
        // Restore the survey
        survey.archived = false;
        survey.set('archivedAt', null);
        survey.status = 'draft';
        if (req.user) {
            survey.lastUpdatedBy = req.user._id;
        }
        yield survey.save({ session });
        yield session.commitTransaction();
        const restoredSurvey = yield survey_model_1.default.findById(surveyId)
            .populate('project', 'name')
            .populate('stakeholderGroup', 'name group')
            .populate('theoryOfChangeStage', 'stageNumber status');
        res.status(200).json({
            success: true,
            message: 'Survey restored successfully',
            data: restoredSurvey
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.restoreSurvey = restoreSurvey;
/**
 * Permanently delete survey (ENHANCED) - ConnectGo Staff Only
 * @route DELETE /api/v1/surveys/:id/permanent
 * @access Private (ConnectGo Staff)
 */
const deleteSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const surveyId = req.params.id;
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can permanently delete surveys');
            error.statusCode = 403;
            throw error;
        }
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check for any responses - don't allow deletion if responses exist
        const responseCount = yield mongoose_1.default.model('SurveyResponse').countDocuments({
            survey: surveyId
        });
        if (responseCount > 0) {
            const error = new Error('Cannot permanently delete survey with responses');
            error.statusCode = 400;
            throw error;
        }
        // Delete all related data
        yield Promise.all([
            surveyQuestion_model_1.default.deleteMany({ survey: surveyId }, { session }),
            surveySection_model_1.default.deleteMany({ survey: surveyId }, { session }),
            survey_model_1.default.findByIdAndDelete(surveyId, { session })
        ]);
        yield session.commitTransaction();
        res.status(200).json({
            success: true,
            message: 'Survey permanently deleted'
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.deleteSurvey = deleteSurvey;
/**
 * Clone survey (ENHANCED)
 * @route POST /api/v1/surveys/:id/clone
 * @access Private
 */
const cloneSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const surveyId = req.params.id;
        const { title, projectId, stakeholderGroupId } = req.body;
        // Find the source survey
        const sourceSurvey = yield survey_model_1.default.findById(surveyId);
        if (!sourceSurvey) {
            const error = new Error('Source survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Enhanced authorization check
        const hasSourceAccess = (0, authHelpers_1.userHasProjectAccess)(req, sourceSurvey.project.toString());
        if (!hasSourceAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access source survey');
            error.statusCode = 403;
            throw error;
        }
        // Validate target project and stakeholder group if different
        const targetProjectId = projectId || sourceSurvey.project;
        const targetStakeholderGroupId = stakeholderGroupId || sourceSurvey.stakeholderGroup;
        const hasTargetAccess = (0, authHelpers_1.userHasProjectAccess)(req, targetProjectId.toString());
        if (!hasTargetAccess) {
            const error = new Error('Not authorized to create surveys in target project');
            error.statusCode = 403;
            throw error;
        }
        // Clone the survey with new data
        const clonedSurvey = new survey_model_1.default(Object.assign(Object.assign({}, sourceSurvey.toObject()), { _id: undefined, title: title || `${sourceSurvey.title} (Copy)`, project: targetProjectId, stakeholderGroup: targetStakeholderGroupId, status: 'draft', creator: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id, lastUpdatedBy: (_c = req.user) === null || _c === void 0 ? void 0 : _c._id, createdAt: undefined, updatedAt: undefined, archived: false, archivedAt: null }));
        yield clonedSurvey.save({ session });
        // Clone sections and questions
        const sections = yield surveySection_model_1.default.find({ survey: surveyId });
        const questions = yield surveyQuestion_model_1.default.find({ survey: surveyId });
        const sectionMap = new Map();
        // Clone sections
        for (const section of sections) {
            const newSection = new surveySection_model_1.default(Object.assign(Object.assign({}, section.toObject()), { _id: undefined, survey: clonedSurvey._id, createdAt: undefined, updatedAt: undefined }));
            yield newSection.save({ session });
            sectionMap.set(section._id.toString(), newSection._id);
        }
        // Clone questions
        for (const question of questions) {
            const newQuestion = new surveyQuestion_model_1.default(Object.assign(Object.assign({}, question.toObject()), { _id: undefined, survey: clonedSurvey._id, section: question.section ? sectionMap.get(question.section.toString()) : undefined, createdAt: undefined, updatedAt: undefined }));
            yield newQuestion.save({ session });
        }
        yield session.commitTransaction();
        // Return populated cloned survey
        const populatedClonedSurvey = yield survey_model_1.default.findById(clonedSurvey._id)
            .populate('project', 'name')
            .populate('stakeholderGroup', 'name group')
            .populate('theoryOfChangeStage', 'stageNumber status');
        res.status(201).json({
            success: true,
            message: 'Survey cloned successfully',
            data: populatedClonedSurvey
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.cloneSurvey = cloneSurvey;
/**
 * Attach consent form to survey
 * @route PUT /api/v1/surveys/:id/consent-form
 * @access Private
 */
const attachConsentFormToSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const surveyId = req.params.id;
        const { consentFormId, consentRequired } = req.body;
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Cannot update archived survey');
            error.statusCode = 400;
            throw error;
        }
        // Check permissions
        if (!(0, authHelpers_1.isCreatorOrHasAccess)(req, survey.creator, survey.project)) {
            const error = new Error('Not authorized to update this survey');
            error.statusCode = 403;
            throw error;
        }
        // Validate consent form
        if (consentFormId) {
            const consentForm = yield mongoose_1.default.model('ConsentForm').findById(consentFormId);
            if (!consentForm) {
                const error = new Error('Consent form not found');
                error.statusCode = 404;
                throw error;
            }
            if (!consentForm.isActive || consentForm.archived) {
                const error = new Error('Cannot use inactive or archived consent form');
                error.statusCode = 400;
                throw error;
            }
        }
        // Update survey
        survey.consentForm = consentFormId || null;
        survey.consentRequired = consentRequired !== undefined ? consentRequired : true;
        if (req.user) {
            survey.lastUpdatedBy = req.user._id;
        }
        yield survey.save({ session });
        yield session.commitTransaction();
        const updatedSurvey = yield survey_model_1.default.findById(surveyId)
            .populate('consentForm')
            .populate('project', 'name')
            .populate('stakeholderGroup', 'name');
        res.status(200).json({
            success: true,
            message: 'Consent form attached to survey successfully',
            data: updatedSurvey
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.attachConsentFormToSurvey = attachConsentFormToSurvey;
// Add to survey.controller.ts if not already present
/**
 * Get public survey data (survey info + structure) for respondents without auth
 * @route GET /api/v1/surveys/:id/public-data
 * @access Public (only works for published surveys)
 */
const getPublicSurveyData = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const surveyId = req.params.id;
        const survey = yield survey_model_1.default.findById(surveyId)
            .populate('project', 'name')
            .populate('stakeholderGroup', 'name');
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.archived) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.status !== 'published') {
            const error = new Error('Survey is not available');
            error.statusCode = 400;
            throw error;
        }
        const isPublic = ((_a = survey.settings) === null || _a === void 0 ? void 0 : _a.isPublic) === true;
        // For private surveys, return minimal info so frontend can redirect to login
        if (!isPublic) {
            return res.status(200).json({
                success: true,
                data: {
                    requiresAuth: true,
                    title: survey.title,
                    description: survey.description,
                    status: survey.status,
                    settings: { isPublic: false }
                }
            });
        }
        // For public surveys, return full structure
        const sections = yield surveySection_model_1.default.find({
            survey: surveyId,
            archived: { $ne: true }
        }).sort('order');
        const questions = yield surveyQuestion_model_1.default.find({
            survey: surveyId,
            archived: { $ne: true }
        }).populate({
            path: 'question',
            select: 'text description type options scaleConfig matrixConfig validation conditionalLogic'
        }).sort('order');
        const noSectionQuestions = questions.filter(q => !q.section);
        const sectionsWithQuestions = sections.map(section => ({
            _id: section._id,
            title: section.title,
            description: section.description,
            order: section.order,
            questions: questions.filter(q => { var _a; return ((_a = q.section) === null || _a === void 0 ? void 0 : _a.toString()) === section._id.toString(); })
        }));
        return res.status(200).json({
            success: true,
            data: {
                requiresAuth: false,
                survey: {
                    _id: survey._id,
                    title: survey.title,
                    description: survey.description,
                    status: survey.status,
                    settings: survey.settings,
                    consentRequired: survey.consentRequired,
                    project: survey.project,
                    stakeholderGroup: survey.stakeholderGroup
                },
                sections: sectionsWithQuestions,
                noSectionQuestions,
                totalQuestions: questions.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getPublicSurveyData = getPublicSurveyData;
/**
 * Get consent form for survey (public access for respondents)
 * @route GET /api/v1/surveys/:id/consent-form/public
 * @access Public
 */
const getPublicSurveyConsentForm = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const surveyId = req.params.id;
        const survey = yield survey_model_1.default.findById(surveyId)
            .populate({
            path: 'consentForm',
            match: { isActive: true, archived: { $ne: true } }
        });
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.status !== 'published') {
            const error = new Error('Survey is not available');
            error.statusCode = 400;
            throw error;
        }
        // If survey doesn't require consent or doesn't have a consent form
        if (!survey.consentForm || !survey.consentRequired) {
            return res.status(200).json({
                success: true,
                data: {
                    hasConsent: false,
                    consentRequired: false
                }
            });
        }
        // Return consent form details
        const consentForm = survey.consentForm;
        res.status(200).json({
            success: true,
            data: {
                hasConsent: true,
                consentRequired: survey.consentRequired,
                consentForm: {
                    _id: consentForm._id,
                    name: consentForm.name,
                    description: consentForm.description,
                    agreementLabel: consentForm.agreementLabel,
                    version: consentForm.version,
                    defaultLanguage: consentForm.defaultLanguage,
                    translations: consentForm.translations
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getPublicSurveyConsentForm = getPublicSurveyConsentForm;
//# sourceMappingURL=survey.controller.js.map