"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuestionDependents = exports.updateQuestionConditionalLogic = exports.validateConditionalDependenciesInSurvey = exports.mapConditionalLogicToSurvey = exports.getBespokeQuestionStatistics = exports.updateBespokeQuestion = exports.elevateBespokeQuestion = exports.rejectBespokeQuestion = exports.approveBespokeQuestion = exports.getAvailableBespokeQuestions = exports.getBespokeQuestionsByOrganization = exports.getBespokeQuestionsByProject = exports.createBespokeQuestion = exports.getOrCreateCustomThemeAndSubtheme = exports.getDemographicComplianceReport = exports.bulkToggleDemographic = exports.toggleStandardDemographic = exports.getRecommendedDemographics = exports.getDemographicsByCategory = exports.getStandardDemographics = exports.getQuestionTagStatistics = exports.cloneQuestion = exports.deleteQuestion = exports.restoreQuestion = exports.archiveQuestion = exports.getSubthemeAvailableTags = exports.getQuestionAvailableTags = exports.updateQuestion = exports.getQuestionsByIds = exports.getQuestion = exports.getQuestions = exports.createQuestion = exports.getQuestionsWithDependencies = exports.getQuestionConditionalDependencies = exports.validateQuestionConditionalLogic = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const question_model_1 = __importDefault(require("../models/question.model"));
const theme_model_1 = __importDefault(require("../models/theme.model"));
const subtheme_model_1 = __importDefault(require("../models/subtheme.model"));
const category_model_1 = __importDefault(require("../models/category.model"));
const authHelpers_1 = require("../lib/authHelpers");
// ========================================
// NEW CONTROLLER METHODS FOR CONDITIONAL LOGIC
// ========================================
/**
 * Validate conditional logic for a question
 * @route POST /api/v1/questions/:id/validate-conditional-logic
 * @access Private
 */
const validateQuestionConditionalLogic = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const questionId = req.params.id;
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('Cannot validate archived question');
            error.statusCode = 400;
            throw error;
        }
        // Validate conditional logic
        const validation = yield question.validateConditionalLogic();
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
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.validateQuestionConditionalLogic = validateQuestionConditionalLogic;
/**
 * Get conditional dependencies for a question
 * @route GET /api/v1/questions/:id/conditional-dependencies
 * @access Private
 */
const getQuestionConditionalDependencies = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const questionId = req.params.id;
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('Cannot get dependencies for archived question');
            error.statusCode = 400;
            throw error;
        }
        const dependencies = yield question.getConditionalDependencies();
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
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getQuestionConditionalDependencies = getQuestionConditionalDependencies;
/**
 * Get questions with all their conditional dependencies (bulk)
 * @route POST /api/v1/questions/with-dependencies
 * @access Private
 */
const getQuestionsWithDependencies = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { questionIds } = req.body;
        if (!Array.isArray(questionIds) || questionIds.length === 0) {
            const error = new Error('Question IDs array is required');
            error.statusCode = 400;
            throw error;
        }
        const questions = yield question_model_1.default.getQuestionsWithDependencies(questionIds);
        // Separate primary questions from dependencies
        const primaryQuestionIds = new Set(questionIds.map(id => id.toString()));
        const primaryQuestions = questions.filter((q) => primaryQuestionIds.has(q._id.toString()));
        const dependencyQuestions = questions.filter((q) => !primaryQuestionIds.has(q._id.toString()));
        res.status(200).json({
            success: true,
            message: `Retrieved ${primaryQuestions.length} questions with ${dependencyQuestions.length} dependencies`,
            data: {
                questions: primaryQuestions,
                dependencies: dependencyQuestions,
                all: questions
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getQuestionsWithDependencies = getQuestionsWithDependencies;
/**
 * Create a new question with selective tag assignment
 * @route POST /api/v1/questions
 * @access Private (ConnectGo staff only)
 */
const createQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can create questions');
            error.statusCode = 403;
            throw error;
        }
        const { text, description, type, required, options, validation, categories, theme, subThemes, targetAudience, tags, conditionalLogic, isStandardDemographic, demographicType, demographicCategory, isGlobalStandard, demographicMetadata, selectedIndicatorTags, selectedSdgTags, selectedResilienceTags, selectedEsgTags, selectedStandardTags, scaleConfig, matrixConfig } = req.body;
        // ── CATEGORY VALIDATION (one-to-many) ──
        const sanitizedCategories = Array.isArray(categories)
            ? categories.filter((c) => c && c.trim() !== '')
            : [];
        for (const catId of sanitizedCategories) {
            const categoryExists = yield category_model_1.default.findById(catId);
            if (!categoryExists) {
                const error = new Error(`Category ${catId} not found`);
                error.statusCode = 404;
                throw error;
            }
            if (categoryExists.archived) {
                const error = new Error(`Category ${catId} is archived`);
                error.statusCode = 400;
                throw error;
            }
        }
        // ── THEME VALIDATION ──
        if (isStandardDemographic) {
            if (!demographicType || !demographicCategory) {
                const error = new Error('Demographic type and category are required for standard demographic questions');
                error.statusCode = 400;
                throw error;
            }
            const validDemographicTypes = ['age', 'gender', 'education', 'income', 'location', 'employment', 'household_size', 'marital_status', 'ethnicity', 'language', 'disability', 'other'];
            const validDemographicCategories = ['basic', 'socioeconomic', 'cultural', 'accessibility'];
            if (!validDemographicTypes.includes(demographicType)) {
                const error = new Error('Invalid demographic type');
                error.statusCode = 400;
                throw error;
            }
            if (!validDemographicCategories.includes(demographicCategory)) {
                const error = new Error('Invalid demographic category');
                error.statusCode = 400;
                throw error;
            }
            if (theme) {
                const themeExists = yield theme_model_1.default.findById(theme);
                if (!themeExists) {
                    const error = new Error('Theme not found');
                    error.statusCode = 404;
                    throw error;
                }
            }
        }
        else {
            if (!theme) {
                const error = new Error('Theme is required for non-demographic questions');
                error.statusCode = 400;
                throw error;
            }
            const themeExists = yield theme_model_1.default.findById(theme);
            if (!themeExists) {
                const error = new Error('Theme not found');
                error.statusCode = 404;
                throw error;
            }
        }
        // ── SUBTHEME VALIDATION (one-to-many) ──
        const subThemeIds = Array.isArray(subThemes)
            ? subThemes.filter(Boolean)
            : [];
        // Accumulators for union tag validation across all selected subThemes
        const allAvailableIndicators = [];
        const allAvailableSdgs = [];
        const allAvailableResilience = [];
        const allAvailableEsg = [];
        const allAvailableStandards = [];
        for (const stId of subThemeIds) {
            const subThemeExists = yield subtheme_model_1.default.findById(stId);
            if (!subThemeExists) {
                const error = new Error(`SubTheme ${stId} not found`);
                error.statusCode = 404;
                throw error;
            }
            if (theme && subThemeExists.theme.toString() !== theme) {
                const error = new Error(`SubTheme ${stId} does not belong to the specified theme`);
                error.statusCode = 400;
                throw error;
            }
            allAvailableIndicators.push(...subThemeExists.indicatorTags.map((id) => id.toString()));
            allAvailableSdgs.push(...subThemeExists.sdgTags.map((id) => id.toString()));
            allAvailableResilience.push(...subThemeExists.resilienceTags.map((id) => id.toString()));
            allAvailableEsg.push(...subThemeExists.esgTags.map((id) => id.toString()));
            allAvailableStandards.push(...subThemeExists.standardTags.map((id) => id.toString()));
        }
        // Union tag validation — tag is valid if it exists in ANY of the selected subThemes
        if ((selectedIndicatorTags === null || selectedIndicatorTags === void 0 ? void 0 : selectedIndicatorTags.length) > 0) {
            const invalid = selectedIndicatorTags.filter((id) => !allAvailableIndicators.includes(id));
            if (invalid.length > 0) {
                const error = new Error('Some selected indicator tags are not available in the selected subThemes');
                error.statusCode = 400;
                throw error;
            }
        }
        if ((selectedSdgTags === null || selectedSdgTags === void 0 ? void 0 : selectedSdgTags.length) > 0) {
            const invalid = selectedSdgTags.filter((id) => !allAvailableSdgs.includes(id));
            if (invalid.length > 0) {
                const error = new Error('Some selected SDG tags are not available in the selected subThemes');
                error.statusCode = 400;
                throw error;
            }
        }
        if ((selectedResilienceTags === null || selectedResilienceTags === void 0 ? void 0 : selectedResilienceTags.length) > 0) {
            const invalid = selectedResilienceTags.filter((id) => !allAvailableResilience.includes(id));
            if (invalid.length > 0) {
                const error = new Error('Some selected resilience tags are not available in the selected subThemes');
                error.statusCode = 400;
                throw error;
            }
        }
        if ((selectedEsgTags === null || selectedEsgTags === void 0 ? void 0 : selectedEsgTags.length) > 0) {
            const invalid = selectedEsgTags.filter((id) => !allAvailableEsg.includes(id));
            if (invalid.length > 0) {
                const error = new Error('Some selected ESG tags are not available in the selected subThemes');
                error.statusCode = 400;
                throw error;
            }
        }
        if ((selectedStandardTags === null || selectedStandardTags === void 0 ? void 0 : selectedStandardTags.length) > 0) {
            const invalid = selectedStandardTags.filter((id) => !allAvailableStandards.includes(id));
            if (invalid.length > 0) {
                const error = new Error('Some selected standard tags are not available in the selected subThemes');
                error.statusCode = 400;
                throw error;
            }
        }
        // ── OPTIONS VALIDATION ──
        if (['radio', 'checkbox', 'dropdown'].includes(type)) {
            if (!options || !Array.isArray(options) || options.length === 0) {
                const error = new Error(`Options are required for question type: ${type}`);
                error.statusCode = 400;
                throw error;
            }
        }
        if (type === 'scale') {
            if (!scaleConfig || typeof scaleConfig.min !== 'number' || typeof scaleConfig.max !== 'number') {
                const error = new Error('Scale questions require scaleConfig with numeric min and max');
                error.statusCode = 400;
                throw error;
            }
            if (scaleConfig.min >= scaleConfig.max) {
                const error = new Error('scaleConfig.min must be less than scaleConfig.max');
                error.statusCode = 400;
                throw error;
            }
        }
        if (type === 'matrix') {
            if (!matrixConfig || !Array.isArray(matrixConfig.rows) || matrixConfig.rows.length === 0 ||
                !Array.isArray(matrixConfig.columns) || matrixConfig.columns.length === 0) {
                const error = new Error('Matrix questions require matrixConfig with at least one row and one column');
                error.statusCode = 400;
                throw error;
            }
        }
        const creator = req.user._id;
        const questionData = {
            text,
            description,
            type,
            required: required !== null && required !== void 0 ? required : false,
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
        if (type === 'scale' && scaleConfig)
            questionData.scaleConfig = scaleConfig;
        if (type === 'matrix' && matrixConfig)
            questionData.matrixConfig = matrixConfig;
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
        const newQuestions = yield question_model_1.default.create([questionData]);
        const populatedQuestion = yield question_model_1.default.findById(newQuestions[0]._id)
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
    }
    catch (error) {
        next(error);
    }
});
exports.createQuestion = createQuestion;
/**
 * Get all questions with pagination and filtering (updated for selective tags)
 * @route GET /api/v1/questions
 * @access Private
 */
