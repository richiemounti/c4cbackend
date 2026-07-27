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
exports.autoTranslateSurvey = exports.getTranslationStatistics = exports.archiveTranslation = exports.publishTranslation = exports.approveTranslation = exports.submitForReview = exports.bulkUpdateTranslatedQuestions = exports.updateTranslatedQuestion = exports.updateTranslatedSection = exports.updateTranslation = exports.getFullTranslation = exports.getTranslation = exports.getPublishedTranslations = exports.getSurveyTranslations = exports.createSurveyTranslation = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const surveyTranslation_model_1 = __importDefault(require("../models/surveyTranslation.model"));
const survey_model_1 = __importDefault(require("../models/survey.model"));
const surveySection_model_1 = __importDefault(require("../models/surveySection.model"));
const surveyQuestion_model_1 = __importDefault(require("../models/surveyQuestion.model"));
const authHelpers_1 = require("../lib/authHelpers");
const review_model_1 = __importDefault(require("../models/review.model"));
const reviewHelpers_1 = require("../utils/reviewHelpers");
/**
 * Create a new survey translation
 * @route POST /api/v1/surveys/:surveyId/translations
 * @access Private (Project members)
 */
const createSurveyTranslation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { surveyId } = req.params;
        const { language, languageName, title, description, translationMethod = 'human', notes } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Validate required fields
        if (!language || !languageName || !title) {
            const error = new Error('Language code, language name, and title are required');
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
        // Check if user has access to this survey's project
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized to create translations for this survey');
            error.statusCode = 403;
            throw error;
        }
        // Check if translation already exists for this language
        const existingTranslation = yield surveyTranslation_model_1.default.findOne({
            survey: surveyId,
            language: language.toLowerCase(),
            archived: { $ne: true }
        });
        if (existingTranslation) {
            const error = new Error(`Translation already exists for language: ${language}`);
            error.statusCode = 409;
            throw error;
        }
        // Create the translation
        const translation = new surveyTranslation_model_1.default({
            survey: surveyId,
            language: language.toLowerCase(),
            languageName,
            title,
            description,
            translator: req.user._id,
            translationMethod,
            notes,
            status: 'draft',
            translatedSections: [],
            translatedQuestions: []
        });
        yield translation.save({ session });
        // Add translation reference to survey
        survey.translations = survey.translations || [];
        survey.translations.push(translation._id);
        yield survey.save({ session });
        yield session.commitTransaction();
        const populatedTranslation = yield surveyTranslation_model_1.default.findById(translation._id)
            .populate('translator', 'name email')
            .populate('survey', 'title defaultLanguage');
        res.status(201).json({
            success: true,
            message: 'Survey translation created successfully',
            data: populatedTranslation
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
exports.createSurveyTranslation = createSurveyTranslation;
/**
 * Get all translations for a survey
 * @route GET /api/v1/surveys/:surveyId/translations
 * @access Private
 */
const getSurveyTranslations = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { surveyId } = req.params;
        const { status, language } = req.query;
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has access to this survey's project
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        const filters = {};
        if (status)
            filters.status = status;
        if (language)
            filters.language = language.toLowerCase();
        const translations = yield surveyTranslation_model_1.default.getTranslationsBySurvey(surveyId, filters);
        res.status(200).json({
            success: true,
            count: translations.length,
            data: translations
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
exports.getSurveyTranslations = getSurveyTranslations;
/**
 * Get published translations for a survey (public endpoint for respondents)
 * @route GET /api/v1/surveys/:surveyId/translations/published
 * @access Public
 */
const getPublishedTranslations = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { surveyId } = req.params;
        // Check if survey exists and is published
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.status !== 'published') {
            const error = new Error('Survey is not published');
            error.statusCode = 400;
            throw error;
        }
        const translations = yield surveyTranslation_model_1.default.getPublishedTranslations(surveyId);
        res.status(200).json({
            success: true,
            count: translations.length,
            data: {
                defaultLanguage: survey.defaultLanguage,
                availableLanguages: survey.availableLanguages || [],
                translations: translations.map((t) => ({
                    _id: t._id,
                    language: t.language,
                    languageName: t.languageName,
                    title: t.title,
                    description: t.description
                }))
            }
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
exports.getPublishedTranslations = getPublishedTranslations;
/**
 * Get a single translation by ID
 * @route GET /api/v1/translations/:id
 * @access Private
 */
const getTranslation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const translation = yield surveyTranslation_model_1.default.findById(id)
            .populate('survey', 'title defaultLanguage project')
            .populate('translator', 'name email')
            .populate('reviewer', 'name email')
            .populate({
            path: 'translatedSections.section',
            select: 'title description order'
        })
            .populate({
            path: 'translatedQuestions.surveyQuestion',
            select: 'question order',
            populate: {
                path: 'question',
                select: 'text type options'
            }
        });
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has access to this survey's project
        const survey = translation.survey;
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this translation');
            error.statusCode = 403;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: translation
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid translation ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getTranslation = getTranslation;
/**
 * Get full translation with all content (for respondents taking survey)
 * @route GET /api/v1/translations/:id/full
 * @access Public (if survey is published)
 */
const getFullTranslation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const translation = yield surveyTranslation_model_1.default.findById(id)
            .populate('survey', 'title description status settings')
            .populate({
            path: 'translatedSections.section',
            select: 'title description order'
        })
            .populate({
            path: 'translatedQuestions.surveyQuestion',
            select: 'question order required section',
            populate: {
                path: 'question',
                select: 'text description type options validation'
            }
        });
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        if (translation.status !== 'published') {
            const error = new Error('Translation is not published');
            error.statusCode = 400;
            throw error;
        }
        const survey = translation.survey;
        if (survey.status !== 'published') {
            const error = new Error('Survey is not published');
            error.statusCode = 400;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: translation
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid translation ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getFullTranslation = getFullTranslation;
/**
 * Update translation metadata
 * @route PUT /api/v1/translations/:id
 * @access Private
 */
const updateTranslation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const { title, description, languageName, translationMethod, notes } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id).populate('survey', 'project');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        if (translation.archived) {
            const error = new Error('Cannot update archived translation');
            error.statusCode = 400;
            throw error;
        }
        // Check if user has access
        const survey = translation.survey;
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isTranslator = ((_a = translation.translator) === null || _a === void 0 ? void 0 : _a.toString()) === req.user._id.toString();
        if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized to update this translation');
            error.statusCode = 403;
            throw error;
        }
        // Can't update if published
        if (translation.status === 'published') {
            const error = new Error('Cannot update published translation');
            error.statusCode = 400;
            throw error;
        }
        // Update fields
        if (title !== undefined)
            translation.title = title;
        if (description !== undefined)
            translation.description = description;
        if (languageName !== undefined)
            translation.languageName = languageName;
        if (translationMethod !== undefined)
            translation.translationMethod = translationMethod;
        if (notes !== undefined)
            translation.notes = notes;
        yield translation.save({ session });
        yield session.commitTransaction();
        const updatedTranslation = yield surveyTranslation_model_1.default.findById(id)
            .populate('translator', 'name email')
            .populate('reviewer', 'name email')
            .populate('survey', 'title');
        res.status(200).json({
            success: true,
            message: 'Translation updated successfully',
            data: updatedTranslation
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
exports.updateTranslation = updateTranslation;
/**
 * Add or update translated section
 * @route PUT /api/v1/translations/:id/sections/:sectionId
 * @access Private
 */
const updateTranslatedSection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id, sectionId } = req.params;
        const { title, description } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!title) {
            const error = new Error('Translated title is required');
            error.statusCode = 400;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id).populate('survey', 'project');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if section exists and belongs to the survey
        const section = yield surveySection_model_1.default.findById(sectionId);
        if (!section) {
            const error = new Error('Section not found');
            error.statusCode = 404;
            throw error;
        }
        if (section.survey.toString() !== translation.survey._id.toString()) {
            const error = new Error('Section does not belong to this survey');
            error.statusCode = 400;
            throw error;
        }
        // Check access
        const survey = translation.survey;
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isTranslator = ((_a = translation.translator) === null || _a === void 0 ? void 0 : _a.toString()) === req.user._id.toString();
        if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized to update this translation');
            error.statusCode = 403;
            throw error;
        }
        // Can't update if published
        if (translation.status === 'published') {
            const error = new Error('Cannot update published translation');
            error.statusCode = 400;
            throw error;
        }
        // Find existing translated section or create new
        const existingIndex = translation.translatedSections.findIndex(s => s.section.toString() === sectionId);
        if (existingIndex >= 0) {
            // Update existing
            translation.translatedSections[existingIndex].title = title;
            translation.translatedSections[existingIndex].description = description;
        }
        else {
            // Add new
            translation.translatedSections.push({
                section: new mongoose_1.default.Types.ObjectId(sectionId),
                title,
                description
            });
        }
        yield translation.save({ session });
        yield session.commitTransaction();
        const updatedTranslation = yield surveyTranslation_model_1.default.findById(id)
            .populate('translatedSections.section', 'title order');
        res.status(200).json({
            success: true,
            message: 'Translated section updated successfully',
            data: updatedTranslation
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
exports.updateTranslatedSection = updateTranslatedSection;
/**
 * Add or update translated question
 * @route PUT /api/v1/translations/:id/questions/:questionId
 * @access Private
 */
const updateTranslatedQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id, questionId } = req.params;
        const { translatedText, translatedDescription, translatedOptions } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!translatedText) {
            const error = new Error('Translated text is required');
            error.statusCode = 400;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id).populate('survey', 'project');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if question exists and belongs to the survey
        const surveyQuestion = yield surveyQuestion_model_1.default.findById(questionId).populate('question');
        if (!surveyQuestion) {
            const error = new Error('Survey question not found');
            error.statusCode = 404;
            throw error;
        }
        if (surveyQuestion.survey.toString() !== translation.survey._id.toString()) {
            const error = new Error('Question does not belong to this survey');
            error.statusCode = 400;
            throw error;
        }
        // Check access
        const survey = translation.survey;
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isTranslator = ((_a = translation.translator) === null || _a === void 0 ? void 0 : _a.toString()) === req.user._id.toString();
        if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized to update this translation');
            error.statusCode = 403;
            throw error;
        }
        // Can't update if published
        if (translation.status === 'published') {
            const error = new Error('Cannot update published translation');
            error.statusCode = 400;
            throw error;
        }
        // Validate translated options if question type requires options
        const question = surveyQuestion.question;
        if (['radio', 'checkbox', 'dropdown'].includes(question.type)) {
            if (!translatedOptions || !Array.isArray(translatedOptions) || translatedOptions.length === 0) {
                const error = new Error('Translated options are required for this question type');
                error.statusCode = 400;
                throw error;
            }
        }
        // Find existing translated question or create new
        const existingIndex = translation.translatedQuestions.findIndex(q => q.surveyQuestion.toString() === questionId);
        if (existingIndex >= 0) {
            // Update existing
            translation.translatedQuestions[existingIndex].translatedText = translatedText;
            translation.translatedQuestions[existingIndex].translatedDescription = translatedDescription;
            translation.translatedQuestions[existingIndex].translatedOptions = translatedOptions;
        }
        else {
            // Add new
            translation.translatedQuestions.push({
                surveyQuestion: new mongoose_1.default.Types.ObjectId(questionId),
                translatedText,
                translatedDescription,
                translatedOptions
            });
        }
        yield translation.save({ session });
        yield session.commitTransaction();
        const updatedTranslation = yield surveyTranslation_model_1.default.findById(id)
            .populate({
            path: 'translatedQuestions.surveyQuestion',
            select: 'question order',
            populate: {
                path: 'question',
                select: 'text type'
            }
        });
        res.status(200).json({
            success: true,
            message: 'Translated question updated successfully',
            data: updatedTranslation
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
exports.updateTranslatedQuestion = updateTranslatedQuestion;
/**
 * Bulk update translated questions
 * @route PUT /api/v1/translations/:id/questions/bulk
 * @access Private
 */
const bulkUpdateTranslatedQuestions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const { questions } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!Array.isArray(questions) || questions.length === 0) {
            const error = new Error('Questions array is required');
            error.statusCode = 400;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id).populate('survey', 'project');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        // Check access
        const survey = translation.survey;
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isTranslator = ((_a = translation.translator) === null || _a === void 0 ? void 0 : _a.toString()) === req.user._id.toString();
        if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized to update this translation');
            error.statusCode = 403;
            throw error;
        }
        // Can't update if published
        if (translation.status === 'published') {
            const error = new Error('Cannot update published translation');
            error.statusCode = 400;
            throw error;
        }
        // Process each question
        for (const q of questions) {
            if (!q.surveyQuestion || !q.translatedText) {
                continue; // Skip invalid entries
            }
            const existingIndex = translation.translatedQuestions.findIndex(tq => tq.surveyQuestion.toString() === q.surveyQuestion);
            if (existingIndex >= 0) {
                // Update existing
                translation.translatedQuestions[existingIndex].translatedText = q.translatedText;
                translation.translatedQuestions[existingIndex].translatedDescription = q.translatedDescription;
                translation.translatedQuestions[existingIndex].translatedOptions = q.translatedOptions;
            }
            else {
                // Add new
                translation.translatedQuestions.push({
                    surveyQuestion: new mongoose_1.default.Types.ObjectId(q.surveyQuestion),
                    translatedText: q.translatedText,
                    translatedDescription: q.translatedDescription,
                    translatedOptions: q.translatedOptions
                });
            }
        }
        yield translation.save({ session });
        yield session.commitTransaction();
        const updatedTranslation = yield surveyTranslation_model_1.default.findById(id)
            .populate('translator', 'name email')
            .populate('survey', 'title');
        res.status(200).json({
            success: true,
            message: `${questions.length} questions updated successfully`,
            data: updatedTranslation
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
exports.bulkUpdateTranslatedQuestions = bulkUpdateTranslatedQuestions;
/**
 * Submit translation for review
 * @route PUT /api/v1/translations/:id/submit
 * @access Private
 */
const submitForReview = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id).populate('survey', 'project');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        // Check access
        const survey = translation.survey;
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isTranslator = ((_a = translation.translator) === null || _a === void 0 ? void 0 : _a.toString()) === req.user._id.toString();
        if (!isTranslator && !hasAccess && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized');
            error.statusCode = 403;
            throw error;
        }
        if (translation.status !== 'draft') {
            const error = new Error('Only draft translations can be submitted for review');
            error.statusCode = 400;
            throw error;
        }
        // Check completion
        yield translation.markAsComplete();
        if (translation.completionPercentage < 100) {
            const error = new Error(`Translation is only ${translation.completionPercentage}% complete. Must be 100% to submit.`);
            error.statusCode = 400;
            throw error;
        }
        yield session.commitTransaction();
        // AUTO-TRIGGER: Create a Review record now that the translation is pending_review
        try {
            const translationForReview = yield surveyTranslation_model_1.default.findById(id)
                .populate('translator', 'name email')
                .populate({
                path: 'survey',
                populate: { path: 'project', populate: { path: 'organization' } },
            });
            if (translationForReview) {
                yield (0, reviewHelpers_1.createSurveyTranslationReview)(translationForReview, req.user._id);
            }
        }
        catch (reviewError) {
            console.error('Failed to create review for translation submission:', reviewError);
            // Non-fatal — translation submit still succeeded
        }
        const updatedTranslation = yield surveyTranslation_model_1.default.findById(id)
            .populate('translator', 'name email')
            .populate('survey', 'title');
        res.status(200).json({
            success: true,
            message: 'Translation submitted for review',
            data: updatedTranslation
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
exports.submitForReview = submitForReview;
/**
 * Approve translation
 * @route PUT /api/v1/translations/:id/approve
 * @access Private (Project managers)
 */
const approveTranslation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id).populate('survey', 'project creator');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user can approve (project manager or creator)
        const survey = translation.survey;
        const Project = mongoose_1.default.model('Project');
        const project = yield Project.findById(survey.project);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        const isProjectCreator = project.creator.toString() === req.user._id.toString();
        const isProjectManager = (_a = project.team) === null || _a === void 0 ? void 0 : _a.some((member) => member.user.toString() === req.user._id.toString() && member.role === 'manager');
        if (!isProjectCreator && !isProjectManager && !req.user.isConnectGoStaff) {
            const error = new Error('Only project managers can approve translations');
            error.statusCode = 403;
            throw error;
        }
        // Use instance method to approve
        yield translation.approve(req.user._id);
        // SYNC: Close any open Review record for this translation
        try {
            const existingReview = yield review_model_1.default.findOne({
                module: 'survey_translation',
                moduleItemId: translation._id,
                status: { $in: ['pending', 'in_review'] },
            });
            if (existingReview) {
                existingReview.changeStatus('approved', req.user._id, 'Translation approved');
                yield existingReview.save();
            }
        }
        catch (syncError) {
            console.error('Failed to sync Review status on translation approval:', syncError);
            // Non-fatal — translation approval still succeeded
        }
        yield session.commitTransaction();
        const updatedTranslation = yield surveyTranslation_model_1.default.findById(id)
            .populate('translator', 'name email')
            .populate('reviewer', 'name email')
            .populate('survey', 'title');
        res.status(200).json({
            success: true,
            message: 'Translation approved successfully',
            data: updatedTranslation
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
exports.approveTranslation = approveTranslation;
/**
 * Publish translation
 * @route PUT /api/v1/translations/:id/publish
 * @access Private (Project managers)
 */
const publishTranslation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id).populate('survey', 'project creator');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user can publish (project manager or creator)
        const survey = translation.survey;
        const Project = mongoose_1.default.model('Project');
        const project = yield Project.findById(survey.project);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        const isProjectCreator = project.creator.toString() === req.user._id.toString();
        const isProjectManager = (_a = project.team) === null || _a === void 0 ? void 0 : _a.some((member) => member.user.toString() === req.user._id.toString() && member.role === 'manager');
        if (!isProjectCreator && !isProjectManager && !req.user.isConnectGoStaff) {
            const error = new Error('Only project managers can publish translations');
            error.statusCode = 403;
            throw error;
        }
        // Use instance method to publish
        yield translation.publish();
        yield session.commitTransaction();
        const updatedTranslation = yield surveyTranslation_model_1.default.findById(id)
            .populate('translator', 'name email')
            .populate('reviewer', 'name email')
            .populate('survey', 'title availableLanguages');
        res.status(200).json({
            success: true,
            message: 'Translation published successfully',
            data: updatedTranslation
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
exports.publishTranslation = publishTranslation;
/**
 * Archive translation
 * @route DELETE /api/v1/translations/:id
 * @access Private (Project managers)
 */
const archiveTranslation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id).populate('survey', 'project');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        if (translation.archived) {
            const error = new Error('Translation is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Check access
        const survey = translation.survey;
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized to archive this translation');
            error.statusCode = 403;
            throw error;
        }
        translation.archived = true;
        translation.archivedAt = new Date();
        yield translation.save({ session });
        // Remove language from survey's available languages if this was published
        if (translation.status === 'published') {
            const surveyDoc = yield survey_model_1.default.findById(translation.survey);
            if (surveyDoc && surveyDoc.availableLanguages) {
                surveyDoc.availableLanguages = surveyDoc.availableLanguages.filter(lang => lang !== translation.language);
                yield surveyDoc.save({ session });
            }
        }
        yield session.commitTransaction();
        res.status(200).json({
            success: true,
            message: 'Translation archived successfully'
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
exports.archiveTranslation = archiveTranslation;
/**
 * Get translation statistics
 * @route GET /api/v1/surveys/:surveyId/translations/statistics
 * @access Private
 */
const getTranslationStatistics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { surveyId } = req.params;
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        // Check access
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized');
            error.statusCode = 403;
            throw error;
        }
        const [totalTranslations, draftCount, pendingCount, approvedCount, publishedCount, translationsByLanguage, completionStats] = yield Promise.all([
            surveyTranslation_model_1.default.countDocuments({
                survey: surveyId,
                archived: { $ne: true }
            }),
            surveyTranslation_model_1.default.countDocuments({
                survey: surveyId,
                status: 'draft',
                archived: { $ne: true }
            }),
            surveyTranslation_model_1.default.countDocuments({
                survey: surveyId,
                status: 'pending_review',
                archived: { $ne: true }
            }),
            surveyTranslation_model_1.default.countDocuments({
                survey: surveyId,
                status: 'approved',
                archived: { $ne: true }
            }),
            surveyTranslation_model_1.default.countDocuments({
                survey: surveyId,
                status: 'published',
                archived: { $ne: true }
            }),
            surveyTranslation_model_1.default.aggregate([
                {
                    $match: {
                        survey: new mongoose_1.default.Types.ObjectId(surveyId),
                        archived: { $ne: true }
                    }
                },
                {
                    $group: {
                        _id: '$language',
                        languageName: { $first: '$languageName' },
                        status: { $first: '$status' },
                        completionPercentage: { $first: '$completionPercentage' }
                    }
                }
            ]),
            surveyTranslation_model_1.default.aggregate([
                {
                    $match: {
                        survey: new mongoose_1.default.Types.ObjectId(surveyId),
                        archived: { $ne: true }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgCompletion: { $avg: '$completionPercentage' },
                        minCompletion: { $min: '$completionPercentage' },
                        maxCompletion: { $max: '$completionPercentage' }
                    }
                }
            ])
        ]);
        res.status(200).json({
            success: true,
            data: {
                overview: {
                    total: totalTranslations,
                    draft: draftCount,
                    pendingReview: pendingCount,
                    approved: approvedCount,
                    published: publishedCount
                },
                byLanguage: translationsByLanguage,
                completion: completionStats[0] || {
                    avgCompletion: 0,
                    minCompletion: 0,
                    maxCompletion: 0
                }
            }
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
exports.getTranslationStatistics = getTranslationStatistics;
// Add to surveyTranslation.controller.ts
/**
 * Auto-translate all content in a translation using Google Translate
 * Skips fields that already have manual translations
 * @route POST /api/v1/translations/:id/auto-translate
 * @access Private
 */
const autoTranslateSurvey = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const { overwriteExisting = false, // if true, re-translate already-translated fields
        sourceLanguage = 'en' // language to translate FROM
         } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const translation = yield surveyTranslation_model_1.default.findById(id)
            .populate('survey', 'project title description');
        if (!translation) {
            const error = new Error('Translation not found');
            error.statusCode = 404;
            throw error;
        }
        if (translation.status === 'published') {
            const error = new Error('Cannot auto-translate a published translation');
            error.statusCode = 400;
            throw error;
        }
        const survey = translation.survey;
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
        const isTranslator = ((_a = translation.translator) === null || _a === void 0 ? void 0 : _a.toString()) === req.user._id.toString();
        if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized');
            error.statusCode = 403;
            throw error;
        }
        const targetLanguage = translation.language;
        const { translateText, translateBatch } = yield Promise.resolve().then(() => __importStar(require('../services/googleTranslate.service')));
        // ── 1. Translate survey title/description ──────────────────────────────
        if (!translation.title || overwriteExisting) {
            translation.title = yield translateText(survey.title, targetLanguage, sourceLanguage);
        }
        if (survey.description && (!translation.description || overwriteExisting)) {
            translation.description = yield translateText(survey.description, targetLanguage, sourceLanguage);
        }
        // ── 2. Translate sections ──────────────────────────────────────────────
        const sections = yield surveySection_model_1.default.find({
            survey: survey._id,
            archived: { $ne: true }
        });
        for (const section of sections) {
            const existingIdx = translation.translatedSections.findIndex(s => s.section.toString() === section._id.toString());
            const alreadyTranslated = existingIdx >= 0;
            if (!alreadyTranslated || overwriteExisting) {
                const translatedTitle = yield translateText(section.title, targetLanguage, sourceLanguage);
                const translatedDesc = section.description
                    ? yield translateText(section.description, targetLanguage, sourceLanguage)
                    : undefined;
                if (alreadyTranslated) {
                    translation.translatedSections[existingIdx].title = translatedTitle;
                    if (translatedDesc)
                        translation.translatedSections[existingIdx].description = translatedDesc;
                }
                else {
                    translation.translatedSections.push({
                        section: section._id,
                        title: translatedTitle,
                        description: translatedDesc
                    });
                }
            }
        }
        // ── 3. Translate questions ─────────────────────────────────────────────
        const surveyQuestions = yield surveyQuestion_model_1.default.find({
            survey: survey._id,
            archived: { $ne: true }
        }).populate('question', 'text description type options');
        for (const sq of surveyQuestions) {
            const question = sq.question;
            const sqId = sq._id.toString();
            const existingIdx = translation.translatedQuestions.findIndex(q => q.surveyQuestion.toString() === sqId);
            const alreadyTranslated = existingIdx >= 0;
            if (!alreadyTranslated || overwriteExisting) {
                // Use customText if set on the survey question, otherwise fall back to question template text
                const sourceText = sq.customText || question.text;
                const sourceDesc = sq.customDescription || question.description;
                const translatedText = yield translateText(sourceText, targetLanguage, sourceLanguage);
                const translatedDesc = sourceDesc
                    ? yield translateText(sourceDesc, targetLanguage, sourceLanguage)
                    : undefined;
                // Translate options for choice-based questions
                let translatedOptions;
                const optionsSource = ((_b = sq.customOptions) === null || _b === void 0 ? void 0 : _b.length) ? sq.customOptions : question.options;
                if ((optionsSource === null || optionsSource === void 0 ? void 0 : optionsSource.length) && ['radio', 'checkbox', 'dropdown', 'select'].includes(question.type)) {
                    const labels = optionsSource.map((o) => o.label);
                    const translatedLabels = yield translateBatch(labels, targetLanguage, sourceLanguage);
                    translatedOptions = optionsSource.map((o, i) => ({
                        value: o.value, // keep value as-is (it's the stored key)
                        label: translatedLabels[i]
                    }));
                }
                if (alreadyTranslated) {
                    translation.translatedQuestions[existingIdx].translatedText = translatedText;
                    if (translatedDesc)
                        translation.translatedQuestions[existingIdx].translatedDescription = translatedDesc;
                    if (translatedOptions)
                        translation.translatedQuestions[existingIdx].translatedOptions = translatedOptions;
                }
                else {
                    translation.translatedQuestions.push({
                        surveyQuestion: sq._id,
                        translatedText,
                        translatedDescription: translatedDesc,
                        translatedOptions
                    });
                }
            }
        }
        translation.translationMethod = 'machine';
        yield translation.save({ session });
        yield session.commitTransaction();
        // Return the updated translation with completion %
        const updated = yield surveyTranslation_model_1.default.findById(id)
            .populate('translator', 'name email')
            .populate('survey', 'title');
        res.status(200).json({
            success: true,
            message: `Auto-translation complete. ${translation.translatedQuestions.length} questions and ${translation.translatedSections.length} sections translated.`,
            data: updated
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
exports.autoTranslateSurvey = autoTranslateSurvey;
exports.default = {
    createSurveyTranslation: exports.createSurveyTranslation,
    getSurveyTranslations: exports.getSurveyTranslations,
    getPublishedTranslations: exports.getPublishedTranslations,
    getTranslation: exports.getTranslation,
    getFullTranslation: exports.getFullTranslation,
    updateTranslation: exports.updateTranslation,
    updateTranslatedSection: exports.updateTranslatedSection,
    updateTranslatedQuestion: exports.updateTranslatedQuestion,
    bulkUpdateTranslatedQuestions: exports.bulkUpdateTranslatedQuestions,
    submitForReview: exports.submitForReview,
    approveTranslation: exports.approveTranslation,
    publishTranslation: exports.publishTranslation,
    archiveTranslation: exports.archiveTranslation,
    getTranslationStatistics: exports.getTranslationStatistics,
    autoTranslateSurvey: exports.autoTranslateSurvey
};
//# sourceMappingURL=surveyTranslation.controller.js.map