// utils/fileUpload.ts - Updated for Google Cloud Storage
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

/**
 * Uploads a file buffer and returns its public URL
 * Supports both local storage and Google Cloud Storage
 */
export async function uploadScreenshot(fileBuffer: Buffer, filename: string): Promise<string> {
  const storageType = env.FILE_STORAGE_TYPE || 'local'; // 'local' or 'gcs'
  
  try {
    // Generate a unique filename
    const fileExtension = path.extname(filename);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    
    if (storageType === 'gcs') {
      // Check required GCS environment variables
      if (!env.GCS_BUCKET_NAME || !env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('GCS configuration missing. Check GCS_BUCKET_NAME and GOOGLE_APPLICATION_CREDENTIALS env variables.');
      }
      
      // Construct the full path to the service account key file
      const keyFilePath = path.join(process.cwd(), env.GOOGLE_APPLICATION_CREDENTIALS);
      
      // Check if the key file exists
      if (!fs.existsSync(keyFilePath)) {
        throw new Error(`GCS service account key file not found at: ${keyFilePath}`);
      }
      
      // Initialize Google Cloud Storage
      const storage = new Storage({
        keyFilename: keyFilePath,
        // Project ID will be automatically detected from the service account key file
      });
      
      const bucket = storage.bucket(env.GCS_BUCKET_NAME);
      const file = bucket.file(`bug-reports/${uniqueFilename}`);
      
      // Upload file to GCS
      await file.save(fileBuffer, {
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
      return `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/bug-reports/${uniqueFilename}`;
      
    } else {
      // Local storage (existing implementation)
      const uploadDir = path.join(process.cwd(), 'uploads', 'screenshots');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, uniqueFilename);
      fs.writeFileSync(filePath, fileBuffer);
      
      return `/uploads/screenshots/${uniqueFilename}`;
    }
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Determine content type based on file extension
 */
function determineContentType(extension: string): string {
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
export async function deleteFile(fileUrl: string): Promise<boolean> {
  const storageType = env.FILE_STORAGE_TYPE || 'local';
  
  try {
    if (storageType === 'gcs') {
      // Extract filename from GCS URL
      const urlParts = fileUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      const filepath = `bug-reports/${filename}`;
      
      const storage = new Storage({
        keyFilename: filepath,
        // Project ID will be automatically detected from the service account key file
      });
      
      const bucket = storage.bucket(env.GCS_BUCKET_NAME!);
      await bucket.file(filepath).delete();
      
      return true;
    } else {
      // Local storage deletion
      const filename = path.basename(fileUrl);
      const filePath = path.join(process.cwd(), 'uploads', 'screenshots', filename);
      
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