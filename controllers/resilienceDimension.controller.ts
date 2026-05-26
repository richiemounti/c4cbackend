// controllers/resilienceDimension.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import ResilienceDimension from "../models/resilienceDimension.model";
import { CustomError } from "../middlewares/error.middleware";

/**
 * Create a new resilience dimension
 * @route POST /api/v1/resilience-dimensions
 * @access Private (ConnectGo staff only)
 */
export const createResilienceDimension = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create resilience dimensions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { 
      code, 
      name, 
      description, 
      capacityTypes, 
      category,
      linkToPvModel,
      resilienceIndexCriteria,
      indicatorExamples
    } = req.body;
    
    // Check if resilience dimension with this code already exists
    const existingDimension = await ResilienceDimension.findOne({ code });
    if (existingDimension) {
      const error = new Error(`Resilience dimension with code ${code} already exists`) as CustomError;
      error.statusCode = 409;
      throw error;
    }
    
    // Create the new resilience dimension
    const newDimension = await ResilienceDimension.create({
      code,
      name,
      description,
      capacityTypes,
      category,
      linkToPvModel,
      resilienceIndexCriteria,
      indicatorExamples,
      creator: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Resilience dimension created successfully',
      data: newDimension
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all resilience dimensions
 * @route GET /api/v1/resilience-dimensions
 * @access Public
 */
export const getResilienceDimensions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = ResilienceDimension.find({ archived: { $ne: true } });

    // Filter by status if provided
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Filter by capacity type if provided
    if (req.query.capacityType) {
      query = query.find({ capacityTypes: req.query.capacityType });
    }

    // Filter by category if provided (now supports custom categories)
    if (req.query.category) {
      query = query.find({ category: { $regex: req.query.category, $options: 'i' } });
    }

    // Search functionality for flexible category searching
    if (req.query.search) {
      query = query.find({
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { category: { $regex: req.query.search, $options: 'i' } },
          { code: { $regex: req.query.search, $options: 'i' } }
        ]
      });
    }

    // Apply sorting
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('code'); // Default sort by code
    }

    // Execute query
    const dimensions = await query;

    res.status(200).json({
      success: true,
      count: dimensions.length,
      data: dimensions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single resilience dimension by ID
 * @route GET /api/v1/resilience-dimensions/:id
 * @access Public
 */
export const getResilienceDimension = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dimensionId = req.params.id;

    const dimension = await ResilienceDimension.findById(dimensionId);

    if (!dimension) {
      const error = new Error('Resilience dimension not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if dimension is archived
    if (dimension.archived) {
      const error = new Error('This resilience dimension has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    res.status(200).json({
      success: true,
      data: dimension
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid resilience dimension ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update resilience dimension by ID
 * @route PUT /api/v1/resilience-dimensions/:id
 * @access Private (ConnectGo staff only)
 */
export const updateResilienceDimension = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update resilience dimensions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const dimensionId = req.params.id;
    const { 
      name, 
      description, 
      capacityTypes, 
      category, 
      linkToPvModel,
      resilienceIndexCriteria,
      indicatorExamples,
      status 
    } = req.body;

    // Find the dimension first to check if it exists and is not archived
    const dimension = await ResilienceDimension.findById(dimensionId);

    if (!dimension) {
      const error = new Error('Resilience dimension not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (dimension.archived) {
      const error = new Error('Cannot update an archived resilience dimension') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Update the dimension
    const updatedDimension = await ResilienceDimension.findByIdAndUpdate(
      dimensionId,
      { 
        name, 
        description, 
        capacityTypes, 
        category, 
        linkToPvModel,
        resilienceIndexCriteria,
        indicatorExamples,
        status 
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Resilience dimension updated successfully',
      data: updatedDimension
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid resilience dimension ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get unique categories for filtering purposes
 * @route GET /api/v1/resilience-dimensions/categories
 * @access Public
 */
export const getResilienceCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get all unique categories from non-archived dimensions
    const categories = await ResilienceDimension.distinct('category', { 
      archived: { $ne: true },
      category: { $nin: [null, ''] }
    });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories.sort()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive resilience dimension by ID (soft delete)
 * @route DELETE /api/v1/resilience-dimensions/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveResilienceDimension = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive resilience dimensions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const dimensionId = req.params.id;

    // Find the dimension first to check if it exists
    const dimension = await ResilienceDimension.findById(dimensionId);

    if (!dimension) {
      const error = new Error('Resilience dimension not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (dimension.archived) {
      const error = new Error('Resilience dimension is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the dimension (soft delete)
    const archivedDimension = await ResilienceDimension.findByIdAndUpdate(
      dimensionId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Resilience dimension archived successfully',
      data: archivedDimension
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid resilience dimension ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived resilience dimension by ID
 * @route POST /api/v1/resilience-dimensions/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreResilienceDimension = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore resilience dimensions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const dimensionId = req.params.id;

    // Find the dimension first to check if it exists and is archived
    const dimension = await ResilienceDimension.findById(dimensionId);

    if (!dimension) {
      const error = new Error('Resilience dimension not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!dimension.archived) {
      const error = new Error('Resilience dimension is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the dimension
    const restoredDimension = await ResilienceDimension.findByIdAndUpdate(
      dimensionId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Resilience dimension restored successfully',
      data: restoredDimension
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid resilience dimension ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

export default {
  createResilienceDimension,
  getResilienceDimensions,
  getResilienceDimension,
  updateResilienceDimension,
  getResilienceCategories,
  archiveResilienceDimension,
  restoreResilienceDimension
};