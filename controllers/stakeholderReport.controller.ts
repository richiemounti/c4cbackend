// controllers/stakeholderReport.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import StakeholderReport from "../models/stakeholderReport.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import Category from "../models/category.model";
import { CustomError } from "../middlewares/error.middleware";

// Type guard to check if user is defined
function isUserAuthenticated(req: Request): req is Request & { user: { _id: mongoose.Types.ObjectId } } {
  return req.user !== undefined;
}

/**
 * Generate a new stakeholder report
 * @route POST /api/v1/reports/stakeholders
 * @access Private
 */
export const generateStakeholderReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      projectId, 
      projectSiteId, 
      title, 
      description, 
      filters 
    } = req.body;
    
    // Validate required fields
    if (!projectId || !title) {
      const error = new Error('Project ID and title are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // If project site is specified, check if it exists
    if (projectSiteId) {
      const projectSite = await ProjectSite.findById(projectSiteId);
      if (!projectSite) {
        const error = new Error('Project site not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      
      // Check if site belongs to the project
      if (projectSite.project.toString() !== projectId) {
        const error = new Error('Project site does not belong to this project') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Build query for stakeholder groups
    const query: any = { 
      project: projectId,
      completionStatus: 'completed', // Only include completed stakeholder groups
      archived: { $ne: true }
    };
    
    if (projectSiteId) {
      query.projectSite = projectSiteId;
    }
    
    // Apply additional filters if provided
    if (filters) {
      if (filters.categories && filters.categories.length > 0) {
        const categoryDocs = await Category.find({ name: { $in: filters.categories } });
        query.category = { $in: categoryDocs.map(c => c._id) };
      }
      
      if (filters.connectionStrength) {
        query['tasks.taskType'] = 'connections';
        if (filters.connectionStrength.min !== undefined) {
          query['tasks.rating'] = { $gte: filters.connectionStrength.min };
        }
        if (filters.connectionStrength.max !== undefined) {
          if (query['tasks.rating']) {
            query['tasks.rating'].$lte = filters.connectionStrength.max;
          } else {
            query['tasks.rating'] = { $lte: filters.connectionStrength.max };
          }
        }
      }
      
      if (filters.risks && filters.risks.length > 0) {
        query['tasks'] = {
          $elemMatch: {
            taskType: 'risks',
            'responses.optionId': { $in: filters.risks }
          }
        };
      }
      
      if (filters.includeArchived) {
        delete query.archived;
      }
    }
    
    // Get stakeholder groups
    const stakeholderGroups = await StakeholderGroup.find(query)
      .populate('category', 'name')
      .populate('project', 'name')
      .populate('projectSite', 'name')
      .sort('name');
    
    // Prepare stakeholder data for storage
    const stakeholderData = stakeholderGroups.map(group => {
      return {
        stakeholderGroup: group._id,
        name: group.name,
        category: typeof group.category === 'object' && group.category !== null && 'name' in group.category 
        ? (group.category as { name: string }).name 
        : group.category,
        tasks: group.tasks.map(task => ({
          taskType: task.taskType,
          responses: task.responses.map(response => ({
            option: response.optionId,
            description: response.description
          })),
          rating: task.rating
        }))
      };
    });
    
    // Create the report
    const report = new StakeholderReport({
      project: projectId,
      projectSite: projectSiteId,
      title,
      description,
      stakeholderData,
      filters: filters || {},
      creator: req.user._id,
      status: 'draft'
    });
    
    await report.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      success: true,
      message: 'Stakeholder report generated successfully',
      data: report
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all stakeholder reports
 * @route GET /api/v1/reports/stakeholders
 * @access Private
 */
export const getStakeholderReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Build query
    const query: any = { archived: { $ne: true } };
    
    // Filter by project if provided
    if (req.query.projectId) {
      query.project = req.query.projectId;
    }
    
    // Filter by project site if provided
    if (req.query.projectSiteId) {
      query.projectSite = req.query.projectSiteId;
    }
    
    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Get reports
    const reports = await StakeholderReport.find(query)
      .populate('project', 'name')
      .populate('projectSite', 'name')
      .populate('creator', 'name')
      .populate('approvedBy', 'name')
      .sort('-createdAt');
    
    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single stakeholder report
 * @route GET /api/v1/reports/stakeholders/:id
 * @access Private
 */
export const getStakeholderReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    const report = await StakeholderReport.findById(id)
      .populate('project', 'name')
      .populate('projectSite', 'name')
      .populate('creator', 'name')
      .populate('approvedBy', 'name');
    
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve a stakeholder report
 * @route PUT /api/v1/reports/stakeholders/:id/approve
 * @access Private
 */
export const approveStakeholderReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const report = await StakeholderReport.findById(id);
    
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if report is already approved
    if (report.status === 'approved') {
      const error = new Error('Report is already approved') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Update report status
    report.status = 'approved';
    report.approvedBy = req.user._id;
    
    await report.save();
    
    res.status(200).json({
      success: true,
      message: 'Report approved successfully',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive a stakeholder report
 * @route PUT /api/v1/reports/stakeholders/:id/archive
 * @access Private
 */
export const archiveStakeholderReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    const report = await StakeholderReport.findById(id);
    
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if report is already archived
    if (report.archived) {
      const error = new Error('Report is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Archive report
    report.archived = true;
    report.archivedAt = new Date();
    report.status = 'archived';
    
    await report.save();
    
    res.status(200).json({
      success: true,
      message: 'Report archived successfully',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a stakeholder report
 * @route DELETE /api/v1/reports/stakeholders/:id
 * @access Private
 */
export const deleteStakeholderReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    const report = await StakeholderReport.findById(id);
    
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Delete report
    await StakeholderReport.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
      data: null
    });
  } catch (error) {
    next(error);
  }
};