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
exports.cloneSurveyWithCategory = exports.getStakeholderSurveyStats = exports.updateSurveyCategory = exports.getSurveysByProjectAndStage = exports.getSurveysByStakeholder = exports.createCategorizedSurvey = exports.getSurveyBuilderContext = exports.getFilteredQuestionsForSurvey = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const survey_model_1 = __importDefault(require("../models/survey.model"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const theoryOfChangeStage_model_1 = __importDefault(require("../models/theoryOfChangeStage.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const questionFiltering_service_1 = require("../services/questionFiltering.service");
const authHelpers_1 = require("../lib/authHelpers");
/**
 * Get filtered questions for survey creation (Module 1)
 * @route GET /api/v1/survey-builder/questions/filtered
 * @access Private
 */
const getFilteredQuestionsForSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stakeholderGroupId, stageId, projectId, projectSiteId, includeFrequentlyAsked, themeIds, subThemeIds, questionType, searchTerm, page, limit } = req.query;
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
        res.status(200).json({
            success: true,
            message: 'Filtered questions retrieved successfully',
            data: result,
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
 * @route GET /api/v1/survey-builder/context/:stakeholderGroupId/:stageId
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
/**
 * Create a new survey with enhanced categorization (Module 2)
 * @route POST /api/v1/survey-builder/surveys
 * @access Private
 */
const createCategorizedSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { title, description, projectId, projectSiteId, stakeholderGroupId, stageId, category, customCategoryName, settings, isTemplate, templateCategory, estimatedDuration } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Validate required fields
        if (!title || !projectId || !stakeholderGroupId || !stageId) {
            const error = new Error('Title, project ID, stakeholder group ID, and stage ID are required');
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
        // Check if project site exists (if provided)
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
        // Check if stakeholder group exists
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderGroupId);
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if stage exists
        const stage = yield theoryOfChangeStage_model_1.default.findById(stageId);
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
        // Create the survey
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
            .populate('projectSite', 'name')
            .populate('theoryOfChangeStage', 'stageNumber name')
            .populate('stakeholderGroup', 'name category')
            .populate('creator', 'name email');
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
exports.createCategorizedSurvey = createCategorizedSurvey;
/**
 * Get all surveys for a stakeholder group
 * @route GET /api/v1/survey-builder/surveys/stakeholder/:stakeholderGroupId
 * @access Private
 */
const getSurveysByStakeholder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stakeholderGroupId } = req.params;
        const { stageId, category, status } = req.query;
        // Build query
        const query = {
            stakeholderGroup: stakeholderGroupId,
            archived: { $ne: true }
        };
        if (stageId)
            query.theoryOfChangeStage = stageId;
        if (category)
            query.category = category;
        if (status)
            query.status = status;
        const surveys = yield survey_model_1.default.find(query)
            .populate('project', 'name')
            .populate('projectSite', 'name')
            .populate('theoryOfChangeStage', 'stageNumber name')
            .populate('stakeholderGroup', 'name category')
            .populate('creator', 'name')
            .sort({ category: 1, sequenceNumber: 1, createdAt: -1 });
        // Check if user has access to at least one survey's project
        if (surveys.length > 0) {
            const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, surveys[0].project._id.toString());
            if (!hasAccess) {
                const error = new Error('Not authorized to access these surveys');
                error.statusCode = 403;
                throw error;
            }
        }
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
 * Get surveys by project and stage
 * @route GET /api/v1/survey-builder/surveys/project/:projectId/stage/:stageId
 * @access Private
 */
const getSurveysByProjectAndStage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, stageId } = req.params;
        const { projectSiteId } = req.query;
        // Check project access
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        // Build query
        const query = {
            project: projectId,
            theoryOfChangeStage: stageId,
            archived: { $ne: true }
        };
        if (projectSiteId) {
            query.projectSite = projectSiteId;
        }
        const surveys = yield survey_model_1.default.find(query)
            .populate('projectSite', 'name')
            .populate('theoryOfChangeStage', 'stageNumber name')
            .populate('stakeholderGroup', 'name category')
            .populate('creator', 'name')
            .sort({ 'stakeholderGroup.name': 1, category: 1, sequenceNumber: 1 });
        // Group by stakeholder group
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
            acc[stakeholderId].surveys.push({
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
 * @route PUT /api/v1/survey-builder/surveys/:surveyId/category
 * @access Private
 */
const updateSurveyCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { surveyId } = req.params;
        const { category, customCategoryName } = req.body;
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check permissions
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess) {
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
 * @route GET /api/v1/survey-builder/stats/stakeholder/:stakeholderGroupId
 * @access Private
 */
const getStakeholderSurveyStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
            const error = new Error('Not authorized to access this data');
            error.statusCode = 403;
            throw error;
        }
        // Get survey statistics
        const [totalSurveys, draftSurveys, publishedSurveys, surveysByCategory] = yield Promise.all([
            survey_model_1.default.countDocuments({
                stakeholderGroup: stakeholderGroupId,
                archived: { $ne: true }
            }),
            survey_model_1.default.countDocuments({
                stakeholderGroup: stakeholderGroupId,
                status: 'draft',
                archived: { $ne: true }
            }),
            survey_model_1.default.countDocuments({
                stakeholderGroup: stakeholderGroupId,
                status: 'published',
                archived: { $ne: true }
            }),
            survey_model_1.default.aggregate([
                {
                    $match: {
                        stakeholderGroup: new mongoose_1.default.Types.ObjectId(stakeholderGroupId),
                        archived: { $ne: true }
                    }
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        customNames: {
                            $push: {
                                $cond: [
                                    { $eq: ['$category', 'custom'] },
                                    '$customCategoryName',
                                    null
                                ]
                            }
                        }
                    }
                }
            ])
        ]);
        res.status(200).json({
            success: true,
            data: {
                stakeholderGroup: {
                    _id: stakeholderGroup._id,
                    name: stakeholderGroup.name,
                    project: stakeholderGroup.project
                },
                stats: {
                    totalSurveys,
                    draftSurveys,
                    publishedSurveys,
                    closedSurveys: totalSurveys - draftSurveys - publishedSurveys,
                    surveysByCategory: surveysByCategory.map((cat) => ({
                        category: cat._id,
                        count: cat.count,
                        customNames: cat.customNames.filter((name) => name !== null)
                    }))
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStakeholderSurveyStats = getStakeholderSurveyStats;
/**
 * Clone a survey with new category
 * @route POST /api/v1/survey-builder/surveys/:surveyId/clone
 * @access Private
 */
const cloneSurveyWithCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { surveyId } = req.params;
        const { newTitle, category, customCategoryName } = req.body;
        const originalSurvey = yield survey_model_1.default.findById(surveyId);
        if (!originalSurvey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check permissions
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, originalSurvey.project.toString());
        if (!hasAccess) {
            const error = new Error('Not authorized to clone this survey');
            error.statusCode = 403;
            throw error;
        }
        // Create cloned survey
        const clonedSurvey = new survey_model_1.default(Object.assign(Object.assign({}, originalSurvey.toObject()), { _id: new mongoose_1.default.Types.ObjectId(), title: newTitle || `${originalSurvey.title} (Copy)`, category: category || originalSurvey.category, customCategoryName: customCategoryName || originalSurvey.customCategoryName, status: 'draft', creator: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id, lastUpdatedBy: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id, createdAt: new Date(), updatedAt: new Date() }));
        yield clonedSurvey.save({ session });
        // Clone survey sections and questions (if they exist)
        const SurveySection = mongoose_1.default.model('SurveySection');
        const SurveyQuestion = mongoose_1.default.model('SurveyQuestion');
        const sections = yield SurveySection.find({
            survey: surveyId,
            archived: { $ne: true }
        });
        const sectionMap = new Map();
        for (const section of sections) {
            const newSection = new SurveySection(Object.assign(Object.assign({}, section.toObject()), { _id: new mongoose_1.default.Types.ObjectId(), survey: clonedSurvey._id, createdAt: new Date(), updatedAt: new Date() }));
            yield newSection.save({ session });
            sectionMap.set(section._id.toString(), newSection._id);
        }
        const questions = yield SurveyQuestion.find({
            survey: surveyId,
            archived: { $ne: true }
        });
        for (const question of questions) {
            const newQuestion = new SurveyQuestion(Object.assign(Object.assign({}, question.toObject()), { _id: new mongoose_1.default.Types.ObjectId(), survey: clonedSurvey._id, section: question.section ? sectionMap.get(question.section.toString()) : undefined, createdAt: new Date(), updatedAt: new Date() }));
            yield newQuestion.save({ session });
        }
        yield session.commitTransaction();
        const populatedSurvey = yield survey_model_1.default.findById(clonedSurvey._id)
            .populate('project', 'name')
            .populate('projectSite', 'name')
            .populate('theoryOfChangeStage', 'stageNumber name')
            .populate('stakeholderGroup', 'name category')
            .populate('creator', 'name');
        res.status(201).json({
            success: true,
            message: 'Survey cloned successfully',
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
exports.cloneSurveyWithCategory = cloneSurveyWithCategory;
//# sourceMappingURL=surveyBuilder.controller.js.map