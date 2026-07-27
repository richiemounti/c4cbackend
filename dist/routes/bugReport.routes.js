"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/bugReport.routes.ts - Updated for Enhanced Bug Reports
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const bugReport_controller_1 = require("../controllers/bugReport.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const validation_middleware_1 = require("../middlewares/validation.middleware");
const bugReportRouter = (0, express_1.Router)();
// Configure multer for file uploads (screenshots, attachments)
const upload = (0, multer_1.default)({
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
        }
        else {
            cb(new Error('Invalid file type. Only images, videos, documents, and log files are allowed.'));
        }
    }
});
/**
 * Public Routes (no authentication required)
 */
// Submit bug report - can be used by anonymous users
bugReportRouter.post('/', validation_middleware_1.optionalAuthenticate, // Optional auth - works for both authenticated and anonymous users
upload.array('attachments', 5), // Allow up to 5 attachments
validation_middleware_1.validateBugReport, // Custom validation middleware
bugReport_controller_1.submitBugReport);
/**
 * Authenticated Routes (require admin/staff access)
 */
// Apply authentication middleware to all admin routes
bugReportRouter.use(auth_middleware_1.default);
// Get all bug reports with filtering and pagination
bugReportRouter.get('/', bugReport_controller_1.getBugReports);
// Get analytics dashboard data
bugReportRouter.get('/analytics', bugReport_controller_1.getBugReportAnalytics);
// Get single bug report by ID
bugReportRouter.get('/:id', bugReport_controller_1.getBugReport);
// Update bug report (admin only)
bugReportRouter.patch('/:id', bugReport_controller_1.updateBugReport);
// verify bug report (admin only)
bugReportRouter.patch('/:id/verify', bugReport_controller_1.verifyBugReport);
exports.default = bugReportRouter;
//# sourceMappingURL=bugReport.routes.js.map