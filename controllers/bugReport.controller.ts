// controllers/bugReport.controller.ts - FIXED VERSION
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import BugReport, { IBugReport } from "../models/bugReport.model";
// UPDATED: Import from Cloudinary storage service
import { uploadFile } from "../services/cloudinaryStorage.service";
import { sendBugReportNotification } from "../utils/notifications";
import { CustomError } from "../middlewares/error.middleware";

// Define feedback type for better TypeScript support
type FeedbackType = 'bug_report' | 'user_experience' | 'thematic_feedback' | 'feature_suggestion' | 'general_feedback';

/**
 * Submit a new bug report with enhanced feedback capture
 * @route POST /api/v1/bug-reports
 * @access Public
 */
export const submitBugReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Helper function to safely parse JSON strings from FormData
    const parseJSONField = (field: any) => {
      if (!field) return undefined;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch (e) {
          return undefined;
        }
      }
      return field;
    };

    // Extract all possible fields from request body
    const {
      // Basic fields
      feedbackType = 'bug_report' as FeedbackType,
      title,
      description,
      category,
      subCategory,
      
      // Bug-specific fields
      steps,
      expectedBehavior,
      actualBehavior,
      
      // Assessment fields
      urgencyLevel = 'fix_this_week',
      bugType,

      // NEW FIELDS:
      assignedToTeamMember,
      sourceOfFeedback,
      
      // Device context
      deviceContext,
      
      // Additional fields
      tags = [],
      requiresFollowUp = false,
      followUpDate
    } = req.body;

    // Parse JSON fields that come as strings from FormData
    const userExperienceRating = parseJSONField(req.body.userExperienceRating);
    const performanceIssues = parseJSONField(req.body.performanceIssues);
    const thematicFeedback = parseJSONField(req.body.thematicFeedback);
    const featureSuggestion = parseJSONField(req.body.featureSuggestion);
    const businessImpact = parseJSONField(req.body.businessImpact);
    const systemInfo = parseJSONField(req.body.systemInfo);
    const parsedTags = parseJSONField(req.body.tags) || [];
    const parsedSourceOfFeedback = parseJSONField(req.body.sourceOfFeedback);

    // Enhanced validation based on feedback type
    if (!title || !description) {
      const error = new Error('Title and description are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (!category) {
      const error = new Error('Category is required for proper classification') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate sourceOfFeedback if provided
    if (parsedSourceOfFeedback && (!parsedSourceOfFeedback.source || parsedSourceOfFeedback.source.trim() === '')) {
      const error = new Error('Source of feedback must include a source description') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate assignedToTeamMember if provided
    if (assignedToTeamMember && !['kate', 'sam', 'belinda'].includes(assignedToTeamMember)) {
      const error = new Error('Invalid team member assignment') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate required fields based on feedback type
    switch (feedbackType) {
      case 'bug_report':
        if (!steps || !expectedBehavior || !actualBehavior) {
          const error = new Error('Steps, expected behavior, and actual behavior are required for bug reports') as CustomError;
          error.statusCode = 400;
          throw error;
        }
        break;
      
      case 'user_experience':
        if (!userExperienceRating || !userExperienceRating.overallSatisfaction || userExperienceRating.overallSatisfaction === 0) {
          const error = new Error('Overall satisfaction rating is required for user experience feedback') as CustomError;
          error.statusCode = 400;
          throw error;
        }
        break;
      
      case 'feature_suggestion':
        if (!featureSuggestion || !featureSuggestion.description || !featureSuggestion.description.trim()) {
          const error = new Error('Feature description is required for feature suggestions') as CustomError;
          error.statusCode = 400;
          throw error;
        }
        break;
      
      case 'thematic_feedback':
      case 'general_feedback':
        // No additional validation required for these types
        break;
    }

    // Validate and parse systemInfo
    let parsedSystemInfo = systemInfo;
    if (parsedSystemInfo && (!parsedSystemInfo.url || !parsedSystemInfo.userAgent)) {
      const customError = new Error('Invalid system information provided') as CustomError;
      customError.statusCode = 400;
      throw customError;
    }

    // Process screenshots and attachments
    let processedAttachments: any[] = [];
    let screenshotUrl = null;

    // Handle single screenshot (backward compatibility)
    if (req.file) {
      try {
        // UPDATED: Upload to Cloudinary - uploadFile returns FileUploadResult
        const uploadResult = await uploadFile(req.file, 'bug-reports');
        screenshotUrl = uploadResult.fileUrl;
        
        processedAttachments.push({
          filename: uploadResult.originalName || req.file.originalname,
          url: uploadResult.fileUrl,
          type: 'screenshot',
          uploadedAt: new Date()
        });
      } catch (uploadError) {
        console.error('Screenshot upload error:', uploadError);
        // Continue without screenshot if upload fails
      }
    }

    // Handle multiple files if implemented
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          // UPDATED: Upload each file to Cloudinary
          const uploadResult = await uploadFile(file, 'bug-reports');
          
          const fileType = file.mimetype.startsWith('image/') ? 'screenshot' :
                          file.mimetype.startsWith('video/') ? 'video' :
                          file.mimetype.includes('pdf') || file.mimetype.includes('document') ? 'document' :
                          file.originalname.includes('.log') ? 'log_file' : 'other';
          
          processedAttachments.push({
            filename: uploadResult.originalName || file.originalname,
            url: uploadResult.fileUrl,
            type: fileType,
            uploadedAt: new Date()
          });
        } catch (uploadError) {
          console.error(`File upload error for ${file.originalname}:`, uploadError);
          // Continue with other files
        }
      }
    }

    // Auto-determine priority based on urgency and business impact
    let autoPriority = 'p3'; // default medium
    if (urgencyLevel === 'fix_24_hours' || businessImpact?.functionalityBlocked) {
      autoPriority = 'p0';
    } else if (urgencyLevel === 'fix_1_3_days' || businessImpact?.revenueImpact || businessImpact?.complianceImpact) {
      autoPriority = 'p1';
    } else if (urgencyLevel === 'fix_this_week' || businessImpact?.affectedUsers === 'most' || businessImpact?.affectedUsers === 'all') {
      autoPriority = 'p2';
    } else if (urgencyLevel === 'fix_2_weeks') {
      autoPriority = 'p3';
    } else {
      autoPriority = 'p4';
    }

    const cleanEstimatedEffort = bugType && bugType.trim() !== '' ? bugType : undefined;
    const cleanUrgencyLevel = urgencyLevel && urgencyLevel.trim() !== '' ? urgencyLevel : 'fix_this_week';

    // Create comprehensive bug report object
    const bugReportData: Partial<IBugReport> = {
      // Basic information
      feedbackType,
      title,
      description,
      category,
      subCategory,
      
      // Assessment fields
      urgencyLevel: urgencyLevel,
      ...(cleanEstimatedEffort && { bugType: cleanEstimatedEffort }),
      priority: autoPriority as 'p0' | 'p1' | 'p2' | 'p3' | 'p4',

      // NEW FIELDS:
      ...(assignedToTeamMember && { assignedToTeamMember }),
      ...(parsedSourceOfFeedback && { sourceOfFeedback: parsedSourceOfFeedback }),
      
      // Context and tracking
      deviceContext,
      systemInfo: parsedSystemInfo,
      
      // Files and attachments
      screenshot: screenshotUrl,
      attachments: processedAttachments,
      
      // Additional metadata
      tags: Array.isArray(parsedTags) ? parsedTags : [],
      requiresFollowUp,
      ...(followUpDate && { followUpDate: new Date(followUpDate) }),
      
      // User tracking
      ...(req.user && { reporter: req.user._id }),
      
      // Initialize metrics
      metrics: {
        viewCount: 0,
        commentCount: 0,
        reopenCount: 0
      },
      
      // Default status
      status: 'new',
      resolved: false,
      verified: false,
      verifiedByReporter: false
    };

    // Add type-specific fields only if they exist and are valid
    if (feedbackType === 'bug_report' && steps && expectedBehavior && actualBehavior) {
      bugReportData.steps = steps;
      bugReportData.expectedBehavior = expectedBehavior;
      bugReportData.actualBehavior = actualBehavior;
    }

    if (feedbackType === 'user_experience' && userExperienceRating) {
      bugReportData.userExperienceRating = userExperienceRating;
      if (performanceIssues) {
        bugReportData.performanceIssues = performanceIssues;
      }
    }

    if (feedbackType === 'thematic_feedback' && thematicFeedback) {
      bugReportData.thematicFeedback = thematicFeedback;
    }

    if (feedbackType === 'feature_suggestion' && featureSuggestion) {
      bugReportData.featureSuggestion = featureSuggestion;
    }

    if (businessImpact) {
      bugReportData.businessImpact = businessImpact;
    }

    // Save to database WITHOUT session - single document creation doesn't need transactions
    const bugReport = new BugReport(bugReportData);
    const savedBugReport = await bugReport.save();

    // Send notification to admin/developer team
    try {
      await sendBugReportNotification(savedBugReport);
    } catch (notificationError) {
      console.error('Failed to send bug report notification:', notificationError);
      // Continue even if notification fails
    }

    // Return response with feedback type specific message
    const responseMessages: Record<string, string> = {
      'bug_report': 'Bug report submitted successfully',
      'user_experience': 'User experience feedback submitted successfully',
      'thematic_feedback': 'Thematic feedback submitted successfully', 
      'feature_suggestion': 'Feature suggestion submitted successfully',
      'general_feedback': 'Feedback submitted successfully'
    };

    res.status(201).json({
      success: true,
      message: responseMessages[feedbackType] || 'Report submitted successfully',
      data: { 
        reportId: savedBugReport._id,
        feedbackType: savedBugReport.feedbackType,
        priority: savedBugReport.priority,
        overallScore: savedBugReport.overallScore
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all bug reports with enhanced filtering (admin only)
 * @route GET /api/v1/bug-reports
 * @access Private (Admin only)
 */
export const getBugReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user is authorized (admin/ConnectGo staff)
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Parse enhanced query parameters
    const search = req.query.search as string;
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const feedbackType = req.query.feedbackType as string;
    const category = req.query.category as string;
    const urgencyLevel = req.query.urgencyLevel as string;
    const bugType = req.query.bugType as string;
    const affectedUsers = req.query.affectedUsers as string;
    const assignedToTeamMember = req.query.assignedToTeamMember as string;
    const sourceText = req.query.sourceText as string;
    const assignedTo = req.query.assignedTo as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const tags = req.query.tags as string;
    const verificationStatus = req.query.verificationStatus as string;
    
    // Sorting and pagination
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const skip = (page - 1) * limit;

    // Build enhanced query
    let query: any = {};

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Priority filter
    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    // Feedback type filter
    if (feedbackType && feedbackType !== 'all') {
      query.feedbackType = feedbackType;
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Urgency level filter
    if (urgencyLevel && urgencyLevel !== 'all') {
      query.urgencyLevel = urgencyLevel;
    }

    // Estimated effort filter
    if (bugType && bugType !== 'all') {
      query.bugType = bugType;
    }

    // Affected users filter
    if (affectedUsers && affectedUsers !== 'all') {
      query['businessImpact.affectedUsers'] = affectedUsers;
    }

    // Add new filters to query building
    if (assignedToTeamMember && assignedToTeamMember !== 'all') {
      query.assignedToTeamMember = assignedToTeamMember;
    }

    if (sourceText && sourceText !== 'all') {
      query['sourceOfFeedback.source'] = { $regex: sourceText, $options: 'i' };
    }

    // Assigned to filter
    if (assignedTo && assignedTo !== 'all') {
      query.assignedTo = assignedTo;
    }

    // Verification status filter
    if (verificationStatus && verificationStatus !== 'all') {
      switch (verificationStatus) {
        case 'resolved_unverified':
          query.resolved = true;
          query.verified = false;
          break;
        case 'resolved_verified':
          query.resolved = true;
          query.verified = true;
          break;
        case 'unresolved':
          query.resolved = false;
          break;
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Count total matching documents for pagination
    const total = await BugReport.countDocuments(query);

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination and sorting
    const bugReports = await BugReport.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .select(`
        title feedbackType status priority urgencyLevel category estimatedEffort
        businessImpact.affectedUsers systemInfo.userName systemInfo.userEmail
        tags assignedTo reporter resolved createdAt overallScore
      `)
      .populate('assignedTo', 'name email')
      .populate('reporter', 'name email');

    // Calculate summary statistics
    const stats = await BugReport.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          byStatus: { $push: '$status' },
          byPriority: { $push: '$priority' },
          byFeedbackType: { $push: '$feedbackType' },
          byCategory: { $push: '$category' },
          avgOverallScore: { $avg: '$overallScore' },
          resolvedCount: { $sum: { $cond: ['$resolved', 1, 0] } },
          verifiedCount: { $sum: { $cond: ['$verified', 1, 0] } },
          awaitingVerification: { 
            $sum: { 
              $cond: [
                { $and: ['$resolved', { $eq: ['$verified', false] }] }, 
                1, 
                0
              ] 
            } 
          }
        }
      }
    ]);

    // Return the results with enhanced metadata
    res.status(200).json({
      success: true,
      data: bugReports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + bugReports.length < total
      },
      statistics: stats[0] || {
        totalReports: 0,
        byStatus: [],
        byPriority: [],
        byFeedbackType: [],
        byCategory: [],
        avgOverallScore: 0,
        resolvedCount: 0,
        verifiedCount: 0,
        awaitingVerification: 0
      },
      filters: {
        availableStatuses: ['new', 'triaged', 'resolved', 'verified', 'cannot-reproduce', 'duplicate', 'deferred'],
        availablePriorities: ['p0', 'p1', 'p2', 'p3', 'p4'],
        availableFeedbackTypes: ['bug_report', 'user_experience', 'thematic_feedback', 'feature_suggestion', 'general_feedback'],
        availableCategories: [
          'functionality', 'ui_ux', 'performance', 'security', 'data_integrity', 'integration',
          'navigation', 'layout', 'accessibility', 'responsiveness', 'loading_speed',
          'visual_design', 'branding', 'color_scheme', 'typography', 'iconography',
          'new_feature', 'enhancement', 'workflow_improvement', 'automation',
          'copy',
          'other'
        ],
        availableUrgencyLevels: ['fix_24_hours', 'fix_1_3_days', 'fix_this_week', 'fix_2_weeks', 'fix_next_month', 'later'],
        availableTypes: ['fix', 'food_for_thought', 'pipeline'],
        availableTeamMembers: ['kate', 'sam', 'belinda'],
        availableVerificationStatuses: ['unresolved', 'resolved_unverified', 'resolved_verified']
      }
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Get a single bug report by ID with full details (admin only)
 * @route GET /api/v1/bug-reports/:id
 * @access Private (Admin only)
 */
export const getBugReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user is authorized (admin/ConnectGo staff)
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const reportId = req.params.id;

    // Find the bug report with full population
    const bugReport = await BugReport.findById(reportId)
      .populate('reporter', 'name email')
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('verifiedBy', 'name email') // NEW: Populate verifiedBy
      .populate('relatedIssues', 'title status priority feedbackType');

    if (!bugReport) {
      const error = new Error('Bug report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Increment view count
    await BugReport.findByIdAndUpdate(reportId, { 
      $inc: { 'metrics.viewCount': 1 } 
    });

    res.status(200).json({
      success: true,
      data: bugReport
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid bug report ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update a bug report with enhanced fields (admin only)
 * @route PATCH /api/v1/bug-reports/:id
 * @access Private (Admin only)
 */
export const updateBugReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user is authorized (admin/ConnectGo staff)
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const reportId = req.params.id;
    
    // Parse request body with enhanced fields
    const { 
      status, 
      priority, 
      urgencyLevel,
      bugType,
      assignedToTeamMember,
      sourceOfFeedback,
      assignedTo, 
      resolved, 
      resolution,
      // NEW: Verification fields
      verified,
      verificationDetails,
      businessImpact,
      tags,
      requiresFollowUp,
      followUpDate,
      relatedIssues,
      verifiedByReporter
    } = req.body;
    
    // Build update object
    const updateData: any = {};
    
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (urgencyLevel) updateData.urgencyLevel = urgencyLevel;
    if (bugType) updateData.estimatedEffort = bugType;
    if (assignedToTeamMember !== undefined) updateData.assignedToTeamMember = assignedToTeamMember;
    if (sourceOfFeedback) updateData.sourceOfFeedback = sourceOfFeedback;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (businessImpact) updateData.businessImpact = businessImpact;
    if (tags) updateData.tags = Array.isArray(tags) ? tags : [];
    if (requiresFollowUp !== undefined) updateData.requiresFollowUp = requiresFollowUp;
    if (followUpDate) updateData.followUpDate = new Date(followUpDate);
    if (relatedIssues) updateData.relatedIssues = relatedIssues;
    if (verifiedByReporter !== undefined) updateData.verifiedByReporter = verifiedByReporter;
    
    // Handle resolved status with enhanced logic
    if (resolved !== undefined) {
      updateData.resolved = resolved;
      
      if (resolved) {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = req.user._id;
        updateData.status = 'resolved';
        
        if (resolution) {
          updateData.resolution = resolution;
        } else {
          const error = new Error('Resolution is required when marking as resolved') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      } else {
        // Reopening the issue
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
        updateData.resolution = null;
        updateData.status = 'triaged';
        updateData.$inc = { 'metrics.reopenCount': 1 };
      }
    }

    // NEW: Handle verification logic (only allowed if bug is resolved)
    if (verified !== undefined) {
      // First check if the bug is resolved or being resolved in this same request
      const currentBugReport = await BugReport.findById(reportId);
      if (!currentBugReport) {
        const error = new Error('Bug report not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      const willBeResolved = resolved === true || currentBugReport.resolved;
      
      if (verified && !willBeResolved) {
        const error = new Error('Cannot verify a bug that has not been resolved') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      updateData.verified = verified;
      
      if (verified) {
        updateData.verifiedAt = new Date();
        updateData.verifiedBy = req.user._id;
        
        if (verificationDetails) {
          updateData.verificationDetails = verificationDetails;
        } else {
          const error = new Error('Verification details are required when marking as verified') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      } else {
        // Un-verifying the issue
        updateData.verifiedAt = null;
        updateData.verifiedBy = null;
        updateData.verificationDetails = null;
      }
    }

    // Update the bug report
    const updatedBugReport = await BugReport.findByIdAndUpdate(
      reportId,
      updateData,
      { new: true, runValidators: true }
    ).populate('reporter', 'name email')
     .populate('assignedTo', 'name email')
     .populate('resolvedBy', 'name email')
     .populate('verifiedBy', 'name email') // NEW: Populate verifiedBy
     .populate('relatedIssues', 'title status priority feedbackType');

    if (!updatedBugReport) {
      const error = new Error('Bug report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Send notification to admin/developer team
    try {
      await sendBugReportNotification(updatedBugReport);
    } catch (notificationError) {
      console.error('Failed to send bug report notification:', notificationError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Bug report updated successfully',
      data: updatedBugReport
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid bug report ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * NEW: Verify a resolved bug report
 * @route PATCH /api/v1/bug-reports/:id/verify
 * @access Private (Admin only)
 */
export const verifyBugReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user is authorized (admin/ConnectGo staff)
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const reportId = req.params.id;
    const { verificationDetails } = req.body;

    if (!verificationDetails || !verificationDetails.trim()) {
      const error = new Error('Verification details are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Find the bug report and check if it's resolved
    const bugReport = await BugReport.findById(reportId);
    if (!bugReport) {
      const error = new Error('Bug report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!bugReport.resolved) {
      const error = new Error('Cannot verify a bug that has not been resolved') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (bugReport.verified) {
      const error = new Error('Bug report is already verified') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Update with verification
    const updatedBugReport = await BugReport.findByIdAndUpdate(
      reportId,
      {
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: req.user._id,
        verificationDetails: verificationDetails.trim()
      },
      { new: true, runValidators: true }
    ).populate('reporter', 'name email')
     .populate('assignedTo', 'name email')
     .populate('resolvedBy', 'name email')
     .populate('verifiedBy', 'name email')
     .populate('relatedIssues', 'title status priority feedbackType');

    // Send notification
    try {
      await sendBugReportNotification(updatedBugReport!);
    } catch (notificationError) {
      console.error('Failed to send verification notification:', notificationError);
    }

    res.status(200).json({
      success: true,
      message: 'Bug report verified successfully',
      data: updatedBugReport
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid bug report ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


/**
 * Get analytics and dashboard data for bug reports
 * @route GET /api/v1/bug-reports/analytics
 * @access Private (Admin only)
 */
export const getBugReportAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if user is authorized (admin/ConnectGo staff)
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    // Build date filter
    let dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter = { createdAt: {} } as any;
      if (dateFrom) (dateFilter as any).createdAt.$gte = new Date(dateFrom);
      if (dateTo) (dateFilter as any).createdAt.$lte = new Date(dateTo);
    }

    // Run comprehensive analytics aggregation
    const analytics = await BugReport.aggregate([
      { $match: dateFilter },
      {
        $facet: {
          // Overall statistics
          overallStats: [
            {
              $group: {
                _id: null,
                totalReports: { $sum: 1 },
                avgOverallScore: { $avg: '$overallScore' },
                avgResolutionTime: { $avg: '$metrics.timeToResolution' },
                totalViewCount: { $sum: '$metrics.viewCount' },
                // NEW: Verification statistics
                resolvedCount: { $sum: { $cond: ['$resolved', 1, 0] } },
                verifiedCount: { $sum: { $cond: ['$verified', 1, 0] } },
                awaitingVerification: { 
                  $sum: { 
                    $cond: [
                      { $and: ['$resolved', { $eq: ['$verified', false] }] }, 
                      1, 
                      0
                    ] 
                  } 
                }
              }
            }
          ],
          
          // Status breakdown
          statusBreakdown: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          
          // Priority breakdown
          priorityBreakdown: [
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ],
          
          // Feedback type breakdown
          feedbackTypeBreakdown: [
            { $group: { _id: '$feedbackType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          
          // Category breakdown
          categoryBreakdown: [
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],

          // NEW: Verification status breakdown
          verificationBreakdown: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ['$resolved', false] },
                    'unresolved',
                    {
                      $cond: [
                        { $eq: ['$verified', true] },
                        'verified',
                        'awaiting_verification'
                      ]
                    }
                  ]
                },
                count: { $sum: 1 }
              }
            }
          ],
          
          // Urgency vs Type matrix
          urgencyTypeMatrix: [
            {
              $group: {
                _id: { urgency: '$urgencyLevel', type: '$bugType' },
                count: { $sum: 1 },
                avgScore: { $avg: '$overallScore' }
              }
            }
          ],
          
          // Business impact analysis
          businessImpactAnalysis: [
            {
              $group: {
                _id: '$businessImpact.affectedUsers',
                count: { $sum: 1 },
                functionalityBlocked: { $sum: { $cond: ['$businessImpact.functionalityBlocked', 1, 0] } },
                revenueImpact: { $sum: { $cond: ['$businessImpact.revenueImpact', 1, 0] } }
              }
            }
          ],
          
          // Trends over time
          trendsOverTime: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                  week: { $week: '$createdAt' }
                },
                count: { $sum: 1 },
                resolved: { $sum: { $cond: ['$resolved', 1, 0] } },
                verified: { $sum: { $cond: ['$verified', 1, 0] } } // NEW
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: analytics[0],
      generatedAt: new Date(),
      dateRange: { from: dateFrom, to: dateTo }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  submitBugReport,
  getBugReports,
  getBugReport,
  updateBugReport,
  verifyBugReport, // NEW: Add the new verification endpoint
  getBugReportAnalytics
};