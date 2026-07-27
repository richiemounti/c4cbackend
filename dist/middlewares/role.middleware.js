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
exports.restrictTo = exports.hasRole = exports.isConnectGoStaff = exports.hasOrganizationAccess = exports.hasProjectAccess = exports.hasPermission = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const hasPermission = (permissions) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                const error = new Error('Authentication required');
                error.statusCode = 401;
                throw error;
            }
            const hasRequiredPermission = permissions.some(permission => req.user.hasPermission(permission));
            if (!hasRequiredPermission) {
                const error = new Error('Not authorized to perform this action');
                error.statusCode = 403;
                throw error;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.hasPermission = hasPermission;
/**
 * Simplified hasProjectAccess middleware
 * Works for all project and project-site routes
 */
const hasProjectAccess = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!req.user) {
                const error = new Error('Authentication required');
                error.statusCode = 401;
                throw error;
            }
            let projectId;
            // STEP 1: Try to get project ID from params (most common cases)
            if (req.params.projectId) {
                // Case: /projects/:projectId/sites or /projects/:projectId
                projectId = req.params.projectId;
            }
            else if (req.params.id) {
                // Case: Could be /projects/:id OR /project-sites/:id
                // Check if this is a project-site route by looking at the URL
                const isProjectSiteRoute = req.originalUrl.includes('/project-site') ||
                    req.baseUrl.includes('/project-site');
                if (isProjectSiteRoute) {
                    // It's a project site route - need to fetch the site to get project ID
                    try {
                        const siteId = req.params.id;
                        const site = yield projectSite_model_1.default.findById(siteId).select('project');
                        if (!site) {
                            const error = new Error('Project site not found');
                            error.statusCode = 404;
                            throw error;
                        }
                        projectId = site.project.toString();
                    }
                    catch (err) {
                        if (err.statusCode === 404)
                            throw err;
                        const error = new Error('Failed to verify project site access');
                        error.statusCode = 500;
                        throw error;
                    }
                }
                else {
                    // It's a direct project route - id IS the project ID
                    projectId = req.params.id;
                }
            }
            else if (req.params.siteId) {
                // Case: /project-sites/:siteId/setup
                try {
                    const siteId = req.params.siteId;
                    const site = yield projectSite_model_1.default.findById(siteId).select('project');
                    if (!site) {
                        const error = new Error('Project site not found');
                        error.statusCode = 404;
                        throw error;
                    }
                    projectId = site.project.toString();
                }
                catch (err) {
                    if (err.statusCode === 404)
                        throw err;
                    const error = new Error('Failed to verify project site access');
                    error.statusCode = 500;
                    throw error;
                }
            }
            else if (req.body.projectId) {
                // Case: POST/PUT with projectId in body
                projectId = req.body.projectId;
            }
            // STEP 2: Verify we got a project ID
            if (!projectId) {
                const error = new Error('Project ID is required or could not be determined');
                error.statusCode = 400;
                throw error;
            }
            // STEP 3: Check if user has access to this project
            const hasAccess = req.user.hasProjectAccess(new mongoose_1.default.Types.ObjectId(projectId));
            if (!hasAccess) {
                const error = new Error('Not authorized to access this project');
                error.statusCode = 403;
                throw error;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    });
};
exports.hasProjectAccess = hasProjectAccess;
const hasOrganizationAccess = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (!req.user) {
                const error = new Error('Authentication required');
                error.statusCode = 401;
                throw error;
            }
            const organizationId = req.params.id || req.params.organizationId || req.body.organizationId || req.body.organization;
            if (!organizationId) {
                const error = new Error('Organization ID is required');
                error.statusCode = 400;
                throw error;
            }
            const hasAccess = req.user.hasOrganizationAccess(new mongoose_1.default.Types.ObjectId(organizationId));
            if (!hasAccess) {
                const error = new Error('Not authorized to access this organization');
                error.statusCode = 403;
                throw error;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    });
};
exports.hasOrganizationAccess = hasOrganizationAccess;
const isConnectGoStaff = () => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                const error = new Error('Authentication required');
                error.statusCode = 401;
                throw error;
            }
            if (!req.user.isConnectGoStaff) {
                const error = new Error('ConnectGo staff access required');
                error.statusCode = 403;
                throw error;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.isConnectGoStaff = isConnectGoStaff;
const hasRole = (roles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                const error = new Error('Authentication required');
                error.statusCode = 401;
                throw error;
            }
            const hasAllowedRole = req.user.primaryRole && roles.includes(req.user.primaryRole);
            const isAdmin = req.user.isConnectGoStaff;
            if (!hasAllowedRole && !isAdmin) {
                const error = new Error(`Role restricted. Required roles: ${roles.join(', ')}`);
                error.statusCode = 403;
                throw error;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.hasRole = hasRole;
const restrictTo = (roles) => {
    return (0, exports.hasRole)(roles);
};
exports.restrictTo = restrictTo;
//# sourceMappingURL=role.middleware.js.map