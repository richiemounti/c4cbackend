// controllers/projectSetup.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import ProjectSetup from "../models/projectSetupTask.model";
import ProjectSiteSetup from "../models/projectSiteSetupTask.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import { CustomError } from "../middlewares/error.middleware";
import {
  initializeProjectSetup,
  initializeProjectSiteSetup,
  completeSetupTask,
  updateTaskData,
  getProjectSetupProgress,
  getProjectSiteSetupProgress
} from "../services/projectSetup.service";
import { uploadFile, getSignedUrl, deleteFile } from "../services/cloudinaryStorage.service";
import { FileUploadResult } from "./document.controller";
import { IUserDocument } from "../models/user.model";

import { createProjectSetupTaskReview, createProjectSiteSetupTaskReview, reviewExistsForModuleItem } from '../utils/reviewHelpers';



type AuthUser = IUserDocument & {
  _id: mongoose.Types.ObjectId;
  primaryRole?: string;
  isConnectGoStaff?: boolean;
  roles?: any[];
};

// Using the existing types/express/index.d.ts definition
// No need to redeclare the User interface here

// Type guard to check if user is defined
/**
 * Type guard to check if user is authenticated
 * This tells TypeScript that when this function returns true,
 * req.user is definitely defined and of type Express.User
 */
function isUserAuthenticated(req: Request): req is Request & { user: AuthUser } {
  return req.user !== undefined;
}

/**
 * Helper function to check if a field is empty based on data type
 */
function isFieldEmpty(data: any, dataType: string): boolean {
  // Handle null or undefined
  if (data === null || data === undefined) {
    return true;
  }

  switch (dataType) {
    case 'string':
      // Empty if string is empty or only whitespace
      return typeof data === 'string' && data.trim() === '';
      
    case 'number':
      // Empty if not a valid number
      return isNaN(data) || data === null || data === undefined;
      
    case 'boolean':
      // ✅ FIX: Boolean is NEVER considered empty (both true and false are valid values)
      // Only null/undefined should be considered empty
      return data === null || data === undefined;
      
    case 'array':
      // Empty if not an array or array has no elements
      return !Array.isArray(data) || data.length === 0;
      
    case 'object':
      // Empty if object has no keys or is null
      if (typeof data !== 'object' || data === null) return true;
      return Object.keys(data).length === 0;
      
    case 'file':
      // Check for both single file and files array
      if (data && data.files && Array.isArray(data.files)) {
        return data.files.length === 0;
      }
      return !data || !data.filename;
      
    case 'date':
      // Empty if no date value
      return !data || data === '';
      
    default:
      // For unknown types, check if falsy BUT exclude false boolean
      if (typeof data === 'boolean') return false;
      return !data;
  }
}

/**
 * Returns true if the error is a MongoDB duplicate key error (code 11000).
 * Used to handle concurrent initialize requests gracefully — when two requests
 * race to create the same setup document, only one wins at the DB level and
 * the other gets this error. We catch it and return the existing doc instead
 * of letting it bubble up as a 500.
 */
function isDuplicateKeyError(err: any): boolean {
  return err?.code === 11000;
}

/**
 * Boolean fields that conditionally trigger a file upload when the user selects "Yes".
 * Stored as { confirmed: true, files: [...], uploadedAt } instead of plain true/false.
 */
const CONDITIONAL_UPLOAD_BOOLEAN_FIELDS = ['shapefiles_uploaded', 'land_agreements_uploaded'];


/**
 * Initialize setup tasks for a project
 * @route POST /api/v1/projects/:projectId/setup/initialize
 * @access Private
 */
