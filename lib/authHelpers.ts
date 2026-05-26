// lib/authHelpers.ts
import { Request } from 'express';
import mongoose from 'mongoose';
import { IUserDocument } from '../models/user.model';

// Create a TypeScript-friendly interface for the user with _id explicitly defined
interface AuthUser extends IUserDocument {
  _id: mongoose.Types.ObjectId;
}

/**
 * Helper function to check if a user has access to a project
 */
export function userHasProjectAccess(req: Request, projectId: mongoose.Types.ObjectId | string): boolean {
  // If no user, return false
  if (!req.user) return false;
  
  try {
    // Type assertion with our explicit interface
    const user = req.user as AuthUser;
    
    // If user is ConnectGo staff, grant access
    if (user.isConnectGoStaff) return true;
    
    // Convert string to ObjectId if needed
    const projectObjectId = typeof projectId === 'string' 
      ? new mongoose.Types.ObjectId(projectId)
      : projectId;
      
    return user.hasProjectAccess(projectObjectId);
  } catch (error) {
    console.error('Error checking project access:', error);
    return false;
  }
}

/**
 * Helper function to check if a user is the creator or has project access
 */
export function isCreatorOrHasAccess(
  req: Request, 
  creatorId: mongoose.Types.ObjectId | string,
  projectId: mongoose.Types.ObjectId | string
): boolean {
  if (!req.user) return false;
  
  try {
    // Type assertion with our explicit interface
    const user = req.user as AuthUser;
    
    // Convert IDs to strings for comparison
    const creatorIdStr = creatorId.toString();
    const userIdStr = user._id.toString();
    
    const isCreator = userIdStr === creatorIdStr;
    const hasProjectAccess = userHasProjectAccess(req, projectId);
    const isConnectGoStaff = user.isConnectGoStaff;
    
    return isCreator || hasProjectAccess || isConnectGoStaff;
  } catch (error) {
    console.error('Error checking creator/access:', error);
    return false;
  }
}

/**
 * Type guard to check if a user is authenticated
 */
export function isUserAuthenticated(req: Request): req is Request & { user: AuthUser } {
  return req.user !== undefined;
}