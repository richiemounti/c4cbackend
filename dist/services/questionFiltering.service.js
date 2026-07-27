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
exports.getSurveyCreationContext = exports.getFilteredQuestions = void 0;
// services/questionFiltering.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const question_model_1 = __importDefault(require("../models/question.model"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const theoryOfChangeStage_model_1 = __importDefault(require("../models/theoryOfChangeStage.model"));
const stakeholderAction_model_1 = __importDefault(require("../models/stakeholderAction.model"));
const socialImpact_model_1 = __importDefault(require("../models/socialImpact.model"));
const subtheme_model_1 = __importDefault(require("../models/subtheme.model"));
/**
 * Get filtered questions based on stakeholder group and theory of change stage
 */
const getFilteredQuestions = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const { stakeholderGroupId, stageId, projectId, projectSiteId, includeFrequentlyAsked = true, themeIds, subThemeIds, questionType, searchTerm, page = 1, limit = 50 } = options;
    // Get stakeholder group with theme associations
    // NOTE: .populate('category') here refers to StakeholderGroup.category — unchanged
    const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderGroupId)
        .populate('themes', 'name description')
        .populate('category', 'name')
        .populate('project', 'name')
        .populate('projectSite', 'name');
    if (!stakeholderGroup) {
        throw new Error('Stakeholder group not found');
    }
    // Get theory of change stage
    const stage = yield theoryOfChangeStage_model_1.default.findById(stageId)
        .populate('project', 'name');
    if (!stage) {
        throw new Error('Theory of change stage not found');
    }
    // Determine stage type for filtering
    const stageType = stage.stageNumber === 1 ? 'Stage 1 - Output' : 'Stage 2 - Outcome';
    // Get themes and subthemes from stakeholder's actions/impacts in this stage
    let stakeholderThemes = [];
    let stakeholderSubThemes = [];
    if (stage.stageNumber === 1) {
        // Get themes/subthemes from stakeholder actions
        const actions = yield stakeholderAction_model_1.default.find({
            stakeholderGroup: stakeholderGroupId,
            stage: stageId,
            archived: { $ne: true }
        });
        stakeholderThemes = [...new Set(actions.flatMap(action => action.themes.map((theme) => theme.toString())))];
        stakeholderSubThemes = [...new Set(actions.flatMap(action => action.subThemes.map((subTheme) => subTheme.toString())))];
    }
    else {
        // Get themes/subthemes from social impacts
        const impacts = yield socialImpact_model_1.default.find({
            stakeholderGroup: stakeholderGroupId,
            stage: stageId,
            archived: { $ne: true }
        });
        stakeholderThemes = [...new Set(impacts.flatMap(impact => impact.themes.map((theme) => theme.toString())))];
        stakeholderSubThemes = [...new Set(impacts.flatMap(impact => impact.subThemes.map((subTheme) => subTheme.toString())))];
    }
    // Fallback to stakeholder group's assigned themes if no specific actions/impacts exist
    if (stakeholderThemes.length === 0 && stakeholderGroup.themes && stakeholderGroup.themes.length > 0) {
        stakeholderThemes = stakeholderGroup.themes.map((theme) => theme._id.toString());
    }
    // Build question filter query
    const questionFilter = {
        archived: { $ne: true },
        status: 'published'
    };
    // Stage filtering - get subthemes for this stage
    const stageSubThemes = yield subtheme_model_1.default.find({
        theoryOfChangeStage: stageType,
        archived: { $ne: true }
    });
    const stageSubThemeIds = stageSubThemes.map((st) => st._id.toString());
    // Apply filtering logic
    const filterConditions = [];
    // 1. Questions matching stakeholder's themes and stage
    if (stakeholderThemes.length > 0) {
        filterConditions.push({
            theme: { $in: stakeholderThemes },
            subThemes: { $in: stageSubThemeIds } // FIXED: was subTheme
        });
    }
    // 2. Questions matching stakeholder's specific subthemes
    if (stakeholderSubThemes.length > 0) {
        filterConditions.push({
            subThemes: { $in: stakeholderSubThemes } // FIXED: was subTheme
        });
    }
    // 3. Include frequently asked questions if requested
    if (includeFrequentlyAsked) {
        filterConditions.push({
            tags: { $in: ['frequently_asked', 'common', 'standard'] },
            subThemes: { $in: stageSubThemeIds } // FIXED: was subTheme
        });
    }
    // 4. Include standard demographic questions
    filterConditions.push({
        isStandardDemographic: true
    });
    // Apply OR logic for the main filtering conditions
    if (filterConditions.length > 0) {
        questionFilter.$or = filterConditions;
    }
    else {
        // If no specific filtering, just filter by stage
        questionFilter.subThemes = { $in: stageSubThemeIds }; // FIXED: was subTheme
    }
    // Apply additional filters if provided
    if (themeIds && themeIds.length > 0) {
        questionFilter.theme = { $in: themeIds };
    }
    if (subThemeIds && subThemeIds.length > 0) {
        questionFilter.subThemes = { $in: subThemeIds }; // FIXED: was subTheme
    }
    if (questionType) {
        questionFilter.type = questionType;
    }
    if (searchTerm) {
        questionFilter.$and = questionFilter.$and || [];
        questionFilter.$and.push({
            $or: [
                { text: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { tags: { $regex: searchTerm, $options: 'i' } }
            ]
        });
    }
    // Execute the query with pagination
    const skip = (page - 1) * limit;
    const [questions, totalCount] = yield Promise.all([
        question_model_1.default.find(questionFilter)
            .populate('theme', 'name description')
            .populate('subThemes', 'name description theoryOfChangeStage') // FIXED: was subTheme
            .populate('selectedIndicatorTags', 'name description')
            .populate('selectedSdgTags', 'code name')
            .populate('selectedResilienceTags', 'code name')
            .populate('selectedEsgTags', 'code name')
            .populate('selectedStandardTags', 'code name')
            .sort({ 'theme.name': 1, text: 1 }) // FIXED: removed 'subTheme.name' (can't sort by populated array)
            .skip(skip)
            .limit(limit),
        question_model_1.default.countDocuments(questionFilter)
    ]);
    // Get available themes and subthemes for filtering UI
    const availableThemes = yield mongoose_1.default.model('Theme').find({
        _id: { $in: stakeholderThemes }
    }).select('name description');
    const availableSubThemes = yield subtheme_model_1.default.find({
        _id: { $in: stageSubThemeIds },
        theme: { $in: stakeholderThemes }
    })
        .populate('theme', 'name')
        .select('name description theme theoryOfChangeStage');
    return {
        filteredQuestions: questions,
        availableThemes,
        availableSubThemes,
        stageInfo: {
            _id: stage._id,
            stageNumber: stage.stageNumber,
            stageType,
            name: `Stage ${stage.stageNumber}`,
            project: stage.project
        },
        stakeholderInfo: {
            _id: stakeholderGroup._id,
            name: stakeholderGroup.name,
            category: stakeholderGroup.category,
            themes: stakeholderGroup.themes,
            project: stakeholderGroup.project,
            projectSite: stakeholderGroup.projectSite
        },
        totalCount
    };
});
exports.getFilteredQuestions = getFilteredQuestions;
/**
 * Get survey creation context - themes and subthemes available for a stakeholder in a stage
 */
