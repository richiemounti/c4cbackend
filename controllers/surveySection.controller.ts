// controllers/surveySection.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import SurveySection from "../models/surveySection.model";
import Survey from "../models/survey.model";
import { CustomError } from "../middlewares/error.middleware";

type AuthUser = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
};

/**
 * Create a new survey section
 * @route POST /api/v1/surveys/:surveyId/sections
 * @access Private
 */
export const createSurveySection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { title, description, order } = req.body;

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to modify this survey
    const isCreator = survey.creator.toString() === (req.user as AuthUser)._id.toString();
    const hasProjectAccess = req.user?.hasProjectAccess(survey.project);
    const isConnectGoStaff = req.user?.isConnectGoStaff;
    
    if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check survey status
    if (survey.status === 'closed') {
      const error = new Error('Cannot modify a closed survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If survey is published, switch it to draft
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(surveyId, { status: 'draft' });
    }

    // Create the section
    const section = new SurveySection({
      title,
      description,
      survey: surveyId,
      order: order || 0 // The pre-save hook will set the correct order if not specified
    });

    await section.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Survey section created successfully',
      data: section
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get a survey section by ID
 * @route GET /api/v1/sections/:id
 * @access Private
 */
export const getSurveySection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sectionId = req.params.id;

    const section = await SurveySection.findById(sectionId);
    if (!section) {
      const error = new Error('Section not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to access the survey this section belongs to
    const survey = await Survey.findById(section.survey);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user?.hasProjectAccess(survey.project);
    if (!hasProjectAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this section') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: section
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid section ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update a survey section
 * @route PUT /api/v1/sections/:id
 * @access Private
 */
export const updateSurveySection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sectionId = req.params.id;
    const { title, description } = req.body;

    // Find the section
    const section = await SurveySection.findById(sectionId);
    if (!section) {
      const error = new Error('Section not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Get the survey
    const survey = await Survey.findById(section.survey);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to modify this survey
    const isCreator = survey.creator.toString() === (req.user as AuthUser)._id.toString();
    const hasProjectAccess = req.user?.hasProjectAccess(survey.project);
    const isConnectGoStaff = req.user?.isConnectGoStaff;
    
    if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check survey status
    if (survey.status === 'closed') {
      const error = new Error('Cannot modify a closed survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If survey is published, switch it to draft
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
    }

    // Update the section
    const updatedSection = await SurveySection.findByIdAndUpdate(
      sectionId,
      { title, description },
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Survey section updated successfully',
      data: updatedSection
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid section ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Delete a survey section
 * @route DELETE /api/v1/sections/:id
 * @access Private
 */
export const deleteSurveySection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sectionId = req.params.id;

    // Find the section
    const section = await SurveySection.findById(sectionId);
    if (!section) {
      const error = new Error('Section not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Get the survey
    const survey = await Survey.findById(section.survey);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to modify this survey
    const isCreator = survey.creator.toString() === (req.user as AuthUser)._id.toString();
    const hasProjectAccess = req.user?.hasProjectAccess(survey.project);
    const isConnectGoStaff = req.user?.isConnectGoStaff;
    
    if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check survey status
    if (survey.status === 'closed') {
      const error = new Error('Cannot modify a closed survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If survey is published, switch it to draft
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
    }

    // Get the SurveyQuestion model
    const SurveyQuestion = mongoose.model('SurveyQuestion');

    // Check if section has questions
    const questionCount = await SurveyQuestion.countDocuments({ section: sectionId });
    
    if (questionCount > 0) {
      // Move questions to no section (make section null)
      await SurveyQuestion.updateMany(
        { section: sectionId },
        { section: null },
        { session }
      );
    }

    // Delete the section
    await SurveySection.findByIdAndDelete(sectionId, { session });

    // Update order of remaining sections
    const remainingSections = await SurveySection.find({ survey: section.survey })
      .sort('order');
    
    for (let i = 0; i < remainingSections.length; i++) {
      await SurveySection.findByIdAndUpdate(
        remainingSections[i]._id,
        { order: i + 1 },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Survey section deleted successfully',
      data: null
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid section ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Reorder survey sections
 * @route PUT /api/v1/surveys/:surveyId/sections/reorder
 * @access Private
 */
export const reorderSurveySections = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { sections } = req.body;

    // Validate input
    if (!sections || !Array.isArray(sections)) {
      const error = new Error('Sections array is required') as CustomError;
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

    // Check if user has permission to modify this survey
    const isCreator = survey.creator.toString() === (req.user as AuthUser)._id.toString();
    const hasProjectAccess = req.user?.hasProjectAccess(survey.project);
    const isConnectGoStaff = req.user?.isConnectGoStaff;
    
    if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check survey status
    if (survey.status === 'closed') {
      const error = new Error('Cannot modify a closed survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If survey is published, switch it to draft
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
    }

    // Get all existing sections for this survey
    const existingSections = await SurveySection.find({ 
      survey: surveyId 
    });
    
    const existingSectionIds = new Set(existingSections.map(
      s => (s._id as mongoose.Types.ObjectId).toString())
    );
    
    // Validate that all provided section IDs belong to this survey
    for (const sectionData of sections) {
      if (!existingSectionIds.has(sectionData.id)) {
        const error = new Error(`Section with ID ${sectionData.id} does not belong to this survey`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Update the order of each section
    for (let i = 0; i < sections.length; i++) {
      await SurveySection.findByIdAndUpdate(
        sections[i].id,
        { order: i + 1 },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Fetch the updated sections
    const updatedSections = await SurveySection.find({ survey: surveyId })
      .sort('order');

    res.status(200).json({
      success: true,
      message: 'Survey sections reordered successfully',
      data: updatedSections
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all questions in a section
 * @route GET /api/v1/sections/:id/questions
 * @access Private
 */
export const getSectionQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sectionId = req.params.id;

    // Check if section exists
    const section = await SurveySection.findById(sectionId);
    if (!section) {
      const error = new Error('Section not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to access the survey
    const survey = await Survey.findById(section.survey);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = req.user?.hasProjectAccess(survey.project);
    if (!hasProjectAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this section') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get all questions in the section
    const SurveyQuestion = mongoose.model('SurveyQuestion');
    const questions = await SurveyQuestion.find({ 
      section: sectionId,
      archived: { $ne: true }
    }).populate({
      path: 'question',
      select: 'text description type options validation targetAudience'
    }).sort('order');

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid section ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};