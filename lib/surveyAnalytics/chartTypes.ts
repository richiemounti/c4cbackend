// lib/surveyAnalytics/chartTypes.ts
// Pure TS interfaces for the survey-analytics chart pipeline.
// No Mongoose/Express coupling — mirrors pythonvis/preprocessor.py's dataclasses.

export type QuestionStatus = 'on_track' | 'caution' | 'risk' | 'neutral';

export type ChartType =
    | 'diverging_bar'
    | 'horizontal_bar'
    | 'donut'
    | 'kpi_histogram'
    | 'matrix_bar'
    | 'word_cloud';

export type LikertPosition =
    | 'strong_negative'
    | 'negative'
    | 'mild_negative'
    | 'neutral'
    | 'mild_positive'
    | 'positive'
    | 'strong_positive'
    | 'na';

export interface OptionBar {
    value: string;
    label: string;
    count: number;
    percentage: number; // out of valid respondents, not responses
    color: string;
    rank: number | null; // 1 = most selected
}

export interface LikertSegment {
    label: string;
    count: number;
    percentage: number;
    position: LikertPosition;
    color: string;
    numericValue: number | null;
}

export interface ScaleStats {
    mean: number;
    median: number;
    mode: number;
    stdDev: number;
    topBoxPct: number;
    bottomBoxPct: number;
    netScore: number;
    neutralPct: number;
    naCount: number;
    naPct: number;
    nValid: number;
}

export interface RadioStats {
    modalOptionLabel: string;
    modalOptionPct: number;
    topOptionPct: number;
    validResponseRate: number;
    skippedCount: number;
}

export interface CheckboxStats {
    meanSelections: number;
    validResponseRate: number;
    skippedCount: number;
    topPair: [string, string];
    topPairCount: number;
    topPairPct: number;
    selectionSpread: number;
}

export interface BinBar {
    label: string;
    lo: number;
    hi: number;
    count: number;
}

export interface NumericStats {
    mean: number;
    median: number;
    stdDev: number;
    p25: number;
    p75: number;
    iqr: number;
    minVal: number;
    maxVal: number;
    zeroCount: number;
    zeroPct: number;
    nonzeroMean: number | null;
    validResponseRate: number;
    skippedCount: number;
    skewnessFlag: 'symmetric' | 'right_skewed' | 'left_skewed';
    nValid: number;
}

export interface MatrixRowStats {
    label: string;
    meanScore: number;
    medianScore: number;
    stdDev: number;
    topBoxPct: number;
    completionRate: number;
    optionBars: OptionBar[];
}

export interface TextStats {
    responseCount: number;
    validResponseRate: number;
    skippedCount: number;
    avgLengthWords: number;
    topWords: [string, number][];
    topBigrams: [string, number][];
    sentimentPositive: number;
    sentimentNeutral: number;
    sentimentNegative: number;
    sentimentPositivePct: number;
    sentimentNeutralPct: number;
    sentimentNegativePct: number;
}

export interface FrameworkTagRef {
    id: string;
    name: string;
}

export interface ChartData {
    surveyQuestionId: string;
    questionId: string;
    questionType: string;
    chartType: ChartType;
    questionText: string;
    questionDescription: string;
    indicatorIds: string[];
    insightHeadline: string;
    sectionTheme: string;
    isStandardDemographic: boolean;
    nRespondents: number;
    nAnswered: number;

    optionBars: OptionBar[];
    radioStats: RadioStats | null;
    checkboxStats: CheckboxStats | null;
    likertSegments: LikertSegment[];
    scaleStats: ScaleStats | null;
    scaleBins: BinBar[];
    numericBins: BinBar[];
    numericStats: NumericStats | null;
    matrixRows: MatrixRowStats[];
    textSample: string[];
    textStats: TextStats | null;

    targetValue: number | null;
    computedValue: number | null;
    status: QuestionStatus;
    delta: number | null;
}

export interface AnswerRecord {
    surveyResponseId: string;
    answer: unknown;
}

export interface QuestionOptionLike {
    value: string;
    label: string;
}

export interface ScaleConfigLike {
    min: number;
    max: number;
    step?: number;
    showNAOption?: boolean;
}

export interface MatrixConfigLike {
    rows: { label: string }[];
    columns: { value: string; label: string }[];
}

export interface QuestionLike {
    _id: string;
    text: string;
    description?: string;
    type: string;
    options: QuestionOptionLike[];
    scaleConfig?: ScaleConfigLike | null;
    matrixConfig?: MatrixConfigLike | null;
    isStandardDemographic?: boolean;
    selectedIndicatorTags: FrameworkTagRef[];
    selectedSdgTags: FrameworkTagRef[];
    selectedEsgTags: FrameworkTagRef[];
    selectedStandardTags: FrameworkTagRef[];
    selectedResilienceTags: FrameworkTagRef[];
}

export interface SurveyQuestionLike {
    _id: string;
    targetValue?: number | null;
    scaleDirection?: 'positive_right' | 'positive_left';
    insightHeadline?: string | null;
    sectionTheme: string;
}

export interface IndicatorSummaryRow {
    indicatorId: string;
    indicatorName: string;
    targetValue: number | null;
    aggregatedScore: number | null;
    status: QuestionStatus;
    delta: number | null;
    nTotal: number;
    frameworkTags: Record<string, string[]>; // category -> tag names
}

export type FrameworkCategory = 'sdg' | 'esg' | 'standard' | 'resilience';

export interface FrameworkTagOption {
    category: FrameworkCategory;
    label: string;
}

export interface DemographicFilterOption {
    questionId: string;
    surveyQuestionId: string;
    questionText: string;
    options: QuestionOptionLike[];
}

export interface SectionGroup {
    theme: string;
    charts: ChartData[];
}

export interface ReportMeta {
    title: string;
    projectName: string;
    siteName: string;
    collectionPeriod: string;
    nRespondents: number;
    activeFilterLabel: string;
    isLegacy: boolean;
}

export interface AnalyticsReportPayload {
    meta: ReportMeta;
    executiveSummaryText: string;
    demographicOverview: ChartData[];
    sections: SectionGroup[];
    indicatorSummary: IndicatorSummaryRow[];
    filters: {
        availableDemographics: DemographicFilterOption[];
        availableFrameworks: FrameworkTagOption[];
        applied: {
            demographicQuestionId?: string;
            demographicValue?: string;
            framework?: FrameworkCategory;
        };
    };
}
