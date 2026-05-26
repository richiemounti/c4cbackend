// controllers/esgCategory.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import ESGCategory from "../models/esgCategory.model";
import { CustomError } from "../middlewares/error.middleware";

/**
 * Create a new ESG category
 * @route POST /api/v1/esg-categories
 * @access Private (ConnectGo staff only)
 */
export const createESGCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create ESG categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { code, name, description, type } = req.body;
    
    // Check if ESG category with this code already exists
    const existingCategory = await ESGCategory.findOne({ code });
    if (existingCategory) {
      const error = new Error(`ESG category with code ${code} already exists`) as CustomError;
      error.statusCode = 409;
      throw error;
    }
    
    // Create the new ESG category
    const newCategory = await ESGCategory.create({
      code,
      name,
      description,
      type,
      creator: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'ESG category created successfully',
      data: newCategory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all ESG categories
 * @route GET /api/v1/esg-categories
 * @access Public
 */
export const getESGCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = ESGCategory.find({ archived: { $ne: true } });

    // Filter by status if provided
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Filter by type if provided
    if (req.query.type) {
      query = query.find({ type: req.query.type });
    }

    // Apply sorting
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('code'); // Default sort by code
    }

    // Execute query
    const categories = await query;

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single ESG category by ID
 * @route GET /api/v1/esg-categories/:id
 * @access Public
 */
export const getESGCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = req.params.id;

    const category = await ESGCategory.findById(categoryId);

    if (!category) {
      const error = new Error('ESG category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if category is archived
    if (category.archived) {
      const error = new Error('This ESG category has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid ESG category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update ESG category by ID
 * @route PUT /api/v1/esg-categories/:id
 * @access Private (ConnectGo staff only)
 */
export const updateESGCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update ESG categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const categoryId = req.params.id;
    const { name, description, type, status } = req.body;

    // Find the category first to check if it exists and is not archived
    const category = await ESGCategory.findById(categoryId);

    if (!category) {
      const error = new Error('ESG category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (category.archived) {
      const error = new Error('Cannot update an archived ESG category') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Update the category
    const updatedCategory = await ESGCategory.findByIdAndUpdate(
      categoryId,
      { name, description, type, status },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'ESG category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid ESG category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive ESG category by ID (soft delete)
 * @route DELETE /api/v1/esg-categories/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveESGCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive ESG categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const categoryId = req.params.id;

    // Find the category first to check if it exists
    const category = await ESGCategory.findById(categoryId);

    if (!category) {
      const error = new Error('ESG category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (category.archived) {
      const error = new Error('ESG category is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the category (soft delete)
    const archivedCategory = await ESGCategory.findByIdAndUpdate(
      categoryId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'ESG category archived successfully',
      data: archivedCategory
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid ESG category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived ESG category by ID
 * @route POST /api/v1/esg-categories/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreESGCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore ESG categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const categoryId = req.params.id;

    // Find the category first to check if it exists and is archived
    const category = await ESGCategory.findById(categoryId);

    if (!category) {
      const error = new Error('ESG category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!category.archived) {
      const error = new Error('ESG category is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the category
    const restoredCategory = await ESGCategory.findByIdAndUpdate(
      categoryId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'ESG category restored successfully',
      data: restoredCategory
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid ESG category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

export default {
  createESGCategory,
  getESGCategories,
  getESGCategory,
  updateESGCategory,
  archiveESGCategory,
  restoreESGCategory
};