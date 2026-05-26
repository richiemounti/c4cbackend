// controllers/sdg.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import SDG from "../models/sdg.model";
import { CustomError } from "../middlewares/error.middleware";

/**
 * Create a new SDG
 * @route POST /api/v1/sdgs
 * @access Private (ConnectGo staff only)
 */
export const createSDG = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create SDGs') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { code, name, description, iconUrl, color } = req.body;
    
    // Check if SDG with this code already exists
    const existingSDG = await SDG.findOne({ code });
    if (existingSDG) {
      const error = new Error(`SDG with code ${code} already exists`) as CustomError;
      error.statusCode = 409;
      throw error;
    }
    
    // Create the new SDG
    const newSDG = await SDG.create({
      code,
      name,
      description,
      iconUrl,
      color,
      creator: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'SDG created successfully',
      data: newSDG
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all SDGs
 * @route GET /api/v1/sdgs
 * @access Public
 */
export const getSDGs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = SDG.find({ archived: { $ne: true } });

    // Filter by status if provided
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Apply sorting
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('code'); // Default sort by code
    }

    // Execute query
    const sdgs = await query;

    res.status(200).json({
      success: true,
      count: sdgs.length,
      data: sdgs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single SDG by ID
 * @route GET /api/v1/sdgs/:id
 * @access Public
 */
export const getSDG = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sdgId = req.params.id;

    const sdg = await SDG.findById(sdgId);

    if (!sdg) {
      const error = new Error('SDG not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if SDG is archived
    if (sdg.archived) {
      const error = new Error('This SDG has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    res.status(200).json({
      success: true,
      data: sdg
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid SDG ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update SDG by ID
 * @route PUT /api/v1/sdgs/:id
 * @access Private (ConnectGo staff only)
 */
export const updateSDG = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update SDGs') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const sdgId = req.params.id;
    const { name, description, iconUrl, color, status } = req.body;

    // Find the SDG first to check if it exists and is not archived
    const sdg = await SDG.findById(sdgId);

    if (!sdg) {
      const error = new Error('SDG not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (sdg.archived) {
      const error = new Error('Cannot update an archived SDG') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Update the SDG
    const updatedSDG = await SDG.findByIdAndUpdate(
      sdgId,
      { name, description, iconUrl, color, status },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'SDG updated successfully',
      data: updatedSDG
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid SDG ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive SDG by ID (soft delete)
 * @route DELETE /api/v1/sdgs/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveSDG = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive SDGs') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const sdgId = req.params.id;

    // Find the SDG first to check if it exists
    const sdg = await SDG.findById(sdgId);

    if (!sdg) {
      const error = new Error('SDG not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (sdg.archived) {
      const error = new Error('SDG is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the SDG (soft delete)
    const archivedSDG = await SDG.findByIdAndUpdate(
      sdgId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'SDG archived successfully',
      data: archivedSDG
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid SDG ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore archived SDG by ID
 * @route POST /api/v1/sdgs/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreSDG = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore SDGs') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const sdgId = req.params.id;

    // Find the SDG first to check if it exists and is archived
    const sdg = await SDG.findById(sdgId);

    if (!sdg) {
      const error = new Error('SDG not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!sdg.archived) {
      const error = new Error('SDG is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the SDG
    const restoredSDG = await SDG.findByIdAndUpdate(
      sdgId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'SDG restored successfully',
      data: restoredSDG
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid SDG ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

export default {
  createSDG,
  getSDGs,
  getSDG,
  updateSDG,
  archiveSDG,
  restoreSDG
};