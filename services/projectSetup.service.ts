// services/projectSetup.service.ts
import mongoose from "mongoose";
import { Document } from 'mongoose';

// Import models
import ProjectSetup from "../models/projectSetupTask.model";
import ProjectSiteSetup from "../models/projectSiteSetupTask.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";

// Create schema for task templates
const taskTemplateSchema = new mongoose.Schema({
type: {
    type: String,
    enum: ['project', 'projectSite'],
    required: true
},
tasks: [
    {
    fieldName: String,
    dataType: String,
    description: String,
    userFacingCopy: String,
    fieldLabel: String,
    helperText: String,
    hoverText: String,
    isRequired: Boolean,
    sortOrder: Number,
    step: Number
    }
],
version: {
    type: String,
    default: '1.0.0'
},
createdAt: {
    type: Date,
    default: Date.now
},
updatedAt: {
    type: Date,
    default: Date.now
}
});

// Register the model - mongoose.model will check if it exists first 
// and return the existing one if it does, or create a new one if it doesn't
const TaskTemplate = mongoose.model('TaskTemplate', taskTemplateSchema);

/**
 * Initialize project setup tasks for a new project
 * @param projectId MongoDB ObjectId of the project
 * @param userId MongoDB ObjectId of the user creating the setup
 */
export const initializeProjectSetup = async (
  projectId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string
): Promise<any> => {
  try {
    // First check if the project exists
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Check if setup already exists
    const existingSetup = await ProjectSetup.findOne({ project: projectId });
    if (existingSetup) {
      return existingSetup; // Setup already exists, return it
    }

    // Get default tasks from template
    const defaultTasks = await getDefaultProjectSetupTasks();

    // Create the project setup record
    const projectSetup = new ProjectSetup({
      project: projectId,
      tasks: defaultTasks,
      lastUpdatedBy: userId
    });

    // Skip calling calculateProgress directly, let the pre-save hook handle it

    // Save to database
    await projectSetup.save();

    return projectSetup;
  } catch (error) {
    console.error('Error initializing project setup:', error);
    throw error;
  }
};

/**
 * Initialize project site setup tasks for a new project site
 * @param projectSiteId MongoDB ObjectId of the project site
 * @param projectId MongoDB ObjectId of the parent project
 * @param userId MongoDB ObjectId of the user creating the setup
 */
export const initializeProjectSiteSetup = async (
  projectSiteId: mongoose.Types.ObjectId | string,
  projectId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string
): Promise<any> => {
  try {
    // First check if the project site exists
    const projectSite = await ProjectSite.findById(projectSiteId);
    if (!projectSite) {
      throw new Error('Project site not found');
    }

    // Check if setup already exists
    const existingSetup = await ProjectSiteSetup.findOne({ projectSite: projectSiteId });
    if (existingSetup) {
      return existingSetup; // Setup already exists, return it
    }

    // Get default tasks from template
    const defaultTasks = await getDefaultProjectSiteSetupTasks();

    // Create the project site setup record
    const projectSiteSetup = new ProjectSiteSetup({
      projectSite: projectSiteId,
      project: projectId,
      tasks: defaultTasks,
      lastUpdatedBy: userId
    });

    // Skip calling calculateProgress directly, let the pre-save hook handle it

    // Save to database
    await projectSiteSetup.save();

    return projectSiteSetup;
  } catch (error) {
    console.error('Error initializing project site setup:', error);
    throw error;
  }
};

/**
 * Update a task as completed
 * @param setupId ID of the setup record (project or site)
 * @param taskId ID of the task to update
 * @param userId ID of the user completing the task
 * @param responseData The data submitted by the user for this task
 * @param isProjectSite Whether this is for a project site (true) or project (false)
 */