export const initializeSetup = async (
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
    const userId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const isCreator = project.creator.toString() === userId.toString();
    const hasProjectAccess = req.user.hasProjectAccess(project._id);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // CONCURRENCY GUARD
    // Two simultaneous requests (double-click, parallel component mounts) both
    // pass the auth check and both call initializeProjectSetup. The unique index
    // on `project` means only one insert succeeds at the DB level. The loser gets
    // a duplicate key error (11000) — we catch it and return the already-created
    // document instead of surfacing a 500.
    try {
      const projectSetup = await initializeProjectSetup(projectId, userId);
      return res.status(201).json({
        success: true,
        message: 'Project setup initialized successfully',
        data: projectSetup,
      });
    } catch (initError: any) {
      if (isDuplicateKeyError(initError)) {
        const existing = await ProjectSetup.findOne({ project: projectId });
        return res.status(200).json({
          success: true,
          message: 'Project setup already initialized',
          data: existing,
        });
      }
      throw initError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Initialize setup tasks for a project site
 * @route POST /api/v1/project-sites/:siteId/setup/initialize
 * @access Private
 */
export const initializeSiteSetup = async (
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

    const { siteId } = req.params;
    const userId = req.user._id;

    const projectSite = await ProjectSite.findById(siteId);
    if (!projectSite) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const isCreator = projectSite.creator.toString() === userId.toString();
    const hasProjectAccess = req.user.hasProjectAccess(projectSite.project);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this project site') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // CONCURRENCY GUARD — same pattern as initializeSetup above
    try {
      const projectSiteSetup = await initializeProjectSiteSetup(siteId, projectSite.project, userId);
      return res.status(201).json({
        success: true,
        message: 'Project site setup initialized successfully',
        data: projectSiteSetup,
      });
    } catch (initError: any) {
      if (isDuplicateKeyError(initError)) {
        const existing = await ProjectSiteSetup.findOne({ projectSite: siteId });
        return res.status(200).json({
          success: true,
          message: 'Project site setup already initialized',
          data: existing,
        });
      }
      throw initError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get project setup tasks
 * @route GET /api/v1/projects/:projectId/setup
 * @access Private
 */
export const getProjectSetup = async (
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
    const userId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user.hasProjectAccess(project._id);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    let projectSetup = await ProjectSetup.findOne({ project: projectId });

    // AUTO-INIT FOR PRE-EXISTING PROJECTS
    // Projects created before the setup feature was added have no setup document.
    // Rather than returning isInitialized: false and forcing the client to make a
    // second POST request (which itself has a race condition), we initialize here
    // transparently on the first GET. The duplicate-key catch handles two
    // simultaneous GETs both finding nothing and both trying to create.
    if (!projectSetup) {
      try {
        projectSetup = await initializeProjectSetup(projectId, userId);
      } catch (initError: any) {
        if (isDuplicateKeyError(initError)) {
          // Another concurrent request just created it — fetch and continue
          projectSetup = await ProjectSetup.findOne({ project: projectId });
        } else {
          throw initError;
        }
      }
    }

    // Final safety check — should never happen in practice
    if (!projectSetup) {
      return res.status(200).json({
        success: true,
        message: 'Project setup not initialized',
        data: { isInitialized: false, progress: 0, tasks: [] },
      });
    }

    // Log boolean tasks for debugging (kept from your original)
    projectSetup.tasks.forEach((task: any) => {
      if (task.dataType === 'boolean') {
        console.log(`📤 GET - Boolean Task: ${task.fieldName}`);
        console.log(`   responseData:`, task.responseData);
        console.log(`   Type:`, typeof task.responseData);
      }
    });

    // Process file URLs with correct resource type
    const tasks = await Promise.all(projectSetup.tasks.map(async (task) => {
      const taskObj = task.toObject();

      // Helper to generate signed URLs for an array of file objects
      const generateSignedUrls = async (files: any[]) =>
        Promise.all(files.map(async (file: any) => {
          try {
            let resourceType: 'image' | 'video' | 'raw' = 'raw';
            if (file.mimeType) {
              if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf') {
                resourceType = 'image';
              } else if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
                resourceType = 'video';
              }
            }
            const url = await getSignedUrl(file.filename, 60, resourceType);
            return { ...file, signedUrl: url, fileUrl: url };
          } catch (err) {
            console.error(`Error generating signed URL for file: ${err}`);
            return file;
          }
        }));

      if (task.dataType === 'file' && task.responseData) {
        if (task.responseData.files && Array.isArray(task.responseData.files)) {
          taskObj.responseData = {
            ...task.responseData,
            files: await generateSignedUrls(task.responseData.files),
          };
        } else if (task.responseData.filename) {
          try {
            let resourceType: 'image' | 'video' | 'raw' = 'raw';
            if (task.responseData.mimeType) {
              if (task.responseData.mimeType.startsWith('image/') || task.responseData.mimeType === 'application/pdf') {
                resourceType = 'image';
              } else if (task.responseData.mimeType.startsWith('video/') || task.responseData.mimeType.startsWith('audio/')) {
                resourceType = 'video';
              }
            }
            const url = await getSignedUrl(task.responseData.filename, 60, resourceType);
            taskObj.responseData = { ...task.responseData, signedUrl: url, fileUrl: url };
          } catch (err) {
            console.error(`Error generating signed URL for file: ${err}`);
          }
        }
      } else if (
        task.dataType === 'boolean' &&
        CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName) &&
        task.responseData?.files &&
        Array.isArray(task.responseData.files)
      ) {
        // Generate signed URLs for conditional-upload boolean fields (stored as { confirmed, files })
        taskObj.responseData = {
          ...task.responseData,
          files: await generateSignedUrls(task.responseData.files),
        };
      }

      return taskObj;
    }));

    return res.status(200).json({
      success: true,
      data: {
        isInitialized: true,
        progress: projectSetup.progress,
        isComplete: projectSetup.isComplete,
        completedAt: projectSetup.completedAt,
        tasks: tasks,
        _id: projectSetup._id,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get project site setup tasks
 * @route GET /api/v1/project-sites/:siteId/setup
 * @access Private
 */
export const getProjectSiteSetup = async (
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

    const { siteId } = req.params;
    const userId = req.user._id;

    const projectSite = await ProjectSite.findById(siteId);
    if (!projectSite) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user.hasProjectAccess(projectSite.project);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to access this project site') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    let siteSetup = await ProjectSiteSetup.findOne({ projectSite: siteId });

    // AUTO-INIT FOR PRE-EXISTING SITES — same pattern as getProjectSetup above
    if (!siteSetup) {
      try {
        siteSetup = await initializeProjectSiteSetup(siteId, projectSite.project, userId);
      } catch (initError: any) {
        if (isDuplicateKeyError(initError)) {
          siteSetup = await ProjectSiteSetup.findOne({ projectSite: siteId });
        } else {
          throw initError;
        }
      }
    }

    // Final safety check
    if (!siteSetup) {
      return res.status(200).json({
        success: true,
        message: 'Project site setup not initialized',
        data: { isInitialized: false, progress: 0, tasks: [] },
      });
    }

    // Process file URLs — multi-file support + conditional-upload boolean fields
    const tasks = await Promise.all(siteSetup.tasks.map(async (task) => {
      const taskObj = task.toObject();

      // Helper to generate signed URLs for an array of file objects
      const generateSignedUrls = async (files: any[]) =>
        Promise.all(files.map(async (file: any) => {
          try {
            let resourceType: 'image' | 'video' | 'raw' = 'raw';
            if (file.mimeType) {
              if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf') {
                resourceType = 'image';
              } else if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
                resourceType = 'video';
              }
            }
            const url = await getSignedUrl(file.filename, 60, resourceType);
            return { ...file, signedUrl: url, fileUrl: url };
          } catch (err) {
            console.error(`Error generating signed URL for file: ${err}`);
            return file;
          }
        }));

      if (task.dataType === 'file' && task.responseData) {
        if (task.responseData.files && Array.isArray(task.responseData.files)) {
          taskObj.responseData = {
            ...task.responseData,
            files: await generateSignedUrls(task.responseData.files),
          };
        } else if (task.responseData.filename) {
          // Single file fallback (backward compatibility)
          try {
            const url = await getSignedUrl(task.responseData.filename);
            taskObj.responseData = { ...task.responseData, signedUrl: url };
          } catch (err) {
            console.error(`Error generating signed URL for file: ${err}`);
          }
        }
      } else if (
        task.dataType === 'boolean' &&
        CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName) &&
        task.responseData?.files &&
        Array.isArray(task.responseData.files)
      ) {
        // Generate signed URLs for conditional-upload boolean fields (stored as { confirmed, files })
        taskObj.responseData = {
          ...task.responseData,
          files: await generateSignedUrls(task.responseData.files),
        };
      }

      return taskObj;
    }));

    return res.status(200).json({
      success: true,
      data: {
        isInitialized: true,
        progress: siteSetup.progress,
        isComplete: siteSetup.isComplete,
        completedAt: siteSetup.completedAt,
        tasks: tasks,
        _id: siteSetup._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a project setup task as completed
 * @route PUT /api/v1/project-setup/:setupId/tasks/:taskId/complete
 * @access Private
 */
export const completeProjectSetupTask = async (
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

    const { setupId, taskId } = req.params;
    const userId = req.user._id;
    const { responseData } = req.body;

    // Get the setup to check permissions and the task details
    const projectSetup = await ProjectSetup.findById(setupId);
    if (!projectSetup) {
      const error = new Error('Project setup not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Find the specific task to get its data type
    const task = projectSetup.tasks.find(task => task._id.toString() === taskId);
    
    if (!task) {
      const error = new Error('Task not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to modify this project
    const project = await Project.findById(projectSetup.project);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user.hasProjectAccess(project._id);
    const isConnectGoStaff = req.user.isConnectGoStaff;
    
    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this project setup') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // ✅ UPDATED: Handle multiple file uploads
    let processedResponseData = responseData;

    if (task.dataType === 'file') {
      const files = req.files as Express.Multer.File[];

      if (files && files.length > 0) {
        // Upload all files to Cloudinary
        const uploadedFiles = await Promise.all(
          files.map(file =>
            uploadFile(file, `project-setup/${projectSetup.project}/task-${taskId}`)
          )
        );

        // Store array of file metadata
        processedResponseData = {
          files: uploadedFiles.map(uf => ({
            filename: uf.filename,
            fileUrl: uf.fileUrl,
            size: uf.size,
            mimeType: uf.mimeType,
            originalName: uf.originalName,
          })),
          uploadedAt: new Date(),
        };
      }
    } else if (task.dataType === 'boolean' && CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName)) {
      // Boolean field that conditionally triggers a file upload when the user selects Yes
      if (processedResponseData === true || processedResponseData === 'true') {
        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
          const uploadedFiles = await Promise.all(
            files.map(file =>
              uploadFile(file, `project-setup/${projectSetup.project}/task-${taskId}`)
            )
          );
          processedResponseData = {
            confirmed: true,
            files: uploadedFiles.map(uf => ({
              filename: uf.filename,
              fileUrl: uf.fileUrl,
              size: uf.size,
              mimeType: uf.mimeType,
              originalName: uf.originalName,
            })),
            uploadedAt: new Date(),
          };
        }
        // Yes but no files → store plain true; user can add files via Update later
      }
      // false → processedResponseData stays as false
    }

    const updatedSetup = await completeSetupTask(setupId, taskId, userId, processedResponseData, false);

    // ✅ AUTO-TRIGGER: Create review for completed task
    try {
      // Find the task index
      const taskIndex = updatedSetup.tasks.findIndex((t: any) => t._id.toString() === taskId);
      
      if (taskIndex !== -1) {
                
        // Populate project with organization
        const populatedSetup = await ProjectSetup.findById(setupId).populate({
          path: 'project',
          populate: { path: 'organization' }
        });
        
        if (populatedSetup) {
          await createProjectSetupTaskReview(populatedSetup, taskIndex, userId);
          console.log(`✅ Review created for project setup task: ${task.fieldLabel}`);
        }
      }
    } catch (reviewError) {
      // Log error but don't fail the request
      console.error('Failed to create review for project setup task:', reviewError);
    }


    res.status(200).json({
      success: true,
      message: 'Project setup task completed successfully',
      data: {
        progress: updatedSetup.progress,
        isComplete: updatedSetup.isComplete,
        tasks: updatedSetup.tasks
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a project site setup task as completed
 * @route PUT /api/v1/project-site-setup/:setupId/tasks/:taskId/complete
 * @access Private
 */
export const completeSiteSetupTask = async (
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

    const { setupId, taskId } = req.params;
    const userId = req.user._id;
    const { responseData } = req.body;

    // Get the setup to check permissions and task details
    const siteSetup = await ProjectSiteSetup.findById(setupId);
    if (!siteSetup) {
      const error = new Error('Project site setup not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Find the specific task to get its data type
    const task = siteSetup.tasks.find(task => task._id.toString() === taskId);
    
    if (!task) {
      const error = new Error('Task not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to modify this project site
    const hasProjectAccess = req.user.hasProjectAccess(siteSetup.project);
    const isConnectGoStaff = req.user.isConnectGoStaff;
    
    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this project site setup') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // ✅ UPDATED: Handle multiple file uploads
    let processedResponseData = responseData;

    if (task.dataType === 'file') {
      const files = req.files as Express.Multer.File[];

      if (files && files.length > 0) {
        // Upload all files to Cloudinary
        const uploadedFiles = await Promise.all(
          files.map(file =>
            uploadFile(file, `project-site-setup/${siteSetup.projectSite}/task-${taskId}`)
          )
        );

        // Store array of file metadata
        processedResponseData = {
          files: uploadedFiles.map(uf => ({
            filename: uf.filename,
            fileUrl: uf.fileUrl,
            size: uf.size,
            mimeType: uf.mimeType,
            originalName: uf.originalName,
          })),
          uploadedAt: new Date(),
        };
      }
    } else if (task.dataType === 'boolean' && CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName)) {
      // Boolean field that conditionally triggers a file upload when the user selects Yes
      if (processedResponseData === true || processedResponseData === 'true') {
        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
          const uploadedFiles = await Promise.all(
            files.map(file =>
              uploadFile(file, `project-site-setup/${siteSetup.projectSite}/task-${taskId}`)
            )
          );
          processedResponseData = {
            confirmed: true,
            files: uploadedFiles.map(uf => ({
              filename: uf.filename,
              fileUrl: uf.fileUrl,
              size: uf.size,
              mimeType: uf.mimeType,
              originalName: uf.originalName,
            })),
            uploadedAt: new Date(),
          };
        }
        // Yes but no files → store plain true; user can add files via Update later
      }
      // false → processedResponseData stays as false
    }

    const updatedSetup = await completeSetupTask(setupId, taskId, userId, processedResponseData, true);

    // ✅ AUTO-TRIGGER: Create review for completed site setup task
    try {
      // Find the task index
      const taskIndex = updatedSetup.tasks.findIndex((t: any) => t._id.toString() === taskId);
      
      if (taskIndex !== -1) {        
        // Populate project and projectSite with organization
        const populatedSetup = await ProjectSiteSetup.findById(setupId).populate({
          path: 'project',
          populate: { path: 'organization' }
        });
        
        if (populatedSetup) {
          await createProjectSiteSetupTaskReview(populatedSetup, taskIndex, userId);
          console.log(`✅ Review created for project site setup task: ${task.fieldLabel}`);
        }
      }
    } catch (reviewError) {
      // Log error but don't fail the request
      console.error('Failed to create review for project site setup task:', reviewError);
    }


    res.status(200).json({
      success: true,
      message: 'Project site setup task completed successfully',
      data: {
        progress: updatedSetup.progress,
        isComplete: updatedSetup.isComplete,
        tasks: updatedSetup.tasks
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update task data without marking as complete
 * @route PATCH /api/v1/project-setup/:setupId/tasks/:taskId/data
 * @access Private
 */
export const updateProjectSetupTaskData = async (
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

    const { setupId, taskId } = req.params;
    const userId = req.user._id;
    const { responseData } = req.body;

    const projectSetup = await ProjectSetup.findById(setupId);
    if (!projectSetup) {
      const error = new Error('Project setup not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const task = projectSetup.tasks.find(task => task._id.toString() === taskId);
    
    if (!task) {
      const error = new Error('Task not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const project = await Project.findById(projectSetup.project);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user.hasProjectAccess(project._id);
    const isConnectGoStaff = req.user.isConnectGoStaff;
    
    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this project setup') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // ✅ NEW: Handle multiple file uploads with APPEND logic
    let processedResponseData = responseData;

    if (task.dataType === 'file') {
      const files = req.files as Express.Multer.File[];

      if (files && files.length > 0) {
        // Upload all NEW files to Cloudinary
        const uploadedFiles = await Promise.all(
          files.map(file =>
            uploadFile(file, `project-setup/${projectSetup.project}/task-${taskId}`)
          )
        );

        const newFiles = uploadedFiles.map(uf => ({
          filename: uf.filename,
          fileUrl: uf.fileUrl,
          size: uf.size,
          mimeType: uf.mimeType,
          originalName: uf.originalName,
        }));

        // ✅ APPEND new files to existing files instead of replacing
        const existingFiles = task.responseData?.files || [];

        processedResponseData = {
          files: [...existingFiles, ...newFiles],
          uploadedAt: new Date(),
        };
      } else {
        // No new files uploaded, keep existing data
        processedResponseData = task.responseData;
      }
    } else if (task.dataType === 'boolean' && CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName)) {
      // Boolean field that conditionally triggers a file upload when the user selects Yes
      if (processedResponseData === true || processedResponseData === 'true') {
        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
          const uploadedFiles = await Promise.all(
            files.map(file =>
              uploadFile(file, `project-setup/${projectSetup.project}/task-${taskId}`)
            )
          );
          const newFiles = uploadedFiles.map(uf => ({
            filename: uf.filename,
            fileUrl: uf.fileUrl,
            size: uf.size,
            mimeType: uf.mimeType,
            originalName: uf.originalName,
          }));
          // APPEND to any previously uploaded files
          const existingFiles = task.responseData?.files || [];
          processedResponseData = {
            confirmed: true,
            files: [...existingFiles, ...newFiles],
            uploadedAt: new Date(),
          };
        } else {
          // Yes with no new files — preserve existing confirmed state if present
          if (task.responseData?.confirmed) {
            processedResponseData = task.responseData;
          }
          // else stays as plain true
        }
      }
      // false → processedResponseData stays as false (clears any previously confirmed state)
    }

    // ✅ FIX: Add logging for debugging boolean values
    if (task.dataType === 'boolean') {
      console.log(`📝 Updating boolean task: ${task.fieldName}`);
      console.log(`   Incoming responseData:`, processedResponseData);
      console.log(`   Type:`, typeof processedResponseData);
    }

    // ✅ Check if field is empty and mark as incomplete
    const isEmpty = isFieldEmpty(processedResponseData, task.dataType);

    console.log(`   Is Empty: ${isEmpty}`);

    if (isEmpty && task.isCompleted) {
      task.isCompleted = false;
      task.completedAt = undefined;
      task.completedBy = undefined;
    }

    // ✅ FIX: Set responseData - ensure false boolean values are preserved
    task.responseData = processedResponseData;

    // ✅ Mark as modified for Mongoose
    task.markModified('responseData');

    projectSetup.lastUpdatedBy = userId;
    (projectSetup as any).calculateProgress();
    
    await projectSetup.save();

    // ✅ FIX: Add logging after save
    if (task.dataType === 'boolean') {
      console.log(`   Saved responseData:`, task.responseData);
      console.log(`   Task completed: ${task.isCompleted}`);
    }

    // ✅ BACKFILL: Create review if task is completed but has no existing review
    // Handles tasks that were completed before the review feature was introduced
    if (task.isCompleted) {
      try {
        const reviewAlreadyExists = await reviewExistsForModuleItem(
          'project_setup',
          projectSetup._id as mongoose.Types.ObjectId,
          taskId
        );

        if (!reviewAlreadyExists) {
          console.log(`🔄 Backfilling review for project setup task: ${task.fieldLabel}`);

          const populatedSetup = await ProjectSetup.findById(setupId).populate({
            path: 'project',
            populate: { path: 'organization' }
          });

          if (populatedSetup) {
            const taskIndex = populatedSetup.tasks.findIndex(
              (t: any) => t._id.toString() === taskId
            );
            if (taskIndex !== -1) {
              await createProjectSetupTaskReview(populatedSetup, taskIndex, userId);
              console.log(`✅ Backfill review created for project setup task: ${task.fieldLabel}`);
            }
          }
        }
      } catch (reviewError) {
        // Don't fail the request if review creation fails
        console.error('Failed to backfill review for project setup task:', reviewError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Project setup task data updated successfully',
      data: {
        task: projectSetup.tasks.find((t: any) => t._id.toString() === taskId)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update task data without marking as complete
 * @route PATCH /api/v1/project-site-setup/:setupId/tasks/:taskId/data
 * @access Private
 */
export const updateSiteSetupTaskData = async (
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

    const { setupId, taskId } = req.params;
    const userId = req.user._id;
    const { responseData } = req.body;

    const siteSetup = await ProjectSiteSetup.findById(setupId);
    if (!siteSetup) {
      const error = new Error('Project site setup not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const task = siteSetup.tasks.find(task => task._id.toString() === taskId);
    
    if (!task) {
      const error = new Error('Task not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user.hasProjectAccess(siteSetup.project);
    const isConnectGoStaff = req.user.isConnectGoStaff;
    
    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this project site setup') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // ✅ NEW: Handle multiple file uploads with APPEND logic
    let processedResponseData = responseData;

    if (task.dataType === 'file') {
      const files = req.files as Express.Multer.File[];

      if (files && files.length > 0) {
        // Upload all NEW files to Cloudinary
        const uploadedFiles = await Promise.all(
          files.map(file =>
            uploadFile(file, `project-site-setup/${siteSetup.projectSite}/task-${taskId}`)
          )
        );

        const newFiles = uploadedFiles.map(uf => ({
          filename: uf.filename,
          fileUrl: uf.fileUrl,
          size: uf.size,
          mimeType: uf.mimeType,
          originalName: uf.originalName,
        }));

        // ✅ APPEND new files to existing files instead of replacing
        const existingFiles = task.responseData?.files || [];

        processedResponseData = {
          files: [...existingFiles, ...newFiles],
          uploadedAt: new Date(),
        };
      } else {
        // No new files uploaded, keep existing data
        processedResponseData = task.responseData;
      }
    } else if (task.dataType === 'boolean' && CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName)) {
      // Boolean field that conditionally triggers a file upload when the user selects Yes
      if (processedResponseData === true || processedResponseData === 'true') {
        const files = req.files as Express.Multer.File[];
        if (files && files.length > 0) {
          const uploadedFiles = await Promise.all(
            files.map(file =>
              uploadFile(file, `project-site-setup/${siteSetup.projectSite}/task-${taskId}`)
            )
          );
          const newFiles = uploadedFiles.map(uf => ({
            filename: uf.filename,
            fileUrl: uf.fileUrl,
            size: uf.size,
            mimeType: uf.mimeType,
            originalName: uf.originalName,
          }));
          // APPEND to any previously uploaded files
          const existingFiles = task.responseData?.files || [];
          processedResponseData = {
            confirmed: true,
            files: [...existingFiles, ...newFiles],
            uploadedAt: new Date(),
          };
        } else {
          // Yes with no new files — preserve existing confirmed state if present
          if (task.responseData?.confirmed) {
            processedResponseData = task.responseData;
          }
          // else stays as plain true
        }
      }
      // false → processedResponseData stays as false (clears any previously confirmed state)
    }

    // ✅ FIX: Add logging for debugging boolean values
    if (task.dataType === 'boolean') {
      console.log(`📝 Updating boolean task: ${task.fieldName}`);
      console.log(`   Incoming responseData:`, processedResponseData);
      console.log(`   Type:`, typeof processedResponseData);
    }

    // ✅ Check if field is empty and mark as incomplete
    const isEmpty = isFieldEmpty(processedResponseData, task.dataType);

    console.log(`   Is Empty: ${isEmpty}`);

    if (isEmpty && task.isCompleted) {
      task.set('isCompleted', false);
      task.set('completedAt', null);
      task.set('completedBy', null);
    }

    // ✅ FIX: Set responseData - ensure false boolean values are preserved
    task.responseData = processedResponseData;

    // ✅ Mark as modified for Mongoose
    task.markModified('responseData');

    task.updatedAt = new Date();
    siteSetup.lastUpdatedBy = userId;
    (siteSetup as any).calculateProgress();
    
    await siteSetup.save();

    // ✅ FIX: Add logging after save
    if (task.dataType === 'boolean') {
      console.log(`   Saved responseData:`, task.responseData);
      console.log(`   Task completed: ${task.isCompleted}`);
    }

    // ✅ BACKFILL: Create review if task is completed but has no existing review
    // Handles tasks that were completed before the review feature was introduced
    if (task.isCompleted) {
      try {
        const reviewAlreadyExists = await reviewExistsForModuleItem(
          'project_site_setup',
          siteSetup._id,
          taskId
        );

        if (!reviewAlreadyExists) {
          console.log(`🔄 Backfilling review for site setup task: ${task.fieldLabel}`);

          const populatedSetup = await ProjectSiteSetup.findById(setupId).populate({
            path: 'project',
            populate: { path: 'organization' }
          });

          if (populatedSetup) {
            const taskIndex = populatedSetup.tasks.findIndex(
              (t: any) => t._id.toString() === taskId
            );
            if (taskIndex !== -1) {
              await createProjectSiteSetupTaskReview(populatedSetup, taskIndex, userId);
              console.log(`✅ Backfill review created for site setup task: ${task.fieldLabel}`);
            }
          }
        }
      } catch (reviewError) {
        // Don't fail the request if review creation fails
        console.error('Failed to backfill review for site setup task:', reviewError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Project site setup task data updated successfully',
      data: {
        task: siteSetup.tasks.find((t: any) => t._id.toString() === taskId)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a specific file from task
 * @route DELETE /api/v1/project-setup/:setupId/tasks/:taskId/files/:filename
 * @access Private
 */
export const removeProjectSetupTaskFile = async (
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

    const { setupId, taskId, filename } = req.params;
    const userId = req.user._id;

    const decodedFilename = decodeURIComponent(filename);

    const projectSetup = await ProjectSetup.findById(setupId);
    if (!projectSetup) {
      const error = new Error('Project setup not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const task = projectSetup.tasks.find(task => task._id.toString() === taskId);
    
    if (!task) {
      const error = new Error('Task not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const project = await Project.findById(projectSetup.project);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user.hasProjectAccess(project._id);
    const isConnectGoStaff = req.user.isConnectGoStaff;
    
    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this project setup') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    if (task.responseData?.files) {
      const fileToRemove = task.responseData.files.find(
        (file: any) => file.filename === decodedFilename
      );

      if (!fileToRemove) {
        const error = new Error('File not found in task') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      console.log(`📝 Before deletion - File count: ${task.responseData.files.length}`);
      console.log(`📝 Files:`, task.responseData.files.map((f: any) => f.filename));

      // ✅ FIX: Filter out the file
      task.responseData.files = task.responseData.files.filter(
        (file: any) => file.filename !== decodedFilename
      );

      console.log(`📝 After deletion - File count: ${task.responseData.files.length}`);
      console.log(`📝 Files:`, task.responseData.files.map((f: any) => f.filename));
      
      // ✅ FIX: Delete from Cloudinary
      try {
        let resourceType: 'image' | 'video' | 'raw' = 'raw';
        if (fileToRemove.mimeType) {
          if (fileToRemove.mimeType.startsWith('image/') || fileToRemove.mimeType === 'application/pdf') {
            resourceType = 'image';
          } else if (fileToRemove.mimeType.startsWith('video/') || fileToRemove.mimeType.startsWith('audio/')) {
            resourceType = 'video';
          }
        }
        
        console.log(`Attempting to delete file from Cloudinary:`);
        console.log(`  Public ID: ${decodedFilename}`);
        console.log(`  Resource Type: ${resourceType}`);
        
        await deleteFile(decodedFilename, resourceType);
        console.log(`✅ File deleted from Cloudinary: ${decodedFilename}`);
      } catch (err) {
        console.error('Error deleting file from Cloudinary:', err);
      }
      
      // ✅ FIX: Mark the entire responseData as modified for Mongoose to detect changes
      task.markModified('responseData');
      
      // Check if now empty and mark as incomplete
      if (task.responseData.files.length === 0 && task.isCompleted) {
        task.isCompleted = false;
        task.completedAt = undefined;
        task.completedBy = undefined;
      }
      
      projectSetup.lastUpdatedBy = userId;
      (projectSetup as any).calculateProgress();
      
      // ✅ FIX: Save and wait for confirmation
      const savedSetup = await projectSetup.save();
      
      console.log(`💾 Saved to database - File count: ${savedSetup.tasks.find((t: any) => t._id.toString() === taskId)?.responseData?.files?.length || 0}`);

      res.status(200).json({
        success: true,
        message: 'File removed successfully',
        data: {
          task: savedSetup.tasks.find((t: any) => t._id.toString() === taskId),
          deletedFile: fileToRemove.originalName || decodedFilename
        }
      });
    } else {
      const error = new Error('No files found in task') as CustomError;
      error.statusCode = 404;
      throw error;
    }
  } catch (error) {
    next(error);
  }
};


/**
 * Remove a specific file from project site task
 * @route DELETE /api/v1/project-site-setup/:setupId/tasks/:taskId/files/:filename
 * @access Private
 */
export const removeSiteSetupTaskFile = async (
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

    const { setupId, taskId, filename } = req.params;
    const userId = req.user._id;

    const decodedFilename = decodeURIComponent(filename);

    const siteSetup = await ProjectSiteSetup.findById(setupId);
    if (!siteSetup) {
      const error = new Error('Project site setup not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const task = siteSetup.tasks.find(task => task._id.toString() === taskId);
    
    if (!task) {
      const error = new Error('Task not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user.hasProjectAccess(siteSetup.project);
    const isConnectGoStaff = req.user.isConnectGoStaff;
    
    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this project site setup') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    if (task.responseData?.files) {
      const fileToRemove = task.responseData.files.find(
        (file: any) => file.filename === decodedFilename
      );

      if (!fileToRemove) {
        const error = new Error('File not found in task') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      console.log(`📝 Before deletion - File count: ${task.responseData.files.length}`);
      console.log(`📝 Files:`, task.responseData.files.map((f: any) => f.filename));

      // Filter out the file
      task.responseData.files = task.responseData.files.filter(
        (file: any) => file.filename !== decodedFilename
      );

      console.log(`📝 After deletion - File count: ${task.responseData.files.length}`);
      console.log(`📝 Files:`, task.responseData.files.map((f: any) => f.filename));
      
      // Delete from Cloudinary
      try {
        let resourceType: 'image' | 'video' | 'raw' = 'raw';
        if (fileToRemove.mimeType) {
          if (fileToRemove.mimeType.startsWith('image/') || fileToRemove.mimeType === 'application/pdf') {
            resourceType = 'image';
          } else if (fileToRemove.mimeType.startsWith('video/') || fileToRemove.mimeType.startsWith('audio/')) {
            resourceType = 'video';
          }
        }
        
        console.log(`Attempting to delete file from Cloudinary:`);
        console.log(`  Public ID: ${decodedFilename}`);
        console.log(`  Resource Type: ${resourceType}`);
        
        await deleteFile(decodedFilename, resourceType);
        console.log(`✅ File deleted from Cloudinary: ${decodedFilename}`);
      } catch (err) {
        console.error('Error deleting file from Cloudinary:', err);
      }
      
      // ✅ FIX: Mark the entire responseData as modified for Mongoose to detect changes
      task.markModified('responseData');
      
      // Check if now empty and mark as incomplete if it was completed
      if (task.responseData.files.length === 0 && task.isCompleted) {
        task.set('isCompleted', false);
        task.set('completedAt', null);
        task.set('completedBy', null);
      }
      
      siteSetup.lastUpdatedBy = userId;
      task.updatedAt = new Date();
      (siteSetup as any).calculateProgress();
      
      // ✅ FIX: Save and wait for confirmation
      const savedSetup = await siteSetup.save();
      
      console.log(`💾 Saved to database - File count: ${savedSetup.tasks.find((t: any) => t._id.toString() === taskId)?.responseData?.files?.length || 0}`);

      res.status(200).json({
        success: true,
        message: 'File removed successfully',
        data: {
          task: savedSetup.tasks.find((t: any) => t._id.toString() === taskId),
          deletedFile: fileToRemove.originalName || decodedFilename
        }
      });
    } else {
      const error = new Error('No files found in task') as CustomError;
      error.statusCode = 404;
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get project setup progress summary
 * @route GET /api/v1/projects/:projectId/setup/progress
 * @access Private
 */
export const getProjectSetupProgressSummary = async (
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

    const { projectId } = req.params;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to access this project
    const hasProjectAccess = req.user.hasProjectAccess(project._id);
    const isConnectGoStaff = req.user.isConnectGoStaff;
    
    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get the project setup progress
    const progress = await getProjectSetupProgress(projectId);

    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get project site setup progress summary
 * @route GET /api/v1/project-sites/:siteId/setup/progress
 * @access Private
 */
export const getProjectSiteSetupProgressSummary = async (
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

    const { siteId } = req.params;

    // Check if project site exists
    const projectSite = await ProjectSite.findById(siteId);
    if (!projectSite) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to access this project site
    const hasProjectAccess = req.user.hasProjectAccess(projectSite.project);
    const isConnectGoStaff = req.user.isConnectGoStaff;
    
    if (!hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to access this project site') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get the project site setup progress
    const progress = await getProjectSiteSetupProgress(siteId);

    res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
};