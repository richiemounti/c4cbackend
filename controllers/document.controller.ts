// controllers/document.controller.ts - Updated for Cloudinary
import { Request, Response, NextFunction } from "express";
// UPDATED: Import from Cloudinary storage service
import { uploadFile, deleteFile } from '../services/cloudinaryStorage.service';
import Document from '../models/document.model';
import { CustomError } from "../middlewares/error.middleware";
import mongoose from "mongoose";

type AuthUser = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
  isConnectGoStaff?: boolean;
};

// UPDATED: FileUploadResult matches Cloudinary service return type
export interface FileUploadResult {
  filename: string;      // Cloudinary public_id
  fileUrl: string;       // Cloudinary secure_url
  size: number;          // File size in bytes
  mimeType: string;      // MIME type
  originalName?: string; // Original filename
  publicId?: string;     // Cloudinary public ID
  resourceType?: string; // 'image' | 'video' | 'raw'
}

/**
 * Upload a document for a project or site
 * @route POST /api/v1/documents
 * @access Private
 */
export const uploadDocument = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    if (!req.file) {
      const error = new Error('No file uploaded') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    const { projectId, siteId, documentType, description } = req.body;
    
    // Type assertion for req.user
    if (!req.user) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    // UPDATED: Upload file to Cloudinary with organized folder structure
    const folder = siteId 
      ? `projects/${projectId}/sites/${siteId}/documents` 
      : `projects/${projectId}/documents`;
    
    // Upload to Cloudinary - it returns FileUploadResult
    const fileData = await uploadFile(req.file, folder) as FileUploadResult;
    
    // Create document record in MongoDB
    const document = await Document.create({
      project: projectId,
      site: siteId || null,
      documentType,
      fileName: fileData.originalName || req.file.originalname,
      filePath: fileData.filename, // Cloudinary public_id
      fileSize: fileData.size,
      mimeType: fileData.mimeType,
      description,
      uploadedBy: (req.user as AuthUser)._id
    });
    
    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        ...document.toObject(),
        // Include the Cloudinary URL for immediate access
        fileUrl: fileData.fileUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get documents with filtering options
 * @route GET /api/v1/documents
 * @access Private
 */
export const getDocuments = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = Document.find({ archived: { $ne: true } });

    // Filter by project if provided
    if (req.query.projectId) {
      query = query.find({ project: req.query.projectId });
    }

    // Filter by site if provided
    if (req.query.siteId) {
      query = query.find({ site: req.query.siteId });
    }

    // Filter by document type if provided
    if (req.query.documentType) {
      query = query.find({ documentType: req.query.documentType });
    }

    // Filter by uploaded by if provided
    if (req.query.uploadedBy) {
      query = query.find({ uploadedBy: req.query.uploadedBy });
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Document.countDocuments({ archived: { $ne: true } });

    query = query.skip(startIndex).limit(limit);

    // Sort by most recent first by default
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Populate related fields
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('uploadedBy')) {
        query = query.populate({
          path: 'uploadedBy',
          select: 'name email userName'
        });
      }
      
      if (populateFields.includes('project')) {
        query = query.populate({
          path: 'project',
          select: 'name organization'
        });
      }
      
      if (populateFields.includes('site')) {
        query = query.populate({
          path: 'site',
          select: 'name'
        });
      }
    }

    // Execute query
    const documents = await query;

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
      count: documents.length,
      pagination,
      total,
      data: documents
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single document by ID
 * @route GET /api/v1/documents/:id
 * @access Private
 */
export const getDocument = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const documentId = req.params.id;

    const query = Document.findById(documentId);
    
    // Populate related fields if requested
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('uploadedBy')) {
        query.populate({
          path: 'uploadedBy',
          select: 'name email userName'
        });
      }
      
      if (populateFields.includes('project')) {
        query.populate({
          path: 'project',
          select: 'name organization'
        });
      }
      
      if (populateFields.includes('site')) {
        query.populate({
          path: 'site',
          select: 'name'
        });
      }
    }

    const document = await query;

    if (!document) {
      const error = new Error('Document not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid document ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Delete a document
 * @route DELETE /api/v1/documents/:id
 * @access Private
 */
export const deleteDocumentById = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const documentId = req.params.id;

    // Find the document
    const document = await Document.findById(documentId);
    
    if (!document) {
      const error = new Error('Document not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission (creator or admin)
    if (!req.user) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const isCreator = document.uploadedBy.toString() === (req.user as AuthUser)._id.toString();
    const isAdmin = req.user.isConnectGoStaff;
    
    if (!isCreator && !isAdmin) {
      const error = new Error('Not authorized to delete this document') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // UPDATED: Delete from Cloudinary
    // The filePath stored in MongoDB is the Cloudinary public_id
    try {
      await deleteFile(document.filePath);
    } catch (deleteError) {
      console.error('Error deleting file from Cloudinary:', deleteError);
      // Continue with database deletion even if Cloudinary delete fails
      // You might want to log this for manual cleanup later
    }
    
    // Delete the document record from database
    await Document.findByIdAndDelete(documentId);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid document ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

export default {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocumentById
};