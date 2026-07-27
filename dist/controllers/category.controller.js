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
exports.getCategoryThemes = exports.deleteCategory = exports.restoreCategory = exports.archiveCategory = exports.updateCategory = exports.getCategory = exports.getCategories = exports.createCategory = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const category_model_1 = __importDefault(require("../models/category.model"));
const theme_model_1 = __importDefault(require("../models/theme.model"));
/**
 * Create a new category
 * @route POST /api/v1/categories
 * @access Private (ConnectGo staff only)
 */
const createCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create categories');
            error.statusCode = 403;
            throw error;
        }
        const { name, description, inclusion } = req.body;
        // Add creator from authenticated user
        const creator = req.user._id;
        // Create the new category
        const newCategories = yield category_model_1.default.create([{
                name,
                description,
                inclusion,
                creator,
                status: req.body.status || 'draft'
            }], { session });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: newCategories[0]
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createCategory = createCategory;
/**
 * Get all categories with pagination and filtering
 * @route GET /api/v1/categories
 * @access Private
 */
const getCategories = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = category_model_1.default.find({ archived: { $ne: true } });
        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }
        // Copy req.query to avoid modifying the original
        const reqQuery = Object.assign({}, req.query);
        // Fields to exclude from filtering
        const removeFields = ['select', 'sort', 'page', 'limit', 'populate'];
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
        if (req.query.populate === 'creator') {
            query = query.populate({
                path: 'creator',
                select: 'name email userName'
            });
        }
        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = yield category_model_1.default.countDocuments({ archived: { $ne: true } });
        query = query.skip(startIndex).limit(limit);
        // Execute query
        const categories = yield query;
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
            count: categories.length,
            pagination,
            total,
            data: categories
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCategories = getCategories;
/**
 * Get single category by ID
 * @route GET /api/v1/categories/:id
 * @access Private
 */
const getCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categoryId = req.params.id;
        const query = category_model_1.default.findById(categoryId);
        // Populate creator field if requested
        if (req.query.populate === 'creator') {
            query.populate({
                path: 'creator',
                select: 'name email userName'
            });
        }
        const category = yield query;
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if category is archived
        if (category.archived) {
            const error = new Error('This category has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        res.status(200).json({
            success: true,
            data: category
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getCategory = getCategory;
/**
 * Update category by ID
 * @route PUT /api/v1/categories/:id
 * @access Private (ConnectGo staff only)
 */
const updateCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update categories');
            error.statusCode = 403;
            throw error;
        }
        const categoryId = req.params.id;
        const { name, description, status, inclusion } = req.body;
        // Find the category first to check if it exists and is not archived
        const category = yield category_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        if (category.archived) {
            const error = new Error('Cannot update an archived category');
            error.statusCode = 400;
            throw error;
        }
        // Update the category
        const updatedCategory = yield category_model_1.default.findByIdAndUpdate(categoryId, { name, description, status, inclusion }, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: updatedCategory
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateCategory = updateCategory;
/**
 * Archive category by ID (soft delete)
 * @route DELETE /api/v1/categories/:id
 * @access Private (ConnectGo staff only)
 */
const archiveCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive categories');
            error.statusCode = 403;
            throw error;
        }
        const categoryId = req.params.id;
        // Find the category first to check if it exists
        const category = yield category_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        if (category.archived) {
            const error = new Error('Category is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the category (soft delete)
        const archivedCategory = yield category_model_1.default.findByIdAndUpdate(categoryId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Category archived successfully',
            data: archivedCategory
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveCategory = archiveCategory;
/**
 * Restore archived category by ID
 * @route POST /api/v1/categories/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore categories');
            error.statusCode = 403;
            throw error;
        }
        const categoryId = req.params.id;
        // Find the category first to check if it exists and is archived
        const category = yield category_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        if (!category.archived) {
            const error = new Error('Category is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Restore the category
        const restoredCategory = yield category_model_1.default.findByIdAndUpdate(categoryId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Category restored successfully',
            data: restoredCategory
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreCategory = restoreCategory;
/**
 * Permanently delete category by ID
 * @route DELETE /api/v1/categories/:id/permanent
 * @access Private (ConnectGo staff only)
 */
const deleteCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can permanently delete categories');
            error.statusCode = 403;
            throw error;
        }
        const categoryId = req.params.id;
        // Find the category first to check if it exists
        const category = yield category_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        // Permanently delete the category
        yield category_model_1.default.findByIdAndDelete(categoryId);
        res.status(200).json({
            success: true,
            message: 'Category permanently deleted',
            data: null
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteCategory = deleteCategory;
/**
 * Get themes by category ID
 * @route GET /api/v1/categories/:id/themes
 * @access Private
 */
const getCategoryThemes = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categoryId = req.params.id;
        // Check if category exists
        const category = yield category_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        // Get all themes for this category
        const themes = yield theme_model_1.default.find({
            categories: categoryId,
            archived: { $ne: true }
        }).sort('name');
        res.status(200).json({
            success: true,
            count: themes.length,
            data: themes
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getCategoryThemes = getCategoryThemes;
//# sourceMappingURL=category.controller.js.map