"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDocumentById = exports.getDocument = exports.getDocuments = exports.uploadDocument = void 0;
// UPDATED: Import from Cloudinary storage service
const cloudinaryStorage_service_1 = require("../services/cloudinaryStorage.service");
const document_model_1 = __importDefault(require("../models/document.model"));
/**
 * Upload a document for a project or site
 * @route POST /api/v1/documents
 * @access Private
 */
const uploadDocument = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            const error = new Error('No file uploaded');
            error.statusCode = 400;
            throw error;
        }
        const { projectId, siteId, documentType, description } = req.body;
        // Type assertion for req.user
        if (!req.user) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // UPDATED: Upload file to Cloudinary with organized folder structure
        const folder = siteId
            ? `projects/${projectId}/sites/${siteId}/documents`
            : `projects/${projectId}/documents`;
        // Upload to Cloudinary - it returns FileUploadResult
        const fileData = yield (0, cloudinaryStorage_service_1.uploadFile)(req.file, folder);
        // Create document record in MongoDB
        const document = yield document_model_1.default.create({
            project: projectId,
            site: siteId || null,
            documentType,
            fileName: fileData.originalName || req.file.originalname,
            filePath: fileData.filename, // Cloudinary public_id
            fileSize: fileData.size,
            mimeType: fileData.mimeType,
            description,
            uploadedBy: req.user._id
        });
        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully',
            data: Object.assign(Object.assign({}, document.toObject()), { 
                // Include the Cloudinary URL for immediate access
                fileUrl: fileData.fileUrl })
        });
    }
    catch (error) {
        next(error);
    }
});
exports.uploadDocument = uploadDocument;
/**
 * Get documents with filtering options
 * @route GET /api/v1/documents
 * @access Private
 */
const getDocuments = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize query
        let query = document_model_1.default.find({ archived: { $ne: true } });
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
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = yield document_model_1.default.countDocuments({ archived: { $ne: true } });
        query = query.skip(startIndex).limit(limit);
        // Sort by most recent first by default
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        }
        else {
            query = query.sort('-createdAt');
        }
        // Populate related fields
        if (req.query.populate) {
            const populateFields = req.query.populate.split(',');
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
        const documents = yield query;
        // Pagination result
        const pagination = {};
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
    }
    catch (error) {
        next(error);
    }
});
exports.getDocuments = getDocuments;
/**
 * Get a single document by ID
 * @route GET /api/v1/documents/:id
 * @access Private
 */
const getDocument = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const documentId = req.params.id;
        const query = document_model_1.default.findById(documentId);
        // Populate related fields if requested
        if (req.query.populate) {
            const populateFields = req.query.populate.split(',');
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
        const document = yield query;
        if (!document) {
            const error = new Error('Document not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: document
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid document ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getDocument = getDocument;
/**
 * Delete a document
 * @route DELETE /api/v1/documents/:id
 * @access Private
 */
const deleteDocumentById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const documentId = req.params.id;
        // Find the document
        const document = yield document_model_1.default.findById(documentId);
        if (!document) {
            const error = new Error('Document not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission (creator or admin)
        if (!req.user) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const isCreator = document.uploadedBy.toString() === req.user._id.toString();
        const isAdmin = req.user.isConnectGoStaff;
        if (!isCreator && !isAdmin) {
            const error = new Error('Not authorized to delete this document');
            error.statusCode = 403;
            throw error;
        }
        // UPDATED: Delete from Cloudinary
        // The filePath stored in MongoDB is the Cloudinary public_id
        try {
            yield (0, cloudinaryStorage_service_1.deleteFile)(document.filePath);
        }
        catch (deleteError) {
            console.error('Error deleting file from Cloudinary:', deleteError);
            // Continue with database deletion even if Cloudinary delete fails
            // You might want to log this for manual cleanup later
        }
        // Delete the document record from database
        yield document_model_1.default.findByIdAndDelete(documentId);
        res.status(200).json({
            success: true,
            message: 'Document deleted successfully',
            data: null
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid document ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteDocumentById = deleteDocumentById;
exports.default = {
    uploadDocument: exports.uploadDocument,
    getDocuments: exports.getDocuments,
    getDocument: exports.getDocument,
    deleteDocumentById: exports.deleteDocumentById
};
//# sourceMappingURL=document.controller.js.map