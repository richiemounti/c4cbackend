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
exports.archiveUser = exports.updateUserPermissions = exports.updateUser = exports.resendInvitation = exports.revokeInvitation = exports.getOrganizationUsers = exports.acceptInvitation = exports.verifyInvitation = exports.inviteUser = exports.getUser = exports.getUsers = void 0;
const user_model_1 = __importStar(require("../models/user.model"));
const organization_model_1 = __importDefault(require("../models/organization.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const email_service_1 = require("../services/email.service");
const emailTemplates_service_1 = __importDefault(require("../services/emailTemplates.service"));
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("../config/env");
/**
 * Get all users with pagination, filtering, and sorting
 * @route GET /api/v1/users
 * @access Private
 */
const getUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query - add explicit type casting here
        let query = user_model_1.default.find({ archived: { $ne: true } });
        // Rest of your code remains the same
        const reqQuery = Object.assign({}, req.query);
        const removeFields = ['select', 'sort', 'page', 'limit'];
        removeFields.forEach(param => delete reqQuery[param]);
        let queryStr = JSON.stringify(reqQuery);
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
        // Apply filtering with type assertion
        query = query.find(JSON.parse(queryStr));
        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(`${fields} -password`);
        }
        else {
            query = query.select('-password');
        }
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        }
        else {
            query = query.sort('-createdAt');
        }
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = yield user_model_1.default.countDocuments({ archived: { $ne: true } });
        query = query.skip(startIndex).limit(limit);
        // Execute query
        const users = yield query;
        // Pagination logic remains the same
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
            count: users.length,
            pagination,
            total,
            data: users
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getUsers = getUsers;
/**
 * Get single user by ID
 * @route GET /api/v1/users/:id
 * @access Private
 */
const getUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.params.id;
        // Add type assertion here
        const user = yield user_model_1.default.findById(userId).select('-password');
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        if (user.archived) {
            const error = new Error('This user account has been archived');
            error.statusCode = 410;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: user
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid user ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getUser = getUser;
/**
 * Invite a user to join an organization
 * @route POST /api/v1/users/invite
 * @access Private (Manager, Admin)
 */
const inviteUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, role, organizationId, projectIds, isOrgAdmin, permissions } = req.body;
        const roleGrant = (0, user_model_1.resolveRoleGrant)(role, { isOrgAdmin, permissions });
        // Verify organization exists and user has access
        const organization = yield organization_model_1.default.findById(organizationId);
        if (!organization) {
            const error = new Error('Organization not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if current user has access to this organization
        if (!req.user.isConnectGoStaff && !req.user.hasOrganizationAccess(organizationId)) {
            const error = new Error('Not authorized to invite users to this organization');
            error.statusCode = 403;
            throw error;
        }
        // Verify all project IDs exist and belong to this organization
        if (projectIds && projectIds.length > 0) {
            const projects = yield project_model_1.default.find({
                _id: { $in: projectIds },
                organization: organizationId
            });
            if (projects.length !== projectIds.length) {
                const error = new Error('One or more projects not found or do not belong to this organization');
                error.statusCode = 400;
                throw error;
            }
        }
        // Check if user already exists
        const existingUser = yield user_model_1.default.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            // ===== EXISTING USER FLOW =====
            return yield addExistingUserToOrganization(existingUser, role, organizationId, projectIds, organization.name, req.user, res, roleGrant);
        }
        else {
            // ===== NEW USER FLOW =====
            return yield inviteNewUser(email, role, organizationId, projectIds, organization.name, req.user, res, roleGrant);
        }
    }
    catch (error) {
        next(error);
    }
});
exports.inviteUser = inviteUser;
/**
 * Handle inviting a brand new user (doesn't exist in system)
 */