const getQuestions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Handle bulk ID fetching
        if (req.query.ids && typeof req.query.ids === 'string') {
            const questionIds = req.query.ids.split(',').filter(id => id.trim());
            if (questionIds.length > 0) {
                let query = question_model_1.default.find({
                    _id: { $in: questionIds },
                    archived: { $ne: true }
                });
                // FIXED: remap legacy singular param names to actual plural schema fields
                if (req.query.populate && typeof req.query.populate === 'string') {
                    const populateFields = req.query.populate.split(',').map(field => field.trim());
                    populateFields.forEach(field => {
                        if (field === 'subTheme') {
                            query = query.populate('subThemes', 'name theme');
                        }
                        else if (field === 'category') {
                            query = query.populate('categories', 'name description inclusion');
                        }
                        else if (field === 'theme') {
                            query = query.populate('theme', 'name');
                        }
                        else if (field === 'creator') {
                            query = query.populate('creator', 'name email userName');
                        }
                        else {
                            query = query.populate(field);
                        }
                    });
                }
                const questions = yield query;
                return res.status(200).json({
                    success: true,
                    data: questions,
                    count: questions.length
                });
            }
        }
        // Initialize query
        let query = question_model_1.default.find({ archived: { $ne: true } });
        // Filter by scalar fields only — category and subThemes are array fields, handled separately below
        const filterFields = ['theme', 'type', 'targetAudience', 'status', 'isTemplate'];
        filterFields.forEach(field => {
            if (req.query[field]) {
                query = query.find({ [field]: req.query[field] });
            }
        });
        // Filter by categories (array field — match any)
        if (req.query.category) {
            const categoryIds = req.query.category.split(',');
            query = query.find({ categories: { $in: categoryIds } });
        }
        // Filter by subThemes (array field — match any)
        if (req.query.subTheme) {
            const subThemeIds = req.query.subTheme.split(',');
            query = query.find({ subThemes: { $in: subThemeIds } });
        }
        // Filter by selected tags
        if (req.query.selectedIndicatorTags) {
            const indicatorTagIds = req.query.selectedIndicatorTags.split(',');
            query = query.find({ selectedIndicatorTags: { $in: indicatorTagIds } });
        }
        if (req.query.selectedSdgTags) {
            const sdgTagIds = req.query.selectedSdgTags.split(',');
            query = query.find({ selectedSdgTags: { $in: sdgTagIds } });
        }
        if (req.query.selectedResilienceTags) {
            const resilienceTagIds = req.query.selectedResilienceTags.split(',');
            query = query.find({ selectedResilienceTags: { $in: resilienceTagIds } });
        }
        if (req.query.selectedEsgTags) {
            const esgTagIds = req.query.selectedEsgTags.split(',');
            query = query.find({ selectedEsgTags: { $in: esgTagIds } });
        }
        if (req.query.selectedStandardTags) {
            const standardTagIds = req.query.selectedStandardTags.split(',');
            query = query.find({ selectedStandardTags: { $in: standardTagIds } });
        }
        // Search by text or tags
        if (req.query.search) {
            query = query.find({
                $or: [
                    { text: { $regex: req.query.search, $options: 'i' } },
                    { description: { $regex: req.query.search, $options: 'i' } },
                    { tags: { $in: [new RegExp(req.query.search, 'i')] } }
                ]
            });
        }
        const reqQuery = Object.assign({}, req.query);
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
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        }
        else {
            query = query.sort('-createdAt');
        }
        // Handle population of related fields
        if (req.query.populate) {
            const populateFields = req.query.populate.split(',');
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
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        // Build count query with the same filters
        let countQuery = question_model_1.default.find({ archived: { $ne: true } });
        filterFields.forEach(field => {
            if (req.query[field]) {
                countQuery = countQuery.find({ [field]: req.query[field] });
            }
        });
        if (req.query.category) {
            const categoryIds = req.query.category.split(',');
            countQuery = countQuery.find({ categories: { $in: categoryIds } });
        }
        if (req.query.subTheme) {
            const subThemeIds = req.query.subTheme.split(',');
            countQuery = countQuery.find({ subThemes: { $in: subThemeIds } });
        }
        if (req.query.selectedIndicatorTags) {
            const indicatorTagIds = req.query.selectedIndicatorTags.split(',');
            countQuery = countQuery.find({ selectedIndicatorTags: { $in: indicatorTagIds } });
        }
        if (req.query.selectedSdgTags) {
            const sdgTagIds = req.query.selectedSdgTags.split(',');
            countQuery = countQuery.find({ selectedSdgTags: { $in: sdgTagIds } });
        }
        if (req.query.selectedResilienceTags) {
            const resilienceTagIds = req.query.selectedResilienceTags.split(',');
            countQuery = countQuery.find({ selectedResilienceTags: { $in: resilienceTagIds } });
        }
        if (req.query.selectedEsgTags) {
            const esgTagIds = req.query.selectedEsgTags.split(',');
            countQuery = countQuery.find({ selectedEsgTags: { $in: esgTagIds } });
        }
        if (req.query.selectedStandardTags) {
            const standardTagIds = req.query.selectedStandardTags.split(',');
            countQuery = countQuery.find({ selectedStandardTags: { $in: standardTagIds } });
        }
        if (req.query.search) {
            countQuery = countQuery.find({
                $or: [
                    { text: { $regex: req.query.search, $options: 'i' } },
                    { description: { $regex: req.query.search, $options: 'i' } },
                    { tags: { $in: [new RegExp(req.query.search, 'i')] } }
                ]
            });
        }
        const total = yield countQuery.countDocuments();
        query = query.skip(startIndex).limit(limit);
        const questions = yield query;
        const pagination = {};
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
    }
    catch (error) {
        next(error);
    }
});
exports.getQuestions = getQuestions;
/**
 * Get single question by ID
 * @route GET /api/v1/questions/:id
 * @access Private
 */
const getQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const questionId = req.params.id;
        const query = question_model_1.default.findById(questionId);
        if (req.query.populate) {
            const populateFields = req.query.populate.split(',');
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
        const question = yield query;
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('This question has been archived');
            error.statusCode = 410;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: question
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getQuestion = getQuestion;
// Addition to your question.controller.ts
// Add this method to support bulk question fetching
/**
 * Fetch multiple questions by IDs (bulk fetch for survey builder)
 * @route GET /api/v1/questions?ids=id1,id2,id3&populate=theme,subTheme
 * @access Private
 */
const getQuestionsByIds = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
            let query = question_model_1.default.find({
                _id: { $in: questionIds },
                archived: { $ne: true }
            });
            if (populate && typeof populate === 'string') {
                const populateFields = populate.split(',').map(field => field.trim());
                populateFields.forEach(field => {
                    if (field === 'theme') {
                        query = query.populate('theme', 'name description');
                    }
                    else if (field === 'subTheme') {
                        query = query.populate('subThemes', 'name description');
                    }
                    else if (field === 'category') {
                        query = query.populate('categories', 'name description');
                    }
                    else if (field === 'creator') {
                        query = query.populate('creator', 'name email userName');
                    }
                    else {
                        query = query.populate(field);
                    }
                });
            }
            const questions = yield query.sort('createdAt');
            return res.status(200).json({
                success: true,
                data: questions,
                count: questions.length
            });
        }
        next();
    }
    catch (error) {
        console.error('Error fetching questions by IDs:', error);
        const customError = new Error('Failed to fetch questions');
        customError.statusCode = 500;
        next(customError);
    }
});
exports.getQuestionsByIds = getQuestionsByIds;
/**
 * Update question by ID (including selective tag updates)
 * @route PUT /api/v1/questions/:id
 * @access Private (ConnectGo staff only)
 */
const updateQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update questions');
            error.statusCode = 403;
            throw error;
        }
        const questionId = req.params.id;
        const { text, description, type, required, options, validation, categories, theme, subThemes, targetAudience, status, isTemplate, tags, conditionalLogic, isStandardDemographic, demographicType, demographicCategory, demographicMetadata, selectedIndicatorTags, selectedSdgTags, selectedResilienceTags, selectedEsgTags, selectedStandardTags, scaleConfig, matrixConfig } = req.body;
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('Cannot update an archived question');
            error.statusCode = 400;
            throw error;
        }
        // ── OPTIONS VALIDATION ──
        if (type && ['radio', 'checkbox', 'dropdown'].includes(type)) {
            if (!options || !Array.isArray(options) || options.length === 0) {
                const error = new Error(`Options are required for question type: ${type}`);
                error.statusCode = 400;
                throw error;
            }
        }
        if (type === 'scale' && scaleConfig !== undefined) {
            if (typeof scaleConfig.min !== 'number' || typeof scaleConfig.max !== 'number') {
                const error = new Error('scaleConfig requires numeric min and max');
                error.statusCode = 400;
                throw error;
            }
            if (scaleConfig.min >= scaleConfig.max) {
                const error = new Error('scaleConfig.min must be less than scaleConfig.max');
                error.statusCode = 400;
                throw error;
            }
        }
        if (type === 'matrix' && matrixConfig !== undefined) {
            if (!Array.isArray(matrixConfig.rows) || matrixConfig.rows.length === 0 ||
                !Array.isArray(matrixConfig.columns) || matrixConfig.columns.length === 0) {
                const error = new Error('matrixConfig requires at least one row and one column');
                error.statusCode = 400;
                throw error;
            }
        }
        // ── CATEGORY VALIDATION (one-to-many) ──
        const sanitizedCategories = categories !== undefined
            ? (Array.isArray(categories)
                ? categories.filter((c) => c && c.trim() !== '')
                : [])
            : undefined;
        if (sanitizedCategories !== undefined) {
            for (const catId of sanitizedCategories) {
                const categoryExists = yield category_model_1.default.findById(catId);
                if (!categoryExists) {
                    const error = new Error(`Category ${catId} not found`);
                    error.statusCode = 404;
                    throw error;
                }
                if (categoryExists.archived) {
                    const error = new Error(`Category ${catId} is archived`);
                    error.statusCode = 400;
                    throw error;
                }
            }
        }
        // ── THEME VALIDATION ──
        if (theme) {
            const themeExists = yield theme_model_1.default.findById(theme);
            if (!themeExists) {
                const error = new Error('Theme not found');
                error.statusCode = 404;
                throw error;
            }
        }
        // ── SUBTHEME VALIDATION (one-to-many) ──
        const subThemeIds = subThemes !== undefined
            ? (Array.isArray(subThemes) ? subThemes.filter(Boolean) : [])
            : undefined;
        if (subThemeIds !== undefined) {
            const allAvailableIndicators = [];
            const allAvailableSdgs = [];
            const allAvailableResilience = [];
            const allAvailableEsg = [];
            const allAvailableStandards = [];
            // Resolve the theme to validate ownership against —
            // use the incoming theme if provided, otherwise fall back to the question's existing theme
            const resolvedTheme = theme !== null && theme !== void 0 ? theme : (_b = question.theme) === null || _b === void 0 ? void 0 : _b.toString();
            for (const stId of subThemeIds) {
                const subThemeExists = yield subtheme_model_1.default.findById(stId);
                if (!subThemeExists) {
                    const error = new Error(`SubTheme ${stId} not found`);
                    error.statusCode = 404;
                    throw error;
                }
                if (resolvedTheme && subThemeExists.theme.toString() !== resolvedTheme) {
                    const error = new Error(`SubTheme ${stId} does not belong to the specified theme`);
                    error.statusCode = 400;
                    throw error;
                }
                allAvailableIndicators.push(...subThemeExists.indicatorTags.map((id) => id.toString()));
                allAvailableSdgs.push(...subThemeExists.sdgTags.map((id) => id.toString()));
                allAvailableResilience.push(...subThemeExists.resilienceTags.map((id) => id.toString()));
                allAvailableEsg.push(...subThemeExists.esgTags.map((id) => id.toString()));
                allAvailableStandards.push(...subThemeExists.standardTags.map((id) => id.toString()));
            }
            // Union tag validation — tag is valid if it exists in ANY of the selected subThemes
            if ((selectedIndicatorTags === null || selectedIndicatorTags === void 0 ? void 0 : selectedIndicatorTags.length) > 0) {
                const invalid = selectedIndicatorTags.filter((id) => !allAvailableIndicators.includes(id));
                if (invalid.length > 0) {
                    const error = new Error('Some selected indicator tags are not available in the selected subThemes');
                    error.statusCode = 400;
                    throw error;
                }
            }
            if ((selectedSdgTags === null || selectedSdgTags === void 0 ? void 0 : selectedSdgTags.length) > 0) {
                const invalid = selectedSdgTags.filter((id) => !allAvailableSdgs.includes(id));
                if (invalid.length > 0) {
                    const error = new Error('Some selected SDG tags are not available in the selected subThemes');
                    error.statusCode = 400;
                    throw error;
                }
            }
            if ((selectedResilienceTags === null || selectedResilienceTags === void 0 ? void 0 : selectedResilienceTags.length) > 0) {
                const invalid = selectedResilienceTags.filter((id) => !allAvailableResilience.includes(id));
                if (invalid.length > 0) {
                    const error = new Error('Some selected resilience tags are not available in the selected subThemes');
                    error.statusCode = 400;
                    throw error;
                }
            }
            if ((selectedEsgTags === null || selectedEsgTags === void 0 ? void 0 : selectedEsgTags.length) > 0) {
                const invalid = selectedEsgTags.filter((id) => !allAvailableEsg.includes(id));
                if (invalid.length > 0) {
                    const error = new Error('Some selected ESG tags are not available in the selected subThemes');
                    error.statusCode = 400;
                    throw error;
                }
            }
            if ((selectedStandardTags === null || selectedStandardTags === void 0 ? void 0 : selectedStandardTags.length) > 0) {
                const invalid = selectedStandardTags.filter((id) => !allAvailableStandards.includes(id));
                if (invalid.length > 0) {
                    const error = new Error('Some selected standard tags are not available in the selected subThemes');
                    error.statusCode = 400;
                    throw error;
                }
            }
        }
        // ── CONDITIONAL LOGIC VALIDATION ──
        if ((conditionalLogic === null || conditionalLogic === void 0 ? void 0 : conditionalLogic.enabled) && ((_c = conditionalLogic.conditions) === null || _c === void 0 ? void 0 : _c.length) > 0) {
            for (const condition of conditionalLogic.conditions) {
                if (((_d = condition.questionId) === null || _d === void 0 ? void 0 : _d.toString()) === questionId) {
                    const error = new Error('A question cannot reference itself in conditional logic');
                    error.statusCode = 400;
                    throw error;
                }
            }
        }
        // ── BUILD UPDATE DATA ──
        const updateData = {};
        if (text !== undefined)
            updateData.text = text;
        if (description !== undefined)
            updateData.description = description;
        if (type !== undefined)
            updateData.type = type;
        if (required !== undefined)
            updateData.required = required;
        if (options !== undefined)
            updateData.options = options;
        if (validation !== undefined)
            updateData.validation = validation;
        if (sanitizedCategories !== undefined)
            updateData.categories = sanitizedCategories;
        if (theme !== undefined)
            updateData.theme = theme;
        if (subThemeIds !== undefined)
            updateData.subThemes = subThemeIds;
        if (targetAudience !== undefined)
            updateData.targetAudience = targetAudience;
        if (status !== undefined)
            updateData.status = status;
        if (isTemplate !== undefined)
            updateData.isTemplate = isTemplate;
        if (tags !== undefined)
            updateData.tags = tags;
        if (conditionalLogic !== undefined)
            updateData.conditionalLogic = conditionalLogic;
        if (selectedIndicatorTags !== undefined)
            updateData.selectedIndicatorTags = selectedIndicatorTags;
        if (selectedSdgTags !== undefined)
            updateData.selectedSdgTags = selectedSdgTags;
        if (selectedResilienceTags !== undefined)
            updateData.selectedResilienceTags = selectedResilienceTags;
        if (selectedEsgTags !== undefined)
            updateData.selectedEsgTags = selectedEsgTags;
        if (selectedStandardTags !== undefined)
            updateData.selectedStandardTags = selectedStandardTags;
        if (scaleConfig !== undefined)
            updateData.scaleConfig = scaleConfig;
        if (matrixConfig !== undefined)
            updateData.matrixConfig = matrixConfig;
        if (isStandardDemographic !== undefined) {
            updateData.isStandardDemographic = isStandardDemographic;
            if (!isStandardDemographic) {
                updateData.demographicType = undefined;
                updateData.demographicCategory = undefined;
                updateData.demographicMetadata = undefined;
            }
            else {
                if (demographicType !== undefined)
                    updateData.demographicType = demographicType;
                if (demographicCategory !== undefined)
                    updateData.demographicCategory = demographicCategory;
                if (demographicMetadata !== undefined)
                    updateData.demographicMetadata = demographicMetadata;
            }
        }
        const updatedQuestion = yield question_model_1.default.findByIdAndUpdate(questionId, { $set: updateData }, { new: true, runValidators: false })
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
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateQuestion = updateQuestion;
/**
 * Get available tags from a question's subtheme
 * @route GET /api/v1/questions/:id/available-tags
 * @access Private
 */
