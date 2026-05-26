// middlewares/eula.middleware.ts
import { Request, Response, NextFunction } from "express";
import EulaSignature from "../models/eulaSignature.model";
import { CustomError } from "./error.middleware";

// Current EULA version - should match the one in controller
const CURRENT_EULA_VERSION = "v3-16.06.2025";

/**
 * Middleware to check if user has signed the current EULA
 * Use this middleware on routes that require EULA acceptance
 */
export const requireEulaAcceptance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;

    // Skip check if user is not authenticated
    if (!user || !user._id) {
      return next();
    }

    // Check if user has signed current EULA
    const hasSigned = await EulaSignature.hasUserSignedCurrentEula(
      user._id,
      CURRENT_EULA_VERSION
    );

    if (!hasSigned) {
      const error = new Error('EULA acceptance required. Please review and accept the terms and conditions.') as CustomError;
      error.statusCode = 403;
      error.message = 'EULA_NOT_SIGNED';
      return next(error);
    }

    // User has signed EULA, continue
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to add EULA status to response
 * Use this on routes where you want to include EULA status in the response
 */
export const addEulaStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;

    if (user && user._id) {
      const hasSigned = await EulaSignature.hasUserSignedCurrentEula(
        user._id,
        CURRENT_EULA_VERSION
      );

      // Add EULA status to res.locals so it can be accessed in controllers
      res.locals.eulaStatus = {
        hasSignedCurrent: hasSigned,
        currentVersion: CURRENT_EULA_VERSION,
        requiresSignature: !hasSigned
      };
    }

    next();
  } catch (error) {
    // Don't fail the request if EULA check fails, just log the error
    console.error('Error checking EULA status:', error);
    next();
  }
};

/**
 * Routes that should be exempted from EULA checks
 */
export const EULA_EXEMPT_ROUTES = [
  '/api/v1/auth/sign-in',
  '/api/v1/auth/sign-up',
  '/api/v1/auth/sign-out',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/google',
  '/api/v1/auth/microsoft',
  '/api/v1/eula/content',
  '/api/v1/eula/check',
  '/api/v1/eula/sign'
];

/**
 * Global middleware to check EULA on all protected routes
 * Add this after your auth middleware
 */
export const globalEulaCheck = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip EULA check for exempt routes
  if (EULA_EXEMPT_ROUTES.some(route => req.path.startsWith(route))) {
    return next();
  }

  // Skip EULA check for public routes (non-authenticated requests)
  const user = (req as any).user;
  if (!user || !user._id) {
    return next();
  }

  // Apply EULA requirement
  requireEulaAcceptance(req, res, next);
};