// middlewares/review.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { CustomError } from './error.middleware';

/**
 * Middleware to check if user has review_management permission
 * This is a universal permission that grants access to review features
 */
export const hasReviewManagement = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        throw error;
      }

      // Check if user has review_management permission
      const hasPermission = req.user.hasPermission('review_management');

      if (!hasPermission) {
        const error = new Error('Review management permission required') as CustomError;
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};