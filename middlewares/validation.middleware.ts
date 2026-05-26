// middlewares/validation.middleware.ts - Bug Report Validation
import { Request, Response, NextFunction } from 'express';
import { CustomError } from './error.middleware';
import mongoose from 'mongoose';


function parseFormDataField(field: any) {
  if (!field) return undefined;
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      // If it's an object, convert string numbers to actual numbers
      if (typeof parsed === 'object' && parsed !== null) {
        return convertStringNumbersToNumbers(parsed);
      }
      return parsed;
    } catch (e) {
      return undefined;
    }
  }
  return field;
}

// Add this new helper function right after parseFormDataField:

function convertStringNumbersToNumbers(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => convertStringNumbersToNumbers(item));
  } else if (typeof obj === 'object' && obj !== null) {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        // Convert numeric strings to numbers
        converted[key] = Number(value);
      } else if (typeof value === 'object') {
        // Recursively convert nested objects
        converted[key] = convertStringNumbersToNumbers(value);
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }
  return obj;
}


/**
 * Validate bug report submission data
 */
export const validateBugReport = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    console.log('=== VALIDATION DEBUG ===');
    console.log('Raw req.body.feedbackType:', req.body.feedbackType);
    console.log('Type of feedbackType:', typeof req.body.feedbackType);
    console.log('All body keys:', Object.keys(req.body));
    console.log('=== END VALIDATION DEBUG ===');

    const {
      feedbackType = 'bug_report',
      title,
      description,
      category,
      urgencyLevel,
      bugType,
    } = req.body;

    console.log('Parsed feedbackType after destructuring:', feedbackType);

    // Parse JSON fields that might come as strings from FormData
    const userExperienceRating = parseFormDataField(req.body.userExperienceRating);
    const featureSuggestion = parseFormDataField(req.body.featureSuggestion);
    const thematicFeedback = parseFormDataField(req.body.thematicFeedback);
    const performanceIssues = parseFormDataField(req.body.performanceIssues);
    const businessImpact = parseFormDataField(req.body.businessImpact);
    const systemInfo = parseFormDataField(req.body.systemInfo);
    const tags = parseFormDataField(req.body.tags);

    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      const error = new Error('Title is required and must be at least 2 characters') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (!description || typeof description !== 'string' || description.trim().length < 2) {
      const error = new Error('Description is required and must be at least 2 characters') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (!category || typeof category !== 'string') {
      const error = new Error('Category is required for proper classification') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate feedbackType
    const validFeedbackTypes = ['bug_report', 'user_experience', 'thematic_feedback', 'feature_suggestion', 'general_feedback'];
    if (!validFeedbackTypes.includes(feedbackType)) {
      const error = new Error(`Invalid feedback type. Must be one of: ${validFeedbackTypes.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate category
    const validCategories = [
      'functionality', 'ui_ux', 'performance', 'security', 'data_integrity', 'integration',
      'navigation', 'layout', 'accessibility', 'responsiveness', 'loading_speed',
      'visual_design', 'branding', 'color_scheme', 'typography', 'iconography',
      'new_feature', 'enhancement', 'workflow_improvement', 'automation', 
      'copy', // NEW: Added copy category
      'other'
    ];
    if (!validCategories.includes(category)) {
      const error = new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate urgency level
    if (urgencyLevel) {
      const validUrgencyLevels = ['fix_24_hours', 'fix_1_3_days', 'fix_this_week', 'fix_2_weeks', 'fix_next_month', 'later'];
      if (!validUrgencyLevels.includes(urgencyLevel)) {
        const error = new Error(`Invalid urgency level. Must be one of: ${validUrgencyLevels.join(', ')}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate estimated effort
    if (bugType) {
      const validEffortLevels = ['fix', 'food_for_thought', 'pipeline'];
      if (!validEffortLevels.includes(bugType)) {
        const error = new Error(`Invalid estimated effort. Must be one of: ${validEffortLevels.join(', ')}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    console.log(`About to validate for feedback type: ${feedbackType}`);

    // Validate specific requirements based on feedback type - use parsed objects
    switch (feedbackType) {
      case 'bug_report':
        console.log('Calling validateBugReportSpecific');
        validateBugReportSpecific(req.body);
        // Don't validate other type-specific data for bug reports
        break;
        
      case 'user_experience':
        console.log('Calling validateUserExperienceSpecific');
        validateUserExperienceSpecific({ userExperienceRating });
        // Only validate user experience data for user experience feedback
        if (userExperienceRating) {
          validateUserExperienceRating(userExperienceRating);
        }
        if (performanceIssues) {
          validatePerformanceIssues(performanceIssues);
        }
        break;
        
      case 'thematic_feedback':
        console.log('Calling validateThematicFeedbackSpecific');
        validateThematicFeedbackSpecific({ thematicFeedback });
        // Only validate thematic data for thematic feedback
        if (thematicFeedback) {
          validateThematicFeedbackData(thematicFeedback);
        }
        break;
        
      case 'feature_suggestion':
        console.log('Calling validateFeatureSuggestionSpecific');
        validateFeatureSuggestionSpecific({ featureSuggestion });
        break;
        
      case 'general_feedback':
        console.log('No additional validation for general feedback');
        break;
    }

    // Validate business impact if provided
    if (businessImpact) {
      validateBusinessImpact(businessImpact);
    }

    // Validate system info
    if (systemInfo) {
      validateSystemInfo(systemInfo);
    }

    // Validate tags if provided
    if (tags) {
      validateTags(tags);
    }

    // Validate file uploads
    if (req.files && Array.isArray(req.files)) {
      validateFileUploads(req.files);
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    next(error);
  }
};


/**
 * Validate bug report specific fields
 */
function validateBugReportSpecific(body: any): void {
  const { steps, expectedBehavior, actualBehavior, feedbackType } = body;

  console.log('=== validateBugReportSpecific DEBUG ===');
  console.log('feedbackType in body:', feedbackType);
  console.log('Type of feedbackType:', typeof feedbackType);
  console.log('feedbackType !== "bug_report":', feedbackType !== 'bug_report');
  console.log('=== END validateBugReportSpecific DEBUG ===');

  // Only validate these fields if this is actually a bug report
  if (feedbackType !== 'bug_report') {
    console.log('Skipping bug report validation - not a bug report');
    return; // Skip validation if not a bug report
  }

  console.log('Proceeding with bug report validation');

  if (!steps || typeof steps !== 'string' || steps.trim().length < 5) {
    const error = new Error('Steps to reproduce are required for bug reports and must be descriptive') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  if (!expectedBehavior || typeof expectedBehavior !== 'string' || expectedBehavior.trim().length < 5) {
    const error = new Error('Expected behavior is required for bug reports and must be descriptive') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  if (!actualBehavior || typeof actualBehavior !== 'string' || actualBehavior.trim().length < 5) {
    const error = new Error('Actual behavior is required for bug reports and must be descriptive') as CustomError;
    error.statusCode = 400;
    throw error;
  }
}


/**
 * Validate user experience specific fields - FIXED
 */
function validateUserExperienceSpecific(body: any): void {
  const { userExperienceRating } = body;

  // Only validate if this is actually a user experience feedback
  if (!userExperienceRating || 
      !userExperienceRating.overallSatisfaction || 
      userExperienceRating.overallSatisfaction === 0) {
    const error = new Error('Overall satisfaction rating is required for user experience feedback') as CustomError;
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validate thematic feedback specific fields - FIXED
 */
function validateThematicFeedbackSpecific(body: any): void {
  const { thematicFeedback } = body;

  if (!thematicFeedback || 
      (!thematicFeedback.lookAndFeelRating && !thematicFeedback.specificThematicComments)) {
    const error = new Error('Thematic feedback requires either a look & feel rating or specific comments') as CustomError;
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validate feature suggestion specific fields - FIXED
 */
function validateFeatureSuggestionSpecific(body: any): void {
  const { featureSuggestion } = body;

  if (!featureSuggestion || 
      !featureSuggestion.description || 
      featureSuggestion.description.trim().length < 10) {
    const error = new Error('Feature description is required and must be at least 10 characters') as CustomError;
    error.statusCode = 400;
    throw error;
  }
}


/**
 * Validate user experience rating object - FIXED
 */
function validateUserExperienceRating(rating: any): void {
  if (!rating || typeof rating !== 'object') {
    const error = new Error('User experience rating must be an object') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  const ratingFields = ['overallSatisfaction', 'easeOfUse', 'speed', 'visualAppeal', 'functionalityClarity'];
  
  for (const field of ratingFields) {
    if (rating[field] !== undefined && rating[field] !== null && rating[field] !== '') {
      // Convert to number if it's a string number
      const numericValue = typeof rating[field] === 'string' ? 
        parseFloat(rating[field]) : rating[field];
      
      // Check if it's a valid number
      if (isNaN(numericValue) || numericValue < 1 || numericValue > 5) {
        const error = new Error(`${field} must be a number between 1 and 5`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
      
      // Update the rating object with the numeric value for future use
      rating[field] = numericValue;
    }
  }

  // At least overallSatisfaction is required
  const overallSat = typeof rating.overallSatisfaction === 'string' ? 
    parseFloat(rating.overallSatisfaction) : rating.overallSatisfaction;
    
  if (!overallSat || overallSat === 0 || isNaN(overallSat)) {
    const error = new Error('Overall satisfaction rating is required') as CustomError;
    error.statusCode = 400;
    throw error;
  }
  
  // Update with numeric value
  rating.overallSatisfaction = overallSat;
}


/**
 * Validate feature suggestion data
 */
function validateFeatureSuggestionData(suggestion: any): void {
  if (!suggestion.description || typeof suggestion.description !== 'string' || suggestion.description.trim().length < 10) {
    const error = new Error('Feature description must be at least 10 characters') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  const validValues = ['low', 'medium', 'high'];
  
  if (suggestion.businessValue && !validValues.includes(suggestion.businessValue)) {
    const error = new Error(`Business value must be one of: ${validValues.join(', ')}`) as CustomError;
    error.statusCode = 400;
    throw error;
  }

  if (suggestion.userImpact && !validValues.includes(suggestion.userImpact)) {
    const error = new Error(`User impact must be one of: ${validValues.join(', ')}`) as CustomError;
    error.statusCode = 400;
    throw error;
  }

  if (suggestion.suggestedPriority && !validValues.includes(suggestion.suggestedPriority)) {
    const error = new Error(`Suggested priority must be one of: ${validValues.join(', ')}`) as CustomError;
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validate thematic feedback data
 */
function validateThematicFeedbackData(feedback: any): void {
  const ratingFields = ['lookAndFeelRating', 'fontReadability', 'layoutIntuitive', 'brandConsistency'];
  
  for (const field of ratingFields) {
    if (feedback[field] !== undefined) {
      if (typeof feedback[field] !== 'number' || feedback[field] < 1 || feedback[field] > 5) {
        const error = new Error(`${field} must be a number between 1 and 5`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
  }

  if (feedback.colorSchemeAppropriate !== undefined && typeof feedback.colorSchemeAppropriate !== 'boolean') {
    const error = new Error('Color scheme appropriate must be a boolean value') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  if (feedback.specificThematicComments && typeof feedback.specificThematicComments !== 'string') {
    const error = new Error('Specific thematic comments must be a string') as CustomError;
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validate performance issues data
 */
function validatePerformanceIssues(performance: any): void {
  if (performance.pageLoadTime !== undefined) {
    if (typeof performance.pageLoadTime !== 'number' || performance.pageLoadTime < 0) {
      const error = new Error('Page load time must be a positive number') as CustomError;
      error.statusCode = 400;
      throw error;
    }
  }

  if (performance.timeToInteractive !== undefined) {
    if (typeof performance.timeToInteractive !== 'number' || performance.timeToInteractive < 0) {
      const error = new Error('Time to interactive must be a positive number') as CustomError;
      error.statusCode = 400;
      throw error;
    }
  }

  if (performance.specificSlowAreas && !Array.isArray(performance.specificSlowAreas)) {
    const error = new Error('Specific slow areas must be an array') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  if (performance.browserFreeze !== undefined && typeof performance.browserFreeze !== 'boolean') {
    const error = new Error('Browser freeze must be a boolean value') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  if (performance.memoryIssues !== undefined && typeof performance.memoryIssues !== 'boolean') {
    const error = new Error('Memory issues must be a boolean value') as CustomError;
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Validate business impact data
 */
function validateBusinessImpact(impact: any): void {
  const validAffectedUsers = ['few', 'some', 'many', 'most', 'all'];
  
  if (impact.affectedUsers && !validAffectedUsers.includes(impact.affectedUsers)) {
    const error = new Error(`Affected users must be one of: ${validAffectedUsers.join(', ')}`) as CustomError;
    error.statusCode = 400;
    throw error;
  }

  const booleanFields = ['functionalityBlocked', 'workaroundAvailable', 'revenueImpact', 'complianceImpact'];
  
  for (const field of booleanFields) {
    if (impact[field] !== undefined && typeof impact[field] !== 'boolean') {
      const error = new Error(`${field} must be a boolean value`) as CustomError;
      error.statusCode = 400;
      throw error;
    }
  }
}

/**
 * Validate system info data
 */
function validateSystemInfo(systemInfo: any): void {
  // Parse if string
  let parsedSystemInfo;
  try {
    parsedSystemInfo = typeof systemInfo === 'string' ? JSON.parse(systemInfo) : systemInfo;
  } catch (error) {
    const customError = new Error('System info must be valid JSON') as CustomError;
    customError.statusCode = 400;
    throw customError;
  }

  // Required fields
  const requiredFields = ['url', 'userAgent', 'platform', 'screenSize', 'timestamp'];
  
  for (const field of requiredFields) {
    if (!parsedSystemInfo[field] || typeof parsedSystemInfo[field] !== 'string') {
      const error = new Error(`System info must include valid ${field}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate URL format
  try {
    new URL(parsedSystemInfo.url);
  } catch (error) {
    const customError = new Error('System info URL must be a valid URL') as CustomError;
    customError.statusCode = 400;
    throw customError;
  }

  // Validate device type if provided
  if (parsedSystemInfo.deviceType) {
    const validDeviceTypes = ['desktop', 'mobile', 'tablet'];
    if (!validDeviceTypes.includes(parsedSystemInfo.deviceType)) {
      const error = new Error(`Device type must be one of: ${validDeviceTypes.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }
  }
}

/**
 * Validate tags array
 */
function validateTags(tags: any): void {
  if (!Array.isArray(tags)) {
    const error = new Error('Tags must be an array') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  if (tags.length > 10) {
    const error = new Error('Maximum 10 tags allowed') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.trim().length === 0) {
      const error = new Error('Each tag must be a non-empty string') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (tag.length > 50) {
      const error = new Error('Each tag must be 50 characters or less') as CustomError;
      error.statusCode = 400;
      throw error;
    }
  }
}

/**
 * Validate file uploads
 */
function validateFileUploads(files: any[]): void {
  if (files.length > 5) {
    const error = new Error('Maximum 5 files allowed per report') as CustomError;
    error.statusCode = 400;
    throw error;
  }

  for (const file of files) {
    // Check file size (already handled by multer, but double-check)
    if (file.size > 10 * 1024 * 1024) { // 10MB
      const error = new Error(`File ${file.originalname} is too large. Maximum size is 10MB`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check filename length
    if (file.originalname.length > 100) {
      const error = new Error(`Filename ${file.originalname} is too long. Maximum 100 characters`) as CustomError;
      error.statusCode = 400;
      throw error;
    }
  }
}

/**
 * Optional authentication middleware - allows both authenticated and anonymous users
 * Works with your existing authorize middleware
 */
export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Try to get token from header
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // If token exists, try to authenticate using your existing authorize middleware
    const authorize = require('../middlewares/auth.middleware').default;
    
    authorize(req, res, (error: any) => {
      // If authentication fails, continue anyway (optional auth)
      if (error) {
        console.warn('Optional authentication failed:', error.message);
        // Clear any partial user data and continue as anonymous
        req.user = undefined;
      }
      next();
    });
  } else {
    // No token provided, continue as anonymous user
    req.user = undefined;
    next();
  }
};

/**
 * Validate bug report update data (for PATCH requests)
 */
export const validateBugReportUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const {
      status,
      priority,
      urgencyLevel,
      estimatedEffort,
      businessImpact,
      tags,
      resolution
    } = req.body;

    // Validate status if provided
    if (status) {
      const validStatuses = [
        'new', 'triaged', 'in-progress', 'pending-review', 'testing',
        'resolved', 'cannot-reproduce', 'wont-fix', 'duplicate', 'deferred'
      ];
      if (!validStatuses.includes(status)) {
        const error = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['p0', 'p1', 'p2', 'p3', 'p4'];
      if (!validPriorities.includes(priority)) {
        const error = new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate urgency level if provided
    if (urgencyLevel) {
      const validUrgencyLevels = ['low', 'medium', 'high', 'critical', 'blocker'];
      if (!validUrgencyLevels.includes(urgencyLevel)) {
        const error = new Error(`Invalid urgency level. Must be one of: ${validUrgencyLevels.join(', ')}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate estimated effort if provided
    if (estimatedEffort) {
      const validEffortLevels = ['trivial', 'minor', 'moderate', 'major', 'epic'];
      if (!validEffortLevels.includes(estimatedEffort)) {
        const error = new Error(`Invalid estimated effort. Must be one of: ${validEffortLevels.join(', ')}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate business impact if provided
    if (businessImpact) {
      validateBusinessImpact(businessImpact);
    }

    // Validate tags if provided
    if (tags) {
      validateTags(tags);
    }

    // Validate resolution if provided
    if (resolution && (typeof resolution !== 'string' || resolution.trim().length < 5)) {
      const error = new Error('Resolution must be at least 5 characters when provided') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validates that a route parameter is a valid MongoDB ObjectId
 * @param paramName - The name of the parameter to validate (e.g., 'reportId', 'projectId')
 * @returns Express middleware function
 */
export const validateObjectId = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];

    if (!id) {
      const error = new Error(`${paramName} parameter is required`) as CustomError;
      error.statusCode = 400;
      return next(error);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error(`Invalid ${paramName} format`) as CustomError;
      error.statusCode = 400;
      return next(error);
    }

    next();
  };
};

/**
 * Validates multiple ObjectId parameters at once
 * @param paramNames - Array of parameter names to validate
 * @returns Express middleware function
 */
export const validateMultipleObjectIds = (paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const id = req.params[paramName];

      if (!id) {
        const error = new Error(`${paramName} parameter is required`) as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error(`Invalid ${paramName} format`) as CustomError;
        error.statusCode = 400;
        return next(error);
      }
    }

    next();
  };
};

/**
 * Validates ObjectId in request body
 * @param fieldName - The name of the field in request body to validate
 * @param required - Whether the field is required (default: true)
 * @returns Express middleware function
 */
export const validateObjectIdInBody = (fieldName: string, required: boolean = true) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.body[fieldName];

    if (!id) {
      if (required) {
        const error = new Error(`${fieldName} is required`) as CustomError;
        error.statusCode = 400;
        return next(error);
      }
      return next(); // Optional field, continue
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error(`Invalid ${fieldName} format`) as CustomError;
      error.statusCode = 400;
      return next(error);
    }

    next();
  };
};

/**
 * Validates array of ObjectIds in request body
 * @param fieldName - The name of the field in request body to validate
 * @param required - Whether the field is required (default: true)
 * @returns Express middleware function
 */
export const validateObjectIdArray = (fieldName: string, required: boolean = true) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ids = req.body[fieldName];

    if (!ids) {
      if (required) {
        const error = new Error(`${fieldName} is required`) as CustomError;
        error.statusCode = 400;
        return next(error);
      }
      return next(); // Optional field, continue
    }

    if (!Array.isArray(ids)) {
      const error = new Error(`${fieldName} must be an array`) as CustomError;
      error.statusCode = 400;
      return next(error);
    }

    if (ids.length === 0) {
      const error = new Error(`${fieldName} cannot be empty`) as CustomError;
      error.statusCode = 400;
      return next(error);
    }

    for (let i = 0; i < ids.length; i++) {
      if (!mongoose.Types.ObjectId.isValid(ids[i])) {
        const error = new Error(`Invalid ObjectId at index ${i} in ${fieldName}`) as CustomError;
        error.statusCode = 400;
        return next(error);
      }
    }

    next();
  };
};