const getQuestionAvailableTags = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const questionId = req.params.id;
        // Find the question
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('This question has been archived');
            error.statusCode = 410; // Gone
            throw error;
        }
        // Get available tags from subtheme
        const availableTags = yield question.getAvailableTagsFromSubtheme();
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
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getQuestionAvailableTags = getQuestionAvailableTags;
/**
 * Get available tags from a subtheme (helper endpoint for question creation)
 * @route GET /api/v1/subthemes/:id/available-tags-for-questions
 * @access Private
 */
const getSubthemeAvailableTags = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const subThemeId = req.params.id;
        // Get the subtheme with populated tags
        const subTheme = yield subtheme_model_1.default.findById(subThemeId)
            .populate('indicatorTags', 'name description')
            .populate('sdgTags', 'code name description')
            .populate('resilienceTags', 'code name description')
            .populate('esgTags', 'code name description type')
            .populate('standardTags', 'code name description issuingBody')
            .select('name indicatorTags sdgTags resilienceTags esgTags standardTags');
        if (!subTheme) {
            const error = new Error('SubTheme not found');
            error.statusCode = 404;
            throw error;
        }
        if (subTheme.archived) {
            const error = new Error('This subtheme has been archived');
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
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid subtheme ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getSubthemeAvailableTags = getSubthemeAvailableTags;
/**
 * Archive question by ID (soft delete)
 * @route DELETE /api/v1/questions/:id
 * @access Private (ConnectGo staff only)
 */
const archiveQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can archive questions');
            error.statusCode = 403;
            throw error;
        }
        const questionId = req.params.id;
        // Find the question first to check if it exists
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('Question is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive the question (soft delete)
        const archivedQuestion = yield question_model_1.default.findByIdAndUpdate(questionId, { archived: true, archivedAt: new Date() }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Question archived successfully',
            data: archivedQuestion
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.archiveQuestion = archiveQuestion;
/**
 * Restore archived question by ID
 * @route POST /api/v1/questions/:id/restore
 * @access Private (ConnectGo staff only)
 */
const restoreQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can restore questions');
            error.statusCode = 403;
            throw error;
        }
        const questionId = req.params.id;
        // Find the question first to check if it exists and is archived
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (!question.archived) {
            const error = new Error('Question is not archived');
            error.statusCode = 400;
            throw error;
        }
        // Check if the related entities are archived
        const theme = yield theme_model_1.default.findById(question.theme);
        if (theme === null || theme === void 0 ? void 0 : theme.archived) {
            const error = new Error('Cannot restore a question with an archived theme');
            error.statusCode = 400;
            throw error;
        }
        if (((_b = question.subThemes) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            const subThemeDocs = yield subtheme_model_1.default.find({ _id: { $in: question.subThemes } });
            const hasArchived = subThemeDocs.some(st => st.archived);
            if (hasArchived) {
                const error = new Error('Cannot restore a question with an archived subtheme');
                error.statusCode = 400;
                throw error;
            }
        }
        // Restore the question
        const restoredQuestion = yield question_model_1.default.findByIdAndUpdate(questionId, { archived: false, archivedAt: null }, { new: true });
        res.status(200).json({
            success: true,
            message: 'Question restored successfully',
            data: restoredQuestion
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.restoreQuestion = restoreQuestion;
/**
 * Permanently delete question by ID
 * @route DELETE /api/v1/questions/:id/permanent
 * @access Private (ConnectGo staff only)
 */
const deleteQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can permanently delete questions');
            error.statusCode = 403;
            throw error;
        }
        const questionId = req.params.id;
        // Find the question first to check if it exists
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if the question is in use in any surveys
        const SurveyQuestion = mongoose_1.default.model('SurveyQuestion');
        const inUseCount = yield SurveyQuestion.countDocuments({ question: questionId });
        if (inUseCount > 0) {
            const error = new Error(`Cannot delete question that is in use in ${inUseCount} surveys`);
            error.statusCode = 400;
            throw error;
        }
        // Permanently delete the question
        yield question_model_1.default.findByIdAndDelete(questionId);
        res.status(200).json({
            success: true,
            message: 'Question permanently deleted',
            data: null
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteQuestion = deleteQuestion;
/**
 * Clone question by ID
 * @route POST /api/v1/questions/:id/clone
 * @access Private (ConnectGo staff only)
 */
const cloneQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can clone questions');
            error.statusCode = 403;
            throw error;
        }
        const questionId = req.params.id;
        // Find the question to clone
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('Cannot clone an archived question');
            error.statusCode = 400;
            throw error;
        }
        // Create a new question based on the original.
        // conditionalLogic is intentionally not cloned — its questionId references
        // point to specific library questions and would be meaningless or wrong on a
        // fresh clone that the staff member hasn't wired up yet.
        const clonedQuestion = new question_model_1.default({
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
        yield clonedQuestion.save();
        // Return the cloned question with populated tags
        const populatedClone = yield question_model_1.default.findById(clonedQuestion._id)
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
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.cloneQuestion = cloneQuestion;
/**
 * Get question tag statistics
 * @route GET /api/v1/questions/tag-statistics
 * @access Private (ConnectGo staff only)
 */
const getQuestionTagStatistics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can access tag statistics');
            error.statusCode = 403;
            throw error;
        }
        // Build filters from query parameters
        const filters = {};
        if (req.query.theme)
            filters.theme = req.query.theme;
        if (req.query.status)
            filters.status = req.query.status;
        // Get basic statistics
        const totalQuestions = yield question_model_1.default.countDocuments(Object.assign({ archived: { $ne: true } }, filters));
        // Count questions with selected tags
        const questionsWithIndicators = yield question_model_1.default.countDocuments(Object.assign(Object.assign({}, filters), { archived: { $ne: true }, selectedIndicatorTags: { $exists: true, $not: { $size: 0 } } }));
        const questionsWithSdgs = yield question_model_1.default.countDocuments(Object.assign(Object.assign({}, filters), { archived: { $ne: true }, selectedSdgTags: { $exists: true, $not: { $size: 0 } } }));
        const questionsWithResilience = yield question_model_1.default.countDocuments(Object.assign(Object.assign({}, filters), { archived: { $ne: true }, selectedResilienceTags: { $exists: true, $not: { $size: 0 } } }));
        const questionsWithEsg = yield question_model_1.default.countDocuments(Object.assign(Object.assign({}, filters), { archived: { $ne: true }, selectedEsgTags: { $exists: true, $not: { $size: 0 } } }));
        const questionsWithStandards = yield question_model_1.default.countDocuments(Object.assign(Object.assign({}, filters), { archived: { $ne: true }, selectedStandardTags: { $exists: true, $not: { $size: 0 } } }));
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
    }
    catch (error) {
        next(error);
    }
});
exports.getQuestionTagStatistics = getQuestionTagStatistics;
/**
 * Get all standard demographic questions with filtering
 * @route GET /api/v1/questions/demographics
 * @access Private
 */
const getStandardDemographics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { demographicType, category, audience, globalOnly, page = 1, limit = 50 } = req.query;
        // Build filters object
        const filters = {};
        if (demographicType)
            filters.demographicType = demographicType;
        if (category)
            filters.category = category;
        if (audience)
            filters.audience = audience;
        if (globalOnly === 'true')
            filters.globalOnly = true;
        // Get demographic questions using the static method
        const demographics = yield question_model_1.default.getStandardDemographics(filters);
        // Apply pagination
        const startIndex = (Number(page) - 1) * Number(limit);
        const endIndex = startIndex + Number(limit);
        const paginatedDemographics = demographics.slice(startIndex, endIndex);
        // Build pagination object
        const pagination = {};
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
    }
    catch (error) {
        next(error);
    }
});
exports.getStandardDemographics = getStandardDemographics;
/**
 * Get demographics by category
 * @route GET /api/v1/questions/demographics/category/:category
 * @access Private
 */
const getDemographicsByCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { category } = req.params;
        // Validate category
        const validCategories = ['basic', 'socioeconomic', 'cultural', 'accessibility'];
        if (!validCategories.includes(category)) {
            const error = new Error('Invalid demographic category');
            error.statusCode = 400;
            throw error;
        }
        const demographics = yield question_model_1.default.getDemographicsByCategory(category);
        res.status(200).json({
            success: true,
            count: demographics.length,
            data: demographics
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getDemographicsByCategory = getDemographicsByCategory;
/**
 * Get recommended demographics for a specific audience
 * @route GET /api/v1/questions/demographics/recommended/:audience
 * @access Private
 */
const getRecommendedDemographics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { audience } = req.params;
        // Validate audience
        const validAudiences = ['internal', 'external', 'both'];
        if (!validAudiences.includes(audience)) {
            const error = new Error('Invalid audience type');
            error.statusCode = 400;
            throw error;
        }
        const demographics = yield question_model_1.default.getRecommendedDemographics(audience);
        // Group by category for easier consumption
        const groupedDemographics = demographics.reduce((acc, demo) => {
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
    }
    catch (error) {
        next(error);
    }
});
exports.getRecommendedDemographics = getRecommendedDemographics;
/**
 * Toggle standard demographic flag for a question
 * @route PUT /api/v1/questions/:id/toggle-demographic
 * @access Private (ConnectGo staff only)
 */
const toggleStandardDemographic = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can modify demographic settings');
            error.statusCode = 403;
            throw error;
        }
        const questionId = req.params.id;
        const { isStandardDemographic, demographicType, demographicCategory, isGlobalStandard = false, demographicMetadata } = req.body;
        // Find the question
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('Cannot modify archived question');
            error.statusCode = 400;
            throw error;
        }
        // If enabling standard demographic, validate required fields
        if (isStandardDemographic) {
            if (!demographicType || !demographicCategory) {
                const error = new Error('Demographic type and category are required when enabling standard demographic');
                error.statusCode = 400;
                throw error;
            }
            // Validate enum values
            const validTypes = ['age', 'gender', 'education', 'income', 'location', 'employment', 'household_size', 'marital_status', 'ethnicity', 'language', 'disability', 'other'];
            const validCategories = ['basic', 'socioeconomic', 'cultural', 'accessibility'];
            if (!validTypes.includes(demographicType)) {
                const error = new Error('Invalid demographic type');
                error.statusCode = 400;
                throw error;
            }
            if (!validCategories.includes(demographicCategory)) {
                const error = new Error('Invalid demographic category');
                error.statusCode = 400;
                throw error;
            }
        }
        // Update the question
        const updateData = {
            isStandardDemographic,
            isGlobalStandard
        };
        if (isStandardDemographic) {
            updateData.demographicType = demographicType;
            updateData.demographicCategory = demographicCategory;
            updateData.demographicMetadata = {
                isRequired: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.isRequired) || false,
                recommendedForAudience: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.recommendedForAudience) || ['both'],
                complianceRelevant: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.complianceRelevant) || false,
                sensitivityLevel: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.sensitivityLevel) || 'medium',
                dataRetentionPeriod: demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.dataRetentionPeriod,
                anonymizationRequired: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.anonymizationRequired) || false
            };
        }
        else {
            // Clear demographic fields if disabling
            updateData.demographicType = undefined;
            updateData.demographicCategory = undefined;
            updateData.demographicMetadata = undefined;
        }
        const updatedQuestion = yield question_model_1.default.findByIdAndUpdate(questionId, updateData, { new: true, runValidators: true }).populate('categories', 'name description')
            .populate('theme', 'name')
            .populate('subThemes', 'name');
        res.status(200).json({
            success: true,
            message: `Question ${isStandardDemographic ? 'marked as' : 'unmarked as'} standard demographic`,
            data: updatedQuestion
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.toggleStandardDemographic = toggleStandardDemographic;
/**
 * Bulk toggle demographic status for multiple questions
 * @route PUT /api/v1/questions/bulk-toggle-demographic
 * @access Private (ConnectGo staff only)
 */
const bulkToggleDemographic = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield question_model_1.default.db.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can modify demographic settings');
            error.statusCode = 403;
            throw error;
        }
        const { questionIds, isStandardDemographic, demographicType, demographicCategory, isGlobalStandard = false, demographicMetadata } = req.body;
        // Validate input
        if (!Array.isArray(questionIds) || questionIds.length === 0) {
            const error = new Error('Question IDs array is required');
            error.statusCode = 400;
            throw error;
        }
        // If enabling, validate required fields
        if (isStandardDemographic && (!demographicType || !demographicCategory)) {
            const error = new Error('Demographic type and category are required when enabling standard demographic');
            error.statusCode = 400;
            throw error;
        }
        // Find all questions
        const questions = yield question_model_1.default.find({
            _id: { $in: questionIds },
            archived: { $ne: true }
        });
        if (questions.length !== questionIds.length) {
            const error = new Error('Some questions not found or are archived');
            error.statusCode = 404;
            throw error;
        }
        // Build update object
        const updateData = {
            isStandardDemographic,
            isGlobalStandard
        };
        if (isStandardDemographic) {
            updateData.demographicType = demographicType;
            updateData.demographicCategory = demographicCategory;
            updateData.demographicMetadata = {
                isRequired: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.isRequired) || false,
                recommendedForAudience: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.recommendedForAudience) || ['both'],
                complianceRelevant: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.complianceRelevant) || false,
                sensitivityLevel: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.sensitivityLevel) || 'medium',
                dataRetentionPeriod: demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.dataRetentionPeriod,
                anonymizationRequired: (demographicMetadata === null || demographicMetadata === void 0 ? void 0 : demographicMetadata.anonymizationRequired) || false
            };
        }
        else {
            updateData.demographicType = undefined;
            updateData.demographicCategory = undefined;
            updateData.demographicMetadata = undefined;
        }
        // Update all questions
        const result = yield question_model_1.default.updateMany({ _id: { $in: questionIds } }, updateData, { session });
        yield session.commitTransaction();
        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} questions updated successfully`,
            data: {
                modified: result.modifiedCount,
                matched: result.matchedCount
            }
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.bulkToggleDemographic = bulkToggleDemographic;
/**
 * Get demographic compliance report
 * @route GET /api/v1/questions/demographics/compliance-report
 * @access Private (ConnectGo staff only)
 */
const getDemographicComplianceReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Verify user is authenticated and is ConnectGo staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can access compliance reports');
            error.statusCode = 403;
            throw error;
        }
        // Get all standard demographic questions
        const demographics = yield question_model_1.default.find({
            isStandardDemographic: true,
            archived: { $ne: true }
        });
        // Generate compliance statistics
        const report = {
            totalDemographics: demographics.length,
            byCategory: {},
            bySensitivity: {},
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
            var _a, _b, _c, _d, _e;
            // Category breakdown
            const category = demo.demographicCategory || 'unknown';
            report.byCategory[category] = (report.byCategory[category] || 0) + 1;
            // Sensitivity breakdown
            const sensitivity = ((_a = demo.demographicMetadata) === null || _a === void 0 ? void 0 : _a.sensitivityLevel) || 'unknown';
            report.bySensitivity[sensitivity] = (report.bySensitivity[sensitivity] || 0) + 1;
            // Compliance flags
            if ((_b = demo.demographicMetadata) === null || _b === void 0 ? void 0 : _b.complianceRelevant) {
                report.complianceRelevant++;
            }
            if ((_c = demo.demographicMetadata) === null || _c === void 0 ? void 0 : _c.anonymizationRequired) {
                report.requiresAnonymization++;
            }
            if ((_d = demo.demographicMetadata) === null || _d === void 0 ? void 0 : _d.dataRetentionPeriod) {
                report.withRetentionPeriods++;
            }
            if (demo.isGlobalStandard) {
                report.globalStandards++;
            }
            // Audience breakdown
            const audiences = ((_e = demo.demographicMetadata) === null || _e === void 0 ? void 0 : _e.recommendedForAudience) || ['both'];
            audiences.forEach(aud => {
                if (aud in report.byAudience) {
                    report.byAudience[aud]++;
                }
            });
        });
        res.status(200).json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getDemographicComplianceReport = getDemographicComplianceReport;
// ========================================
// HELPER: Get or create the system-level Custom theme/subtheme
// Used to give bespoke questions a valid theme/subTheme reference
// ========================================
const CUSTOM_THEME_NAME = 'Custom';
const CUSTOM_SUBTHEME_NAME = 'Custom Subtheme';
const CUSTOM_THEME_DESCRIPTION = 'System theme for organisation-specific bespoke questions';
const CUSTOM_SUBTHEME_DESCRIPTION = ' ';
const getOrCreateCustomThemeAndSubtheme = (systemUserId) => __awaiter(void 0, void 0, void 0, function* () {
    let theme = yield theme_model_1.default.findOne({
        name: CUSTOM_THEME_NAME,
        archived: { $ne: true }
    });
    if (!theme) {
        theme = yield theme_model_1.default.create({
            name: CUSTOM_THEME_NAME,
            description: CUSTOM_THEME_DESCRIPTION,
            creator: systemUserId,
            status: 'published'
        });
        console.log(`✅ Created system Custom theme: ${theme._id}`);
    }
    let subTheme = yield subtheme_model_1.default.findOne({
        name: CUSTOM_SUBTHEME_NAME,
        theme: theme._id,
        archived: { $ne: true }
    });
    if (!subTheme) {
        subTheme = yield subtheme_model_1.default.create({
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
});
exports.getOrCreateCustomThemeAndSubtheme = getOrCreateCustomThemeAndSubtheme;
/**
 * Create a bespoke question (client-created)
 * @route POST /api/v1/questions/bespoke
 * @access Private (Project members)
 */
const createBespokeQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const session = yield question_model_1.default.db.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated
        // Use the type guard - TypeScript knows req.user exists after this
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { text, description, type, required, options, validation, category, projectId, targetAudience = 'both' } = req.body;
        // Validate required fields
        if (!text || !type || !projectId) {
            const error = new Error('Question text, type, and project ID are required');
            error.statusCode = 400;
            throw error;
        }
        // Check if project exists
        const Project = mongoose_1.default.model('Project');
        const project = yield Project.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has access to this project
        const isCreator = project.creator.toString() === req.user._id.toString();
        const isTeamMember = (_a = project.team) === null || _a === void 0 ? void 0 : _a.some((member) => member.user.toString() === req.user._id.toString());
        if (!isCreator && !isTeamMember && !req.user.isConnectGoStaff) {
            const error = new Error('Not authorized to create questions for this project');
            error.statusCode = 403;
            throw error;
        }
        // Validate options based on question type
        if (['radio', 'checkbox', 'dropdown'].includes(type)) {
            if (!options || !Array.isArray(options) || options.length === 0) {
                const error = new Error(`Options are required for question type: ${type}`);
                error.statusCode = 400;
                throw error;
            }
        }
        // Validate category if provided
        if (category) {
            const Category = mongoose_1.default.model('Category');
            const categoryExists = yield Category.findById(category);
            if (!categoryExists) {
                const error = new Error('Category not found');
                error.statusCode = 404;
                throw error;
            }
            if (categoryExists.archived) {
                const error = new Error('Cannot use an archived category');
                error.statusCode = 400;
                throw error;
            }
        }
        // Auto-assign the system Custom theme and subtheme
        const { theme: customTheme, subTheme: customSubTheme } = yield (0, exports.getOrCreateCustomThemeAndSubtheme)(req.user._id);
        // Create the bespoke question
        const bespokeQuestion = yield question_model_1.default.create([{
                text,
                description,
                type,
                required: required !== null && required !== void 0 ? required : false,
                options,
                validation,
                creator: req.user._id,
                categories: category ? [category] : [],
                theme: customTheme._id, // ← was: null
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
        const QuestionLibrary = mongoose_1.default.model('QuestionLibrary');
        const Organization = mongoose_1.default.model('Organization');
        const organization = yield Organization.findById(project.organization);
        const libraryName = `${(organization === null || organization === void 0 ? void 0 : organization.name) || 'Organization'} - Custom Questions`;
        let library = yield QuestionLibrary.findOne({
            name: libraryName,
            creator: req.user._id, // Or you might want to use a system user
            archived: { $ne: true }
        });
        if (!library) {
            library = yield QuestionLibrary.create([{
                    name: libraryName,
                    description: `Custom questions created by ${(organization === null || organization === void 0 ? void 0 : organization.name) || 'organization'} members`,
                    questions: [bespokeQuestion[0]._id],
                    creator: req.user._id,
                    status: 'draft'
                }], { session });
            library = library[0];
        }
        else {
            library.questions.push(bespokeQuestion[0]._id);
            yield library.save({ session });
        }
        yield session.commitTransaction();
        session.endSession();
        // Populate the response
        const populatedQuestion = yield question_model_1.default.findById(bespokeQuestion[0]._id)
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
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createBespokeQuestion = createBespokeQuestion;
/**
 * Get bespoke questions for a project
 * @route GET /api/v1/questions/bespoke/project/:projectId
 * @access Private
 */
const getBespokeQuestionsByProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { projectId } = req.params;
        const { status, createdBy, includeElevated } = req.query;
        // Check if project exists
        const Project = mongoose_1.default.model('Project');
        const project = yield Project.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has access to this project
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        const filters = {};
        if (status)
            filters.status = status;
        if (createdBy)
            filters.createdBy = createdBy;
        if (includeElevated !== undefined)
            filters.includeElevated = includeElevated === 'true';
        const questions = yield question_model_1.default.getBespokeQuestionsByProject(projectId, filters);
        res.status(200).json({
            success: true,
            count: questions.length,
            data: questions
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getBespokeQuestionsByProject = getBespokeQuestionsByProject;
/**
 * Get bespoke questions for an organization
 * @route GET /api/v1/questions/bespoke/organization/:organizationId
 * @access Private
 */
const getBespokeQuestionsByOrganization = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { organizationId } = req.params;
        const { status, project } = req.query;
        // Check if organization exists
        const Organization = mongoose_1.default.model('Organization');
        const organization = yield Organization.findById(organizationId);
        if (!organization) {
            const error = new Error('Organization not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user belongs to this organization or is staff
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            // Check if user is part of any project in this organization
            const Project = mongoose_1.default.model('Project');
            const userProjects = yield Project.find({
                organization: organizationId,
                $or: [
                    { creator: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id },
                    { 'team.user': (_c = req.user) === null || _c === void 0 ? void 0 : _c._id }
                ]
            });
            if (userProjects.length === 0) {
                const error = new Error('Not authorized to access this organization');
                error.statusCode = 403;
                throw error;
            }
        }
        const filters = {};
        if (status)
            filters.status = status;
        if (project)
            filters.project = project;
        const questions = yield question_model_1.default.getBespokeQuestionsByOrganization(organizationId, filters);
        // Group by project for better organization
        const questionsByProject = questions.reduce((acc, question) => {
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
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid organization ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getBespokeQuestionsByOrganization = getBespokeQuestionsByOrganization;
/**
 * Get available bespoke questions for a project (approved only)
 * @route GET /api/v1/questions/bespoke/project/:projectId/available
 * @access Private
 */
const getAvailableBespokeQuestions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { projectId } = req.params;
        // Check if project exists
        const Project = mongoose_1.default.model('Project');
        const project = yield Project.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has access to this project
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        const questions = yield question_model_1.default.getAvailableBespokeQuestionsForProject(projectId);
        res.status(200).json({
            success: true,
            count: questions.length,
            data: questions
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getAvailableBespokeQuestions = getAvailableBespokeQuestions;
/**
 * Approve a bespoke question
 * @route PUT /api/v1/questions/:id/approve
 * @access Private (Project managers/creators)
 */
const approveBespokeQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const questionId = req.params.id;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (!question.isBespoke) {
            const error = new Error('Only bespoke questions can be approved');
            error.statusCode = 400;
            throw error;
        }
        // Use the instance method to approve
        yield question.approveBespokeQuestion(req.user._id);
        // Populate and return
        const updatedQuestion = yield question_model_1.default.findById(questionId)
            .populate('category', 'name description')
            .populate('bespokeMetadata.createdBy', 'name email')
            .populate('bespokeMetadata.approvedBy', 'name email')
            .populate('bespokeMetadata.project', 'name');
        res.status(200).json({
            success: true,
            message: 'Bespoke question approved successfully',
            data: updatedQuestion
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.approveBespokeQuestion = approveBespokeQuestion;
/**
 * Reject a bespoke question
 * @route PUT /api/v1/questions/:id/reject
 * @access Private (Project managers/creators)
 */
const rejectBespokeQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const questionId = req.params.id;
        const { reason } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!reason) {
            const error = new Error('Rejection reason is required');
            error.statusCode = 400;
            throw error;
        }
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (!question.isBespoke) {
            const error = new Error('Only bespoke questions can be rejected');
            error.statusCode = 400;
            throw error;
        }
        // Use the instance method to reject
        yield question.rejectBespokeQuestion(req.user._id, reason);
        // Populate and return
        const updatedQuestion = yield question_model_1.default.findById(questionId)
            .populate('category', 'name description')
            .populate('bespokeMetadata.createdBy', 'name email')
            .populate('bespokeMetadata.project', 'name');
        res.status(200).json({
            success: true,
            message: 'Bespoke question rejected',
            data: updatedQuestion
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.rejectBespokeQuestion = rejectBespokeQuestion;
/**
 * Elevate a bespoke question to regular question
 * @route POST /api/v1/questions/:id/elevate
 * @access Private (ConnectGo staff only)
 */
const elevateBespokeQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const questionId = req.params.id;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can elevate questions');
            error.statusCode = 403;
            throw error;
        }
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (!question.isBespoke) {
            const error = new Error('Only bespoke questions can be elevated');
            error.statusCode = 400;
            throw error;
        }
        // Use the instance method to elevate
        const elevatedQuestion = yield question.elevateBespokeQuestion(req.user._id);
        // Populate both questions
        const [originalQuestion, newQuestion] = yield Promise.all([
            question_model_1.default.findById(questionId)
                .populate('category', 'name description')
                .populate('bespokeMetadata.createdBy', 'name email')
                .populate('bespokeMetadata.elevatedBy', 'name email')
                .populate('bespokeMetadata.project', 'name'),
            question_model_1.default.findById(elevatedQuestion._id)
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
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.elevateBespokeQuestion = elevateBespokeQuestion;
/**
 * Update a bespoke question
 * @route PUT /api/v1/questions/bespoke/:id
 * @access Private (Creator or project managers)
 */
const updateBespokeQuestion = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const session = yield question_model_1.default.db.startSession();
    session.startTransaction();
    try {
        const questionId = req.params.id;
        const { text, description, type, required, options, validation, category, targetAudience } = req.body;
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (!question.isBespoke) {
            const error = new Error('Only bespoke questions can be updated via this endpoint');
            error.statusCode = 400;
            throw error;
        }
        if (question.archived) {
            const error = new Error('Cannot update an archived question');
            error.statusCode = 400;
            throw error;
        }
        // Check if user is the creator or has project access
        const isCreator = ((_a = question.bespokeMetadata) === null || _a === void 0 ? void 0 : _a.createdBy.toString()) === ((_b = req.user) === null || _b === void 0 ? void 0 : _b._id.toString());
        const hasProjectAccess = ((_c = question.bespokeMetadata) === null || _c === void 0 ? void 0 : _c.project) &&
            (0, authHelpers_1.userHasProjectAccess)(req, question.bespokeMetadata.project.toString());
        if (!isCreator && !hasProjectAccess && !((_d = req.user) === null || _d === void 0 ? void 0 : _d.isConnectGoStaff)) {
            const error = new Error('Not authorized to update this question');
            error.statusCode = 403;
            throw error;
        }
        // Can't edit if already elevated
        if (((_e = question.bespokeMetadata) === null || _e === void 0 ? void 0 : _e.status) === 'elevated') {
            const error = new Error('Cannot edit an elevated question');
            error.statusCode = 400;
            throw error;
        }
        // If changing type and options are needed
        if (type && ['radio', 'checkbox', 'dropdown'].includes(type)) {
            if (!options || !Array.isArray(options) || options.length === 0) {
                const error = new Error(`Options are required for question type: ${type}`);
                error.statusCode = 400;
                throw error;
            }
        }
        // Validate category if provided
        if (category) {
            const Category = mongoose_1.default.model('Category');
            const categoryExists = yield Category.findById(category);
            if (!categoryExists) {
                const error = new Error('Category not found');
                error.statusCode = 404;
                throw error;
            }
            if (categoryExists.archived) {
                const error = new Error('Cannot use an archived category');
                error.statusCode = 400;
                throw error;
            }
        }
        // Prepare update data
        const updateData = {};
        if (text !== undefined)
            updateData.text = text;
        if (description !== undefined)
            updateData.description = description;
        if (type !== undefined)
            updateData.type = type;
        if (required !== undefined)
            updateData.required = required;
        if (options !== undefined)
            updateData.options = options;
        if (validation !== undefined)
            updateData.validation = validation;
        if (category !== undefined)
            updateData.category = category;
        if (targetAudience !== undefined)
            updateData.targetAudience = targetAudience;
        // ← NEW: Bespoke questions always stay on the Custom theme/subTheme.
        //   Silently re-enforce in case of stale data rather than throwing an error.
        const { theme: customTheme, subTheme: customSubTheme } = yield (0, exports.getOrCreateCustomThemeAndSubtheme)((_f = req.user) === null || _f === void 0 ? void 0 : _f._id);
        updateData.theme = customTheme._id;
        updateData.subThemes = [customSubTheme._id];
        // If approved question is edited, reset to pending
        if (((_g = question.bespokeMetadata) === null || _g === void 0 ? void 0 : _g.status) === 'approved') {
            updateData['bespokeMetadata.status'] = 'pending';
            updateData['bespokeMetadata.approvedBy'] = undefined;
            updateData['bespokeMetadata.approvedAt'] = undefined;
            updateData.status = 'draft';
        }
        // Update the question
        const updatedQuestion = yield question_model_1.default.findByIdAndUpdate(questionId, updateData, { new: true, runValidators: true, session })
            .populate('category', 'name description')
            .populate('bespokeMetadata.createdBy', 'name email')
            .populate('bespokeMetadata.approvedBy', 'name email')
            .populate('bespokeMetadata.project', 'name');
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Bespoke question updated successfully',
            data: updatedQuestion
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateBespokeQuestion = updateBespokeQuestion;
/**
 * Get bespoke question statistics for a project
 * @route GET /api/v1/questions/bespoke/project/:projectId/statistics
 * @access Private
 */
const getBespokeQuestionStatistics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { projectId } = req.params;
        // Check if project exists
        const Project = mongoose_1.default.model('Project');
        const project = yield Project.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has access to this project
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess && !((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        const [totalBespoke, pending, approved, rejected, elevated, byCreator, recentActivity] = yield Promise.all([
            question_model_1.default.countDocuments({
                isBespoke: true,
                'bespokeMetadata.project': projectId,
                archived: { $ne: true }
            }),
            question_model_1.default.countDocuments({
                isBespoke: true,
                'bespokeMetadata.project': projectId,
                'bespokeMetadata.status': 'pending',
                archived: { $ne: true }
            }),
            question_model_1.default.countDocuments({
                isBespoke: true,
                'bespokeMetadata.project': projectId,
                'bespokeMetadata.status': 'approved',
                archived: { $ne: true }
            }),
            question_model_1.default.countDocuments({
                isBespoke: true,
                'bespokeMetadata.project': projectId,
                'bespokeMetadata.status': 'rejected'
            }),
            question_model_1.default.countDocuments({
                isBespoke: true,
                'bespokeMetadata.project': projectId,
                'bespokeMetadata.status': 'elevated'
            }),
            question_model_1.default.aggregate([
                {
                    $match: {
                        isBespoke: true,
                        'bespokeMetadata.project': new mongoose_1.default.Types.ObjectId(projectId),
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
            question_model_1.default.find({
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
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getBespokeQuestionStatistics = getBespokeQuestionStatistics;
// ========================================
// HELPER FUNCTIONS FOR SURVEY QUESTION CONTROLLER
// ========================================
/**
 * Helper function to map Question conditional logic to SurveyQuestion conditional logic
 * This is called when adding a question to a survey
 */
const mapConditionalLogicToSurvey = (questionConditionalLogic, surveyId, questionToSurveyQuestionMap) => __awaiter(void 0, void 0, void 0, function* () {
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
        }
        else {
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
});
exports.mapConditionalLogicToSurvey = mapConditionalLogicToSurvey;
/**
 * Helper function to validate that all conditional dependencies are present in survey
 */
const validateConditionalDependenciesInSurvey = (questionId, surveyId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const question = yield question_model_1.default.findById(questionId);
    if (!question || !((_a = question.conditionalLogic) === null || _a === void 0 ? void 0 : _a.enabled)) {
        return { isValid: true, missingDependencies: [], warnings: [] };
    }
    const SurveyQuestion = mongoose_1.default.model('SurveyQuestion');
    // Get all questions in the survey
    const surveyQuestions = yield SurveyQuestion.find({ survey: surveyId })
        .populate('question');
    const questionIdsInSurvey = new Set(surveyQuestions.map((sq) => sq.question._id.toString()));
    const missingDependencies = [];
    const warnings = [];
    for (const condition of question.conditionalLogic.conditions) {
        const dependencyId = condition.questionId.toString();
        if (!questionIdsInSurvey.has(dependencyId)) {
            const depQuestion = yield question_model_1.default.findById(dependencyId);
            missingDependencies.push((depQuestion === null || depQuestion === void 0 ? void 0 : depQuestion.text) || dependencyId);
            warnings.push(`Conditional dependency "${(depQuestion === null || depQuestion === void 0 ? void 0 : depQuestion.text) || dependencyId}" is not in this survey`);
        }
    }
    return {
        isValid: missingDependencies.length === 0,
        missingDependencies,
        warnings
    };
});
exports.validateConditionalDependenciesInSurvey = validateConditionalDependenciesInSurvey;
/**
 * Update only the conditional logic of a question
 * @route PUT /api/v1/questions/:id/conditional-logic
 * @access Private (ConnectGo staff only)
 */
const updateQuestionConditionalLogic = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const error = new Error('Only ConnectGo staff can update question conditional logic');
            error.statusCode = 403;
            throw error;
        }
        const questionId = req.params.id;
        const { conditionalLogic } = req.body;
        // Explicit check — undefined means the field was never sent, which is a client error here
        if (conditionalLogic === undefined) {
            const error = new Error('conditionalLogic is required in the request body');
            error.statusCode = 400;
            throw error;
        }
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        if (question.archived) {
            const error = new Error('Cannot update an archived question');
            error.statusCode = 400;
            throw error;
        }
        // null means the caller explicitly wants to clear conditional logic
        if (conditionalLogic === null) {
            yield question_model_1.default.findByIdAndUpdate(questionId, { $unset: { conditionalLogic: 1 } });
            return res.status(200).json({
                success: true,
                message: 'Conditional logic cleared successfully',
                data: yield question_model_1.default.findById(questionId),
                validation: { isValid: true, errors: [], warnings: [] }
            });
        }
        // Pre-write validation: check self-reference and referenced question existence
        if ((conditionalLogic === null || conditionalLogic === void 0 ? void 0 : conditionalLogic.enabled) && ((_b = conditionalLogic.conditions) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            for (const condition of conditionalLogic.conditions) {
                if (((_c = condition.questionId) === null || _c === void 0 ? void 0 : _c.toString()) === questionId) {
                    const error = new Error('A question cannot reference itself in conditional logic');
                    error.statusCode = 400;
                    throw error;
                }
                const referencedQuestion = yield question_model_1.default.findById(condition.questionId);
                if (!referencedQuestion) {
                    const error = new Error(`Referenced question ${condition.questionId} not found`);
                    error.statusCode = 404;
                    throw error;
                }
                if (referencedQuestion.archived) {
                    const error = new Error('Referenced question is archived');
                    error.statusCode = 400;
                    throw error;
                }
            }
        }
        // Run full validation on the in-memory document BEFORE writing to DB
        question.conditionalLogic = conditionalLogic;
        const validation = yield question.validateConditionalLogic();
        if (!validation.isValid) {
            const error = new Error(`Conditional logic validation failed: ${validation.errors.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }
        const updatedQuestion = yield question_model_1.default.findByIdAndUpdate(questionId, { $set: { conditionalLogic } }, { new: true, runValidators: false }).populate('conditionalLogic.conditions.questionId', 'text type options');
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
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateQuestionConditionalLogic = updateQuestionConditionalLogic;
/**
 * Get questions that depend on a specific question (reverse dependencies)
 * @route GET /api/v1/questions/:id/dependents
 * @access Private
 */
