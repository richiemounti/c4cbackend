import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import Project from "../models/project.model";
import Organization from "../models/organization.model";
import User from "../models/user.model";
import { uploadFile } from '../services/storage.service';
import { CustomError } from "../middlewares/error.middleware";

// Type guard to check if user is defined
function isUserAuthenticated(req: Request): boolean {
  return req.user !== undefined;
}

/**
 * Create a new project
 * @route POST /api/v1/projects
 * @access Private (Manager, Project Creator)
 */
export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await Project.db.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { name, description, logo, location, coordinates, startDate, endDate, status, organization } = req.body;
    
    // Add creator from authenticated user - we've verified req.user exists above
    const creator = req.user!._id;
    
    // Check if the organization exists and user has permission
    const org = await Organization.findById(organization);
    if (!org) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Verify the user has permission to create projects in this organization
    // This should be handled by the role middleware that checks for 'create_projects' permission

    // Create the new project
    const newProjects = await Project.create([{
      name,
      description,
      logo,
      location,
      coordinates,
      startDate,
      endDate,
      status,
      creator,
      organization
    }], { session });

    // Get the project ID
    const projectId = newProjects[0]._id;

    // If the user is a project creator, add this project to their projects list in the role
    // We've verified req.user exists above
    if (req.user!.primaryRole === 'projectCreator' && req.user!.roles) {
      // Find the role for this organization
      const roleIndex = req.user!.roles.findIndex((r: any) => 
        r.role === 'projectCreator' && r.organization.toString() === organization
      );

      if (roleIndex !== -1) {
        // Add project to this role's projects array
        if (!req.user!.roles[roleIndex].projects) {
          req.user!.roles[roleIndex].projects = [];
        }
        req.user!.roles[roleIndex].projects.push(projectId);
        
        // Save the user - using findByIdAndUpdate instead of save()
        await User.findByIdAndUpdate(req.user!._id, {
          roles: req.user!.roles
        });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: newProjects[0]
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all projects with pagination, filtering, and sorting
 * @route GET /api/v1/projects
 * @access Private (Based on role and organization access)
 */
export const getProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = Project.find({ archived: { $ne: true } });

    // Filter by organization if provided
    if (req.query.organization) {
      query = query.find({ organization: req.query.organization });
    } else {
      // If user is not ConnectGo staff, limit to their accessible organizations
      if (isUserAuthenticated(req) && !req.user!.isConnectGoStaff) {
        const accessibleOrganizations = req.user!.roles && req.user!.roles
          .filter((r: any) => r.organization)
          .map((r: any) => r.organization);
        
        // If user has no organizations, return empty result
        if (!accessibleOrganizations || accessibleOrganizations.length === 0) {
          return res.status(200).json({
            success: true,
            count: 0,
            pagination: {},
            total: 0,
            data: []
          });
        }
        
        query = query.find({ organization: { $in: accessibleOrganizations } });
      }
    }

    // For fieldAgent, organiser, and reviewer roles, limit to assigned projects
    if (isUserAuthenticated(req) && 
        ['fieldAgent', 'organiser', 'reviewer'].includes(req.user!.primaryRole || '') && 
        !req.user!.isConnectGoStaff && 
        req.user!.roles) {
      
      const accessibleProjects = req.user!.roles
        .filter((r: any) => r.projects && r.projects.length > 0)
        .flatMap((r: any) => r.projects);
      
      // If user has specific projects, limit to those
      if (accessibleProjects.length > 0) {
        query = query.find({ _id: { $in: accessibleProjects } });
      }
    }

    // Copy req.query to avoid modifying the original
    const reqQuery = { ...req.query };

    // Fields to exclude from filtering
    const removeFields = ['select', 'sort', 'page', 'limit', 'populate', 'organization'];
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
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query = query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }
      
      if (populateFields.includes('organization')) {
        query = query.populate({
          path: 'organization',
          select: 'name country city'
        });
      }
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Count total documents that match the query before pagination
    let countQuery = Project.find(JSON.parse(queryStr)).where('archived').ne(true);
    
    // Apply the same organization filters to count query
    if (req.query.organization) {
      countQuery = countQuery.where('organization').equals(req.query.organization);
    } else if (isUserAuthenticated(req) && !req.user!.isConnectGoStaff && req.user!.roles) {
      const accessibleOrganizations = req.user!.roles
        .filter((r: any) => r.organization)
        .map((r: any) => r.organization);
      
      if (accessibleOrganizations.length > 0) {
        countQuery = countQuery.where('organization').in(accessibleOrganizations);
      }
    }
    
    // Apply project-specific filters for certain roles
    if (isUserAuthenticated(req) && 
        ['fieldAgent', 'organiser', 'reviewer'].includes(req.user!.primaryRole || '') && 
        !req.user!.isConnectGoStaff && 
        req.user!.roles) {
      
      const accessibleProjects = req.user!.roles
        .filter((r: any) => r.projects && r.projects.length > 0)
        .flatMap((r: any) => r.projects);
      
      if (accessibleProjects.length > 0) {
        countQuery = countQuery.where('_id').in(accessibleProjects);
      }
    }
    
    const total = await countQuery.countDocuments();

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const projects = await query;

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
      count: projects.length,
      pagination,
      total,
      data: projects
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get projects by organization ID
 * @route GET /api/v1/organizations/:organizationId/projects
 * @access Private (Based on role and organization access)
 */
export const getOrganizationProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = req.params.organizationId;

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has access to this organization (should be handled by middleware)

    // Reuse the existing getProjects function by modifying the request query
    req.query.organization = organizationId;
    return getProjects(req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single project by ID
 * @route GET /api/v1/projects/:id
 * @access Private (Based on role and project access)
 */
export const getProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const projectId = req.params.id;

    const query = Project.findById(projectId);
    
    // Populate related fields if requested
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }
      
      if (populateFields.includes('organization')) {
        query.populate({
          path: 'organization',
          select: 'name country city'
        });
      }
    }

    const project = await query;

    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if project is archived
    if (project.archived) {
      const error = new Error('This project has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    // Check if user has access to this project (should be handled by middleware)

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update project by ID
 * @route PUT /api/v1/projects/:id
 * @access Private (Manager, Project Creator who created the project)
 */
export const updateProject = async (
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

    const projectId = req.params.id;
    const updates = req.body;

    // Find the project first to check if it exists and is not archived
    const project = await Project.findById(projectId);

    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (project.archived) {
      const error = new Error('Cannot update an archived project') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check permissions (should be handled by middleware)
    // However, additional checks can be made here for project creator

    // Don't allow changing the creator or organization
    if (updates.creator || updates.organization) {
      const error = new Error('Changing project creator or organization is not allowed') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate contacts if provided
    if (updates.contacts && Array.isArray(updates.contacts)) {
      // Ensure each contact has a name
      const invalidContacts = updates.contacts.filter((contact: any) => !contact.name);
      if (invalidContacts.length > 0) {
        const error = new Error('Each contact must have a name') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Update the project
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive project by ID (soft delete)
 * @route DELETE /api/v1/projects/:id
 * @access Private (Manager, Project Creator who created the project)
 */
export const archiveProject = async (
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

    const projectId = req.params.id;

    // Find the project first to check if it exists
    const project = await Project.findById(projectId);

    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (project.archived) {
      const error = new Error('Project is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check permissions (should be handled by middleware)

    // Archive the project (soft delete)
    const archivedProject = await Project.findByIdAndUpdate(
      projectId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Project archived successfully',
      data: archivedProject
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived project by ID
 * @route POST /api/v1/projects/:id/restore
 * @access Private (Manager, ConnectGo staff)
 */
export const restoreProject = async (
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

    const projectId = req.params.id;

    // Find the project first to check if it exists and is archived
    const project = await Project.findById(projectId);

    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!project.archived) {
      const error = new Error('Project is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check permissions (should be handled by middleware)

    // Restore the project
    const restoredProject = await Project.findByIdAndUpdate(
      projectId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Project restored successfully',
      data: restoredProject
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Permanently delete project by ID
 * @route DELETE /api/v1/projects/:id/permanent
 * @access Private (ConnectGo staff only)
 */
export const deleteProject = async (
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

    const projectId = req.params.id;

    // Find the project first to check if it exists
    const project = await Project.findById(projectId);

    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check permissions (should be handled by middleware that checks isConnectGoStaff)

    // Permanently delete the project
    await Project.findByIdAndDelete(projectId);

    res.status(200).json({
      success: true,
      message: 'Project permanently deleted',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


