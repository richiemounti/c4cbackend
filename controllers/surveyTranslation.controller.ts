// controllers/surveyTranslation.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import SurveyTranslation from "../models/surveyTranslation.model";
import Survey from "../models/survey.model";
import SurveySection from "../models/surveySection.model";
import SurveyQuestion from "../models/surveyQuestion.model";
import { CustomError } from "../middlewares/error.middleware";
import { userHasProjectAccess, isUserAuthenticated } from "../lib/authHelpers";
import Review from "../models/review.model";
import { createSurveyTranslationReview } from "../utils/reviewHelpers";

/**
 * Create a new survey translation
 * @route POST /api/v1/surveys/:surveyId/translations
 * @access Private (Project members)
 */
export const createSurveyTranslation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const {
      language,
      languageName,
      title,
      description,
      translationMethod = 'human',
      notes
    } = req.body;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Validate required fields
    if (!language || !languageName || !title) {
      const error = new Error('Language code, language name, and title are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has access to this survey's project
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized to create translations for this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check if translation already exists for this language
    const existingTranslation = await SurveyTranslation.findOne({
      survey: surveyId,
      language: language.toLowerCase(),
      archived: { $ne: true }
    });

    if (existingTranslation) {
      const error = new Error(`Translation already exists for language: ${language}`) as CustomError;
      error.statusCode = 409;
      throw error;
    }

    // Create the translation
    const translation = new SurveyTranslation({
      survey: surveyId,
      language: language.toLowerCase(),
      languageName,
      title,
      description,
      translator: req.user._id,
      translationMethod,
      notes,
      status: 'draft',
      translatedSections: [],
      translatedQuestions: []
    });

    await translation.save({ session });

    // Add translation reference to survey
    survey.translations = survey.translations || [];
    survey.translations.push(translation._id as mongoose.Types.ObjectId);
    await survey.save({ session });

    await session.commitTransaction();

    const populatedTranslation = await SurveyTranslation.findById(translation._id)
      .populate('translator', 'name email')
      .populate('survey', 'title defaultLanguage');

    res.status(201).json({
      success: true,
      message: 'Survey translation created successfully',
      data: populatedTranslation
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Get all translations for a survey
 * @route GET /api/v1/surveys/:surveyId/translations
 * @access Private
 */
export const getSurveyTranslations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { surveyId } = req.params;
    const { status, language } = req.query;

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has access to this survey's project
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const filters: any = {};
    if (status) filters.status = status as string;
    if (language) filters.language = (language as string).toLowerCase();

    const translations = await (SurveyTranslation as any).getTranslationsBySurvey(surveyId, filters);

    res.status(200).json({
      success: true,
      count: translations.length,
      data: translations
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid survey ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get published translations for a survey (public endpoint for respondents)
 * @route GET /api/v1/surveys/:surveyId/translations/published
 * @access Public
 */
export const getPublishedTranslations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { surveyId } = req.params;

    // Check if survey exists and is published
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.status !== 'published') {
      const error = new Error('Survey is not published') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const translations = await (SurveyTranslation as any).getPublishedTranslations(surveyId);

    res.status(200).json({
      success: true,
      count: translations.length,
      data: {
        defaultLanguage: survey.defaultLanguage,
        availableLanguages: survey.availableLanguages || [],
        translations: translations.map((t: any) => ({
          _id: t._id,
          language: t.language,
          languageName: t.languageName,
          title: t.title,
          description: t.description
        }))
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid survey ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get a single translation by ID
 * @route GET /api/v1/translations/:id
 * @access Private
 */
export const getTranslation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const translation = await SurveyTranslation.findById(id)
      .populate('survey', 'title defaultLanguage project')
      .populate('translator', 'name email')
      .populate('reviewer', 'name email')
      .populate({
        path: 'translatedSections.section',
        select: 'title description order'
      })
      .populate({
        path: 'translatedQuestions.surveyQuestion',
        select: 'question order',
        populate: {
          path: 'question',
          select: 'text type options'
        }
      });

    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has access to this survey's project
    const survey = translation.survey as any;
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this translation') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: translation
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid translation ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get full translation with all content (for respondents taking survey)
 * @route GET /api/v1/translations/:id/full
 * @access Public (if survey is published)
 */
export const getFullTranslation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const translation = await SurveyTranslation.findById(id)
      .populate('survey', 'title description status settings')
      .populate({
        path: 'translatedSections.section',
        select: 'title description order'
      })
      .populate({
        path: 'translatedQuestions.surveyQuestion',
        select: 'question order required section',
        populate: {
          path: 'question',
          select: 'text description type options validation'
        }
      });

    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (translation.status !== 'published') {
      const error = new Error('Translation is not published') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const survey = translation.survey as any;
    if (survey.status !== 'published') {
      const error = new Error('Survey is not published') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: translation
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid translation ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update translation metadata
 * @route PUT /api/v1/translations/:id
 * @access Private
 */
export const updateTranslation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const {
      title,
      description,
      languageName,
      translationMethod,
      notes
    } = req.body;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id).populate('survey', 'project');
    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (translation.archived) {
      const error = new Error('Cannot update archived translation') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user has access
    const survey = translation.survey as any;
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    const isTranslator = translation.translator?.toString() === req.user._id.toString();

    if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized to update this translation') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Can't update if published
    if (translation.status === 'published') {
      const error = new Error('Cannot update published translation') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Update fields
    if (title !== undefined) translation.title = title;
    if (description !== undefined) translation.description = description;
    if (languageName !== undefined) translation.languageName = languageName;
    if (translationMethod !== undefined) translation.translationMethod = translationMethod;
    if (notes !== undefined) translation.notes = notes;

    await translation.save({ session });
    await session.commitTransaction();

    const updatedTranslation = await SurveyTranslation.findById(id)
      .populate('translator', 'name email')
      .populate('reviewer', 'name email')
      .populate('survey', 'title');

    res.status(200).json({
      success: true,
      message: 'Translation updated successfully',
      data: updatedTranslation
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Add or update translated section
 * @route PUT /api/v1/translations/:id/sections/:sectionId
 * @access Private
 */
export const updateTranslatedSection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, sectionId } = req.params;
    const { title, description } = req.body;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    if (!title) {
      const error = new Error('Translated title is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id).populate('survey', 'project');
    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if section exists and belongs to the survey
    const section = await SurveySection.findById(sectionId);
    if (!section) {
      const error = new Error('Section not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (section.survey.toString() !== translation.survey._id.toString()) {
      const error = new Error('Section does not belong to this survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check access
    const survey = translation.survey as any;
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    const isTranslator = translation.translator?.toString() === req.user._id.toString();

    if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized to update this translation') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Can't update if published
    if (translation.status === 'published') {
      const error = new Error('Cannot update published translation') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Find existing translated section or create new
    const existingIndex = translation.translatedSections.findIndex(
      s => s.section.toString() === sectionId
    );

    if (existingIndex >= 0) {
      // Update existing
      translation.translatedSections[existingIndex].title = title;
      translation.translatedSections[existingIndex].description = description;
    } else {
      // Add new
      translation.translatedSections.push({
        section: new mongoose.Types.ObjectId(sectionId),
        title,
        description
      });
    }

    await translation.save({ session });
    await session.commitTransaction();

    const updatedTranslation = await SurveyTranslation.findById(id)
      .populate('translatedSections.section', 'title order');

    res.status(200).json({
      success: true,
      message: 'Translated section updated successfully',
      data: updatedTranslation
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Add or update translated question
 * @route PUT /api/v1/translations/:id/questions/:questionId
 * @access Private
 */
export const updateTranslatedQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, questionId } = req.params;
    const { translatedText, translatedDescription, translatedOptions } = req.body;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    if (!translatedText) {
      const error = new Error('Translated text is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id).populate('survey', 'project');
    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if question exists and belongs to the survey
    const surveyQuestion = await SurveyQuestion.findById(questionId).populate('question');
    if (!surveyQuestion) {
      const error = new Error('Survey question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (surveyQuestion.survey.toString() !== translation.survey._id.toString()) {
      const error = new Error('Question does not belong to this survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check access
    const survey = translation.survey as any;
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    const isTranslator = translation.translator?.toString() === req.user._id.toString();

    if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized to update this translation') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Can't update if published
    if (translation.status === 'published') {
      const error = new Error('Cannot update published translation') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate translated options if question type requires options
    const question = surveyQuestion.question as any;
    if (['radio', 'checkbox', 'dropdown'].includes(question.type)) {
      if (!translatedOptions || !Array.isArray(translatedOptions) || translatedOptions.length === 0) {
        const error = new Error('Translated options are required for this question type') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Find existing translated question or create new
    const existingIndex = translation.translatedQuestions.findIndex(
      q => q.surveyQuestion.toString() === questionId
    );

    if (existingIndex >= 0) {
      // Update existing
      translation.translatedQuestions[existingIndex].translatedText = translatedText;
      translation.translatedQuestions[existingIndex].translatedDescription = translatedDescription;
      translation.translatedQuestions[existingIndex].translatedOptions = translatedOptions;
    } else {
      // Add new
      translation.translatedQuestions.push({
        surveyQuestion: new mongoose.Types.ObjectId(questionId),
        translatedText,
        translatedDescription,
        translatedOptions
      });
    }

    await translation.save({ session });
    await session.commitTransaction();

    const updatedTranslation = await SurveyTranslation.findById(id)
      .populate({
        path: 'translatedQuestions.surveyQuestion',
        select: 'question order',
        populate: {
          path: 'question',
          select: 'text type'
        }
      });

    res.status(200).json({
      success: true,
      message: 'Translated question updated successfully',
      data: updatedTranslation
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Bulk update translated questions
 * @route PUT /api/v1/translations/:id/questions/bulk
 * @access Private
 */
export const bulkUpdateTranslatedQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { questions } = req.body;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      const error = new Error('Questions array is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id).populate('survey', 'project');
    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check access
    const survey = translation.survey as any;
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    const isTranslator = translation.translator?.toString() === req.user._id.toString();

    if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized to update this translation') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Can't update if published
    if (translation.status === 'published') {
      const error = new Error('Cannot update published translation') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Process each question
    for (const q of questions) {
      if (!q.surveyQuestion || !q.translatedText) {
        continue; // Skip invalid entries
      }

      const existingIndex = translation.translatedQuestions.findIndex(
        tq => tq.surveyQuestion.toString() === q.surveyQuestion
      );

      if (existingIndex >= 0) {
        // Update existing
        translation.translatedQuestions[existingIndex].translatedText = q.translatedText;
        translation.translatedQuestions[existingIndex].translatedDescription = q.translatedDescription;
        translation.translatedQuestions[existingIndex].translatedOptions = q.translatedOptions;
      } else {
        // Add new
        translation.translatedQuestions.push({
          surveyQuestion: new mongoose.Types.ObjectId(q.surveyQuestion),
          translatedText: q.translatedText,
          translatedDescription: q.translatedDescription,
          translatedOptions: q.translatedOptions
        });
      }
    }

    await translation.save({ session });
    await session.commitTransaction();

    const updatedTranslation = await SurveyTranslation.findById(id)
      .populate('translator', 'name email')
      .populate('survey', 'title');

    res.status(200).json({
      success: true,
      message: `${questions.length} questions updated successfully`,
      data: updatedTranslation
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Submit translation for review
 * @route PUT /api/v1/translations/:id/submit
 * @access Private
 */
export const submitForReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id).populate('survey', 'project') as any;
    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check access
    const survey = translation.survey as any;
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    const isTranslator = translation.translator?.toString() === req.user._id.toString();

    if (!isTranslator && !hasAccess && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    if (translation.status !== 'draft') {
      const error = new Error('Only draft translations can be submitted for review') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check completion
    await translation.markAsComplete();

    if (translation.completionPercentage < 100) {
      const error = new Error(`Translation is only ${translation.completionPercentage}% complete. Must be 100% to submit.`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    await session.commitTransaction();

    // AUTO-TRIGGER: Create a Review record now that the translation is pending_review
    try {
      const translationForReview = await SurveyTranslation.findById(id)
        .populate('translator', 'name email')
        .populate({
          path: 'survey',
          populate: { path: 'project', populate: { path: 'organization' } },
        }) as any;

      if (translationForReview) {
        await createSurveyTranslationReview(translationForReview, req.user._id);
      }
    } catch (reviewError) {
      console.error('Failed to create review for translation submission:', reviewError);
      // Non-fatal — translation submit still succeeded
    }

    const updatedTranslation = await SurveyTranslation.findById(id)
      .populate('translator', 'name email')
      .populate('survey', 'title');

    res.status(200).json({
      success: true,
      message: 'Translation submitted for review',
      data: updatedTranslation
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Approve translation
 * @route PUT /api/v1/translations/:id/approve
 * @access Private (Project managers)
 */
export const approveTranslation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id).populate('survey', 'project creator') as any;
    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user can approve (project manager or creator)
    const survey = translation.survey as any;
    const Project = mongoose.model('Project');
    const project = await Project.findById(survey.project);
    
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const isProjectCreator = project.creator.toString() === req.user._id.toString();
    const isProjectManager = project.team?.some((member: any) => 
      member.user.toString() === req.user._id.toString() && member.role === 'manager'
    );

    if (!isProjectCreator && !isProjectManager && !req.user.isConnectGoStaff) {
      const error = new Error('Only project managers can approve translations') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Use instance method to approve
    await translation.approve(req.user._id);

    // SYNC: Close any open Review record for this translation
    try {
      const existingReview = await Review.findOne({
        module: 'survey_translation',
        moduleItemId: translation._id,
        status: { $in: ['pending', 'in_review'] },
      });
      if (existingReview) {
        existingReview.changeStatus('approved', req.user._id, 'Translation approved');
        await existingReview.save();
      }
    } catch (syncError) {
      console.error('Failed to sync Review status on translation approval:', syncError);
      // Non-fatal — translation approval still succeeded
    }

    await session.commitTransaction();

    const updatedTranslation = await SurveyTranslation.findById(id)
      .populate('translator', 'name email')
      .populate('reviewer', 'name email')
      .populate('survey', 'title');

    res.status(200).json({
      success: true,
      message: 'Translation approved successfully',
      data: updatedTranslation
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Publish translation
 * @route PUT /api/v1/translations/:id/publish
 * @access Private (Project managers)
 */
export const publishTranslation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id).populate('survey', 'project creator') as any;
    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user can publish (project manager or creator)
    const survey = translation.survey as any;
    const Project = mongoose.model('Project');
    const project = await Project.findById(survey.project);
    
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const isProjectCreator = project.creator.toString() === req.user._id.toString();
    const isProjectManager = project.team?.some((member: any) => 
      member.user.toString() === req.user._id.toString() && member.role === 'manager'
    );

    if (!isProjectCreator && !isProjectManager && !req.user.isConnectGoStaff) {
      const error = new Error('Only project managers can publish translations') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Use instance method to publish
    await translation.publish();

    await session.commitTransaction();

    const updatedTranslation = await SurveyTranslation.findById(id)
      .populate('translator', 'name email')
      .populate('reviewer', 'name email')
      .populate('survey', 'title availableLanguages');

    res.status(200).json({
      success: true,
      message: 'Translation published successfully',
      data: updatedTranslation
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Archive translation
 * @route DELETE /api/v1/translations/:id
 * @access Private (Project managers)
 */
export const archiveTranslation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id).populate('survey', 'project');
    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (translation.archived) {
      const error = new Error('Translation is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check access
    const survey = translation.survey as any;
    const hasAccess = userHasProjectAccess(req, survey.project.toString());

    if (!hasAccess && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized to archive this translation') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    translation.archived = true;
    translation.archivedAt = new Date();
    await translation.save({ session });

    // Remove language from survey's available languages if this was published
    if (translation.status === 'published') {
      const surveyDoc = await Survey.findById(translation.survey);
      if (surveyDoc && surveyDoc.availableLanguages) {
        surveyDoc.availableLanguages = surveyDoc.availableLanguages.filter(
          lang => lang !== translation.language
        );
        await surveyDoc.save({ session });
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Translation archived successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Get translation statistics
 * @route GET /api/v1/surveys/:surveyId/translations/statistics
 * @access Private
 */
export const getTranslationStatistics = async (
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

    // Check access
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const [
      totalTranslations,
      draftCount,
      pendingCount,
      approvedCount,
      publishedCount,
      translationsByLanguage,
      completionStats
    ] = await Promise.all([
      SurveyTranslation.countDocuments({
        survey: surveyId,
        archived: { $ne: true }
      }),
      SurveyTranslation.countDocuments({
        survey: surveyId,
        status: 'draft',
        archived: { $ne: true }
      }),
      SurveyTranslation.countDocuments({
        survey: surveyId,
        status: 'pending_review',
        archived: { $ne: true }
      }),
      SurveyTranslation.countDocuments({
        survey: surveyId,
        status: 'approved',
        archived: { $ne: true }
      }),
      SurveyTranslation.countDocuments({
        survey: surveyId,
        status: 'published',
        archived: { $ne: true }
      }),
      SurveyTranslation.aggregate([
        {
          $match: {
            survey: new mongoose.Types.ObjectId(surveyId),
            archived: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$language',
            languageName: { $first: '$languageName' },
            status: { $first: '$status' },
            completionPercentage: { $first: '$completionPercentage' }
          }
        }
      ]),
      SurveyTranslation.aggregate([
        {
          $match: {
            survey: new mongoose.Types.ObjectId(surveyId),
            archived: { $ne: true }
          }
        },
        {
          $group: {
            _id: null,
            avgCompletion: { $avg: '$completionPercentage' },
            minCompletion: { $min: '$completionPercentage' },
            maxCompletion: { $max: '$completionPercentage' }
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalTranslations,
          draft: draftCount,
          pendingReview: pendingCount,
          approved: approvedCount,
          published: publishedCount
        },
        byLanguage: translationsByLanguage,
        completion: completionStats[0] || {
          avgCompletion: 0,
          minCompletion: 0,
          maxCompletion: 0
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid survey ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

// Add to surveyTranslation.controller.ts

/**
 * Auto-translate all content in a translation using Google Translate
 * Skips fields that already have manual translations
 * @route POST /api/v1/translations/:id/auto-translate
 * @access Private
 */
export const autoTranslateSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { 
      overwriteExisting = false,  // if true, re-translate already-translated fields
      sourceLanguage = 'en'        // language to translate FROM
    } = req.body;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const translation = await SurveyTranslation.findById(id)
      .populate('survey', 'project title description');

    if (!translation) {
      const error = new Error('Translation not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (translation.status === 'published') {
      const error = new Error('Cannot auto-translate a published translation') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const survey = translation.survey as any;
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    const isTranslator = translation.translator?.toString() === req.user._id.toString();

    if (!hasAccess && !isTranslator && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const targetLanguage = translation.language;
    const { translateText, translateBatch } = await import('../services/googleTranslate.service');

    // ── 1. Translate survey title/description ──────────────────────────────
    if (!translation.title || overwriteExisting) {
      translation.title = await translateText(survey.title, targetLanguage, sourceLanguage);
    }
    if (survey.description && (!translation.description || overwriteExisting)) {
      translation.description = await translateText(survey.description, targetLanguage, sourceLanguage);
    }

    // ── 2. Translate sections ──────────────────────────────────────────────
    const sections = await SurveySection.find({
      survey: survey._id,
      archived: { $ne: true }
    });

    for (const section of sections) {
      const existingIdx = translation.translatedSections.findIndex(
        s => s.section.toString() === (section._id as mongoose.Types.ObjectId).toString()
      );

      const alreadyTranslated = existingIdx >= 0;
      
      if (!alreadyTranslated || overwriteExisting) {
        const translatedTitle = await translateText(section.title, targetLanguage, sourceLanguage);
        const translatedDesc = section.description 
          ? await translateText(section.description, targetLanguage, sourceLanguage)
          : undefined;

        if (alreadyTranslated) {
          translation.translatedSections[existingIdx].title = translatedTitle;
          if (translatedDesc) translation.translatedSections[existingIdx].description = translatedDesc;
        } else {
          translation.translatedSections.push({
            section: section._id as mongoose.Types.ObjectId,
            title: translatedTitle,
            description: translatedDesc
          });
        }
      }
    }

    // ── 3. Translate questions ─────────────────────────────────────────────
    const surveyQuestions = await SurveyQuestion.find({
      survey: survey._id,
      archived: { $ne: true }
    }).populate('question', 'text description type options');

    for (const sq of surveyQuestions) {
      const question = sq.question as any;
      const sqId = (sq._id as mongoose.Types.ObjectId).toString();

      const existingIdx = translation.translatedQuestions.findIndex(
        q => q.surveyQuestion.toString() === sqId
      );
      const alreadyTranslated = existingIdx >= 0;

      if (!alreadyTranslated || overwriteExisting) {
        // Use customText if set on the survey question, otherwise fall back to question template text
        const sourceText = sq.customText || question.text;
        const sourceDesc = sq.customDescription || question.description;

        const translatedText = await translateText(sourceText, targetLanguage, sourceLanguage);
        const translatedDesc = sourceDesc
          ? await translateText(sourceDesc, targetLanguage, sourceLanguage)
          : undefined;

        // Translate options for choice-based questions
        let translatedOptions: Array<{ value: string; label: string }> | undefined;
        const optionsSource = sq.customOptions?.length ? sq.customOptions : question.options;

        if (optionsSource?.length && ['radio', 'checkbox', 'dropdown', 'select'].includes(question.type)) {
          const labels = optionsSource.map((o: any) => o.label);
          const translatedLabels = await translateBatch(labels, targetLanguage, sourceLanguage);
          translatedOptions = optionsSource.map((o: any, i: number) => ({
            value: o.value, // keep value as-is (it's the stored key)
            label: translatedLabels[i]
          }));
        }

        if (alreadyTranslated) {
          translation.translatedQuestions[existingIdx].translatedText = translatedText;
          if (translatedDesc) translation.translatedQuestions[existingIdx].translatedDescription = translatedDesc;
          if (translatedOptions) translation.translatedQuestions[existingIdx].translatedOptions = translatedOptions;
        } else {
          translation.translatedQuestions.push({
            surveyQuestion: sq._id as mongoose.Types.ObjectId,
            translatedText,
            translatedDescription: translatedDesc,
            translatedOptions
          });
        }
      }
    }

    translation.translationMethod = 'machine';
    await translation.save({ session });
    await session.commitTransaction();

    // Return the updated translation with completion %
    const updated = await SurveyTranslation.findById(id)
      .populate('translator', 'name email')
      .populate('survey', 'title');

    res.status(200).json({
      success: true,
      message: `Auto-translation complete. ${translation.translatedQuestions.length} questions and ${translation.translatedSections.length} sections translated.`,
      data: updated
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export default {
  createSurveyTranslation,
  getSurveyTranslations,
  getPublishedTranslations,
  getTranslation,
  getFullTranslation,
  updateTranslation,
  updateTranslatedSection,
  updateTranslatedQuestion,
  bulkUpdateTranslatedQuestions,
  submitForReview,
  approveTranslation,
  publishTranslation,
  archiveTranslation,
  getTranslationStatistics,
  autoTranslateSurvey
};