// controllers/stakeholderMapping.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import StakeholderGroup from "../models/stakeholderGroup.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import Category from "../models/category.model";
import { CustomError } from "../middlewares/error.middleware";
import {
  getTaskOptionsForCategory,
  getTaskPrompt,
  createStakeholderGroup,
  updateStakeholderTask,
  getStakeholderCompletionStats,
  initializeCategoryTaskOptions,
  initializeTaskPrompts
} from "../services/stakeholderMapping.service";
import { createStakeholderGroupTaskReview } from "../utils/reviewHelpers";


// Type guard to check if user is defined
function isUserAuthenticated(req: Request): req is Request & { user: { _id: mongoose.Types.ObjectId } } {
    return req.user !== undefined;
}


/**
 * Get all stakeholder groups for a project or project site
 * @route GET /api/v1/stakeholderMapping/project/:projectId
 * @route GET /api/v1/stakeholderMapping/project/:projectId/site/:siteId
 * @access Private
 */
export const getStakeholderGroups = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId, siteId } = req.params;
    
    // Build the query
    const query: any = { project: projectId };
    if (siteId) {
      query.projectSite = siteId;
    }
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // If site is specified, check if it exists
    if (siteId) {
      const site = await ProjectSite.findById(siteId);
      if (!site) {
        const error = new Error('Project site not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      
      // Check if site belongs to the project
      if (site.project.toString() !== projectId) {
        const error = new Error('Project site does not belong to this project') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Fetch stakeholder groups
    const stakeholderGroups = await StakeholderGroup.find(query)
      .populate('category', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name')
      .sort({ category: 1, name: 1 });
    
    // Group by category for easier frontend processing
    const groupsByCategory: Record<string, any[]> = {};
    stakeholderGroups.forEach(group => {
      const categoryName = (group.category as any).name;
      if (!groupsByCategory[categoryName]) {
        groupsByCategory[categoryName] = [];
      }
      groupsByCategory[categoryName].push(group);
    });
    
    res.status(200).json({
      success: true,
      count: stakeholderGroups.length,
      data: {
        stakeholderGroups,
        groupsByCategory
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stakeholder groups by category for a project or project site
 * @route GET /api/v1/stakeholderMapping/project/:projectId/category/:categoryId
 * @route GET /api/v1/stakeholderMapping/project/:projectId/site/:siteId/category/:categoryId
 * @access Private
 */
export const getStakeholderGroupsByCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId, siteId, categoryId } = req.params;
    
    // Build the query
    const query: any = { 
      project: projectId,
      category: categoryId
    };
    
    if (siteId) {
      query.projectSite = siteId;
    }
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // If site is specified, check if it exists
    if (siteId) {
      const site = await ProjectSite.findById(siteId);
      if (!site) {
        const error = new Error('Project site not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      
      // Check if site belongs to the project
      if (site.project.toString() !== projectId) {
        const error = new Error('Project site does not belong to this project') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Fetch stakeholder groups
    const stakeholderGroups = await StakeholderGroup.find(query)
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name')
      .sort('name');
    
    res.status(200).json({
      success: true,
      count: stakeholderGroups.length,
      categoryName: category.name,
      data: stakeholderGroups
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single stakeholder group by ID
 * @route GET /api/v1/stakeholderMapping/:id
 * @access Private
 */
export const getStakeholderGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    // Fetch the stakeholder group
    const stakeholderGroup = await StakeholderGroup.findById(id)
      .populate('category', 'name')
      .populate('project', 'name')
      .populate('projectSite', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name');
    
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    res.status(200).json({
      success: true,
      data: stakeholderGroup
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid stakeholder group ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Create a new stakeholder group
 * @route POST /api/v1/stakeholderMapping
 * @access Private
 */
export const createStakeholderGroupController = async (
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
      categoryId, 
      name, 
      description ,
      estimatedPopulation 
    } = req.body;
    
    // Validate required fields
    if (!projectId || !categoryId || !name) {
      const error = new Error('Project ID, category ID, and name are required') as CustomError;
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
    
    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Ensure task options exist for this category
    // Before calling initializeCategoryTaskOptions, add a user check
    if (!isUserAuthenticated(req)) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
    }
    // Helper function to convert ObjectId to string
    function objectIdToString(id: mongoose.Types.ObjectId): string {
        return id.toString();
    }
    try {
      await initializeTaskPrompts(objectIdToString(req.user._id));
      await initializeCategoryTaskOptions(categoryId, category.name, objectIdToString(req.user._id));
    } catch (error) {
      console.error('Error initializing category task options:', error);
      // Continue even if this fails, as it may already be initialized
    }
    
    // Create the stakeholder group
    const stakeholderGroup = await createStakeholderGroup({
      project: projectId,
      projectSite: projectSiteId,
      category: categoryId,
      name,
      description,
      estimatedPopulation,
      creator: objectIdToString(req.user._id)
    });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      success: true,
      message: 'Stakeholder group created successfully',
      data: stakeholderGroup
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Update a stakeholder group's basic information
 * @route PUT /api/v1/stakeholderMapping/:id
 * @access Private
 */
export const updateStakeholderGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Before calling initializeCategoryTaskOptions, add a user check
    if (!isUserAuthenticated(req)) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
    }
    
    // Find the stakeholder group
    const stakeholderGroup = await StakeholderGroup.findById(id);
    
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Update fields
    if (name) stakeholderGroup.name = name;
    if (description !== undefined) stakeholderGroup.description = description;
    
    // Update last updated by
    stakeholderGroup.lastUpdatedBy = req.user._id;
    
    // Save the stakeholder group
    await stakeholderGroup.save();
    
    res.status(200).json({
      success: true,
      message: 'Stakeholder group updated successfully',
      data: stakeholderGroup
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid stakeholder group ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    
    // Handle unique constraint violation
    if (error instanceof Error && error.name === 'MongoError' && (error as any).code === 11000) {
      const customError = new Error('A stakeholder group with this name already exists for this category in this project/site') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    
    next(error);
  }
};

/**
 * Delete a stakeholder group
 * @route DELETE /api/v1/stakeholderMapping/:id
 * @access Private
 */
export const deleteStakeholderGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    // Find the stakeholder group
    const stakeholderGroup = await StakeholderGroup.findById(id);
    
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Delete the stakeholder group
    await StakeholderGroup.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Stakeholder group deleted successfully',
      data: {}
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid stakeholder group ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    
    next(error);
  }
};

/**
 * Get task options for a specific category and task type
 * @route GET /api/v1/stakeholderMapping/taskOptions/:categoryId/:taskType
 * @access Private
 */
export const getTaskOptions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { categoryId, taskType } = req.params;

    // Before calling initializeCategoryTaskOptions, add a user check
    if (!isUserAuthenticated(req)) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
    }
    
    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Validate task type
    const validTaskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
    if (!validTaskTypes.includes(taskType)) {
      const error = new Error(`Invalid task type: ${taskType}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Helper function to convert ObjectId to string
    function objectIdToString(id: mongoose.Types.ObjectId): string {
        return id.toString();
    }
    
    // Try to initialize task prompts
    try {
      await initializeTaskPrompts(objectIdToString(req.user._id));
    } catch (error) {
      console.error('Error initializing task prompts:', error);
      // Continue even if this fails, as it may already be initialized
    }
    
    // Try to initialize options if they don't exist
    try {
      await initializeCategoryTaskOptions(categoryId, category.name, objectIdToString(req.user._id));
    } catch (error) {
      console.error('Error initializing category task options:', error);
      // Continue even if this fails, as it may already be initialized
    }
    
    // Get task options
    const options = await getTaskOptionsForCategory(categoryId, taskType);
    
    // Get task prompt
    const prompt = await getTaskPrompt(taskType);
    
    res.status(200).json({
      success: true,
      count: options.length,
      data: {
        options,
        prompt
      }
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Add or update a task for a stakeholder group
 * @route POST /api/v1/stakeholderMapping/:id/tasks/:taskType
 * @access Private
 */
export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id, taskType } = req.params;
    const { responses, rating, tags } = req.body;

    // Before calling initializeCategoryTaskOptions, add a user check
    if (!isUserAuthenticated(req)) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
    }
    
    // Validate task type
    const validTaskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
    if (!validTaskTypes.includes(taskType)) {
      const error = new Error(`Invalid task type: ${taskType}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Validate response structure including isKeyInsight
    for (const response of responses) {
      if (!response.optionId || typeof response.optionId !== 'string') {
        const error = new Error('Each response must have a valid optionId') as CustomError;
        error.statusCode = 400;
        throw error;
      }
      
      // Allow empty description, but validate type if provided and not empty
      if (response.description !== undefined && response.description !== null && typeof response.description !== 'string') {
        const error = new Error('Each response description must be a string') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // Validate isKeyInsight if provided
      if (response.isKeyInsight !== undefined && typeof response.isKeyInsight !== 'boolean') {
        const error = new Error('isKeyInsight must be a boolean value') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Validate rating
    if (rating === undefined || rating < 1 || rating > 5) {
      const error = new Error('Rating must be a number between 1 and 5') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // NEW: Validate tags if provided
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        const error = new Error('Tags must be an array of strings') as CustomError;
        error.statusCode = 400;
        throw error;
      }
      
      // Validate individual tags
      const invalidTags = tags.filter(tag => 
        typeof tag !== 'string' || tag.trim().length === 0 || tag.length > 100
      );
      
      if (invalidTags.length > 0) {
        const error = new Error('Tags must be non-empty strings with max 100 characters') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Helper function to convert ObjectId to string
    function objectIdToString(id: mongoose.Types.ObjectId): string {
        return id.toString();
    }
    
    // Update the task
    const updatedStakeholderGroup = await updateStakeholderTask(
      id,
      taskType,
      { responses, rating, tags },
      objectIdToString(req.user._id)
    );

    // ============================================================================
    // 🆕 ADD AUTO-TRIGGER HERE (AFTER updateStakeholderTask)
    // ============================================================================
    
    // AUTO-TRIGGER: Create review for completed task
    try {
      // Find the task index for the updated task
      const taskIndex = updatedStakeholderGroup.tasks.findIndex(
        (t: any) => t.taskType === taskType
      );
      
      if (taskIndex !== -1) {
        // Populate necessary fields for review creation
        const populatedStakeholderGroup = await StakeholderGroup.findById(id)
          .populate({
            path: 'project',
            populate: { path: 'organization' }
          })
          .populate('projectSite')
          .populate('category');
        
        if (populatedStakeholderGroup) {
          // Import the review helper at the top of the file
          // import { createStakeholderGroupTaskReview } from '../utils/reviewHelpers';
          
          await createStakeholderGroupTaskReview(
            populatedStakeholderGroup,
            taskIndex,
            req.user._id
          );
          
          console.log(`✅ Review auto-created for stakeholder mapping task: ${taskType} - ${updatedStakeholderGroup.name}`);
        }
      }
    } catch (reviewError) {
      // Non-blocking - log error but don't fail the request
      console.error('Failed to create review for stakeholder mapping task:', reviewError);
    }
    
    // ============================================================================
    // END OF AUTO-TRIGGER
    // ============================================================================
    
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedStakeholderGroup
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get stakeholder completion statistics
 * @route GET /api/v1/stakeholderMapping/stats/project/:projectId
 * @route GET /api/v1/stakeholderMapping/stats/project/:projectId/site/:siteId
 * @access Private
 */
export const getCompletionStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId, siteId } = req.params;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // If site is specified, check if it exists
    if (siteId) {
      const site = await ProjectSite.findById(siteId);
      if (!site) {
        const error = new Error('Project site not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      
      // Check if site belongs to the project
      if (site.project.toString() !== projectId) {
        const error = new Error('Project site does not belong to this project') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Get statistics
    const stats = await getStakeholderCompletionStats(projectId, siteId);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};


// Add these functions to your stakeholderMapping.controller.ts

/**
 * Update stakeholder group theme associations
 * @route PUT /api/v1/stakeholderMapping/:id/themes
 * @access Private
 */
export const updateStakeholderGroupThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { themeIds } = req.body;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Validate themeIds is an array
    if (!Array.isArray(themeIds)) {
      const error = new Error('themeIds must be an array') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Find the stakeholder group
    const stakeholderGroup = await StakeholderGroup.findById(id);
    
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Validate that all themes exist (if any provided)
    if (themeIds.length > 0) {
      const Theme = await import('../models/theme.model').then(m => m.default);
      const themes = await Theme.find({ _id: { $in: themeIds } });
      
      if (themes.length !== themeIds.length) {
        const error = new Error('One or more themes not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
    }

    // Update themes (empty array means no restrictions - can work with any themes)
    (stakeholderGroup as any).themes = themeIds;
    stakeholderGroup.lastUpdatedBy = req.user._id;
    
    await stakeholderGroup.save();

    // Populate and return updated stakeholder group
    const updatedStakeholderGroup = await StakeholderGroup.findById(id)
      .populate('themes', 'name description')
      .populate('category', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name');
    
    res.status(200).json({
      success: true,
      message: 'Stakeholder group themes updated successfully',
      data: updatedStakeholderGroup
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid stakeholder group ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    
    next(error);
  }
};

/**
 * Get stakeholder group with associated themes
 * @route GET /api/v1/stakeholderMapping/:id/themes
 * @access Private
 */
export const getStakeholderGroupThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    // Fetch the stakeholder group with themes populated
    const stakeholderGroup = await StakeholderGroup.findById(id)
      .populate('themes', 'name description')
      .populate('category', 'name')
      .populate('project', 'name')
      .populate('projectSite', 'name');
    
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Also get all available themes for the UI
    const Theme = await import('../models/theme.model').then(m => m.default);
    const allThemes = await Theme.find({ archived: { $ne: true } }).select('name description');
    
    res.status(200).json({
      success: true,
      data: {
        stakeholderGroup,
        associatedThemes: (stakeholderGroup as any).themes || [],
        allThemes,
        hasRestrictions: (stakeholderGroup as any).themes && (stakeholderGroup as any).themes.length > 0
      }
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid stakeholder group ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Bulk update theme associations for multiple stakeholder groups
 * @route PUT /api/v1/stakeholderMapping/bulk-themes
 * @access Private
 */
export const bulkUpdateStakeholderThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { stakeholderThemeMap } = req.body; // Array of { stakeholderGroupId, themeIds }

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    if (!Array.isArray(stakeholderThemeMap)) {
      const error = new Error('stakeholderThemeMap must be an array') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const updatePromises = stakeholderThemeMap.map(async (item: any) => {
      const { stakeholderGroupId, themeIds } = item;

      if (!Array.isArray(themeIds)) {
        throw new Error(`themeIds must be an array for stakeholder ${stakeholderGroupId}`);
      }

      const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId);
      if (!stakeholderGroup) {
        throw new Error(`Stakeholder group ${stakeholderGroupId} not found`);
      }

      // Validate themes exist (if any provided)
      if (themeIds.length > 0) {
        const Theme = await import('../models/theme.model').then(m => m.default);
        const themes = await Theme.find({ _id: { $in: themeIds } });
        
        if (themes.length !== themeIds.length) {
          throw new Error(`Some themes not found for stakeholder ${stakeholderGroupId}`);
        }
      }

      (stakeholderGroup as any).themes = themeIds;
      stakeholderGroup.lastUpdatedBy = req.user._id;
      
      return stakeholderGroup.save({ session });
    });

    await Promise.all(updatePromises);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `Successfully updated themes for ${stakeholderThemeMap.length} stakeholder groups`,
      data: {
        updatedCount: stakeholderThemeMap.length
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};


// controllers/stakeholderMapping.controller.ts - Add this new function

/**
 * Get all key insights for a project or project site
 * @route GET /api/v1/stakeholderMapping/project/:projectId/key-insights
 * @route GET /api/v1/stakeholderMapping/project/:projectId/site/:siteId/key-insights
 * @access Private
 */
export const getKeyInsights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId, siteId } = req.params;
    
    // Build the query
    const query: any = { project: projectId };
    if (siteId) {
      query.projectSite = siteId;
    }
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // If site is specified, check if it exists
    if (siteId) {
      const site = await ProjectSite.findById(siteId);
      if (!site) {
        const error = new Error('Project site not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      
      if (site.project.toString() !== projectId) {
        const error = new Error('Project site does not belong to this project') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Fetch stakeholder groups
    const stakeholderGroups = await StakeholderGroup.find(query)
      .populate('category', 'name')
      .populate('creator', 'name');
    
    // Extract key insights from all stakeholder groups
    const keyInsights: any[] = [];
    
    stakeholderGroups.forEach(group => {
      group.tasks.forEach(task => {
        const keyInsightResponses = task.responses.filter(
          (response: any) => response.isKeyInsight === true
        );
        
        if (keyInsightResponses.length > 0) {
          keyInsights.push({
            stakeholderGroup: {
              id: group._id,
              name: group.name,
              category: (group.category as any).name
            },
            taskType: task.taskType,
            rating: task.rating,
            tags: task.tags,
            insights: keyInsightResponses,
            updatedAt: task.updatedAt
          });
        }
      });
    });
    
    // Sort by most recent
    keyInsights.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    res.status(200).json({
      success: true,
      count: keyInsights.length,
      data: keyInsights
    });
  } catch (error) {
    next(error);
  }
};