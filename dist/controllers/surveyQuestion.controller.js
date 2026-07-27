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
exports.updateSurveyQuestionConditionalLogic = exports.bulkAddQuestionsWithDependencies = exports.reorderQuestions = exports.moveQuestion = exports.deleteSurveyQuestion = exports.updateSurveyQuestion = exports.getSurveyQuestion = exports.addQuestionToSurvey = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const surveyQuestion_model_1 = __importDefault(require("../models/surveyQuestion.model"));
const surveySection_model_1 = __importDefault(require("../models/surveySection.model"));
const survey_model_1 = __importDefault(require("../models/survey.model"));
const question_model_1 = __importDefault(require("../models/question.model"));
const authHelpers_1 = require("../lib/authHelpers");
const question_controller_1 = require("./question.controller");
const reviewHelpers_1 = require("../utils/reviewHelpers");
/**
 * Helper function to process location demographic questions
 * Replaces question options with project sites
 */
const processLocationDemographics = (surveyId, questionId, customOptions) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get the question
        const question = yield question_model_1.default.findById(questionId);
        if (!question || !question.isStandardDemographic || question.demographicType !== 'location') {
            return customOptions; // Not a location demographic, return as-is
        }
        // Get the survey to find the project
        const survey = yield survey_model_1.default.findById(surveyId).populate('project');
        if (!survey) {
            return customOptions;
        }
        // Get project sites
        const ProjectSite = mongoose_1.default.model('ProjectSite');
        const sites = yield ProjectSite.find({
            project: survey.project._id || survey.project,
            archived: { $ne: true }
        }).select('name _id');
        if (sites.length === 0) {
            // No sites found - return null to indicate text field should be used
            return null;
        }
        // Convert sites to options format
        return sites.map(site => ({
            value: site._id.toString(),
            label: site.name
        }));
    }
    catch (error) {
        console.error('Error processing location demographics:', error);
        return customOptions; // Return original options on error
    }
});
/**
 * Add a question to a survey
 * @route POST /api/v1/surveys/:surveyId/questions
 * @access Private
 */
const addQuestionToSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const session = yield surveyQuestion_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const { surveyId } = req.params;
        const { questionId, sectionId, required, customText, customDescription, customOptions, // This might contain project sites from frontend
        conditionalLogic, order } = req.body;
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to modify this survey
        const isCreator = survey.creator.toString() === req.user._id.toString();
        const hasProjectAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isConnectGoStaff = (_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this survey');
            error.statusCode = 403;
            throw error;
        }
        // Check survey status
        if (survey.status === 'closed') {
            const error = new Error('Cannot modify a closed survey');
            error.statusCode = 400;
            throw error;
        }
        // Check if question exists
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if question is archived
        if (question.archived) {
            const error = new Error('Cannot add an archived question');
            error.statusCode = 400;
            throw error;
        }
        // Handle bespoke questions
        if (question.isBespoke) {
            if (((_b = question.bespokeMetadata) === null || _b === void 0 ? void 0 : _b.project.toString()) !== survey.project.toString()) {
                const error = new Error('Bespoke question can only be used in surveys from the same project');
                error.statusCode = 403;
                throw error;
            }
            // pending or approved = usable within the originating project
            // rejected or elevated = blocked
            const usableStatuses = ['pending', 'approved'];
            if (!usableStatuses.includes((_c = question.bespokeMetadata) === null || _c === void 0 ? void 0 : _c.status) && !isConnectGoStaff) {
                const error = new Error('This custom question is not available for use');
                error.statusCode = 400;
                throw error;
            }
        }
        // ✅ NEW: Process conditional logic inheritance
        let inheritedConditionalLogic = conditionalLogic; // Use provided if exists
        if (!inheritedConditionalLogic && ((_d = question.conditionalLogic) === null || _d === void 0 ? void 0 : _d.enabled)) {
            // Inherit from question template
            console.log(`📋 Inheriting conditional logic from question ${questionId}`);
            // Check if dependencies are in the survey
            const dependencyValidation = yield (0, question_controller_1.validateConditionalDependenciesInSurvey)(questionId, surveyId);
            if (!dependencyValidation.isValid) {
                console.warn(`⚠️ Conditional dependencies missing:`, dependencyValidation.missingDependencies);
                // Option 1: Block adding the question
                // const error = new Error(
                //   `Cannot add question with conditional logic. Missing dependencies: ${dependencyValidation.missingDependencies.join(', ')}`
                // ) as CustomError;
                // error.statusCode = 400;
                // throw error;
                // Option 2: Add with warning (current implementation)
                inheritedConditionalLogic = {
                    enabled: false, // Disable until dependencies are met
                    conditions: question.conditionalLogic.conditions,
                    action: question.conditionalLogic.action,
                    logicOperator: question.conditionalLogic.logicOperator,
                    _inheritanceWarning: dependencyValidation.warnings.join('; ')
                };
            }
            else {
                // Map Question IDs to SurveyQuestion IDs
                const surveyQuestions = yield surveyQuestion_model_1.default.find({ survey: surveyId })
                    .populate('question');
                const questionToSurveyQuestionMap = new Map();
                surveyQuestions.forEach((sq) => {
                    questionToSurveyQuestionMap.set(sq.question._id.toString(), sq._id.toString());
                });
                inheritedConditionalLogic = yield (0, question_controller_1.mapConditionalLogicToSurvey)(question.conditionalLogic, surveyId, questionToSurveyQuestionMap);
            }
        }
        // ✅ NEW: Process location demographics
        // If customOptions are NOT provided (null/undefined), check if this is a location demographic
        // and fetch project sites. If customOptions ARE provided, use them as-is.
        let processedOptions = customOptions;
        if (!customOptions && question.isStandardDemographic && question.demographicType === 'location') {
            processedOptions = yield processLocationDemographics(surveyId, questionId, customOptions);
        }
        // Check if section exists if provided
        if (sectionId) {
            const section = yield surveySection_model_1.default.findById(sectionId);
            if (!section) {
                const error = new Error('Section not found');
                error.statusCode = 404;
                throw error;
            }
            // Check if section belongs to this survey
            if (section.survey.toString() !== surveyId) {
                const error = new Error('Section does not belong to this survey');
                error.statusCode = 400;
                throw error;
            }
        }
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(surveyId, { status: 'draft' }, { session });
        }
        // Create the survey question with processed options
        const surveyQuestion = new surveyQuestion_model_1.default({
            question: questionId,
            survey: surveyId,
            section: sectionId || null,
            required: required !== undefined ? required : question.required,
            customText,
            customDescription,
            customOptions: processedOptions,
            conditionalLogic: inheritedConditionalLogic, // ✅ Use inherited/provided conditional logic
            order: order || 0
        });
        yield surveyQuestion.save({ session });
        // ============================================================================
        // 🆕 ADD AUTO-TRIGGER HERE (AFTER SAVE, BEFORE COMMIT)
        // ============================================================================
        // AUTO-TRIGGER: Create review for added question
        try {
            // Populate necessary fields for review creation
            const populatedSurveyQuestion = yield surveyQuestion_model_1.default.findById(surveyQuestion._id)
                .populate({
                path: 'question',
                select: 'text description type options validation targetAudience isBespoke bespokeMetadata isStandardDemographic demographicType'
            })
                .populate({
                path: 'survey',
                populate: {
                    path: 'project',
                    populate: { path: 'organization' }
                }
            })
                .populate('section')
                .session(session);
            if (populatedSurveyQuestion && req.user) {
                // Import the review helper at the top of the file
                // import { createSurveyQuestionReview } from '../utils/reviewHelpers';
                yield (0, reviewHelpers_1.createSurveyQuestionReview)(populatedSurveyQuestion, req.user._id);
                console.log(`✅ Review auto-created for survey question: ${(_e = populatedSurveyQuestion.question.text) === null || _e === void 0 ? void 0 : _e.substring(0, 50)}`);
            }
        }
        catch (reviewError) {
            // Non-blocking - log error but don't fail the request
            console.error('Failed to create review for survey question:', reviewError);
        }
        // ============================================================================
        // END OF AUTO-TRIGGER
        // ============================================================================
        // Populate the question details for the response
        const populatedQuestion = yield surveyQuestion_model_1.default.findById(surveyQuestion._id)
            .populate({
            path: 'question',
            select: 'text description type options validation targetAudience isBespoke bespokeMetadata isStandardDemographic demographicType', // ✅ Added demographic fields
            populate: [
                {
                    path: 'bespokeMetadata.createdBy',
                    select: 'name email'
                },
                {
                    path: 'bespokeMetadata.project',
                    select: 'name'
                }
            ]
        })
            .populate({
            path: 'conditionalLogic.conditions.questionId', // ✅ Populate condition references
            select: 'question'
        });
        yield session.commitTransaction();
        session.endSession();
        // ✅ NEW: Add warning to response if conditional logic was disabled
        const responseData = {
            success: true,
            message: 'Question added to survey successfully',
            data: populatedQuestion
        };
        if (inheritedConditionalLogic === null || inheritedConditionalLogic === void 0 ? void 0 : inheritedConditionalLogic._inheritanceWarning) {
            responseData.warning = inheritedConditionalLogic._inheritanceWarning;
            responseData.message = 'Question added but conditional logic was disabled due to missing dependencies';
        }
        res.status(201).json(responseData);
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.addQuestionToSurvey = addQuestionToSurvey;
/**
 * Get a survey question by ID
 * @route GET /api/v1/survey-questions/:id
 * @access Private
 */
const getSurveyQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const questionId = req.params.id;
        // Find the survey question with populated data
        const surveyQuestion = yield surveyQuestion_model_1.default.findById(questionId)
            .populate({
            path: 'question',
            select: 'text description type options validation targetAudience'
        })
            .populate({
            path: 'section',
            select: 'title'
        });
        if (!surveyQuestion) {
            const error = new Error('Survey question not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to access the survey
        const survey = yield survey_model_1.default.findById(surveyQuestion.survey);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasProjectAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: surveyQuestion
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSurveyQuestion = getSurveyQuestion;
/**
 * Update a survey question
 * @route PUT /api/v1/survey-questions/:id
 * @access Private
 */
const updateSurveyQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield surveyQuestion_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const questionId = req.params.id;
        const { sectionId, required, customText, customDescription, customOptions, conditionalLogic } = req.body;
        // Find the survey question
        const surveyQuestion = yield surveyQuestion_model_1.default.findById(questionId);
        if (!surveyQuestion) {
            const error = new Error('Survey question not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyQuestion.survey);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to modify this survey
        const isCreator = survey.creator.toString() === req.user._id.toString();
        const hasProjectAccess = (_a = req.user) === null || _a === void 0 ? void 0 : _a.hasProjectAccess(survey.project);
        const isConnectGoStaff = (_b = req.user) === null || _b === void 0 ? void 0 : _b.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this survey');
            error.statusCode = 403;
            throw error;
        }
        // Check survey status
        if (survey.status === 'closed') {
            const error = new Error('Cannot modify a closed survey');
            error.statusCode = 400;
            throw error;
        }
        // Check if section exists if provided
        if (sectionId) {
            const section = yield surveySection_model_1.default.findById(sectionId);
            if (!section) {
                const error = new Error('Section not found');
                error.statusCode = 404;
                throw error;
            }
            // Check if section belongs to this survey
            if (section.survey.toString() !== survey._id.toString()) {
                const error = new Error('Section does not belong to this survey');
                error.statusCode = 400;
                throw error;
            }
        }
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
        }
        // Update the survey question
        const updatedQuestion = yield surveyQuestion_model_1.default.findByIdAndUpdate(questionId, {
            section: sectionId,
            required,
            customText,
            customDescription,
            customOptions,
            conditionalLogic
        }, { new: true, runValidators: true, session }).populate({
            path: 'question',
            select: 'text description type options validation targetAudience'
        });
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Survey question updated successfully',
            data: updatedQuestion
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateSurveyQuestion = updateSurveyQuestion;
/**
 * Delete a survey question
 * @route DELETE /api/v1/survey-questions/:id
 * @access Private
 */
const deleteSurveyQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield surveyQuestion_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const questionId = req.params.id;
        // Find the survey question
        const surveyQuestion = yield surveyQuestion_model_1.default.findById(questionId);
        if (!surveyQuestion) {
            const error = new Error('Survey question not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyQuestion.survey);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to modify this survey
        const isCreator = survey.creator.toString() === req.user._id.toString();
        const hasProjectAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isConnectGoStaff = (_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this survey');
            error.statusCode = 403;
            throw error;
        }
        // Check survey status
        if (survey.status === 'closed') {
            const error = new Error('Cannot modify a closed survey');
            error.statusCode = 400;
            throw error;
        }
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
        }
        // Get the section and current order to update other questions
        const sectionId = surveyQuestion.section;
        const currentOrder = surveyQuestion.order;
        // Delete the survey question
        yield surveyQuestion_model_1.default.findByIdAndDelete(questionId, { session });
        // Update order of remaining questions in the same section
        const query = sectionId ?
            { survey: surveyQuestion.survey, section: sectionId, order: { $gt: currentOrder } } :
            { survey: surveyQuestion.survey, section: null, order: { $gt: currentOrder } };
        yield surveyQuestion_model_1.default.updateMany(query, { $inc: { order: -1 } }, { session });
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Survey question deleted successfully',
            data: null
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteSurveyQuestion = deleteSurveyQuestion;
/**
 * Move question to a different section - FIXED FOR NESTED ROUTES
 * @route PUT /api/v1/surveys/:surveyId/questions/:id/move
 * @access Private
 */
const moveQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const session = yield surveyQuestion_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const questionId = req.params.id;
        const surveyId = req.params.surveyId; // Get from nested route params
        const { sectionId } = req.body; // If null, move to no section
        console.log('🔄 moveQuestion called with:', {
            questionId,
            surveyId,
            sectionId,
            body: req.body,
            params: req.params
        });
        // Find the survey question and validate it belongs to the survey
        const surveyQuestion = yield surveyQuestion_model_1.default.findOne({
            _id: questionId,
            survey: surveyId // Ensure question belongs to this survey
        });
        if (!surveyQuestion) {
            const error = new Error('Survey question not found or does not belong to this survey');
            error.statusCode = 404;
            throw error;
        }
        console.log('✅ Found survey question:', {
            id: surveyQuestion._id,
            currentSection: surveyQuestion.section,
            targetSection: sectionId
        });
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to modify this survey
        const authUser = req.user;
        const isCreator = survey.creator.toString() === authUser._id.toString();
        const hasProjectAccess = (_a = authUser.hasProjectAccess) === null || _a === void 0 ? void 0 : _a.call(authUser, survey.project);
        const isConnectGoStaff = authUser.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this survey');
            error.statusCode = 403;
            throw error;
        }
        // Check survey status
        if (survey.status === 'closed') {
            const error = new Error('Cannot modify a closed survey');
            error.statusCode = 400;
            throw error;
        }
        // Check if target section exists and belongs to this survey
        if (sectionId) {
            const section = yield surveySection_model_1.default.findOne({
                _id: sectionId,
                survey: surveyId // Ensure section belongs to this survey
            });
            if (!section) {
                const error = new Error('Target section not found or does not belong to this survey');
                error.statusCode = 404;
                throw error;
            }
            console.log('✅ Found target section:', {
                id: section._id,
                title: section.title
            });
        }
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
        }
        // Get the current section and order
        const currentSectionId = surveyQuestion.section;
        const currentOrder = surveyQuestion.order;
        console.log('📊 Current state:', {
            currentSectionId: currentSectionId === null || currentSectionId === void 0 ? void 0 : currentSectionId.toString(),
            currentOrder,
            targetSectionId: sectionId
        });
        // Update the order of remaining questions in the current section
        if (currentSectionId) {
            const updateResult = yield surveyQuestion_model_1.default.updateMany({
                survey: surveyId,
                section: currentSectionId,
                order: { $gt: currentOrder }
            }, { $inc: { order: -1 } }, { session });
            console.log('📝 Updated remaining questions in current section:', updateResult);
        }
        else {
            const updateResult = yield surveyQuestion_model_1.default.updateMany({
                survey: surveyId,
                section: null,
                order: { $gt: currentOrder }
            }, { $inc: { order: -1 } }, { session });
            console.log('📝 Updated remaining questions in no section:', updateResult);
        }
        // Find the highest order in the target section (or null section)
        const targetQuery = sectionId ?
            { survey: surveyId, section: sectionId } :
            { survey: surveyId, section: null };
        const highestOrderQuestion = yield surveyQuestion_model_1.default.findOne(targetQuery)
            .sort('-order')
            .exec();
        const newOrder = highestOrderQuestion ? highestOrderQuestion.order + 1 : 1;
        console.log('🎯 Target position:', {
            targetQuery,
            highestOrder: highestOrderQuestion === null || highestOrderQuestion === void 0 ? void 0 : highestOrderQuestion.order,
            newOrder
        });
        // Update the question's section and order
        const updatedQuestion = yield surveyQuestion_model_1.default.findByIdAndUpdate(questionId, {
            section: sectionId || null,
            order: newOrder
        }, { new: true, runValidators: true, session }).populate({
            path: 'question',
            select: 'text description type options validation targetAudience'
        });
        console.log('✅ Question updated:', {
            id: updatedQuestion === null || updatedQuestion === void 0 ? void 0 : updatedQuestion._id,
            newSection: (_b = updatedQuestion === null || updatedQuestion === void 0 ? void 0 : updatedQuestion.section) === null || _b === void 0 ? void 0 : _b.toString(),
            newOrder: updatedQuestion === null || updatedQuestion === void 0 ? void 0 : updatedQuestion.order
        });
        yield session.commitTransaction();
        session.endSession();
        // Verify the update worked by querying the database again
        const verificationQuery = yield surveyQuestion_model_1.default.findById(questionId).select('section order');
        console.log('🔍 Database verification:', {
            questionId,
            actualSection: (_c = verificationQuery === null || verificationQuery === void 0 ? void 0 : verificationQuery.section) === null || _c === void 0 ? void 0 : _c.toString(),
            actualOrder: verificationQuery === null || verificationQuery === void 0 ? void 0 : verificationQuery.order
        });
        res.status(200).json({
            success: true,
            message: 'Survey question moved successfully',
            data: updatedQuestion,
            debug: {
                questionId,
                surveyId,
                fromSection: currentSectionId === null || currentSectionId === void 0 ? void 0 : currentSectionId.toString(),
                toSection: sectionId,
                newOrder,
                verification: {
                    actualSection: (_d = verificationQuery === null || verificationQuery === void 0 ? void 0 : verificationQuery.section) === null || _d === void 0 ? void 0 : _d.toString(),
                    actualOrder: verificationQuery === null || verificationQuery === void 0 ? void 0 : verificationQuery.order
                }
            }
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        console.error('❌ moveQuestion error:', error);
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.moveQuestion = moveQuestion;
/**
 * Reorder questions within a section or the no-section area
 * @route PUT /api/v1/surveys/:surveyId/questions/reorder
 * @access Private
 */
const reorderQuestions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield surveyQuestion_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const { surveyId } = req.params;
        const { questions, sectionId } = req.body;
        // Validate input
        if (!questions || !Array.isArray(questions)) {
            const error = new Error('Questions array is required');
            error.statusCode = 400;
            throw error;
        }
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to modify this survey
        const isCreator = survey.creator.toString() === req.user._id.toString();
        const hasProjectAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isConnectGoStaff = (_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this survey');
            error.statusCode = 403;
            throw error;
        }
        // Check survey status
        if (survey.status === 'closed') {
            const error = new Error('Cannot modify a closed survey');
            error.statusCode = 400;
            throw error;
        }
        // Check if section exists if provided
        if (sectionId) {
            const section = yield surveySection_model_1.default.findById(sectionId);
            if (!section) {
                const error = new Error('Section not found');
                error.statusCode = 404;
                throw error;
            }
            // Check if section belongs to this survey
            if (section.survey.toString() !== surveyId) {
                const error = new Error('Section does not belong to this survey');
                error.statusCode = 400;
                throw error;
            }
        }
        // Get all existing questions in this section (or no section)
        const query = sectionId ?
            { survey: surveyId, section: sectionId } :
            { survey: surveyId, section: null };
        const existingQuestions = yield surveyQuestion_model_1.default.find(query);
        // Type-assert the _id when mapping to handle the 'unknown' type
        const existingQuestionIds = new Set(existingQuestions.map(q => q._id.toString()));
        // Validate that all provided question IDs belong to this section
        for (const questionData of questions) {
            if (!existingQuestionIds.has(questionData.id)) {
                const error = new Error(`Question with ID ${questionData.id} does not belong to this section`);
                error.statusCode = 400;
                throw error;
            }
        }
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(surveyId, { status: 'draft' }, { session });
        }
        // Update the order of each question
        for (let i = 0; i < questions.length; i++) {
            yield surveyQuestion_model_1.default.findByIdAndUpdate(questions[i].id, { order: i + 1 }, { session });
        }
        yield session.commitTransaction();
        session.endSession();
        // Fetch the updated questions
        const updatedQuestions = yield surveyQuestion_model_1.default.find(query)
            .populate({
            path: 'question',
            select: 'text description type options validation targetAudience'
        })
            .sort('order');
        res.status(200).json({
            success: true,
            message: 'Survey questions reordered successfully',
            data: updatedQuestions
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.reorderQuestions = reorderQuestions;
/**
 * NEW: Bulk add questions with dependency resolution
 * This ensures questions are added in the correct order to satisfy conditional dependencies
 * @route POST /api/v1/surveys/:surveyId/questions/bulk-add
 * @access Private
 */
const bulkAddQuestionsWithDependencies = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield surveyQuestion_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const { surveyId } = req.params;
        const { questionIds, sectionId } = req.body;
        if (!Array.isArray(questionIds) || questionIds.length === 0) {
            const error = new Error('Question IDs array is required');
            error.statusCode = 400;
            throw error;
        }
        // Check if survey exists and user has permissions
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        const isCreator = survey.creator.toString() === req.user._id.toString();
        const hasProjectAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isConnectGoStaff = (_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this survey');
            error.statusCode = 403;
            throw error;
        }
        if (survey.status === 'closed') {
            const error = new Error('Cannot modify a closed survey');
            error.statusCode = 400;
            throw error;
        }
        // Get all questions with their dependencies
        const questionsWithDeps = yield question_model_1.default.getQuestionsWithDependencies(questionIds);
        // Sort questions to add dependencies first (topological sort)
        const sortedQuestions = topologicalSortQuestions(questionsWithDeps);
        // Filter to only add the originally requested questions
        const requestedQuestionIds = new Set(questionIds.map(id => id.toString()));
        const questionsToAdd = sortedQuestions.filter(q => requestedQuestionIds.has(q._id.toString()));
        // Add questions in dependency order
        const addedQuestions = [];
        const questionToSurveyQuestionMap = new Map();
        // First get existing survey questions for mapping
        const existingSurveyQuestions = yield surveyQuestion_model_1.default.find({ survey: surveyId })
            .populate('question');
        existingSurveyQuestions.forEach((sq) => {
            questionToSurveyQuestionMap.set(sq.question._id.toString(), sq._id.toString());
        });
        for (const question of questionsToAdd) {
            // Map conditional logic
            const mappedConditionalLogic = yield (0, question_controller_1.mapConditionalLogicToSurvey)(question.conditionalLogic, surveyId, questionToSurveyQuestionMap);
            const surveyQuestion = new surveyQuestion_model_1.default({
                question: question._id,
                survey: surveyId,
                section: sectionId || null,
                required: question.required,
                conditionalLogic: mappedConditionalLogic,
                order: 0 // Will be set by pre-save hook
            });
            yield surveyQuestion.save({ session });
            // Update map for subsequent questions
            questionToSurveyQuestionMap.set(question._id.toString(), surveyQuestion._id.toString());
            addedQuestions.push(surveyQuestion);
        }
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(surveyId, { status: 'draft' }, { session });
        }
        yield session.commitTransaction();
        session.endSession();
        // AUTO-TRIGGER: Create reviews for all bulk-added questions (non-blocking)
        try {
            const populatedForReview = yield surveyQuestion_model_1.default.find({
                _id: { $in: addedQuestions.map(q => q._id) }
            })
                .populate({
                path: 'question',
                select: 'text description type options validation targetAudience isBespoke bespokeMetadata isStandardDemographic demographicType',
            })
                .populate({
                path: 'survey',
                populate: { path: 'project', populate: { path: 'organization' } },
            })
                .populate('section');
            if (req.user) {
                yield Promise.all(populatedForReview.map(sq => (0, reviewHelpers_1.createSurveyQuestionReview)(sq, req.user._id).catch(err => console.error(`Failed to create review for bulk-added question ${sq._id}:`, err))));
            }
        }
        catch (reviewError) {
            console.error('Failed to create reviews for bulk-added questions:', reviewError);
        }
        // Populate and return
        const populatedQuestions = yield surveyQuestion_model_1.default.find({
            _id: { $in: addedQuestions.map(q => q._id) }
        })
            .populate('question')
            .populate('conditionalLogic.conditions.questionId')
            .sort('order');
        res.status(201).json({
            success: true,
            message: `Successfully added ${addedQuestions.length} questions with dependencies resolved`,
            data: populatedQuestions
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.bulkAddQuestionsWithDependencies = bulkAddQuestionsWithDependencies;
/**
 * Helper function for topological sort of questions based on dependencies
 */
function topologicalSortQuestions(questions) {
    const graph = new Map();
    const inDegree = new Map();
    const questionMap = new Map();
    // Build graph
    questions.forEach(q => {
        var _a;
        const qId = q._id.toString();
        questionMap.set(qId, q);
        if (!graph.has(qId)) {
            graph.set(qId, new Set());
            inDegree.set(qId, 0);
        }
        if ((_a = q.conditionalLogic) === null || _a === void 0 ? void 0 : _a.enabled) {
            q.conditionalLogic.conditions.forEach((cond) => {
                const depId = cond.questionId.toString();
                if (!graph.has(depId)) {
                    graph.set(depId, new Set());
                    inDegree.set(depId, 0);
                }
                // depId -> qId (dependency -> dependent)
                graph.get(depId).add(qId);
                inDegree.set(qId, (inDegree.get(qId) || 0) + 1);
            });
        }
    });
    // Kahn's algorithm for topological sort
    const queue = [];
    const sorted = [];
    // Start with questions that have no dependencies
    inDegree.forEach((degree, qId) => {
        if (degree === 0) {
            queue.push(qId);
        }
    });
    while (queue.length > 0) {
        const qId = queue.shift();
        const question = questionMap.get(qId);
        if (question) {
            sorted.push(question);
        }
        const dependents = graph.get(qId);
        if (dependents) {
            dependents.forEach(depId => {
                const newDegree = (inDegree.get(depId) || 0) - 1;
                inDegree.set(depId, newDegree);
                if (newDegree === 0) {
                    queue.push(depId);
                }
            });
        }
    }
    // If sorted length doesn't match input, there's a cycle
    if (sorted.length !== questions.length) {
        console.warn('⚠️ Circular dependency detected in questions');
        return questions; // Return unsorted if cycle detected
    }
    return sorted;
}
/**
 * NEW: Update conditional logic for a survey question
 * @route PUT /api/v1/surveys/:surveyId/questions/:id/conditional-logic
 * @access Private
 */
const updateSurveyQuestionConditionalLogic = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield surveyQuestion_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const { surveyId, id: questionId } = req.params;
        const { conditionalLogic } = req.body;
        const surveyQuestion = yield surveyQuestion_model_1.default.findOne({
            _id: questionId,
            survey: surveyId
        });
        if (!surveyQuestion) {
            const error = new Error('Survey question not found');
            error.statusCode = 404;
            throw error;
        }
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check permissions
        const isCreator = survey.creator.toString() === req.user._id.toString();
        const hasProjectAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isConnectGoStaff = (_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this survey');
            error.statusCode = 403;
            throw error;
        }
        if (survey.status === 'closed') {
            const error = new Error('Cannot modify a closed survey');
            error.statusCode = 400;
            throw error;
        }
        // Validate that referenced questions exist in the survey
        if ((conditionalLogic === null || conditionalLogic === void 0 ? void 0 : conditionalLogic.enabled) && conditionalLogic.conditions) {
            const surveyQuestionIds = yield surveyQuestion_model_1.default.find({ survey: surveyId })
                .distinct('_id');
            const surveyQuestionIdSet = new Set(surveyQuestionIds.map(id => id.toString()));
            for (const condition of conditionalLogic.conditions) {
                if (!surveyQuestionIdSet.has(condition.questionId.toString())) {
                    const error = new Error(`Referenced question ${condition.questionId} is not in this survey`);
                    error.statusCode = 400;
                    throw error;
                }
            }
        }
        surveyQuestion.conditionalLogic = conditionalLogic;
        yield surveyQuestion.save({ session });
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(surveyId, { status: 'draft' }, { session });
        }
        yield session.commitTransaction();
        session.endSession();
        const updatedQuestion = yield surveyQuestion_model_1.default.findById(questionId)
            .populate('question')
            .populate('conditionalLogic.conditions.questionId');
        res.status(200).json({
            success: true,
            message: 'Conditional logic updated successfully',
            data: updatedQuestion
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.updateSurveyQuestionConditionalLogic = updateSurveyQuestionConditionalLogic;
//# sourceMappingURL=surveyQuestion.controller.js.map