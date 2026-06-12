// controllers/user.controller.ts - Updated with invitation system
import { Request, Response, NextFunction } from "express";
import User, { IUserDocument } from "../models/user.model";
import Organization from "../models/organization.model";
import Project from "../models/project.model";
import { CustomError } from "../middlewares/error.middleware";
import { emailService } from "../services/email.service";
import EmailTemplateService from "../services/emailTemplates.service";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from 'bcryptjs';
import { env } from '../config/env';


// Interface for populated project
interface PopulatedProject {
  _id: mongoose.Types.ObjectId;
  name: string;
}

// Interface for populated organization
interface PopulatedOrganization {
  _id: mongoose.Types.ObjectId;
  name: string;
}

// Interface for populated user
interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
}

/**
 * Get all users with pagination, filtering, and sorting
 * @route GET /api/v1/users
 * @access Private
 */
export const getUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Initialize query - add explicit type casting here
      let query = User.find({ archived: { $ne: true } }) as mongoose.Query<IUserDocument[], IUserDocument>;
  
      // Rest of your code remains the same
      const reqQuery = { ...req.query };
      const removeFields = ['select', 'sort', 'page', 'limit'];
      removeFields.forEach(param => delete reqQuery[param]);
  
      let queryStr = JSON.stringify(reqQuery);
      queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
      
      // Apply filtering with type assertion
      query = query.find(JSON.parse(queryStr)) as mongoose.Query<IUserDocument[], IUserDocument>;
  
      if (req.query.select) {
        const fields = (req.query.select as string).split(',').join(' ');
        query = query.select(`${fields} -password`) as mongoose.Query<IUserDocument[], IUserDocument>;
      } else {
        query = query.select('-password') as mongoose.Query<IUserDocument[], IUserDocument>;
      }
  
      if (req.query.sort) {
        const sortBy = (req.query.sort as string).split(',').join(' ');
        query = query.sort(sortBy) as mongoose.Query<IUserDocument[], IUserDocument>;
      } else {
        query = query.sort('-createdAt') as mongoose.Query<IUserDocument[], IUserDocument>;
      }
  
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const total = await User.countDocuments({ archived: { $ne: true } });
  
      query = query.skip(startIndex).limit(limit) as mongoose.Query<IUserDocument[], IUserDocument>;
  
      // Execute query
      const users = await query;
  
      // Pagination logic remains the same
      const pagination: {
        next?: { page: number; limit: number };
        prev?: { page: number; limit: number };
      } = {};
  
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
    } catch (error) {
      next(error);
    }
  };

