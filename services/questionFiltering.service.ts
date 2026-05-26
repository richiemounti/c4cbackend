// services/questionFiltering.service.ts
import mongoose from "mongoose";
import Question from "../models/question.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
import StakeholderAction from "../models/stakeholderAction.model";
import SocialImpact from "../models/socialImpact.model";
import SubTheme from "../models/subtheme.model";

interface FilteredQuestionsResult {
  filteredQuestions: any[];
  availableThemes: any[];
  availableSubThemes: any[];
  stageInfo: any;
  stakeholderInfo: any;
  totalCount: number;
}

interface QuestionFilterOptions {
  stakeholderGroupId: string;
  stageId: string;
  projectId?: string;
  projectSiteId?: string;
  includeFrequentlyAsked?: boolean;
  themeIds?: string[];
  subThemeIds?: string[];
  questionType?: string;
  searchTerm?: string;
  page?: number;
  limit?: number;
}

/**
 * Get filtered questions based on stakeholder group and theory of change stage
 */
export const getFilteredQuestions = async (options: QuestionFilterOptions): Promise<FilteredQuestionsResult> => {
  const {
    stakeholderGroupId,
    stageId,
    projectId,
    projectSiteId,
    includeFrequentlyAsked = true,
    themeIds,
    subThemeIds,
    questionType,
    searchTerm,
    page = 1,
    limit = 50
  } = options;

  // Get stakeholder group with theme associations
  // NOTE: .populate('category') here refers to StakeholderGroup.category — unchanged
  const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId)
    .populate('themes', 'name description')
    .populate('category', 'name')
    .populate('project', 'name')
    .populate('projectSite', 'name');

  if (!stakeholderGroup) {
    throw new Error('Stakeholder group not found');
  }

  // Get theory of change stage
  const stage = await TheoryOfChangeStage.findById(stageId)
    .populate('project', 'name');

  if (!stage) {
    throw new Error('Theory of change stage not found');
  }

  // Determine stage type for filtering
  const stageType = stage.stageNumber === 1 ? 'Stage 1 - Output' : 'Stage 2 - Outcome';

  // Get themes and subthemes from stakeholder's actions/impacts in this stage
  let stakeholderThemes: string[] = [];
  let stakeholderSubThemes: string[] = [];

  if (stage.stageNumber === 1) {
    // Get themes/subthemes from stakeholder actions
    const actions = await StakeholderAction.find({
      stakeholderGroup: stakeholderGroupId,
      stage: stageId,
      archived: { $ne: true }
    });
    
    stakeholderThemes = [...new Set(actions.flatMap(action => 
      action.themes.map((theme: any) => theme.toString())
    ))];
    
    stakeholderSubThemes = [...new Set(actions.flatMap(action => 
      action.subThemes.map((subTheme: any) => subTheme.toString())
    ))];
  } else {
    // Get themes/subthemes from social impacts
    const impacts = await SocialImpact.find({
      stakeholderGroup: stakeholderGroupId,
      stage: stageId,
      archived: { $ne: true }
    });
    
    stakeholderThemes = [...new Set(impacts.flatMap(impact => 
      impact.themes.map((theme: any) => theme.toString())
    ))];
    
    stakeholderSubThemes = [...new Set(impacts.flatMap(impact => 
      impact.subThemes.map((subTheme: any) => subTheme.toString())
    ))];
  }

  // Fallback to stakeholder group's assigned themes if no specific actions/impacts exist
  if (stakeholderThemes.length === 0 && stakeholderGroup.themes && stakeholderGroup.themes.length > 0) {
    stakeholderThemes = stakeholderGroup.themes.map((theme: any) => theme._id.toString());
  }

  // Build question filter query
  const questionFilter: any = {
    archived: { $ne: true },
    status: 'published'
  };

  // Stage filtering - get subthemes for this stage
  const stageSubThemes = await SubTheme.find({
    theoryOfChangeStage: stageType,
    archived: { $ne: true }
  });
  
  const stageSubThemeIds = stageSubThemes.map((st: any) => st._id.toString());

  // Apply filtering logic
  const filterConditions: any[] = [];

  // 1. Questions matching stakeholder's themes and stage
  if (stakeholderThemes.length > 0) {
    filterConditions.push({
      theme: { $in: stakeholderThemes },
      subThemes: { $in: stageSubThemeIds }  // FIXED: was subTheme
    });
  }

  // 2. Questions matching stakeholder's specific subthemes
  if (stakeholderSubThemes.length > 0) {
    filterConditions.push({
      subThemes: { $in: stakeholderSubThemes }  // FIXED: was subTheme
    });
  }

  // 3. Include frequently asked questions if requested
  if (includeFrequentlyAsked) {
    filterConditions.push({
      tags: { $in: ['frequently_asked', 'common', 'standard'] },
      subThemes: { $in: stageSubThemeIds }  // FIXED: was subTheme
    });
  }

  // 4. Include standard demographic questions
  filterConditions.push({
    isStandardDemographic: true
  });

  // Apply OR logic for the main filtering conditions
  if (filterConditions.length > 0) {
    questionFilter.$or = filterConditions;
  } else {
    // If no specific filtering, just filter by stage
    questionFilter.subThemes = { $in: stageSubThemeIds };  // FIXED: was subTheme
  }

  // Apply additional filters if provided
  if (themeIds && themeIds.length > 0) {
    questionFilter.theme = { $in: themeIds };
  }

  if (subThemeIds && subThemeIds.length > 0) {
    questionFilter.subThemes = { $in: subThemeIds };  // FIXED: was subTheme
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
  
  const [questions, totalCount] = await Promise.all([
    Question.find(questionFilter)
      .populate('theme', 'name description')
      .populate('subThemes', 'name description theoryOfChangeStage')  // FIXED: was subTheme
      .populate('selectedIndicatorTags', 'name description')
      .populate('selectedSdgTags', 'code name')
      .populate('selectedResilienceTags', 'code name')
      .populate('selectedEsgTags', 'code name')
      .populate('selectedStandardTags', 'code name')
      .sort({ 'theme.name': 1, text: 1 })  // FIXED: removed 'subTheme.name' (can't sort by populated array)
      .skip(skip)
      .limit(limit),
    
    Question.countDocuments(questionFilter)
  ]);

  // Get available themes and subthemes for filtering UI
  const availableThemes = await mongoose.model('Theme').find({
    _id: { $in: stakeholderThemes }
  }).select('name description');

  const availableSubThemes = await SubTheme.find({
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
};

/**
 * Get survey creation context - themes and subthemes available for a stakeholder in a stage
 */
export const getSurveyCreationContext = async (stakeholderGroupId: string, stageId: string) => {
  // NOTE: .populate('category') here refers to StakeholderGroup.category — unchanged
  const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId)
    .populate('themes', 'name description')
    .populate('category', 'name');

  const stage = await TheoryOfChangeStage.findById(stageId);

  if (!stakeholderGroup || !stage) {
    throw new Error('Stakeholder group or stage not found');
  }

  const stageType = stage.stageNumber === 1 ? 'Stage 1 - Output' : 'Stage 2 - Outcome';

  // Get available subthemes for this stage
  const availableSubThemes = await SubTheme.find({
    theoryOfChangeStage: stageType,
    archived: { $ne: true }
  }).populate('theme', 'name description');

  // Group subthemes by theme
  const themeSubThemeMap = new Map();
  availableSubThemes.forEach((subTheme: any) => {
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
};