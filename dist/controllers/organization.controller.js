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
exports.deleteOrganization = exports.restoreOrganization = exports.archiveOrganization = exports.updateOrganization = exports.getOrganization = exports.getMyOrganizations = exports.getOrganizations = exports.createOrganization = void 0;
const organization_model_1 = __importDefault(require("../models/organization.model"));
const organization_service_1 = require("../services/organization.service");
// Type guard to check if user is defined
// Then modify the isUserAuthenticated function to include type assertion
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Create a new organization
 * @route POST /api/v1/organizations
 * @access Private
 */
const createOrganization = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield organization_model_1.default.db.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { name, country, city } = req.body;
        // Add creator from authenticated user (from authorize middleware)
        const creator = req.user._id;
        // Check if the user is a manager or ConnectGo staff
        if (req.user.primaryRole === 'manager' || req.user.isConnectGoStaff) {
            // For managers, we'll update their role to include this organization
            if (req.user.primaryRole === 'manager') {
                const organization = yield (0, organization_service_1.createOrganizationForManager)(creator.toString(), // Convert ObjectId to string
                { name, country, city }, session);
                yield session.commitTransaction();
                session.endSession();
                res.status(201).json({
                    success: true,
                    message: 'Organization created successfully',
                    data: organization
                });
                return;
            }
        }
        // Standard creation flow for ConnectGo staff
        const newOrganizations = yield organization_model_1.default.create([{
                name,
                country,
                city,
                creator
            }], { session });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Organization created successfully',
            data: newOrganizations[0]
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createOrganization = createOrganization;
/**
 * Get all organizations with pagination, filtering, and sorting
 * @route GET /api/v1/organizations
 * @access Private
 */
const getOrganizations = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if we should filter by user access
        const userAccessOnly = req.query.userAccessOnly === 'true';
        // Initialize query
        let query;
        if (userAccessOnly) {
            // Get only organizations accessible by the current user
            const organizations = yield (0, organization_service_1.getUserOrganizations)(req.user._id.toString());
            return res.status(200).json({
                success: true,
                count: organizations.length,
                data: organizations
            });
        }
        else {
            // Standard organization query with filters
            query = organization_model_1.default.find({ archived: { $ne: true } });
        }
        // Copy req.query to avoid modifying the original
        const reqQuery = Object.assign({}, req.query);
        // Fields to exclude from filtering
        const removeFields = ['select', 'sort', 'page', 'limit', 'populate', 'userAccessOnly'];
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
        const total = yield organization_model_1.default.countDocuments({ archived: { $ne: true } });
        query = query.skip(startIndex).limit(limit);
        // Execute query
        const organizations = yield query;
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
            count: organizations.length,
            pagination,
            total,
            data: organizations
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getOrganizations = getOrganizations;
/**
 * Get organizations for the current user
 * @route GET /api/v1/organizations/my-organizations
 * @access Private
 */
