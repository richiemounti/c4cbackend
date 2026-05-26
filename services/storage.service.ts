// services/storage.service.ts
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const storageType = process.env.FILE_STORAGE_TYPE || 'gcs'; // Default to GCS
const bucketName = process.env.GCS_BUCKET_NAME!;
const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS 
  ? path.join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : '';

// Initialize Google Cloud Storage (only if using GCS)
let storage: Storage | null = null;
if (storageType === 'gcs' && keyFilePath) {
  storage = new Storage({
    keyFilename: keyFilePath,
  });
}

/**
 * Upload a file to storage (GCS or local)
 * @param file - Multer file object
 * @param folderPath - Path within bucket/uploads folder (e.g., 'project-setup/projectId/task-123')
 * @returns File metadata including URL
 */
export async function uploadFile(
  file: Express.Multer.File,
  folderPath: string
): Promise<{
  filename: string;
  fileUrl: string;
  size: number;
  mimeType: string;
  originalName: string;
}> {
  try {
    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const fullPath = `${folderPath}/${uniqueFilename}`;

    if (storageType === 'gcs' && storage) {
      // Upload to Google Cloud Storage
      const bucket = storage.bucket(bucketName);
      const gcsFile = bucket.file(fullPath);

      await gcsFile.save(file.buffer, {
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
    } else {
      // Local storage fallback
      const uploadDir = path.join(process.cwd(), 'uploads', folderPath);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, uniqueFilename);
      fs.writeFileSync(filePath, file.buffer);

      return {
        filename: fullPath,
        fileUrl: `/uploads/${fullPath}`,
        size: file.size,
        mimeType: file.mimetype,
        originalName: file.originalname,
      };
    }
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a signed URL for accessing a private file
 * @param filename - Full path to file in bucket
 * @param expiresIn - Expiration time in minutes (default: 60)
 * @returns Signed URL
 */
export async function getSignedUrl(filename: string, expiresIn: number = 60): Promise<string> {
  try {
    if (storageType === 'gcs' && storage) {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filename);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 60 * 1000,
      });

      return url;
    } else {
      // For local storage, return the relative path
      return `/uploads/${filename}`;
    }
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate file access URL');
  }
}

/**
 * Delete a file from storage
 * @param filename - Full path to file
 * @returns Success status
 */
export async function deleteFile(filename: string): Promise<boolean> {
  try {
    if (storageType === 'gcs' && storage) {
      const bucket = storage.bucket(bucketName);
      await bucket.file(filename).delete();
      return true;
    } else {
      const filePath = path.join(process.cwd(), 'uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('File deletion error:', error);
    return false;
  }
}

/**
 * Upload multiple files
 * @param files - Array of Multer file objects
 * @param folderPath - Path within bucket/uploads folder
 * @returns Array of file metadata
 */
export async function uploadMultipleFiles(
  files: Express.Multer.File[],
  folderPath: string
): Promise<Array<{
  filename: string;
  fileUrl: string;
  size: number;
  mimeType: string;
  originalName: string;
}>> {
  const uploadPromises = files.map(file => uploadFile(file, folderPath));
  return Promise.all(uploadPromises);
}