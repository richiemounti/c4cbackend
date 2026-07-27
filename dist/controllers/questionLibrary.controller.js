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
exports.deleteQuestionLibrary = exports.restoreQuestionLibrary = exports.archiveQuestionLibrary = exports.removeQuestionsFromLibrary = exports.addQuestionsToLibrary = exports.updateQuestionLibrary = exports.getQuestionLibrary = exports.getQuestionLibraries = exports.createQuestionLibrary = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const questionLibrary_model_1 = __importDefault(require("../models/questionLibrary.model"));
const question_model_1 = __importDefault(require("../models/question.model"));
/**
 * Create a new question library
 * @route POST /api/v1/question-libraries
 * @access Private (ConnectGo staff only)
 */
const createQuestionLibrary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create question libraries');
            error.statusCode = 403;
            throw error;
        }
        const { name, description, questions } = req.body;
        // Add creator from authenticated user
        const creator = req.user._id;
        // Validate questions if provided
        if (questions && questions.length > 0) {
            // Check if all questions exist
            const questionCount = yield question_model_1.default.countDocuments({
                _id: { $in: questions },
                archived: { $ne: true }
            });
            if (questionCount !== questions.length) {
                const error = new Error('One or more questions not found or are archived');
                error.statusCode = 404;
                throw error;
            }
        }
        // Create the new library
        const newLibrary = new questionLibrary_model_1.default({
            name,
            description,
            questions: questions || [],
            creator,
            status: req.body.status || 'draft'
        });
        yield newLibrary.save({ session });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Question library created successfully',
            data: newLibrary
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createQuestionLibrary = createQuestionLibrary;
/**
 * Get all question libraries
 * @route GET /api/v1/question-libraries
 * @access Private
 */