const getMyOrganizations = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const organizations = yield (0, organization_service_1.getUserOrganizations)(userId);
        res.status(200).json({
            success: true,
            count: organizations.length,
            data: organizations
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyOrganizations = getMyOrganizations;
/**
 * Get single organization by ID
 * @route GET /api/v1/organizations/:id
 * @access Private
 */
const getOrganization = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const organizationId = req.params.id;
        const query = organization_model_1.default.findById(organizationId);
        // Populate creator field if requested
        if (req.query.populate === 'creator') {
            query.populate({
                path: 'creator',
                select: 'name email userName'
            });
        }
        const organization = yield query;
        if (!organization) {
            const error = new Error('Organization not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if organization is archived
        if (organization.archived) {
            const error = new Error('This organization has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        // If user is not ConnectGo staff, check if they have access to this organization
        if (!req.user.isConnectGoStaff) {
            // Use type assertion to access the custom method
            const user = req.user;
            const hasAccess = user.hasOrganizationAccess(organization._id);
            if (!hasAccess) {
                const error = new Error('Not authorized to access this organization');
                error.statusCode = 403;
                throw error;
            }
        }
        res.status(200).json({
            success: true,
            data: organization
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid organization ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getOrganization = getOrganization;
/**
 * Update organization by ID
 * @route PUT /api/v1/organizations/:id
 * @access Private
 */
const updateOrganization = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const organizationId = req.params.id;
        const { name, country, city } = req.body;
        // Find the organization first to check if it exists and is not archived
        const organization = yield organization_model_1.default.findById(organizationId);
        if (!organization) {
            const error = new Error('Organization not found');
            error.statusCode = 404;
            throw error;
        }
        if (organization.archived) {
            const error = new Error('Cannot update an archived organization');
            error.statusCode = 400;
            throw error;
        }
        // Check if user is creator or has permission to update
        // ConnectGo staff can update any organization
        if (!req.user.isConnectGoStaff) {
            // Organization managers can update their organization
            const roles = req.user.roles || [];
            const isManager = roles.some((r) => r.role === 'manager' && r.organization && r.organization.toString() === organizationId);
            const isCreator = organization.creator.toString() === req.user._id.toString();
            if (!isManager && !isCreator) {
                const error = new Error('Not authorized to update this organization');
                error.statusCode = 403;
                throw error;
            }
        }
        // Update the organization
        const updatedOrganization = yield organization_model_1.default.findByIdAndUpdate(organizationId, { name, country, city }, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'Organization updated successfully',
            data: updatedOrganization
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid organization ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateOrganization = updateOrganization;
/**
 * Archive organization by ID (soft delete)
 * @route DELETE /api/v1/organizations/:id
 * @access Private
 */
const archiveOrganization = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const organizationId = req.params.id;
        // Find the organization first to check if it exists
        const organization = yield organization_model_1.default.findById(organizationId);
        if (!organization) {
            const error = new Error('Organization not found');
            error.statusCode = 404;
            throw error;
        }
        if (organization.archived) {
            const error = new Error('Organization is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Check if user is creator or has permission to archive
        // ConnectGo staff can archive any organization
        if (!req.user.isConnectGoStaff) {
            // Organization managers can archive their organization
            const roles = req.user.roles || [];
            const isManager = roles.some((r) => r.role === 'manager' && r.organization && r.organization.toString() === organizationId);
            const isCreator = organization.creator.toString() === req.user._id.toString();
            if (!isManager && !isCreator) {
                const error = new Error('Not authorized to archive this organization');
                error.statusCode = 403;
                throw error;
            }
        }
        // Archive the organization (soft delete)
        const archivedOrganization = yield organization_model_1.default.findByIdAndUpdate(organizationId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Organization archived successfully',
            data: archivedOrganization
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid organization ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveOrganization = archiveOrganization;
/**
 * Restore archived organization by ID
 * @route POST /api/v1/organizations/:id/restore
 * @access Private
 */
const restoreOrganization = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const organizationId = req.params.id;
        // Find the organization first to check if it exists and is archived
        const organization = yield organization_model_1.default.findById(organizationId);
        if (!organization) {
            const error = new Error('Organization not found');
            error.statusCode = 404;
            throw error;
        }
        if (!organization.archived) {
            const error = new Error('Organization is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Check if user has permission to restore
        // Only ConnectGo staff and the original creator can restore
        if (!req.user.isConnectGoStaff && organization.creator.toString() !== req.user._id.toString()) {
            const error = new Error('Not authorized to restore this organization');
            error.statusCode = 403;
            throw error;
        }
        // Restore the organization
        const restoredOrganization = yield organization_model_1.default.findByIdAndUpdate(organizationId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Organization restored successfully',
            data: restoredOrganization
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid organization ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreOrganization = restoreOrganization;
/**
 * Permanently delete organization by ID
 * @route DELETE /api/v1/organizations/:id/permanent
 * @access Private (Admin only)
 */
const deleteOrganization = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const organizationId = req.params.id;
        // Find the organization first to check if it exists
        const organization = yield organization_model_1.default.findById(organizationId);
        if (!organization) {
            const error = new Error('Organization not found');
            error.statusCode = 404;
            throw error;
        }
        // Only ConnectGo staff with 'owner' role can permanently delete organizations
        if (!req.user.isConnectGoStaff || req.user.primaryRole !== 'owner') {
            const error = new Error('Not authorized to permanently delete organizations. Only system owners can perform this action.');
            error.statusCode = 403;
            throw error;
        }
        // Permanently delete the organization
        yield organization_model_1.default.findByIdAndDelete(organizationId);
        res.status(200).json({
            success: true,
            message: 'Organization permanently deleted',
            data: null
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid organization ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteOrganization = deleteOrganization;
//# sourceMappingURL=organization.controller.js.map