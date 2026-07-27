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
exports.getThemeSubThemes = exports.deleteTheme = exports.restoreTheme = exports.archiveTheme = exports.updateTheme = exports.getTheme = exports.getThemes = exports.createTheme = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const theme_model_1 = __importDefault(require("../models/theme.model"));
/**
 * Create a new theme
 * @route POST /api/v1/themes
 * @access Private (ConnectGo staff only)
 */
const createTheme = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield theme_model_1.default.db.startSession();
    session.startTransaction();
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create themes');
            error.statusCode = 403;
            throw error;
        }
        const { name, description, theoryOfChangeStage } = req.body;
        const creator = req.user._id;
        const newThemes = yield theme_model_1.default.create([{
                name,
                description,
                theoryOfChangeStage: theoryOfChangeStage || null,
                creator,
                status: req.body.status || 'draft'
            }], { session });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Theme created successfully',
            data: newThemes[0]
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createTheme = createTheme;
/**
 * Get all themes with pagination and filtering
 * @route GET /api/v1/themes
 * @access Private
 */
const getThemes = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = theme_model_1.default.find({ archived: { $ne: true } });
        // Handle search parameter for text search
        if (req.query.search) {
            const searchTerm = req.query.search;
            query = query.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ]
            });
        }
        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }
        // Filter by theory of change stage if provided
        if (req.query.theoryOfChangeStage) {
            const stage = req.query.theoryOfChangeStage;
            query = query.find({
                theoryOfChangeStage: { $in: [stage, 'Both'] }
            });
        }
        // Copy req.query to avoid modifying the original
        const reqQuery = Object.assign({}, req.query);
        // Add 'theoryOfChangeStage' to removeFields
        const removeFields = ['select', 'sort', 'page', 'limit', 'populate', 'status', 'search', 'theoryOfChangeStage'];
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
        }
        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        // Build count query based on the filters
        let countQuery = theme_model_1.default.find({ archived: { $ne: true } });
        // Apply search to count query
        if (req.query.search) {
            const searchTerm = req.query.search;
            countQuery = countQuery.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } }
                ]
            });
        }
        if (req.query.status) {
            countQuery = countQuery.find({ status: req.query.status });
        }
        // Apply theoryOfChangeStage filter to count query
        if (req.query.theoryOfChangeStage) {
            const stage = req.query.theoryOfChangeStage;
            countQuery = countQuery.find({
                theoryOfChangeStage: { $in: [stage, 'Both'] }
            });
        }
        const total = yield countQuery.countDocuments();
        query = query.skip(startIndex).limit(limit);
        // Execute query
        const themes = yield query;
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
            count: themes.length,
            pagination,
            total,
            data: themes
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getThemes = getThemes;
/**
 * Get single theme by ID
 * @route GET /api/v1/themes/:id
 * @access Private
 */
const getTheme = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const themeId = req.params.id;
        const query = theme_model_1.default.findById(themeId);
        // Populate related fields if requested
        if (req.query.populate) {
            const populateFields = req.query.populate.split(',');
            if (populateFields.includes('creator')) {
                query.populate({
                    path: 'creator',
                    select: 'name email userName'
                });
            }
        }
        const theme = yield query;
        if (!theme) {
            const error = new Error('Theme not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if theme is archived
        if (theme.archived) {
            const error = new Error('This theme has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        res.status(200).json({
            success: true,
            data: theme
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid theme ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getTheme = getTheme;
/**
 * Update theme by ID
 * @route PUT /api/v1/themes/:id
 * @access Private (ConnectGo staff only)
 */
const updateTheme = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update themes');
            error.statusCode = 403;
            throw error;
        }
        const themeId = req.params.id;
        const { name, description, status, theoryOfChangeStage } = req.body;
        // Find the theme first to check if it exists and is not archived
        const theme = yield theme_model_1.default.findById(themeId);
        if (!theme) {
            const error = new Error('Theme not found');
            error.statusCode = 404;
            throw error;
        }
        if (theme.archived) {
            const error = new Error('Cannot update an archived theme');
            error.statusCode = 400;
            throw error;
        }
        // Prepare update data
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (status !== undefined)
            updateData.status = status;
        if (theoryOfChangeStage !== undefined)
            updateData.theoryOfChangeStage = theoryOfChangeStage;
        // Update the theme
        const updatedTheme = yield theme_model_1.default.findByIdAndUpdate(themeId, updateData, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'Theme updated successfully',
            data: updatedTheme
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid theme ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateTheme = updateTheme;
/**
 * Archive theme by ID (soft delete)
 * @route DELETE /api/v1/themes/:id
 * @access Private (ConnectGo staff only)
 */
const archiveTheme = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive themes');
            error.statusCode = 403;
            throw error;
        }
        const themeId = req.params.id;
        // Find the theme first to check if it exists
        const theme = yield theme_model_1.default.findById(themeId);
        if (!theme) {
            const error = new Error('Theme not found');
            error.statusCode = 404;
            throw error;
        }
        if (theme.archived) {
            const error = new Error('Theme is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the theme (soft delete)
        const archivedTheme = yield theme_model_1.default.findByIdAndUpdate(themeId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Theme archived successfully',
            data: archivedTheme
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid theme ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveTheme = archiveTheme;
/**
 * Restore archived theme by ID
 * @route POST /api/v1/themes/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreTheme = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore themes');
            error.statusCode = 403;
            throw error;
        }
        const themeId = req.params.id;
        // Find the theme first to check if it exists and is archived
        const theme = yield theme_model_1.default.findById(themeId);
        if (!theme) {
            const error = new Error('Theme not found');
            error.statusCode = 404;
            throw error;
        }
        if (!theme.archived) {
            const error = new Error('Theme is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Restore the theme
        const restoredTheme = yield theme_model_1.default.findByIdAndUpdate(themeId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Theme restored successfully',
            data: restoredTheme
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid theme ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreTheme = restoreTheme;
/**
 * Permanently delete theme by ID
 * @route DELETE /api/v1/themes/:id/permanent
 * @access Private (ConnectGo staff only)
 */
const deleteTheme = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can permanently delete themes');
            error.statusCode = 403;
            throw error;
        }
        const themeId = req.params.id;
        // Find the theme first to check if it exists
        const theme = yield theme_model_1.default.findById(themeId);
        if (!theme) {
            const error = new Error('Theme not found');
            error.statusCode = 404;
            throw error;
        }
        // Permanently delete the theme
        yield theme_model_1.default.findByIdAndDelete(themeId);
        res.status(200).json({
            success: true,
            message: 'Theme permanently deleted',
            data: null
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid theme ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteTheme = deleteTheme;
/**
 * Get subthemes by theme ID
 * @route GET /api/v1/themes/:id/subthemes
 * @access Private
 */
const getThemeSubThemes = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const themeId = req.params.id;
        // Check if theme exists
        const theme = yield theme_model_1.default.findById(themeId);
        if (!theme) {
            const error = new Error('Theme not found');
            error.statusCode = 404;
            throw error;
        }
        // Get all subthemes for this theme
        const SubTheme = mongoose_1.default.model('SubTheme');
        const subThemes = yield SubTheme.find({
            theme: themeId,
            archived: { $ne: true }
        }).sort('name');
        res.status(200).json({
            success: true,
            count: subThemes.length,
            data: subThemes
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid theme ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getThemeSubThemes = getThemeSubThemes;
//# sourceMappingURL=theme.controller.js.map