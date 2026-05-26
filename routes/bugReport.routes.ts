// routes/bugReport.routes.ts - Updated for Enhanced Bug Reports
import { Router } from 'express';
import multer from 'multer';
import {
  submitBugReport,
  getBugReports,
  getBugReport,
  updateBugReport,
  verifyBugReport,
  getBugReportAnalytics
} from '../controllers/bugReport.controller';
import authorize from '../middlewares/auth.middleware';
import { validateBugReport, optionalAuthenticate } from '../middlewares/validation.middleware';

const bugReportRouter = Router();

// Configure multer for file uploads (screenshots, attachments)
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, documents, and log files
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'application/pdf', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.log')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, documents, and log files are allowed.'));
    }
  }
});

/**
 * Public Routes (no authentication required)
 */

// Submit bug report - can be used by anonymous users
bugReportRouter.post(
  '/',
  optionalAuthenticate, // Optional auth - works for both authenticated and anonymous users
  upload.array('attachments', 5), // Allow up to 5 attachments
  validateBugReport, // Custom validation middleware
  submitBugReport
);

/**
 * Authenticated Routes (require admin/staff access)
 */

// Apply authentication middleware to all admin routes
bugReportRouter.use(authorize);

// Get all bug reports with filtering and pagination
bugReportRouter.get('/', getBugReports);

// Get analytics dashboard data
bugReportRouter.get('/analytics', getBugReportAnalytics);

// Get single bug report by ID
bugReportRouter.get('/:id', getBugReport);

// Update bug report (admin only)
bugReportRouter.patch('/:id', updateBugReport);

// verify bug report (admin only)
bugReportRouter.patch('/:id/verify', verifyBugReport);

export default bugReportRouter;