/**
 * Get single user by ID
 * @route GET /api/v1/users/:id
 * @access Private
 */
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.params.id;

    // Add type assertion here
    const user = await User.findById(userId).select('-password') as IUserDocument | null;

    if (!user) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (user.archived) {
      const error = new Error('This user account has been archived') as CustomError;
      error.statusCode = 410;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid user ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Invite a user to join an organization
 * @route POST /api/v1/users/invite
 * @access Private (Manager, Admin)
 */
export const inviteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, role, organizationId, projectIds } = req.body;
    
    // Verify organization exists and user has access
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if current user has access to this organization
    if (!req.user!.isConnectGoStaff && !req.user!.hasOrganizationAccess(organizationId)) {
      const error = new Error('Not authorized to invite users to this organization') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Verify all project IDs exist and belong to this organization
    if (projectIds && projectIds.length > 0) {
      const projects = await Project.find({
        _id: { $in: projectIds },
        organization: organizationId
      });

      if (projects.length !== projectIds.length) {
        const error = new Error('One or more projects not found or do not belong to this organization') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      // ===== EXISTING USER FLOW =====
      return await addExistingUserToOrganization(
        existingUser,
        role,
        organizationId,
        projectIds,
        organization.name,
        req.user!,
        res
      );
    } else {
      // ===== NEW USER FLOW =====
      return await inviteNewUser(
        email,
        role,
        organizationId,
        projectIds,
        organization.name,
        req.user!,
        res
      );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Handle inviting a brand new user (doesn't exist in system)
 */
async function inviteNewUser(
  email: string,
  role: string,
  organizationId: string,
  projectIds: string[],
  organizationName: string,
  inviter: Express.User,
  res: Response
) {
  // Generate invitation token
  const invitationToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');
  const invitationExpires = new Date();
  invitationExpires.setHours(invitationExpires.getHours() + 72); // 72 hours to accept

  // Create temporary user
  const temporaryUser = await User.create({
    email: email.toLowerCase(),
    userName: email.split('@')[0], // Temporary username
    name: '', // Will be set when they accept invitation
    password: crypto.randomBytes(32).toString('hex'), // Temporary password
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
      projects: projectIds || []
    }]
  });

  // Send invitation email
  const invitationUrl = `${env.FRONTEND_URL}/accept-invitation?token=${invitationToken}`;

  const emailHtml = EmailTemplateService.generateC4CInvitationEmail({
    organizationName,
    invitationURL: invitationUrl,
  });

  const emailSent = await emailService.sendEmail({
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
}

/**
 * Handle adding an existing user to a new organization/projects
 */
async function addExistingUserToOrganization(
  user: any,
  role: string,
  organizationId: string,
  projectIds: string[],
  organizationName: string,
  inviter: Express.User,
  res: Response
) {
  // Check if user already has access to this organization
  const hasOrgAccess = user.hasOrganizationAccess(organizationId);

  if (hasOrgAccess) {
    // User already has a role in this organization
    // Find their existing role for this organization
    const roleIndex = user.roles.findIndex(
      (r: any) => r.organization && r.organization.toString() === organizationId
    );

    if (roleIndex !== -1) {
      const existingRole = user.roles[roleIndex];
      
      // Check if they already have the same role
      if (existingRole.role === role) {
        // Just add new projects if any
        if (projectIds && projectIds.length > 0) {
          const currentProjects = existingRole.projects || [];
          const currentProjectIds = currentProjects.map((p: any) => p.toString());
          
          // Add only new projects (avoid duplicates)
          const newProjectIds = projectIds.filter(
            pid => !currentProjectIds.includes(pid)
          );
          
          if (newProjectIds.length > 0) {
            user.roles[roleIndex].projects = [...currentProjects, ...newProjectIds];
            await user.save();

            // Send notification email
            await sendProjectAddedNotification(user.email, organizationName, newProjectIds.length, inviter.name);

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
          } else {
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
        } else {
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
      } else {
        // They have a different role - you might want to upgrade/change it
        // For safety, let's not automatically change roles
        const error = new Error(
          `User already has a different role (${existingRole.role}) in this organization. Please remove the existing role first or contact an administrator.`
        ) as CustomError;
        error.statusCode = 409; // Conflict
        throw error;
      }
    }
  }

  // User doesn't have access to this organization - add new role
  user.roles.push({
    role: role,
    organization: organizationId,
    projects: projectIds || []
  });

  await user.save();

  // Send notification email
  await sendOrganizationAddedNotification(
    user.email,
    organizationName,
    role,
    inviter.name,
    projectIds?.length || 0
  );

  res.status(200).json({
    success: true,
    message: 'User successfully added to organization',
    data: {
      userId: user._id,
      email: user.email,
      role: role,
      organization: organizationName,
      projectCount: projectIds?.length || 0,
      isNewUser: false,
      action: 'organization_added'
    }
  });
}

/**
 * Send email notification when existing user is added to new projects
 */
async function sendProjectAddedNotification(
  email: string,
  organizationName: string,
  projectCount: number,
  inviterName: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #272236;">New Projects Assigned</h2>
      <p>Hello,</p>
      <p>${inviterName} has added you to ${projectCount} new project(s) in <strong>${organizationName}</strong>.</p>
      <p>You can now access these projects on Citizens for Change.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${env.FRONTEND_URL}/dashboard" 
           style="display: inline-block; padding: 15px 40px; background-color: #624CF5; 
                  color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          View Projects
        </a>
      </div>
    </div>
  `;

  await emailService.sendEmail({
    to: email,
    subject: `New projects assigned in ${organizationName}`,
    html
  });
}

/**
 * Send email notification when existing user is added to new organization
 */
async function sendOrganizationAddedNotification(
  email: string,
  organizationName: string,
  role: string,
  inviterName: string,
  projectCount: number
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #272236;">You've Been Added to a New Organization</h2>
      <p>Hello,</p>
      <p>${inviterName} has granted you <strong>${role}</strong> access to
         <strong>${organizationName}</strong> on Citizens for Change.</p>
      ${projectCount > 0 ? `<p>You've been assigned to ${projectCount} project(s).</p>` : ''}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${env.FRONTEND_URL}/dashboard" 
           style="display: inline-block; padding: 15px 40px; background-color: #624CF5; 
                  color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Access Dashboard
        </a>
      </div>
    </div>
  `;

  await emailService.sendEmail({
    to: email,
    subject: `You've been added to ${organizationName}`,
    html
  });
}

/**
 * Verify invitation token
 * @route GET /api/v1/users/verify-invitation/:token
 * @access Public
 */
export const verifyInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.params;

    if (!token) {
      const error = new Error('Invitation token is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token that hasn't expired
    const user = await User.findOne({
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
  } catch (error) {
    next(error);
  }
};

/**
 * Accept invitation and set up account
 * @route POST /api/v1/users/accept-invitation
 * @access Public
 */
export const acceptInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await User.db.startSession();
  session.startTransaction();

  try {
    const { token, userName, name, password } = req.body;

    // Validate input
    if (!token || !userName || !name || !password) {
      const error = new Error('Token, username, name, and password are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate password strength
    if (password.length < 8) {
      const error = new Error('Password must be at least 8 characters long') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching token that hasn't expired
    const user = await User.findOne({
      invitationToken: hashedToken,
      invitationExpires: { $gt: Date.now() },
      isTemporaryUser: true
    }).session(session).exec();

    if (!user) {
      const error = new Error('Invalid or expired invitation token') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if username is already taken
    const existingUserName = await User.findOne({ 
      userName, 
      _id: { $ne: user._id } 
    }).session(session);
    
    if (existingUserName) {
      const error = new Error('Username is already taken') as CustomError;
      error.statusCode = 409;
      throw error;
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user account
    user.userName = userName;
    user.name = name;
    user.password = hashedPassword;
    user.invitationToken = undefined;
    user.invitationExpires = undefined;
    user.invitationAccepted = true;
    user.invitationAcceptedAt = new Date();
    user.isTemporaryUser = false;

    await user.save({ session });

    await session.commitTransaction();
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
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get organization users (Manager only)
 * @route GET /api/v1/users/organization/:organizationId
 * @access Private (Manager role required)
 */
export const getOrganizationUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { organizationId } = req.params;

    // Check if user has access to this organization
    if (!req.user?.hasOrganizationAccess(organizationId)) {
      const error = new Error('You do not have access to this organization') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Find users in the organization
    const users = await User.find({
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
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid organization ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Cancel/Revoke invitation (Manager only)
 * @route DELETE /api/v1/users/invitation/:userId
 * @access Private (Manager role required)
 */
export const revokeInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await User.db.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;

    // Find the invited user
    const invitedUser = await User.findById(userId);
    
    if (!invitedUser) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!invitedUser.isTemporaryUser) {
      const error = new Error('Cannot revoke invitation for activated users') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if current user has permission to revoke this invitation
    if (!req.user?.hasOrganizationAccess(invitedUser.invitedToOrganization?.toString() || '')) {
      const error = new Error('You do not have permission to revoke this invitation') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Delete the temporary user
    await User.findByIdAndDelete(userId, { session });

    await session.commitTransaction();
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
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid user ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Resend invitation email (Manager only)
 * @route POST /api/v1/users/resend-invitation/:userId
 * @access Private (Manager role required)
 */
export const resendInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await User.db.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;

    // Find the invited user
    const invitedUser = await User.findById(userId).session(session)
      .populate<{invitedToOrganization: PopulatedOrganization}>('invitedToOrganization', 'name')
      .populate<{invitedToProjects: PopulatedProject[]}>('invitedToProjects', 'name')
      .populate<{invitedBy: PopulatedUser}>('invitedBy', 'name email');
    
    if (!invitedUser) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!invitedUser.isTemporaryUser) {
      const error = new Error('Cannot resend invitation for activated users') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if current user has permission to resend this invitation
    if (!req.user?.hasOrganizationAccess(invitedUser.invitedToOrganization?._id?.toString() || '')) {
      const error = new Error('You do not have permission to resend this invitation') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Generate new invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');

    // Update invitation token and extend expiry
    invitedUser.invitationToken = hashedToken;
    invitedUser.invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await invitedUser.save({ session });

    // Create new invitation URL
    const invitationURL = `${env.FRONTEND_URL}/accept-invitation?token=${invitationToken}`;

    // Prepare email content
    const emailHtml = EmailTemplateService.generateC4CInvitationEmail({
      organizationName: invitedUser.invitedToOrganization?.name || 'your organisation',
      invitationURL,
    });

    // Send invitation email
    const emailSent = await emailService.sendEmail({
      to: invitedUser.email,
      subject: `You've been invited to join ${invitedUser.invitedToOrganization?.name} on Citizens for Change`,
      html: emailHtml,
    });

    if (!emailSent) {
      console.error('Failed to resend invitation email to:', invitedUser.email);
      const error = new Error('Failed to resend invitation email. Please try again later.') as CustomError;
      error.statusCode = 500;
      throw error;
    }

    await session.commitTransaction();
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
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid user ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/v1/users/:id
 * @access Private
 */
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userName, name, photo } = req.body;

    // Users can only update their own profile unless they're ConnectGo staff
    if ((req.user as any)?._id.toString() !== id && !req.user?.isConnectGoStaff) {
      const error = new Error('You can only update your own profile') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check if username is already taken (if being updated)
    if (userName) {
      const existingUser = await User.findOne({ 
        userName, 
        _id: { $ne: id } 
      });
      
      if (existingUser) {
        const error = new Error('Username is already taken') as CustomError;
        error.statusCode = 409;
        throw error;
      }
    }

    const updateData: any = {};
    if (userName) updateData.userName = userName;
    if (name) updateData.name = name;
    if (photo) updateData.photo = photo;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid user ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive user (soft delete)
 * @route DELETE /api/v1/users/:id
 * @access Private (Manager/Admin only)
 */
export const archiveUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Find the user to be archived
    const userToArchive = await User.findById(id);
    
    if (!userToArchive) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (userToArchive.archived) {
      const error = new Error('User is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Users cannot archive themselves
    if ((req.user as any)?._id.toString() === id) {
      const error = new Error('You cannot archive your own account') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check permissions
    let hasPermission = false;
    
    if (req.user?.isConnectGoStaff) {
      // ConnectGo staff can archive anyone
      hasPermission = true;
    } else if (req.user?.primaryRole === 'manager') {
      // Managers can archive users in their organization
      const commonOrgs = userToArchive.roles.filter(role => 
        role.organization && req.user?.hasOrganizationAccess(role.organization.toString())
      );
      hasPermission = commonOrgs.length > 0;
    }

    if (!hasPermission) {
      const error = new Error('You do not have permission to archive this user') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Archive the user
    const archivedUser = await User.findByIdAndUpdate(
      id,
      { 
        archived: true, 
        archivedAt: new Date() 
      },
      { new: true }
    ).select('-password');

    console.log(`🗄️ User archived: ${archivedUser?.email} by ${req.user?.email}`);

    res.status(200).json({
      success: true,
      message: 'User archived successfully',
      data: archivedUser
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid user ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};