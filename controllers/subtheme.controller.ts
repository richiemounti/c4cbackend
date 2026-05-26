// controllers/subtheme.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import SubTheme from "../models/subtheme.model";
import Theme from "../models/theme.model";
import SDG from "../models/sdg.model";
import ESGCategory from "../models/esgCategory.model";
import ResilienceDimension from "../models/resilienceDimension.model";
import Standard from "../models/standard.model";
import Indicator from "../models/indicator.model";
import { CustomError } from "../middlewares/error.middleware";

/**
 * Validate that all provided tag IDs exist and are not archived
 */
const validateTags = async (
  indicatorTags?: string[],
  sdgTags?: string[], 
  resilienceTags?: string[], 
  esgTags?: string[], 
  standardTags?: string[]
) => {
  // Validate Indicator tags
  if (indicatorTags && indicatorTags.length > 0) {
    const indicatorCount = await Indicator.countDocuments({
      _id: { $in: indicatorTags },
      archived: { $ne: true },
      status: 'active'
    });
    if (indicatorCount !== indicatorTags.length) {
      throw new Error('One or more Indicator tags not found or are inactive');
    }
  }

  // Validate SDG tags
  if (sdgTags && sdgTags.length > 0) {
    const sdgCount = await SDG.countDocuments({
      _id: { $in: sdgTags },
      archived: { $ne: true },
      status: 'active'
    });
    if (sdgCount !== sdgTags.length) {
      throw new Error('One or more SDG tags not found or are inactive');
    }
  }

  // Validate Resilience tags
  if (resilienceTags && resilienceTags.length > 0) {
    const resilienceCount = await ResilienceDimension.countDocuments({
      _id: { $in: resilienceTags },
      archived: { $ne: true },
      status: 'active'
    });
    if (resilienceCount !== resilienceTags.length) {
      throw new Error('One or more resilience dimension tags not found or are inactive');
    }
  }

  // Validate ESG tags
  if (esgTags && esgTags.length > 0) {
    const esgCount = await ESGCategory.countDocuments({
      _id: { $in: esgTags },
      archived: { $ne: true },
      status: 'active'
    });
    if (esgCount !== esgTags.length) {
      throw new Error('One or more ESG category tags not found or are inactive');
    }
  }

  // Validate Standard tags
  if (standardTags && standardTags.length > 0) {
    const standardCount = await Standard.countDocuments({
      _id: { $in: standardTags },
      archived: { $ne: true },
      status: 'active'
    });
    if (standardCount !== standardTags.length) {
      throw new Error('One or more standard tags not found or are inactive');
    }
  }
};

/**
 * Create a new subtheme
 * @route POST /api/v1/subthemes
 * @access Private (ConnectGo staff only)
 */
