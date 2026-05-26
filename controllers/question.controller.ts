// controllers/question.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Question, { IConditionalLogic, IQuestionDocument } from "../models/question.model";
import Theme from "../models/theme.model";
import SubTheme from "../models/subtheme.model";
import { CustomError } from "../middlewares/error.middleware";
import Category from "../models/category.model";
import { isUserAuthenticated, userHasProjectAccess } from "../lib/authHelpers";


// ========================================
// NEW CONTROLLER METHODS FOR CONDITIONAL LOGIC
// ========================================

/**
 * Validate conditional logic for a question
 * @route POST /api/v1/questions/:id/validate-conditional-logic
 * @access Private
 */
export const validateQuestionConditionalLogic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const questionId = req.params.id;

    const question = await Question.findById(questionId) as IQuestionDocument;
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('Cannot validate archived question') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate conditional logic
    const validation = await question.validateConditionalLogic();

    res.status(200).json({
      success: true,
      message: validation.isValid ? 'Conditional logic is valid' : 'Conditional logic has issues',
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        conditionalLogic: question.conditionalLogic
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get conditional dependencies for a question
 * @route GET /api/v1/questions/:id/conditional-dependencies
 * @access Private
 */
export const getQuestionConditionalDependencies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const questionId = req.params.id;

    const question = await Question.findById(questionId) as IQuestionDocument;
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('Cannot get dependencies for archived question') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const dependencies = await question.getConditionalDependencies();

    res.status(200).json({
      success: true,
      message: `Found ${dependencies.length} conditional dependencies`,
      data: {
        question: {
          id: question._id,
          text: question.text,
          conditionalLogic: question.conditionalLogic
        },
        dependencies: dependencies.map(dep => ({
          id: dep._id,
          text: dep.text,
          type: dep.type,
          options: dep.options
        }))
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get questions with all their conditional dependencies (bulk)
 * @route POST /api/v1/questions/with-dependencies
 * @access Private
 */
export const getQuestionsWithDependencies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { questionIds } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      const error = new Error('Question IDs array is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const questions = await (Question as any).getQuestionsWithDependencies(questionIds);

    // Separate primary questions from dependencies
    const primaryQuestionIds = new Set(questionIds.map(id => id.toString()));
    const primaryQuestions = questions.filter((q: any) => primaryQuestionIds.has(q._id.toString()));
    const dependencyQuestions = questions.filter((q: any) => !primaryQuestionIds.has(q._id.toString()));

    res.status(200).json({
      success: true,
      message: `Retrieved ${primaryQuestions.length} questions with ${dependencyQuestions.length} dependencies`,
      data: {
        questions: primaryQuestions,
        dependencies: dependencyQuestions,
        all: questions
      }
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Create a new question with selective tag assignment
 * @route POST /api/v1/questions
 * @access Private (ConnectGo staff only)
 */
export const createQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create questions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { 
      text, 
      description, 
      type, 
      required, 
      options, 
      validation,
      categories,
      theme, 
      subThemes, 
      targetAudience,
      tags,
      conditionalLogic,
      isStandardDemographic,
      demographicType,
      demographicCategory,
      isGlobalStandard,
      demographicMetadata,
      selectedIndicatorTags,
      selectedSdgTags,
      selectedResilienceTags,
      selectedEsgTags,
      selectedStandardTags,
      scaleConfig,
      matrixConfig
    } = req.body;

    // ── CATEGORY VALIDATION (one-to-many) ──
    const sanitizedCategories: string[] = Array.isArray(categories)
    ? categories.filter((c: string) => c && c.trim() !== '')
    : [];

    for (const catId of sanitizedCategories) {
      const categoryExists = await Category.findById(catId);
      if (!categoryExists) {
        const error = new Error(`Category ${catId} not found`) as CustomError;
        error.statusCode = 404;
        throw error;
      }
      if (categoryExists.archived) {
        const error = new Error(`Category ${catId} is archived`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // ── THEME VALIDATION ──
    if (isStandardDemographic) {
      if (!demographicType || !demographicCategory) {
        const error = new Error('Demographic type and category are required for standard demographic questions') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      const validDemographicTypes = ['age', 'gender', 'education', 'income', 'location', 'employment', 'household_size', 'marital_status', 'ethnicity', 'language', 'disability', 'other'];
      const validDemographicCategories = ['basic', 'socioeconomic', 'cultural', 'accessibility'];

      if (!validDemographicTypes.includes(demographicType)) {
        const error = new Error('Invalid demographic type') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      if (!validDemographicCategories.includes(demographicCategory)) {
        const error = new Error('Invalid demographic category') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      if (theme) {
        const themeExists = await Theme.findById(theme);
        if (!themeExists) {
          const error = new Error('Theme not found') as CustomError;
          error.statusCode = 404;
          throw error;
        }
      }
    } else {
      if (!theme) {
        const error = new Error('Theme is required for non-demographic questions') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      const themeExists = await Theme.findById(theme);
      if (!themeExists) {
        const error = new Error('Theme not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
    }

    // ── SUBTHEME VALIDATION (one-to-many) ──
    const subThemeIds: string[] = Array.isArray(subThemes)
    ? subThemes.filter(Boolean)
    : [];

    // Accumulators for union tag validation across all selected subThemes
    const allAvailableIndicators: string[] = [];
    const allAvailableSdgs: string[]       = [];
    const allAvailableResilience: string[] = [];
    const allAvailableEsg: string[]        = [];
    const allAvailableStandards: string[]  = [];

    for (const stId of subThemeIds) {
      const subThemeExists = await SubTheme.findById(stId);
      if (!subThemeExists) {
        const error = new Error(`SubTheme ${stId} not found`) as CustomError;
        error.statusCode = 404;
        throw error;
      }

      if (theme && subThemeExists.theme.toString() !== theme) {
        const error = new Error(`SubTheme ${stId} does not belong to the specified theme`) as CustomError;
        error.statusCode = 400;
        throw error;
      }

      allAvailableIndicators.push(...subThemeExists.indicatorTags.map((id: mongoose.Types.ObjectId) => id.toString()));
      allAvailableSdgs.push(...subThemeExists.sdgTags.map((id: mongoose.Types.ObjectId) => id.toString()));
      allAvailableResilience.push(...subThemeExists.resilienceTags.map((id: mongoose.Types.ObjectId) => id.toString()));
      allAvailableEsg.push(...subThemeExists.esgTags.map((id: mongoose.Types.ObjectId) => id.toString()));
      allAvailableStandards.push(...subThemeExists.standardTags.map((id: mongoose.Types.ObjectId) => id.toString()));
    }

    // Union tag validation — tag is valid if it exists in ANY of the selected subThemes
    if (selectedIndicatorTags?.length > 0) {
      const invalid = selectedIndicatorTags.filter((id: string) => !allAvailableIndicators.includes(id));
      if (invalid.length > 0) {
        const error = new Error('Some selected indicator tags are not available in the selected subThemes') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    if (selectedSdgTags?.length > 0) {
      const invalid = selectedSdgTags.filter((id: string) => !allAvailableSdgs.includes(id));
      if (invalid.length > 0) {
        const error = new Error('Some selected SDG tags are not available in the selected subThemes') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    if (selectedResilienceTags?.length > 0) {
      const invalid = selectedResilienceTags.filter((id: string) => !allAvailableResilience.includes(id));
      if (invalid.length > 0) {
        const error = new Error('Some selected resilience tags are not available in the selected subThemes') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    if (selectedEsgTags?.length > 0) {
      const invalid = selectedEsgTags.filter((id: string) => !allAvailableEsg.includes(id));
      if (invalid.length > 0) {
        const error = new Error('Some selected ESG tags are not available in the selected subThemes') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    if (selectedStandardTags?.length > 0) {
      const invalid = selectedStandardTags.filter((id: string) => !allAvailableStandards.includes(id));
      if (invalid.length > 0) {
        const error = new Error('Some selected standard tags are not available in the selected subThemes') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // ── OPTIONS VALIDATION ──
    if (['radio', 'checkbox', 'dropdown'].includes(type)) {
      if (!options || !Array.isArray(options) || options.length === 0) {
        const error = new Error(`Options are required for question type: ${type}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    if (type === 'scale') {
      if (!scaleConfig || typeof scaleConfig.min !== 'number' || typeof scaleConfig.max !== 'number') {
        const error = new Error('Scale questions require scaleConfig with numeric min and max') as CustomError;
        error.statusCode = 400;
        throw error;
      }
      if (scaleConfig.min >= scaleConfig.max) {
        const error = new Error('scaleConfig.min must be less than scaleConfig.max') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    if (type === 'matrix') {
      if (!matrixConfig || !Array.isArray(matrixConfig.rows) || matrixConfig.rows.length === 0 ||
          !Array.isArray(matrixConfig.columns) || matrixConfig.columns.length === 0) {
        const error = new Error('Matrix questions require matrixConfig with at least one row and one column') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    const creator = req.user._id;

    const questionData: any = {
      text,
      description,
      type,
      required: required ?? false,
      options,
      validation,
      creator,
      categories: sanitizedCategories,
      subThemes: subThemeIds,
      targetAudience: targetAudience || 'both',
      tags,
      conditionalLogic,
      selectedIndicatorTags: selectedIndicatorTags || [],
      selectedSdgTags: selectedSdgTags || [],
      selectedResilienceTags: selectedResilienceTags || [],
      selectedEsgTags: selectedEsgTags || [],
      selectedStandardTags: selectedStandardTags || [],
      status: req.body.status || 'draft',
      isTemplate: req.body.isTemplate || false
    };

    if (theme) {
      questionData.theme = theme;
    }

    if (type === 'scale' && scaleConfig) questionData.scaleConfig = scaleConfig;
    if (type === 'matrix' && matrixConfig) questionData.matrixConfig = matrixConfig;

    if (isStandardDemographic) {
      questionData.isStandardDemographic = true;
      questionData.demographicType = demographicType;
      questionData.demographicCategory = demographicCategory;
      questionData.isGlobalStandard = isGlobalStandard || false;

      if (demographicMetadata) {
        questionData.demographicMetadata = {
          isRequired: demographicMetadata.isRequired || false,
          recommendedForAudience: demographicMetadata.recommendedForAudience || ['both'],
          complianceRelevant: demographicMetadata.complianceRelevant || false,
          sensitivityLevel: demographicMetadata.sensitivityLevel || 'medium',
          dataRetentionPeriod: demographicMetadata.dataRetentionPeriod,
          anonymizationRequired: demographicMetadata.anonymizationRequired || false
        };
      }
    }

    const newQuestions = await Question.create([questionData]);

    const populatedQuestion = await Question.findById(newQuestions[0]._id)
      .populate('theme', 'name')
      .populate('subThemes', 'name')
      .populate('selectedIndicatorTags', 'name description')
      .populate('selectedSdgTags', 'code name')
      .populate('selectedResilienceTags', 'code name')
      .populate('selectedEsgTags', 'code name')
      .populate('selectedStandardTags', 'code name')
      .populate('categories', 'name description')
      .populate('creator', 'name email userName');

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: populatedQuestion
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all questions with pagination and filtering (updated for selective tags)
 * @route GET /api/v1/questions
 * @access Private
 */
export const getQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {

    // Handle bulk ID fetching
    if (req.query.ids && typeof req.query.ids === 'string') {
      const questionIds = req.query.ids.split(',').filter(id => id.trim());
      
      if (questionIds.length > 0) {
        let query = Question.find({ 
          _id: { $in: questionIds },
          archived: { $ne: true }
        });
        
        // FIXED: remap legacy singular param names to actual plural schema fields
        if (req.query.populate && typeof req.query.populate === 'string') {
          const populateFields = req.query.populate.split(',').map(field => field.trim());
          populateFields.forEach(field => {
            if (field === 'subTheme') {
              query = query.populate('subThemes', 'name theme');
            } else if (field === 'category') {
              query = query.populate('categories', 'name description inclusion');
            } else if (field === 'theme') {
              query = query.populate('theme', 'name');
            } else if (field === 'creator') {
              query = query.populate('creator', 'name email userName');
            } else {
              query = query.populate(field);
            }
          });
        }
        
        const questions = await query;
        
        return res.status(200).json({
          success: true,
          data: questions,
          count: questions.length
        });
      }
    }

    // Initialize query
    let query = Question.find({ archived: { $ne: true } });

    // Filter by scalar fields only — category and subThemes are array fields, handled separately below
    const filterFields = ['theme', 'type', 'targetAudience', 'status', 'isTemplate'];
    filterFields.forEach(field => {
      if (req.query[field]) {
        query = query.find({ [field]: req.query[field] });
      }
    });

    // Filter by categories (array field — match any)
    if (req.query.category) {
      const categoryIds = (req.query.category as string).split(',');
      query = query.find({ categories: { $in: categoryIds } });
    }

    // Filter by subThemes (array field — match any)
    if (req.query.subTheme) {
      const subThemeIds = (req.query.subTheme as string).split(',');
      query = query.find({ subThemes: { $in: subThemeIds } });
    }

    // Filter by selected tags
    if (req.query.selectedIndicatorTags) {
      const indicatorTagIds = (req.query.selectedIndicatorTags as string).split(',');
      query = query.find({ selectedIndicatorTags: { $in: indicatorTagIds } });
    }

    if (req.query.selectedSdgTags) {
      const sdgTagIds = (req.query.selectedSdgTags as string).split(',');
      query = query.find({ selectedSdgTags: { $in: sdgTagIds } });
    }

    if (req.query.selectedResilienceTags) {
      const resilienceTagIds = (req.query.selectedResilienceTags as string).split(',');
      query = query.find({ selectedResilienceTags: { $in: resilienceTagIds } });
    }

    if (req.query.selectedEsgTags) {
      const esgTagIds = (req.query.selectedEsgTags as string).split(',');
      query = query.find({ selectedEsgTags: { $in: esgTagIds } });
    }

    if (req.query.selectedStandardTags) {
      const standardTagIds = (req.query.selectedStandardTags as string).split(',');
      query = query.find({ selectedStandardTags: { $in: standardTagIds } });
    }

    // Search by text or tags
    if (req.query.search) {
      query = query.find({
        $or: [
          { text: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { tags: { $in: [new RegExp(req.query.search as string, 'i')] } }
        ]
      });
    }

    const reqQuery = { ...req.query };

    const removeFields = [
      'select', 'sort', 'page', 'limit', 'populate', 'search',
      'category', 'subTheme',
      'selectedIndicatorTags', 'selectedSdgTags', 'selectedResilienceTags', 'selectedEsgTags', 'selectedStandardTags',
      ...filterFields
    ];
    removeFields.forEach(param => delete reqQuery[param]);

    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    query = query.find(JSON.parse(queryStr));

    if (req.query.select) {
      const fields = (req.query.select as string).split(',').join(' ');
      query = query.select(fields) as typeof query;
    }

    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Handle population of related fields
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query = query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }

      if (populateFields.includes('category')) {
        query = query.populate({
          path: 'categories',
          select: 'name description inclusion'
        });
      }
      
      if (populateFields.includes('theme')) {
        query = query.populate({
          path: 'theme',
          select: 'name'
        });
      }
      
      if (populateFields.includes('subTheme')) {
        query = query.populate({
          path: 'subThemes',
          select: 'name theme'
        });
      }

      if (populateFields.includes('tags') || populateFields.includes('selectedTags') || populateFields.includes('all')) {
        query = query
          .populate('selectedIndicatorTags', 'name description')
          .populate('selectedSdgTags', 'code name description')
          .populate('selectedResilienceTags', 'code name description')
          .populate('selectedEsgTags', 'code name description type')
          .populate('selectedStandardTags', 'code name description issuingBody');
      }

      if (populateFields.includes('conditionalLogic') || populateFields.includes('all')) {
        query = query.populate({
          path: 'conditionalLogic.conditions.questionId',
          select: 'text type options'
        });
      }
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    // Build count query with the same filters
    let countQuery = Question.find({ archived: { $ne: true } });
    
    filterFields.forEach(field => {
      if (req.query[field]) {
        countQuery = countQuery.find({ [field]: req.query[field] });
      }
    });

    if (req.query.category) {
      const categoryIds = (req.query.category as string).split(',');
      countQuery = countQuery.find({ categories: { $in: categoryIds } });
    }

    if (req.query.subTheme) {
      const subThemeIds = (req.query.subTheme as string).split(',');
      countQuery = countQuery.find({ subThemes: { $in: subThemeIds } });
    }

    if (req.query.selectedIndicatorTags) {
      const indicatorTagIds = (req.query.selectedIndicatorTags as string).split(',');
      countQuery = countQuery.find({ selectedIndicatorTags: { $in: indicatorTagIds } });
    }

    if (req.query.selectedSdgTags) {
      const sdgTagIds = (req.query.selectedSdgTags as string).split(',');
      countQuery = countQuery.find({ selectedSdgTags: { $in: sdgTagIds } });
    }

    if (req.query.selectedResilienceTags) {
      const resilienceTagIds = (req.query.selectedResilienceTags as string).split(',');
      countQuery = countQuery.find({ selectedResilienceTags: { $in: resilienceTagIds } });
    }

    if (req.query.selectedEsgTags) {
      const esgTagIds = (req.query.selectedEsgTags as string).split(',');
      countQuery = countQuery.find({ selectedEsgTags: { $in: esgTagIds } });
    }

    if (req.query.selectedStandardTags) {
      const standardTagIds = (req.query.selectedStandardTags as string).split(',');
      countQuery = countQuery.find({ selectedStandardTags: { $in: standardTagIds } });
    }
    
    if (req.query.search) {
      countQuery = countQuery.find({
        $or: [
          { text: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { tags: { $in: [new RegExp(req.query.search as string, 'i')] } }
        ]
      });
    }
    
    const total = await countQuery.countDocuments();

    query = query.skip(startIndex).limit(limit);

    const questions = await query;

    const pagination: {
      next?: { page: number; limit: number };
      prev?: { page: number; limit: number };
    } = {};

    if (endIndex < total) {
      pagination.next = { page: page + 1, limit };
    }

    if (startIndex > 0) {
      pagination.prev = { page: page - 1, limit };
    }

    res.status(200).json({
      success: true,
      count: questions.length,
      pagination,
      total,
      data: questions
    });
  } catch (error) {
    next(error);
  }
};
/**
 * Get single question by ID
 * @route GET /api/v1/questions/:id
 * @access Private
 */
export const getQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const questionId = req.params.id;

    const query = Question.findById(questionId);
    
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }

      if (populateFields.includes('category')) {
        query.populate({
          path: 'categories',
          select: 'name description inclusion'
        });
      }
      
      if (populateFields.includes('theme')) {
        query.populate({
          path: 'theme',
          select: 'name'
        });
      }
      
      if (populateFields.includes('subTheme')) {
        query.populate({
          path: 'subThemes',
          select: 'name theme'
        });
      }

      if (populateFields.includes('tags') || populateFields.includes('selectedTags') || populateFields.includes('all')) {
        query
          .populate('selectedIndicatorTags', 'name description')
          .populate('selectedSdgTags', 'code name description')
          .populate('selectedResilienceTags', 'code name description')
          .populate('selectedEsgTags', 'code name description type')
          .populate('selectedStandardTags', 'code name description issuingBody');
      }

      if (populateFields.includes('conditionalLogic') || populateFields.includes('all')) {
        query.populate({
          path: 'conditionalLogic.conditions.questionId',
          select: 'text type options'
        });
      }
    }

    const question = await query;

    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('This question has been archived') as CustomError;
      error.statusCode = 410;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

// Addition to your question.controller.ts
// Add this method to support bulk question fetching

/**
 * Fetch multiple questions by IDs (bulk fetch for survey builder)
 * @route GET /api/v1/questions?ids=id1,id2,id3&populate=theme,subTheme
 * @access Private
 */
export const getQuestionsByIds = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ids, populate } = req.query;
    
    if (ids && typeof ids === 'string') {
      const questionIds = ids.split(',').filter(id => id.trim());
      
      if (questionIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          count: 0
        });
      }
      
      let query = Question.find({ 
        _id: { $in: questionIds },
        archived: { $ne: true }
      });
      
      if (populate && typeof populate === 'string') {
        const populateFields = populate.split(',').map(field => field.trim());
        populateFields.forEach(field => {
          if (field === 'theme') {
            query = query.populate('theme', 'name description');
          } else if (field === 'subTheme') {
            query = query.populate('subThemes', 'name description');
          } else if (field === 'category') {
            query = query.populate('categories', 'name description');
          } else if (field === 'creator') {
            query = query.populate('creator', 'name email userName');
          } else {
            query = query.populate(field);
          }
        });
      }
      
      const questions = await query.sort('createdAt');
      
      return res.status(200).json({
        success: true,
        data: questions,
        count: questions.length
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Error fetching questions by IDs:', error);
    const customError = new Error('Failed to fetch questions') as CustomError;
    customError.statusCode = 500;
    next(customError);
  }
};

/**
 * Update question by ID (including selective tag updates)
 * @route PUT /api/v1/questions/:id
 * @access Private (ConnectGo staff only)
 */
export const updateQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update questions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const questionId = req.params.id;
    const {
      text,
      description,
      type,
      required,
      options,
      validation,
      categories,
      theme,
      subThemes,
      targetAudience,
      status,
      isTemplate,
      tags,
      conditionalLogic,
      isStandardDemographic,
      demographicType,
      demographicCategory,
      demographicMetadata,
      selectedIndicatorTags,
      selectedSdgTags,
      selectedResilienceTags,
      selectedEsgTags,
      selectedStandardTags,
      scaleConfig,
      matrixConfig
    } = req.body;

    const question = await Question.findById(questionId);

    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('Cannot update an archived question') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // ── OPTIONS VALIDATION ──
    if (type && ['radio', 'checkbox', 'dropdown'].includes(type)) {
      if (!options || !Array.isArray(options) || options.length === 0) {
        const error = new Error(`Options are required for question type: ${type}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    if (type === 'scale' && scaleConfig !== undefined) {
      if (typeof scaleConfig.min !== 'number' || typeof scaleConfig.max !== 'number') {
        const error = new Error('scaleConfig requires numeric min and max') as CustomError;
        error.statusCode = 400;
        throw error;
      }
      if (scaleConfig.min >= scaleConfig.max) {
        const error = new Error('scaleConfig.min must be less than scaleConfig.max') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    if (type === 'matrix' && matrixConfig !== undefined) {
      if (!Array.isArray(matrixConfig.rows) || matrixConfig.rows.length === 0 ||
          !Array.isArray(matrixConfig.columns) || matrixConfig.columns.length === 0) {
        const error = new Error('matrixConfig requires at least one row and one column') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // ── CATEGORY VALIDATION (one-to-many) ──
    const sanitizedCategories: string[] | undefined = categories !== undefined
      ? (Array.isArray(categories)
          ? categories.filter((c: string) => c && c.trim() !== '')
          : [])
      : undefined;

    if (sanitizedCategories !== undefined) {
      for (const catId of sanitizedCategories) {
        const categoryExists = await Category.findById(catId);
        if (!categoryExists) {
          const error = new Error(`Category ${catId} not found`) as CustomError;
          error.statusCode = 404;
          throw error;
        }
        if (categoryExists.archived) {
          const error = new Error(`Category ${catId} is archived`) as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // ── THEME VALIDATION ──
    if (theme) {
      const themeExists = await Theme.findById(theme);
      if (!themeExists) {
        const error = new Error('Theme not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
    }

    // ── SUBTHEME VALIDATION (one-to-many) ──
    const subThemeIds: string[] | undefined = subThemes !== undefined
      ? (Array.isArray(subThemes) ? subThemes.filter(Boolean) : [])
      : undefined;

    if (subThemeIds !== undefined) {
      const allAvailableIndicators: string[] = [];
      const allAvailableSdgs: string[]       = [];
      const allAvailableResilience: string[] = [];
      const allAvailableEsg: string[]        = [];
      const allAvailableStandards: string[]  = [];

      // Resolve the theme to validate ownership against —
      // use the incoming theme if provided, otherwise fall back to the question's existing theme
      const resolvedTheme = theme ?? question.theme?.toString();

      for (const stId of subThemeIds) {
        const subThemeExists = await SubTheme.findById(stId);
        if (!subThemeExists) {
          const error = new Error(`SubTheme ${stId} not found`) as CustomError;
          error.statusCode = 404;
          throw error;
        }

        if (resolvedTheme && subThemeExists.theme.toString() !== resolvedTheme) {
          const error = new Error(`SubTheme ${stId} does not belong to the specified theme`) as CustomError;
          error.statusCode = 400;
          throw error;
        }

        allAvailableIndicators.push(...subThemeExists.indicatorTags.map((id: mongoose.Types.ObjectId) => id.toString()));
        allAvailableSdgs.push(...subThemeExists.sdgTags.map((id: mongoose.Types.ObjectId) => id.toString()));
        allAvailableResilience.push(...subThemeExists.resilienceTags.map((id: mongoose.Types.ObjectId) => id.toString()));
        allAvailableEsg.push(...subThemeExists.esgTags.map((id: mongoose.Types.ObjectId) => id.toString()));
        allAvailableStandards.push(...subThemeExists.standardTags.map((id: mongoose.Types.ObjectId) => id.toString()));
      }

      // Union tag validation — tag is valid if it exists in ANY of the selected subThemes
      if (selectedIndicatorTags?.length > 0) {
        const invalid = selectedIndicatorTags.filter((id: string) => !allAvailableIndicators.includes(id));
        if (invalid.length > 0) {
          const error = new Error('Some selected indicator tags are not available in the selected subThemes') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }

      if (selectedSdgTags?.length > 0) {
        const invalid = selectedSdgTags.filter((id: string) => !allAvailableSdgs.includes(id));
        if (invalid.length > 0) {
          const error = new Error('Some selected SDG tags are not available in the selected subThemes') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }

      if (selectedResilienceTags?.length > 0) {
        const invalid = selectedResilienceTags.filter((id: string) => !allAvailableResilience.includes(id));
        if (invalid.length > 0) {
          const error = new Error('Some selected resilience tags are not available in the selected subThemes') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }

      if (selectedEsgTags?.length > 0) {
        const invalid = selectedEsgTags.filter((id: string) => !allAvailableEsg.includes(id));
        if (invalid.length > 0) {
          const error = new Error('Some selected ESG tags are not available in the selected subThemes') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }

      if (selectedStandardTags?.length > 0) {
        const invalid = selectedStandardTags.filter((id: string) => !allAvailableStandards.includes(id));
        if (invalid.length > 0) {
          const error = new Error('Some selected standard tags are not available in the selected subThemes') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // ── CONDITIONAL LOGIC VALIDATION ──
    if (conditionalLogic?.enabled && conditionalLogic.conditions?.length > 0) {
      for (const condition of conditionalLogic.conditions) {
        if (condition.questionId?.toString() === questionId) {
          const error = new Error('A question cannot reference itself in conditional logic') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // ── BUILD UPDATE DATA ──
    const updateData: any = {};
    if (text !== undefined) updateData.text = text;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (required !== undefined) updateData.required = required;
    if (options !== undefined) updateData.options = options;
    if (validation !== undefined) updateData.validation = validation;
    if (sanitizedCategories !== undefined) updateData.categories = sanitizedCategories;
    if (theme !== undefined) updateData.theme = theme;
    if (subThemeIds !== undefined) updateData.subThemes = subThemeIds;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (status !== undefined) updateData.status = status;
    if (isTemplate !== undefined) updateData.isTemplate = isTemplate;
    if (tags !== undefined) updateData.tags = tags;
    if (conditionalLogic !== undefined) updateData.conditionalLogic = conditionalLogic;
    if (selectedIndicatorTags !== undefined) updateData.selectedIndicatorTags = selectedIndicatorTags;
    if (selectedSdgTags !== undefined) updateData.selectedSdgTags = selectedSdgTags;
    if (selectedResilienceTags !== undefined) updateData.selectedResilienceTags = selectedResilienceTags;
    if (selectedEsgTags !== undefined) updateData.selectedEsgTags = selectedEsgTags;
    if (selectedStandardTags !== undefined) updateData.selectedStandardTags = selectedStandardTags;
    if (scaleConfig !== undefined) updateData.scaleConfig = scaleConfig;
    if (matrixConfig !== undefined) updateData.matrixConfig = matrixConfig;
    if (isStandardDemographic !== undefined) {
      updateData.isStandardDemographic = isStandardDemographic;
      if (!isStandardDemographic) {
        updateData.demographicType = undefined;
        updateData.demographicCategory = undefined;
        updateData.demographicMetadata = undefined;
      } else {
        if (demographicType !== undefined) updateData.demographicType = demographicType;
        if (demographicCategory !== undefined) updateData.demographicCategory = demographicCategory;
        if (demographicMetadata !== undefined) updateData.demographicMetadata = demographicMetadata;
      }
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      { $set: updateData },
      { new: true, runValidators: false }
    )
      .populate('categories', 'name description')
      .populate('theme', 'name')
      .populate('subThemes', 'name')
      .populate('selectedIndicatorTags', 'name description')
      .populate('selectedSdgTags', 'code name')
      .populate('selectedResilienceTags', 'code name')
      .populate('selectedEsgTags', 'code name')
      .populate('selectedStandardTags', 'code name')
      .populate('creator', 'name email userName');

    res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      data: updatedQuestion
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get available tags from a question's subtheme
 * @route GET /api/v1/questions/:id/available-tags
 * @access Private
 */
export const getQuestionAvailableTags = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const questionId = req.params.id;

    // Find the question
    const question = await Question.findById(questionId) as IQuestionDocument;

    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('This question has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    // Get available tags from subtheme
    const availableTags = await question.getAvailableTagsFromSubtheme();

    if (!availableTags) {
      return res.status(200).json({
        success: true,
        message: 'No subtheme associated with this question',
        data: {
          subTheme: null,
          availableTags: null
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        subThemes: question.subThemes,
        availableTags
      }
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
 * Get available tags from a subtheme (helper endpoint for question creation)
 * @route GET /api/v1/subthemes/:id/available-tags-for-questions
 * @access Private
 */
export const getSubthemeAvailableTags = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const subThemeId = req.params.id;

    // Get the subtheme with populated tags
    const subTheme = await SubTheme.findById(subThemeId)
      .populate('indicatorTags', 'name description')
      .populate('sdgTags', 'code name description')
      .populate('resilienceTags', 'code name description')
      .populate('esgTags', 'code name description type')
      .populate('standardTags', 'code name description issuingBody')
      .select('name indicatorTags sdgTags resilienceTags esgTags standardTags');

    if (!subTheme) {
      const error = new Error('SubTheme not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (subTheme.archived) {
      const error = new Error('This subtheme has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        subTheme: {
          _id: subTheme._id,
          name: subTheme.name
        },
        availableTags: {
          indicators: subTheme.indicatorTags || [],
          sdgs: subTheme.sdgTags || [],
          resilience: subTheme.resilienceTags || [],
          esg: subTheme.esgTags || [],
          standards: subTheme.standardTags || []
        }
      }
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid subtheme ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Archive question by ID (soft delete)
 * @route DELETE /api/v1/questions/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive questions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const questionId = req.params.id;

    // Find the question first to check if it exists
    const question = await Question.findById(questionId);

    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('Question is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the question (soft delete)
    const archivedQuestion = await Question.findByIdAndUpdate(
      questionId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Question archived successfully',
      data: archivedQuestion
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
 * Restore archived question by ID
 * @route POST /api/v1/questions/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore questions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const questionId = req.params.id;

    // Find the question first to check if it exists and is archived
    const question = await Question.findById(questionId);

    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!question.archived) {
      const error = new Error('Question is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if the related entities are archived
    const theme = await Theme.findById(question.theme);
    if (theme?.archived) {
      const error = new Error('Cannot restore a question with an archived theme') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (question.subThemes?.length > 0) {
        const subThemeDocs = await SubTheme.find({ _id: { $in: question.subThemes } });
        const hasArchived = subThemeDocs.some(st => st.archived);
        if (hasArchived) {
            const error = new Error('Cannot restore a question with an archived subtheme') as CustomError;
            error.statusCode = 400;
            throw error;
        }
    }

    // Restore the question
    const restoredQuestion = await Question.findByIdAndUpdate(
      questionId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Question restored successfully',
      data: restoredQuestion
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
 * Permanently delete question by ID
 * @route DELETE /api/v1/questions/:id/permanent
 * @access Private (ConnectGo staff only)
 */
export const deleteQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can permanently delete questions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const questionId = req.params.id;

    // Find the question first to check if it exists
    const question = await Question.findById(questionId);

    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if the question is in use in any surveys
    const SurveyQuestion = mongoose.model('SurveyQuestion');
    const inUseCount = await SurveyQuestion.countDocuments({ question: questionId });
    
    if (inUseCount > 0) {
      const error = new Error(`Cannot delete question that is in use in ${inUseCount} surveys`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Permanently delete the question
    await Question.findByIdAndDelete(questionId);

    res.status(200).json({
      success: true,
      message: 'Question permanently deleted',
      data: null
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
 * Clone question by ID
 * @route POST /api/v1/questions/:id/clone
 * @access Private (ConnectGo staff only)
 */
export const cloneQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can clone questions') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const questionId = req.params.id;

    // Find the question to clone
    const question = await Question.findById(questionId);

    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('Cannot clone an archived question') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Create a new question based on the original.
    // conditionalLogic is intentionally not cloned — its questionId references
    // point to specific library questions and would be meaningless or wrong on a
    // fresh clone that the staff member hasn't wired up yet.
    const clonedQuestion = new Question({
      text: `${question.text} (Clone)`,
      description: question.description,
      type: question.type,
      required: question.required,
      options: question.options,
      validation: question.validation,
      creator: req.user._id,
      categories: question.categories,
      theme: question.theme,
      subThemes: question.subThemes,
      targetAudience: question.targetAudience,
      tags: question.tags,
      status: 'draft',
      isTemplate: question.isTemplate,
      selectedIndicatorTags: question.selectedIndicatorTags,
      selectedSdgTags: question.selectedSdgTags,
      selectedResilienceTags: question.selectedResilienceTags,
      selectedEsgTags: question.selectedEsgTags,
      selectedStandardTags: question.selectedStandardTags
    });

    await clonedQuestion.save();

    // Return the cloned question with populated tags
    const populatedClone = await Question.findById(clonedQuestion._id)
      .populate('categories', 'name description')
      .populate('theme', 'name')
      .populate('subThemes', 'name')
      .populate('selectedIndicatorTags', 'name description')
      .populate('selectedSdgTags', 'code name')
      .populate('selectedResilienceTags', 'code name')
      .populate('selectedEsgTags', 'code name')
      .populate('selectedStandardTags', 'code name')
      .populate('creator', 'name email userName');

    res.status(201).json({
      success: true,
      message: 'Question cloned successfully',
      data: populatedClone
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
 * Get question tag statistics
 * @route GET /api/v1/questions/tag-statistics
 * @access Private (ConnectGo staff only)
 */
export const getQuestionTagStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can access tag statistics') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Build filters from query parameters
    const filters: any = {};
    if (req.query.theme) filters.theme = req.query.theme;
    if (req.query.status) filters.status = req.query.status;

    // Get basic statistics
    const totalQuestions = await Question.countDocuments({ archived: { $ne: true }, ...filters });
    
    // Count questions with selected tags
    const questionsWithIndicators = await Question.countDocuments({ 
      ...filters, 
      archived: { $ne: true }, 
      selectedIndicatorTags: { $exists: true, $not: { $size: 0 } } 
    });
    
    const questionsWithSdgs = await Question.countDocuments({ 
      ...filters, 
      archived: { $ne: true }, 
      selectedSdgTags: { $exists: true, $not: { $size: 0 } } 
    });
    
    const questionsWithResilience = await Question.countDocuments({ 
      ...filters, 
      archived: { $ne: true }, 
      selectedResilienceTags: { $exists: true, $not: { $size: 0 } } 
    });
    
    const questionsWithEsg = await Question.countDocuments({ 
      ...filters, 
      archived: { $ne: true }, 
      selectedEsgTags: { $exists: true, $not: { $size: 0 } } 
    });
    
    const questionsWithStandards = await Question.countDocuments({ 
      ...filters, 
      archived: { $ne: true }, 
      selectedStandardTags: { $exists: true, $not: { $size: 0 } } 
    });

    const statistics = {
      totalQuestions,
      taggedQuestions: {
        withIndicators: questionsWithIndicators,
        withSdgs: questionsWithSdgs,
        withResilience: questionsWithResilience,
        withEsg: questionsWithEsg,
        withStandards: questionsWithStandards
      },
      percentages: {
        withIndicators: totalQuestions > 0 ? Math.round((questionsWithIndicators / totalQuestions) * 100) : 0,
        withSdgs: totalQuestions > 0 ? Math.round((questionsWithSdgs / totalQuestions) * 100) : 0,
        withResilience: totalQuestions > 0 ? Math.round((questionsWithResilience / totalQuestions) * 100) : 0,
        withEsg: totalQuestions > 0 ? Math.round((questionsWithEsg / totalQuestions) * 100) : 0,
        withStandards: totalQuestions > 0 ? Math.round((questionsWithStandards / totalQuestions) * 100) : 0
      }
    };

    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all standard demographic questions with filtering
 * @route GET /api/v1/questions/demographics
 * @access Private
 */
export const getStandardDemographics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      demographicType,
      category,
      audience,
      globalOnly,
      page = 1,
      limit = 50
    } = req.query;

    // Build filters object
    const filters: any = {};
    
    if (demographicType) filters.demographicType = demographicType as string;
    if (category) filters.category = category as string;
    if (audience) filters.audience = audience as string;
    if (globalOnly === 'true') filters.globalOnly = true;

    // Get demographic questions using the static method
    const demographics = await (Question as any).getStandardDemographics(filters);

    // Apply pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedDemographics = demographics.slice(startIndex, endIndex);

    // Build pagination object
    const pagination: any = {};
    const total = demographics.length;

    if (endIndex < total) {
      pagination.next = {
        page: Number(page) + 1,
        limit: Number(limit)
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: Number(page) - 1,
        limit: Number(limit)
      };
    }

    res.status(200).json({
      success: true,
      count: paginatedDemographics.length,
      total,
      pagination,
      data: paginatedDemographics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get demographics by category
 * @route GET /api/v1/questions/demographics/category/:category
 * @access Private
 */
export const getDemographicsByCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category } = req.params;
    
    // Validate category
    const validCategories = ['basic', 'socioeconomic', 'cultural', 'accessibility'];
    if (!validCategories.includes(category)) {
      const error = new Error('Invalid demographic category') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const demographics = await (Question as any).getDemographicsByCategory(category);

    res.status(200).json({
      success: true,
      count: demographics.length,
      data: demographics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recommended demographics for a specific audience
 * @route GET /api/v1/questions/demographics/recommended/:audience
 * @access Private
 */
export const getRecommendedDemographics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { audience } = req.params;
    
    // Validate audience
    const validAudiences = ['internal', 'external', 'both'];
    if (!validAudiences.includes(audience)) {
      const error = new Error('Invalid audience type') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const demographics = await (Question as any).getRecommendedDemographics(audience as any);

    // Group by category for easier consumption
    const groupedDemographics = demographics.reduce((acc: any, demo: any) => {
      const category = demo.demographicCategory;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(demo);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      count: demographics.length,
      data: {
        all: demographics,
        byCategory: groupedDemographics
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle standard demographic flag for a question
 * @route PUT /api/v1/questions/:id/toggle-demographic
 * @access Private (ConnectGo staff only)
 */
export const toggleStandardDemographic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can modify demographic settings') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const questionId = req.params.id;
    const {
      isStandardDemographic,
      demographicType,
      demographicCategory,
      isGlobalStandard = false,
      demographicMetadata
    } = req.body;

    // Find the question
    const question = await Question.findById(questionId);
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('Cannot modify archived question') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If enabling standard demographic, validate required fields
    if (isStandardDemographic) {
      if (!demographicType || !demographicCategory) {
        const error = new Error('Demographic type and category are required when enabling standard demographic') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // Validate enum values
      const validTypes = ['age', 'gender', 'education', 'income', 'location', 'employment', 'household_size', 'marital_status', 'ethnicity', 'language', 'disability', 'other'];
      const validCategories = ['basic', 'socioeconomic', 'cultural', 'accessibility'];

      if (!validTypes.includes(demographicType)) {
        const error = new Error('Invalid demographic type') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      if (!validCategories.includes(demographicCategory)) {
        const error = new Error('Invalid demographic category') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Update the question
    const updateData: any = {
      isStandardDemographic,
      isGlobalStandard
    };

    if (isStandardDemographic) {
      updateData.demographicType = demographicType;
      updateData.demographicCategory = demographicCategory;
      updateData.demographicMetadata = {
        isRequired: demographicMetadata?.isRequired || false,
        recommendedForAudience: demographicMetadata?.recommendedForAudience || ['both'],
        complianceRelevant: demographicMetadata?.complianceRelevant || false,
        sensitivityLevel: demographicMetadata?.sensitivityLevel || 'medium',
        dataRetentionPeriod: demographicMetadata?.dataRetentionPeriod,
        anonymizationRequired: demographicMetadata?.anonymizationRequired || false
      };
    } else {
      // Clear demographic fields if disabling
      updateData.demographicType = undefined;
      updateData.demographicCategory = undefined;
      updateData.demographicMetadata = undefined;
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      updateData,
      { new: true, runValidators: true }
    ).populate('categories', 'name description')
     .populate('theme', 'name')
     .populate('subThemes', 'name');

    res.status(200).json({
      success: true,
      message: `Question ${isStandardDemographic ? 'marked as' : 'unmarked as'} standard demographic`,
      data: updatedQuestion
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
 * Bulk toggle demographic status for multiple questions
 * @route PUT /api/v1/questions/bulk-toggle-demographic
 * @access Private (ConnectGo staff only)
 */
export const bulkToggleDemographic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await Question.db.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can modify demographic settings') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const {
      questionIds,
      isStandardDemographic,
      demographicType,
      demographicCategory,
      isGlobalStandard = false,
      demographicMetadata
    } = req.body;

    // Validate input
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      const error = new Error('Question IDs array is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If enabling, validate required fields
    if (isStandardDemographic && (!demographicType || !demographicCategory)) {
      const error = new Error('Demographic type and category are required when enabling standard demographic') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Find all questions
    const questions = await Question.find({
      _id: { $in: questionIds },
      archived: { $ne: true }
    });

    if (questions.length !== questionIds.length) {
      const error = new Error('Some questions not found or are archived') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Build update object
    const updateData: any = {
      isStandardDemographic,
      isGlobalStandard
    };

    if (isStandardDemographic) {
      updateData.demographicType = demographicType;
      updateData.demographicCategory = demographicCategory;
      updateData.demographicMetadata = {
        isRequired: demographicMetadata?.isRequired || false,
        recommendedForAudience: demographicMetadata?.recommendedForAudience || ['both'],
        complianceRelevant: demographicMetadata?.complianceRelevant || false,
        sensitivityLevel: demographicMetadata?.sensitivityLevel || 'medium',
        dataRetentionPeriod: demographicMetadata?.dataRetentionPeriod,
        anonymizationRequired: demographicMetadata?.anonymizationRequired || false
      };
    } else {
      updateData.demographicType = undefined;
      updateData.demographicCategory = undefined;
      updateData.demographicMetadata = undefined;
    }

    // Update all questions
    const result = await Question.updateMany(
      { _id: { $in: questionIds } },
      updateData,
      { session }
    );

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} questions updated successfully`,
      data: {
        modified: result.modifiedCount,
        matched: result.matchedCount
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
 * Get demographic compliance report
 * @route GET /api/v1/questions/demographics/compliance-report
 * @access Private (ConnectGo staff only)
 */
export const getDemographicComplianceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can access compliance reports') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get all standard demographic questions
    const demographics = await Question.find({
      isStandardDemographic: true,
      archived: { $ne: true }
    });

    // Generate compliance statistics
    const report = {
      totalDemographics: demographics.length,
      byCategory: {} as any,
      bySensitivity: {} as any,
      complianceRelevant: 0,
      requiresAnonymization: 0,
      withRetentionPeriods: 0,
      globalStandards: 0,
      byAudience: {
        internal: 0,
        external: 0,
        both: 0
      }
    };

    demographics.forEach(demo => {
      // Category breakdown
      const category = demo.demographicCategory || 'unknown';
      report.byCategory[category] = (report.byCategory[category] || 0) + 1;

      // Sensitivity breakdown
      const sensitivity = demo.demographicMetadata?.sensitivityLevel || 'unknown';
      report.bySensitivity[sensitivity] = (report.bySensitivity[sensitivity] || 0) + 1;

      // Compliance flags
      if (demo.demographicMetadata?.complianceRelevant) {
        report.complianceRelevant++;
      }
      if (demo.demographicMetadata?.anonymizationRequired) {
        report.requiresAnonymization++;
      }
      if (demo.demographicMetadata?.dataRetentionPeriod) {
        report.withRetentionPeriods++;
      }
      if (demo.isGlobalStandard) {
        report.globalStandards++;
      }

      // Audience breakdown
      const audiences = demo.demographicMetadata?.recommendedForAudience || ['both'];
      audiences.forEach(aud => {
        if (aud in report.byAudience) {
          report.byAudience[aud as keyof typeof report.byAudience]++;
        }
      });
    });

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// HELPER: Get or create the system-level Custom theme/subtheme
// Used to give bespoke questions a valid theme/subTheme reference
// ========================================

const CUSTOM_THEME_NAME = 'Custom';
const CUSTOM_SUBTHEME_NAME = 'Custom Subtheme';
const CUSTOM_THEME_DESCRIPTION = 'System theme for organisation-specific bespoke questions';
const CUSTOM_SUBTHEME_DESCRIPTION = ' ';

export const getOrCreateCustomThemeAndSubtheme = async (
  systemUserId: mongoose.Types.ObjectId
): Promise<{ theme: any; subTheme: any }> => {
  let theme = await Theme.findOne({
    name: CUSTOM_THEME_NAME,
    archived: { $ne: true }
  });

  if (!theme) {
    theme = await Theme.create({
      name: CUSTOM_THEME_NAME,
      description: CUSTOM_THEME_DESCRIPTION,
      creator: systemUserId,
      status: 'published'
    });
    console.log(`✅ Created system Custom theme: ${theme._id}`);
  }

  let subTheme = await SubTheme.findOne({
    name: CUSTOM_SUBTHEME_NAME,
    theme: theme._id,
    archived: { $ne: true }
  });

  if (!subTheme) {
    subTheme = await SubTheme.create({
      name: CUSTOM_SUBTHEME_NAME,
      description: CUSTOM_SUBTHEME_DESCRIPTION,
      theme: theme._id,
      theoryOfChangeStage: 'Stage 1 - Output', // required field — bespoke questions bypass stage filtering
      creator: systemUserId,
      status: 'published'
    });
    console.log(`✅ Created system Custom Subtheme: ${subTheme._id}`);
  }

  return { theme, subTheme };
};

/**
 * Create a bespoke question (client-created)
 * @route POST /api/v1/questions/bespoke
 * @access Private (Project members)
 */
export const createBespokeQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await Question.db.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated
    // Use the type guard - TypeScript knows req.user exists after this
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { 
      text, 
      description, 
      type, 
      required, 
      options, 
      validation,
      category,
      projectId,
      targetAudience = 'both'
    } = req.body;
    
    // Validate required fields
    if (!text || !type || !projectId) {
      const error = new Error('Question text, type, and project ID are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Check if project exists
    const Project = mongoose.model('Project');
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if user has access to this project
    const isCreator = project.creator.toString() === req.user._id.toString();
    const isTeamMember = project.team?.some((member: any) => 
      member.user.toString() === req.user._id.toString()
    );
    
    if (!isCreator && !isTeamMember && !req.user.isConnectGoStaff) {
      const error = new Error('Not authorized to create questions for this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    // Validate options based on question type
    if (['radio', 'checkbox', 'dropdown'].includes(type)) {
      if (!options || !Array.isArray(options) || options.length === 0) {
        const error = new Error(`Options are required for question type: ${type}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Validate category if provided
    if (category) {
      const Category = mongoose.model('Category');
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        const error = new Error('Category not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      
      if (categoryExists.archived) {
        const error = new Error('Cannot use an archived category') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Auto-assign the system Custom theme and subtheme
    const { theme: customTheme, subTheme: customSubTheme } = await getOrCreateCustomThemeAndSubtheme(
      req.user._id as mongoose.Types.ObjectId
    );

    // Create the bespoke question
    const bespokeQuestion = await Question.create([{
      text,
      description,
      type,
      required: required ?? false,
      options,
      validation,
      creator: req.user._id,
      categories: category ? [category] : [],
      theme: customTheme._id,       // ← was: null
      subThemes: [customSubTheme._id], // ← was: omitted
      targetAudience,
      status: 'draft',
      isBespoke: true,
      bespokeMetadata: {
        createdBy: req.user._id,
        project: projectId,
        organization: project.organization,
        status: 'pending'
      }
    }], { session });

    // Create/update organization question library
    const QuestionLibrary = mongoose.model('QuestionLibrary');
    const Organization = mongoose.model('Organization');
    const organization = await Organization.findById(project.organization);
    
    const libraryName = `${organization?.name || 'Organization'} - Custom Questions`;
    
    let library = await QuestionLibrary.findOne({
      name: libraryName,
      creator: req.user._id, // Or you might want to use a system user
      archived: { $ne: true }
    });
    
    if (!library) {
      library = await QuestionLibrary.create([{
        name: libraryName,
        description: `Custom questions created by ${organization?.name || 'organization'} members`,
        questions: [bespokeQuestion[0]._id],
        creator: req.user._id,
        status: 'draft'
      }], { session });
      library = library[0];
    } else {
      library.questions.push(bespokeQuestion[0]._id);
      await library.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Populate the response
    const populatedQuestion = await Question.findById(bespokeQuestion[0]._id)
      .populate('category', 'name description')
      .populate('bespokeMetadata.createdBy', 'name email')
      .populate('bespokeMetadata.project', 'name')
      .populate('bespokeMetadata.organization', 'name');

    res.status(201).json({
      success: true,
      message: 'Bespoke question created successfully and added to organization library',
      data: {
        question: populatedQuestion,
        library: {
          id: library._id,
          name: library.name
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get bespoke questions for a project
 * @route GET /api/v1/questions/bespoke/project/:projectId
 * @access Private
 */
export const getBespokeQuestionsByProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;
    const { status, createdBy, includeElevated } = req.query;
    
    // Check if project exists
    const Project = mongoose.model('Project');
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if user has access to this project
    const hasAccess = userHasProjectAccess(req, projectId);
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    const filters: any = {};
    if (status) filters.status = status as string;
    if (createdBy) filters.createdBy = createdBy as string;
    if (includeElevated !== undefined) filters.includeElevated = includeElevated === 'true';
    
    const questions = await (Question as any).getBespokeQuestionsByProject(projectId, filters);
    
    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get bespoke questions for an organization
 * @route GET /api/v1/questions/bespoke/organization/:organizationId
 * @access Private
 */
export const getBespokeQuestionsByOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { organizationId } = req.params;
    const { status, project } = req.query;
    
    // Check if organization exists
    const Organization = mongoose.model('Organization');
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      const error = new Error('Organization not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if user belongs to this organization or is staff
    if (!req.user?.isConnectGoStaff) {
      // Check if user is part of any project in this organization
      const Project = mongoose.model('Project');
      const userProjects = await Project.find({
        organization: organizationId,
        $or: [
          { creator: req.user?._id },
          { 'team.user': req.user?._id }
        ]
      });
      
      if (userProjects.length === 0) {
        const error = new Error('Not authorized to access this organization') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }
    
    const filters: any = {};
    if (status) filters.status = status as string;
    if (project) filters.project = project as string;
    
    const questions = await (Question as any).getBespokeQuestionsByOrganization(organizationId, filters);
    
    // Group by project for better organization
    const questionsByProject = questions.reduce((acc: any, question: any) => {
      const projectId = question.bespokeMetadata.project._id.toString();
      const projectName = question.bespokeMetadata.project.name;
      
      if (!acc[projectId]) {
        acc[projectId] = {
          project: {
            id: projectId,
            name: projectName
          },
          questions: []
        };
      }
      
      acc[projectId].questions.push(question);
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      count: questions.length,
      data: {
        all: questions,
        byProject: Object.values(questionsByProject)
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid organization ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get available bespoke questions for a project (approved only)
 * @route GET /api/v1/questions/bespoke/project/:projectId/available
 * @access Private
 */
export const getAvailableBespokeQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists
    const Project = mongoose.model('Project');
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if user has access to this project
    const hasAccess = userHasProjectAccess(req, projectId);
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    const questions = await (Question as any).getAvailableBespokeQuestionsForProject(projectId);
    
    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Approve a bespoke question
 * @route PUT /api/v1/questions/:id/approve
 * @access Private (Project managers/creators)
 */
export const approveBespokeQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {


  try {
    const questionId = req.params.id;
    
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    const question = await Question.findById(questionId) as any;
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    if (!question.isBespoke) {
      const error = new Error('Only bespoke questions can be approved') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Use the instance method to approve
    await question.approveBespokeQuestion(req.user._id);
    
    
    // Populate and return
    const updatedQuestion = await Question.findById(questionId)
      .populate('category', 'name description')
      .populate('bespokeMetadata.createdBy', 'name email')
      .populate('bespokeMetadata.approvedBy', 'name email')
      .populate('bespokeMetadata.project', 'name');
    
    res.status(200).json({
      success: true,
      message: 'Bespoke question approved successfully',
      data: updatedQuestion
    });
  } catch (error) {
    
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Reject a bespoke question
 * @route PUT /api/v1/questions/:id/reject
 * @access Private (Project managers/creators)
 */
export const rejectBespokeQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  try {
    const questionId = req.params.id;
    const { reason } = req.body;
    
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    if (!reason) {
      const error = new Error('Rejection reason is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    const question = await Question.findById(questionId) as any;
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    if (!question.isBespoke) {
      const error = new Error('Only bespoke questions can be rejected') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Use the instance method to reject
    await question.rejectBespokeQuestion(req.user._id, reason);
    
    // Populate and return
    const updatedQuestion = await Question.findById(questionId)
      .populate('category', 'name description')
      .populate('bespokeMetadata.createdBy', 'name email')
      .populate('bespokeMetadata.project', 'name');
    
    res.status(200).json({
      success: true,
      message: 'Bespoke question rejected',
      data: updatedQuestion
    });
  } catch (error) {
    
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Elevate a bespoke question to regular question
 * @route POST /api/v1/questions/:id/elevate
 * @access Private (ConnectGo staff only)
 */
export const elevateBespokeQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  try {
    const questionId = req.params.id;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }
    
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can elevate questions') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    const question = await Question.findById(questionId) as any;
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    if (!question.isBespoke) {
      const error = new Error('Only bespoke questions can be elevated') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Use the instance method to elevate
    const elevatedQuestion = await question.elevateBespokeQuestion(req.user._id);
    
    // Populate both questions
    const [originalQuestion, newQuestion] = await Promise.all([
      Question.findById(questionId)
        .populate('category', 'name description')
        .populate('bespokeMetadata.createdBy', 'name email')
        .populate('bespokeMetadata.elevatedBy', 'name email')
        .populate('bespokeMetadata.project', 'name'),
      Question.findById(elevatedQuestion._id)
        .populate('category', 'name description')
        .populate('theme', 'name')
        .populate('subThemes', 'name')
        .populate('creator', 'name email')
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Bespoke question elevated to regular question successfully',
      data: {
        originalQuestion,
        elevatedQuestion: newQuestion
      }
    });
  } catch (error) {
    
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update a bespoke question
 * @route PUT /api/v1/questions/bespoke/:id
 * @access Private (Creator or project managers)
 */
export const updateBespokeQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await Question.db.startSession();
  session.startTransaction();

  try {
    const questionId = req.params.id;
    const { 
      text, 
      description, 
      type, 
      required,
      options,
      validation,
      category,
      targetAudience
    } = req.body;

    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const question = await Question.findById(questionId);
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!question.isBespoke) {
      const error = new Error('Only bespoke questions can be updated via this endpoint') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (question.archived) {
      const error = new Error('Cannot update an archived question') as CustomError;
      error.statusCode = 400;
      throw error;
    }
    
    // Check if user is the creator or has project access
    const isCreator = question.bespokeMetadata?.createdBy.toString() === req.user?._id.toString();
    const hasProjectAccess = question.bespokeMetadata?.project && 
                            userHasProjectAccess(req, question.bespokeMetadata.project.toString());
    
    if (!isCreator && !hasProjectAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to update this question') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    // Can't edit if already elevated
    if (question.bespokeMetadata?.status === 'elevated') {
      const error = new Error('Cannot edit an elevated question') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // If changing type and options are needed
    if (type && ['radio', 'checkbox', 'dropdown'].includes(type)) {
      if (!options || !Array.isArray(options) || options.length === 0) {
        const error = new Error(`Options are required for question type: ${type}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }
    
    // Validate category if provided
    if (category) {
      const Category = mongoose.model('Category');
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        const error = new Error('Category not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      
      if (categoryExists.archived) {
        const error = new Error('Cannot use an archived category') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (text !== undefined) updateData.text = text;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (required !== undefined) updateData.required = required;
    if (options !== undefined) updateData.options = options;
    if (validation !== undefined) updateData.validation = validation;
    if (category !== undefined) updateData.category = category;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;

    // ← NEW: Bespoke questions always stay on the Custom theme/subTheme.
    //   Silently re-enforce in case of stale data rather than throwing an error.
    const { theme: customTheme, subTheme: customSubTheme } = await getOrCreateCustomThemeAndSubtheme(
      req.user?._id as mongoose.Types.ObjectId
    );
    updateData.theme = customTheme._id;
    updateData.subThemes = [customSubTheme._id];
    
    // If approved question is edited, reset to pending
    if (question.bespokeMetadata?.status === 'approved') {
      updateData['bespokeMetadata.status'] = 'pending';
      updateData['bespokeMetadata.approvedBy'] = undefined;
      updateData['bespokeMetadata.approvedAt'] = undefined;
      updateData.status = 'draft';
    }

    // Update the question
    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      updateData,
      { new: true, runValidators: true, session }
    )
      .populate('category', 'name description')
      .populate('bespokeMetadata.createdBy', 'name email')
      .populate('bespokeMetadata.approvedBy', 'name email')
      .populate('bespokeMetadata.project', 'name');

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Bespoke question updated successfully',
      data: updatedQuestion
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get bespoke question statistics for a project
 * @route GET /api/v1/questions/bespoke/project/:projectId/statistics
 * @access Private
 */
export const getBespokeQuestionStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;
    
    // Check if project exists
    const Project = mongoose.model('Project');
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }
    
    // Check if user has access to this project
    const hasAccess = userHasProjectAccess(req, projectId);
    if (!hasAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }
    
    const [
      totalBespoke,
      pending,
      approved,
      rejected,
      elevated,
      byCreator,
      recentActivity
    ] = await Promise.all([
      Question.countDocuments({
        isBespoke: true,
        'bespokeMetadata.project': projectId,
        archived: { $ne: true }
      }),
      Question.countDocuments({
        isBespoke: true,
        'bespokeMetadata.project': projectId,
        'bespokeMetadata.status': 'pending',
        archived: { $ne: true }
      }),
      Question.countDocuments({
        isBespoke: true,
        'bespokeMetadata.project': projectId,
        'bespokeMetadata.status': 'approved',
        archived: { $ne: true }
      }),
      Question.countDocuments({
        isBespoke: true,
        'bespokeMetadata.project': projectId,
        'bespokeMetadata.status': 'rejected'
      }),
      Question.countDocuments({
        isBespoke: true,
        'bespokeMetadata.project': projectId,
        'bespokeMetadata.status': 'elevated'
      }),
      Question.aggregate([
        {
          $match: {
            isBespoke: true,
            'bespokeMetadata.project': new mongoose.Types.ObjectId(projectId),
            archived: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$bespokeMetadata.createdBy',
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'creator'
          }
        },
        {
          $unwind: '$creator'
        },
        {
          $project: {
            creatorId: '$_id',
            creatorName: '$creator.name',
            creatorEmail: '$creator.email',
            count: 1
          }
        },
        { $sort: { count: -1 } }
      ]),
      Question.find({
        isBespoke: true,
        'bespokeMetadata.project': projectId
      })
        .sort('-updatedAt')
        .limit(10)
        .select('text bespokeMetadata.status bespokeMetadata.createdBy updatedAt')
        .populate('bespokeMetadata.createdBy', 'name email')
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalBespoke,
          pending,
          approved,
          rejected,
          elevated
        },
        byCreator,
        recentActivity
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid project ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};


// ========================================
// HELPER FUNCTIONS FOR SURVEY QUESTION CONTROLLER
// ========================================

/**
 * Helper function to map Question conditional logic to SurveyQuestion conditional logic
 * This is called when adding a question to a survey
 */
export const mapConditionalLogicToSurvey = async (
  questionConditionalLogic: IConditionalLogic | undefined,
  surveyId: string,
  questionToSurveyQuestionMap: Map<string, string>
): Promise<any | undefined> => {
  if (!questionConditionalLogic || !questionConditionalLogic.enabled) {
    return undefined;
  }

  // Map Question IDs to SurveyQuestion IDs
  const mappedConditions = [];
  
  for (const condition of questionConditionalLogic.conditions) {
    const surveyQuestionId = questionToSurveyQuestionMap.get(condition.questionId.toString());
    
    if (surveyQuestionId) {
      mappedConditions.push({
        questionId: surveyQuestionId,
        operator: condition.operator,
        value: condition.value
      });
    } else {
      // Dependency not in survey - log warning
      console.warn(`⚠️ Conditional dependency ${condition.questionId} not found in survey ${surveyId}`);
    }
  }

  // Only return conditional logic if at least one condition was successfully mapped
  if (mappedConditions.length > 0) {
    return {
      enabled: true,
      conditions: mappedConditions,
      action: questionConditionalLogic.action,
      logicOperator: questionConditionalLogic.logicOperator
    };
  }

  return undefined;
};

/**
 * Helper function to validate that all conditional dependencies are present in survey
 */
export const validateConditionalDependenciesInSurvey = async (
  questionId: string,
  surveyId: string
): Promise<{
  isValid: boolean;
  missingDependencies: string[];
  warnings: string[];
}> => {
  const question = await Question.findById(questionId);
  
  if (!question || !question.conditionalLogic?.enabled) {
    return { isValid: true, missingDependencies: [], warnings: [] };
  }

  const SurveyQuestion = mongoose.model('SurveyQuestion');
  
  // Get all questions in the survey
  const surveyQuestions = await SurveyQuestion.find({ survey: surveyId })
    .populate('question');
  
  const questionIdsInSurvey = new Set(
    surveyQuestions.map((sq: any) => sq.question._id.toString())
  );
  
  const missingDependencies: string[] = [];
  const warnings: string[] = [];
  
  for (const condition of question.conditionalLogic.conditions) {
    const dependencyId = condition.questionId.toString();
    
    if (!questionIdsInSurvey.has(dependencyId)) {
      const depQuestion = await Question.findById(dependencyId);
      missingDependencies.push(depQuestion?.text || dependencyId);
      warnings.push(
        `Conditional dependency "${depQuestion?.text || dependencyId}" is not in this survey`
      );
    }
  }
  
  return {
    isValid: missingDependencies.length === 0,
    missingDependencies,
    warnings
  };
};

/**
 * Update only the conditional logic of a question
 * @route PUT /api/v1/questions/:id/conditional-logic
 * @access Private (ConnectGo staff only)
 */
export const updateQuestionConditionalLogic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update question conditional logic') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const questionId = req.params.id;
    const { conditionalLogic } = req.body;

    // Explicit check — undefined means the field was never sent, which is a client error here
    if (conditionalLogic === undefined) {
      const error = new Error('conditionalLogic is required in the request body') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const question = await Question.findById(questionId) as IQuestionDocument;

    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (question.archived) {
      const error = new Error('Cannot update an archived question') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // null means the caller explicitly wants to clear conditional logic
    if (conditionalLogic === null) {
      await Question.findByIdAndUpdate(questionId, { $unset: { conditionalLogic: 1 } });

      return res.status(200).json({
        success: true,
        message: 'Conditional logic cleared successfully',
        data: await Question.findById(questionId),
        validation: { isValid: true, errors: [], warnings: [] }
      });
    }

    // Pre-write validation: check self-reference and referenced question existence
    if (conditionalLogic?.enabled && conditionalLogic.conditions?.length > 0) {
      for (const condition of conditionalLogic.conditions) {
        if (condition.questionId?.toString() === questionId) {
          const error = new Error('A question cannot reference itself in conditional logic') as CustomError;
          error.statusCode = 400;
          throw error;
        }

        const referencedQuestion = await Question.findById(condition.questionId);
        if (!referencedQuestion) {
          const error = new Error(`Referenced question ${condition.questionId} not found`) as CustomError;
          error.statusCode = 404;
          throw error;
        }

        if (referencedQuestion.archived) {
          const error = new Error('Referenced question is archived') as CustomError;
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // Run full validation on the in-memory document BEFORE writing to DB
    question.conditionalLogic = conditionalLogic;
    const validation = await question.validateConditionalLogic();

    if (!validation.isValid) {
      const error = new Error(`Conditional logic validation failed: ${validation.errors.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      { $set: { conditionalLogic } },
      { new: true, runValidators: false }
    ).populate('conditionalLogic.conditions.questionId', 'text type options');

    res.status(200).json({
      success: true,
      message: 'Conditional logic updated successfully',
      data: updatedQuestion,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get questions that depend on a specific question (reverse dependencies)
 * @route GET /api/v1/questions/:id/dependents
 * @access Private
 */
export const getQuestionDependents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const questionId = req.params.id;

    const question = await Question.findById(questionId);
    if (!question) {
      const error = new Error('Question not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Find all questions that reference this question in their conditional logic
    const dependents = await Question.find({
      'conditionalLogic.enabled': true,
      'conditionalLogic.conditions.questionId': questionId,
      archived: { $ne: true }
    })
      .populate('theme', 'name')
      .populate('subThemes', 'name')
      .populate('conditionalLogic.conditions.questionId', 'text type');

    res.status(200).json({
      success: true,
      message: `Found ${dependents.length} questions that depend on this question`,
      data: {
        question: {
          id: question._id,
          text: question.text,
          type: question.type
        },
        dependents: dependents.map(dep => ({
          id: dep._id,
          text: dep.text,
          type: dep.type,
          theme: dep.theme,
          subThemes: dep.subThemes,
          conditionalLogic: dep.conditionalLogic
        }))
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid question ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

export default {
  createQuestion,
  getQuestions,
  getQuestionsByIds,
  getQuestion,
  updateQuestion,
  getQuestionAvailableTags,
  getSubthemeAvailableTags,
  archiveQuestion,
  restoreQuestion,
  deleteQuestion,
  cloneQuestion,
  getQuestionTagStatistics,
  getStandardDemographics,
  getDemographicsByCategory,
  getRecommendedDemographics,
  toggleStandardDemographic,
  bulkToggleDemographic,
  getDemographicComplianceReport,
  // NEW: Bespoke question functions
  createBespokeQuestion,
  getBespokeQuestionsByProject,
  getBespokeQuestionsByOrganization,
  getAvailableBespokeQuestions,
  approveBespokeQuestion,
  rejectBespokeQuestion,
  elevateBespokeQuestion,
  updateBespokeQuestion,
  getBespokeQuestionStatistics,
  validateQuestionConditionalLogic,
  getQuestionConditionalDependencies,
  getQuestionsWithDependencies,
  updateQuestionConditionalLogic,
  getQuestionDependents,
  mapConditionalLogicToSurvey,
  validateConditionalDependenciesInSurvey
};