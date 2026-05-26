// controllers/organization.controller.ts
import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import Organization from "../models/organization.model";
import User from "../models/user.model";
import { CustomError } from "../middlewares/error.middleware";
import { createOrganizationForManager, getUserOrganizations } from "../services/organization.service";
import { IUserDocument } from "../models/user.model";


type AuthUser = IUserDocument & {
  _id: mongoose.Types.ObjectId;
  primaryRole?: string;
  isConnectGoStaff?: boolean;
  roles?: any[];
};


// Type guard to check if user is defined
// Then modify the isUserAuthenticated function to include type assertion
function isUserAuthenticated(req: Request): req is Request & { user: AuthUser } {
  return req.user !== undefined;
}

/**
 * Create a new organization
 * @route POST /api/v1/organizations
 * @access Private
 */
export const createOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await Organization.db.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
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
        const organization = await createOrganizationForManager(
          creator.toString(), // Convert ObjectId to string
          { name, country, city },
          session
        );
        
        await session.commitTransaction();
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
    const newOrganizations = await Organization.create([{
      name,
      country,
      city,
      creator
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: newOrganizations[0]
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all organizations with pagination, filtering, and sorting
 * @route GET /api/v1/organizations
 * @access Private
 */
export const getOrganizations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check if we should filter by user access
    const userAccessOnly = req.query.userAccessOnly === 'true';
    
    // Initialize query
    let query;
    
    if (userAccessOnly) {
      // Get only organizations accessible by the current user
      const organizations = await getUserOrganizations(req.user._id.toString());
      
      return res.status(200).json({
        success: true,
        count: organizations.length,
        data: organizations
      });
    } else {
      // Standard organization query with filters
      query = Organization.find({ archived: { $ne: true } });
    }

    // Copy req.query to avoid modifying the original
    const reqQuery = { ...req.query };

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
      const fields = (req.query.select as string).split(',').join(' ');
      query = query.select(fields);
    }

    // Sort results
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
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
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Organization.countDocuments({ archived: { $ne: true } });

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const organizations = await query;

    // Pagination result
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
      count: organizations.length,
      pagination,
      total,
      data: organizations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get organizations for the current user
 * @route GET /api/v1/organizations/my-organizations
 * @access Private
 */
export const getMyOrganizations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const userId = req.user._id.toString();
    const organizations = await getUserOrganizations(userId);
    
    res.status(200).json({
      success: true,
      count: organizations.length,
      data: organizations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single organization by ID
 * @route GET /api/v1/organizations/:id
 * @access Private
 */
export const getOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const organizationId = req.params.id;

    const query = Organization.findById(organizationId);
    
    // Populate creator field if requested
    if (req.query.populate === 'creator') {
      query.populate({
        path: 'creator',
        select: 'name email userName'
      });
    }

    const organization = await query;

    if (!organization) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if organization is archived
    if (organization.archived) {
      const error = new Error('This organization has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    // If user is not ConnectGo staff, check if they have access to this organization
    if (!req.user.isConnectGoStaff) {
      // Use type assertion to access the custom method
      const user = req.user as any;
      const hasAccess = user.hasOrganizationAccess(organization._id);
      if (!hasAccess) {
        const error = new Error('Not authorized to access this organization') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    res.status(200).json({
      success: true,
      data: organization
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid organization ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update organization by ID
 * @route PUT /api/v1/organizations/:id
 * @access Private
 */
export const updateOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const organizationId = req.params.id;
    const { name, country, city } = req.body;

    // Find the organization first to check if it exists and is not archived
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (organization.archived) {
      const error = new Error('Cannot update an archived organization') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user is creator or has permission to update
    // ConnectGo staff can update any organization
    if (!req.user.isConnectGoStaff) {
      // Organization managers can update their organization
      const roles = req.user.roles || [];
      const isManager = roles.some((r: any) => 
        r.role === 'manager' && r.organization && r.organization.toString() === organizationId
      );
      
      const isCreator = organization.creator.toString() === req.user._id.toString();
      
      if (!isManager && !isCreator) {
        const error = new Error('Not authorized to update this organization') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Update the organization
    const updatedOrganization = await Organization.findByIdAndUpdate(
      organizationId,
      { name, country, city },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      data: updatedOrganization
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid organization ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive organization by ID (soft delete)
 * @route DELETE /api/v1/organizations/:id
 * @access Private
 */
export const archiveOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const organizationId = req.params.id;

    // Find the organization first to check if it exists
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (organization.archived) {
      const error = new Error('Organization is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user is creator or has permission to archive
    // ConnectGo staff can archive any organization
    if (!req.user.isConnectGoStaff) {
      // Organization managers can archive their organization
      const roles = req.user.roles || [];
      const isManager = roles.some((r: any) => 
        r.role === 'manager' && r.organization && r.organization.toString() === organizationId
      );
      
      const isCreator = organization.creator.toString() === req.user._id.toString();
      
      if (!isManager && !isCreator) {
        const error = new Error('Not authorized to archive this organization') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Archive the organization (soft delete)
    const archivedOrganization = await Organization.findByIdAndUpdate(
      organizationId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Organization archived successfully',
      data: archivedOrganization
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid organization ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived organization by ID
 * @route POST /api/v1/organizations/:id/restore
 * @access Private
 */
export const restoreOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const organizationId = req.params.id;

    // Find the organization first to check if it exists and is archived
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!organization.archived) {
      const error = new Error('Organization is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user has permission to restore
    // Only ConnectGo staff and the original creator can restore
    if (!req.user.isConnectGoStaff && organization.creator.toString() !== req.user._id.toString()) {
      const error = new Error('Not authorized to restore this organization') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Restore the organization
    const restoredOrganization = await Organization.findByIdAndUpdate(
      organizationId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Organization restored successfully',
      data: restoredOrganization
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid organization ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Permanently delete organization by ID
 * @route DELETE /api/v1/organizations/:id/permanent
 * @access Private (Admin only)
 */
export const deleteOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const organizationId = req.params.id;

    // Find the organization first to check if it exists
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Only ConnectGo staff with 'owner' role can permanently delete organizations
    if (!req.user.isConnectGoStaff || req.user.primaryRole !== 'owner') {
      const error = new Error('Not authorized to permanently delete organizations. Only system owners can perform this action.') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Permanently delete the organization
    await Organization.findByIdAndDelete(organizationId);

    res.status(200).json({
      success: true,
      message: 'Organization permanently deleted',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid organization ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};