const getSurveyCreationContext = (stakeholderGroupId, stageId) => __awaiter(void 0, void 0, void 0, function* () {
    // NOTE: .populate('category') here refers to StakeholderGroup.category — unchanged
    const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderGroupId)
        .populate('themes', 'name description')
        .populate('category', 'name');
    const stage = yield theoryOfChangeStage_model_1.default.findById(stageId);
    if (!stakeholderGroup || !stage) {
        throw new Error('Stakeholder group or stage not found');
    }
    const stageType = stage.stageNumber === 1 ? 'Stage 1 - Output' : 'Stage 2 - Outcome';
    // Get available subthemes for this stage
    const availableSubThemes = yield subtheme_model_1.default.find({
        theoryOfChangeStage: stageType,
        archived: { $ne: true }
    }).populate('theme', 'name description');
    // Group subthemes by theme
    const themeSubThemeMap = new Map();
    availableSubThemes.forEach((subTheme) => {
        const themeId = subTheme.theme._id.toString();
        if (!themeSubThemeMap.has(themeId)) {
            themeSubThemeMap.set(themeId, {
                theme: subTheme.theme,
                subThemes: []
            });
        }
        themeSubThemeMap.get(themeId).subThemes.push(subTheme);
    });
    return {
        stakeholderGroup,
        stage: {
            _id: stage._id,
            stageNumber: stage.stageNumber,
            stageType,
            name: `Stage ${stage.stageNumber}`
        },
        availableThemesWithSubThemes: Array.from(themeSubThemeMap.values()),
        questionCategories: [
            { key: 'stakeholder_specific', label: 'Stakeholder-Specific Questions' },
            { key: 'frequently_asked', label: 'Frequently Asked Questions' },
            { key: 'demographic', label: 'Demographic Questions' },
            { key: 'all', label: 'All Available Questions' }
        ]
    };
});
exports.getSurveyCreationContext = getSurveyCreationContext;
//# sourceMappingURL=questionFiltering.service.js.map