function inviteNewUser(email, role, organizationId, projectIds, organizationName, inviter, res, roleGrant) {
    return __awaiter(this, void 0, void 0, function* () {
        // Generate invitation token
        const invitationToken = crypto_1.default.randomBytes(32).toString('hex');
        const hashedToken = crypto_1.default.createHash('sha256').update(invitationToken).digest('hex');
        const invitationExpires = new Date();
        invitationExpires.setHours(invitationExpires.getHours() + 72); // 72 hours to accept
        // Create temporary user
        const temporaryUser = yield user_model_1.default.create({
            email: email.toLowerCase(),
            userName: email.split('@')[0], // Temporary username
            name: '', // Will be set when they accept invitation
            password: crypto_1.default.randomBytes(32).toString('hex'), // Temporary password
            isTemporaryUser: true,
            invitationToken: hashedToken,
            invitationExpires,
            invitedBy: inviter._id,
            invitedToOrganization: organizationId,
            invitedToProjects: projectIds || [],
            invitedRole: role,
            invitationAccepted: false,
            primaryRole: role,
            roles: [{
                    role: role,
                    organization: organizationId,
                    projects: projectIds || [],
                    isOrgAdmin: roleGrant.isOrgAdmin,
                    permissions: roleGrant.permissions,
                }]
        });
        // Send invitation email
        const invitationUrl = `${env_1.env.FRONTEND_URL}/accept-invitation?token=${invitationToken}`;
        const emailHtml = emailTemplates_service_1.default.generateC4CInvitationEmail({
            organizationName,
            invitationURL: invitationUrl,
        });
        const emailSent = yield email_service_1.emailService.sendEmail({
            to: email,
            subject: `You've been invited to join ${organizationName} on Citizens for Change`,
            html: emailHtml,
        });
        if (!emailSent) {
            console.warn('⚠️  Failed to send invitation email, but user was created');
        }
        res.status(201).json({
            success: true,
            message: 'Invitation sent successfully',
            data: {
                userId: temporaryUser._id,
                email: temporaryUser.email,
                role: temporaryUser.invitedRole,
                organization: organizationName,
                expiresAt: temporaryUser.invitationExpires,
                isNewUser: true,
                emailSent
            }
        });
    });
}
/**
 * Handle adding an existing user to a new organization/projects
 */
function addExistingUserToOrganization(user, role, organizationId, projectIds, organizationName, inviter, res, roleGrant) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check if user already has access to this organization
        const hasOrgAccess = user.hasOrganizationAccess(organizationId);
        if (hasOrgAccess) {
            // User already has a role in this organization
            // Find their existing role for this organization
            const roleIndex = user.roles.findIndex((r) => r.organization && r.organization.toString() === organizationId);
            if (roleIndex !== -1) {
                const existingRole = user.roles[roleIndex];
                // Check if they already have the same role
                if (existingRole.role === role) {
                    // Just add new projects if any
                    if (projectIds && projectIds.length > 0) {
                        const currentProjects = existingRole.projects || [];
                        const currentProjectIds = currentProjects.map((p) => p.toString());
                        // Add only new projects (avoid duplicates)
                        const newProjectIds = projectIds.filter(pid => !currentProjectIds.includes(pid));
                        if (newProjectIds.length > 0) {
                            user.roles[roleIndex].projects = [...currentProjects, ...newProjectIds];
                            yield user.save();
                            // Send notification email
                            yield sendProjectAddedNotification(user.email, organizationName, newProjectIds.length, inviter.name);
                            return res.status(200).json({
                                success: true,
                                message: `User added to ${newProjectIds.length} new project(s)`,
                                data: {
                                    userId: user._id,
                                    email: user.email,
                                    role: user.roles[roleIndex].role,
                                    organization: organizationName,
                                    projectsAdded: newProjectIds.length,
                                    isNewUser: false,
                                    action: 'projects_added'
                                }
                            });
                        }
                        else {
                            return res.status(200).json({
                                success: true,
                                message: 'User already has access to all specified projects',
                                data: {
                                    userId: user._id,
                                    email: user.email,
                                    role: existingRole.role,
                                    organization: organizationName,
                                    isNewUser: false,
                                    action: 'no_change'
                                }
                            });
                        }
                    }
                    else {
                        return res.status(200).json({
                            success: true,
                            message: 'User already has this role in the organization',
                            data: {
                                userId: user._id,
                                email: user.email,
                                role: existingRole.role,
                                organization: organizationName,
                                isNewUser: false,
                                action: 'no_change'
                            }
                        });
                    }
                }
                else {
                    // They have a different role - you might want to upgrade/change it
                    // For safety, let's not automatically change roles
                    const error = new Error(`User already has a different role (${existingRole.role}) in this organization. Please remove the existing role first or contact an administrator.`);
                    error.statusCode = 409; // Conflict
                    throw error;
                }
            }
        }
        // User doesn't have access to this organization - add new role
        user.roles.push({
            role: role,
            organization: organizationId,
            projects: projectIds || [],
            isOrgAdmin: roleGrant.isOrgAdmin,
            permissions: roleGrant.permissions,
        });
        yield user.save();
        // Send notification email
        yield sendOrganizationAddedNotification(user.email, organizationName, role, inviter.name, (projectIds === null || projectIds === void 0 ? void 0 : projectIds.length) || 0);
        res.status(200).json({
            success: true,
            message: 'User successfully added to organization',
            data: {
                userId: user._id,
                email: user.email,
                role: role,
                organization: organizationName,
                projectCount: (projectIds === null || projectIds === void 0 ? void 0 : projectIds.length) || 0,
                isNewUser: false,
                action: 'organization_added'
            }
        });
    });
}
/**
 * Send email notification when existing user is added to new projects
 */
