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
exports.uploadFile = uploadFile;
exports.getSignedUrl = getSignedUrl;
exports.deleteFile = deleteFile;
exports.uploadMultipleFiles = uploadMultipleFiles;
// services/storage.service.ts
const storage_1 = require("@google-cloud/storage");
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const storageType = process.env.FILE_STORAGE_TYPE || 'gcs'; // Default to GCS
const bucketName = process.env.GCS_BUCKET_NAME;
const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path_1.default.join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : '';
// Initialize Google Cloud Storage (only if using GCS)
let storage = null;
if (storageType === 'gcs' && keyFilePath) {
    storage = new storage_1.Storage({
        keyFilename: keyFilePath,
    });
}
/**
 * Upload a file to storage (GCS or local)
 * @param file - Multer file object
 * @param folderPath - Path within bucket/uploads folder (e.g., 'project-setup/projectId/task-123')
 * @returns File metadata including URL
 */
function uploadFile(file, folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const fileExtension = path_1.default.extname(file.originalname);
            const uniqueFilename = `${(0, uuid_1.v4)()}${fileExtension}`;
            const fullPath = `${folderPath}/${uniqueFilename}`;
            if (storageType === 'gcs' && storage) {
                // Upload to Google Cloud Storage
                const bucket = storage.bucket(bucketName);
                const gcsFile = bucket.file(fullPath);
                yield gcsFile.save(file.buffer, {
                    metadata: {
                        contentType: file.mimetype,
                        metadata: {
                            originalName: file.originalname,
                            uploadedAt: new Date().toISOString(),
                        },
                    },
                    public: true, // Make publicly accessible
                    validation: 'md5',
                });
                const publicUrl = `https://storage.googleapis.com/${bucketName}/${fullPath}`;
                return {
                    filename: fullPath,
                    fileUrl: publicUrl,
                    size: file.size,
                    mimeType: file.mimetype,
                    originalName: file.originalname,
                };
            }
            else {
                // Local storage fallback
                const uploadDir = path_1.default.join(process.cwd(), 'uploads', folderPath);
                if (!fs_1.default.existsSync(uploadDir)) {
                    fs_1.default.mkdirSync(uploadDir, { recursive: true });
                }
                const filePath = path_1.default.join(uploadDir, uniqueFilename);
                fs_1.default.writeFileSync(filePath, file.buffer);
                return {
                    filename: fullPath,
                    fileUrl: `/uploads/${fullPath}`,
                    size: file.size,
                    mimeType: file.mimetype,
                    originalName: file.originalname,
                };
            }
        }
        catch (error) {
            console.error('File upload error:', error);
            throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
/**
 * Generate a signed URL for accessing a private file
 * @param filename - Full path to file in bucket
 * @param expiresIn - Expiration time in minutes (default: 60)
 * @returns Signed URL
 */
function getSignedUrl(filename_1) {
    return __awaiter(this, arguments, void 0, function* (filename, expiresIn = 60) {
        try {
            if (storageType === 'gcs' && storage) {
                const bucket = storage.bucket(bucketName);
                const file = bucket.file(filename);
                const [url] = yield file.getSignedUrl({
                    version: 'v4',
                    action: 'read',
                    expires: Date.now() + expiresIn * 60 * 1000,
                });
                return url;
            }
            else {
                // For local storage, return the relative path
                return `/uploads/${filename}`;
            }
        }
        catch (error) {
            console.error('Error generating signed URL:', error);
            throw new Error('Failed to generate file access URL');
        }
    });
}
/**
 * Delete a file from storage
 * @param filename - Full path to file
 * @returns Success status
 */
function deleteFile(filename) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (storageType === 'gcs' && storage) {
                const bucket = storage.bucket(bucketName);
                yield bucket.file(filename).delete();
                return true;
            }
            else {
                const filePath = path_1.default.join(process.cwd(), 'uploads', filename);
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                    return true;
                }
                return false;
            }
        }
        catch (error) {
            console.error('File deletion error:', error);
            return false;
        }
    });
}
/**
 * Upload multiple files
 * @param files - Array of Multer file objects
 * @param folderPath - Path within bucket/uploads folder
 * @returns Array of file metadata
 */
function uploadMultipleFiles(files, folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const uploadPromises = files.map(file => uploadFile(file, folderPath));
        return Promise.all(uploadPromises);
    });
}
//# sourceMappingURL=storage.service.js.map