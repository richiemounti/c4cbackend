// services/questionFiltering.service.ts
import mongoose from "mongoose";
import Question from "../models/question.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
import StakeholderAction from "../models/stakeholderAction.model";
import SocialImpact from "../models/socialImpact.model";
import SubTheme from "../models/subtheme.model";
import Survey from "../models/survey.model";

interface FilteredQuestionsResult {
  filteredQuestions: any[];
  availableThemes: any[];
  availableSubThemes: any[];
  stageInfo: any;
  stakeholderInfo: any;
  totalCount: number;
}

interface QuestionFilterOptions {
  stakeholderGroupIds: string[];
  stageIds: string[];   // 1 element for single-stage, 2 elements for both-stage surveys
  // Identify the SPECIFIC Action/Impact record(s) this combo card represents. Multiple
  // distinct Actions (or Impacts) can legitimately share the exact same stakeholder-group
  // set while covering completely different themes — without these, matching purely by
  // group set would blend unrelated records' themes/subthemes together.
  actionId?: string;
  impactId?: string;
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
 * Get filtered questions based on stakeholder group(s) and theory of change stage(s)
 */
export const getFilteredQuestions = async (options: QuestionFilterOptions): Promise<FilteredQuestionsResult> => {
  const {
    stakeholderGroupIds,
    stageIds,
    actionId,
    impactId,
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

  // Fetch all stakeholder groups
  const stakeholderGroups = await StakeholderGroup.find({ _id: { $in: stakeholderGroupIds } })
    .populate('themes', 'name description')
    .populate('category', 'name')
    .populate('project', 'name')
    .populate('projectSite', 'name');

  if (stakeholderGroups.length === 0) {
    throw new Error('No stakeholder groups found');
  }

  // Fetch all referenced stages
  const stages = await TheoryOfChangeStage.find({ _id: { $in: stageIds } })
    .populate('project', 'name');

  if (stages.length === 0) {
    throw new Error('No theory of change stages found');
  }

  // Determine which stage types are covered
  const hasStage1 = stages.some(s => s.stageNumber === 1);
  const hasStage2 = stages.some(s => s.stageNumber === 2);

  const stageTypeFilter: string[] = [];
  if (hasStage1) stageTypeFilter.push('Stage 1 - Output');
  if (hasStage2) stageTypeFilter.push('Stage 2 - Outcome');
  stageTypeFilter.push('Both'); // always include cross-stage subthemes

  // Collect themes and subthemes from all groups' actions/impacts across all stages
  let stakeholderThemes: string[] = [];
  let stakeholderSubThemes: string[] = [];

  if (hasStage1) {
    // Preferred: this card was reached with a specific Action id, so its themes/subthemes
    // come from that ONE record — no risk of blending in a different Action that happens to
    // share the same stakeholder-group set. Falls back to a group-set match only for older
    // links that don't carry an actionId.
    const actions = actionId
      ? await StakeholderAction.find({ _id: actionId, archived: { $ne: true } })
      : await StakeholderAction.find({
          stakeholderGroups: { $in: stakeholderGroupIds },
          stage: { $in: stages.filter(s => s.stageNumber === 1).map(s => s._id.toString()) },
          archived: { $ne: true }
        });
    stakeholderThemes.push(...actions.flatMap(a => a.themes.map((t: any) => t.toString())));
    stakeholderSubThemes.push(...actions.flatMap(a => a.subThemes.map((st: any) => st.toString())));
  }

  if (hasStage2) {
    const impacts = impactId
      ? await SocialImpact.find({ _id: impactId, archived: { $ne: true } })
      : await SocialImpact.find({
          stakeholderGroups: { $in: stakeholderGroupIds },
          stage: { $in: stages.filter(s => s.stageNumber === 2).map(s => s._id.toString()) },
          archived: { $ne: true }
        });
    stakeholderThemes.push(...impacts.flatMap(i => i.themes.map((t: any) => t.toString())));
    stakeholderSubThemes.push(...impacts.flatMap(i => i.subThemes.map((st: any) => st.toString())));
  }

  stakeholderThemes = [...new Set(stakeholderThemes)];
  stakeholderSubThemes = [...new Set(stakeholderSubThemes)];

  // Fallback: use themes assigned to any of the stakeholder groups
  if (stakeholderThemes.length === 0) {
    stakeholderGroups.forEach(sg => {
      if (sg.themes && sg.themes.length > 0) {
        stakeholderThemes.push(...sg.themes.map((t: any) => t._id.toString()));
      }
    });
    stakeholderThemes = [...new Set(stakeholderThemes)];
  }

  // Build question filter query
  const questionFilter: any = {
    archived: { $ne: true },
    status: 'published'
  };

  // Get subthemes for all relevant stages (union of stage type filters)
  const stageSubThemes = await SubTheme.find({
    theoryOfChangeStage: { $in: stageTypeFilter },
    archived: { $ne: true }
  });

  const stageSubThemeIds = stageSubThemes.map((st: any) => st._id.toString());

  // Apply filtering logic
  const filterConditions: any[] = [];

  // 1. Questions matching this record's actual recorded subthemes — the precise match.
  if (stakeholderSubThemes.length > 0) {
    filterConditions.push({
      subThemes: { $in: stakeholderSubThemes }
    });
  } else if (stakeholderThemes.length > 0) {
    // Fallback only: no specific subthemes to go on (e.g. a StakeholderGroup's own bare
    // `themes` field, not an Action/Impact's tagged subthemes) — widen to theme + any
    // stage-relevant subtheme. Kept separate from the precise branch above so a
    // well-tagged Action/Impact never has an unrelated same-theme subtheme leak in from
    // this broader net.
    filterConditions.push({
      theme: { $in: stakeholderThemes },
      subThemes: { $in: stageSubThemeIds }
    });
  }

  // 2. Include frequently asked questions if requested
  if (includeFrequentlyAsked) {
    filterConditions.push({
      tags: { $in: ['frequently_asked', 'common', 'standard'] },
      subThemes: { $in: stageSubThemeIds }  // FIXED: was subTheme
    });
  }

  // 3. Include standard demographic questions
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

  const primaryStage = stages[0];
  const stageScope = hasStage1 && hasStage2 ? 'both' : hasStage1 ? 'stage1' : 'stage2';

  return {
    filteredQuestions: questions,
    availableThemes,
    availableSubThemes,
    stageInfo: {
      stages: stages.map(s => ({ _id: s._id, stageNumber: s.stageNumber, name: `Stage ${s.stageNumber}`, project: s.project })),
      stageScope,
      stageTypes: stageTypeFilter,
      project: primaryStage.project
    },
    stakeholderInfo: {
      stakeholderGroups: stakeholderGroups.map(sg => ({
        _id: sg._id,
        name: sg.name,
        category: sg.category,
        themes: sg.themes,
        project: sg.project,
        projectSite: sg.projectSite
      }))
    },
    totalCount
  };
};

/**
 * Get survey creation context - themes and subthemes available for a stakeholder in a stage
 */
export const getSurveyCreationContext = async (stakeholderGroupIds: string[], stageIds: string[]) => {
  const stakeholderGroups = await StakeholderGroup.find({ _id: { $in: stakeholderGroupIds } })
    .populate('themes', 'name description')
    .populate('category', 'name');

  const stages = await TheoryOfChangeStage.find({ _id: { $in: stageIds } });

  if (stakeholderGroups.length === 0 || stages.length === 0) {
    throw new Error('Stakeholder groups or stages not found');
  }

  const hasStage1 = stages.some(s => s.stageNumber === 1);
  const hasStage2 = stages.some(s => s.stageNumber === 2);
  const stageScope = hasStage1 && hasStage2 ? 'both' : hasStage1 ? 'stage1' : 'stage2';

  const stageTypeFilter: string[] = [];
  if (hasStage1) stageTypeFilter.push('Stage 1 - Output');
  if (hasStage2) stageTypeFilter.push('Stage 2 - Outcome');
  stageTypeFilter.push('Both');

  // Get available subthemes for all relevant stages
  const availableSubThemes = await SubTheme.find({
    theoryOfChangeStage: { $in: stageTypeFilter },
    archived: { $ne: true }
  }).populate('theme', 'name description');

  // Group subthemes by theme
  const themeSubThemeMap = new Map();
  availableSubThemes.forEach((subTheme: any) => {
    const themeId = subTheme.theme._id.toString();
    if (!themeSubThemeMap.has(themeId)) {
      themeSubThemeMap.set(themeId, { theme: subTheme.theme, subThemes: [] });
    }
    themeSubThemeMap.get(themeId).subThemes.push(subTheme);
  });

  return {
    stakeholderGroups,
    stages: stages.map(s => ({
      _id: s._id,
      stageNumber: s.stageNumber,
      name: `Stage ${s.stageNumber}`
    })),
    stageScope,
    availableThemesWithSubThemes: Array.from(themeSubThemeMap.values()),
    questionCategories: [
      { key: 'stakeholder_specific', label: 'Stakeholder-Specific Questions' },
      { key: 'frequently_asked', label: 'Frequently Asked Questions' },
      { key: 'demographic', label: 'Demographic Questions' },
      { key: 'all', label: 'All Available Questions' }
    ]
  };
};

export interface BuilderOverviewCombo {
  stakeholderGroupIds: string[];
  stageScope: 'stage1' | 'stage2' | 'both';
  stageIds: string[];
  availableQuestions: number;
  existingSurveys: number;
  lastSurveyDate: string | null;
  // The specific Theory of Change record(s) this card represents. Needed downstream so
  // question eligibility can be scoped to exactly this Action/Impact — multiple distinct
  // records can legitimately share the same stakeholder-group set while covering completely
  // different themes, so matching purely by group set would blend them together.
  sourceActionId?: string;
  sourceImpactId?: string;
}

const comboKey = (ids: any[]): string => ids.map((id: any) => id.toString()).sort().join(',');

/**
 * Aggregate survey-builder overview for a whole project: one card per Stage 1 Action and per
 * Stage 2 Impact actually recorded (never merged across different records, even when two
 * Actions happen to share the exact same stakeholder-group set — they can cover entirely
 * different themes), plus a "Both Stages" card for every Action/Impact pair that shares a
 * group set. Groups with no recorded Actions/Impacts at all are out of scope and get no card.
 */
export const getSurveyBuilderOverview = async (projectId: string): Promise<{
  stakeholderGroups: any[];
  stages: any[];
  combos: BuilderOverviewCombo[];
}> => {
  // Kick these off immediately, in parallel with the stage-dependent chain below — none of
  // them depend on stage1/stage2 being resolved first, so there's no reason to wait for that
  // chain before starting them.
  const publishedQuestionsPromise = Question.find(
    { archived: { $ne: true }, status: 'published' },
    { theme: 1, subThemes: 1, tags: 1, isStandardDemographic: 1 }
  ).lean();
  const projectSurveysPromise = Survey.find(
    { project: projectId, archived: { $ne: true } },
    { stakeholderGroups: 1, stageScope: 1, createdAt: 1 }
  ).lean();

  const [stakeholderGroups, stages] = await Promise.all([
    StakeholderGroup.find({ project: projectId }).populate('category', 'name').lean(),
    // Mirrors theoryOfChange.controller.ts's getStagesByProject: project-level stages only
    TheoryOfChangeStage.find({ project: projectId, projectSite: null, archived: { $ne: true } }).lean()
  ]);

  const stage1 = stages.find((s: any) => s.stageNumber === 1);
  const stage2 = stages.find((s: any) => s.stageNumber === 2);

  const [actions, impacts, allSubThemes] = await Promise.all([
    stage1 ? StakeholderAction.find({ project: projectId, archived: { $ne: true } }).lean() : Promise.resolve([]),
    stage2 ? SocialImpact.find({ project: projectId, archived: { $ne: true } }).lean() : Promise.resolve([]),
    SubTheme.find({ archived: { $ne: true } }).lean()
  ]);

  const stage1SubThemeIds = allSubThemes
    .filter((st: any) => ['Stage 1 - Output', 'Both'].includes(st.theoryOfChangeStage))
    .map((st: any) => st._id.toString());
  const stage2SubThemeIds = allSubThemes
    .filter((st: any) => ['Stage 2 - Outcome', 'Both'].includes(st.theoryOfChangeStage))
    .map((st: any) => st._id.toString());
  const bothSubThemeIds = [...new Set([...stage1SubThemeIds, ...stage2SubThemeIds])];

  type ComboSpec = {
    groupIds: string[];
    scope: 'stage1' | 'stage2' | 'both';
    stageIds: string[];
    themeIds: string[];
    subThemeIds: string[];
    stageSubThemeIds: string[];
    sourceActionId?: string;
    sourceImpactId?: string;
  };
  const comboSpecs: ComboSpec[] = [];

  // One card per Action — never merged with another Action, even one sharing the exact same
  // stakeholder-group set (that's a different program activity with its own theme/subtheme
  // signature, not the same combo).
  actions.forEach((a: any) => {
    const groupIds = (a.stakeholderGroups || []).map((id: any) => id.toString());
    if (groupIds.length === 0) return;
    comboSpecs.push({
      groupIds,
      scope: 'stage1',
      stageIds: [stage1!._id.toString()],
      themeIds: Array.from(new Set<string>(a.themes.map((t: any) => t.toString()))),
      subThemeIds: Array.from(new Set<string>(a.subThemes.map((st: any) => st.toString()))),
      stageSubThemeIds: stage1SubThemeIds,
      sourceActionId: a._id.toString()
    });
  });

  // One card per Impact, same principle.
  impacts.forEach((i: any) => {
    const groupIds = (i.stakeholderGroups || []).map((id: any) => id.toString());
    if (groupIds.length === 0) return;
    comboSpecs.push({
      groupIds,
      scope: 'stage2',
      stageIds: [stage2!._id.toString()],
      themeIds: Array.from(new Set<string>(i.themes.map((t: any) => t.toString()))),
      subThemeIds: Array.from(new Set<string>(i.subThemes.map((st: any) => st.toString()))),
      stageSubThemeIds: stage2SubThemeIds,
      sourceImpactId: i._id.toString()
    });
  });

  // "Both Stages": pair a specific Action with a specific Impact when they share the exact
  // same stakeholder-group set. Each pairing is its own card, scoped only to those two
  // records' own themes/subthemes — not every Action/Impact that happens to share the set.
  if (stage1 && stage2) {
    const actionsByGroupKey = new Map<string, any[]>();
    actions.forEach((a: any) => {
      const groupIds = (a.stakeholderGroups || []).map((id: any) => id.toString());
      if (groupIds.length === 0) return;
      const key = comboKey(groupIds);
      if (!actionsByGroupKey.has(key)) actionsByGroupKey.set(key, []);
      actionsByGroupKey.get(key)!.push(a);
    });
    impacts.forEach((impact: any) => {
      const groupIds = (impact.stakeholderGroups || []).map((id: any) => id.toString());
      if (groupIds.length === 0) return;
      const matchingActions = actionsByGroupKey.get(comboKey(groupIds));
      if (!matchingActions) return;
      matchingActions.forEach((action: any) => {
        const themes = new Set<string>([
          ...action.themes.map((t: any) => t.toString()),
          ...impact.themes.map((t: any) => t.toString())
        ]);
        const subThemes = new Set<string>([
          ...action.subThemes.map((st: any) => st.toString()),
          ...impact.subThemes.map((st: any) => st.toString())
        ]);
        comboSpecs.push({
          groupIds,
          scope: 'both',
          stageIds: [stage1._id.toString(), stage2._id.toString()],
          themeIds: Array.from(themes),
          subThemeIds: Array.from(subThemes),
          stageSubThemeIds: bothSubThemeIds,
          sourceActionId: action._id.toString(),
          sourceImpactId: impact._id.toString()
        });
      });
    });
  }

  // Was kicked off at the top of the function, in parallel with everything above — computing
  // every combo's count in memory from one fetch, instead of one countDocuments round trip
  // per combo, avoids an N+1 fan-out on projects with many ToC records.
  const publishedQuestions = await publishedQuestionsPromise;

  const frequentTags = new Set(['frequently_asked', 'common', 'standard']);
  const questionCounts = comboSpecs.map(spec => {
    const subThemeSet = new Set(spec.subThemeIds);
    const themeSet = new Set(spec.themeIds);
    const stageSubThemeSet = new Set(spec.stageSubThemeIds);

    return publishedQuestions.reduce((count: number, q: any) => {
      const qSubThemes: string[] = (q.subThemes || []).map((id: any) => id.toString());
      const qTheme = q.theme ? q.theme.toString() : undefined;

      const matchesPrecise = subThemeSet.size > 0 && qSubThemes.some(id => subThemeSet.has(id));
      const matchesThemeFallback = subThemeSet.size === 0 && themeSet.size > 0 &&
        !!qTheme && themeSet.has(qTheme) && qSubThemes.some(id => stageSubThemeSet.has(id));
      const matchesFrequent = (q.tags || []).some((t: string) => frequentTags.has(t)) &&
        qSubThemes.some(id => stageSubThemeSet.has(id));
      const matchesDemographic = !!q.isStandardDemographic;

      return (matchesPrecise || matchesThemeFallback || matchesFrequent || matchesDemographic) ? count + 1 : count;
    }, 0);
  });

  // Existing-survey counts, keyed by the survey's own exact stakeholderGroups combo + stageScope
  // (grouped in application code rather than a $unwind aggregate, which would attribute a
  // multi-group survey to each member group individually instead of to the combo as a whole).
  const projectSurveys = await projectSurveysPromise;
  const surveyCountMap = new Map<string, { count: number; lastCreatedAt: Date }>();
  projectSurveys.forEach((survey: any) => {
    const mapKey = `${comboKey(survey.stakeholderGroups || [])}::${survey.stageScope}`;
    const existing = surveyCountMap.get(mapKey);
    if (existing) {
      existing.count += 1;
      if (survey.createdAt > existing.lastCreatedAt) existing.lastCreatedAt = survey.createdAt;
    } else {
      surveyCountMap.set(mapKey, { count: 1, lastCreatedAt: survey.createdAt });
    }
  });

  const combos: BuilderOverviewCombo[] = comboSpecs.map((spec, idx) => {
    const surveyInfo = surveyCountMap.get(`${comboKey(spec.groupIds)}::${spec.scope}`);
    return {
      stakeholderGroupIds: spec.groupIds,
      stageScope: spec.scope,
      stageIds: spec.stageIds,
      availableQuestions: questionCounts[idx],
      existingSurveys: surveyInfo?.count || 0,
      lastSurveyDate: surveyInfo?.lastCreatedAt ? surveyInfo.lastCreatedAt.toISOString() : null,
      sourceActionId: spec.sourceActionId,
      sourceImpactId: spec.sourceImpactId
    };
  });

  return {
    stakeholderGroups: stakeholderGroups.map((sg: any) => ({
      _id: sg._id,
      name: sg.name,
      description: sg.description,
      category: sg.category,
      themes: sg.themes,
      project: sg.project,
      projectSite: sg.projectSite
    })),
    stages: stages.map((s: any) => ({
      _id: s._id,
      stageNumber: s.stageNumber,
      name: `Stage ${s.stageNumber}`
    })),
    combos
  };
};