export const completeSetupTask = async (
  setupId: mongoose.Types.ObjectId | string,
  taskId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  responseData: any = null,
  isProjectSite: boolean = false
): Promise<any> => {
  try {
    if (isProjectSite) {
      // Project Site Setup handling
      const setup = await ProjectSiteSetup.findById(setupId);
      if (!setup) {
        throw new Error('Project site setup not found');
      }
      
      // Convert userId to ObjectId if it's a string
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      // Use updateOne with $ operators to update the specific task in the array
      const result = await ProjectSiteSetup.updateOne(
        { 
          _id: setupId,
          "tasks._id": taskId 
        },
        { 
          $set: { 
            "tasks.$.isCompleted": true,
            "tasks.$.completedAt": new Date(),
            "tasks.$.completedBy": userIdObj,
            "tasks.$.responseData": responseData
          },
          lastUpdatedBy: userIdObj
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('Task not found in setup');
      }
      
      // Fetch the updated document
      return await ProjectSiteSetup.findById(setupId);
    } else {
      // Project Setup handling
      const setup = await ProjectSetup.findById(setupId);
      if (!setup) {
        throw new Error('Project setup not found');
      }
      
      // Convert userId to ObjectId if it's a string
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      // Use updateOne with $ operators to update the specific task in the array
      const result = await ProjectSetup.updateOne(
        { 
          _id: setupId,
          "tasks._id": taskId 
        },
        { 
          $set: { 
            "tasks.$.isCompleted": true,
            "tasks.$.completedAt": new Date(),
            "tasks.$.completedBy": userIdObj,
            "tasks.$.responseData": responseData
          },
          lastUpdatedBy: userIdObj
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('Task not found in setup');
      }
      
      // Fetch the updated document
      return await ProjectSetup.findById(setupId);
    }
  } catch (error) {
    console.error(`Error completing ${isProjectSite ? 'project site' : 'project'} setup task:`, error);
    throw error;
  }
};

/**
 * Update task data without marking as complete
 * @param setupId ID of the setup record (project or site)
 * @param taskId ID of the task to update
 * @param userId ID of the user updating the task
 * @param responseData The data submitted by the user for this task
 * @param isProjectSite Whether this is for a project site (true) or project (false)
 */
export const updateTaskData = async (
  setupId: mongoose.Types.ObjectId | string,
  taskId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  responseData: any,
  isProjectSite: boolean = false
): Promise<any> => {
  try {
    if (isProjectSite) {
      // Project Site Setup handling
      const setup = await ProjectSiteSetup.findById(setupId);
      if (!setup) {
        throw new Error('Project site setup not found');
      }
      
      // Convert userId to ObjectId if it's a string
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      // Only update the responseData field, don't mark as completed
      const result = await ProjectSiteSetup.updateOne(
        { 
          _id: setupId,
          "tasks._id": taskId 
        },
        { 
          $set: { 
            "tasks.$.responseData": responseData
          },
          lastUpdatedBy: userIdObj
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('Task not found in setup');
      }
      
      // Fetch the updated document
      return await ProjectSiteSetup.findById(setupId);
    } else {
      // Project Setup handling
      const setup = await ProjectSetup.findById(setupId);
      if (!setup) {
        throw new Error('Project setup not found');
      }
      
      // Convert userId to ObjectId if it's a string
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      // Only update the responseData field, don't mark as completed
      const result = await ProjectSetup.updateOne(
        { 
          _id: setupId,
          "tasks._id": taskId 
        },
        { 
          $set: { 
            "tasks.$.responseData": responseData
          },
          lastUpdatedBy: userIdObj
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('Task not found in setup');
      }
      
      // Fetch the updated document
      return await ProjectSetup.findById(setupId);
    }
  } catch (error) {
    console.error(`Error updating ${isProjectSite ? 'project site' : 'project'} task data:`, error);
    throw error;
  }
};

/**
 * Get setup progress for a project
 * @param projectId MongoDB ObjectId of the project
 */
export const getProjectSetupProgress = async (
  projectId: mongoose.Types.ObjectId | string
): Promise<any> => {
  try {
    const projectSetup = await ProjectSetup.findOne({ project: projectId });
    if (!projectSetup) {
      throw new Error('Project setup not found');
    }
    
    // Count completed and required tasks directly from the database
    const tasksList = projectSetup.get('tasks') || [];
    const tasksCompleted = tasksList.filter((t: any) => t.isCompleted).length;
    const requiredTasks = tasksList.filter((t: any) => t.isRequired);
    const requiredTasksCompleted = requiredTasks.filter((t: any) => t.isCompleted).length;
    
    return {
      progress: projectSetup.progress,
      isComplete: projectSetup.isComplete,
      completedAt: projectSetup.completedAt,
      tasksCompleted,
      totalTasks: tasksList.length,
      requiredTasksCompleted,
      totalRequiredTasks: requiredTasks.length
    };
  } catch (error) {
    console.error('Error getting project setup progress:', error);
    throw error;
  }
};

/**
 * Get site setup progress for a project site
 * @param projectSiteId MongoDB ObjectId of the project site
 */
export const getProjectSiteSetupProgress = async (
  projectSiteId: mongoose.Types.ObjectId | string
): Promise<any> => {
  try {
    const siteSetup = await ProjectSiteSetup.findOne({ projectSite: projectSiteId });
    if (!siteSetup) {
      throw new Error('Project site setup not found');
    }
    
    // Count completed and required tasks directly from the database
    const tasksList = siteSetup.get('tasks') || [];
    const tasksCompleted = tasksList.filter((t: any) => t.isCompleted).length;
    const requiredTasks = tasksList.filter((t: any) => t.isRequired);
    const requiredTasksCompleted = requiredTasks.filter((t: any) => t.isCompleted).length;
    
    return {
      progress: siteSetup.progress,
      isComplete: siteSetup.isComplete,
      completedAt: siteSetup.completedAt,
      tasksCompleted,
      totalTasks: tasksList.length,
      requiredTasksCompleted,
      totalRequiredTasks: requiredTasks.length
    };
  } catch (error) {
    console.error('Error getting project site setup progress:', error);
    throw error;
  }
};

/**
 * Get default project setup tasks from template
 * @returns Array of default project setup tasks
 */
export const getDefaultProjectSetupTasks = async (): Promise<any[]> => {
  try {
    // Get the TaskTemplate model
    // We use mongoose.models to access the model that was created in the seed script
    
    // Get the latest project template
    const template = await TaskTemplate.findOne({ type: 'project' })
      .sort('-createdAt')
      .lean();
    
    if (!template) {
      console.warn('No project task template found, returning default tasks');
      return getDefaultProjectSetupTasksFallback();
    }
    
    // Access tasks with safe checks using type assertion
    const templateTasks = (template as any).tasks || [];

    
    
    return templateTasks.map((task: any) => {
      // Use options exactly as stored in the template — no fallback parsing.
      // Previously this block comma-split the description field to generate
      // options, which caused free-text tag fields (e.g. approval_granted_by,
      // implementing_organisations) to render as checkboxes with junk options
      // derived from description sentences that happened to contain commas.
      const options = Array.isArray(task.options) && task.options.length > 0
        ? task.options
        : [];

      return {
        fieldName: task.fieldName || '',
        dataType: task.dataType || 'string',
        description: task.description || '',
        userFacingCopy: task.userFacingCopy || '',
        options: options,
        fieldLabel: task.fieldLabel || '',
        helperText: task.helperText || '',
        hoverText: task.hoverText || '',
        isRequired: Boolean(task.isRequired),
        sortOrder: Number(task.sortOrder) || 0,
        step: Number(task.step) || 1,
        isCompleted: false,
        completedAt: null,
        completedBy: null,
        responseData: null // Initialize with null
      };
    });
  } catch (error) {
    console.error('Error getting default project setup tasks:', error);
    return getDefaultProjectSetupTasksFallback();
  }
};

/**
 * Get default project site setup tasks from template
 * @returns Array of default project site setup tasks
 */
export const getDefaultProjectSiteSetupTasks = async (): Promise<any[]> => {
  try {
    // Get the TaskTemplate model
    // We use mongoose.models to access the model that was created in the seed script
    
    // Get the latest project site template
    const template = await TaskTemplate.findOne({ type: 'projectSite' })
      .sort('-createdAt')
      .lean();
    
    if (!template) {
      console.warn('No project site task template found, returning default tasks');
      return getDefaultProjectSiteSetupTasksFallback();
    }
    
    // Access tasks with safe checks using type assertion
    const templateTasks = (template as any).tasks || [];
    
    // Create new task objects from template with completion fields
    return templateTasks.map((task: any) => {
      // Use options exactly as stored in the template — no fallback parsing.
      // Previously this block comma-split the description field to generate
      // options, which caused free-text tag fields to render as checkboxes
      // with junk options derived from description sentences containing commas.
      const options = Array.isArray(task.options) && task.options.length > 0
        ? task.options
        : [];

      return {
        fieldName: task.fieldName || '',
        dataType: task.dataType || 'string',
        description: task.description || '',
        userFacingCopy: task.userFacingCopy || '',
        options: options,
        fieldLabel: task.fieldLabel || '',
        helperText: task.helperText || '',
        hoverText: task.hoverText || '',
        isRequired: Boolean(task.isRequired),
        sortOrder: Number(task.sortOrder) || 0,
        step: Number(task.step) || 1,
        isCompleted: false,
        completedAt: null,
        completedBy: null,
        responseData: null // Initialize with null
      };
    });
  } catch (error) {
    console.error('Error getting default project site setup tasks:', error);
    return getDefaultProjectSiteSetupTasksFallback();
  }
};

/**
 * Fallback function for default project setup tasks
 * Used if the database query fails
 */
const getDefaultProjectSetupTasksFallback = (): any[] => {
  return [
    {
      fieldName: "projectName",
      dataType: "string",
      description: "The name of the project",
      userFacingCopy: "Enter a name for your project",
      isRequired: true,
      sortOrder: 1,
      step: 1,
      isCompleted: false,
      completedAt: null,
      completedBy: null,
      responseData: null
    },
    {
      fieldName: "projectDescription",
      dataType: "string",
      description: "A brief description of the project",
      userFacingCopy: "Provide a brief description of what this project is about",
      isRequired: true,
      sortOrder: 2,
      step: 1,
      isCompleted: false,
      completedAt: null,
      completedBy: null,
      responseData: null
    }
    // Add more fallback tasks as needed
  ];
};

/**
 * Fallback function for default project site setup tasks
 * Used if the database query fails
 */
const getDefaultProjectSiteSetupTasksFallback = (): any[] => {
  return [
    {
      fieldName: "siteName",
      dataType: "string",
      description: "The name of the project site",
      userFacingCopy: "Enter a name for this project site",
      isRequired: true,
      sortOrder: 1,
      step: 2,
      isCompleted: false,
      completedAt: null,
      completedBy: null,
      responseData: null
    },
    {
      fieldName: "siteLocation",
      dataType: "string",
      description: "The location of the project site",
      userFacingCopy: "Where is this site located?",
      isRequired: true,
      sortOrder: 2,
      step: 2,
      isCompleted: false,
      completedAt: null,
      completedBy: null,
      responseData: null
    }
    // Add more fallback tasks as needed
  ];
};