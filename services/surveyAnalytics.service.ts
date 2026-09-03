// services/surveyAnalytics.service.ts
// Assembles a full analytics report payload for one or more surveys.
// On-demand computation per request (no precompute-everything, unlike the
// static pythonvis dashboard.html) — batches queries to avoid N+1.

import Survey from '../models/survey.model';
import SurveyQuestion from '../models/surveyQuestion.model';
import SurveyResponse from '../models/surveyResponse.model';
import QuestionResponse from '../models/questionResponse.model';
import { CustomError } from '../middlewares/error.middleware';

import { CHARTABLE_TYPES, answerToArray, answerToString, computeChartData } from '../lib/surveyAnalytics/chartStats';
import { IndicatorTaggedQuestion, aggregateIndicators } from '../lib/surveyAnalytics/indicators';
import { generateExecutiveSummary } from '../lib/surveyAnalytics/narrative';
import {
    AnalyticsReportPayload,
    AnswerRecord,
    ChartData,
    DemographicFilterOption,
    FrameworkCategory,
    FrameworkTagOption,
    FrameworkTagRef,
    QuestionLike,
    SectionGroup,
    SurveyQuestionLike,
} from '../lib/surveyAnalytics/chartTypes';

const FRAMEWORK_LABELS: Record<FrameworkCategory, string> = {
    sdg: 'SDGs',
    esg: 'ESG',
    standard: 'Standards',
    resilience: 'Resilience',
};

export interface GetReportOptions {
    demographicQuestionId?: string;
    demographicValue?: string;
    framework?: FrameworkCategory;
}

function toTagRefs(docs: any[] | undefined): FrameworkTagRef[] {
    return (docs || []).filter(Boolean).map((d: any) => ({ id: String(d._id), name: d.name }));
}

function formatPeriod(survey: any): string {
    const start = survey.settings?.startDate;
    const end = survey.settings?.endDate;
    if (!start && !end) return '';
    const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    return fmt(start || end);
}

export async function getSurveysForProjectAccess(surveyIds: string[]) {
    return Survey.find({ _id: { $in: surveyIds } }).select('project archived').lean();
}

