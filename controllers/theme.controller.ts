// controllers/theme.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Theme from "../models/theme.model";
import { CustomError } from "../middlewares/error.middleware";

/**
 * Create a new theme
 * @route POST /api/v1/themes
 * @access Private (ConnectGo staff only)
 */
export const createTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await Theme.db.startSession();
  session.startTransaction();

  try {
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create themes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { name, description, theoryOfChangeStage } = req.body;
    const creator = req.user._id;

    const newThemes = await Theme.create([{
      name,
      description,
      theoryOfChangeStage: theoryOfChangeStage || null,
      creator,
      status: req.body.status || 'draft'
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Theme created successfully',
      data: newThemes[0]
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};


/**
 * Get all themes with pagination and filtering
 * @route GET /api/v1/themes
 * @access Private
 */
export const getThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = Theme.find({ archived: { $ne: true } });

    // Handle search parameter for text search
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      query = query.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      });
    }

    // Filter by status if provided
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Filter by theory of change stage if provided
    if (req.query.theoryOfChangeStage) {
      const stage = req.query.theoryOfChangeStage as string;
      query = query.find({
        theoryOfChangeStage: { $in: [stage, 'Both'] }
      });
    }

    // Copy req.query to avoid modifying the original
    const reqQuery = { ...req.query };

    // Add 'theoryOfChangeStage' to removeFields
    const removeFields = ['select', 'sort', 'page', 'limit', 'populate', 'status', 'search', 'theoryOfChangeStage'];
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
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query = query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Build count query based on the filters
    let countQuery = Theme.find({ archived: { $ne: true } });
    
    // Apply search to count query
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      countQuery = countQuery.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      });
    }
    
    if (req.query.status) {
      countQuery = countQuery.find({ status: req.query.status });
    }

    // Apply theoryOfChangeStage filter to count query
    if (req.query.theoryOfChangeStage) {
      const stage = req.query.theoryOfChangeStage as string;
      countQuery = countQuery.find({
        theoryOfChangeStage: { $in: [stage, 'Both'] }
      });
    }
    
    const total = await countQuery.countDocuments();

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const themes = await query;

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
      count: themes.length,
      pagination,
      total,
      data: themes
    });
  } catch (error) {
    next(error);
  }
};



/**
 * Get single theme by ID
 * @route GET /api/v1/themes/:id
 * @access Private
 */
export const getTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const themeId = req.params.id;

    const query = Theme.findById(themeId);
    
    // Populate related fields if requested
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }
    }

    const theme = await query;

    if (!theme) {
      const error = new Error('Theme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if theme is archived
    if (theme.archived) {
      const error = new Error('This theme has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    res.status(200).json({
      success: true,
      data: theme
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid theme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update theme by ID
 * @route PUT /api/v1/themes/:id
 * @access Private (ConnectGo staff only)
 */
export const updateTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update themes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const themeId = req.params.id;
    const { name, description, status, theoryOfChangeStage } = req.body;

    // Find the theme first to check if it exists and is not archived
    const theme = await Theme.findById(themeId);

    if (!theme) {
      const error = new Error('Theme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (theme.archived) {
      const error = new Error('Cannot update an archived theme') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (theoryOfChangeStage !== undefined) updateData.theoryOfChangeStage = theoryOfChangeStage;

    // Update the theme
    const updatedTheme = await Theme.findByIdAndUpdate(
      themeId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Theme updated successfully',
      data: updatedTheme
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid theme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


/**
 * Archive theme by ID (soft delete)
 * @route DELETE /api/v1/themes/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive themes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const themeId = req.params.id;

    // Find the theme first to check if it exists
    const theme = await Theme.findById(themeId);

    if (!theme) {
      const error = new Error('Theme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (theme.archived) {
      const error = new Error('Theme is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the theme (soft delete)
    const archivedTheme = await Theme.findByIdAndUpdate(
      themeId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Theme archived successfully',
      data: archivedTheme
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid theme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived theme by ID
 * @route POST /api/v1/themes/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore themes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const themeId = req.params.id;

    // Find the theme first to check if it exists and is archived
    const theme = await Theme.findById(themeId);

    if (!theme) {
      const error = new Error('Theme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!theme.archived) {
      const error = new Error('Theme is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the theme
    const restoredTheme = await Theme.findByIdAndUpdate(
      themeId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Theme restored successfully',
      data: restoredTheme
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid theme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Permanently delete theme by ID
 * @route DELETE /api/v1/themes/:id/permanent
 * @access Private (ConnectGo staff only)
 */
export const deleteTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can permanently delete themes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const themeId = req.params.id;

    // Find the theme first to check if it exists
    const theme = await Theme.findById(themeId);

    if (!theme) {
      const error = new Error('Theme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Permanently delete the theme
    await Theme.findByIdAndDelete(themeId);

    res.status(200).json({
      success: true,
      message: 'Theme permanently deleted',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid theme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get subthemes by theme ID
 * @route GET /api/v1/themes/:id/subthemes
 * @access Private
 */
export const getThemeSubThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const themeId = req.params.id;

    // Check if theme exists
    const theme = await Theme.findById(themeId);
    if (!theme) {
      const error = new Error('Theme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Get all subthemes for this theme
    const SubTheme = mongoose.model('SubTheme');
    const subThemes = await SubTheme.find({ 
      theme: themeId,
      archived: { $ne: true }
    }).sort('name');

    res.status(200).json({
      success: true,
      count: subThemes.length,
      data: subThemes
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid theme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};