const getQuestionLibraries = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = questionLibrary_model_1.default.find({ archived: { $ne: true } });
        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }
        // Copy req.query to avoid modifying the original
        const reqQuery = Object.assign({}, req.query);
        // Fields to exclude from filtering
        const removeFields = ['select', 'sort', 'page', 'limit', 'populate', 'status'];
        removeFields.forEach(param => delete reqQuery[param]);
        // Create filtering based on query parameters
        let queryStr = JSON.stringify(reqQuery);
        // Create operators ($gt, $gte, etc)
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
        // Apply filtering
        query = query.find(JSON.parse(queryStr));
        // Select specific fields
        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }
        // Sort results
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        }
        else {
            query = query.sort('-createdAt'); // Default sort by newest
        }
        // Handle population of related fields
        if (req.query.populate) {
            const populateFields = req.query.populate.split(',');
            if (populateFields.includes('creator')) {
                query = query.populate({
                    path: 'creator',
                    select: 'name email userName'
                });
            }
            if (populateFields.includes('questions')) {
                query = query.populate({
                    path: 'questions',
                    select: 'text type categories theme subThemes targetAudience'
                });
            }
        }
        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = yield questionLibrary_model_1.default.countDocuments({ archived: { $ne: true } });
        query = query.skip(startIndex).limit(limit);
        // Execute query
        const libraries = yield query;
        // Pagination result
        const pagination = {};
        if (endIndex < total) {
            pagination.next = {
                page: page + 1,
                limit
            };
        }
        if (startIndex > 0) {
            pagination.prev = {
                page: page - 1,
                limit
            };
        }
        res.status(200).json({
            success: true,
            count: libraries.length,
            pagination,
            total,
            data: libraries
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getQuestionLibraries = getQuestionLibraries;
/**
 * Get a question library by ID
 * @route GET /api/v1/question-libraries/:id
 * @access Private
 */
const getQuestionLibrary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const libraryId = req.params.id;
        const query = questionLibrary_model_1.default.findById(libraryId);
        // Populate related fields if requested
        if (req.query.populate) {
            const populateFields = req.query.populate.split(',');
            if (populateFields.includes('creator')) {
                query.populate({
                    path: 'creator',
                    select: 'name email userName'
                });
            }
            if (populateFields.includes('questions')) {
                query.populate({
                    path: 'questions',
                    select: 'text description type options validation targetAudience category theme subTheme'
                });
            }
        }
        const library = yield query;
        if (!library) {
            const error = new Error('Question library not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if library is archived
        if (library.archived) {
            const error = new Error('This question library has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        res.status(200).json({
            success: true,
            data: library
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid library ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getQuestionLibrary = getQuestionLibrary;
/**
 * Update a question library
 * @route PUT /api/v1/question-libraries/:id
 * @access Private (ConnectGo staff only)
 */
const updateQuestionLibrary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update question libraries');
            error.statusCode = 403;
            throw error;
        }
        const libraryId = req.params.id;
        const { name, description, questions, status } = req.body;
        // Find the library first to check if it exists and is not archived
        const library = yield questionLibrary_model_1.default.findById(libraryId);
        if (!library) {
            const error = new Error('Question library not found');
            error.statusCode = 404;
            throw error;
        }
        if (library.archived) {
            const error = new Error('Cannot update an archived question library');
            error.statusCode = 400;
            throw error;
        }
        // Validate questions if provided
        if (questions && questions.length > 0) {
            // Check if all questions exist
            const questionCount = yield question_model_1.default.countDocuments({
                _id: { $in: questions },
                archived: { $ne: true }
            });
            if (questionCount !== questions.length) {
                const error = new Error('One or more questions not found or are archived');
                error.statusCode = 404;
                throw error;
            }
        }
        // Update the library
        const updatedLibrary = yield questionLibrary_model_1.default.findByIdAndUpdate(libraryId, { name, description, questions, status }, { new: true, runValidators: true, session });
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Question library updated successfully',
            data: updatedLibrary
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid library ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateQuestionLibrary = updateQuestionLibrary;
/**
 * Add questions to a library
 * @route POST /api/v1/question-libraries/:id/questions
 * @access Private (ConnectGo staff only)
 */
const addQuestionsToLibrary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can modify question libraries');
            error.statusCode = 403;
            throw error;
        }
        const libraryId = req.params.id;
        const { questions } = req.body;
        // Validate input
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            const error = new Error('Questions array is required');
            error.statusCode = 400;
            throw error;
        }
        // Find the library
        const library = yield questionLibrary_model_1.default.findById(libraryId);
        if (!library) {
            const error = new Error('Question library not found');
            error.statusCode = 404;
            throw error;
        }
        if (library.archived) {
            const error = new Error('Cannot modify an archived question library');
            error.statusCode = 400;
            throw error;
        }
        // Check if all questions exist
        const questionCount = yield question_model_1.default.countDocuments({
            _id: { $in: questions },
            archived: { $ne: true }
        });
        if (questionCount !== questions.length) {
            const error = new Error('One or more questions not found or are archived');
            error.statusCode = 404;
            throw error;
        }
        // Create a Set of existing question IDs to avoid duplicates
        const existingIds = new Set(library.questions.map(q => q.toString()));
        // Add the new questions, avoiding duplicates
        questions.forEach(questionId => {
            if (!existingIds.has(questionId.toString())) {
                library.questions.push(questionId);
            }
        });
        yield library.save({ session });
        // Populate the updated library
        const updatedLibrary = yield questionLibrary_model_1.default.findById(libraryId)
            .populate({
            path: 'questions',
            select: 'text type targetAudience'
        });
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Questions added to library successfully',
            data: updatedLibrary
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.addQuestionsToLibrary = addQuestionsToLibrary;
/**
 * Remove questions from a library
 * @route DELETE /api/v1/question-libraries/:id/questions
 * @access Private (ConnectGo staff only)
 */
const removeQuestionsFromLibrary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can modify question libraries');
            error.statusCode = 403;
            throw error;
        }
        const libraryId = req.params.id;
        const { questions } = req.body;
        // Validate input
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            const error = new Error('Questions array is required');
            error.statusCode = 400;
            throw error;
        }
        // Find the library
        const library = yield questionLibrary_model_1.default.findById(libraryId);
        if (!library) {
            const error = new Error('Question library not found');
            error.statusCode = 404;
            throw error;
        }
        if (library.archived) {
            const error = new Error('Cannot modify an archived question library');
            error.statusCode = 400;
            throw error;
        }
        // Create a Set of question IDs to remove
        const removeIds = new Set(questions.map(q => q.toString()));
        // Filter out the questions to remove
        library.questions = library.questions.filter(questionId => !removeIds.has(questionId.toString()));
        yield library.save({ session });
        // Populate the updated library
        const updatedLibrary = yield questionLibrary_model_1.default.findById(libraryId)
            .populate({
            path: 'questions',
            select: 'text type targetAudience'
        });
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Questions removed from library successfully',
            data: updatedLibrary
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.removeQuestionsFromLibrary = removeQuestionsFromLibrary;
/**
 * Archive a question library
 * @route DELETE /api/v1/question-libraries/:id
 * @access Private (ConnectGo staff only)
 */
const archiveQuestionLibrary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive question libraries');
            error.statusCode = 403;
            throw error;
        }
        const libraryId = req.params.id;
        // Find the library
        const library = yield questionLibrary_model_1.default.findById(libraryId);
        if (!library) {
            const error = new Error('Question library not found');
            error.statusCode = 404;
            throw error;
        }
        if (library.archived) {
            const error = new Error('Library is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the library
        const archivedLibrary = yield questionLibrary_model_1.default.findByIdAndUpdate(libraryId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Question library archived successfully',
            data: archivedLibrary
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid library ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveQuestionLibrary = archiveQuestionLibrary;
/**
 * Restore an archived question library
 * @route POST /api/v1/question-libraries/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreQuestionLibrary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore question libraries');
            error.statusCode = 403;
            throw error;
        }
        const libraryId = req.params.id;
        // Find the library
        const library = yield questionLibrary_model_1.default.findById(libraryId);
        if (!library) {
            const error = new Error('Question library not found');
            error.statusCode = 404;
            throw error;
        }
        if (!library.archived) {
            const error = new Error('Library is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Restore the library
        const restoredLibrary = yield questionLibrary_model_1.default.findByIdAndUpdate(libraryId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Question library restored successfully',
            data: restoredLibrary
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid library ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreQuestionLibrary = restoreQuestionLibrary;
/**
 * Permanently delete a question library
 * @route DELETE /api/v1/question-libraries/:id/permanent
 * @access Private (ConnectGo staff only)
 */
const deleteQuestionLibrary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can permanently delete question libraries');
            error.statusCode = 403;
            throw error;
        }
        const libraryId = req.params.id;
        // Find the library
        const library = yield questionLibrary_model_1.default.findById(libraryId);
        if (!library) {
            const error = new Error('Question library not found');
            error.statusCode = 404;
            throw error;
        }
        // Permanently delete the library
        yield questionLibrary_model_1.default.findByIdAndDelete(libraryId);
        res.status(200).json({
            success: true,
            message: 'Question library permanently deleted',
            data: null
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid library ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteQuestionLibrary = deleteQuestionLibrary;
//# sourceMappingURL=questionLibrary.controller.js.map