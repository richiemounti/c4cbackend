"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.cleanupAllStaleRoles = exports.cleanupStaleRoles = exports.getUserRoles = exports.setPrimaryRole = exports.removeRole = exports.assignRole = void 0;
const user_model_1 = __importStar(require("../models/user.model"));
const organization_model_1 = __importDefault(require("../models/organization.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const mongoose_1 = __importDefault(require("mongoose"));
// Type guard to check if user is authenticated
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
// All valid roles in the system
const VALID_CONNECTGO_ROLES = ['owner', 'admin', 'accountManager', 'analyst'];
const VALID_CLIENT_ROLES = [
    'manager',
    'projectCreator',
    'leadership',
    'hq',
    'communications',
    'fieldStaff',
    'fieldAgent'
];
const ALL_VALID_ROLES = [...VALID_CONNECTGO_ROLES, ...VALID_CLIENT_ROLES];
// Roles that require an organization to be specified
const ROLES_REQUIRING_ORG = [
    'projectCreator',
    'leadership',
    'hq',
    'communications',
    'fieldStaff',
    'fieldAgent'
];
/**
 * Assign role to a user
 * @route POST /api/v1/users/:id/roles
 * @access Private (ConnectGo staff or organization managers)
 */
const assignRole = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Auth check first
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.params.id;
        const { role, organizationId, projectIds, isOrgAdmin, permissions } = req.body;
        // Validate role is provided
        if (!role) {
            const error = new Error('Role is required');
            error.statusCode = 400;
            throw error;
        }
        // Validate role is a known valid role
        if (!ALL_VALID_ROLES.includes(role)) {
            const error = new Error(`Invalid role: ${role}. Must be one of: ${ALL_VALID_ROLES.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }
        // Find the user
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        // Only ConnectGo staff can assign ConnectGo roles
        if (VALID_CONNECTGO_ROLES.includes(role) && !req.user.isConnectGoStaff) {
            const error = new Error('Only ConnectGo staff can assign ConnectGo roles');
            error.statusCode = 403;
            throw error;
        }
        // Roles requiring org must have organizationId
        if (ROLES_REQUIRING_ORG.includes(role) && !organizationId) {
            const error = new Error('Organization ID is required for this role');
            error.statusCode = 400;
            throw error;
        }
        // Validate organization if provided
        if (organizationId) {
            const organization = yield organization_model_1.default.findById(organizationId);
            if (!organization) {
                const error = new Error('Organization not found');
                error.statusCode = 404;
                throw error;
            }
            // Non-ConnectGo staff (i.e. org managers) can only assign within their own org
            if (!req.user.isConnectGoStaff) {
                const hasAccess = req.user.hasOrganizationAccess(new mongoose_1.default.Types.ObjectId(organizationId)) &&
                    req.user.hasPermission('assign_roles');
                if (!hasAccess) {
                    const error = new Error('Not authorized to assign roles for this organization');
                    error.statusCode = 403;
                    throw error;
                }
            }
        }
        // Validate project IDs if provided
        if (projectIds && projectIds.length > 0) {
            for (const projectId of projectIds) {
                const project = yield project_model_1.default.findById(projectId);
                if (!project) {
                    const error = new Error(`Project with ID ${projectId} not found`);
                    error.statusCode = 404;
                    throw error;
                }
                // Ensure project belongs to the given organization
                if (organizationId && project.organization.toString() !== organizationId) {
                    const error = new Error(`Project ${projectId} does not belong to organization ${organizationId}`);
                    error.statusCode = 400;
                    throw error;
                }
                // Non-ConnectGo staff must have access to the project
                if (!req.user.isConnectGoStaff) {
                    const hasAccess = req.user.hasProjectAccess(new mongoose_1.default.Types.ObjectId(projectId));
                    if (!hasAccess) {
                        const error = new Error(`Not authorized to include project ${projectId} in role assignment`);
                        error.statusCode = 403;
                        throw error;
                    }
                }
            }
        }
        // Build the role object. For client roles, resolve isOrgAdmin/permissions from
        // any explicit overrides, falling back to that role's ROLE_PRESETS default.
        const roleGrant = VALID_CLIENT_ROLES.includes(role)
            ? (0, user_model_1.resolveRoleGrant)(role, { isOrgAdmin, permissions })
            : undefined;
        const roleObject = { role };
        if (organizationId)
            roleObject.organization = organizationId;
        if (projectIds && projectIds.length > 0)
            roleObject.projects = projectIds;
        if (roleGrant) {
            roleObject.isOrgAdmin = roleGrant.isOrgAdmin;
            roleObject.permissions = roleGrant.permissions;
        }
        // Check if user already has this role for the same organization
        const existingRoleIndex = user.roles.findIndex((r) => {
            if (r.role !== role)
                return false;
            // For org-scoped roles, match on org too
            if (organizationId) {
                return r.organization && r.organization.toString() === organizationId;
            }
            return true;
        });
        if (existingRoleIndex !== -1) {
            // Update projects on existing role entry
            if (projectIds) {
                user.roles[existingRoleIndex].projects = projectIds;
            }
            if (roleGrant) {
                user.roles[existingRoleIndex].isOrgAdmin = roleGrant.isOrgAdmin;
                user.roles[existingRoleIndex].permissions = roleGrant.permissions;
            }
        }
        else {
            // Add new role entry
            user.roles.push(roleObject);
        }
        // If this is the user's first/only role, make it the primary
        if (user.roles.length === 1) {
            user.primaryRole = role;
        }
        // Mark as ConnectGo staff if a ConnectGo role was assigned
        if (VALID_CONNECTGO_ROLES.includes(role)) {
            user.isConnectGoStaff = true;
        }
        yield user.save();
        res.status(200).json({
            success: true,
            message: 'Role assigned successfully',
            data: {
                userId: user._id,
                roles: user.roles,
                primaryRole: user.primaryRole
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.assignRole = assignRole;
/**
 * Remove role from a user
 * @route DELETE /api/v1/users/:id/roles/:roleId
 * @access Private (ConnectGo staff or organization managers)
 */
const removeRole = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Auth check first
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.params.id;
        const roleId = req.params.roleId;
        // Find the user
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        if (!user.roles || user.roles.length === 0) {
            const error = new Error('User has no roles');
            error.statusCode = 400;
            throw error;
        }
        const roleIndex = user.roles.findIndex((r) => r._id.toString() === roleId);
        if (roleIndex === -1) {
            const error = new Error('Role not found for this user');
            error.statusCode = 404;
            throw error;
        }
        const roleToRemove = user.roles[roleIndex];
        // Only ConnectGo staff can remove ConnectGo roles
        if (VALID_CONNECTGO_ROLES.includes(roleToRemove.role) && !req.user.isConnectGoStaff) {
            const error = new Error('Only ConnectGo staff can remove ConnectGo roles');
            error.statusCode = 403;
            throw error;
        }
        // For org-scoped roles, check org access for non-ConnectGo staff
        if (roleToRemove.organization && !req.user.isConnectGoStaff) {
            const hasAccess = req.user.hasOrganizationAccess(roleToRemove.organization) &&
                req.user.hasPermission('assign_roles');
            if (!hasAccess) {
                const error = new Error('Not authorized to remove roles for this organization');
                error.statusCode = 403;
                throw error;
            }
        }
        // Don't allow removing the last role
        if (user.roles.length === 1) {
            const error = new Error('Cannot remove the only role from a user');
            error.statusCode = 400;
            throw error;
        }
        // Remove the role
        user.roles.splice(roleIndex, 1);
        // If the removed role was primary, reassign primary to first remaining role
        if (user.primaryRole === roleToRemove.role) {
            user.primaryRole = user.roles[0].role;
        }
        // If a ConnectGo role was removed, re-evaluate the isConnectGoStaff flag
        if (VALID_CONNECTGO_ROLES.includes(roleToRemove.role)) {
            const stillHasConnectGoRole = user.roles.some((r) => VALID_CONNECTGO_ROLES.includes(r.role));
            if (!stillHasConnectGoRole) {
                user.isConnectGoStaff = false;
            }
        }
        yield user.save();
        res.status(200).json({
            success: true,
            message: 'Role removed successfully',
            data: {
                userId: user._id,
                roles: user.roles,
                primaryRole: user.primaryRole
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.removeRole = removeRole;
/**
 * Set primary role for a user
 * @route PUT /api/v1/users/:id/roles/primary
 * @access Private (ConnectGo staff, organization managers, or the user themselves)
 */
const setPrimaryRole = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.params.id;
        const { roleId } = req.body;
        if (!roleId) {
            const error = new Error('Role ID is required');
            error.statusCode = 400;
            throw error;
        }
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        const isSelfUpdate = req.user._id.toString() === userId;
        const isConnectGoStaff = req.user.isConnectGoStaff;
        const isOrganizationManager = user.roles.some((role) => {
            return (role.organization &&
                req.user.hasOrganizationAccess(role.organization) &&
                req.user.hasPermission('assign_roles'));
        });
        if (!isSelfUpdate && !isConnectGoStaff && !isOrganizationManager) {
            const error = new Error('Not authorized to change primary role for this user');
            error.statusCode = 403;
            throw error;
        }
        const targetRole = user.roles.find((r) => r._id.toString() === roleId);
        if (!targetRole) {
            const error = new Error('Role not found for this user');
            error.statusCode = 404;
            throw error;
        }
        user.primaryRole = targetRole.role;
        yield user.save();
        res.status(200).json({
            success: true,
            message: 'Primary role updated successfully',
            data: {
                userId: user._id,
                primaryRole: user.primaryRole
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.setPrimaryRole = setPrimaryRole;
/**
 * Get user roles
 * @route GET /api/v1/users/:id/roles
 * @access Private (ConnectGo staff, organization managers, or the user themselves)
 */
const getUserRoles = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.params.id;
        const user = yield user_model_1.default.findById(userId)
            .populate('roles.organization', 'name country city')
            .populate('roles.projects', 'name description location');
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        const isSelf = req.user._id.toString() === userId;
        const isConnectGoStaff = req.user.isConnectGoStaff;
        const canViewRoles = user.roles.some((role) => {
            return (role.organization &&
                req.user.hasOrganizationAccess(role.organization._id || role.organization));
        });
        if (!isSelf && !isConnectGoStaff && !canViewRoles) {
            const error = new Error('Not authorized to view roles for this user');
            error.statusCode = 403;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: {
                userId: user._id,
                roles: user.roles,
                primaryRole: user.primaryRole,
                isConnectGoStaff: user.isConnectGoStaff
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getUserRoles = getUserRoles;
/**
 * Clean up stale/invalid roles from a user
 * @route POST /api/v1/users/:id/roles/cleanup
 * @access Private (ConnectGo staff only)
 */
const cleanupStaleRoles = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('ConnectGo staff access required');
            error.statusCode = 403;
            throw error;
        }
        const userId = req.params.id;
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        const before = user.roles.length;
        user.roles = user.roles.filter((r) => ALL_VALID_ROLES.includes(r.role));
        const removed = before - user.roles.length;
        // Fix primaryRole if it was stale
        if (!ALL_VALID_ROLES.includes(user.primaryRole)) {
            user.primaryRole = user.roles.length > 0 ? user.roles[0].role : 'manager';
        }
        // Fix isConnectGoStaff flag
        user.isConnectGoStaff = user.roles.some((r) => VALID_CONNECTGO_ROLES.includes(r.role));
        yield user.save();
        res.status(200).json({
            success: true,
            message: `Cleanup complete. Removed ${removed} stale role(s).`,
            data: {
                userId: user._id,
                roles: user.roles,
                primaryRole: user.primaryRole,
                isConnectGoStaff: user.isConnectGoStaff
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.cleanupStaleRoles = cleanupStaleRoles;
/**
 * Bulk clean up stale roles across ALL users
 * @route POST /api/v1/users/roles/cleanup-all
 * @access Private (ConnectGo staff only)
 */
const cleanupAllStaleRoles = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('ConnectGo staff access required');
            error.statusCode = 403;
            throw error;
        }
        const usersWithStaleRoles = yield user_model_1.default.find({
            'roles.role': { $nin: ALL_VALID_ROLES }
        });
        const results = [];
        for (const user of usersWithStaleRoles) {
            const before = user.roles.length;
            user.roles = user.roles.filter((r) => ALL_VALID_ROLES.includes(r.role));
            const removed = before - user.roles.length;
            if (!ALL_VALID_ROLES.includes(user.primaryRole)) {
                user.primaryRole = user.roles.length > 0 ? user.roles[0].role : 'manager';
            }
            user.isConnectGoStaff = user.roles.some((r) => VALID_CONNECTGO_ROLES.includes(r.role));
            yield user.save();
            results.push({ userId: user._id.toString(), email: user.email, removed });
        }
        res.status(200).json({
            success: true,
            message: `Bulk cleanup complete. Processed ${results.length} user(s).`,
            data: results
        });
    }
    catch (error) {
        next(error);
    }
});
exports.cleanupAllStaleRoles = cleanupAllStaleRoles;
//# sourceMappingURL=role.controller.js.map