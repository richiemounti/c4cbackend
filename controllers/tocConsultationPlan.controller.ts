// controllers/tocConsultationPlan.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import TOCConsultationPlan from "../models/tocConsultationPlan.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import { CustomError } from "../middlewares/error.middleware";


// Type guard to check if user is authenticated
function isUserAuthenticated(req: Request): req is Request & { user: { _id: mongoose.Types.ObjectId } } {
  return req.user !== undefined;
}

/**
 * Create or update a consultation plan for a project site
 * @route POST /api/v1/toc-consultation-plans
 * @access Private
 */
export const createOrUpdateConsultationPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { 
      projectId, 
      projectSiteId, 
      stakeholderGroups, 
      consultationQuestions, 
      plannedConsultationDates 
    } = req.body;

    // Validate required fields
    if (!projectId || !projectSiteId) {
      const error = new Error('Project ID and Project Site ID are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if project site exists and belongs to project
    const projectSite = await ProjectSite.findById(projectSiteId);
    if (!projectSite) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (projectSite.project.toString() !== projectId) {
      const error = new Error('Project site does not belong to this project') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate stakeholder groups if provided
    if (stakeholderGroups && Array.isArray(stakeholderGroups)) {
      for (const sg of stakeholderGroups) {
        if (sg.stakeholderGroup) {
          const stakeholderExists = await StakeholderGroup.findById(sg.stakeholderGroup);
          if (!stakeholderExists) {
            const error = new Error(`Stakeholder group ${sg.stakeholderGroup} not found`) as CustomError;
            error.statusCode = 404;
            throw error;
          }
        }
      }
    }

    // Check if consultation plan already exists
    let consultationPlan = await TOCConsultationPlan.findOne({
      project: projectId,
      projectSite: projectSiteId
    });

    if (consultationPlan) {
      // Update existing plan
      if (stakeholderGroups) consultationPlan.stakeholderGroups = stakeholderGroups;
      if (consultationQuestions) consultationPlan.consultationQuestions = consultationQuestions;
      if (plannedConsultationDates) consultationPlan.plannedConsultationDates = plannedConsultationDates;
      consultationPlan.lastUpdatedBy = req.user._id;
      
      await consultationPlan.save({ session });
    } else {
        // Create new plan
        const newConsultationPlanArray = await TOCConsultationPlan.create([{
            project: projectId,
            projectSite: projectSiteId,
            stakeholderGroups: stakeholderGroups || [],
            consultationQuestions: consultationQuestions || {},
            plannedConsultationDates: plannedConsultationDates || {},
            creator: req.user._id,
            lastUpdatedBy: req.user._id
        }], { session });
        consultationPlan = newConsultationPlanArray[0];
    }

    await session.commitTransaction();
    session.endSession();

    // Populate the response with reference data
    const populatedPlan = await TOCConsultationPlan.findById(consultationPlan!._id)
      .populate('project', 'name')
      .populate('projectSite', 'name location')
      .populate('stakeholderGroups.stakeholderGroup', 'name description')
      .populate('creator', 'name email')
      .populate('lastUpdatedBy', 'name email');

    const isNewPlan = !consultationPlan;
    res.status(isNewPlan ? 201 : 200).json({
        success: true,
        message: isNewPlan ? 'Consultation plan created successfully' : 'Consultation plan updated successfully',
        data: populatedPlan
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get consultation plan for a specific project site
 * @route GET /api/v1/toc-consultation-plans/site/:siteId
 * @access Private
 */
export const getConsultationPlanBySite = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { siteId } = req.params;

    // Check if project site exists
    const projectSite = await ProjectSite.findById(siteId);
    if (!projectSite) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Find consultation plan
    const consultationPlan = await TOCConsultationPlan.findOne({ projectSite: siteId })
        .populate('project', 'name')
        .populate('projectSite', 'name location')
        .populate('stakeholderGroups.stakeholderGroup', 'name description')
        .populate('creator', 'name email')
        .populate('lastUpdatedBy', 'name email');

    if (!consultationPlan) {
      return res.status(200).json({
        success: true,
        message: 'No consultation plan found for this site',
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: consultationPlan
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid site ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get available stakeholder groups for a project site (using proper stakeholder mapping logic)
 * @route GET /api/v1/toc-consultation-plans/site/:siteId/stakeholder-groups
 * @access Private
 */
export const getStakeholderGroupsForSite = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { siteId } = req.params;

    // Check if project site exists
    const projectSite = await ProjectSite.findById(siteId);
    if (!projectSite) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Use the same query pattern as stakeholderMapping.controller.ts
    const query = { 
      project: projectSite.project,
      projectSite: siteId
    };
    
    // Fetch stakeholder groups with the same logic as stakeholderMapping
    const stakeholderGroups = await StakeholderGroup.find(query)
      .populate('category', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name')
      .sort({ category: 1, name: 1 });

    // Get existing consultation plan to show current selections
    const existingPlan = await TOCConsultationPlan.findOne({ 
      projectSite: siteId 
    }).select('stakeholderGroups');

    // Format response with selection status (same as before but with category data)
    const stakeholderGroupsWithStatus = stakeholderGroups.map(group => {
      const existing = existingPlan?.stakeholderGroups.find(
        sg => sg.stakeholderGroup.toString() === group._id.toString()
      );
      
      return {
        _id: group._id,
        name: group.name,
        description: group.description,
        category: group.category,
        isSelected: existing?.isSelected || false,
        notes: existing?.notes || ''
      };
    });

    // Group by category for easier frontend processing (same as stakeholderMapping)
    const groupsByCategory: Record<string, any[]> = {};
    stakeholderGroupsWithStatus.forEach(group => {
      const categoryName = (group.category as any)?.name || 'Uncategorized';
      if (!groupsByCategory[categoryName]) {
        groupsByCategory[categoryName] = [];
      }
      groupsByCategory[categoryName].push(group);
    });

    res.status(200).json({
      success: true,
      count: stakeholderGroupsWithStatus.length,
      data: {
        stakeholderGroups: stakeholderGroupsWithStatus,
        groupsByCategory
      }
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid site ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


/**
 * Mark consultation plan as completed
 * @route PUT /api/v1/toc-consultation-plans/:planId/complete
 * @access Private
 */
export const completeConsultationPlan = async (
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

    const { planId } = req.params;

    // Find the consultation plan and ensure it's a lean document
    const consultationPlan = await TOCConsultationPlan.findById(planId).lean();
    
    if (!consultationPlan) {
      const error = new Error('Consultation plan not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // FIXED: More robust validation checks
    const hasSelectedStakeholders = Array.isArray(consultationPlan.stakeholderGroups) && 
                                    consultationPlan.stakeholderGroups.length > 0 &&
                                    consultationPlan.stakeholderGroups.some(sg => sg.isSelected === true);
    
    // Safe check for consultation questions
    const hasAnsweredQuestions = consultationPlan.consultationQuestions && 
      typeof consultationPlan.consultationQuestions === 'object' &&
      Object.values(consultationPlan.consultationQuestions).some(q => 
        q !== null && 
        q !== undefined && 
        typeof q === 'string' && 
        q.trim().length > 0
      );
    
    // FIXED: Better date validation
    const dates = consultationPlan.plannedConsultationDates;
    const hasPlannedDates = dates && (
      (dates.startDate != null && dates.startDate !== undefined) ||
      (dates.endDate != null && dates.endDate !== undefined) ||
      (dates.dateDescription && 
       typeof dates.dateDescription === 'string' &&
       dates.dateDescription.trim().length > 0)
    );

    console.log('Validation Debug:', {
      hasSelectedStakeholders,
      stakeholderGroups: consultationPlan.stakeholderGroups,
      hasAnsweredQuestions,
      questions: consultationPlan.consultationQuestions,
      hasPlannedDates,
      dates: consultationPlan.plannedConsultationDates
    });

    const completionCheck = {
      canComplete: hasSelectedStakeholders && hasAnsweredQuestions && hasPlannedDates,
      missing: {
        stakeholderGroups: !hasSelectedStakeholders,
        consultationQuestions: !hasAnsweredQuestions,
        plannedDates: !hasPlannedDates
      }
    };

    // Check if requirements are met before completing
    if (!completionCheck.canComplete) {
      const error = new Error('Cannot complete consultation plan. Missing required sections.') as CustomError;
      error.statusCode = 400;
      (error as any).details = completionCheck.missing;
      throw error;
    }

    // Now update using findByIdAndUpdate to ensure atomic operation
    const updatedPlan = await TOCConsultationPlan.findByIdAndUpdate(
      planId,
      {
        status: 'completed',
        isCompleted: true,
        completedAt: new Date(),
        lastUpdatedBy: req.user._id
      },
      { new: true, runValidators: true }
    );

    // Populate response
    const populatedPlan = await TOCConsultationPlan.findById(updatedPlan!._id)
      .populate('project', 'name')
      .populate('projectSite', 'name location')
      .populate('stakeholderGroups.stakeholderGroup', 'name description')
      .populate('creator', 'name email')
      .populate('lastUpdatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Consultation plan marked as completed successfully',
      data: populatedPlan
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid plan ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Check if consultation plan is completed for a site (used by TOC stages)
 * @route GET /api/v1/toc-consultation-plans/site/:siteId/status
 * @access Private
 */
export const checkConsultationPlanStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { siteId } = req.params;

    // Check if project site exists
    const projectSite = await ProjectSite.findById(siteId);
    if (!projectSite) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if consultation plan is completed
    const completedPlan = await TOCConsultationPlan.findOne({ 
        projectSite: new mongoose.Types.ObjectId(siteId), 
        isCompleted: true 
    });

    res.status(200).json({
      success: true,
      data: {
        isCompleted: !!completedPlan,
        hasConsultationPlan: !!completedPlan,
        projectSite: {
          _id: projectSite._id,
          name: projectSite.name
        }
      }
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid site ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get all consultation plans for a project
 * @route GET /api/v1/toc-consultation-plans/project/:projectId
 * @access Private
 */
export const getConsultationPlansByProject = async (
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

    // Find all consultation plans for this project
    const consultationPlans = await TOCConsultationPlan.find({ project: projectId })
      .populate('project', 'name')
      .populate('projectSite', 'name location')
      .populate('stakeholderGroups.stakeholderGroup', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name')
      .sort({ 'projectSite.name': 1 });

    // Add summary statistics
    const summary = {
      totalPlans: consultationPlans.length,
      completedPlans: consultationPlans.filter(plan => plan.isCompleted).length,
      draftPlans: consultationPlans.filter(plan => !plan.isCompleted).length
    };

    res.status(200).json({
      success: true,
      count: consultationPlans.length,
      summary,
      data: consultationPlans
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
 * Delete a consultation plan
 * @route DELETE /api/v1/toc-consultation-plans/:planId
 * @access Private
 */
export const deleteConsultationPlan = async (
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

    const { planId } = req.params;

    // Find and delete the consultation plan
    const consultationPlan = await TOCConsultationPlan.findByIdAndDelete(planId);
    if (!consultationPlan) {
      const error = new Error('Consultation plan not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Consultation plan deleted successfully'
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid plan ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

export default {
  createOrUpdateConsultationPlan,
  getConsultationPlanBySite,
  getStakeholderGroupsForSite,
  completeConsultationPlan,
  checkConsultationPlanStatus,
  getConsultationPlansByProject,
  deleteConsultationPlan
};