function sendProjectAddedNotification(email, organizationName, projectCount, inviterName) {
    return __awaiter(this, void 0, void 0, function* () {
        const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #272236;">New Projects Assigned</h2>
      <p>Hello,</p>
      <p>${inviterName} has added you to ${projectCount} new project(s) in <strong>${organizationName}</strong>.</p>
      <p>You can now access these projects on Citizens for Change.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${env_1.env.FRONTEND_URL}/dashboard" 
           style="display: inline-block; padding: 15px 40px; background-color: #624CF5; 
                  color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          View Projects
        </a>
      </div>
    </div>
  `;
        yield email_service_1.emailService.sendEmail({
            to: email,
            subject: `New projects assigned in ${organizationName}`,
            html
        });
    });
}
/**
 * Send email notification when existing user is added to new organization
 */
function sendOrganizationAddedNotification(email, organizationName, role, inviterName, projectCount) {
    return __awaiter(this, void 0, void 0, function* () {
        const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #272236;">You've Been Added to a New Organization</h2>
      <p>Hello,</p>
      <p>${inviterName} has granted you <strong>${role}</strong> access to
         <strong>${organizationName}</strong> on Citizens for Change.</p>
      ${projectCount > 0 ? `<p>You've been assigned to ${projectCount} project(s).</p>` : ''}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${env_1.env.FRONTEND_URL}/dashboard" 
           style="display: inline-block; padding: 15px 40px; background-color: #624CF5; 
                  color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Access Dashboard
        </a>
      </div>
    </div>
  `;
        yield email_service_1.emailService.sendEmail({
            to: email,
            subject: `You've been added to ${organizationName}`,
            html
        });
    });
}
/**
 * Verify invitation token
 * @route GET /api/v1/users/verify-invitation/:token
 * @access Public
 */
