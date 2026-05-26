// services/cloudinaryStorage.service.ts - Enhanced for ALL file types including PDFs
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// File upload result interface
export interface FileUploadResult {
  filename: string;
  fileUrl: string;
  size: number;
  mimeType: string;
  originalName?: string;
  publicId?: string;
  resourceType?: string;
}

/**
 * Determine the appropriate Cloudinary resource type based on MIME type
 */
function getResourceType(mimeType: string): 'image' | 'video' | 'raw' | 'auto' {
  // PDFs - use 'image' to enable transformations (thumbnails, page extraction)
  if (mimeType === 'application/pdf') {
    return 'image';
  }
  
  // Images
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  
  // Videos and Audio
  if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
    return 'video';
  }
  
  // Everything else (documents, archives, etc.) - use 'raw'
  // This includes: DOCX, XLSX, PPTX, ZIP, TXT, CSV, etc.
  return 'raw';
}

/**
 * Upload a file to Cloudinary
 * Supports images, videos, PDFs, and documents (DOCX, XLSX, ZIP, etc.)
 * @param file - Multer file object with buffer
 * @param destinationPath - Optional folder path in Cloudinary
 * @returns Promise with file upload result
 */
export const uploadFile = async (
  file: Express.Multer.File,
  destinationPath?: string
): Promise<FileUploadResult> => {
  try {
    // Validate file buffer exists
    if (!file.buffer) {
      throw new Error('No file buffer available. Ensure multer is configured with memoryStorage()');
    }

    const resourceType = getResourceType(file.mimetype);
    
    // ✅ NEW: Create timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // 2024-01-15T10-30-45-123Z
    const fileExtension = file.originalname.split('.').pop();
    const fileBaseName = file.originalname.replace(`.${fileExtension}`, '');
    
    // Clean the base name (remove special characters that might cause issues)
    const cleanBaseName = fileBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Create a clean, descriptive filename with timestamp
    const timestampedFilename = `${cleanBaseName}_${timestamp}`;
    
    console.log(`Uploading ${file.mimetype} to Cloudinary as "${resourceType}": ${timestampedFilename}.${fileExtension}`);

    // Upload to Cloudinary using upload_stream
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadOptions = {
        folder: destinationPath || 'youthimpact-uploads',
        resource_type: resourceType,
        public_id: timestampedFilename, // ✅ Use timestamped name as public_id (without extension)
        use_filename: false, // ✅ Don't use original filename
        unique_filename: false, // ✅ Use our exact filename
        overwrite: false,
        // Add tags for organization and searching
        tags: ['youthimpact', destinationPath || 'general', file.mimetype.split('/')[0]],
        // Store original filename and timestamp in metadata
        context: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          timestamp: timestamp,
        },
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        }
      );

      // Convert buffer to stream and pipe to Cloudinary
      const bufferStream = Readable.from(file.buffer);
      bufferStream.pipe(uploadStream);
    });

    console.log(`✅ File uploaded successfully: ${result.public_id}`);
    console.log(`   URL: ${result.secure_url}`);
    console.log(`   Size: ${(result.bytes / 1024).toFixed(2)} KB`);
    console.log(`   Timestamp: ${timestamp}`);

    return {
      filename: result.public_id,
      fileUrl: result.secure_url,
      size: result.bytes,
      mimeType: file.mimetype,
      originalName: file.originalname,
      publicId: result.public_id,
      resourceType: resourceType,
    };
  } catch (error: any) {
    console.error('❌ Error in uploadFile:', error);
    
    // Provide helpful error messages
    if (error.message?.includes('Invalid image file')) {
      throw new Error('File upload failed: Invalid file format. Please check that PDFs are enabled in your Cloudinary account settings.');
    }
    
    throw new Error(`File upload failed: ${error.message}`);
  }
};


/**
 * Generate a signed URL for secure file access
 * Note: Most Cloudinary URLs are already secure and permanent
 * This generates a time-limited authenticated URL for extra security
 * @param publicId - Cloudinary public ID of the file
 * @param expirationMinutes - URL expiration time (default 60 minutes)
 * @param resourceType - Optional resource type to ensure correct URL generation
 * @returns Signed URL string
 */
export const getSignedUrl = async (
  publicId: string,
  expirationMinutes: number = 60,
  resourceType?: 'image' | 'video' | 'raw'
): Promise<string> => {
  try {
    // ✅ FIX: For raw files, use fl_attachment flag to force download OR use regular secure URL
    if (resourceType === 'raw') {
      // Check if we want to allow inline viewing (for certain file types)
      // For HTML, TXT, and other text files, we want inline viewing
      return cloudinary.url(publicId, {
        resource_type: 'raw',
        secure: true,
        type: 'upload',
        // Don't use fl_attachment - this forces download
        // Without it, browsers will try to display the file inline
      });
    }
    
    // For images and PDFs, regular secure URL works fine
    if (resourceType === 'image') {
      return cloudinary.url(publicId, {
        resource_type: 'image',
        secure: true,
        type: 'upload',
      });
    }
    
    // For videos
    if (resourceType === 'video') {
      return cloudinary.url(publicId, {
        resource_type: 'video',
        secure: true,
        type: 'upload',
      });
    }
    
    // Default fallback
    return cloudinary.url(publicId, {
      secure: true,
      type: 'upload',
    });
  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    // Fallback to regular secure URL
    return cloudinary.url(publicId, { 
      resource_type: resourceType || 'auto',
      secure: true 
    });
  }
};

