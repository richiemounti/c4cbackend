// services/organization.service.ts
import mongoose from "mongoose";
import Organization from "../models/organization.model";
import User from "../models/user.model";
import { CustomError } from "../middlewares/error.middleware";

/**
 * Create a new organization for a manager
 */
export const createOrganizationForManager = async (
  userId: string,
  organizationData: {
    name: string;
    country: string;
    city: string;
  },
  session?: mongoose.ClientSession
): Promise<any> => {
  try {
    // Find the user
    const user = await User.findById(userId).session(session || null);
    
    if (!user) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if user is a manager
    if (user.primaryRole !== 'manager') {
      const error = new Error('Only managers can create organizations') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    // Create the organization
    const creationOptions = session ? { session } : {};
    const organizations = await Organization.create(
      [{
        ...organizationData,
        creator: userId
      }],
      creationOptions
    );
    
    const organization = organizations[0];
    
    // Update the user's role to include the organization
    const managerRoleIndex = user.roles.findIndex((r: any) => r.role === 'manager');
    
    if (managerRoleIndex !== -1) {
      // Update existing manager role
      user.roles[managerRoleIndex].organization = organization._id;
    } else {
      // Add manager role with organization
      user.roles.push({
        role: 'manager',
        organization: organization._id
      });
    }
    
    // Save the user
    await user.save(session ? { session } : {});
    
    return organization;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all organizations accessible by a user
 */
export const getUserOrganizations = async (userId: string): Promise<any[]> => {
  try {
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // For ConnectGo staff, return all organizations
    if (user.isConnectGoStaff) {
      return Organization.find({ archived: { $ne: true } });
    }
    
    // Get organization IDs from user roles
    const organizationIds = user.roles
      .filter((r: any) => r.organization)
      .map((r: any) => r.organization);
    
    // Return organizations that match these IDs
    return Organization.find({
      _id: { $in: organizationIds },
      archived: { $ne: true }
    });
  } catch (error) {
    throw error;
  }
};