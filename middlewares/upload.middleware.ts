// middlewares/upload.middleware.ts
import multer from 'multer';

// Set up in-memory storage
const storage = multer.memoryStorage();

// Configure file filter to restrict file types if needed
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Accept all files for now
  // You can add restrictions based on mime types
  cb(null, true);
};

// Create upload middleware
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});