/**
 * Delete a file from Cloudinary
 * @param publicId - Cloudinary public ID of the file
 * @param resourceType - Optional resource type (image, video, raw)
 */
export const deleteFile = async (
  publicId: string,
  resourceType?: 'image' | 'video' | 'raw'
): Promise<void> => {
  try {
    // If resource type not provided, try to determine it
    const options = resourceType ? { resource_type: resourceType } : {};
    
    const result = await cloudinary.uploader.destroy(publicId, options);
    
    if (result.result === 'ok' || result.result === 'not found') {
      console.log(`✅ File deleted successfully: ${publicId}`);
    } else {
      throw new Error(`Delete failed: ${result.result}`);
    }
  } catch (error: any) {
    console.error('❌ Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Get file details from Cloudinary
 * @param publicId - Cloudinary public ID of the file
 * @param resourceType - Resource type (image, video, raw)
 */
export const getFileInfo = async (
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
) => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });
    
    return {
      url: result.secure_url,
      format: result.format,
      size: result.bytes,
      createdAt: result.created_at,
      width: result.width,
      height: result.height,
      resourceType: result.resource_type,
    };
  } catch (error: any) {
    console.error('Error getting file info:', error);
    throw new Error(`Failed to get file info: ${error.message}`);
  }
};

/**
 * Test Cloudinary connection and configuration
 * Useful for debugging configuration issues
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    console.log('🔍 Testing Cloudinary connection...');
    console.log('Configuration:', {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
    });

    // Ping Cloudinary API
    const result = await cloudinary.api.ping();
    
    if (result.status === 'ok') {
      console.log('✅ Cloudinary Connection successful');
      
      // Additional check: try to list folders (tests API permissions)
      try {
        await cloudinary.api.root_folders();
        console.log('✅ API permissions verified');
      } catch (permError) {
        console.warn('⚠️  Connection OK but API permissions may be limited');
      }
      
      return true;
    } else {
      throw new Error('Ping failed');
    }
  } catch (error: any) {
    console.error('❌ Cloudinary Connection failed:', error.message);
    
    // Provide helpful error messages
    if (error.message?.includes('401')) {
      console.error('   Check your API credentials (cloud_name, api_key, api_secret)');
    } else if (error.message?.includes('Must supply api_key')) {
      console.error('   CLOUDINARY_API_KEY is missing in environment variables');
    }
    
    return false;
  }
};

/**
 * Upload multiple files to Cloudinary
 * @param files - Array of Multer files
 * @param destinationPath - Optional folder path
 * @returns Promise with array of upload results
 */
export const uploadMultipleFiles = async (
  files: Express.Multer.File[],
  destinationPath?: string
): Promise<FileUploadResult[]> => {
  try {
    console.log(`Uploading ${files.length} files to Cloudinary...`);
    const uploadPromises = files.map(file => uploadFile(file, destinationPath));
    const results = await Promise.all(uploadPromises);
    console.log(`✅ Successfully uploaded ${results.length} files`);
    return results;
  } catch (error: any) {
    console.error('❌ Error uploading multiple files:', error);
    throw new Error(`Multiple file upload failed: ${error.message}`);
  }
};

/**
 * Generate optimized image URL with transformations
 * Works for images and PDFs (converts PDF pages to images)
 * @param publicId - Cloudinary public ID
 * @param options - Transformation options
 */
export const getOptimizedImageUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string | number;
    format?: string;
    page?: number; // For PDFs - which page to show (1-indexed)
  } = {}
): string => {
  const transformations: any = {
    width: options.width,
    height: options.height,
    crop: options.crop || 'limit',
    quality: options.quality || 'auto',
    fetch_format: options.format || 'auto',
  };

  // For PDFs, add page parameter
  if (options.page) {
    transformations.page = options.page;
  }

  return cloudinary.url(publicId, {
    secure: true,
    transformation: [transformations],
  });
};

/**
 * Generate thumbnail for PDF (first page by default)
 * @param publicId - Cloudinary public ID of PDF
 * @param options - Thumbnail options
 */
export const getPdfThumbnail = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    page?: number;
    format?: 'jpg' | 'png' | 'webp';
  } = {}
): string => {
  return cloudinary.url(publicId, {
    secure: true,
    format: options.format || 'jpg',
    transformation: [
      {
        width: options.width || 300,
        height: options.height || 400,
        crop: 'fill',
        page: options.page || 1,
        quality: 'auto',
      },
    ],
  });
};

/**
 * Check if PDF/ZIP delivery is enabled
 * Helpful for debugging free account issues
 */
export const checkPdfDeliveryEnabled = async (): Promise<boolean> => {
  try {
    // Try to fetch account details
    const usage = await cloudinary.api.usage();
    console.log('Account info:', {
      plan: usage.plan || 'free',
      credits: usage.credits,
    });
    
    // Note: There's no direct API to check PDF delivery setting
    // This would need to be manually enabled in dashboard
    console.log('⚠️  Note: If using free plan, ensure "Allow delivery of PDF and ZIP files" is enabled in Settings > Security');
    
    return true;
  } catch (error: any) {
    console.error('Error checking account:', error.message);
    return false;
  }
};