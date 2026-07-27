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
exports.getSectionQuestions = exports.reorderSurveySections = exports.deleteSurveySection = exports.updateSurveySection = exports.getSurveySection = exports.createSurveySection = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const surveySection_model_1 = __importDefault(require("../models/surveySection.model"));
const survey_model_1 = __importDefault(require("../models/survey.model"));
/**
 * Create a new survey section
 * @route POST /api/v1/surveys/:surveyId/sections
 * @access Private
 */
const createSurveySection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { surveyId } = req.params;
        const { title, description, order } = req.body;
        // Check if survey exists
        const survey = yield survey_model_1.default.findById(surveyId);
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
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(surveyId, { status: 'draft' });
        }
        // Create the section
        const section = new surveySection_model_1.default({
            title,
            description,
            survey: surveyId,
            order: order || 0 // The pre-save hook will set the correct order if not specified
        });
        yield section.save({ session });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Survey section created successfully',
            data: section
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createSurveySection = createSurveySection;
/**
 * Get a survey section by ID
 * @route GET /api/v1/sections/:id
 * @access Private
 */
const getSurveySection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const sectionId = req.params.id;
        const section = yield surveySection_model_1.default.findById(sectionId);
        if (!section) {
            const error = new Error('Section not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to access the survey this section belongs to
        const survey = yield survey_model_1.default.findById(section.survey);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = (_a = req.user) === null || _a === void 0 ? void 0 : _a.hasProjectAccess(survey.project);
        if (!hasProjectAccess && !((_b = req.user) === null || _b === void 0 ? void 0 : _b.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this section');
            error.statusCode = 403;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: section
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid section ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSurveySection = getSurveySection;
/**
 * Update a survey section
 * @route PUT /api/v1/sections/:id
 * @access Private
 */
const updateSurveySection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const sectionId = req.params.id;
        const { title, description } = req.body;
        // Find the section
        const section = yield surveySection_model_1.default.findById(sectionId);
        if (!section) {
            const error = new Error('Section not found');
            error.statusCode = 404;
            throw error;
        }
        // Get the survey
        const survey = yield survey_model_1.default.findById(section.survey);
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
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
        }
        // Update the section
        const updatedSection = yield surveySection_model_1.default.findByIdAndUpdate(sectionId, { title, description }, { new: true, runValidators: true, session });
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Survey section updated successfully',
            data: updatedSection
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid section ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateSurveySection = updateSurveySection;
/**
 * Delete a survey section
 * @route DELETE /api/v1/sections/:id
 * @access Private
 */
const deleteSurveySection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const sectionId = req.params.id;
        // Find the section
        const section = yield surveySection_model_1.default.findById(sectionId);
        if (!section) {
            const error = new Error('Section not found');
            error.statusCode = 404;
            throw error;
        }
        // Get the survey
        const survey = yield survey_model_1.default.findById(section.survey);
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
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
        }
        // Get the SurveyQuestion model
        const SurveyQuestion = mongoose_1.default.model('SurveyQuestion');
        // Check if section has questions
        const questionCount = yield SurveyQuestion.countDocuments({ section: sectionId });
        if (questionCount > 0) {
            // Move questions to no section (make section null)
            yield SurveyQuestion.updateMany({ section: sectionId }, { section: null }, { session });
        }
        // Delete the section
        yield surveySection_model_1.default.findByIdAndDelete(sectionId, { session });
        // Update order of remaining sections
        const remainingSections = yield surveySection_model_1.default.find({ survey: section.survey })
            .sort('order');
        for (let i = 0; i < remainingSections.length; i++) {
            yield surveySection_model_1.default.findByIdAndUpdate(remainingSections[i]._id, { order: i + 1 }, { session });
        }
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Survey section deleted successfully',
            data: null
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid section ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteSurveySection = deleteSurveySection;
/**
 * Reorder survey sections
 * @route PUT /api/v1/surveys/:surveyId/sections/reorder
 * @access Private
 */
const reorderSurveySections = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { surveyId } = req.params;
        const { sections } = req.body;
        // Validate input
        if (!sections || !Array.isArray(sections)) {
            const error = new Error('Sections array is required');
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
        // If survey is published, switch it to draft
        if (survey.status === 'published') {
            yield survey_model_1.default.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
        }
        // Get all existing sections for this survey
        const existingSections = yield surveySection_model_1.default.find({
            survey: surveyId
        });
        const existingSectionIds = new Set(existingSections.map(s => s._id.toString()));
        // Validate that all provided section IDs belong to this survey
        for (const sectionData of sections) {
            if (!existingSectionIds.has(sectionData.id)) {
                const error = new Error(`Section with ID ${sectionData.id} does not belong to this survey`);
                error.statusCode = 400;
                throw error;
            }
        }
        // Update the order of each section
        for (let i = 0; i < sections.length; i++) {
            yield surveySection_model_1.default.findByIdAndUpdate(sections[i].id, { order: i + 1 }, { session });
        }
        yield session.commitTransaction();
        session.endSession();
        // Fetch the updated sections
        const updatedSections = yield surveySection_model_1.default.find({ survey: surveyId })
            .sort('order');
        res.status(200).json({
            success: true,
            message: 'Survey sections reordered successfully',
            data: updatedSections
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.reorderSurveySections = reorderSurveySections;
/**
 * Get all questions in a section
 * @route GET /api/v1/sections/:id/questions
 * @access Private
 */
const getSectionQuestions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const sectionId = req.params.id;
        // Check if section exists
        const section = yield surveySection_model_1.default.findById(sectionId);
        if (!section) {
            const error = new Error('Section not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to access the survey
        const survey = yield survey_model_1.default.findById(section.survey);
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = (_a = req.user) === null || _a === void 0 ? void 0 : _a.hasProjectAccess(survey.project);
        if (!hasProjectAccess && !((_b = req.user) === null || _b === void 0 ? void 0 : _b.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this section');
            error.statusCode = 403;
            throw error;
        }
        // Get all questions in the section
        const SurveyQuestion = mongoose_1.default.model('SurveyQuestion');
        const questions = yield SurveyQuestion.find({
            section: sectionId,
            archived: { $ne: true }
        }).populate({
            path: 'question',
            select: 'text description type options validation targetAudience'
        }).sort('order');
        res.status(200).json({
            success: true,
            count: questions.length,
            data: questions
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid section ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSectionQuestions = getSectionQuestions;
//# sourceMappingURL=surveySection.controller.js.map