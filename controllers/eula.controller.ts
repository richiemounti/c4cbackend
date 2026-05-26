// controllers/eula.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import EulaSignature from "../models/eulaSignature.model";
import User from "../models/user.model";
import { CustomError } from "../middlewares/error.middleware";

// Current EULA version - update this when EULA changes
const CURRENT_EULA_VERSION = "v3-16.06.2025";

// Helper function to get client IP
const getClientIP = (req: Request): string => {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  )?.toString().split(',')[0] || 'unknown';
};

/**
 * Check if user has signed the current EULA
 * @route GET /api/v1/eula/check
 * @access Private
 */
export const checkEulaStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user._id;
    
    if (!userId) {
      const error = new Error('User not authenticated') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check if user has signed current EULA
    const hasSigned = await EulaSignature.hasUserSignedCurrentEula(
      userId,
      CURRENT_EULA_VERSION
    );

    // Get latest signature if exists
    const latestSignature = await EulaSignature.getUserLatestSignature(userId);

    res.status(200).json({
      success: true,
      data: {
        hasSignedCurrent: hasSigned,
        currentVersion: CURRENT_EULA_VERSION,
        latestSignature: latestSignature ? {
          version: latestSignature.eulaVersion,
          signedAt: latestSignature.signedAt,
          isActive: latestSignature.isActive
        } : null,
        requiresSignature: !hasSigned
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sign the EULA
 * @route POST /api/v1/eula/sign
 * @access Private
 */
export const signEula = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user._id;
    const { fullName, email, position, organization, acceptedTerms } = req.body;

    if (!userId) {
      const error = new Error('User not authenticated') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Validate required fields
    if (!fullName || !email || !acceptedTerms) {
      const error = new Error('Full name, email, and terms acceptance are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (!acceptedTerms) {
      const error = new Error('You must accept the terms and conditions') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Get user to validate email
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Validate email matches user's email
    if (user.email.toLowerCase() !== email.toLowerCase()) {
      const error = new Error('Email must match your account email') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user has already signed current EULA
    const existingSignature = await EulaSignature.findOne({
      user: userId,
      eulaVersion: CURRENT_EULA_VERSION,
      isActive: true
    });

    if (existingSignature) {
      const error = new Error('You have already signed the current EULA') as CustomError;
      error.statusCode = 409;
      throw error;
    }

    // Get client information
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Create new signature
    const signature = new EulaSignature({
      user: userId,
      eulaVersion: CURRENT_EULA_VERSION,
      signedAt: new Date(),
      ipAddress,
      userAgent,
      signatureData: {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        position: position?.trim() || undefined,
        organization: organization?.trim() || undefined
      },
      isActive: true
    });

    await signature.save();

    // Populate user information for response
    await signature.populate('user', 'name email userName');

    res.status(201).json({
      success: true,
      message: 'EULA signed successfully',
      data: {
        signature: {
          _id: signature._id,
          version: signature.eulaVersion,
          signedAt: signature.signedAt,
          signatureData: signature.signatureData
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current EULA content and version
 * @route GET /api/v1/eula/content
 * @access Public
 */
export const getEulaContent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // In a real application, you might store EULA content in the database
    // For now, we'll return the version and indicate where to find the content
    res.status(200).json({
      success: true,
      data: {
        version: CURRENT_EULA_VERSION,
        title: "Value Scope End User Licence Agreement",
        lastUpdated: "June 2025",
        contentUrl: "/terms", // Frontend route where full content is displayed
        summary: "End User Licence Agreement for the Value Scope platform by ConnectGo Ltd."
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's signature history
 * @route GET /api/v1/eula/history
 * @access Private
 */
export const getSignatureHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user._id;

    if (!userId) {
      const error = new Error('User not authenticated') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const signatures = await EulaSignature.find({ user: userId })
      .sort({ signedAt: -1 })
      .select('-userAgent -ipAddress') // Exclude sensitive data
      .populate('user', 'name email userName');

    res.status(200).json({
      success: true,
      count: signatures.length,
      data: signatures
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all signatures (with pagination)
 * @route GET /api/v1/eula/admin/signatures
 * @access Private (Admin only)
 */
export const getAllSignatures = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;

    // Check if user is ConnectGo staff
    if (!user.isConnectGoStaff) {
      const error = new Error('Access denied. Admin privileges required.') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    if (req.query.version) {
      filter.eulaVersion = req.query.version;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    // Get signatures with pagination
    const signatures = await EulaSignature.find(filter)
      .sort({ signedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email userName')
      .populate('revokedBy', 'name email');

    const total = await EulaSignature.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: signatures.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: signatures
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Revoke a signature
 * @route PUT /api/v1/eula/admin/signatures/:id/revoke
 * @access Private (Admin only)
 */
export const revokeSignature = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    const signatureId = req.params.id;
    const { reason } = req.body;

    // Check if user is ConnectGo staff
    if (!user.isConnectGoStaff) {
      const error = new Error('Access denied. Admin privileges required.') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(signatureId)) {
      const error = new Error('Invalid signature ID') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const signature = await EulaSignature.findById(signatureId);
    if (!signature) {
      const error = new Error('Signature not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!signature.isActive) {
      const error = new Error('Signature is already revoked') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Revoke signature
    await signature.revoke(user._id, reason || 'Revoked by administrator');

    res.status(200).json({
      success: true,
      message: 'Signature revoked successfully',
      data: signature
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get signature statistics
 * @route GET /api/v1/eula/admin/statistics
 * @access Private (Admin only)
 */
export const getSignatureStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;

    // Check if user is ConnectGo staff
    if (!user.isConnectGoStaff) {
      const error = new Error('Access denied. Admin privileges required.') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const [
      totalSignatures,
      activeSignatures,
      currentVersionSignatures,
      revokedSignatures,
      uniqueUsers
    ] = await Promise.all([
      EulaSignature.countDocuments(),
      EulaSignature.countDocuments({ isActive: true }),
      EulaSignature.countDocuments({ 
        eulaVersion: CURRENT_EULA_VERSION, 
        isActive: true 
      }),
      EulaSignature.countDocuments({ isActive: false }),
      EulaSignature.distinct('user', { isActive: true })
    ]);

    // Get signatures by version
    const signaturesByVersion = await EulaSignature.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$eulaVersion', count: { $sum: 1 } } },
      { $sort: { '_id': -1 } }
    ]);

    // Get recent signatures (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSignatures = await EulaSignature.countDocuments({
      signedAt: { $gte: thirtyDaysAgo },
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalSignatures,
        active: activeSignatures,
        currentVersion: currentVersionSignatures,
        revoked: revokedSignatures,
        uniqueUsers: uniqueUsers.length,
        recentSignatures,
        signaturesByVersion,
        currentEulaVersion: CURRENT_EULA_VERSION
      }
    });
  } catch (error) {
    next(error);
  }
};