// controllers/surveyQuestion.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import SurveyQuestion from "../models/surveyQuestion.model";
import SurveySection from "../models/surveySection.model";
import Survey from "../models/survey.model";
import Question from "../models/question.model";
import { CustomError } from "../middlewares/error.middleware";
import { userHasProjectAccess } from "../lib/authHelpers";
import { mapConditionalLogicToSurvey, validateConditionalDependenciesInSurvey } from "./question.controller";
import { createSurveyQuestionReview } from "../utils/reviewHelpers";

type AuthUser = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
  hasProjectAccess?: (projectId: any) => boolean;
  isConnectGoStaff?: boolean;
};


/**
 * Helper function to process location demographic questions
 * Replaces question options with project sites
 */
const processLocationDemographics = async (
  surveyId: string,
  questionId: string,
  customOptions?: Array<{ value: string; label: string }>
) => {
  try {
    // Get the question
    const question = await Question.findById(questionId);
    
    if (!question || !question.isStandardDemographic || question.demographicType !== 'location') {
      return customOptions; // Not a location demographic, return as-is
    }
    
    // Get the survey to find the project
    const survey = await Survey.findById(surveyId).populate('project');
    if (!survey) {
      return customOptions;
    }
    
    // Get project sites
    const ProjectSite = mongoose.model('ProjectSite');
    const sites = await ProjectSite.find({
      project: survey.project._id || survey.project,
      archived: { $ne: true }
    }).select('name _id');
    
    if (sites.length === 0) {
      // No sites found - return null to indicate text field should be used
      return null;
    }
    
    // Convert sites to options format
    return sites.map(site => ({
      value: site._id.toString(),
      label: site.name
    }));
    
  } catch (error) {
    console.error('Error processing location demographics:', error);
    return customOptions; // Return original options on error
  }
};


/**
 * Add a question to a survey
 * @route POST /api/v1/surveys/:surveyId/questions
 * @access Private
 */
