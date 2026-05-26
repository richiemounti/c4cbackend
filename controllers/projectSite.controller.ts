// Project Site Controller
import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import ProjectSite from "../models/projectSite.model";
import Project from "../models/project.model";
import { CustomError } from "../middlewares/error.middleware";

// Type guard to check if user is defined
function isUserAuthenticated(req: Request): boolean {
  return req.user !== undefined;
}

/**
 * Create a new project site
 * @route POST /api/v1/projects/:projectId/sites
 * @access Private (Manager, Project Creator)
 */
export const createProjectSite = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await ProjectSite.db.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { projectId } = req.params;
    const { 
      name, description, address, region, city, country, 
      coordinates, size, sizeUnit, siteType, status, 
      contacts, notes, startDate 
    } = req.body;

    // Check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Verify the user has permission to create sites for this project
    // This should be handled by the middleware that checks for project access

    // Create the new site
    const newSite = await ProjectSite.create([{
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
      creator: req.user!._id
    }], { session });
    
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Project site created successfully',
      data: newSite
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle duplicate site name error
    if (error instanceof Error && error.name === 'MongoError' && (error as any).code === 11000) {
      const customError = new Error('A site with this name already exists for this project') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    
    next(error);
  }
};

/**
 * Get all sites for a project
 * @route GET /api/v1/projects/:projectId/sites
 * @access Private (Based on project access)
 */
export const getProjectSites = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has access to this project (should be handled by middleware)

    // Initialize query
    let query = ProjectSite.find({ 
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
      const fields = (req.query.select as string).split(',').join(' ');
      query = query.select(fields);
    }

    // Sort results
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('name'); // Default sort by name
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Count total documents
    const total = await ProjectSite.countDocuments({ 
      project: projectId,
      archived: { $ne: true } 
    });

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const sites = await query;

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
      count: sites.length,
      pagination,
      total,
      data: sites
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single project site by ID
 * @route GET /api/v1/project-sites/:id
 * @access Private (Based on project access)
 */
export const getProjectSite = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const siteId = req.params.id;

    const site = await ProjectSite.findById(siteId);

    if (!site) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if site is archived
    if (site.archived) {
      const error = new Error('This project site has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    // Check if user has access to the project this site belongs to
    // This should be handled by middleware

    res.status(200).json({
      success: true,
      data: site
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project site ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update project site by ID
 * @route PUT /api/v1/project-sites/:id
 * @access Private (Based on project access)
 */
export const updateProjectSite = async (
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

    const siteId = req.params.id;
    const updates = req.body;

    // Find the site first to check if it exists and is not archived
    const site = await ProjectSite.findById(siteId);

    if (!site) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (site.archived) {
      const error = new Error('Cannot update an archived project site') as CustomError;
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
    const updatedSite = await ProjectSite.findByIdAndUpdate(
      siteId,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Project site updated successfully',
      data: updatedSite
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project site ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    // Handle duplicate site name error
    if (error instanceof Error && error.name === 'MongoError' && (error as any).code === 11000) {
      const customError = new Error('A site with this name already exists for this project') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive project site by ID (soft delete)
 * @route DELETE /api/v1/project-sites/:id
 * @access Private (Based on project access)
 */
export const archiveProjectSite = async (
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

    const siteId = req.params.id;

    // Find the site first to check if it exists
    const site = await ProjectSite.findById(siteId);

    if (!site) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (site.archived) {
      const error = new Error('Project site is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user has permission to archive this site
    // This should be handled by middleware

    // Archive the site (soft delete)
    const archivedSite = await ProjectSite.findByIdAndUpdate(
      siteId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Project site archived successfully',
      data: archivedSite
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project site ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived project site
 * @route POST /api/v1/project-sites/:id/restore
 * @access Private (Based on project access)
 */
export const restoreProjectSite = async (
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

    const siteId = req.params.id;

    // Find the site first to check if it exists and is archived
    const site = await ProjectSite.findById(siteId);

    if (!site) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!site.archived) {
      const error = new Error('Project site is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if the parent project is archived
    const project = await Project.findById(site.project);
    if (project?.archived) {
      const error = new Error('Cannot restore a site belonging to an archived project') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user has permission to restore this site
    // This should be handled by middleware

    // Restore the site
    const restoredSite = await ProjectSite.findByIdAndUpdate(
      siteId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Project site restored successfully',
      data: restoredSite
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project site ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Permanently delete project site
 * @route DELETE /api/v1/project-sites/:id/permanent
 * @access Private (ConnectGo staff only)
 */
export const deleteProjectSite = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    if (!req.user!.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can permanently delete project sites') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const siteId = req.params.id;

    // Find the site first to check if it exists
    const site = await ProjectSite.findById(siteId);

    if (!site) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Permanently delete the site
    await ProjectSite.findByIdAndDelete(siteId);

    res.status(200).json({
      success: true,
      message: 'Project site permanently deleted',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project site ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};