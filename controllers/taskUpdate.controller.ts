
// controllers/taskUpdate.controller.ts
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../middlewares/error.middleware";
import TaskUpdateService from "../services/taskUpdate.service";

// Type guard for authenticated user
function isUserAuthenticated(req: Request): req is Request & { user: Express.User } {
  return req.user !== undefined;
}

/**
 * Apply project task modifications
 * @route POST /api/v1/admin/tasks/update-project-tasks
 * @access Private (Admin only)
 */
export const updateProjectTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is admin
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check if user has admin rights (adjust this based on your auth system)
    if (!req.user.isConnectGoStaff) {
      const error = new Error('Admin access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { dryRun = true } = req.body;

    console.log(`Starting project task modifications (dryRun: ${dryRun})`);
    
    const results = await TaskUpdateService.applyProjectTaskModifications(dryRun);

    const summary = {
      totalModifications: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalProjectsAffected: results.reduce((sum, r) => 
        sum + (r.setupResult?.affectedProjects || r.setupResult?.projectsUpdated || 0), 0
      )
    };

    res.status(200).json({
      success: true,
      message: dryRun ? 'Project task modifications simulated successfully' : 'Project task modifications applied successfully',
      data: {
        dryRun,
        summary,
        details: results
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Apply project site task modifications
 * @route POST /api/v1/admin/tasks/update-project-site-tasks
 * @access Private (Admin only)
 */
export const updateProjectSiteTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is admin
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check if user has admin rights (adjust this based on your auth system)
    if (!req.user.isConnectGoStaff) {
      const error = new Error('Admin access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { dryRun = true } = req.body;

    console.log(`Starting project site task modifications (dryRun: ${dryRun})`);
    
    const results = await TaskUpdateService.applyProjectSiteTaskModifications(dryRun);

    const summary = {
      totalModifications: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalSitesAffected: results.reduce((sum, r) => 
        sum + (r.setupResult?.affectedSites || r.setupResult?.sitesUpdated || 0), 0
      )
    };

    res.status(200).json({
      success: true,
      message: dryRun ? 'Project site task modifications simulated successfully' : 'Project site task modifications applied successfully',
      data: {
        dryRun,
        summary,
        details: results
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Update specific task globally
 * @route POST /api/v1/admin/tasks/update-task
 * @access Private (Admin only)
 */
export const updateSpecificTask = async (
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

    if (!req.user.isConnectGoStaff) {
      const error = new Error('Admin access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { 
      fieldName, 
      updates, 
      dryRun = true, 
      onlyIncompleted = false,
      setupType = 'both'
    } = req.body;

    if (!fieldName) {
      const error = new Error('fieldName is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (!updates || Object.keys(updates).length === 0) {
      const error = new Error('updates object is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const result = await TaskUpdateService.updateTaskGlobally(
      fieldName,
      updates,
      { dryRun, onlyIncompleted, setupType }
    );

    res.status(200).json({
      success: true,
      message: dryRun ? 'Task update simulated successfully' : 'Task updated successfully',
      data: {
        fieldName,
        updates,
        dryRun,
        result
      }
    });

  } catch (error) {
    next(error);
  }
};