export const addQuestionToSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyQuestion.db.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { 
      questionId, 
      sectionId,
      required,
      customText,
      customDescription,
      customOptions, // This might contain project sites from frontend
      conditionalLogic,
      order
    } = req.body;

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to modify this survey
    const isCreator = survey.creator.toString() === (req.user as AuthUser)._id.toString();
    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
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

    // Check if question exists
    const question = await Question.findById(questionId);
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if question is archived
    if (question.archived) {
      const error = new Error('Cannot add an archived question') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Handle bespoke questions
    if (question.isBespoke) {
      if (question.bespokeMetadata?.project.toString() !== survey.project.toString()) {
        const error = new Error('Bespoke question can only be used in surveys from the same project') as CustomError;
        error.statusCode = 403;
        throw error;
      }
      
      // pending or approved = usable within the originating project
      // rejected or elevated = blocked
      const usableStatuses = ['pending', 'approved'];
      if (!usableStatuses.includes(question.bespokeMetadata?.status) && !isConnectGoStaff) {
        const error = new Error('This custom question is not available for use') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // ✅ NEW: Process conditional logic inheritance
    let inheritedConditionalLogic = conditionalLogic; // Use provided if exists
    
    if (!inheritedConditionalLogic && question.conditionalLogic?.enabled) {
      // Inherit from question template
      console.log(`📋 Inheriting conditional logic from question ${questionId}`);
      
      // Check if dependencies are in the survey
      const dependencyValidation = await validateConditionalDependenciesInSurvey(
        questionId,
        surveyId
      );
      
      if (!dependencyValidation.isValid) {
        console.warn(`⚠️ Conditional dependencies missing:`, dependencyValidation.missingDependencies);
        
        // Option 1: Block adding the question
        // const error = new Error(
        //   `Cannot add question with conditional logic. Missing dependencies: ${dependencyValidation.missingDependencies.join(', ')}`
        // ) as CustomError;
        // error.statusCode = 400;
        // throw error;
        
        // Option 2: Add with warning (current implementation)
        inheritedConditionalLogic = {
          enabled: false, // Disable until dependencies are met
          conditions: question.conditionalLogic.conditions,
          action: question.conditionalLogic.action,
          logicOperator: question.conditionalLogic.logicOperator,
          _inheritanceWarning: dependencyValidation.warnings.join('; ')
        };
      } else {
        // Map Question IDs to SurveyQuestion IDs
        const surveyQuestions = await SurveyQuestion.find({ survey: surveyId })
          .populate('question');
        
        const questionToSurveyQuestionMap = new Map();
        surveyQuestions.forEach((sq: any) => {
          questionToSurveyQuestionMap.set(
            sq.question._id.toString(),
            sq._id.toString()
          );
        });
        
        inheritedConditionalLogic = await mapConditionalLogicToSurvey(
          question.conditionalLogic,
          surveyId,
          questionToSurveyQuestionMap
        );
      }
    }

    // ✅ NEW: Process location demographics
    // If customOptions are NOT provided (null/undefined), check if this is a location demographic
    // and fetch project sites. If customOptions ARE provided, use them as-is.
    let processedOptions = customOptions;
    
    if (!customOptions && question.isStandardDemographic && question.demographicType === 'location') {
      processedOptions = await processLocationDemographics(surveyId, questionId, customOptions);
    }

    // Check if section exists if provided
    if (sectionId) {
      const section = await SurveySection.findById(sectionId);
      if (!section) {
        const error = new Error('Section not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      // Check if section belongs to this survey
      if (section.survey.toString() !== surveyId) {
        const error = new Error('Section does not belong to this survey') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // If survey is published, switch it to draft
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(surveyId, { status: 'draft' }, { session });
    }

    // Create the survey question with processed options
    const surveyQuestion = new SurveyQuestion({
      question: questionId,
      survey: surveyId,
      section: sectionId || null,
      required: required !== undefined ? required : question.required,
      customText,
      customDescription,
      customOptions: processedOptions,
      conditionalLogic: inheritedConditionalLogic, // ✅ Use inherited/provided conditional logic
      order: order || 0
    });

    await surveyQuestion.save({ session });

    // ============================================================================
    // 🆕 ADD AUTO-TRIGGER HERE (AFTER SAVE, BEFORE COMMIT)
    // ============================================================================
    
    // AUTO-TRIGGER: Create review for added question
    try {
      // Populate necessary fields for review creation
      const populatedSurveyQuestion = await SurveyQuestion.findById(surveyQuestion._id)
        .populate({
          path: 'question',
          select: 'text description type options validation targetAudience isBespoke bespokeMetadata isStandardDemographic demographicType'
        })
        .populate({
          path: 'survey',
          populate: {
            path: 'project',
            populate: { path: 'organization' }
          }
        })
        .populate('section')
        .session(session);
      
      if (populatedSurveyQuestion && req.user) {
        // Import the review helper at the top of the file
        // import { createSurveyQuestionReview } from '../utils/reviewHelpers';
        
        await createSurveyQuestionReview(
          populatedSurveyQuestion,
          req.user._id as mongoose.Types.ObjectId
        );
        
        console.log(`✅ Review auto-created for survey question: ${(populatedSurveyQuestion.question as any).text?.substring(0, 50)}`);
      }
    } catch (reviewError) {
      // Non-blocking - log error but don't fail the request
      console.error('Failed to create review for survey question:', reviewError);
    }
    
    // ============================================================================
    // END OF AUTO-TRIGGER
    // ============================================================================
    
    // Populate the question details for the response
    const populatedQuestion = await SurveyQuestion.findById(surveyQuestion._id)
      .populate({
        path: 'question',
        select: 'text description type options validation targetAudience isBespoke bespokeMetadata isStandardDemographic demographicType', // ✅ Added demographic fields
        populate: [
          {
            path: 'bespokeMetadata.createdBy',
            select: 'name email'
          },
          {
            path: 'bespokeMetadata.project',
            select: 'name'
          }
        ]
      })
      .populate({
        path: 'conditionalLogic.conditions.questionId', // ✅ Populate condition references
        select: 'question'
      });

    await session.commitTransaction();
    session.endSession();

    // ✅ NEW: Add warning to response if conditional logic was disabled
    const responseData: any = {
      success: true,
      message: 'Question added to survey successfully',
      data: populatedQuestion
    };

    if (inheritedConditionalLogic?._inheritanceWarning) {
      responseData.warning = inheritedConditionalLogic._inheritanceWarning;
      responseData.message = 'Question added but conditional logic was disabled due to missing dependencies';
    }
    res.status(201).json(responseData);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};


/**
 * Get a survey question by ID
 * @route GET /api/v1/survey-questions/:id
 * @access Private
 */
export const getSurveyQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const questionId = req.params.id;

    // Find the survey question with populated data
    const surveyQuestion = await SurveyQuestion.findById(questionId)
      .populate({
        path: 'question',
        select: 'text description type options validation targetAudience'
      })
      .populate({
        path: 'section',
        select: 'title'
      });

    if (!surveyQuestion) {
      const error = new Error('Survey question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to access the survey
    const survey = await Survey.findById(surveyQuestion.survey);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasProjectAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: surveyQuestion
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update a survey question
 * @route PUT /api/v1/survey-questions/:id
 * @access Private
 */
export const updateSurveyQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyQuestion.db.startSession();
  session.startTransaction();

  try {
    const questionId = req.params.id;
    const { 
      sectionId,
      required,
      customText,
      customDescription,
      customOptions,
      conditionalLogic 
    } = req.body;

    // Find the survey question
    const surveyQuestion = await SurveyQuestion.findById(questionId);
    if (!surveyQuestion) {
      const error = new Error('Survey question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if survey exists
    const survey = await Survey.findById(surveyQuestion.survey);
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

    // Check if section exists if provided
    if (sectionId) {
      const section = await SurveySection.findById(sectionId);
      if (!section) {
        const error = new Error('Section not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      // Check if section belongs to this survey
      if (section.survey.toString() !== survey._id.toString()) {
        const error = new Error('Section does not belong to this survey') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // If survey is published, switch it to draft
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
    }

    // Update the survey question
    const updatedQuestion = await SurveyQuestion.findByIdAndUpdate(
      questionId,
      {
        section: sectionId,
        required,
        customText,
        customDescription,
        customOptions,
        conditionalLogic
      },
      { new: true, runValidators: true, session }
    ).populate({
      path: 'question',
      select: 'text description type options validation targetAudience'
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Survey question updated successfully',
      data: updatedQuestion
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Delete a survey question
 * @route DELETE /api/v1/survey-questions/:id
 * @access Private
 */
export const deleteSurveyQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyQuestion.db.startSession();
  session.startTransaction();

  try {
    const questionId = req.params.id;

    // Find the survey question
    const surveyQuestion = await SurveyQuestion.findById(questionId);
    if (!surveyQuestion) {
      const error = new Error('Survey question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if survey exists
    const survey = await Survey.findById(surveyQuestion.survey);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to modify this survey
    const isCreator = survey.creator.toString() === (req.user as AuthUser)._id.toString();
    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
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

    // Get the section and current order to update other questions
    const sectionId = surveyQuestion.section;
    const currentOrder = surveyQuestion.order;

    // Delete the survey question
    await SurveyQuestion.findByIdAndDelete(questionId, { session });

    // Update order of remaining questions in the same section
    const query = sectionId ? 
      { survey: surveyQuestion.survey, section: sectionId, order: { $gt: currentOrder } } :
      { survey: surveyQuestion.survey, section: null, order: { $gt: currentOrder } };
    
    await SurveyQuestion.updateMany(
      query,
      { $inc: { order: -1 } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Survey question deleted successfully',
      data: null
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Move question to a different section - FIXED FOR NESTED ROUTES
 * @route PUT /api/v1/surveys/:surveyId/questions/:id/move
 * @access Private
 */
export const moveQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyQuestion.db.startSession();
  session.startTransaction();

  try {
    const questionId = req.params.id;
    const surveyId = req.params.surveyId; // Get from nested route params
    const { sectionId } = req.body; // If null, move to no section

    console.log('🔄 moveQuestion called with:', {
      questionId,
      surveyId,
      sectionId,
      body: req.body,
      params: req.params
    });

    // Find the survey question and validate it belongs to the survey
    const surveyQuestion = await SurveyQuestion.findOne({
      _id: questionId,
      survey: surveyId // Ensure question belongs to this survey
    });
    
    if (!surveyQuestion) {
      const error = new Error('Survey question not found or does not belong to this survey') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    console.log('✅ Found survey question:', {
      id: surveyQuestion._id,
      currentSection: surveyQuestion.section,
      targetSection: sectionId
    });

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to modify this survey
    const authUser = req.user as AuthUser;
    const isCreator = survey.creator.toString() === authUser._id.toString();
    const hasProjectAccess = authUser.hasProjectAccess?.(survey.project);
    const isConnectGoStaff = authUser.isConnectGoStaff;
    
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

    // Check if target section exists and belongs to this survey
    if (sectionId) {
      const section = await SurveySection.findOne({
        _id: sectionId,
        survey: surveyId // Ensure section belongs to this survey
      });
      
      if (!section) {
        const error = new Error('Target section not found or does not belong to this survey') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      
      console.log('✅ Found target section:', {
        id: section._id,
        title: section.title
      });
    }

    // If survey is published, switch it to draft
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(survey._id, { status: 'draft' }, { session });
    }

    // Get the current section and order
    const currentSectionId = surveyQuestion.section;
    const currentOrder = surveyQuestion.order;

    console.log('📊 Current state:', {
      currentSectionId: currentSectionId?.toString(),
      currentOrder,
      targetSectionId: sectionId
    });

    // Update the order of remaining questions in the current section
    if (currentSectionId) {
      const updateResult = await SurveyQuestion.updateMany(
        {
          survey: surveyId,
          section: currentSectionId,
          order: { $gt: currentOrder }
        },
        { $inc: { order: -1 } },
        { session }
      );
      console.log('📝 Updated remaining questions in current section:', updateResult);
    } else {
      const updateResult = await SurveyQuestion.updateMany(
        {
          survey: surveyId,
          section: null,
          order: { $gt: currentOrder }
        },
        { $inc: { order: -1 } },
        { session }
      );
      console.log('📝 Updated remaining questions in no section:', updateResult);
    }

    // Find the highest order in the target section (or null section)
    const targetQuery = sectionId ?
      { survey: surveyId, section: sectionId } :
      { survey: surveyId, section: null };
    
    const highestOrderQuestion = await SurveyQuestion.findOne(targetQuery)
      .sort('-order')
      .exec();
    
    const newOrder = highestOrderQuestion ? highestOrderQuestion.order + 1 : 1;

    console.log('🎯 Target position:', {
      targetQuery,
      highestOrder: highestOrderQuestion?.order,
      newOrder
    });

    // Update the question's section and order
    const updatedQuestion = await SurveyQuestion.findByIdAndUpdate(
      questionId,
      {
        section: sectionId || null,
        order: newOrder
      },
      { new: true, runValidators: true, session }
    ).populate({
      path: 'question',
      select: 'text description type options validation targetAudience'
    });

    console.log('✅ Question updated:', {
      id: updatedQuestion?._id,
      newSection: updatedQuestion?.section?.toString(),
      newOrder: updatedQuestion?.order
    });

    await session.commitTransaction();
    session.endSession();

    // Verify the update worked by querying the database again
    const verificationQuery = await SurveyQuestion.findById(questionId).select('section order');
    console.log('🔍 Database verification:', {
      questionId,
      actualSection: verificationQuery?.section?.toString(),
      actualOrder: verificationQuery?.order
    });

    res.status(200).json({
      success: true,
      message: 'Survey question moved successfully',
      data: updatedQuestion,
      debug: {
        questionId,
        surveyId,
        fromSection: currentSectionId?.toString(),
        toSection: sectionId,
        newOrder,
        verification: {
          actualSection: verificationQuery?.section?.toString(),
          actualOrder: verificationQuery?.order
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ moveQuestion error:', error);
    
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Reorder questions within a section or the no-section area
 * @route PUT /api/v1/surveys/:surveyId/questions/reorder
 * @access Private
 */
export const reorderQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyQuestion.db.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { questions, sectionId } = req.body;

    // Validate input
    if (!questions || !Array.isArray(questions)) {
      const error = new Error('Questions array is required') as CustomError;
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
    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
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

    // Check if section exists if provided
    if (sectionId) {
      const section = await SurveySection.findById(sectionId);
      if (!section) {
        const error = new Error('Section not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      // Check if section belongs to this survey
      if (section.survey.toString() !== surveyId) {
        const error = new Error('Section does not belong to this survey') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Get all existing questions in this section (or no section)
    const query = sectionId ?
    { survey: surveyId, section: sectionId } :
    { survey: surveyId, section: null };

    const existingQuestions = await SurveyQuestion.find(query);

    // Type-assert the _id when mapping to handle the 'unknown' type
    const existingQuestionIds = new Set(
    existingQuestions.map(q => (q._id as mongoose.Types.ObjectId).toString())
    );
    
    // Validate that all provided question IDs belong to this section
    for (const questionData of questions) {
      if (!existingQuestionIds.has(questionData.id)) {
        const error = new Error(`Question with ID ${questionData.id} does not belong to this section`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // If survey is published, switch it to draft
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(surveyId, { status: 'draft' }, { session });
    }

    // Update the order of each question
    for (let i = 0; i < questions.length; i++) {
      await SurveyQuestion.findByIdAndUpdate(
        questions[i].id,
        { order: i + 1 },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Fetch the updated questions
    const updatedQuestions = await SurveyQuestion.find(query)
      .populate({
        path: 'question',
        select: 'text description type options validation targetAudience'
      })
      .sort('order');

    res.status(200).json({
      success: true,
      message: 'Survey questions reordered successfully',
      data: updatedQuestions
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};


/**
 * NEW: Bulk add questions with dependency resolution
 * This ensures questions are added in the correct order to satisfy conditional dependencies
 * @route POST /api/v1/surveys/:surveyId/questions/bulk-add
 * @access Private
 */
export const bulkAddQuestionsWithDependencies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyQuestion.db.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { questionIds, sectionId } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      const error = new Error('Question IDs array is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if survey exists and user has permissions
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const isCreator = survey.creator.toString() === (req.user as AuthUser)._id.toString();
    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
    const isConnectGoStaff = req.user?.isConnectGoStaff;
    
    if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    if (survey.status === 'closed') {
      const error = new Error('Cannot modify a closed survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Get all questions with their dependencies
    const questionsWithDeps = await (Question as any).getQuestionsWithDependencies(questionIds);
    
    // Sort questions to add dependencies first (topological sort)
    const sortedQuestions = topologicalSortQuestions(questionsWithDeps);
    
    // Filter to only add the originally requested questions
    const requestedQuestionIds = new Set(questionIds.map(id => id.toString()));
    const questionsToAdd = sortedQuestions.filter(q => 
      requestedQuestionIds.has(q._id.toString())
    );
    
    // Add questions in dependency order
    const addedQuestions = [];
    const questionToSurveyQuestionMap = new Map();
    
    // First get existing survey questions for mapping
    const existingSurveyQuestions = await SurveyQuestion.find({ survey: surveyId })
      .populate('question');
    
    existingSurveyQuestions.forEach((sq: any) => {
      questionToSurveyQuestionMap.set(
        sq.question._id.toString(),
        sq._id.toString()
      );
    });
    
    for (const question of questionsToAdd) {
      // Map conditional logic
      const mappedConditionalLogic = await mapConditionalLogicToSurvey(
        question.conditionalLogic,
        surveyId,
        questionToSurveyQuestionMap
      );
      
      const surveyQuestion = new SurveyQuestion({
        question: question._id,
        survey: surveyId,
        section: sectionId || null,
        required: question.required,
        conditionalLogic: mappedConditionalLogic,
        order: 0 // Will be set by pre-save hook
      });
      
      await surveyQuestion.save({ session });
      
      // Update map for subsequent questions
      questionToSurveyQuestionMap.set(
        question._id.toString(),
        (surveyQuestion._id as mongoose.Types.ObjectId).toString()
      );
      
      addedQuestions.push(surveyQuestion);
    }
    
    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(surveyId, { status: 'draft' }, { session });
    }
    
    await session.commitTransaction();
    session.endSession();

    // AUTO-TRIGGER: Create reviews for all bulk-added questions (non-blocking)
    try {
      const populatedForReview = await SurveyQuestion.find({
        _id: { $in: addedQuestions.map(q => q._id) }
      })
        .populate({
          path: 'question',
          select: 'text description type options validation targetAudience isBespoke bespokeMetadata isStandardDemographic demographicType',
        })
        .populate({
          path: 'survey',
          populate: { path: 'project', populate: { path: 'organization' } },
        })
        .populate('section');

      if (req.user) {
        await Promise.all(
          populatedForReview.map(sq =>
            createSurveyQuestionReview(sq, req.user!._id as mongoose.Types.ObjectId).catch(err =>
              console.error(`Failed to create review for bulk-added question ${sq._id}:`, err)
            )
          )
        );
      }
    } catch (reviewError) {
      console.error('Failed to create reviews for bulk-added questions:', reviewError);
    }

    // Populate and return
    const populatedQuestions = await SurveyQuestion.find({
      _id: { $in: addedQuestions.map(q => q._id) }
    })
      .populate('question')
      .populate('conditionalLogic.conditions.questionId')
      .sort('order');

    res.status(201).json({
      success: true,
      message: `Successfully added ${addedQuestions.length} questions with dependencies resolved`,
      data: populatedQuestions
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Helper function for topological sort of questions based on dependencies
 */
function topologicalSortQuestions(questions: any[]): any[] {
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  const questionMap = new Map<string, any>();
  
  // Build graph
  questions.forEach(q => {
    const qId = q._id.toString();
    questionMap.set(qId, q);
    
    if (!graph.has(qId)) {
      graph.set(qId, new Set());
      inDegree.set(qId, 0);
    }
    
    if (q.conditionalLogic?.enabled) {
      q.conditionalLogic.conditions.forEach((cond: any) => {
        const depId = cond.questionId.toString();
        
        if (!graph.has(depId)) {
          graph.set(depId, new Set());
          inDegree.set(depId, 0);
        }
        
        // depId -> qId (dependency -> dependent)
        graph.get(depId)!.add(qId);
        inDegree.set(qId, (inDegree.get(qId) || 0) + 1);
      });
    }
  });
  
  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const sorted: any[] = [];
  
  // Start with questions that have no dependencies
  inDegree.forEach((degree, qId) => {
    if (degree === 0) {
      queue.push(qId);
    }
  });
  
  while (queue.length > 0) {
    const qId = queue.shift()!;
    const question = questionMap.get(qId);
    
    if (question) {
      sorted.push(question);
    }
    
    const dependents = graph.get(qId);
    if (dependents) {
      dependents.forEach(depId => {
        const newDegree = (inDegree.get(depId) || 0) - 1;
        inDegree.set(depId, newDegree);
        
        if (newDegree === 0) {
          queue.push(depId);
        }
      });
    }
  }
  
  // If sorted length doesn't match input, there's a cycle
  if (sorted.length !== questions.length) {
    console.warn('⚠️ Circular dependency detected in questions');
    return questions; // Return unsorted if cycle detected
  }
  
  return sorted;
}

/**
 * NEW: Update conditional logic for a survey question
 * @route PUT /api/v1/surveys/:surveyId/questions/:id/conditional-logic
 * @access Private
 */
export const updateSurveyQuestionConditionalLogic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await SurveyQuestion.db.startSession();
  session.startTransaction();

  try {
    const { surveyId, id: questionId } = req.params;
    const { conditionalLogic } = req.body;

    const surveyQuestion = await SurveyQuestion.findOne({
      _id: questionId,
      survey: surveyId
    });
    
    if (!surveyQuestion) {
      const error = new Error('Survey question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check permissions
    const isCreator = survey.creator.toString() === (req.user as AuthUser)._id.toString();
    const hasProjectAccess = userHasProjectAccess(req, survey.project.toString());
    const isConnectGoStaff = req.user?.isConnectGoStaff;
    
    if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to modify this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    if (survey.status === 'closed') {
      const error = new Error('Cannot modify a closed survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate that referenced questions exist in the survey
    if (conditionalLogic?.enabled && conditionalLogic.conditions) {
      const surveyQuestionIds = await SurveyQuestion.find({ survey: surveyId })
        .distinct('_id');
      
      const surveyQuestionIdSet = new Set(surveyQuestionIds.map(id => (id as mongoose.Types.ObjectId).toString()));
      
      for (const condition of conditionalLogic.conditions) {
        if (!surveyQuestionIdSet.has(condition.questionId.toString())) {
          const error = new Error(
            `Referenced question ${condition.questionId} is not in this survey`
          ) as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }
    }

    surveyQuestion.conditionalLogic = conditionalLogic;
    await surveyQuestion.save({ session });

    if (survey.status === 'published') {
      await Survey.findByIdAndUpdate(surveyId, { status: 'draft' }, { session });
    }

    await session.commitTransaction();
    session.endSession();

    const updatedQuestion = await SurveyQuestion.findById(questionId)
      .populate('question')
      .populate('conditionalLogic.conditions.questionId');

    res.status(200).json({
      success: true,
      message: 'Conditional logic updated successfully',
      data: updatedQuestion
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};