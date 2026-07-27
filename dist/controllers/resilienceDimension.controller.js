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
exports.restoreResilienceDimension = exports.archiveResilienceDimension = exports.getResilienceCategories = exports.updateResilienceDimension = exports.getResilienceDimension = exports.getResilienceDimensions = exports.createResilienceDimension = void 0;
const resilienceDimension_model_1 = __importDefault(require("../models/resilienceDimension.model"));
/**
 * Create a new resilience dimension
 * @route POST /api/v1/resilience-dimensions
 * @access Private (ConnectGo staff only)
 */
const createResilienceDimension = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create resilience dimensions');
            error.statusCode = 403;
            throw error;
        }
        const { code, name, description, capacityTypes, category, linkToPvModel, resilienceIndexCriteria, indicatorExamples } = req.body;
        // Check if resilience dimension with this code already exists
        const existingDimension = yield resilienceDimension_model_1.default.findOne({ code });
        if (existingDimension) {
            const error = new Error(`Resilience dimension with code ${code} already exists`);
            error.statusCode = 409;
            throw error;
        }
        // Create the new resilience dimension
        const newDimension = yield resilienceDimension_model_1.default.create({
            code,
            name,
            description,
            capacityTypes,
            category,
            linkToPvModel,
            resilienceIndexCriteria,
            indicatorExamples,
            creator: req.user._id
        });
        res.status(201).json({
            success: true,
            message: 'Resilience dimension created successfully',
            data: newDimension
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createResilienceDimension = createResilienceDimension;
/**
 * Get all resilience dimensions
 * @route GET /api/v1/resilience-dimensions
 * @access Public
 */
const getResilienceDimensions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = resilienceDimension_model_1.default.find({ archived: { $ne: true } });
        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }
        // Filter by capacity type if provided
        if (req.query.capacityType) {
            query = query.find({ capacityTypes: req.query.capacityType });
        }
        // Filter by category if provided (now supports custom categories)
        if (req.query.category) {
            query = query.find({ category: { $regex: req.query.category, $options: 'i' } });
        }
        // Search functionality for flexible category searching
        if (req.query.search) {
            query = query.find({
                $or: [
                    { name: { $regex: req.query.search, $options: 'i' } },
                    { description: { $regex: req.query.search, $options: 'i' } },
                    { category: { $regex: req.query.search, $options: 'i' } },
                    { code: { $regex: req.query.search, $options: 'i' } }
                ]
            });
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
        const dimensions = yield query;
        res.status(200).json({
            success: true,
            count: dimensions.length,
            data: dimensions
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getResilienceDimensions = getResilienceDimensions;
/**
 * Get a single resilience dimension by ID
 * @route GET /api/v1/resilience-dimensions/:id
 * @access Public
 */
const getResilienceDimension = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dimensionId = req.params.id;
        const dimension = yield resilienceDimension_model_1.default.findById(dimensionId);
        if (!dimension) {
            const error = new Error('Resilience dimension not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if dimension is archived
        if (dimension.archived) {
            const error = new Error('This resilience dimension has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        res.status(200).json({
            success: true,
            data: dimension
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid resilience dimension ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getResilienceDimension = getResilienceDimension;
/**
 * Update resilience dimension by ID
 * @route PUT /api/v1/resilience-dimensions/:id
 * @access Private (ConnectGo staff only)
 */
const updateResilienceDimension = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update resilience dimensions');
            error.statusCode = 403;
            throw error;
        }
        const dimensionId = req.params.id;
        const { name, description, capacityTypes, category, linkToPvModel, resilienceIndexCriteria, indicatorExamples, status } = req.body;
        // Find the dimension first to check if it exists and is not archived
        const dimension = yield resilienceDimension_model_1.default.findById(dimensionId);
        if (!dimension) {
            const error = new Error('Resilience dimension not found');
            error.statusCode = 404;
            throw error;
        }
        if (dimension.archived) {
            const error = new Error('Cannot update an archived resilience dimension');
            error.statusCode = 400;
            throw error;
        }
        // Update the dimension
        const updatedDimension = yield resilienceDimension_model_1.default.findByIdAndUpdate(dimensionId, {
            name,
            description,
            capacityTypes,
            category,
            linkToPvModel,
            resilienceIndexCriteria,
            indicatorExamples,
            status
        }, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'Resilience dimension updated successfully',
            data: updatedDimension
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid resilience dimension ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateResilienceDimension = updateResilienceDimension;
/**
 * Get unique categories for filtering purposes
 * @route GET /api/v1/resilience-dimensions/categories
 * @access Public
 */
const getResilienceCategories = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get all unique categories from non-archived dimensions
        const categories = yield resilienceDimension_model_1.default.distinct('category', {
            archived: { $ne: true },
            category: { $nin: [null, ''] }
        });
        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories.sort()
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getResilienceCategories = getResilienceCategories;
/**
 * Archive resilience dimension by ID (soft delete)
 * @route DELETE /api/v1/resilience-dimensions/:id
 * @access Private (ConnectGo staff only)
 */
const archiveResilienceDimension = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive resilience dimensions');
            error.statusCode = 403;
            throw error;
        }
        const dimensionId = req.params.id;
        // Find the dimension first to check if it exists
        const dimension = yield resilienceDimension_model_1.default.findById(dimensionId);
        if (!dimension) {
            const error = new Error('Resilience dimension not found');
            error.statusCode = 404;
            throw error;
        }
        if (dimension.archived) {
            const error = new Error('Resilience dimension is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the dimension (soft delete)
        const archivedDimension = yield resilienceDimension_model_1.default.findByIdAndUpdate(dimensionId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Resilience dimension archived successfully',
            data: archivedDimension
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid resilience dimension ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveResilienceDimension = archiveResilienceDimension;
/**
 * Restore archived resilience dimension by ID
 * @route POST /api/v1/resilience-dimensions/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreResilienceDimension = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore resilience dimensions');
            error.statusCode = 403;
            throw error;
        }
        const dimensionId = req.params.id;
        // Find the dimension first to check if it exists and is archived
        const dimension = yield resilienceDimension_model_1.default.findById(dimensionId);
        if (!dimension) {
            const error = new Error('Resilience dimension not found');
            error.statusCode = 404;
            throw error;
        }
        if (!dimension.archived) {
            const error = new Error('Resilience dimension is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Restore the dimension
        const restoredDimension = yield resilienceDimension_model_1.default.findByIdAndUpdate(dimensionId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Resilience dimension restored successfully',
            data: restoredDimension
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid resilience dimension ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreResilienceDimension = restoreResilienceDimension;
exports.default = {
    createResilienceDimension: exports.createResilienceDimension,
    getResilienceDimensions: exports.getResilienceDimensions,
    getResilienceDimension: exports.getResilienceDimension,
    updateResilienceDimension: exports.updateResilienceDimension,
    getResilienceCategories: exports.getResilienceCategories,
    archiveResilienceDimension: exports.archiveResilienceDimension,
    restoreResilienceDimension: exports.restoreResilienceDimension
};
//# sourceMappingURL=resilienceDimension.controller.js.map