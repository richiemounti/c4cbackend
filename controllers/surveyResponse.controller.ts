// controllers/surveyResponse.controller.ts - UPDATED WITH CLOUDINARY
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import SurveyResponse from "../models/surveyResponse.model";
import QuestionResponse from "../models/questionResponse.model";
import Survey from "../models/survey.model";
import SurveyQuestion from "../models/surveyQuestion.model";
import { CustomError } from "../middlewares/error.middleware";
import { userHasProjectAccess } from "../lib/authHelpers";
import * as cloudinaryService from "../services/cloudinaryStorage.service";

type AuthUser = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
};

/**
 * Start a new survey response
 * @route POST /api/v1/surveys/:surveyId/responses/start
 * @access Public/Private (depending on survey settings)
 */
export const startSurveyResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyResponse.db.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { 
      respondentInfo, 
      metadata,
      translationId,
      language,
      consentGiven,
      consentFormId
    } = req.body;

    // Check if survey exists and is active
    const survey = await Survey.findById(surveyId)
      .populate('consentForm');
    
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.status !== 'published') {
      const error = new Error('Survey is not currently accepting responses') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // FIX: Check consent requirements with proper type handling
    if (survey.consentForm && survey.consentRequired) {
      if (consentGiven !== true) {
        const error = new Error('Consent is required to start this survey') as CustomError;
        error.statusCode = 400;
        throw error;
      }
      
      // FIX: Handle both populated and unpopulated consent form
      let surveyConsentFormId: string;
      
      if (typeof survey.consentForm === 'object' && survey.consentForm !== null) {
        // Consent form is populated
        surveyConsentFormId = (survey.consentForm as any)._id.toString();
      } else {
        // Consent form is just an ID
        surveyConsentFormId = (survey.consentForm as mongoose.Types.ObjectId).toString();
      }
      
      if (consentFormId !== surveyConsentFormId) {
        const error = new Error('Invalid consent form') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Check date restrictions
    if (survey.settings?.startDate && new Date(survey.settings.startDate) > new Date()) {
      const error = new Error('Survey is not yet open for responses') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (survey.settings?.endDate && new Date(survey.settings.endDate) < new Date()) {
      const error = new Error('Survey is closed for responses') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate translation if provided
    let validatedTranslation = null;
    let validatedLanguage = survey.defaultLanguage || 'en';

    if (translationId) {
      const SurveyTranslation = mongoose.model('SurveyTranslation');
      validatedTranslation = await SurveyTranslation.findById(translationId);

      if (!validatedTranslation) {
        const error = new Error('Translation not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      if ((validatedTranslation as any).survey.toString() !== surveyId) {
        const error = new Error('Translation does not belong to this survey') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      if ((validatedTranslation as any).status !== 'published') {
        const error = new Error('Translation is not published') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      validatedLanguage = (validatedTranslation as any).language;
    } else if (language) {
      if (survey.availableLanguages && !survey.availableLanguages.includes(language.toLowerCase())) {
        const error = new Error(`Survey is not available in language: ${language}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
      validatedLanguage = language.toLowerCase();
    }

    // FIX: Prepare consent data with proper type handling
    let consentData: any = {};
    if (survey.consentForm && consentGiven === true) {
      let consentFormData: any;
      
      // Check if consent form is already populated
      if (typeof survey.consentForm === 'object' && survey.consentForm !== null && (survey.consentForm as any)._id) {
        consentFormData = survey.consentForm;
      } else {
        // Need to fetch the consent form
        const ConsentForm = mongoose.model('ConsentForm');
        consentFormData = await ConsentForm.findById(survey.consentForm);
      }
      
      if (consentFormData) {
        consentData = {
          consentGiven: true,
          consentFormId: consentFormData._id,
          consentFormVersion: consentFormData.version,
          consentTimestamp: new Date(),
          consentFormSnapshot: {
            _id: consentFormData._id,
            name: consentFormData.name,
            description: consentFormData.description,
            version: consentFormData.version
          }
        };
      }
    }

    // Create the response
    const surveyResponse = new SurveyResponse({
      survey: surveyId,
      translation: validatedTranslation?._id,
      language: validatedLanguage,
      respondent: req.user ? req.user._id : undefined,
      respondentInfo: req.user ? undefined : respondentInfo,
      metadata,
      ...consentData,
      status: 'started',
      progress: 0,
      startedAt: new Date(),
      lastActivityAt: new Date()
    });

    await surveyResponse.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Survey response started',
      data: {
        _id: surveyResponse._id,
        responseId: surveyResponse._id,
        status: surveyResponse.status,
        language: surveyResponse.language,
        startedAt: surveyResponse.startedAt,
        consentGiven: surveyResponse.consentGiven
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Submit an answer to a question (WITH FILE UPLOAD SUPPORT)
 * @route POST /api/v1/surveys/:surveyId/responses/:responseId/answers
 * @access Public/Private (depending on the survey)
 */
// controllers/surveyResponse.controller.ts

export const submitAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyResponse.db.startSession();
  session.startTransaction();

  try {
    const { surveyId, responseId } = req.params;
    
    // ✅ FIX: Get surveyQuestionId from body (works for both JSON and FormData)
    const surveyQuestionId = req.body.surveyQuestionId;
    const answer = req.body.answer;
    const metadata = req.body.metadata;
    const descriptorAnswers = req.body.descriptorAnswers;

    console.log('Submit answer - received data:', {
      surveyId,
      responseId,
      surveyQuestionId,
      answer,
      descriptorAnswers,
      hasFile: !!req.file,
      body: req.body,
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });

    // Validate input - surveyQuestionId is required
    if (!surveyQuestionId) {
      console.error('Missing surveyQuestionId:', {
        body: req.body,
        params: req.params
      });
      const error = new Error('Survey question ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if response exists
    const surveyResponse = await SurveyResponse.findById(responseId);
    if (!surveyResponse) {
      const error = new Error('Survey response not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (req.user && surveyResponse.respondent && 
        surveyResponse.respondent.toString() !== (req.user as AuthUser)._id.toString()) {
      const error = new Error('Not authorized to modify this response') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check if response is still active
    if (surveyResponse.status === 'completed' || surveyResponse.status === 'abandoned') {
      const error = new Error('Cannot modify a completed or abandoned response') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if survey question exists
    const surveyQuestion = await SurveyQuestion.findById(surveyQuestionId)
      .populate('question');
    
    if (!surveyQuestion) {
      const error = new Error('Survey question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (surveyQuestion.survey.toString() !== surveyResponse.survey.toString()) {
      const error = new Error('Question does not belong to this survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Handle file upload if question type is 'file' AND a file was uploaded
    let processedAnswer = answer;
    const questionType = (surveyQuestion.question as any).type;
    
    if (questionType === 'file' && req.file) {
      try {
        console.log(`📎 Processing file upload for question ${surveyQuestionId}`);
        
        // Upload file to Cloudinary
        const uploadResult = await cloudinaryService.uploadFile(
          req.file,
          `survey-responses/${surveyId}/${responseId}`
        );

        // Store file metadata as answer
        processedAnswer = {
          filename: uploadResult.originalName,
          fileUrl: uploadResult.fileUrl,
          publicId: uploadResult.publicId,
          size: uploadResult.size,
          mimeType: uploadResult.mimeType,
          uploadedAt: new Date().toISOString()
        };

        console.log(`✅ File uploaded successfully: ${uploadResult.fileUrl}`);
      } catch (uploadError: any) {
        console.error('❌ File upload failed:', uploadError);
        await session.abortTransaction();
        session.endSession();
        const error = new Error(`File upload failed: ${uploadError.message}`) as CustomError;
        error.statusCode = 500;
        throw error;
      }
    }

    // Check if an answer already exists
    const existingAnswer = await QuestionResponse.findOne({
      surveyResponse: responseId,
      surveyQuestion: surveyQuestionId
    });

    if (existingAnswer) {
      // If updating a file answer, delete the old file from Cloudinary
      if (questionType === 'file' && existingAnswer.answer?.publicId) {
        try {
          await cloudinaryService.deleteFile(
            existingAnswer.answer.publicId,
            existingAnswer.answer.mimeType?.startsWith('image/') ? 'image' : 'raw'
          );
          console.log(`🗑️ Old file deleted: ${existingAnswer.answer.publicId}`);
        } catch (deleteError) {
          console.warn('⚠️ Failed to delete old file:', deleteError);
          // Continue anyway - this is not critical
        }
      }

      // Update the existing answer
      existingAnswer.answer = processedAnswer;
      if (descriptorAnswers !== undefined) {
        existingAnswer.descriptorAnswers = descriptorAnswers;
      }
      if (metadata) {
        existingAnswer.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      }
      await existingAnswer.save({ session });
    } else {
      // Create a new answer
      const questionResponse = new QuestionResponse({
        surveyResponse: responseId,
        surveyQuestion: surveyQuestionId,
        answer: processedAnswer,
        descriptorAnswers: descriptorAnswers || undefined,
        metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : undefined
      });

      await questionResponse.save({ session });
    }

    // Update the last activity timestamp
    surveyResponse.lastActivityAt = new Date();
    await surveyResponse.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Answer submitted successfully',
      data: {
        responseId,
        surveyQuestionId,
        answer: processedAnswer,
        descriptorAnswers: descriptorAnswers || undefined
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update progress of a response
 * @route PUT /api/v1/surveys/:surveyId/responses/:responseId/progress
 * @access Public/Private
 */
export const updateProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { surveyId, responseId } = req.params;
    const { progress } = req.body;

    if (progress === undefined || typeof progress !== 'number' || progress < 0 || progress > 100) {
      const error = new Error('Valid progress value (0-100) is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const surveyResponse = await SurveyResponse.findById(responseId);
    if (!surveyResponse) {
      const error = new Error('Survey response not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (req.user && surveyResponse.respondent && 
        surveyResponse.respondent.toString() !== (req.user as AuthUser)._id.toString()) {
      const error = new Error('Not authorized to modify this response') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    if (surveyResponse.status === 'completed' || surveyResponse.status === 'abandoned') {
      const error = new Error('Cannot modify a completed or abandoned response') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    surveyResponse.progress = progress;
    surveyResponse.lastActivityAt = new Date();
    
    if (progress >= 100) {
      surveyResponse.status = 'completed';
      surveyResponse.completedAt = new Date();
    } else if (progress > 0 && surveyResponse.status === 'started') {
      surveyResponse.status = 'inProgress';
    }

    await surveyResponse.save();

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      data: {
        responseId,
        progress: surveyResponse.progress,
        status: surveyResponse.status
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid response ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Complete a survey response
 * @route PUT /api/v1/surveys/:surveyId/responses/:responseId/complete
 * @access Public/Private
 */
export const completeSurveyResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { surveyId, responseId } = req.params;

    const surveyResponse = await SurveyResponse.findById(responseId);
    if (!surveyResponse) {
      const error = new Error('Survey response not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (req.user && surveyResponse.respondent && 
        surveyResponse.respondent.toString() !== (req.user as AuthUser)._id.toString()) {
      const error = new Error('Not authorized to modify this response') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    if (surveyResponse.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Response is already completed',
        data: {
          responseId,
          status: surveyResponse.status,
          completedAt: surveyResponse.completedAt
        }
      });
    }

    if (surveyResponse.status === 'abandoned') {
      const error = new Error('Cannot complete an abandoned response') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    surveyResponse.status = 'completed';
    surveyResponse.progress = 100;
    surveyResponse.completedAt = new Date();
    surveyResponse.lastActivityAt = new Date();

    await surveyResponse.save();

    res.status(200).json({
      success: true,
      message: 'Survey response completed successfully',
      data: {
        responseId,
        status: surveyResponse.status,
        completedAt: surveyResponse.completedAt
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid response ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


/**
 * Get a survey response by ID
 * @route GET /api/v1/responses/:responseId
 * @access Private
 */
export const getSurveyResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { responseId } = req.params;

    // Find the response
    const surveyResponse = await SurveyResponse.findById(responseId)
      .populate('respondent', 'name email');
    
    if (!surveyResponse) {
      const error = new Error('Survey response not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Get the survey to check permissions
    const survey = await Survey.findById(surveyResponse.survey);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to access this response
    if (!req.user?.isConnectGoStaff) {
      // If it's the respondent's own response, allow access
      const isOwn = req.user && surveyResponse.respondent && 
                    surveyResponse.respondent._id.toString() === (req.user as AuthUser)._id.toString();
      
      // Otherwise, check project access
      const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());      
      if (!isOwn && !hasProjectAccess) {
        const error = new Error('Not authorized to access this response') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Determine whether to include answers based on query params
    const includeAnswers = req.query.includeAnswers === 'true';
    
    let responseData: any = {
      _id: surveyResponse._id,
      survey: surveyResponse.survey,
      status: surveyResponse.status,
      progress: surveyResponse.progress,
      startedAt: surveyResponse.startedAt,
      completedAt: surveyResponse.completedAt,
      lastActivityAt: surveyResponse.lastActivityAt,
      metadata: surveyResponse.metadata
    };
    
    // Add respondent info if available
    if (surveyResponse.respondent) {
      responseData.respondent = surveyResponse.respondent;
    } else if (surveyResponse.respondentInfo) {
      responseData.respondentInfo = surveyResponse.respondentInfo;
    }
    
    // Include answers if requested
    if (includeAnswers) {
      const answers = await QuestionResponse.find({ surveyResponse: responseId })
        .populate({
          path: 'surveyQuestion',
          select: 'question customText customDescription',
          populate: {
            path: 'question',
            select: 'text description type options'
          }
        });
      
      responseData.answers = answers;
    }

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid response ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get all responses for a survey
 * @route GET /api/v1/surveys/:surveyId/responses
 * @access Private
 */
export const getSurveyResponses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { surveyId } = req.params;

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to access survey responses
    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasProjectAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access survey responses') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Filter by status if provided
    let query: any = { survey: surveyId };
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Get total count
    const total = await SurveyResponse.countDocuments(query);

    // Get responses with pagination
    const surveyResponses = await SurveyResponse.find(query)
      .populate('respondent', 'name email')
      .skip(startIndex)
      .limit(limit)
      .sort('-createdAt');

    // Pagination result
    const pagination: {
      next?: { page: number; limit: number };
      prev?: { page: number; limit: number };
    } = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: surveyResponses.length,
      pagination,
      total,
      data: surveyResponses
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid survey ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get response statistics for a survey
 * @route GET /api/v1/surveys/:surveyId/statistics
 * @access Private
 */
export const getSurveyStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { surveyId } = req.params;

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to access survey statistics
    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasProjectAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access survey statistics') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get response counts by status
    const statusCounts = await SurveyResponse.aggregate([
      { $match: { survey: new mongoose.Types.ObjectId(surveyId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Convert to a more user-friendly format
    const responsesByStatus = statusCounts.reduce((acc: { [key: string]: number }, curr: any) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Get total responses
    const totalResponses = await SurveyResponse.countDocuments({ survey: surveyId });
    
    // Get completion rate
    const completedResponses = responsesByStatus['completed'] || 0;
    const completionRate = totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0;

    // Get average completion time for completed responses
    const completionTimeData = await SurveyResponse.aggregate([
      { 
        $match: { 
          survey: new mongoose.Types.ObjectId(surveyId),
          status: 'completed',
          startedAt: { $exists: true },
          completedAt: { $exists: true }
        } 
      },
      { 
        $project: { 
          completionTimeMs: { $subtract: ['$completedAt', '$startedAt'] }
        } 
      },
      {
        $group: {
          _id: null,
          averageTimeMs: { $avg: '$completionTimeMs' },
          minTimeMs: { $min: '$completionTimeMs' },
          maxTimeMs: { $max: '$completionTimeMs' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format time statistics
    const timeStats = completionTimeData.length > 0 ? {
      averageTimeSeconds: Math.round(completionTimeData[0].averageTimeMs / 1000),
      minTimeSeconds: Math.round(completionTimeData[0].minTimeMs / 1000),
      maxTimeSeconds: Math.round(completionTimeData[0].maxTimeMs / 1000),
    } : null;

    // Get response counts by day
    const responsesPerDay = await SurveyResponse.aggregate([
      { $match: { survey: new mongoose.Types.ObjectId(surveyId) } },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const consentStats = await SurveyResponse.aggregate([
      { $match: { survey: new mongoose.Types.ObjectId(surveyId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          consentGiven: {
            $sum: { $cond: [{ $eq: ['$consentGiven', true] }, 1, 0] }
          },
          consentDeclined: {
            $sum: { $cond: [{ $eq: ['$consentGiven', false] }, 1, 0] }
          },
          consentPending: {
            $sum: { $cond: [{ $eq: ['$consentGiven', null] }, 1, 0] }
          }
        }
      }
    ]);


    // Format the statistics
    const statistics = {
      totalResponses,
      responsesByStatus,
      completionRate: Math.round(completionRate * 100) / 100,
      timeStatistics: timeStats,
      responsesPerDay: responsesPerDay.map(day => ({
        date: day._id,
        count: day.count
      })),
      // ADD THIS: Consent statistics
      consentStatistics: consentStats[0] && survey.consentForm ? {
        consentGivenCount: consentStats[0].consentGiven,
        consentGivenPercentage: Math.round((consentStats[0].consentGiven / consentStats[0].total) * 100),
        consentDeclinedCount: consentStats[0].consentDeclined,
        consentDeclinedPercentage: Math.round((consentStats[0].consentDeclined / consentStats[0].total) * 100),
        consentPendingCount: consentStats[0].consentPending,
        consentPendingPercentage: Math.round((consentStats[0].consentPending / consentStats[0].total) * 100)
      } : null
    };

    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid survey ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Export survey responses as CSV
 * @route GET /api/v1/surveys/:surveyId/export
 * @access Private
 */
export const exportSurveyResponses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { surveyId } = req.params;

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to export survey responses
    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasProjectAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to export survey responses') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get all completed responses
    const responses = await SurveyResponse.find({ 
      survey: surveyId,
      status: 'completed'
    }).populate('respondent', 'name email');

    // Get all questions in the survey
    const surveyQuestions = await SurveyQuestion.find({ survey: surveyId })
      .populate('question')
      .sort('order');

    // Get all answers for these responses
    const responseIds = responses.map(response => response._id);
    const allAnswers = await QuestionResponse.find({
      surveyResponse: { $in: responseIds }
    });

    // Organize answers by response
    const answersByResponse = new Map();
    allAnswers.forEach(answer => {
      const responseId = answer.surveyResponse.toString();
      if (!answersByResponse.has(responseId)) {
        answersByResponse.set(responseId, new Map());
      }
      answersByResponse.get(responseId).set(answer.surveyQuestion.toString(), answer.answer);
    });

    // Create CSV header row
    const headers = [
      'Response ID',
      'Started At',
      'Completed At',
      'Completion Time (minutes)',
      'Respondent Name',
      'Respondent Email'
    ];

    // Add question headers
    surveyQuestions.forEach(sq => {
      const questionText = sq.customText || (sq.question as any).text;
      headers.push(questionText);
    });

    // Create CSV rows
    const rows = [headers];

    responses.forEach(response => {
      const responseAnswers = answersByResponse.get(response._id.toString()) || new Map();
      
      // Calculate completion time in minutes
      let completionTimeMinutes = '';
      if (response.startedAt && response.completedAt) {
        const diffMs = response.completedAt.getTime() - response.startedAt.getTime();
        completionTimeMinutes = (diffMs / (1000 * 60)).toFixed(2);
      }

      const row = [
        response._id.toString(),
        response.startedAt ? response.startedAt.toISOString() : '',
        response.completedAt ? response.completedAt.toISOString() : '',
        completionTimeMinutes,
        response.respondent ? (response.respondent as any).name : (response.respondentInfo?.name || ''),
        response.respondent ? (response.respondent as any).email : (response.respondentInfo?.email || '')
      ];

      // Add answers
      surveyQuestions.forEach(sq => {
        const sqId = sq._id as mongoose.Types.ObjectId;
        const answer = responseAnswers.get(sqId.toString());  
        
        // Format the answer based on question type
        let formattedAnswer = '';
        if (answer !== undefined) {
          if (Array.isArray(answer)) {
            formattedAnswer = answer.join(', ');
          } else if (typeof answer === 'object' && answer !== null) {
            formattedAnswer = JSON.stringify(answer);
          } else {
            formattedAnswer = String(answer);
          }
        }
        
        row.push(formattedAnswer);
      });

      rows.push(row);
    });

    // Convert to CSV string
    const csvContent = rows.map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma or newline
      const cellStr = String(cell).replace(/"/g, '""');
      return /[,\n\r"]/.test(cellStr) ? `"${cellStr}"` : cellStr;
    }).join(',')).join('\n');

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=survey_responses_${surveyId}.csv`);

    res.status(200).send(csvContent);
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid survey ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


/**
 * Record that consent was declined (for analytics)
 * @route POST /api/v1/surveys/:surveyId/responses/consent-declined
 * @access Public
 */
export const recordConsentDeclined = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyResponse.db.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { consentFormId, metadata } = req.body;

    const survey = await Survey.findById(surveyId).populate('consentForm');
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // FIX: Verify consent form with proper type handling
    let surveyConsentFormId: string | undefined;
    
    if (survey.consentForm) {
      if (typeof survey.consentForm === 'object' && survey.consentForm !== null) {
        surveyConsentFormId = (survey.consentForm as any)._id.toString();
      } else {
        surveyConsentFormId = (survey.consentForm as mongoose.Types.ObjectId).toString();
      }
    }
    
    if (!surveyConsentFormId || consentFormId !== surveyConsentFormId) {
      const error = new Error('Invalid consent form') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // FIX: Get consent form data with proper type handling
    let consentFormData: any;
    
    if (typeof survey.consentForm === 'object' && survey.consentForm !== null && (survey.consentForm as any)._id) {
      consentFormData = survey.consentForm;
    } else {
      const ConsentForm = mongoose.model('ConsentForm');
      consentFormData = await ConsentForm.findById(survey.consentForm);
    }

    // Create a response record for declined consent (for analytics)
    const surveyResponse = new SurveyResponse({
      survey: surveyId,
      respondent: req.user ? req.user._id : undefined,
      metadata,
      consentGiven: false,
      consentFormId: consentFormData?._id,
      consentFormVersion: consentFormData?.version,
      consentTimestamp: new Date(),
      consentFormSnapshot: consentFormData ? {
        _id: consentFormData._id,
        name: consentFormData.name,
        description: consentFormData.description,
        version: consentFormData.version
      } : undefined,
      status: 'abandoned',
      progress: 0,
      startedAt: new Date(),
      lastActivityAt: new Date()
    });

    await surveyResponse.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Consent declined recorded',
      data: {
        responseId: surveyResponse._id,
        consentGiven: false
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};