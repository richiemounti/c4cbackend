// controllers/standard.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Standard from "../models/standard.model";
import { CustomError } from "../middlewares/error.middleware";

/**
 * Create a new standard
 * @route POST /api/v1/standards
 * @access Private (ConnectGo staff only)
 */
export const createStandard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create standards') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { code, name, description, issuingBody, website, version, publishedYear } = req.body;
    
    // Check if standard with this code already exists
    const existingStandard = await Standard.findOne({ code });
    if (existingStandard) {
      const error = new Error(`Standard with code ${code} already exists`) as CustomError;
      error.statusCode = 409;
      throw error;
    }
    
    // Create the new standard
    const newStandard = await Standard.create({
      code,
      name,
      description,
      issuingBody,
      website,
      version,
      publishedYear,
      creator: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Standard created successfully',
      data: newStandard
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all standards
 * @route GET /api/v1/standards
 * @access Public
 */
export const getStandards = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = Standard.find({ archived: { $ne: true } });

    // Filter by status if provided
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Filter by issuing body if provided
    if (req.query.issuingBody) {
      query = query.find({ issuingBody: { $regex: req.query.issuingBody, $options: 'i' } });
    }

    // Apply sorting
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('code'); // Default sort by code
    }

    // Execute query
    const standards = await query;

    res.status(200).json({
      success: true,
      count: standards.length,
      data: standards
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single standard by ID
 * @route GET /api/v1/standards/:id
 * @access Public
 */
export const getStandard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const standardId = req.params.id;

    const standard = await Standard.findById(standardId);

    if (!standard) {
      const error = new Error('Standard not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if standard is archived
    if (standard.archived) {
      const error = new Error('This standard has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    res.status(200).json({
      success: true,
      data: standard
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid standard ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update standard by ID
 * @route PUT /api/v1/standards/:id
 * @access Private (ConnectGo staff only)
 */
export const updateStandard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update standards') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const standardId = req.params.id;
    const { name, description, issuingBody, website, version, publishedYear, status } = req.body;

    // Find the standard first to check if it exists and is not archived
    const standard = await Standard.findById(standardId);

    if (!standard) {
      const error = new Error('Standard not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (standard.archived) {
      const error = new Error('Cannot update an archived standard') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Update the standard
    const updatedStandard = await Standard.findByIdAndUpdate(
      standardId,
      { name, description, issuingBody, website, version, publishedYear, status },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Standard updated successfully',
      data: updatedStandard
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid standard ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive standard by ID (soft delete)
 * @route DELETE /api/v1/standards/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveStandard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive standards') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const standardId = req.params.id;

    // Find the standard first to check if it exists
    const standard = await Standard.findById(standardId);

    if (!standard) {
      const error = new Error('Standard not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (standard.archived) {
      const error = new Error('Standard is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the standard (soft delete)
    const archivedStandard = await Standard.findByIdAndUpdate(
      standardId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Standard archived successfully',
      data: archivedStandard
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid standard ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived standard by ID
 * @route POST /api/v1/standards/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreStandard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore standards') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const standardId = req.params.id;

    // Find the standard first to check if it exists and is archived
    const standard = await Standard.findById(standardId);

    if (!standard) {
      const error = new Error('Standard not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!standard.archived) {
      const error = new Error('Standard is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the standard
    const restoredStandard = await Standard.findByIdAndUpdate(
      standardId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Standard restored successfully',
      data: restoredStandard
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid standard ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

export default {
  createStandard,
  getStandards,
  getStandard,
  updateStandard,
  archiveStandard,
  restoreStandard
};