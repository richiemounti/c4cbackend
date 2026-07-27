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
exports.restoreESGCategory = exports.archiveESGCategory = exports.updateESGCategory = exports.getESGCategory = exports.getESGCategories = exports.createESGCategory = void 0;
const esgCategory_model_1 = __importDefault(require("../models/esgCategory.model"));
/**
 * Create a new ESG category
 * @route POST /api/v1/esg-categories
 * @access Private (ConnectGo staff only)
 */
const createESGCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create ESG categories');
            error.statusCode = 403;
            throw error;
        }
        const { code, name, description, type } = req.body;
        // Check if ESG category with this code already exists
        const existingCategory = yield esgCategory_model_1.default.findOne({ code });
        if (existingCategory) {
            const error = new Error(`ESG category with code ${code} already exists`);
            error.statusCode = 409;
            throw error;
        }
        // Create the new ESG category
        const newCategory = yield esgCategory_model_1.default.create({
            code,
            name,
            description,
            type,
            creator: req.user._id
        });
        res.status(201).json({
            success: true,
            message: 'ESG category created successfully',
            data: newCategory
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createESGCategory = createESGCategory;
/**
 * Get all ESG categories
 * @route GET /api/v1/esg-categories
 * @access Public
 */
const getESGCategories = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = esgCategory_model_1.default.find({ archived: { $ne: true } });
        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }
        // Filter by type if provided
        if (req.query.type) {
            query = query.find({ type: req.query.type });
        }
        // Apply sorting
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        }
        else {
            query = query.sort('code'); // Default sort by code
        }
        // Execute query
        const categories = yield query;
        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getESGCategories = getESGCategories;
/**
 * Get a single ESG category by ID
 * @route GET /api/v1/esg-categories/:id
 * @access Public
 */
const getESGCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categoryId = req.params.id;
        const category = yield esgCategory_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('ESG category not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if category is archived
        if (category.archived) {
            const error = new Error('This ESG category has been archived');
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
            const customError = new Error('Invalid ESG category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getESGCategory = getESGCategory;
/**
 * Update ESG category by ID
 * @route PUT /api/v1/esg-categories/:id
 * @access Private (ConnectGo staff only)
 */
const updateESGCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update ESG categories');
            error.statusCode = 403;
            throw error;
        }
        const categoryId = req.params.id;
        const { name, description, type, status } = req.body;
        // Find the category first to check if it exists and is not archived
        const category = yield esgCategory_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('ESG category not found');
            error.statusCode = 404;
            throw error;
        }
        if (category.archived) {
            const error = new Error('Cannot update an archived ESG category');
            error.statusCode = 400;
            throw error;
        }
        // Update the category
        const updatedCategory = yield esgCategory_model_1.default.findByIdAndUpdate(categoryId, { name, description, type, status }, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'ESG category updated successfully',
            data: updatedCategory
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid ESG category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateESGCategory = updateESGCategory;
/**
 * Archive ESG category by ID (soft delete)
 * @route DELETE /api/v1/esg-categories/:id
 * @access Private (ConnectGo staff only)
 */
const archiveESGCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive ESG categories');
            error.statusCode = 403;
            throw error;
        }
        const categoryId = req.params.id;
        // Find the category first to check if it exists
        const category = yield esgCategory_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('ESG category not found');
            error.statusCode = 404;
            throw error;
        }
        if (category.archived) {
            const error = new Error('ESG category is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the category (soft delete)
        const archivedCategory = yield esgCategory_model_1.default.findByIdAndUpdate(categoryId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'ESG category archived successfully',
            data: archivedCategory
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid ESG category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveESGCategory = archiveESGCategory;
/**
 * Restore archived ESG category by ID
 * @route POST /api/v1/esg-categories/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreESGCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore ESG categories');
            error.statusCode = 403;
            throw error;
        }
        const categoryId = req.params.id;
        // Find the category first to check if it exists and is archived
        const category = yield esgCategory_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('ESG category not found');
            error.statusCode = 404;
            throw error;
        }
        if (!category.archived) {
            const error = new Error('ESG category is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Restore the category
        const restoredCategory = yield esgCategory_model_1.default.findByIdAndUpdate(categoryId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'ESG category restored successfully',
            data: restoredCategory
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid ESG category ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreESGCategory = restoreESGCategory;
exports.default = {
    createESGCategory: exports.createESGCategory,
    getESGCategories: exports.getESGCategories,
    getESGCategory: exports.getESGCategory,
    updateESGCategory: exports.updateESGCategory,
    archiveESGCategory: exports.archiveESGCategory,
    restoreESGCategory: exports.restoreESGCategory
};
//# sourceMappingURL=esgCategory.controller.js.map