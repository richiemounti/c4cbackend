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
exports.restoreStandard = exports.archiveStandard = exports.updateStandard = exports.getStandard = exports.getStandards = exports.createStandard = void 0;
const standard_model_1 = __importDefault(require("../models/standard.model"));
/**
 * Create a new standard
 * @route POST /api/v1/standards
 * @access Private (ConnectGo staff only)
 */
const createStandard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create standards');
            error.statusCode = 403;
            throw error;
        }
        const { code, name, description, issuingBody, website, version, publishedYear } = req.body;
        // Check if standard with this code already exists
        const existingStandard = yield standard_model_1.default.findOne({ code });
        if (existingStandard) {
            const error = new Error(`Standard with code ${code} already exists`);
            error.statusCode = 409;
            throw error;
        }
        // Create the new standard
        const newStandard = yield standard_model_1.default.create({
            code,
            name,
            description,
            issuingBody,
            website,
            version,
            publishedYear,
            creator: req.user._id
        });
        res.status(201).json({
            success: true,
            message: 'Standard created successfully',
            data: newStandard
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createStandard = createStandard;
/**
 * Get all standards
 * @route GET /api/v1/standards
 * @access Public
 */
const getStandards = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = standard_model_1.default.find({ archived: { $ne: true } });
        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }
        // Filter by issuing body if provided
        if (req.query.issuingBody) {
            query = query.find({ issuingBody: { $regex: req.query.issuingBody, $options: 'i' } });
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
        const standards = yield query;
        res.status(200).json({
            success: true,
            count: standards.length,
            data: standards
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStandards = getStandards;
/**
 * Get a single standard by ID
 * @route GET /api/v1/standards/:id
 * @access Public
 */
const getStandard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const standardId = req.params.id;
        const standard = yield standard_model_1.default.findById(standardId);
        if (!standard) {
            const error = new Error('Standard not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if standard is archived
        if (standard.archived) {
            const error = new Error('This standard has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        res.status(200).json({
            success: true,
            data: standard
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid standard ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getStandard = getStandard;
/**
 * Update standard by ID
 * @route PUT /api/v1/standards/:id
 * @access Private (ConnectGo staff only)
 */
const updateStandard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update standards');
            error.statusCode = 403;
            throw error;
        }
        const standardId = req.params.id;
        const { name, description, issuingBody, website, version, publishedYear, status } = req.body;
        // Find the standard first to check if it exists and is not archived
        const standard = yield standard_model_1.default.findById(standardId);
        if (!standard) {
            const error = new Error('Standard not found');
            error.statusCode = 404;
            throw error;
        }
        if (standard.archived) {
            const error = new Error('Cannot update an archived standard');
            error.statusCode = 400;
            throw error;
        }
        // Update the standard
        const updatedStandard = yield standard_model_1.default.findByIdAndUpdate(standardId, { name, description, issuingBody, website, version, publishedYear, status }, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'Standard updated successfully',
            data: updatedStandard
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid standard ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateStandard = updateStandard;
/**
 * Archive standard by ID (soft delete)
 * @route DELETE /api/v1/standards/:id
 * @access Private (ConnectGo staff only)
 */
const archiveStandard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive standards');
            error.statusCode = 403;
            throw error;
        }
        const standardId = req.params.id;
        // Find the standard first to check if it exists
        const standard = yield standard_model_1.default.findById(standardId);
        if (!standard) {
            const error = new Error('Standard not found');
            error.statusCode = 404;
            throw error;
        }
        if (standard.archived) {
            const error = new Error('Standard is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the standard (soft delete)
        const archivedStandard = yield standard_model_1.default.findByIdAndUpdate(standardId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Standard archived successfully',
            data: archivedStandard
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid standard ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveStandard = archiveStandard;
/**
 * Restore archived standard by ID
 * @route POST /api/v1/standards/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreStandard = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore standards');
            error.statusCode = 403;
            throw error;
        }
        const standardId = req.params.id;
        // Find the standard first to check if it exists and is archived
        const standard = yield standard_model_1.default.findById(standardId);
        if (!standard) {
            const error = new Error('Standard not found');
            error.statusCode = 404;
            throw error;
        }
        if (!standard.archived) {
            const error = new Error('Standard is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Restore the standard
        const restoredStandard = yield standard_model_1.default.findByIdAndUpdate(standardId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Standard restored successfully',
            data: restoredStandard
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid standard ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreStandard = restoreStandard;
exports.default = {
    createStandard: exports.createStandard,
    getStandards: exports.getStandards,
    getStandard: exports.getStandard,
    updateStandard: exports.updateStandard,
    archiveStandard: exports.archiveStandard,
    restoreStandard: exports.restoreStandard
};
//# sourceMappingURL=standard.controller.js.map