export const createSubTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create subthemes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { 
      name, 
      description, 
      theme,
      theoryOfChangeStage,
      indicatorTags, 
      sdgTags, 
      resilienceTags, 
      esgTags, 
      standardTags,
      status 
    } = req.body;
    
    // Check if the theme exists
    const themeExists = await Theme.findById(theme);
    if (!themeExists) {
      const error = new Error('Theme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if theme is archived
    if (themeExists.archived) {
      const error = new Error('Cannot create a subtheme for an archived theme') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Add validation after theme validation:
    if (!theoryOfChangeStage) {
      const error = new Error('Theory of Change stage is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // ── NEW: validate stage compatibility with parent theme ──────────────────
    if (
      themeExists.theoryOfChangeStage !== 'Both' &&
      themeExists.theoryOfChangeStage !== theoryOfChangeStage
    ) {
      const error = new Error(
        `This theme is scoped to "${themeExists.theoryOfChangeStage}". ` +
        `A subtheme cannot be assigned to "${theoryOfChangeStage}".`
      ) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate all provided tags
    await validateTags(indicatorTags, sdgTags, resilienceTags, esgTags, standardTags);
    
    // Add creator from authenticated user
    const creator = req.user._id;
    
    // Create the new subtheme
    const newSubThemes = await SubTheme.create([{
      name,
      description,
      theme,
      theoryOfChangeStage,
      indicatorTags: indicatorTags || [],
      sdgTags: sdgTags || [],
      resilienceTags: resilienceTags || [],
      esgTags: esgTags || [],
      standardTags: standardTags || [],
      creator,
      status: status || 'draft'
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Populate the response with tag details
    const populatedSubTheme = await SubTheme.findById(newSubThemes[0]._id)
      .populate('theme', 'name')
      .populate('indicatorTags', 'name')
      .populate('sdgTags', 'code name')
      .populate('resilienceTags', 'code name')
      .populate('esgTags', 'code name')
      .populate('standardTags', 'code name')
      .populate('creator', 'name email userName');

    res.status(201).json({
      success: true,
      message: 'SubTheme created successfully',
      data: populatedSubTheme
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all subthemes with pagination and filtering
 * @route GET /api/v1/subthemes
 * @access Private
 */
export const getSubThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = SubTheme.find({ archived: { $ne: true } });

    // ADD THIS: Handle search parameter for text search
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      query = query.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      });
    }

    // Filter by theme if provided
    if (req.query.theme) {
      query = query.find({ theme: req.query.theme });
    }

    // Filter by status if provided
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Filter by Indicator tags if provided
    if (req.query.indicatorTags) {
      const indicatorTagIds = (req.query.indicatorTags as string).split(',');
      query = query.find({ indicatorTags: { $in: indicatorTagIds }});
    }

    // Filter by SDG tags if provided
    if (req.query.sdgTags) {
      const sdgTagIds = (req.query.sdgTags as string).split(',');
      query = query.find({ sdgTags: { $in: sdgTagIds } });
    }

    // Filter by ESG tags if provided
    if (req.query.esgTags) {
      const esgTagIds = (req.query.esgTags as string).split(',');
      query = query.find({ esgTags: { $in: esgTagIds } });
    }

    // Filter by resilience tags if provided
    if (req.query.resilienceTags) {
      const resilienceTagIds = (req.query.resilienceTags as string).split(',');
      query = query.find({ resilienceTags: { $in: resilienceTagIds } });
    }

    // Filter by standard tags if provided
    if (req.query.standardTags) {
      const standardTagIds = (req.query.standardTags as string).split(',');
      query = query.find({ standardTags: { $in: standardTagIds } });
    }

    // Filter by theory of change stage if provided
    if (req.query.theoryOfChangeStage) {
      const stage = req.query.theoryOfChangeStage as string;
      query = query.find({ theoryOfChangeStage: { $in: [stage, 'Both'] } });
    }

    // Copy req.query to avoid modifying the original
    const reqQuery = { ...req.query };

    // MODIFY THIS: Add 'search' to removeFields
    const removeFields = [
      'select', 'sort', 'page', 'limit', 'populate', 
      'theme', 'status', 'theoryOfChangeStage', 'indicatorTags', 'sdgTags', 'esgTags', 'resilienceTags', 'standardTags',
      'search'  // ADD THIS
    ];
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
      
      if (populateFields.includes('theme')) {
        query = query.populate({
          path: 'theme',
          select: 'name description'
        });
      }

      if (populateFields.includes('tags') || populateFields.includes('all')) {
        query = query
          .populate('indicatorTags', 'name')
          .populate('sdgTags', 'code name')
          .populate('resilienceTags', 'code name')
          .populate('esgTags', 'code name')
          .populate('standardTags', 'code name');
      }
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Build count query based on the filters
    let countQuery = SubTheme.find({ archived: { $ne: true } });
    
    // ADD THIS: Apply search to count query
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      countQuery = countQuery.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      });
    }
    
    if (req.query.theme) {
      countQuery = countQuery.find({ theme: req.query.theme });
    }
    if (req.query.status) {
      countQuery = countQuery.find({ status: req.query.status });
    }
    if (req.query.theoryOfChangeStage) {
      const stage = req.query.theoryOfChangeStage as string;
      countQuery = countQuery.find({ theoryOfChangeStage: { $in: [stage, 'Both'] } });
    }
    
    const total = await countQuery.countDocuments();

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const subThemes = await query;

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
      count: subThemes.length,
      pagination,
      total,
      data: subThemes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single subtheme by ID
 * @route GET /api/v1/subthemes/:id
 * @access Private
 */
export const getSubTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const subThemeId = req.params.id;

    const query = SubTheme.findById(subThemeId);
    
    // Populate related fields if requested
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }
      
      if (populateFields.includes('theme')) {
        query.populate({
          path: 'theme',
          select: 'name description'
        });
      }

      if (populateFields.includes('tags') || populateFields.includes('all')) {
        query
          .populate('indicatorTags', 'name description')
          .populate('sdgTags', 'code name description')
          .populate('resilienceTags', 'code name description')
          .populate('esgTags', 'code name description type')
          .populate('standardTags', 'code name description issuingBody');
      }
    }

    const subTheme = await query;

    if (!subTheme) {
      const error = new Error('SubTheme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if subTheme is archived
    if (subTheme.archived) {
      const error = new Error('This subtheme has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    res.status(200).json({
      success: true,
      data: subTheme
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid subtheme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update subtheme by ID
 * @route PUT /api/v1/subthemes/:id
 * @access Private (ConnectGo staff only)
 */
export const updateSubTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update subthemes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const subThemeId = req.params.id;
    const { 
      name, 
      description, 
      status, 
      theme,
      theoryOfChangeStage, 
      indicatorTags,
      sdgTags, 
      resilienceTags, 
      esgTags, 
      standardTags 
    } = req.body;

    // Find the subtheme first to check if it exists and is not archived
    const subTheme = await SubTheme.findById(subThemeId);

    if (!subTheme) {
      const error = new Error('SubTheme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (subTheme.archived) {
      const error = new Error('Cannot update an archived subtheme') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If theme is being changed, check if it exists and is not archived
    if (theme && theme !== subTheme.theme.toString()) {
      const themeExists = await Theme.findById(theme);
      if (!themeExists) {
        const error = new Error('Theme not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      if (themeExists.archived) {
        const error = new Error('Cannot update subtheme to an archived theme') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // ── NEW: validate the new theme's stage against the subtheme's stage ────
      // Use the incoming theoryOfChangeStage if being updated, otherwise the existing one
      const effectiveStage = theoryOfChangeStage ?? subTheme.theoryOfChangeStage;
      if (
        themeExists.theoryOfChangeStage !== 'Both' &&
        themeExists.theoryOfChangeStage !== effectiveStage
      ) {
        const error = new Error(
          `The selected theme is scoped to "${themeExists.theoryOfChangeStage}". ` +
          `It cannot hold a subtheme assigned to "${effectiveStage}".`
        ) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // ── NEW: if only theoryOfChangeStage is changing (theme stays the same) ──
    if (theoryOfChangeStage && !theme) {
      const parentTheme = await Theme.findById(subTheme.theme);
      if (
        parentTheme &&
        parentTheme.theoryOfChangeStage !== 'Both' &&
        parentTheme.theoryOfChangeStage !== theoryOfChangeStage
      ) {
        const error = new Error(
          `The parent theme is scoped to "${parentTheme.theoryOfChangeStage}". ` +
          `Cannot reassign this subtheme to "${theoryOfChangeStage}".`
        ) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate all provided tags
    await validateTags(indicatorTags, sdgTags, resilienceTags, esgTags, standardTags);

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (theme !== undefined) updateData.theme = theme;
    // Add theoryOfChangeStage to the updateData:
    if (theoryOfChangeStage !== undefined) updateData.theoryOfChangeStage = theoryOfChangeStage;
    if (indicatorTags !== undefined) updateData.indicatorTags = indicatorTags;
    if (sdgTags !== undefined) updateData.sdgTags = sdgTags;
    if (resilienceTags !== undefined) updateData.resilienceTags = resilienceTags;
    if (esgTags !== undefined) updateData.esgTags = esgTags;
    if (standardTags !== undefined) updateData.standardTags = standardTags;

    // Update the subtheme
    const updatedSubTheme = await SubTheme.findByIdAndUpdate(
      subThemeId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('theme', 'name')
      .populate('indicatorTags', 'name')
      .populate('sdgTags', 'code name')
      .populate('resilienceTags', 'code name')
      .populate('esgTags', 'code name')
      .populate('standardTags', 'code name')
      .populate('creator', 'name email userName');

    res.status(200).json({
      success: true,
      message: 'SubTheme updated successfully',
      data: updatedSubTheme
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid subtheme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive subtheme by ID (soft delete)
 * @route DELETE /api/v1/subthemes/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveSubTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive subthemes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const subThemeId = req.params.id;

    // Find the subtheme first to check if it exists
    const subTheme = await SubTheme.findById(subThemeId);

    if (!subTheme) {
      const error = new Error('SubTheme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (subTheme.archived) {
      const error = new Error('SubTheme is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the subtheme (soft delete)
    const archivedSubTheme = await SubTheme.findByIdAndUpdate(
      subThemeId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'SubTheme archived successfully',
      data: archivedSubTheme
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid subtheme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived subtheme by ID
 * @route POST /api/v1/subthemes/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreSubTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore subthemes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const subThemeId = req.params.id;

    // Find the subtheme first to check if it exists and is archived
    const subTheme = await SubTheme.findById(subThemeId);

    if (!subTheme) {
      const error = new Error('SubTheme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!subTheme.archived) {
      const error = new Error('SubTheme is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if the theme is archived
    const theme = await Theme.findById(subTheme.theme);
    if (theme?.archived) {
      const error = new Error('Cannot restore a subtheme under an archived theme') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the subtheme
    const restoredSubTheme = await SubTheme.findByIdAndUpdate(
      subThemeId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'SubTheme restored successfully',
      data: restoredSubTheme
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid subtheme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Permanently delete subtheme by ID
 * @route DELETE /api/v1/subthemes/:id/permanent
 * @access Private (ConnectGo staff only)
 */
export const deleteSubTheme = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can permanently delete subthemes') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const subThemeId = req.params.id;

    // Find the subtheme first to check if it exists
    const subTheme = await SubTheme.findById(subThemeId);

    if (!subTheme) {
      const error = new Error('SubTheme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Permanently delete the subtheme
    await SubTheme.findByIdAndDelete(subThemeId);

    res.status(200).json({
      success: true,
      message: 'SubTheme permanently deleted',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid subtheme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get questions by subtheme ID
 * @route GET /api/v1/subthemes/:id/questions
 * @access Private
 */
export const getSubThemeQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const subThemeId = req.params.id;

    // Check if subtheme exists
    const subTheme = await SubTheme.findById(subThemeId);
    if (!subTheme) {
      const error = new Error('SubTheme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Get all questions for this subtheme
    const Question = mongoose.model('Question');
    const questions = await Question.find({ 
      subTheme: subThemeId,
      archived: { $ne: true }
    }).sort('text');

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid subtheme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get all available tags for subtheme creation/editing
 * @route GET /api/v1/subthemes/available-tags
 * @access Private
 */
export const getAvailableTags = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get all active, non-archived tags from all categories
    const [indicators, sdgs, resilienceDimensions, esgCategories, standards] = await Promise.all([
      Indicator.find({ archived: { $ne: true }, status: 'active'}).select('_id name description').sort('_id'),
      SDG.find({ archived: { $ne: true }, status: 'active' }).select('_id code name description').sort('code'),
      ResilienceDimension.find({ archived: { $ne: true }, status: 'active' }).select('_id code name description category').sort('code'),
      ESGCategory.find({ archived: { $ne: true }, status: 'active' }).select('_id code name description type').sort('code'),
      Standard.find({ archived: { $ne: true }, status: 'active' }).select('_id code name description issuingBody').sort('code')
    ]);

    res.status(200).json({
      success: true,
      data: {
        indicators,
        sdgs,
        resilienceDimensions,
        esgCategories,
        standards
      }
    });
  } catch (error) {
    next(error);
  }
};