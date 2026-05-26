// controllers/reports/reportController.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Report from "../../models/report.model";
import { CustomError } from "../../middlewares/error.middleware";

// Type guard for authenticated user
function isUserAuthenticated(req: Request): req is Request & { 
  user: { 
    _id: mongoose.Types.ObjectId; 
    primaryRole?: string;
    isConnectGoStaff?: boolean;
  } 
} {
  return req.user !== undefined;
}

/**
 * Get all reports for a project with filtering and pagination
 * @route GET /api/v1/reports/project/:projectId
 * @access Private
 */
export const getProjectReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { projectId } = req.params;
    const { 
      reportType, 
      status, 
      page = '1', 
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query: any = { 
      project: projectId,
      archived: { $ne: true }
    };

    if (reportType) {
      query.reportType = reportType;
    }

    if (status) {
      query.status = status;
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [reports, totalCount] = await Promise.all([
      Report.find(query)
        .populate('creator', 'name email')
        .populate('approvedBy', 'name email')
        .populate('project', 'name status')
        .populate('projectSite', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Report.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        reports,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNext: pageNum < Math.ceil(totalCount / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific report by ID
 * @route GET /api/v1/reports/:reportId
 * @access Private
 */
export const getReportById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;

    const report = await Report.findById(reportId)
      .populate('creator', 'name email')
      .populate('approvedBy', 'name email')
      .populate('project', 'name status')
      .populate('projectSite', 'name')
      .populate('organization', 'name');

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
 * Delete/Archive a report
 * @route DELETE /api/v1/reports/:reportId
 * @access Private (Creator or Admin)
 */
export const deleteReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;

    const report = await Report.findById(reportId);
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check permissions - only creator or admin can delete
    const isCreator = report.creator.toString() === req.user._id.toString();
    const isAdmin = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');

    if (!isCreator && !isAdmin) {
      const error = new Error('Not authorized to delete this report') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Archive instead of hard delete
    report.archived = true;
    report.archivedAt = new Date();
    await report.save();

    res.status(200).json({
      success: true,
      message: 'Report archived successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Approve a report
 * @route PUT /api/v1/reports/:reportId/approve
 * @access Private (Manager or Admin)
 */
export const approveReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const { notes } = req.body;

    // Check permissions
    const canApprove = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');
    if (!canApprove) {
      const error = new Error('Not authorized to approve reports') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const report = await Report.findById(reportId);
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    report.markAsApproved(req.user._id, notes);
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