// controllers/indicator.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Indicator from "../models/indicator.model";
import { CustomError } from "../middlewares/error.middleware";


/**
 * Create a new indicator
 * @route POST /api/v1/indicators
 * @access Private (ConnectGo staff only)
 */
export const createIndicator = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!req.user?.isConnectGoStaff) {
            const error = new Error('Only ConnectGo staff can create indicators') as CustomError;
            error.statusCode = 403;
            throw error;
        }

        // ADD THIS LINE - destructure evidence from request body
        const { name, description, status, evidence } = req.body;

        // Add creator from authenticated user
        const creator = req.user._id;

        // Validate status if provided
        const validStatuses = ['active', 'inactive'];
        const indicatorStatus = status && validStatuses.includes(status) ? status : 'active';

        // MODIFY THIS - include evidence in the creation object
        const newIndicators = await Indicator.create([{
            name,
            description,
            evidence: evidence || null, // Add evidence field
            creator,
            status: indicatorStatus
        }], { session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: 'Indicator created successfully',
            data: newIndicators[0]
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};


/**
 * Get all indicators with pagination and filtering
 * @route GET /api/v1/indicators
 * @access Private
 */
export const getIndicators = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Initialize query
        let query = Indicator.find({ archived: { $ne: true } });

        // ADD THIS: Handle search parameter for text search
        if (req.query.search) {
            const searchTerm = req.query.search as string;
            query = query.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } },
                    { 'evidence.source': { $regex: searchTerm, $options: 'i' } },
                    { 'evidence.details': { $regex: searchTerm, $options: 'i' } }
                ]
            });
        }

        // Filter by status if provided
        if (req.query.status) {
            query = query.find({ status: req.query.status });
        }

        // Copy req.query to avoid modifying the original
        const reqQuery = { ...req.query };

        // Fields to exclude from filtering
        // MODIFY THIS: Add 'search' to removeFields
        const removeFields = ['select', 'sort', 'page', 'limit', 'populate', 'search'];
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
        
        // Build count query based on the filters
        let countQuery = Indicator.find({ archived: { $ne: true } });
        
        // ADD THIS: Apply search to count query
        if (req.query.search) {
            const searchTerm = req.query.search as string;
            countQuery = countQuery.find({
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { description: { $regex: searchTerm, $options: 'i' } },
                    { 'evidence.source': { $regex: searchTerm, $options: 'i' } },
                    { 'evidence.details': { $regex: searchTerm, $options: 'i' } }
                ]
            });
        }
        
        if (req.query.status) {
            countQuery = countQuery.find({ status: req.query.status });
        }
        
        const total = await countQuery.countDocuments();
    
        query = query.skip(startIndex).limit(limit);

        // Execute query
        const indicators = await query

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
            count: indicators.length,
            pagination,
            total,
            data: indicators
        });
    } catch (error) {
        next(error);
    }
}


/**
 * Get single indicator by ID
 * @route GET /api/v1/indicators/:id
 * @access Private
 */
export const getIndicator = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const indicatorId = req.params.id;

        const query = Indicator.findById(indicatorId);
        
        // Populate creator field if requested
        if (req.query.populate === 'creator') {
        query.populate({
            path: 'creator',
            select: 'name email userName'
        });
        }

        const indicator = await query;

        if (!indicator) {
        const error = new Error('Indicator not found') as CustomError;
        error.statusCode = 404;
        throw error;
        }

        // Check if indicator is archived
        if (indicator.archived) {
        const error = new Error('This indicator has been archived') as CustomError;
        error.statusCode = 410; // Gone
        throw error;
        }

        res.status(200).json({
        success: true,
        data: indicator
        });
    } catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
        const customError = new Error('Invalid indicator ID format') as CustomError;
        customError.statusCode = 400;
        return next(customError);
        }
        next(error);
    }
};


/**
 * Update indicator by ID
 * @route PUT /api/v1/indicators/:id
 * @access Private (ConnectGo staff only)
 */
export const updateIndicator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update indicators') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const indicatorId = req.params.id;
    // ADD THIS LINE - destructure evidence from request body
    const { name, description, status, evidence } = req.body;

    // Find the indicator first to check if it exists and is not archived
    const indicator = await Indicator.findById(indicatorId);

    if (!indicator) {
      const error = new Error('Indicator not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (indicator.archived) {
      const error = new Error('Cannot update an archived indicator') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate status if provided
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    // ADD THESE LINES - handle evidence updates
    if (evidence !== undefined) {
      updateData.evidence = evidence;
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'inactive'];
      if (validStatuses.includes(status)) {
        updateData.status = status;
      } else {
        const error = new Error('Invalid status. Must be either "active" or "inactive"') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Update the indicator
    const updatedIndicator = await Indicator.findByIdAndUpdate(
      indicatorId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Indicator updated successfully',
      data: updatedIndicator
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid indicator ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive indicator by ID (soft delete)
 * @route DELETE /api/v1/indicators/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveIndicator = async (
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

    const indicatorId = req.params.id;

    // Find the indicator first to check if it exists
    const indicator = await Indicator.findById(indicatorId);

    if (!indicator) {
      const error = new Error('Indicator not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (indicator.archived) {
      const error = new Error('Indicator is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the indicator (soft delete)
    const archivedIndicator = await Indicator.findByIdAndUpdate(
      indicatorId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Indicator archived successfully',
      data: archivedIndicator
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid indicator ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


/**
 * Restore archived indicator by ID
 * @route POST /api/v1/indicators/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreIndicator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore indicators') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const indicatorId = req.params.id;

    // Find the indicator first to check if it exists and is archived
    const indicator = await Indicator.findById(indicatorId);

    if (!indicator) {
      const error = new Error('Indicator not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!indicator.archived) {
      const error = new Error('Indicator is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the indicator
    const restoredIndicator = await Indicator.findByIdAndUpdate(
      indicatorId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Indicator restored successfully',
      data: restoredIndicator
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid indicator ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


/**
 * Permanently delete indicator by ID
 * @route DELETE /api/v1/indicators/:id/permanent
 * @access Private (ConnectGo staff only)
 */
export const deleteIndicator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can permanently delete indicators') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const indicatorId = req.params.id;

    // Find the indicator first to check if it exists
    const indicator = await Indicator.findById(indicatorId);

    if (!indicator) {
      const error = new Error('indicator not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Permanently delete the indicator
    await Indicator.findByIdAndDelete(indicatorId);

    res.status(200).json({
      success: true,
      message: 'indicator permanently deleted',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid indicator ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

  