export async function getSurveyAnalyticsReport(surveyIds: string[], options: GetReportOptions): Promise<AnalyticsReportPayload> {
    // Intentionally not filtering on `archived` here — an archived/legacy survey's
    // already-collected responses should still be viewable in the results dashboard,
    // even though it's hidden from the default (non-legacy) survey list.
    const surveys = await Survey.find({ _id: { $in: surveyIds } })
        .populate('project', 'name')
        .lean();

    if (!surveys.length) {
        const error = new Error('No surveys found for the given IDs') as CustomError;
        error.statusCode = 404;
        throw error;
    }

    const surveyQuestions = await SurveyQuestion.find({ survey: { $in: surveyIds }, archived: { $ne: true } })
        .populate('section', 'title')
        .populate({
            path: 'question',
            populate: [
                { path: 'selectedIndicatorTags', select: 'name' },
                { path: 'selectedSdgTags', select: 'name' },
                { path: 'selectedEsgTags', select: 'name' },
                { path: 'selectedStandardTags', select: 'name' },
                { path: 'selectedResilienceTags', select: 'name' },
            ],
        })
        .lean();

    const chartableQuestions = surveyQuestions.filter((sq: any) => sq.question && CHARTABLE_TYPES.has(sq.question.type));

    const allResponses = await SurveyResponse.find({ survey: { $in: surveyIds }, archived: { $ne: true } })
        .select('_id')
        .lean();
    let respondentIds = new Set(allResponses.map((r: any) => String(r._id)));

    let activeFilterLabel = 'All respondents';
    if (options.demographicQuestionId && options.demographicValue) {
        const demoSq: any = chartableQuestions.find((sq: any) => String(sq.question._id) === options.demographicQuestionId);
        if (demoSq) {
            const demoResponses = await QuestionResponse.find({
                surveyQuestion: demoSq._id,
                surveyResponse: { $in: [...respondentIds] },
            })
                .select('surveyResponse answer')
                .lean();

            const matching = new Set<string>();
            for (const qr of demoResponses) {
                const asArray = answerToArray(qr.answer);
                const values = asArray.length ? asArray : [answerToString(qr.answer)].filter((v): v is string => v != null);
                if (values.includes(options.demographicValue)) matching.add(String(qr.surveyResponse));
            }
            respondentIds = matching;

            const option = demoSq.question.options?.find((o: any) => o.value === options.demographicValue);
            activeFilterLabel = option?.label || options.demographicValue;
        }
    }

    const nTotal = respondentIds.size;

    const surveyQuestionIds = chartableQuestions.map((sq: any) => sq._id);
    const allQuestionResponses = await QuestionResponse.find({
        surveyQuestion: { $in: surveyQuestionIds },
        surveyResponse: { $in: [...respondentIds] },
    })
        .select('surveyQuestion surveyResponse answer')
        .lean();

    const answersBySurveyQuestion = new Map<string, AnswerRecord[]>();
    for (const qr of allQuestionResponses) {
        const key = String(qr.surveyQuestion);
        const bucket = answersBySurveyQuestion.get(key) ?? [];
        bucket.push({ surveyResponseId: String(qr.surveyResponse), answer: qr.answer });
        answersBySurveyQuestion.set(key, bucket);
    }

    const charts: ChartData[] = [];
    const chartQuestionTags = new Map<string, IndicatorTaggedQuestion>();
    const indicatorNames = new Map<string, string>();
    const demographicOptionsMap = new Map<string, DemographicFilterOption>();

    for (const sq of chartableQuestions as any[]) {
        const q = sq.question;
        const questionLike: QuestionLike = {
            _id: String(q._id),
            text: q.text,
            description: q.description,
            type: q.type,
            options: (q.options || []).map((o: any) => ({ value: o.value, label: o.label })),
            scaleConfig: q.scaleConfig
                ? { min: q.scaleConfig.min, max: q.scaleConfig.max, step: q.scaleConfig.step, showNAOption: q.scaleConfig.showNAOption }
                : null,
            matrixConfig: q.matrixConfig ? { rows: q.matrixConfig.rows, columns: q.matrixConfig.columns } : null,
            isStandardDemographic: q.isStandardDemographic,
            selectedIndicatorTags: toTagRefs(q.selectedIndicatorTags),
            selectedSdgTags: toTagRefs(q.selectedSdgTags),
            selectedEsgTags: toTagRefs(q.selectedEsgTags),
            selectedStandardTags: toTagRefs(q.selectedStandardTags),
            selectedResilienceTags: toTagRefs(q.selectedResilienceTags),
        };

        const surveyQuestionLike: SurveyQuestionLike = {
            _id: String(sq._id),
            targetValue: sq.targetValue ?? null,
            scaleDirection: sq.scaleDirection ?? 'positive_right',
            insightHeadline: sq.insightHeadline ?? '',
            sectionTheme: sq.section?.title || 'General',
        };

        const answers = answersBySurveyQuestion.get(String(sq._id)) ?? [];
        const chart = computeChartData(questionLike, surveyQuestionLike, answers, nTotal);
        charts.push(chart);

        chartQuestionTags.set(String(sq._id), {
            indicatorIds: questionLike.selectedIndicatorTags.map((t) => t.id),
            selectedSdgTags: questionLike.selectedSdgTags,
            selectedEsgTags: questionLike.selectedEsgTags,
            selectedStandardTags: questionLike.selectedStandardTags,
            selectedResilienceTags: questionLike.selectedResilienceTags,
        });
        for (const tag of questionLike.selectedIndicatorTags) indicatorNames.set(tag.id, tag.name);

        if (questionLike.isStandardDemographic && questionLike.options.length && !demographicOptionsMap.has(questionLike._id)) {
            demographicOptionsMap.set(questionLike._id, {
                questionId: questionLike._id,
                surveyQuestionId: surveyQuestionLike._id,
                questionText: questionLike.text,
                options: questionLike.options,
            });
        }
    }

    const demographicOverview = charts.filter((c) => c.isStandardDemographic);
    const primaryCharts = charts.filter((c) => !c.isStandardDemographic);

    const sectionMap = new Map<string, ChartData[]>();
    for (const chart of primaryCharts) {
        const theme = chart.sectionTheme || 'General';
        const bucket = sectionMap.get(theme) ?? [];
        bucket.push(chart);
        sectionMap.set(theme, bucket);
    }
    const sections: SectionGroup[] = [...sectionMap.entries()].map(([theme, chartsInTheme]) => ({ theme, charts: chartsInTheme }));

    const { indicators, frameworksPresent } = aggregateIndicators(charts, chartQuestionTags, indicatorNames, nTotal);

    const indicatorSummary = options.framework
        ? indicators.filter((ir) => Object.prototype.hasOwnProperty.call(ir.frameworkTags, options.framework as string))
        : indicators;

    const availableFrameworks: FrameworkTagOption[] = [...frameworksPresent]
        .sort()
        .map((category) => ({ category, label: FRAMEWORK_LABELS[category] }));

    const firstSurvey: any = surveys[0];
    const projectName = firstSurvey.project?.name || '';
    const title = surveys.length === 1 ? firstSurvey.title : `${firstSurvey.title} (${surveys.length} surveys)`;
    const collectionPeriod = formatPeriod(firstSurvey);

    const executiveSummaryText = generateExecutiveSummary(projectName, '', nTotal, collectionPeriod, indicatorSummary, charts);

    return {
        meta: {
            title,
            projectName,
            siteName: '',
            collectionPeriod,
            nRespondents: nTotal,
            activeFilterLabel,
            isLegacy: surveys.some((s: any) => s.archived),
        },
        executiveSummaryText,
        demographicOverview,
        sections,
        indicatorSummary,
        filters: {
            availableDemographics: [...demographicOptionsMap.values()],
            availableFrameworks,
            applied: {
                demographicQuestionId: options.demographicQuestionId,
                demographicValue: options.demographicValue,
                framework: options.framework,
            },
        },
    };
}