const getQuestionDependents = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const questionId = req.params.id;
        const question = yield question_model_1.default.findById(questionId);
        if (!question) {
            const error = new Error('Question not found');
            error.statusCode = 404;
            throw error;
        }
        // Find all questions that reference this question in their conditional logic
        const dependents = yield question_model_1.default.find({
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
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid question ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getQuestionDependents = getQuestionDependents;
exports.default = {
    createQuestion: exports.createQuestion,
    getQuestions: exports.getQuestions,
    getQuestionsByIds: exports.getQuestionsByIds,
    getQuestion: exports.getQuestion,
    updateQuestion: exports.updateQuestion,
    getQuestionAvailableTags: exports.getQuestionAvailableTags,
    getSubthemeAvailableTags: exports.getSubthemeAvailableTags,
    archiveQuestion: exports.archiveQuestion,
    restoreQuestion: exports.restoreQuestion,
    deleteQuestion: exports.deleteQuestion,
    cloneQuestion: exports.cloneQuestion,
    getQuestionTagStatistics: exports.getQuestionTagStatistics,
    getStandardDemographics: exports.getStandardDemographics,
    getDemographicsByCategory: exports.getDemographicsByCategory,
    getRecommendedDemographics: exports.getRecommendedDemographics,
    toggleStandardDemographic: exports.toggleStandardDemographic,
    bulkToggleDemographic: exports.bulkToggleDemographic,
    getDemographicComplianceReport: exports.getDemographicComplianceReport,
    // NEW: Bespoke question functions
    createBespokeQuestion: exports.createBespokeQuestion,
    getBespokeQuestionsByProject: exports.getBespokeQuestionsByProject,
    getBespokeQuestionsByOrganization: exports.getBespokeQuestionsByOrganization,
    getAvailableBespokeQuestions: exports.getAvailableBespokeQuestions,
    approveBespokeQuestion: exports.approveBespokeQuestion,
    rejectBespokeQuestion: exports.rejectBespokeQuestion,
    elevateBespokeQuestion: exports.elevateBespokeQuestion,
    updateBespokeQuestion: exports.updateBespokeQuestion,
    getBespokeQuestionStatistics: exports.getBespokeQuestionStatistics,
    validateQuestionConditionalLogic: exports.validateQuestionConditionalLogic,
    getQuestionConditionalDependencies: exports.getQuestionConditionalDependencies,
    getQuestionsWithDependencies: exports.getQuestionsWithDependencies,
    updateQuestionConditionalLogic: exports.updateQuestionConditionalLogic,
    getQuestionDependents: exports.getQuestionDependents,
    mapConditionalLogicToSurvey: exports.mapConditionalLogicToSurvey,
    validateConditionalDependenciesInSurvey: exports.validateConditionalDependenciesInSurvey
};
//# sourceMappingURL=question.controller.js.map