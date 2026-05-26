// middlewares/role.middleware.ts - FIXED AND SIMPLIFIED
import { Request, Response, NextFunction } from 'express';
import { CustomError } from './error.middleware';
import mongoose from 'mongoose';
import ProjectSite from '../models/projectSite.model';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export const hasPermission = (permissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
      }

      const hasRequiredPermission = permissions.some(permission => 
        req.user.hasPermission(permission)
      );

      if (!hasRequiredPermission) {
        const error = new Error('Not authorized to perform this action') as CustomError;
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Simplified hasProjectAccess middleware
 * Works for all project and project-site routes
 */
export const hasProjectAccess = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
      }

      let projectId: string | undefined;

      // STEP 1: Try to get project ID from params (most common cases)
      if (req.params.projectId) {
        // Case: /projects/:projectId/sites or /projects/:projectId
        projectId = req.params.projectId;
      } 
      else if (req.params.id) {
        // Case: Could be /projects/:id OR /project-sites/:id
        // Check if this is a project-site route by looking at the URL
        const isProjectSiteRoute = 
          req.originalUrl.includes('/project-site') ||
          req.baseUrl.includes('/project-site');

        if (isProjectSiteRoute) {
          // It's a project site route - need to fetch the site to get project ID
          try {
            const siteId = req.params.id;
            const site = await ProjectSite.findById(siteId).select('project');
            
            if (!site) {
              const error = new Error('Project site not found') as CustomError;
              error.statusCode = 404;
              throw error;
            }
            
            projectId = site.project.toString();
          } catch (err: any) {
            if (err.statusCode === 404) throw err;
            const error = new Error('Failed to verify project site access') as CustomError;
            error.statusCode = 500;
            throw error;
          }
        } else {
          // It's a direct project route - id IS the project ID
          projectId = req.params.id;
        }
      }
      else if (req.params.siteId) {
        // Case: /project-sites/:siteId/setup
        try {
          const siteId = req.params.siteId;
          const site = await ProjectSite.findById(siteId).select('project');
          
          if (!site) {
            const error = new Error('Project site not found') as CustomError;
            error.statusCode = 404;
            throw error;
          }
          
          projectId = site.project.toString();
        } catch (err: any) {
          if (err.statusCode === 404) throw err;
          const error = new Error('Failed to verify project site access') as CustomError;
          error.statusCode = 500;
          throw error;
        }
      }
      else if (req.body.projectId) {
        // Case: POST/PUT with projectId in body
        projectId = req.body.projectId;
      }

      // STEP 2: Verify we got a project ID
      if (!projectId) {
        const error = new Error('Project ID is required or could not be determined') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // STEP 3: Check if user has access to this project
      const hasAccess = req.user.hasProjectAccess(new mongoose.Types.ObjectId(projectId));

      if (!hasAccess) {
        const error = new Error('Not authorized to access this project') as CustomError;
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const hasOrganizationAccess = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
      }

      const organizationId = req.params.id || req.params.organizationId || req.body.organizationId || req.body.organization;

      if (!organizationId) {
        const error = new Error('Organization ID is required') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      const hasAccess = req.user.hasOrganizationAccess(new mongoose.Types.ObjectId(organizationId));

      if (!hasAccess) {
        const error = new Error('Not authorized to access this organization') as CustomError;
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const isConnectGoStaff = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
      }

      if (!req.user.isConnectGoStaff) {
        const error = new Error('ConnectGo staff access required') as CustomError;
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const hasRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
      }

      const hasAllowedRole = req.user.primaryRole && roles.includes(req.user.primaryRole);
      const isAdmin = req.user.isConnectGoStaff;

      if (!hasAllowedRole && !isAdmin) {
        const error = new Error(`Role restricted. Required roles: ${roles.join(', ')}`) as CustomError;
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const restrictTo = (roles: string[]) => {
  return hasRole(roles);
};