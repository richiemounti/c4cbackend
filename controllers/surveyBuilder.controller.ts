// controllers/surveyBuilder.controller.ts - New controller for Module 3
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Survey from "../models/survey.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import { CustomError } from "../middlewares/error.middleware";
import { getFilteredQuestions, getSurveyCreationContext } from "../services/questionFiltering.service";
import { userHasProjectAccess, isUserAuthenticated } from '../lib/authHelpers';

/**
 * Get filtered questions for survey creation (Module 1)
 * @route GET /api/v1/survey-builder/questions/filtered
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

    res.status(200).json({
      success: true,
      message: 'Filtered questions retrieved successfully',
      data: result,
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
 * @route GET /api/v1/survey-builder/context/:stakeholderGroupId/:stageId
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

/**
 * Create a new survey with enhanced categorization (Module 2)
 * @route POST /api/v1/survey-builder/surveys
 * @access Private
 */
export const createCategorizedSurvey = async (
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

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Validate required fields
    if (!title || !projectId || !stakeholderGroupId || !stageId) {
      const error = new Error('Title, project ID, stakeholder group ID, and stage ID are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if project site exists (if provided)
    if (projectSiteId) {
      const projectSite = await ProjectSite.findById(projectSiteId);
      if (!projectSite) {
        const error = new Error('Project site not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      if (projectSite.project.toString() !== projectId) {
        const error = new Error('Project site does not belong to this project') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Check if stakeholder group exists
    const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId);
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if stage exists
    const stage = await TheoryOfChangeStage.findById(stageId);
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

    // Create the survey
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
      .populate('projectSite', 'name')
      .populate('theoryOfChangeStage', 'stageNumber name')
      .populate('stakeholderGroup', 'name category')
      .populate('creator', 'name email');

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

/**
 * Get all surveys for a stakeholder group
 * @route GET /api/v1/survey-builder/surveys/stakeholder/:stakeholderGroupId
 * @access Private
 */
export const getSurveysByStakeholder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stakeholderGroupId } = req.params;
    const { stageId, category, status } = req.query;

    // Build query
    const query: any = {
      stakeholderGroup: stakeholderGroupId,
      archived: { $ne: true }
    };

    if (stageId) query.theoryOfChangeStage = stageId;
    if (category) query.category = category;
    if (status) query.status = status;

    const surveys = await Survey.find(query)
      .populate('project', 'name')
      .populate('projectSite', 'name')
      .populate('theoryOfChangeStage', 'stageNumber name')
      .populate('stakeholderGroup', 'name category')
      .populate('creator', 'name')
      .sort({ category: 1, sequenceNumber: 1, createdAt: -1 });

    // Check if user has access to at least one survey's project
    if (surveys.length > 0) {
      const hasAccess = userHasProjectAccess(req, surveys[0].project._id.toString());
      if (!hasAccess) {
        const error = new Error('Not authorized to access these surveys') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

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
 * Get surveys by project and stage
 * @route GET /api/v1/survey-builder/surveys/project/:projectId/stage/:stageId
 * @access Private
 */
export const getSurveysByProjectAndStage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId, stageId } = req.params;
    const { projectSiteId } = req.query;

    // Check project access
    const hasAccess = userHasProjectAccess(req, projectId);
    if (!hasAccess) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Build query
    const query: any = {
      project: projectId,
      theoryOfChangeStage: stageId,
      archived: { $ne: true }
    };

    if (projectSiteId) {
      query.projectSite = projectSiteId;
    }

    const surveys = await Survey.find(query)
      .populate('projectSite', 'name')
      .populate('theoryOfChangeStage', 'stageNumber name')
      .populate('stakeholderGroup', 'name category')
      .populate('creator', 'name')
      .sort({ 'stakeholderGroup.name': 1, category: 1, sequenceNumber: 1 });

    // Group by stakeholder group
    const surveysByStakeholder = surveys.reduce((acc: Record<string, any>, survey: any) => {
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
    }, {} as Record<string, any>);

    res.status(200).json({
      success: true,
      count: surveys.length,
      data: {
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
 * @route PUT /api/v1/survey-builder/surveys/:surveyId/category
 * @access Private
 */
export const updateSurveyCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { surveyId } = req.params;
    const { category, customCategoryName } = req.body;

    const survey = await Survey.findById(surveyId);
    if (!survey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check permissions
    const hasAccess = userHasProjectAccess(req, survey.project.toString());
    if (!hasAccess) {
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
 * @route GET /api/v1/survey-builder/stats/stakeholder/:stakeholderGroupId
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
      const error = new Error('Not authorized to access this data') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get survey statistics
    const [
      totalSurveys,
      draftSurveys,
      publishedSurveys,
      surveysByCategory
    ] = await Promise.all([
      Survey.countDocuments({
        stakeholderGroup: stakeholderGroupId,
        archived: { $ne: true }
      }),
      Survey.countDocuments({
        stakeholderGroup: stakeholderGroupId,
        status: 'draft',
        archived: { $ne: true }
      }),
      Survey.countDocuments({
        stakeholderGroup: stakeholderGroupId,
        status: 'published',
        archived: { $ne: true }
      }),
      Survey.aggregate([
        {
          $match: {
            stakeholderGroup: new mongoose.Types.ObjectId(stakeholderGroupId),
            archived: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            customNames: {
              $push: {
                $cond: [
                  { $eq: ['$category', 'custom'] },
                  '$customCategoryName',
                  null
                ]
              }
            }
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        stakeholderGroup: {
          _id: stakeholderGroup._id,
          name: stakeholderGroup.name,
          project: stakeholderGroup.project
        },
        stats: {
          totalSurveys,
          draftSurveys,
          publishedSurveys,
          closedSurveys: totalSurveys - draftSurveys - publishedSurveys,
          surveysByCategory: surveysByCategory.map((cat: any) => ({
            category: cat._id,
            count: cat.count,
            customNames: cat.customNames.filter((name: any) => name !== null)
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clone a survey with new category
 * @route POST /api/v1/survey-builder/surveys/:surveyId/clone
 * @access Private
 */
export const cloneSurveyWithCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { surveyId } = req.params;
    const { newTitle, category, customCategoryName } = req.body;

    const originalSurvey = await Survey.findById(surveyId);
    if (!originalSurvey) {
      const error = new Error('Survey not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check permissions
    const hasAccess = userHasProjectAccess(req, originalSurvey.project.toString());
    if (!hasAccess) {
      const error = new Error('Not authorized to clone this survey') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Create cloned survey
    const clonedSurvey = new Survey({
      ...originalSurvey.toObject(),
      _id: new mongoose.Types.ObjectId(),
      title: newTitle || `${originalSurvey.title} (Copy)`,
      category: category || originalSurvey.category,
      customCategoryName: customCategoryName || originalSurvey.customCategoryName,
      status: 'draft',
      creator: req.user?._id,
      lastUpdatedBy: req.user?._id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await clonedSurvey.save({ session });

    // Clone survey sections and questions (if they exist)
    const SurveySection = mongoose.model('SurveySection');
    const SurveyQuestion = mongoose.model('SurveyQuestion');

    const sections = await SurveySection.find({
      survey: surveyId,
      archived: { $ne: true }
    });

    const sectionMap = new Map();
    for (const section of sections) {
      const newSection = new SurveySection({
        ...section.toObject(),
        _id: new mongoose.Types.ObjectId(),
        survey: clonedSurvey._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await newSection.save({ session });
      sectionMap.set(section._id.toString(), newSection._id);
    }

    const questions = await SurveyQuestion.find({
      survey: surveyId,
      archived: { $ne: true }
    });

    for (const question of questions) {
      const newQuestion = new SurveyQuestion({
        ...question.toObject(),
        _id: new mongoose.Types.ObjectId(),
        survey: clonedSurvey._id,
        section: question.section ? sectionMap.get(question.section.toString()) : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await newQuestion.save({ session });
    }

    await session.commitTransaction();

    const populatedSurvey = await Survey.findById(clonedSurvey._id)
      .populate('project', 'name')
      .populate('projectSite', 'name')
      .populate('theoryOfChangeStage', 'stageNumber name')
      .populate('stakeholderGroup', 'name category')
      .populate('creator', 'name');

    res.status(201).json({
      success: true,
      message: 'Survey cloned successfully',
      data: populatedSurvey
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};