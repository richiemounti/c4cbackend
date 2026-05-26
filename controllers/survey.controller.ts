// controllers/survey.controller.ts - UNIFIED VERSION (Fixed Typing)
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Survey from "../models/survey.model";
import SurveySection from "../models/surveySection.model";
import SurveyQuestion from "../models/surveyQuestion.model";
import Project from "../models/project.model";
import Question from "../models/question.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
import ProjectSite from "../models/projectSite.model";
import { CustomError } from "../middlewares/error.middleware";
import { userHasProjectAccess, isCreatorOrHasAccess, isUserAuthenticated } from '../lib/authHelpers';
import { getFilteredQuestions, getSurveyCreationContext } from "../services/questionFiltering.service";
import { createSurveyConfigReview } from "../utils/reviewHelpers";

// ===============================
// ENHANCED SURVEY CRUD OPERATIONS
// ===============================

/**
 * Create a new survey with full context validation
 * @route POST /api/v1/surveys
 * @access Private
 */
export const createSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      title,
      description,
      projectId,
      projectSiteId,
      stakeholderGroupId,
      stageId,
      category,
      customCategoryName,
      settings,
      isTemplate,
      templateCategory,
      estimatedDuration
    } = req.body;

    // Validate authentication
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Validate required fields
    if (!projectId || !stakeholderGroupId || !stageId) {
      const error = new Error('Project ID, stakeholder group ID, and stage ID are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if project exists
    const project = await Project.findById(projectId).session(session);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if stakeholder group exists
    const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId).session(session);
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if theory of change stage exists
    const stage = await TheoryOfChangeStage.findById(stageId).session(session);
    if (!stage) {
      const error = new Error('Theory of change stage not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Verify stakeholder group belongs to the same project
    if (stakeholderGroup.project.toString() !== projectId) {
      const error = new Error('Stakeholder group does not belong to this project') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Verify stage belongs to the same project
    if (stage.project.toString() !== projectId) {
      const error = new Error('Theory of change stage does not belong to this project') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user has permission to create surveys for this project
    const hasAccess = userHasProjectAccess(req, projectId);
    if (!hasAccess) {
      const error = new Error('Not authorized to create surveys for this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Validate category
    if (category === 'custom' && !customCategoryName) {
      const error = new Error('Custom category name is required when category is custom') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate project site if provided
    if (projectSiteId) {
      const projectSite = await ProjectSite.findById(projectSiteId).session(session);
      if (!projectSite || projectSite.project.toString() !== projectId) {
        const error = new Error('Invalid project site') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Create the survey with all required fields
    const newSurvey = new Survey({
      title,
      description,
      project: projectId,
      projectSite: projectSiteId || null,
      theoryOfChangeStage: stageId,
      stakeholderGroup: stakeholderGroupId,
      category: category || 'custom',
      customCategoryName,
      settings: settings || {},
      isTemplate: isTemplate || false,
      templateCategory,
      estimatedDuration: estimatedDuration || 10,
      creator: req.user._id,
      lastUpdatedBy: req.user._id
    });

    await newSurvey.save({ session });
    await session.commitTransaction();

    // Populate the response
    const populatedSurvey = await Survey.findById(newSurvey._id)
      .populate('project', 'name')
      .populate('stakeholderGroup', 'name group')
      .populate('theoryOfChangeStage', 'stageNumber status')
      .populate('projectSite', 'name');

    res.status(201).json({
      success: true,
      message: 'Survey created successfully',
      data: populatedSurvey
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// ===============================
// ADDITIONAL SURVEY BUILDER METHODS
// ===============================

/**
 * Get surveys by stakeholder group with enhanced display
 * @route GET /api/v1/surveys/stakeholder/:stakeholderGroupId
 * @access Private
 */
export const getSurveysByStakeholder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stakeholderGroupId } = req.params;
    const { includeArchived = false } = req.query;

    // Check if stakeholder group exists
    const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId)
      .populate('project', 'name');

    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check permissions
    const hasAccess = userHasProjectAccess(req, stakeholderGroup.project._id.toString());
    if (!hasAccess) {
      const error = new Error('Not authorized to access this stakeholder group') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Build filter
    const filter: any = { stakeholderGroup: stakeholderGroupId };
    if (!includeArchived) {
      filter.archived = { $ne: true };
    }

    // Get surveys with enhanced population
    const surveys = await Survey.find(filter)
      .populate('project', 'name')
      .populate('stakeholderGroup', 'name group')
      .populate('theoryOfChangeStage', 'stageNumber status')
      .populate('projectSite', 'name')
      .populate('creator', 'name email')
      .sort({ category: 1, sequenceNumber: 1, createdAt: -1 });

    // Group surveys by category for easier frontend consumption
    const surveysByCategory = surveys.reduce((acc: Record<string, any[]>, survey: any) => {
      const categoryKey = survey.category === 'custom' ? survey.customCategoryName : survey.category;
      const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
      const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
      const displayName = `${survey.title} (${categoryName}${sequence})`;
      
      if (!acc[categoryKey]) {
        acc[categoryKey] = [];
      }
      acc[categoryKey].push({
        id: survey._id,
        title: survey.title,
        displayName: displayName,
        category: survey.category,
        customCategoryName: survey.customCategoryName,
        sequenceNumber: survey.sequenceNumber,
        status: survey.status,
        totalQuestions: survey.totalQuestions,
        estimatedDuration: survey.estimatedDuration,
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.status(200).json({
      success: true,
      count: surveys.length,
      data: {
        surveys,
        surveysByCategory,
        categories: Object.keys(surveysByCategory)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get surveys by project and theory of change stage
 * @route GET /api/v1/surveys/project/:projectId/stage/:stageId
 * @access Private
 */
export const getSurveysByProjectAndStage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId, stageId } = req.params;
    const { includeArchived = false } = req.query;

    // Check permissions
    const hasAccess = userHasProjectAccess(req, projectId);
    if (!hasAccess) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Validate project and stage
    const [project, stage] = await Promise.all([
      Project.findById(projectId),
      TheoryOfChangeStage.findById(stageId)
    ]);

    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!stage) {
      const error = new Error('Theory of change stage not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Build filter
    const filter: any = { 
      project: projectId,
      theoryOfChangeStage: stageId 
    };
    if (!includeArchived) {
      filter.archived = { $ne: true };
    }

    // Get surveys with full population
    const surveys = await Survey.find(filter)
      .populate('project', 'name')
      .populate('stakeholderGroup', 'name group')
      .populate('theoryOfChangeStage', 'stageNumber status')
      .populate('projectSite', 'name')
      .populate('creator', 'name email')
      .sort({ 'stakeholderGroup.name': 1, category: 1, sequenceNumber: 1 });

    // Group by stakeholder for organized display
    const surveysByStakeholder = surveys.reduce((acc, survey) => {
      const stakeholderId = survey.stakeholderGroup._id.toString();
      const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
      const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
      const displayName = `${survey.title} (${categoryName}${sequence})`;
      
      if (!acc[stakeholderId]) {
        acc[stakeholderId] = {
          stakeholderGroup: survey.stakeholderGroup,
          surveys: []
        };
      }
      
      acc[stakeholderId].surveys.push({
        ...survey.toObject(),
        displayName
      });
      
      return acc;
    }, {} as Record<string, any>);

    res.status(200).json({
      success: true,
      count: surveys.length,
      data: {
        project,
        stage,
        surveys,
        surveysByStakeholder: Object.values(surveysByStakeholder)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update survey category and naming
 * @route PUT /api/v1/surveys/:surveyId/category
 * @access Private
 */
export const updateSurveyCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { category, customCategoryName } = req.body;

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Cannot update category of archived survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check permissions
    if (!isCreatorOrHasAccess(req, survey.creator, survey.project)) {
      const error = new Error('Not authorized to modify this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Validate category change
    if (category === 'custom' && !customCategoryName) {
      const error = new Error('Custom category name is required when category is custom') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Update the survey
    survey.category = category;
    survey.customCategoryName = customCategoryName;
    if (req.user) {
      survey.lastUpdatedBy = req.user._id as any;
    }

    await survey.save();

    const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
    const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
    const displayName = `${survey.title} (${categoryName}${sequence})`;

    res.status(200).json({
      success: true,
      message: 'Survey category updated successfully',
      data: {
        id: survey._id,
        title: survey.title,
        displayName: displayName,
        category: survey.category,
        customCategoryName: survey.customCategoryName,
        sequenceNumber: survey.sequenceNumber,
        status: survey.status,
        totalQuestions: survey.totalQuestions,
        estimatedDuration: survey.estimatedDuration,
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt
      }
    });
  } catch (error) {
    next(error);
  } 
};

/**
 * Get survey creation statistics for a stakeholder group
 * @route GET /api/v1/surveys/stats/stakeholder/:stakeholderGroupId
 * @access Private
 */
export const getStakeholderSurveyStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stakeholderGroupId } = req.params;

    const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId)
      .populate('project', 'name');

    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check permissions
    const hasAccess = userHasProjectAccess(req, stakeholderGroup.project._id.toString());
    if (!hasAccess) {
      const error = new Error('Not authorized to access this stakeholder group') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get comprehensive statistics
    const [
      totalSurveys,
      activeSurveys,
      archivedSurveys,
      categoryStats,
      recentActivity
    ] = await Promise.all([
      Survey.countDocuments({ stakeholderGroup: stakeholderGroupId }),
      Survey.countDocuments({ 
        stakeholderGroup: stakeholderGroupId, 
        status: { $in: ['draft', 'published'] },
        archived: { $ne: true }
      }),
      Survey.countDocuments({ 
        stakeholderGroup: stakeholderGroupId, 
        archived: true 
      }),
      Survey.aggregate([
        { $match: { stakeholderGroup: new mongoose.Types.ObjectId(stakeholderGroupId) } },
        { 
          $group: { 
            _id: '$category',
            count: { $sum: 1 },
            avgDuration: { $avg: '$estimatedDuration' },
            totalQuestions: { $sum: '$totalQuestions' }
          }
        }
      ]),
      Survey.find({ stakeholderGroup: stakeholderGroupId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('title category customCategoryName status updatedAt')
    ]);

    // Calculate response statistics if available
    const responseStats = await mongoose.model('SurveyResponse').aggregate([
      { 
        $lookup: {
          from: 'surveys',
          localField: 'survey',
          foreignField: '_id',
          as: 'surveyInfo'
        }
      },
      { $unwind: '$surveyInfo' },
      { $match: { 'surveyInfo.stakeholderGroup': new mongoose.Types.ObjectId(stakeholderGroupId) } },
      {
        $group: {
          _id: null,
          totalResponses: { $sum: 1 },
          completedResponses: { 
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          avgCompletionRate: { 
            $avg: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stakeholderGroup,
        overview: {
          totalSurveys,
          activeSurveys,
          archivedSurveys,
          totalResponses: responseStats[0]?.totalResponses || 0,
          completedResponses: responseStats[0]?.completedResponses || 0,
          avgCompletionRate: responseStats[0]?.avgCompletionRate || 0
        },
        categoryBreakdown: categoryStats,
        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all surveys with enhanced filtering and context
 * @route GET /api/v1/surveys
 * @access Private
 */
export const getSurveys = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      project,
      stakeholderGroup,
      theoryOfChangeStage,
      status,
      category,
      isTemplate,
      page = 1,
      limit = 50,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = { archived: { $ne: true } };

    if (project) filter.project = project;
    if (stakeholderGroup) filter.stakeholderGroup = stakeholderGroup;
    if (theoryOfChangeStage) filter.theoryOfChangeStage = theoryOfChangeStage;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';

    // Add search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { customCategoryName: { $regex: search, $options: 'i' } }
      ];
    }

    // If user is not ConnectGo staff, limit to accessible projects
    if (!req.user?.isConnectGoStaff && !project) {
      const userProjects = await Project.find({
        $or: [
          { creator: req.user?._id },
          { 'team.user': req.user?._id }
        ]
      }).select('_id');

      const projectIds = userProjects.map(p => p._id);
      if (projectIds.length === 0) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          pagination: { currentPage: 1, totalPages: 0, totalItems: 0 }
        });
      }
      filter.project = { $in: projectIds };
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with proper population
    const [surveys, totalCount] = await Promise.all([
      Survey.find(filter)
        .populate('project', 'name')
        .populate('stakeholderGroup', 'name group')
        .populate('theoryOfChangeStage', 'stageNumber status')
        .populate('projectSite', 'name')
        .populate('creator', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Survey.countDocuments(filter)
    ]);

    // Group surveys by stakeholder for enhanced display
    const surveysByStakeholder = surveys.reduce((acc, survey) => {
      const stakeholderId = survey.stakeholderGroup._id.toString();
      const categoryName = survey.category === 'custom' ? 
        survey.customCategoryName : survey.category;
      const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
      const displayName = `${survey.title} (${categoryName}${sequence})`;
      
      if (!acc[stakeholderId]) {
        acc[stakeholderId] = {
          stakeholderGroup: survey.stakeholderGroup,
          surveys: []
        };
      }
      
      acc[stakeholderId].surveys.push({
        ...survey.toObject(),
        displayName
      });
      
      return acc;
    }, {} as Record<string, any>);

    res.status(200).json({
      success: true,
      count: surveys.length,
      data: {
        surveys,
        surveysByStakeholder: Object.values(surveysByStakeholder)
      },
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalItems: totalCount,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single survey with full context
 * @route GET /api/v1/surveys/:id
 * @access Private
 */
export const getSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const surveyId = req.params.id;

    const survey = await Survey.findById(surveyId)
      .populate('project', 'name description')
      .populate('stakeholderGroup', 'name group description')
      .populate('theoryOfChangeStage', 'stageNumber status')
      .populate('projectSite', 'name description')
      .populate('creator', 'name email')
      .populate('lastUpdatedBy', 'name email');

    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Survey is archived') as CustomError;
      error.statusCode = 410;
      throw error;
    }

    // Check if user has permission to access this survey
    const hasAccess = userHasProjectAccess(req, survey.project._id.toString());
    if (!hasAccess) {
      const error = new Error('Not authorized to access this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Add display name for consistent UI
    const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
    const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
    const displayName = `${survey.title} (${categoryName}${sequence})`;

    res.status(200).json({
      success: true,
      data: {
        ...survey.toObject(),
        displayName
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
 * Update survey with enhanced validation
 * @route PUT /api/v1/surveys/:id
 * @access Private
 */
export const updateSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const surveyId = req.params.id;
    const {
      title,
      description,
      category,
      customCategoryName,
      status,
      settings,
      estimatedDuration
    } = req.body;

    // Find the survey — must use the same session so .save({ session }) works
    const survey = await Survey.findById(surveyId).session(session);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Cannot update an archived survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check permissions
    if (!isCreatorOrHasAccess(req, survey.creator, survey.project)) {
      const error = new Error('Not authorized to update this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Validate category change
    if (category === 'custom' && !customCategoryName) {
      const error = new Error('Custom category name is required when category is custom') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Don't allow status changes to published if survey doesn't have questions
    if (status === 'published' && survey.status !== 'published') {
      const questionCount = await SurveyQuestion.countDocuments({ survey: surveyId }).session(session);
      if (questionCount === 0) {
        const error = new Error('Cannot publish a survey without questions') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // ============================================================================
    // 🆕 TRACK STATUS CHANGE FOR AUTO-TRIGGER
    // ============================================================================
    const wasPublished = survey.status === 'published';
    const isNowPublished = status === 'published';
    const justPublished = !wasPublished && isNowPublished;
    // ============================================================================

    // Update fields
    if (title !== undefined) survey.title = title;
    if (description !== undefined) survey.description = description;
    if (category !== undefined) survey.category = category;
    if (customCategoryName !== undefined) survey.customCategoryName = customCategoryName;
    if (status !== undefined) survey.status = status;
    if (settings !== undefined) survey.settings = settings;
    if (estimatedDuration !== undefined) survey.estimatedDuration = estimatedDuration;
    
    if (req.user) {
      survey.lastUpdatedBy = req.user._id as any;
    }

    await survey.save({ session });

    // ============================================================================
    // 🆕 ADD AUTO-TRIGGER HERE (AFTER SAVE, BEFORE COMMIT)
    // ============================================================================
    
    // AUTO-TRIGGER: Create review when survey is published
    if (justPublished) {
      try {
        // Populate necessary fields for review creation
        const populatedSurvey = await Survey.findById(surveyId)
          .populate({
            path: 'project',
            populate: { path: 'organization' }
          })
          .populate('projectSite')
          .populate('stakeholderGroup')
          .populate('theoryOfChangeStage')
          .session(session);
        
        if (populatedSurvey && req.user) {
          // Import the review helper at the top of the file
          // import { createSurveyConfigReview } from '../utils/reviewHelpers';
          
          await createSurveyConfigReview(
            populatedSurvey,
            req.user._id as mongoose.Types.ObjectId
          );
          
          console.log(`✅ Review auto-created for published survey: ${populatedSurvey.title}`);
        }
      } catch (reviewError) {
        // Non-blocking - log error but don't fail the request
        console.error('Failed to create review for survey config:', reviewError);
      }
    }
    
    // ============================================================================
    // END OF AUTO-TRIGGER
    // ============================================================================

    await session.commitTransaction();

    // Return updated survey with populated fields
    const updatedSurvey = await Survey.findById(surveyId)
      .populate('project', 'name')
      .populate('stakeholderGroup', 'name group')
      .populate('theoryOfChangeStage', 'stageNumber status')
      .populate('projectSite', 'name');

    const categoryName = updatedSurvey!.category === 'custom' ? 
      updatedSurvey!.customCategoryName : updatedSurvey!.category;
    const sequence = updatedSurvey!.sequenceNumber > 1 ? ` #${updatedSurvey!.sequenceNumber}` : '';
    const displayName = `${updatedSurvey!.title} (${categoryName}${sequence})`;

    res.status(200).json({
      success: true,
      message: 'Survey updated successfully',
      data: {
        ...updatedSurvey!.toObject(),
        displayName
      }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};


/**
 * Calculate sample size for survey
 * @route POST /api/v1/surveys/:id/calculate-sample-size
 * @access Private
 */
export const calculateSampleSize = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const surveyId = req.params.id;
    const { populationSize, confidenceLevel = 95, marginOfError = 5 } = req.body;

    if (!populationSize || populationSize <= 0) {
      const error = new Error('Valid population size is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess) {
      const error = new Error('Not authorized to access this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Calculate sample size using statistical formula
    const zScore = confidenceLevel === 99 ? 2.576 : confidenceLevel === 95 ? 1.96 : 1.645;
    const p = 0.5; // Maximum variability
    const e = marginOfError / 100;
    
    // Basic sample size formula: n = (Z² × p × (1-p)) / E²
    const basicSampleSize = Math.ceil((Math.pow(zScore, 2) * p * (1 - p)) / Math.pow(e, 2));
    
    // Adjust for finite population: n_adj = n / (1 + (n-1)/N)
    const adjustedSampleSize = Math.ceil(basicSampleSize / (1 + (basicSampleSize - 1) / populationSize));
    
    const finalSampleSize = Math.min(adjustedSampleSize, populationSize);

    // Update survey with calculation
    // Initialize settings if it doesn't exist
    if (!survey.settings) {
      survey.settings = {
        isPublic: false,
        requiresAuth: true,
        allowAnonymous: false,
        allowMultipleResponses: false,
        showProgressBar: true,
        allowSaveAndContinue: true,
        randomizeQuestions: false,
        sendConfirmationEmail: false,
        notifyOnResponse: false
      };
    }

    const newCalculation = {
      populationSize,
      confidenceLevel,
      marginOfError,
      recommendedSampleSize: finalSampleSize,
      calculatedAt: new Date()
    };

    // Keep settings.samplingCalculator as the current/latest for backward compat
    survey.settings.samplingCalculator = {
      ...newCalculation,
      isEnabled: true
    };

    // Push to history array, newest first, capped at 5
    const history = [...(survey.samplingCalculations || [])] as any[];
    history.unshift(newCalculation);
    if (history.length > 5) history.length = 5;
    survey.set('samplingCalculations', history);

    if (req.user) {
      survey.lastUpdatedBy = req.user._id as any;
    }

    await survey.save();

    res.status(200).json({
      success: true,
      message: 'Sample size calculated successfully',
      data: {
        populationSize,
        confidenceLevel,
        marginOfError,
        recommendedSampleSize: finalSampleSize,
        calculationDetails: {
          basicSampleSize,
          adjustedSampleSize,
          zScore
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sample size calculation for survey
 * @route GET /api/v1/surveys/:id/sample-size
 * @access Private
 */
export const getSampleSizeCalculation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const surveyId = req.params.id;

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess) {
      const error = new Error('Not authorized to access this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const current = survey.settings?.samplingCalculator;
    const history = survey.samplingCalculations || [];

    if (!current?.isEnabled && history.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No sampling calculation found',
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: {
        current: current?.isEnabled ? current : null,
        history
      }
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// SURVEY BUILDER SPECIFIC METHODS
// ===============================

/**
 * Get filtered questions for survey creation
 * @route GET /api/v1/surveys/builder/questions/filtered
 * @access Private
 */
export const getFilteredQuestionsForSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      stakeholderGroupId,
      stageId,
      projectId,
      projectSiteId,
      includeFrequentlyAsked,
      includeBespoke,
      themeIds,
      subThemeIds,
      questionType,
      searchTerm,
      page,
      limit
    } = req.query;

    // Validate required parameters
    if (!stakeholderGroupId || !stageId) {
      const error = new Error('Stakeholder group ID and stage ID are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user has access to the project
    if (projectId) {
      const hasAccess = userHasProjectAccess(req, projectId as string);
      if (!hasAccess) {
        const error = new Error('Not authorized to access this project') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Parse array parameters
    const parsedThemeIds = themeIds ? (themeIds as string).split(',') : undefined;
    const parsedSubThemeIds = subThemeIds ? (subThemeIds as string).split(',') : undefined;

    const result = await getFilteredQuestions({
      stakeholderGroupId: stakeholderGroupId as string,
      stageId: stageId as string,
      projectId: projectId as string,
      projectSiteId: projectSiteId as string,
      includeFrequentlyAsked: includeFrequentlyAsked === 'true',
      themeIds: parsedThemeIds,
      subThemeIds: parsedSubThemeIds,
      questionType: questionType as string,
      searchTerm: searchTerm as string,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 50
    });

    // NEW: Add bespoke questions if requested and projectId is provided
    let bespokeQuestions: any[] = [];
    if (includeBespoke === 'true' && projectId) {
      bespokeQuestions = await (Question as any).getAvailableBespokeQuestionsForProject(projectId as string);
    }

    res.status(200).json({
      success: true,
      message: 'Filtered questions retrieved successfully',
      data: {
        ...result,
        bespokeQuestions: bespokeQuestions,
        totalWithBespoke: result.totalCount + bespokeQuestions.length
      },
      pagination: {
        currentPage: parseInt(page as string) || 1,
        totalPages: Math.ceil(result.totalCount / (parseInt(limit as string) || 50)),
        totalItems: result.totalCount,
        itemsPerPage: parseInt(limit as string) || 50
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get survey creation context
 * @route GET /api/v1/surveys/builder/context/:stakeholderGroupId/:stageId
 * @access Private
 */
export const getSurveyBuilderContext = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stakeholderGroupId, stageId } = req.params;

    const context = await getSurveyCreationContext(stakeholderGroupId, stageId);

    // Check if user has access to the project
    const hasAccess = userHasProjectAccess(req, context.stakeholderGroup.project.toString());
    if (!hasAccess) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Survey creation context retrieved successfully',
      data: context
    });
  } catch (error) {
    next(error);
  }
};

// ===============================
// UPDATED STRUCTURAL METHODS
// ===============================

/**
 * Get full survey structure with sections and questions (ENHANCED)
 * @route GET /api/v1/surveys/:id/structure
 * @access Private
 */
export const getSurveyStructure = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const surveyId = req.params.id;

    // Check if survey exists with full population
    const survey = await Survey.findById(surveyId)
      .populate('project', 'name description')
      .populate('stakeholderGroup', 'name group description')
      .populate('theoryOfChangeStage', 'stageNumber status')
      .populate('projectSite', 'name description')
      .populate('creator', 'name email');

    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Survey is archived') as CustomError;
      error.statusCode = 410;
      throw error;
    }

    // Enhanced authorization check
    const hasAccess = userHasProjectAccess(req, survey.project._id.toString());
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get all sections
    const sections = await SurveySection.find({
      survey: surveyId,
      archived: { $ne: true }
    }).sort('order');

    // Get all questions with enhanced population
    const questions = await SurveyQuestion.find({
      survey: surveyId,
      archived: { $ne: true }
    }).populate({
      path: 'question',
      select: 'text description type options scaleConfig matrixConfig validation targetAudience categories theme subThemes isStandardDemographic demographicType demographicCategory demographicMetadata isGlobalStandard conditionalLogic isBespoke bespokeMetadata'
    }).sort('order');

    // Organize questions by section
    const questionsMap = new Map<string, any[]>();
    
    // First collect questions with no section
    const noSectionQuestions = questions.filter(q => !q.section);
    
    // Then group by section
    questions.forEach(question => {
      if (question.section) {
        const sectionId = question.section.toString();
        if (!questionsMap.has(sectionId)) {
          questionsMap.set(sectionId, []);
        }
        questionsMap.get(sectionId)?.push(question);
      }
    });

    // Create enhanced structure object
    interface EnhancedSurveyStructure {
      survey: {
        _id: mongoose.Types.ObjectId;
        title: string;
        description?: string;
        status: string;
        category: string;
        customCategoryName?: string;
        sequenceNumber: number;
        settings?: any;
        isTemplate?: boolean;
        estimatedDuration?: number;
        totalQuestions: number;
        displayName: string;
        project: any;
        stakeholderGroup: any;
        theoryOfChangeStage: any;
        projectSite?: any;
        creator: any;
        createdAt: Date;
        updatedAt: Date;
      };
      noSectionQuestions: any[];
      sections: Array<{
        _id: mongoose.Types.ObjectId;
        title: string;
        description?: string;
        order: number;
        questions: any[];
      }>;
      totalSections: number;
      totalQuestions: number;
    }

    // Build display name
    const categoryName = survey.category === 'custom' ? survey.customCategoryName : survey.category;
    const sequence = survey.sequenceNumber > 1 ? ` #${survey.sequenceNumber}` : '';
    const displayName = `${survey.title} (${categoryName}${sequence})`;

    const structure: EnhancedSurveyStructure = {
      survey: {
        _id: survey._id,
        title: survey.title,
        description: survey.description || undefined,
        status: survey.status,
        category: survey.category,
        customCategoryName: survey.customCategoryName || undefined,
        sequenceNumber: survey.sequenceNumber,
        settings: survey.settings,
        isTemplate: survey.isTemplate,
        estimatedDuration: survey.estimatedDuration,
        totalQuestions: survey.totalQuestions,
        displayName,
        project: survey.project,
        stakeholderGroup: survey.stakeholderGroup,
        theoryOfChangeStage: survey.theoryOfChangeStage,
        projectSite: survey.projectSite,
        creator: survey.creator,
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt
      },
      noSectionQuestions,
      sections: sections.map(section => ({
        _id: section._id as mongoose.Types.ObjectId,
        title: section.title,
        description: section.description || undefined,
        order: section.order,
        questions: questionsMap.get((section._id as mongoose.Types.ObjectId).toString()) || []
      })),
      totalSections: sections.length,
      totalQuestions: questions.length
    };

    res.status(200).json({
      success: true,
      data: structure
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
 * Get survey sections (ENHANCED)
 * @route GET /api/v1/surveys/:id/sections
 * @access Private
 */
export const getSurveySections = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const surveyId = req.params.id;

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Survey is archived') as CustomError;
      error.statusCode = 410;
      throw error;
    }

    // Enhanced authorization check
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get sections with question counts
    const sections = await SurveySection.aggregate([
      {
        $match: {
          survey: new mongoose.Types.ObjectId(surveyId),
          archived: { $ne: true }
        }
      },
      {
        $lookup: {
          from: 'surveyquestions',
          localField: '_id',
          foreignField: 'section',
          as: 'questions'
        }
      },
      {
        $addFields: {
          questionCount: { $size: '$questions' }
        }
      },
      {
        $project: {
          questions: 0 // Remove the questions array, keep only count
        }
      },
      {
        $sort: { order: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
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
 * Get survey questions (ENHANCED)
 * @route GET /api/v1/surveys/:id/questions
 * @access Private
 */
export const getSurveyQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const surveyId = req.params.id;

    // Check if survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Survey is archived') as CustomError;
      error.statusCode = 410;
      throw error;
    }

    // Enhanced authorization check
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Build query
    let query = SurveyQuestion.find({ 
      survey: surveyId,
      archived: { $ne: true }
    });

    // Filter by section if provided
    if (req.query.section) {
      query = query.find({ section: req.query.section });
    }

    // Enhanced population with demographic info
    query = query.populate({
      path: 'question',
      select: 'text description type options scaleConfig matrixConfig validation targetAudience categories theme subThemes isStandardDemographic demographicType demographicCategory demographicMetadata isGlobalStandard conditionalLogic isBespoke bespokeMetadata'
    }).populate({
      path: 'section',
      select: 'title description order'
    });

    // Sort by order within sections
    query = query.sort('order');

    const questions = await query;

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
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
 * Archive survey (ENHANCED)
 * @route DELETE /api/v1/surveys/:id
 * @access Private
 */
export const archiveSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const surveyId = req.params.id;

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Survey is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Enhanced authorization check
    if (!isCreatorOrHasAccess(req, survey.creator, survey.project)) {
      const error = new Error('Not authorized to archive this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Don't allow archiving if survey has active responses
    const activeResponseCount = await mongoose.model('SurveyResponse').countDocuments({
      survey: surveyId,
      status: { $in: ['started', 'inProgress'] }
    });

    if (activeResponseCount > 0) {
      const error = new Error('Cannot archive survey with active responses') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the survey
    survey.archived = true;
    survey.archivedAt = new Date();
    survey.status = 'archived';
    if (req.user) {
      survey.lastUpdatedBy = req.user._id as any;
    }

    await survey.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Survey archived successfully',
      data: survey
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Restore archived survey (ENHANCED)
 * @route POST /api/v1/surveys/:id/restore
 * @access Private
 */
export const restoreSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const surveyId = req.params.id;

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!survey.archived) {
      const error = new Error('Survey is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Enhanced authorization check
    if (!isCreatorOrHasAccess(req, survey.creator, survey.project)) {
      const error = new Error('Not authorized to restore this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Restore the survey
    survey.archived = false;
    survey.set('archivedAt', null);
    survey.status = 'draft';
    if (req.user) {
      survey.lastUpdatedBy = req.user._id as any;
    }

    await survey.save({ session });
    await session.commitTransaction();

    const restoredSurvey = await Survey.findById(surveyId)
      .populate('project', 'name')
      .populate('stakeholderGroup', 'name group')
      .populate('theoryOfChangeStage', 'stageNumber status');

    res.status(200).json({
      success: true,
      message: 'Survey restored successfully',
      data: restoredSurvey
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Permanently delete survey (ENHANCED) - ConnectGo Staff Only
 * @route DELETE /api/v1/surveys/:id/permanent
 * @access Private (ConnectGo Staff)
 */
export const deleteSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const surveyId = req.params.id;

    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can permanently delete surveys') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check for any responses - don't allow deletion if responses exist
    const responseCount = await mongoose.model('SurveyResponse').countDocuments({
      survey: surveyId
    });

    if (responseCount > 0) {
      const error = new Error('Cannot permanently delete survey with responses') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Delete all related data
    await Promise.all([
      SurveyQuestion.deleteMany({ survey: surveyId }, { session }),
      SurveySection.deleteMany({ survey: surveyId }, { session }),
      Survey.findByIdAndDelete(surveyId, { session })
    ]);

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Survey permanently deleted'
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Clone survey (ENHANCED)
 * @route POST /api/v1/surveys/:id/clone
 * @access Private
 */
export const cloneSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const surveyId = req.params.id;
    const { title, projectId, stakeholderGroupId } = req.body;

    // Find the source survey
    const sourceSurvey = await Survey.findById(surveyId);
    if (!sourceSurvey) {
      const error = new Error('Source survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Enhanced authorization check
    const hasSourceAccess = userHasProjectAccess(req, sourceSurvey.project.toString());
    if (!hasSourceAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access source survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Validate target project and stakeholder group if different
    const targetProjectId = projectId || sourceSurvey.project;
    const targetStakeholderGroupId = stakeholderGroupId || sourceSurvey.stakeholderGroup;

    const hasTargetAccess = userHasProjectAccess(req, targetProjectId.toString());
    if (!hasTargetAccess) {
      const error = new Error('Not authorized to create surveys in target project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Clone the survey with new data
    const clonedSurvey = new Survey({
      ...sourceSurvey.toObject(),
      _id: undefined,
      title: title || `${sourceSurvey.title} (Copy)`,
      project: targetProjectId,
      stakeholderGroup: targetStakeholderGroupId,
      status: 'draft',
      creator: req.user?._id,
      lastUpdatedBy: req.user?._id,
      createdAt: undefined,
      updatedAt: undefined,
      archived: false,
      archivedAt: null
    });

    await clonedSurvey.save({ session });

    // Clone sections and questions
    const sections = await SurveySection.find({ survey: surveyId });
    const questions = await SurveyQuestion.find({ survey: surveyId });

    const sectionMap = new Map();
    
    // Clone sections
    for (const section of sections) {
      const newSection = new SurveySection({
        ...section.toObject(),
        _id: undefined,
        survey: clonedSurvey._id,
        createdAt: undefined,
        updatedAt: undefined
      });
      await newSection.save({ session });
      sectionMap.set((section._id as mongoose.Types.ObjectId).toString(), newSection._id);
    }

    // Clone questions
    for (const question of questions) {
      const newQuestion = new SurveyQuestion({
        ...question.toObject(),
        _id: undefined,
        survey: clonedSurvey._id,
        section: question.section ? sectionMap.get(question.section.toString()) : undefined,
        createdAt: undefined,
        updatedAt: undefined
      });
      await newQuestion.save({ session });
    }

    await session.commitTransaction();

    // Return populated cloned survey
    const populatedClonedSurvey = await Survey.findById(clonedSurvey._id)
      .populate('project', 'name')
      .populate('stakeholderGroup', 'name group')
      .populate('theoryOfChangeStage', 'stageNumber status');

    res.status(201).json({
      success: true,
      message: 'Survey cloned successfully',
      data: populatedClonedSurvey
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Attach consent form to survey
 * @route PUT /api/v1/surveys/:id/consent-form
 * @access Private
 */
export const attachConsentFormToSurvey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const surveyId = req.params.id;
    const { consentFormId, consentRequired } = req.body;

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Cannot update archived survey') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check permissions
    if (!isCreatorOrHasAccess(req, survey.creator, survey.project)) {
      const error = new Error('Not authorized to update this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Validate consent form
    if (consentFormId) {
      const consentForm = await mongoose.model('ConsentForm').findById(consentFormId);
      if (!consentForm) {
        const error = new Error('Consent form not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      if (!consentForm.isActive || consentForm.archived) {
        const error = new Error('Cannot use inactive or archived consent form') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Update survey
    survey.consentForm = consentFormId || null;
    survey.consentRequired = consentRequired !== undefined ? consentRequired : true;
    if (req.user) {
      survey.lastUpdatedBy = req.user._id as any;
    }

    await survey.save({ session });
    await session.commitTransaction();

    const updatedSurvey = await Survey.findById(surveyId)
      .populate('consentForm')
      .populate('project', 'name')
      .populate('stakeholderGroup', 'name');

    res.status(200).json({
      success: true,
      message: 'Consent form attached to survey successfully',
      data: updatedSurvey
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Add to survey.controller.ts if not already present

/**
 * Get public survey data (survey info + structure) for respondents without auth
 * @route GET /api/v1/surveys/:id/public-data
 * @access Public (only works for published surveys)
 */
export const getPublicSurveyData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const surveyId = req.params.id;

    const survey = await Survey.findById(surveyId)
      .populate('project', 'name')
      .populate('stakeholderGroup', 'name');

    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.archived) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.status !== 'published') {
      const error = new Error('Survey is not available') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const isPublic = survey.settings?.isPublic === true;

    // For private surveys, return minimal info so frontend can redirect to login
    if (!isPublic) {
      return res.status(200).json({
        success: true,
        data: {
          requiresAuth: true,
          title: survey.title,
          description: survey.description,
          status: survey.status,
          settings: { isPublic: false }
        }
      });
    }

    // For public surveys, return full structure
    const sections = await SurveySection.find({
      survey: surveyId,
      archived: { $ne: true }
    }).sort('order');

    const questions = await SurveyQuestion.find({
      survey: surveyId,
      archived: { $ne: true }
    }).populate({
      path: 'question',
      select: 'text description type options scaleConfig matrixConfig validation conditionalLogic'
    }).sort('order');

    const noSectionQuestions = questions.filter(q => !q.section);

    const sectionsWithQuestions = sections.map(section => ({
      _id: section._id,
      title: section.title,
      description: section.description,
      order: section.order,
      questions: questions.filter(q => q.section?.toString() === (section._id as any).toString())
    }));

    return res.status(200).json({
      success: true,
      data: {
        requiresAuth: false,
        survey: {
          _id: survey._id,
          title: survey.title,
          description: survey.description,
          status: survey.status,
          settings: survey.settings,
          consentRequired: survey.consentRequired,
          project: survey.project,
          stakeholderGroup: survey.stakeholderGroup
        },
        sections: sectionsWithQuestions,
        noSectionQuestions,
        totalQuestions: questions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get consent form for survey (public access for respondents)
 * @route GET /api/v1/surveys/:id/consent-form/public
 * @access Public
 */
export const getPublicSurveyConsentForm = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const surveyId = req.params.id;

    const survey = await Survey.findById(surveyId)
      .populate({
        path: 'consentForm',
        match: { isActive: true, archived: { $ne: true } }
      });

    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (survey.status !== 'published') {
      const error = new Error('Survey is not available') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If survey doesn't require consent or doesn't have a consent form
    if (!survey.consentForm || !survey.consentRequired) {
      return res.status(200).json({
        success: true,
        data: {
          hasConsent: false,
          consentRequired: false
        }
      });
    }

    // Return consent form details
    const consentForm = survey.consentForm as any;
    res.status(200).json({
      success: true,
      data: {
        hasConsent: true,
        consentRequired: survey.consentRequired,
        consentForm: {
          _id: consentForm._id,
          name: consentForm.name,
          description: consentForm.description,
          agreementLabel: consentForm.agreementLabel,
          version: consentForm.version,
          defaultLanguage: consentForm.defaultLanguage,
          translations: consentForm.translations
        }
      }
    });
  } catch (error) {
    next(error);
  }
};