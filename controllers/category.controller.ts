// controllers/category.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Category from "../models/category.model";
import { CustomError } from "../middlewares/error.middleware";
import Theme from "../models/theme.model";

/**
 * Create a new category
 * @route POST /api/v1/categories
 * @access Private (ConnectGo staff only)
 */
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { name, description, inclusion } = req.body;
    
    // Add creator from authenticated user
    const creator = req.user._id;
    
    // Create the new category
    const newCategories = await Category.create([{
      name,
      description,
      inclusion,
      creator,
      status: req.body.status || 'draft'
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategories[0]
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};


/**
 * Get all categories with pagination and filtering
 * @route GET /api/v1/categories
 * @access Private
 */
export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = Category.find({ archived: { $ne: true } });

    // Filter by status if provided
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Copy req.query to avoid modifying the original
    const reqQuery = { ...req.query };

    // Fields to exclude from filtering
    const removeFields = ['select', 'sort', 'page', 'limit', 'populate'];
    removeFields.forEach(param => delete reqQuery[param]);

    // Create filtering based on query parameters
    let queryStr = JSON.stringify(reqQuery);
    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    
    // Apply filtering
    query = query.find(JSON.parse(queryStr));

    // Select specific fields
    if (req.query.select) {
      const fields = (req.query.select as string).split(',').join(' ');
      query = query.select(fields);
    }

    // Sort results
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt'); // Default sort by newest
    }

    // Handle population of related fields
    if (req.query.populate === 'creator') {
      query = query.populate({
        path: 'creator',
        select: 'name email userName'
      });
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Category.countDocuments({ archived: { $ne: true } });

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const categories = await query;

    // Pagination result
    const pagination: {
      next?: { page: number; limit: number };
      prev?: { page: number; limit: number };
    } = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: categories.length,
      pagination,
      total,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single category by ID
 * @route GET /api/v1/categories/:id
 * @access Private
 */
export const getCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = req.params.id;

    const query = Category.findById(categoryId);
    
    // Populate creator field if requested
    if (req.query.populate === 'creator') {
      query.populate({
        path: 'creator',
        select: 'name email userName'
      });
    }

    const category = await query;

    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if category is archived
    if (category.archived) {
      const error = new Error('This category has been archived') as CustomError;
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
      const customError = new Error('Invalid category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update category by ID
 * @route PUT /api/v1/categories/:id
 * @access Private (ConnectGo staff only)
 */
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const categoryId = req.params.id;
    const { name, description, status, inclusion } = req.body;

    // Find the category first to check if it exists and is not archived
    const category = await Category.findById(categoryId);

    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (category.archived) {
      const error = new Error('Cannot update an archived category') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Update the category
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name, description, status, inclusion },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


/**
 * Archive category by ID (soft delete)
 * @route DELETE /api/v1/categories/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const categoryId = req.params.id;

    // Find the category first to check if it exists
    const category = await Category.findById(categoryId);

    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (category.archived) {
      const error = new Error('Category is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the category (soft delete)
    const archivedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Category archived successfully',
      data: archivedCategory
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived category by ID
 * @route POST /api/v1/categories/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const categoryId = req.params.id;

    // Find the category first to check if it exists and is archived
    const category = await Category.findById(categoryId);

    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!category.archived) {
      const error = new Error('Category is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the category
    const restoredCategory = await Category.findByIdAndUpdate(
      categoryId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Category restored successfully',
      data: restoredCategory
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Permanently delete category by ID
 * @route DELETE /api/v1/categories/:id/permanent
 * @access Private (ConnectGo staff only)
 */
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can permanently delete categories') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const categoryId = req.params.id;

    // Find the category first to check if it exists
    const category = await Category.findById(categoryId);

    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Permanently delete the category
    await Category.findByIdAndDelete(categoryId);

    res.status(200).json({
      success: true,
      message: 'Category permanently deleted',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get themes by category ID
 * @route GET /api/v1/categories/:id/themes
 * @access Private
 */
export const getCategoryThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = req.params.id;

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      const error = new Error('Category not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Get all themes for this category
    const themes = await Theme.find({ 
      categories: categoryId,
      archived: { $ne: true }
    }).sort('name');

    res.status(200).json({
      success: true,
      count: themes.length,
      data: themes
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid category ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};