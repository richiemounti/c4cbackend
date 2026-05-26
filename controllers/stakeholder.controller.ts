import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Stakeholder from "../models/stakeholder.model";
import Project from "../models/project.model";
import { CustomError } from "../middlewares/error.middleware";
import { STAKEHOLDER_TASKS, getOptionsForTaskAndCategory } from "../constants/stakeholder.constants";
import { IUserDocument } from "../models/user.model";


type AuthUser = IUserDocument & {
  _id: mongoose.Types.ObjectId;
  primaryRole?: string;
  isConnectGoStaff?: boolean;
  roles?: any[];
};


// Type guard to check if user is defined
function isUserAuthenticated(req: Request): req is Request & { user: AuthUser } {
  return req.user !== undefined;
}

/**
 * Get all stakeholders for a project
 * @route GET /api/v1/stakeholders/project/:projectId
 * @access Private
 */
export const getProjectStakeholders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;
    
    // Project access is already verified by the middleware
    
    // Get all stakeholders for this project
    const stakeholders = await Stakeholder.find({ project: projectId })
      .sort({ category: 1, name: 1 });
    
    // Group stakeholders by category for easier frontend processing
    const stakeholdersByCategory = stakeholders.reduce((acc: any, stakeholder) => {
      if (!acc[stakeholder.category]) {
        acc[stakeholder.category] = [];
      }
      acc[stakeholder.category].push(stakeholder);
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      count: stakeholders.length,
      data: {
        stakeholders,
        stakeholdersByCategory
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stakeholders by project and category
 * @route GET /api/v1/stakeholders/project/:projectId/category/:category
 * @access Private
 */
export const getStakeholdersByCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId, category } = req.params;
    
    // Project access is already verified by the middleware
    
    // Validate category
    const validCategories = ['Government', 'Communities affected by the project', 'Marginalized groups', 'Partner Agencies', 'Our Organisation'];
    if (!validCategories.includes(category)) {
      const error = new Error('Invalid category') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Fetch stakeholders
    const stakeholders = await Stakeholder.find({
      project: projectId,
      category: category
    }).sort('name');
    
    res.status(200).json({
      success: true,
      count: stakeholders.length,
      data: stakeholders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single stakeholder by ID
 * @route GET /api/v1/stakeholders/:id
 * @access Private
 */
export const getStakeholder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    const stakeholder = await Stakeholder.findById(id);
    
    if (!stakeholder) {
      const error = new Error('Stakeholder not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Verify project access
    const projectId = stakeholder.project;
    
    // Ensure user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const hasAccess = req.user.hasProjectAccess(projectId);
    
    if (!hasAccess) {
      const error = new Error('Not authorized to access this stakeholder') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    res.status(200).json({
      success: true,
      data: stakeholder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new stakeholder
 * @route POST /api/v1/stakeholders
 * @access Private
 */
export const createStakeholder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Ensure user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const { projectId, category, name, connections, connectionStrength } = req.body;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Validate category
    const validCategories = ['Government', 'Communities affected by the project', 'Marginalized groups', 'Partner Agencies', 'Our Organisation'];
    if (!validCategories.includes(category)) {
      const error = new Error('Invalid category') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Validate connections
    if (!Array.isArray(connections) || connections.length === 0) {
      const error = new Error('Connections must be a non-empty array') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Validate connection types based on category
    validateAttributesForTask('connections', category, connections.map(c => c.attributeType));
    
    // Create stakeholder
    const stakeholder = await Stakeholder.create({
      project: projectId,
      category,
      name,
      connections,
      connectionStrength,
      creator: req.user._id,
      lastUpdatedBy: req.user._id
    });
    
    res.status(201).json({
      success: true,
      data: stakeholder
    });
  } catch (error) {
    // Handle duplicate entry
    if (error instanceof Error && error.name === 'MongoError' && (error as any).code === 11000) {
      const customError = new Error('A stakeholder with this name already exists in this category for this project') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Create multiple stakeholders at once
 * @route POST /api/v1/stakeholders/batch
 * @access Private
 */
export const createStakeholders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Ensure user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const { projectId, category, stakeholders } = req.body;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Validate category
    const validCategories = ['Government', 'Communities affected by the project', 'Marginalized groups', 'Partner Agencies', 'Our Organisation'];
    if (!validCategories.includes(category)) {
      const error = new Error('Invalid category') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Validate stakeholders array
    if (!Array.isArray(stakeholders) || stakeholders.length === 0) {
      const error = new Error('Stakeholders must be a non-empty array') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Validate each stakeholder
    for (const stakeholder of stakeholders) {
      if (!stakeholder.name || !stakeholder.connections || !Array.isArray(stakeholder.connections) || stakeholder.connections.length === 0) {
        const error = new Error('Each stakeholder must have a name and connections array') as CustomError;
        error.statusCode = 400;
        throw error;
      }
      
      // Validate connection types based on category
      validateAttributesForTask('connections', category, stakeholder.connections.map((c: any) => c.attributeType));
    }
    
    // Create all stakeholders
    const createdStakeholders = await Stakeholder.create(
      stakeholders.map(s => ({
        project: projectId,
        category,
        name: s.name,
        connections: s.connections,
        connectionStrength: s.connectionStrength,
        creator: req.user._id,
        lastUpdatedBy: req.user._id
      })),
      { session }
    );
    
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      count: createdStakeholders.length,
      data: createdStakeholders
    });
  } catch (error) {
    await session.abortTransaction();
    // Handle duplicate entry
    if (error instanceof Error && error.name === 'MongoError' && (error as any).code === 11000) {
      const customError = new Error('One or more stakeholders already exist in this category for this project') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Update a stakeholder
 * @route PUT /api/v1/stakeholders/:id
 * @access Private
 */
export const updateStakeholder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Ensure user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const { id } = req.params;
    const { name, connections, connectionStrength, tasks } = req.body;
    
    // Find the stakeholder
    const stakeholder = await Stakeholder.findById(id);
    
    if (!stakeholder) {
      const error = new Error('Stakeholder not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Verify project access
    const projectId = stakeholder.project;
    const hasAccess = req.user.hasProjectAccess(projectId);
    
    if (!hasAccess) {
      const error = new Error('Not authorized to update this stakeholder') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    // Update fields
    if (name) stakeholder.name = name;
    
    // Update connections if provided
    if (connections) {
      // Validate connections
      if (!Array.isArray(connections) || connections.length === 0) {
        const error = new Error('Connections must be a non-empty array') as CustomError;
        error.statusCode = 400;
        throw error;
      }
      
      // Validate connection types based on category
      validateAttributesForTask('connections', stakeholder.category, connections.map(c => c.attributeType));
      
      stakeholder.connections = connections;
    }
    
    if (connectionStrength) stakeholder.connectionStrength = connectionStrength;
    
    // Update tasks if provided
    if (tasks && Array.isArray(tasks)) {
      // Process each task
      for (const task of tasks) {
        if (!task.taskType || !task.attributes || !Array.isArray(task.attributes)) {
          const error = new Error('Each task must have a taskType and attributes array') as CustomError;
          error.statusCode = 400;
          throw error;
        }
        
        // Validate task type
        const validTaskTypes = ['power', 'wellbeing', 'roles', 'risks', 'benefits'];
        if (!validTaskTypes.includes(task.taskType)) {
          const error = new Error(`Invalid task type: ${task.taskType}`) as CustomError;
          error.statusCode = 400;
          throw error;
        }
        
        // Validate attributes for this task
        validateAttributesForTask(task.taskType, stakeholder.category, task.attributes.map((a: any) => a.attributeType));
        
        // Find existing task or create new one
        const existingTaskIndex = stakeholder.tasks.findIndex((t: any) => 
          t.taskType === task.taskType
        );
        
        if (existingTaskIndex !== -1) {
          // Update existing task
          stakeholder.tasks[existingTaskIndex].attributes = task.attributes;
          if (task.rating) stakeholder.tasks[existingTaskIndex].rating = task.rating;
        } else {
          // Add new task
          stakeholder.tasks.push(task);
        }
      }
    }
    
    // Update last modified by
    stakeholder.lastUpdatedBy = req.user._id;
    
    // Save changes
    await stakeholder.save();
    
    res.status(200).json({
      success: true,
      data: stakeholder
    });
  } catch (error) {
    // Handle duplicate entry
    if (error instanceof Error && error.name === 'MongoError' && (error as any).code === 11000) {
      const customError = new Error('A stakeholder with this name already exists in this category for this project') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Delete a stakeholder
 * @route DELETE /api/v1/stakeholders/:id
 * @access Private
 */
export const deleteStakeholder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Ensure user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const { id } = req.params;
    
    // Find the stakeholder
    const stakeholder = await Stakeholder.findById(id);
    
    if (!stakeholder) {
      const error = new Error('Stakeholder not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Verify project access
    const projectId = stakeholder.project;
    const hasAccess = req.user.hasProjectAccess(projectId);
    
    if (!hasAccess) {
      const error = new Error('Not authorized to delete this stakeholder') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    // Delete the stakeholder
    await Stakeholder.deleteOne({ _id: id });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add or update a task for a stakeholder
 * @route POST /api/v1/stakeholders/:id/tasks
 * @access Private
 */
export const addStakeholderTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Ensure user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const { id } = req.params;
    const { taskType, attributes, rating } = req.body;
    
    // Validate task input
    if (!taskType || !attributes || !Array.isArray(attributes) || attributes.length === 0) {
      const error = new Error('Task must include taskType and a non-empty attributes array') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Validate task type
    const validTaskTypes = ['power', 'wellbeing', 'roles', 'risks', 'benefits'];
    if (!validTaskTypes.includes(taskType)) {
      const error = new Error(`Invalid task type: ${taskType}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Find the stakeholder
    const stakeholder = await Stakeholder.findById(id);
    
    if (!stakeholder) {
      const error = new Error('Stakeholder not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Verify project access
    const projectId = stakeholder.project;
    const hasAccess = req.user.hasProjectAccess(projectId);
    
    if (!hasAccess) {
      const error = new Error('Not authorized to update this stakeholder') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    // Validate attributes for this task
    validateAttributesForTask(taskType, stakeholder.category, attributes.map(a => a.attributeType));
    
    // Find existing task or prepare to add new one
    const existingTaskIndex = stakeholder.tasks.findIndex((t: any) => t.taskType === taskType);
    
    if (existingTaskIndex !== -1) {
      // Update existing task
      stakeholder.tasks[existingTaskIndex].attributes = attributes;
      if (rating) stakeholder.tasks[existingTaskIndex].rating = rating;
    } else {
      // Add new task
      stakeholder.tasks.push({
        taskType,
        attributes,
        rating
      });
    }
    
    // Update last modified by
    stakeholder.lastUpdatedBy = req.user._id;
    
    // Save changes
    await stakeholder.save();
    
    res.status(200).json({
      success: true,
      data: stakeholder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stakeholder completion status for a project
 * @route GET /api/v1/stakeholders/project/:projectId/status
 * @access Private
 */
export const getStakeholderCompletionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;
    
    // Verify project access (middleware already does this)
    
    // Get all stakeholders for this project
    const stakeholders = await Stakeholder.find({ project: projectId });
    
    // Calculate statistics
    const totalStakeholders = stakeholders.length;
    const completedStakeholders = stakeholders.filter(s => s.completionStatus === 'completed').length;
    const inProgressStakeholders = stakeholders.filter(s => s.completionStatus === 'in_progress').length;
    const notStartedStakeholders = stakeholders.filter(s => s.completionStatus === 'not_started').length;
    
    // Calculate by category
    const categoryCounts = stakeholders.reduce((acc: any, stakeholder) => {
      if (!acc[stakeholder.category]) {
        acc[stakeholder.category] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0
        };
      }
      
      acc[stakeholder.category].total++;
      
      if (stakeholder.completionStatus === 'completed') {
        acc[stakeholder.category].completed++;
      } else if (stakeholder.completionStatus === 'in_progress') {
        acc[stakeholder.category].inProgress++;
      } else {
        acc[stakeholder.category].notStarted++;
      }
      
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      data: {
        total: totalStakeholders,
        completed: completedStakeholders,
        inProgress: inProgressStakeholders,
        notStarted: notStartedStakeholders,
        completionPercentage: totalStakeholders ? 
          Math.round((completedStakeholders / totalStakeholders) * 100) : 0,
        categoryCounts
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to validate attributes based on task type and category
 */
function validateAttributesForTask(taskType: string, category: string, attributeTypes: string[]) {
  const taskOptions = getOptionsForTaskAndCategory(taskType, category);
  
  // Allow custom risks if specified in the task
  const allowCustom = taskType === 'risks';
  
  if (!allowCustom) {
    // Get valid attribute types for this task and category
    const validAttributeTypes = taskOptions.map(option => option.id);
    
    // Check if all attribute types are valid
    const invalidAttributes = attributeTypes.filter(
      attrType => !validAttributeTypes.includes(attrType)
    );
    
    if (invalidAttributes.length > 0) {
      const error = new Error(`Invalid attributes for task ${taskType} and category ${category}: ${invalidAttributes.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }
  }
}