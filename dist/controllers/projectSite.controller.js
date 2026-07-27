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
exports.deleteProjectSite = exports.restoreProjectSite = exports.archiveProjectSite = exports.updateProjectSite = exports.getProjectSite = exports.getProjectSites = exports.createProjectSite = void 0;
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
// Type guard to check if user is defined
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Create a new project site
 * @route POST /api/v1/projects/:projectId/sites
 * @access Private (Manager, Project Creator)
 */
const createProjectSite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield projectSite_model_1.default.db.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const { name, description, address, region, city, country, coordinates, size, sizeUnit, siteType, status, contacts, notes, startDate } = req.body;
        // Check if the project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Verify the user has permission to create sites for this project
        // This should be handled by the middleware that checks for project access
        // Create the new site
        const newSite = yield projectSite_model_1.default.create([{
                project: projectId,
                name,
                description,
                address,
                region,
                city,
                country,
                coordinates,
                size,
                sizeUnit,
                siteType,
                status,
                contacts,
                notes,
                startDate,
                creator: req.user._id
            }], { session });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Project site created successfully',
            data: newSite
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        // Handle duplicate site name error
        if (error instanceof Error && error.name === 'MongoError' && error.code === 11000) {
            const customError = new Error('A site with this name already exists for this project');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.createProjectSite = createProjectSite;
/**
 * Get all sites for a project
 * @route GET /api/v1/projects/:projectId/sites
 * @access Private (Based on project access)
 */
const getProjectSites = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.params;
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has access to this project (should be handled by middleware)
        // Initialize query
        let query = projectSite_model_1.default.find({
            project: projectId,
            archived: { $ne: true }
        });
        // Apply filters based on query parameters
        if (req.query.siteType) {
            query = query.find({ siteType: req.query.siteType });
        }
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }
        if (req.query.region) {
            query = query.find({ region: req.query.region });
        }
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
            query = query.sort('name'); // Default sort by name
        }
        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        // Count total documents
        const total = yield projectSite_model_1.default.countDocuments({
            project: projectId,
            archived: { $ne: true }
        });
        query = query.skip(startIndex).limit(limit);
        // Execute query
        const sites = yield query;
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
            count: sites.length,
            pagination,
            total,
            data: sites
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectSites = getProjectSites;
/**
 * Get single project site by ID
 * @route GET /api/v1/project-sites/:id
 * @access Private (Based on project access)
 */
const getProjectSite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const siteId = req.params.id;
        const site = yield projectSite_model_1.default.findById(siteId);
        if (!site) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if site is archived
        if (site.archived) {
            const error = new Error('This project site has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        // Check if user has access to the project this site belongs to
        // This should be handled by middleware
        res.status(200).json({
            success: true,
            data: site
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project site ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getProjectSite = getProjectSite;
/**
 * Update project site by ID
 * @route PUT /api/v1/project-sites/:id
 * @access Private (Based on project access)
 */
const updateProjectSite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const siteId = req.params.id;
        const updates = req.body;
        // Find the site first to check if it exists and is not archived
        const site = yield projectSite_model_1.default.findById(siteId);
        if (!site) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        if (site.archived) {
            const error = new Error('Cannot update an archived project site');
            error.statusCode = 400;
            throw error;
        }
        // Check if user has permission to update this site
        // This should be handled by middleware
        // Don't allow changing the project
        if (updates.project) {
            delete updates.project;
        }
        // Update the site
        const updatedSite = yield projectSite_model_1.default.findByIdAndUpdate(siteId, updates, { new: true, runValidators: true });
        res.status(200).json({
            success: true,
            message: 'Project site updated successfully',
            data: updatedSite
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project site ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        // Handle duplicate site name error
        if (error instanceof Error && error.name === 'MongoError' && error.code === 11000) {
            const customError = new Error('A site with this name already exists for this project');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateProjectSite = updateProjectSite;
/**
 * Archive project site by ID (soft delete)
 * @route DELETE /api/v1/project-sites/:id
 * @access Private (Based on project access)
 */
const archiveProjectSite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const siteId = req.params.id;
        // Find the site first to check if it exists
        const site = yield projectSite_model_1.default.findById(siteId);
        if (!site) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        if (site.archived) {
            const error = new Error('Project site is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Check if user has permission to archive this site
        // This should be handled by middleware
        // Archive the site (soft delete)
        const archivedSite = yield projectSite_model_1.default.findByIdAndUpdate(siteId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Project site archived successfully',
            data: archivedSite
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project site ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveProjectSite = archiveProjectSite;
/**
 * Restore archived project site
 * @route POST /api/v1/project-sites/:id/restore
 * @access Private (Based on project access)
 */
const restoreProjectSite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const siteId = req.params.id;
        // Find the site first to check if it exists and is archived
        const site = yield projectSite_model_1.default.findById(siteId);
        if (!site) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        if (!site.archived) {
            const error = new Error('Project site is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Check if the parent project is archived
        const project = yield project_model_1.default.findById(site.project);
        if (project === null || project === void 0 ? void 0 : project.archived) {
            const error = new Error('Cannot restore a site belonging to an archived project');
            error.statusCode = 400;
            throw error;
        }
        // Check if user has permission to restore this site
        // This should be handled by middleware
        // Restore the site
        const restoredSite = yield projectSite_model_1.default.findByIdAndUpdate(siteId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Project site restored successfully',
            data: restoredSite
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project site ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreProjectSite = restoreProjectSite;
/**
 * Permanently delete project site
 * @route DELETE /api/v1/project-sites/:id/permanent
 * @access Private (ConnectGo staff only)
 */
const deleteProjectSite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Only ConnectGo staff can permanently delete project sites');
            error.statusCode = 403;
            throw error;
        }
        const siteId = req.params.id;
        // Find the site first to check if it exists
        const site = yield projectSite_model_1.default.findById(siteId);
        if (!site) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        // Permanently delete the site
        yield projectSite_model_1.default.findByIdAndDelete(siteId);
        res.status(200).json({
            success: true,
            message: 'Project site permanently deleted',
            data: null
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project site ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteProjectSite = deleteProjectSite;
//# sourceMappingURL=projectSite.controller.js.map