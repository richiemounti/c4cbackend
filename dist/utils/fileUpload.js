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
exports.uploadScreenshot = uploadScreenshot;
exports.deleteFile = deleteFile;
// utils/fileUpload.ts - Updated for Google Cloud Storage
const storage_1 = require("@google-cloud/storage");
const uuid_1 = require("uuid");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const env_1 = require("../config/env");
/**
 * Uploads a file buffer and returns its public URL
 * Supports both local storage and Google Cloud Storage
 */
function uploadScreenshot(fileBuffer, filename) {
    return __awaiter(this, void 0, void 0, function* () {
        const storageType = env_1.env.FILE_STORAGE_TYPE || 'local'; // 'local' or 'gcs'
        try {
            // Generate a unique filename
            const fileExtension = path_1.default.extname(filename);
            const uniqueFilename = `${(0, uuid_1.v4)()}${fileExtension}`;
            if (storageType === 'gcs') {
                // Check required GCS environment variables
                if (!env_1.env.GCS_BUCKET_NAME || !env_1.env.GOOGLE_APPLICATION_CREDENTIALS) {
                    throw new Error('GCS configuration missing. Check GCS_BUCKET_NAME and GOOGLE_APPLICATION_CREDENTIALS env variables.');
                }
                // Construct the full path to the service account key file
                const keyFilePath = path_1.default.join(process.cwd(), env_1.env.GOOGLE_APPLICATION_CREDENTIALS);
                // Check if the key file exists
                if (!fs_1.default.existsSync(keyFilePath)) {
                    throw new Error(`GCS service account key file not found at: ${keyFilePath}`);
                }
                // Initialize Google Cloud Storage
                const storage = new storage_1.Storage({
                    keyFilename: keyFilePath,
                    // Project ID will be automatically detected from the service account key file
                });
                const bucket = storage.bucket(env_1.env.GCS_BUCKET_NAME);
                const file = bucket.file(`bug-reports/${uniqueFilename}`);
                // Upload file to GCS
                yield file.save(fileBuffer, {
                    metadata: {
                        contentType: determineContentType(fileExtension),
                        metadata: {
                            originalName: filename,
                            uploadedAt: new Date().toISOString()
                        }
                    },
                    public: true, // Make file publicly accessible
                    validation: 'md5'
                });
                // Return the public URL
                return `https://storage.googleapis.com/${env_1.env.GCS_BUCKET_NAME}/bug-reports/${uniqueFilename}`;
            }
            else {
                // Local storage (existing implementation)
                const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'screenshots');
                if (!fs_1.default.existsSync(uploadDir)) {
                    fs_1.default.mkdirSync(uploadDir, { recursive: true });
                }
                const filePath = path_1.default.join(uploadDir, uniqueFilename);
                fs_1.default.writeFileSync(filePath, fileBuffer);
                return `/uploads/screenshots/${uniqueFilename}`;
            }
        }
        catch (error) {
            console.error('File upload error:', error);
            throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}
/**
 * Determine content type based on file extension
 */
function determineContentType(extension) {
    switch (extension.toLowerCase()) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.mp4':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        case '.pdf':
            return 'application/pdf';
        case '.doc':
            return 'application/msword';
        case '.docx':
            return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case '.txt':
        case '.log':
            return 'text/plain';
        default:
            return 'application/octet-stream';
    }
}
/**
 * Delete a file from storage (for cleanup operations)
 */
function deleteFile(fileUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const storageType = env_1.env.FILE_STORAGE_TYPE || 'local';
        try {
            if (storageType === 'gcs') {
                // Extract filename from GCS URL
                const urlParts = fileUrl.split('/');
                const filename = urlParts[urlParts.length - 1];
                const filepath = `bug-reports/${filename}`;
                const storage = new storage_1.Storage({
                    keyFilename: filepath,
                    // Project ID will be automatically detected from the service account key file
                });
                const bucket = storage.bucket(env_1.env.GCS_BUCKET_NAME);
                yield bucket.file(filepath).delete();
                return true;
            }
            else {
                // Local storage deletion
                const filename = path_1.default.basename(fileUrl);
                const filePath = path_1.default.join(process.cwd(), 'uploads', 'screenshots', filename);
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
//# sourceMappingURL=fileUpload.js.map