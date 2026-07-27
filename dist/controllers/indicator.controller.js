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
exports.deleteIndicator = exports.restoreIndicator = exports.archiveIndicator = exports.updateIndicator = exports.getIndicator = exports.getIndicators = exports.createIndicator = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const indicator_model_1 = __importDefault(require("../models/indicator.model"));
/**
 * Create a new indicator
 * @route POST /api/v1/indicators
 * @access Private (ConnectGo staff only)
 */
const createIndicator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create indicators');
            error.statusCode = 403;
            throw error;
        }
        // ADD THIS LINE - destructure evidence from request body
        const { name, description, status, evidence } = req.body;
        // Add creator from authenticated user
        const creator = req.user._id;
        // Validate status if provided
        const validStatuses = ['active', 'inactive'];
        const indicatorStatus = status && validStatuses.includes(status) ? status : 'active';
        // MODIFY THIS - include evidence in the creation object
        const newIndicators = yield indicator_model_1.default.create([{
                name,
                description,
                evidence: evidence || null, // Add evidence field
                creator,
                status: indicatorStatus
            }], { session });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Indicator created successfully',
            data: newIndicators[0]
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createIndicator = createIndicator;
/**
 * Get all indicators with pagination and filtering
 * @route GET /api/v1/indicators
 * @access Private
 */
const getIndicators = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = indicator_model_1.default.find({ archived: { $ne: true } });
        // ADD THIS: Handle search parameter for text search
        if (req.query.search) {
            const searchTerm = req.query.search;
            query = query.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } },
                    { 'evidence.source': { $regex: searchTerm, $options: 'i' } },
                    { 'evidence.details': { $regex: searchTerm, $options: 'i' } }
                ]
            });
        }
        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }
        // Copy req.query to avoid modifying the original
        const reqQuery = Object.assign({}, req.query);
        // Fields to exclude from filtering
        // MODIFY THIS: Add 'search' to removeFields
        const removeFields = ['select', 'sort', 'page', 'limit', 'populate', 'search'];
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
        // Build count query based on the filters
        let countQuery = indicator_model_1.default.find({ archived: { $ne: true } });
        // ADD THIS: Apply search to count query
        if (req.query.search) {
            const searchTerm = req.query.search;
            countQuery = countQuery.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } },
                    { 'evidence.source': { $regex: searchTerm, $options: 'i' } },
                    { 'evidence.details': { $regex: searchTerm, $options: 'i' } }
                ]
            });
        }
        if (req.query.status) {
            countQuery = countQuery.find({ status: req.query.status });
        }
        const total = yield countQuery.countDocuments();
        query = query.skip(startIndex).limit(limit);
        // Execute query
        const indicators = yield query;
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
            count: indicators.length,
            pagination,
            total,
            data: indicators
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getIndicators = getIndicators;
/**
 * Get single indicator by ID
 * @route GET /api/v1/indicators/:id
 * @access Private
 */
const getIndicator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const indicatorId = req.params.id;
        const query = indicator_model_1.default.findById(indicatorId);
        // Populate creator field if requested
        if (req.query.populate === 'creator') {
            query.populate({
                path: 'creator',
                select: 'name email userName'
            });
        }
        const indicator = yield query;
        if (!indicator) {
            const error = new Error('Indicator not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if indicator is archived
        if (indicator.archived) {
            const error = new Error('This indicator has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        res.status(200).json({
            success: true,
            data: indicator
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid indicator ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getIndicator = getIndicator;
/**
 * Update indicator by ID
 * @route PUT /api/v1/indicators/:id
 * @access Private (ConnectGo staff only)
 */
const updateIndicator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update indicators');
            error.statusCode = 403;
            throw error;
        }
        const indicatorId = req.params.id;
        // ADD THIS LINE - destructure evidence from request body
        const { name, description, status, evidence } = req.body;
        // Find the indicator first to check if it exists and is not archived
        const indicator = yield indicator_model_1.default.findById(indicatorId);
        if (!indicator) {
            const error = new Error('Indicator not found');
            error.statusCode = 404;
            throw error;
        }
        if (indicator.archived) {
            const error = new Error('Cannot update an archived indicator');
            error.statusCode = 400;
            throw error;
        }
        // Validate status if provided
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        // ADD THESE LINES - handle evidence updates
        if (evidence !== undefined) {
            updateData.evidence = evidence;
        }
        if (status !== undefined) {
            const validStatuses = ['active', 'inactive'];
            if (validStatuses.includes(status)) {
                updateData.status = status;
            }
            else {
                const error = new Error('Invalid status. Must be either "active" or "inactive"');
                error.statusCode = 400;
                throw error;
            }
        }
        // Update the indicator
        const updatedIndicator = yield indicator_model_1.default.findByIdAndUpdate(indicatorId, updateData, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'Indicator updated successfully',
            data: updatedIndicator
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid indicator ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateIndicator = updateIndicator;
/**
 * Archive indicator by ID (soft delete)
 * @route DELETE /api/v1/indicators/:id
 * @access Private (ConnectGo staff only)
 */
const archiveIndicator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive categories');
            error.statusCode = 403;
            throw error;
        }
        const indicatorId = req.params.id;
        // Find the indicator first to check if it exists
        const indicator = yield indicator_model_1.default.findById(indicatorId);
        if (!indicator) {
            const error = new Error('Indicator not found');
            error.statusCode = 404;
            throw error;
        }
        if (indicator.archived) {
            const error = new Error('Indicator is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the indicator (soft delete)
        const archivedIndicator = yield indicator_model_1.default.findByIdAndUpdate(indicatorId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Indicator archived successfully',
            data: archivedIndicator
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid indicator ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveIndicator = archiveIndicator;
/**
 * Restore archived indicator by ID
 * @route POST /api/v1/indicators/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreIndicator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore indicators');
            error.statusCode = 403;
            throw error;
        }
        const indicatorId = req.params.id;
        // Find the indicator first to check if it exists and is archived
        const indicator = yield indicator_model_1.default.findById(indicatorId);
        if (!indicator) {
            const error = new Error('Indicator not found');
            error.statusCode = 404;
            throw error;
        }
        if (!indicator.archived) {
            const error = new Error('Indicator is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Restore the indicator
        const restoredIndicator = yield indicator_model_1.default.findByIdAndUpdate(indicatorId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Indicator restored successfully',
            data: restoredIndicator
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid indicator ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreIndicator = restoreIndicator;
/**
 * Permanently delete indicator by ID
 * @route DELETE /api/v1/indicators/:id/permanent
 * @access Private (ConnectGo staff only)
 */
const deleteIndicator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can permanently delete indicators');
            error.statusCode = 403;
            throw error;
        }
        const indicatorId = req.params.id;
        // Find the indicator first to check if it exists
        const indicator = yield indicator_model_1.default.findById(indicatorId);
        if (!indicator) {
            const error = new Error('indicator not found');
            error.statusCode = 404;
            throw error;
        }
        // Permanently delete the indicator
        yield indicator_model_1.default.findByIdAndDelete(indicatorId);
        res.status(200).json({
            success: true,
            message: 'indicator permanently deleted',
            data: null
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid indicator ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteIndicator = deleteIndicator;
//# sourceMappingURL=indicator.controller.js.map