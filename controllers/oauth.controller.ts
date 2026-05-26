// controllers/oauth.controller.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { CustomError } from "../middlewares/error.middleware";
import User from "../models/user.model";
import mongoose from "mongoose";

type AuthUser = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
};

// JWT Secret type assertion
const JWT_SECRET = process.env.JWT_SECRET as string || 'your_fallback_secret';

// Define interface for user object
interface UserResponse {
  _id: mongoose.Types.ObjectId;
  userName: string;
  name: string;
  email: string;
  primaryRole?: string;
  roles?: Array<any>;
  isConnectGoStaff?: boolean;
}

// Interface for OAuth code request
interface OAuthCodeRequest {
  code: string;
  redirect_uri: string;
}

/**
 * Handle Google OAuth callback
 * @route POST /api/v1/auth/google/callback
 * @access Public
 */
export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      const error = new Error("Authentication failed") as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // User is already set by passport middleware
    const user = req.user;

    // Create token
    const token = jwt.sign(
      { userId: (user as AuthUser)._id.toString() },
      JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
      }
    );

    // Get the redirect URL from the state parameter
    let redirectUrl = "http://localhost:3000/dashboard"; // Default frontend URL
    
    try {
      if (req.query.state) {
        // State was encoded in Base64
        const decodedState = Buffer.from(req.query.state as string, 'base64').toString();
        // If it's a valid URL, use it
        if (decodedState.startsWith('http')) {
          redirectUrl = decodedState;
        }
      }
    } catch (error) {
      console.error("Error decoding state:", error);
    }

    // Prepare user data to include in redirect
    const userData = {
      _id: user._id,
      userName: user.userName,
      name: user.name,
      email: user.email,
      primaryRole: user.primaryRole,
      roles: user.roles,
      isConnectGoStaff: user.isConnectGoStaff
    };

    // Include token and user in the redirect URL
    const finalRedirectUrl = new URL(redirectUrl);
    finalRedirectUrl.searchParams.append('token', token);
    finalRedirectUrl.searchParams.append('userData', JSON.stringify(userData));

    // Redirect to frontend with token and user data
    return res.redirect(finalRedirectUrl.toString());
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Microsoft OAuth callback
 * @route POST /api/v1/auth/microsoft/callback
 * @access Public
 */
export const microsoftCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      const error = new Error("Authentication failed") as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // User is already set by passport middleware
    const user = req.user;

    // Create token
    const token = jwt.sign(
      { userId: (user as AuthUser)._id.toString() },
      JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
      }
    );

    // Get the redirect URL from the state parameter
    let redirectUrl = "http://localhost:3000/dashboard"; // Default frontend URL
    
    try {
      if (req.query.state) {
        // State was encoded in Base64
        const decodedState = Buffer.from(req.query.state as string, 'base64').toString();
        // If it's a valid URL, use it
        if (decodedState.startsWith('http')) {
          redirectUrl = decodedState;
        }
      }
    } catch (error) {
      console.error("Error decoding state:", error);
    }

    // Prepare user data to include in redirect
    const userData = {
      _id: user._id,
      userName: user.userName,
      name: user.name,
      email: user.email,
      primaryRole: user.primaryRole,
      roles: user.roles,
      isConnectGoStaff: user.isConnectGoStaff
    };

    // Include token and user in the redirect URL
    const finalRedirectUrl = new URL(redirectUrl);
    finalRedirectUrl.searchParams.append('token', token);
    finalRedirectUrl.searchParams.append('userData', JSON.stringify(userData));

    // Redirect to frontend with token and user data
    return res.redirect(finalRedirectUrl.toString());
  } catch (error) {
    next(error);
  }
};

/**
 * Process OAuth code
 * @route POST /api/v1/auth/:provider/callback
 * @access Public
 */
export const processOAuthCode = async (
  req: Request<{ provider: string }, any, OAuthCodeRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code, redirect_uri } = req.body;
    const provider = req.params.provider;

    if (!code) {
      const error = new Error("Authentication code is required") as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // This would normally exchange the code for a token with the OAuth provider
    // For this implementation, we're assuming the passport middleware handled this
    // and the user is already authenticated

    // In a real implementation, you would:
    // 1. Exchange the code for a token with the OAuth provider
    // 2. Use the token to get user profile information
    // 3. Find or create a user based on the profile
    // 4. Generate a JWT token for the user

    // For now, we'll just return a placeholder response
    res.status(200).json({
      success: true,
      message: `${provider} authentication successful`,
      data: {
        // You would normally return a real token and user data here
        token: "sample_token",
        user: {
          // Sample user data
          _id: "sample_id",
          userName: "sampleuser",
          name: "Sample User",
          email: "sample@example.com"
        }
      }
    });
  } catch (error) {
    next(error);
  }
};