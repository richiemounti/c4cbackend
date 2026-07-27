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
exports.restoreSDG = exports.archiveSDG = exports.updateSDG = exports.getSDG = exports.getSDGs = exports.createSDG = void 0;
const sdg_model_1 = __importDefault(require("../models/sdg.model"));
/**
 * Create a new SDG
 * @route POST /api/v1/sdgs
 * @access Private (ConnectGo staff only)
 */
const createSDG = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create SDGs');
            error.statusCode = 403;
            throw error;
        }
        const { code, name, description, iconUrl, color } = req.body;
        // Check if SDG with this code already exists
        const existingSDG = yield sdg_model_1.default.findOne({ code });
        if (existingSDG) {
            const error = new Error(`SDG with code ${code} already exists`);
            error.statusCode = 409;
            throw error;
        }
        // Create the new SDG
        const newSDG = yield sdg_model_1.default.create({
            code,
            name,
            description,
            iconUrl,
            color,
            creator: req.user._id
        });
        res.status(201).json({
            success: true,
            message: 'SDG created successfully',
            data: newSDG
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createSDG = createSDG;
/**
 * Get all SDGs
 * @route GET /api/v1/sdgs
 * @access Public
 */
const getSDGs = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = sdg_model_1.default.find({ archived: { $ne: true } });
        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
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
        const sdgs = yield query;
        res.status(200).json({
            success: true,
            count: sdgs.length,
            data: sdgs
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSDGs = getSDGs;
/**
 * Get a single SDG by ID
 * @route GET /api/v1/sdgs/:id
 * @access Public
 */
const getSDG = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sdgId = req.params.id;
        const sdg = yield sdg_model_1.default.findById(sdgId);
        if (!sdg) {
            const error = new Error('SDG not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if SDG is archived
        if (sdg.archived) {
            const error = new Error('This SDG has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        res.status(200).json({
            success: true,
            data: sdg
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid SDG ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSDG = getSDG;
/**
 * Update SDG by ID
 * @route PUT /api/v1/sdgs/:id
 * @access Private (ConnectGo staff only)
 */
const updateSDG = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update SDGs');
            error.statusCode = 403;
            throw error;
        }
        const sdgId = req.params.id;
        const { name, description, iconUrl, color, status } = req.body;
        // Find the SDG first to check if it exists and is not archived
        const sdg = yield sdg_model_1.default.findById(sdgId);
        if (!sdg) {
            const error = new Error('SDG not found');
            error.statusCode = 404;
            throw error;
        }
        if (sdg.archived) {
            const error = new Error('Cannot update an archived SDG');
            error.statusCode = 400;
            throw error;
        }
        // Update the SDG
        const updatedSDG = yield sdg_model_1.default.findByIdAndUpdate(sdgId, { name, description, iconUrl, color, status }, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'SDG updated successfully',
            data: updatedSDG
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid SDG ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateSDG = updateSDG;
/**
 * Archive SDG by ID (soft delete)
 * @route DELETE /api/v1/sdgs/:id
 * @access Private (ConnectGo staff only)
 */
const archiveSDG = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive SDGs');
            error.statusCode = 403;
            throw error;
        }
        const sdgId = req.params.id;
        // Find the SDG first to check if it exists
        const sdg = yield sdg_model_1.default.findById(sdgId);
        if (!sdg) {
            const error = new Error('SDG not found');
            error.statusCode = 404;
            throw error;
        }
        if (sdg.archived) {
            const error = new Error('SDG is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the SDG (soft delete)
        const archivedSDG = yield sdg_model_1.default.findByIdAndUpdate(sdgId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'SDG archived successfully',
            data: archivedSDG
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid SDG ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveSDG = archiveSDG;
/**
 * Restore archived SDG by ID
 * @route POST /api/v1/sdgs/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreSDG = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore SDGs');
            error.statusCode = 403;
            throw error;
        }
        const sdgId = req.params.id;
        // Find the SDG first to check if it exists and is archived
        const sdg = yield sdg_model_1.default.findById(sdgId);
        if (!sdg) {
            const error = new Error('SDG not found');
            error.statusCode = 404;
            throw error;
        }
        if (!sdg.archived) {
            const error = new Error('SDG is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Restore the SDG
        const restoredSDG = yield sdg_model_1.default.findByIdAndUpdate(sdgId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'SDG restored successfully',
            data: restoredSDG
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid SDG ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreSDG = restoreSDG;
exports.default = {
    createSDG: exports.createSDG,
    getSDGs: exports.getSDGs,
    getSDG: exports.getSDG,
    updateSDG: exports.updateSDG,
    archiveSDG: exports.archiveSDG,
    restoreSDG: exports.restoreSDG
};
//# sourceMappingURL=sdg.controller.js.map