const verifyInvitation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token } = req.params;
        if (!token) {
            const error = new Error('Invitation token is required');
            error.statusCode = 400;
            throw error;
        }
        // Hash the token
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        // Find user with matching token that hasn't expired
        const user = yield user_model_1.default.findOne({
            invitationToken: hashedToken,
            invitationExpires: { $gt: Date.now() },
            isTemporaryUser: true
        })
            .populate('invitedToOrganization', 'name')
            .populate('invitedToProjects', 'name')
            .populate('invitedBy', 'name email')
            .exec();
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired invitation token',
                valid: false
            });
        }
        res.status(200).json({
            success: true,
            message: 'Invitation is valid',
            valid: true,
            data: {
                email: user.email,
                role: user.invitedRole,
                organization: user.invitedToOrganization,
                projects: user.invitedToProjects,
                invitedBy: user.invitedBy,
                expiresAt: user.invitationExpires
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.verifyInvitation = verifyInvitation;
/**
 * Accept invitation and set up account
 * @route POST /api/v1/users/accept-invitation
 * @access Public
 */
const acceptInvitation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield user_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const { token, userName, name, password } = req.body;
        // Validate input
        if (!token || !userName || !name || !password) {
            const error = new Error('Token, username, name, and password are required');
            error.statusCode = 400;
            throw error;
        }
        // Validate password strength
        if (password.length < 8) {
            const error = new Error('Password must be at least 8 characters long');
            error.statusCode = 400;
            throw error;
        }
        // Hash the token
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        // Find user with matching token that hasn't expired
        const user = yield user_model_1.default.findOne({
            invitationToken: hashedToken,
            invitationExpires: { $gt: Date.now() },
            isTemporaryUser: true
        }).session(session).exec();
        if (!user) {
            const error = new Error('Invalid or expired invitation token');
            error.statusCode = 400;
            throw error;
        }
        // Check if username is already taken
        const existingUserName = yield user_model_1.default.findOne({
            userName,
            _id: { $ne: user._id }
        }).session(session);
        if (existingUserName) {
            const error = new Error('Username is already taken');
            error.statusCode = 409;
            throw error;
        }
        // Hash the new password
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
        // Update user account
        user.userName = userName;
        user.name = name;
        user.password = hashedPassword;
        user.invitationToken = undefined;
        user.invitationExpires = undefined;
        user.invitationAccepted = true;
        user.invitationAcceptedAt = new Date();
        user.isTemporaryUser = false;
        yield user.save({ session });
        yield session.commitTransaction();
        session.endSession();
        console.log(`✅ Invitation accepted by: ${user.email} (${userName})`);
        res.status(200).json({
            success: true,
            message: 'Invitation accepted successfully. You can now login with your credentials.',
            data: {
                _id: user._id,
                userName: user.userName,
                name: user.name,
                email: user.email,
                primaryRole: user.primaryRole,
                roles: user.roles
            }
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.acceptInvitation = acceptInvitation;
/**
 * Get organization users (Manager only)
 * @route GET /api/v1/users/organization/:organizationId
 * @access Private (Manager role required)
 */
const getOrganizationUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { organizationId } = req.params;
        // Check if user has access to this organization
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.hasOrganizationAccess(organizationId))) {
            const error = new Error('You do not have access to this organization');
            error.statusCode = 403;
            throw error;
        }
        // Find users in the organization
        const users = yield user_model_1.default.find({
            archived: { $ne: true },
            'roles.organization': organizationId
        })
            .select('-password')
            .populate('invitedBy', 'name email')
            .exec();
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid organization ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getOrganizationUsers = getOrganizationUsers;
/**
 * Cancel/Revoke invitation (Manager only)
 * @route DELETE /api/v1/users/invitation/:userId
 * @access Private (Manager role required)
 */
const revokeInvitation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const session = yield user_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        // Find the invited user
        const invitedUser = yield user_model_1.default.findById(userId);
        if (!invitedUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        if (!invitedUser.isTemporaryUser) {
            const error = new Error('Cannot revoke invitation for activated users');
            error.statusCode = 400;
            throw error;
        }
        // Check if current user has permission to revoke this invitation
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.hasOrganizationAccess(((_b = invitedUser.invitedToOrganization) === null || _b === void 0 ? void 0 : _b.toString()) || ''))) {
            const error = new Error('You do not have permission to revoke this invitation');
            error.statusCode = 403;
            throw error;
        }
        // Delete the temporary user
        yield user_model_1.default.findByIdAndDelete(userId, { session });
        yield session.commitTransaction();
        session.endSession();
        console.log(`🗑️ Invitation revoked for: ${invitedUser.email}`);
        res.status(200).json({
            success: true,
            message: 'Invitation revoked successfully',
            data: {
                email: invitedUser.email,
                role: invitedUser.invitedRole
            }
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid user ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.revokeInvitation = revokeInvitation;
/**
 * Resend invitation email (Manager only)
 * @route POST /api/v1/users/resend-invitation/:userId
 * @access Private (Manager role required)
 */
const resendInvitation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const session = yield user_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const { userId } = req.params;
        // Find the invited user
        const invitedUser = yield user_model_1.default.findById(userId).session(session)
            .populate('invitedToOrganization', 'name')
            .populate('invitedToProjects', 'name')
            .populate('invitedBy', 'name email');
        if (!invitedUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        if (!invitedUser.isTemporaryUser) {
            const error = new Error('Cannot resend invitation for activated users');
            error.statusCode = 400;
            throw error;
        }
        // Check if current user has permission to resend this invitation
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.hasOrganizationAccess(((_c = (_b = invitedUser.invitedToOrganization) === null || _b === void 0 ? void 0 : _b._id) === null || _c === void 0 ? void 0 : _c.toString()) || ''))) {
            const error = new Error('You do not have permission to resend this invitation');
            error.statusCode = 403;
            throw error;
        }
        // Generate new invitation token
        const invitationToken = crypto_1.default.randomBytes(32).toString('hex');
        const hashedToken = crypto_1.default.createHash('sha256').update(invitationToken).digest('hex');
        // Update invitation token and extend expiry
        invitedUser.invitationToken = hashedToken;
        invitedUser.invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        yield invitedUser.save({ session });
        // Create new invitation URL
        const invitationURL = `${env_1.env.FRONTEND_URL}/accept-invitation?token=${invitationToken}`;
        // Prepare email content
        const emailHtml = emailTemplates_service_1.default.generateC4CInvitationEmail({
            organizationName: ((_d = invitedUser.invitedToOrganization) === null || _d === void 0 ? void 0 : _d.name) || 'your organisation',
            invitationURL,
        });
        // Send invitation email
        const emailSent = yield email_service_1.emailService.sendEmail({
            to: invitedUser.email,
            subject: `You've been invited to join ${(_e = invitedUser.invitedToOrganization) === null || _e === void 0 ? void 0 : _e.name} on Citizens for Change`,
            html: emailHtml,
        });
        if (!emailSent) {
            console.error('Failed to resend invitation email to:', invitedUser.email);
            const error = new Error('Failed to resend invitation email. Please try again later.');
            error.statusCode = 500;
            throw error;
        }
        yield session.commitTransaction();
        session.endSession();
        console.log(`📧 Invitation resent to: ${invitedUser.email}`);
        res.status(200).json({
            success: true,
            message: 'Invitation resent successfully',
            data: {
                email: invitedUser.email,
                role: invitedUser.invitedRole,
                expiresAt: invitedUser.invitationExpires
            }
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid user ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.resendInvitation = resendInvitation;
/**
 * Update user profile
 * @route PUT /api/v1/users/:id
 * @access Private
 */
const updateUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const { userName, name, photo } = req.body;
        // Users can only update their own profile unless they're ConnectGo staff
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a._id.toString()) !== id && !((_b = req.user) === null || _b === void 0 ? void 0 : _b.isConnectGoStaff)) {
            const error = new Error('You can only update your own profile');
            error.statusCode = 403;
            throw error;
        }
        // Check if username is already taken (if being updated)
        if (userName) {
            const existingUser = yield user_model_1.default.findOne({
                userName,
                _id: { $ne: id }
            });
            if (existingUser) {
                const error = new Error('Username is already taken');
                error.statusCode = 409;
                throw error;
            }
        }
        const updateData = {};
        if (userName)
            updateData.userName = userName;
        if (name)
            updateData.name = name;
        if (photo)
            updateData.photo = photo;
        const updatedUser = yield user_model_1.default.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select('-password');
        if (!updatedUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid user ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateUser = updateUser;
/**
 * Update a user's isOrgAdmin/permission-flags for a specific organization
 * @route PUT /api/v1/users/:userId/permissions
 * @access Private (ConnectGo staff or org admins of the target organization)
 */
const updateUserPermissions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { userId } = req.params;
        const { organizationId, isOrgAdmin, permissions } = req.body;
        if (!organizationId) {
            const error = new Error('organizationId is required');
            error.statusCode = 400;
            throw error;
        }
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a._id.toString()) === userId) {
            const error = new Error('You cannot modify your own permissions');
            error.statusCode = 403;
            throw error;
        }
        if (!req.user.isConnectGoStaff && !req.user.isOrgAdminOf(organizationId)) {
            const error = new Error('Not authorized to update permissions for this organization');
            error.statusCode = 403;
            throw error;
        }
        const targetUser = yield user_model_1.default.findById(userId);
        if (!targetUser) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        const roleIndex = targetUser.roles.findIndex((r) => r.organization && r.organization.toString() === organizationId);
        if (roleIndex === -1) {
            const error = new Error('User does not have a role in this organization');
            error.statusCode = 404;
            throw error;
        }
        if (typeof isOrgAdmin === 'boolean') {
            targetUser.roles[roleIndex].isOrgAdmin = isOrgAdmin;
        }
        if (permissions && typeof permissions === 'object') {
            targetUser.roles[roleIndex].permissions = Object.assign(Object.assign({}, targetUser.roles[roleIndex].permissions), permissions);
        }
        yield targetUser.save();
        res.status(200).json({
            success: true,
            message: 'Permissions updated successfully',
            data: {
                userId: targetUser._id,
                role: targetUser.roles[roleIndex]
            }
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid user ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateUserPermissions = updateUserPermissions;
/**
 * Archive user (soft delete)
 * @route DELETE /api/v1/users/:id
 * @access Private (Manager/Admin only)
 */
const archiveUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { id } = req.params;
        // Find the user to be archived
        const userToArchive = yield user_model_1.default.findById(id);
        if (!userToArchive) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        if (userToArchive.archived) {
            const error = new Error('User is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Users cannot archive themselves
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a._id.toString()) === id) {
            const error = new Error('You cannot archive your own account');
            error.statusCode = 403;
            throw error;
        }
        // Check permissions
        let hasPermission = false;
        if ((_b = req.user) === null || _b === void 0 ? void 0 : _b.isConnectGoStaff) {
            // ConnectGo staff can archive anyone
            hasPermission = true;
        }
        else {
            // Org-admins (default: manager, but any role can be granted isOrgAdmin) can
            // archive users who share an organization where the requester is an org-admin.
            const commonOrgs = userToArchive.roles.filter(role => { var _a; return role.organization && ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isOrgAdminOf(role.organization.toString())); });
            hasPermission = commonOrgs.length > 0;
        }
        if (!hasPermission) {
            const error = new Error('You do not have permission to archive this user');
            error.statusCode = 403;
            throw error;
        }
        // Archive the user
        const archivedUser = yield user_model_1.default.findByIdAndUpdate(id, {
            archived: true,
            archivedAt: new Date()
        }, { new: true }).select('-password');
        console.log(`🗄️ User archived: ${archivedUser === null || archivedUser === void 0 ? void 0 : archivedUser.email} by ${(_c = req.user) === null || _c === void 0 ? void 0 : _c.email}`);
        res.status(200).json({
            success: true,
            message: 'User archived successfully',
            data: archivedUser
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid user ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveUser = archiveUser;
//# sourceMappingURL=user.controller.js.map