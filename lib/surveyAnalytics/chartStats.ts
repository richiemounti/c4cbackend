// lib/surveyAnalytics/chartStats.ts
// Per-question-type statistics, ported from pythonvis/preprocessor.py.
// Pure functions — no Mongoose/Express coupling, easy to unit test.

import {
    AnswerRecord,
    BinBar,
    ChartData,
    ChartType,
    CheckboxStats,
    LikertPosition,
    LikertSegment,
    MatrixRowStats,
    NumericStats,
    OptionBar,
    QuestionLike,
    QuestionOptionLike,
    QuestionStatus,
    RadioStats,
    ScaleStats,
    SurveyQuestionLike,
} from './chartTypes';
import { analyseText } from './textAnalysis';

// Status triad validated for CVD-safe separation via the dataviz skill's
// validate_palette.js (the original pythonvis risk hex read too close to
// caution — ΔE 7.6 for normal vision, below the 15 floor).
export const COLORS = {
    on_track: '#2C6E49',
    caution: '#CD8028',
    risk: '#B3261E',
    neutral: '#6B7280',
    primary: '#272236',
};

const NA_VALUES = new Set(['na', 'n/a', 'not applicable']);
const POSITIVE_POSITIONS = new Set<LikertPosition>(['strong_positive', 'positive', 'mild_positive']);
const NEGATIVE_POSITIONS = new Set<LikertPosition>(['strong_negative', 'negative', 'mild_negative']);

const COLORS_POSITIVE_RIGHT: Record<LikertPosition, string> = {
    strong_positive: COLORS.on_track,
    positive: '#3d9467',
    mild_positive: '#6aab87',
    neutral: COLORS.neutral,
    mild_negative: '#c9a96e',
    negative: COLORS.caution,
    strong_negative: COLORS.risk,
    na: '#c4c4c4',
};
const COLORS_POSITIVE_LEFT: Record<LikertPosition, string> = {
    strong_negative: COLORS.on_track,
    negative: '#3d9467',
    mild_negative: '#6aab87',
    neutral: COLORS.neutral,
    mild_positive: '#c9a96e',
    positive: COLORS.caution,
    strong_positive: COLORS.risk,
    na: '#c4c4c4',
};

function round(value: number, decimals = 1): number {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
}

function mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[]): number {
    if (values.length <= 1) return 0;
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

function percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const n = sortedValues.length;
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, n - 1);
    const frac = idx - lo;
    return round(sortedValues[lo] + frac * (sortedValues[hi] - sortedValues[lo]), 2);
}

function validRate(nAnswered: number, nTotal: number): number {
    return round((nAnswered / Math.max(nTotal, 1)) * 100, 1);
}

export function determineStatus(value: number | null, target: number | null | undefined): QuestionStatus {
    if (target == null || value == null) return 'neutral';
    if (value >= target) return 'on_track';
    if (value >= target * 0.87) return 'caution';
    return 'risk';
}

function statusColor(status: QuestionStatus): string {
    return COLORS[status] ?? COLORS.neutral;
}

export function autoChartType(question: QuestionLike): ChartType {
    switch (question.type) {
        case 'scale':
            return 'diverging_bar';
        case 'radio':
        case 'dropdown':
            return question.options.length <= 3 ? 'donut' : 'horizontal_bar';
        case 'checkbox':
            return 'horizontal_bar';
        case 'number':
            return 'kpi_histogram';
        case 'matrix':
            return 'matrix_bar';
        case 'text':
        case 'textarea':
            return 'word_cloud';
        default:
            return 'horizontal_bar';
    }
}

/** Question types this analytics pipeline knows how to chart. */
export const CHARTABLE_TYPES = new Set(['scale', 'radio', 'dropdown', 'checkbox', 'number', 'matrix', 'text', 'textarea']);

function assignPositions(nOptions: number, _hasNa: boolean): LikertPosition[] {
    if (nOptions <= 2) return (['negative', 'positive'] as LikertPosition[]).slice(0, nOptions);

    const positions: LikertPosition[] = [];
    if (nOptions % 2 === 1) {
        const mid = Math.floor(nOptions / 2);
        for (let i = 0; i < nOptions; i++) {
            const distance = i - mid;
            if (distance === 0) {
                positions.push('neutral');
            } else if (distance < 0) {
                const depth = Math.abs(distance);
                positions.push(depth === mid ? 'strong_negative' : depth >= mid * 0.5 ? 'negative' : 'mild_negative');
            } else {
                const depth = distance;
                positions.push(depth === mid ? 'strong_positive' : depth >= mid * 0.5 ? 'positive' : 'mild_positive');
            }
        }
    } else {
        const half = nOptions / 2;
        for (let i = 0; i < nOptions; i++) {
            if (i < half) {
                const depth = half - i;
                positions.push(depth === half ? 'strong_negative' : depth >= half * 0.5 ? 'negative' : 'mild_negative');
            } else {
                const depth = i - half + 1;
                positions.push(depth === half ? 'strong_positive' : depth >= half * 0.5 ? 'positive' : 'mild_positive');
            }
        }
    }
    return positions;
}

function positionColor(position: LikertPosition, direction: 'positive_right' | 'positive_left'): string {
    const palette = direction === 'positive_right' ? COLORS_POSITIVE_RIGHT : COLORS_POSITIVE_LEFT;
    return palette[position] ?? COLORS.neutral;
}

/** Coerce a Mixed answer value to a comparable string, or null if empty/absent. */
export function answerToString(answer: unknown): string | null {
    if (answer == null) return null;
    if (typeof answer === 'string') return answer.trim() === '' ? null : answer.trim();
    if (typeof answer === 'number' || typeof answer === 'boolean') return String(answer);
    return null;
}

/** Coerce a Mixed answer to a list of selected string values (checkbox). */
export function answerToArray(answer: unknown): string[] {
    if (answer == null) return [];
    if (Array.isArray(answer)) return answer.map((v) => String(v));
    if (typeof answer === 'string') {
        const trimmed = answer.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.map((v) => String(v));
            } catch {
                /* fall through to comma-split */
            }
        }
        return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
    }
    return [];
}

function answerToNumber(answer: unknown): number | null {
    if (answer == null) return null;
    const n = typeof answer === 'number' ? answer : parseFloat(String(answer));
    return Number.isFinite(n) ? n : null;
}

function answerToObject(answer: unknown): Record<string, unknown> | unknown[] | null {
    if (answer == null) return null;
    if (Array.isArray(answer)) return answer;
    if (typeof answer === 'object') return answer as Record<string, unknown>;
    if (typeof answer === 'string') {
        try {
            const parsed = JSON.parse(answer);
            if (Array.isArray(parsed) || typeof parsed === 'object') return parsed;
        } catch {
            /* not JSON */
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────
// RADIO / DROPDOWN
// ─────────────────────────────────────────────────────────────────

function computeRadioStats(
    question: QuestionLike,
    answers: AnswerRecord[],
    nTotal: number,
): { bars: OptionBar[]; stats: RadioStats | null; computed: number | null } {
    const counts = new Map(question.options.map((o) => [o.value, 0]));
    let valid = 0;
    for (const r of answers) {
        const val = answerToString(r.answer);
        if (val != null && counts.has(val)) {
            counts.set(val, (counts.get(val) ?? 0) + 1);
            valid++;
        }
    }
    const skipped = nTotal - valid;
    const denom = valid || 1;

    const bars: OptionBar[] = question.options.map((option) => {
        const count = counts.get(option.value) ?? 0;
        return { value: option.value, label: option.label, count, percentage: round((count / denom) * 100), color: COLORS.primary, rank: null };
    });
    bars.sort((a, b) => b.count - a.count);
    bars.forEach((b, i) => (b.rank = i + 1));

    const modal = bars[0] ?? null;
    const computed = question.options.length > 0 ? round(((counts.get(question.options[0].value) ?? 0) / denom) * 100) : null;

    const stats: RadioStats | null = bars.length
        ? {
              modalOptionLabel: modal?.label ?? '',
              modalOptionPct: modal?.percentage ?? 0,
              topOptionPct: computed ?? 0,
              validResponseRate: validRate(valid, nTotal),
              skippedCount: skipped,
          }
        : null;

    return { bars, stats, computed };
}

// ─────────────────────────────────────────────────────────────────
// CHECKBOX
// ─────────────────────────────────────────────────────────────────

function computeCheckboxStats(
    question: QuestionLike,
    answers: AnswerRecord[],
    nTotal: number,
): { bars: OptionBar[]; stats: CheckboxStats; computed: number | null } {
    const optionCounts = new Map(question.options.map((o) => [o.value, 0]));
    const respondentSelections = new Map<string, string[]>();

    for (const r of answers) {
        const selected = answerToArray(r.answer).filter((v) => optionCounts.has(v));
        if (selected.length) {
            respondentSelections.set(r.surveyResponseId, selected);
            for (const val of selected) optionCounts.set(val, (optionCounts.get(val) ?? 0) + 1);
        }
    }

    const nAnswered = respondentSelections.size;
    const skipped = nTotal - nAnswered;
    const denom = Math.max(nTotal, 1);

    const bars: OptionBar[] = question.options.map((option) => {
        const count = optionCounts.get(option.value) ?? 0;
        return { value: option.value, label: option.label, count, percentage: round((count / denom) * 100), color: COLORS.primary, rank: null };
    });
    bars.sort((a, b) => b.count - a.count);
    bars.forEach((b, i) => (b.rank = i + 1));

    const computed = bars.length ? bars[0].percentage : null;

    const selectionsPerRespondent = [...respondentSelections.values()].map((v) => v.length);
    const meanSelections = selectionsPerRespondent.length ? round(mean(selectionsPerRespondent), 2) : 0;
    const selectionSpread = selectionsPerRespondent.length > 1 ? round(stdDev(selectionsPerRespondent), 2) : 0;

    const optionLabels = new Map(question.options.map((o) => [o.value, o.label]));
    const pairCounts = new Map<string, number>();
    for (const selections of respondentSelections.values()) {
        const sorted = [...selections].sort();
        for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
                const key = `${sorted[i]}|${sorted[j]}`;
                pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
            }
        }
    }

    let topPair: [string, string] = ['', ''];
    let topPairCount = 0;
    let topPairPct = 0;
    if (pairCounts.size > 0) {
        const [key, count] = [...pairCounts.entries()].sort((a, b) => b[1] - a[1])[0];
        const [a, b] = key.split('|');
        topPair = [optionLabels.get(a) ?? a, optionLabels.get(b) ?? b];
        topPairCount = count;
        topPairPct = round((count / denom) * 100);
    }

    return {
        bars,
        stats: {
            meanSelections,
            validResponseRate: validRate(nAnswered, nTotal),
            skippedCount: skipped,
            topPair,
            topPairCount,
            topPairPct,
            selectionSpread,
        },
        computed,
    };
}

// ─────────────────────────────────────────────────────────────────
// SCALE / LIKERT
// ─────────────────────────────────────────────────────────────────

function computeScaleStats(
    question: QuestionLike,
    surveyQuestion: SurveyQuestionLike,
    answers: AnswerRecord[],
): { segments: LikertSegment[]; stats: ScaleStats | null; bins: BinBar[]; computed: number | null } {
    if (!question.options.length) return { segments: [], stats: null, bins: [], computed: null };

    const direction = surveyQuestion.scaleDirection ?? 'positive_right';
    const scaleCfg = question.scaleConfig;
    const showNa = scaleCfg?.showNAOption ?? false;
    const scaleMin = scaleCfg?.min ?? 1;
    const scaleStep = scaleCfg?.step ?? 1;

    const scoreableOptions: QuestionOptionLike[] = [];
    let naOption: QuestionOptionLike | null = null;
    // Plain for-loop (not .forEach) so TS control-flow narrowing tracks
    // naOption's reassignment in the same lexical scope.
    for (let idx = 0; idx < question.options.length; idx++) {
        const opt = question.options[idx];
        if (NA_VALUES.has(opt.value.toLowerCase())) {
            naOption = opt;
        } else if (showNa && idx === question.options.length - 1 && naOption === null) {
            naOption = opt;
        } else {
            scoreableOptions.push(opt);
        }
    }

    const numericValues = scoreableOptions.map((opt, i) => {
        const parsed = parseFloat(opt.value);
        return Number.isFinite(parsed) ? parsed : scaleMin + i * scaleStep;
    });

    const positions = assignPositions(scoreableOptions.length, naOption != null);

    const scoreCounts = new Map(scoreableOptions.map((o) => [o.value, 0]));
    const naValueStr = naOption ? naOption.value : null;
    let naCount = 0;
    let nValid = 0;

    for (const r of answers) {
        const val = answerToString(r.answer);
        if (val == null) continue;
        if (val === naValueStr) {
            naCount++;
        } else if (scoreCounts.has(val)) {
            scoreCounts.set(val, (scoreCounts.get(val) ?? 0) + 1);
            nValid++;
        }
    }

    const totalAnswered = nValid + naCount;
    const denomValid = nValid || 1;

    const segments: LikertSegment[] = scoreableOptions.map((opt, i) => {
        const pos = positions[i];
        const count = scoreCounts.get(opt.value) ?? 0;
        const pct = round((count / denomValid) * 100);
        return { label: opt.label, count, percentage: pct, position: pos, color: positionColor(pos, direction), numericValue: numericValues[i] };
    });

    if (naOption && naCount > 0) {
        segments.push({
            label: naOption.label,
            count: naCount,
            percentage: round((naCount / Math.max(totalAnswered, 1)) * 100),
            position: 'na',
            color: COLORS_POSITIVE_RIGHT.na,
            numericValue: null,
        });
    }

    const rawScores: number[] = [];
    scoreableOptions.forEach((opt, i) => {
        const count = scoreCounts.get(opt.value) ?? 0;
        for (let k = 0; k < count; k++) rawScores.push(numericValues[i]);
    });

    let stats: ScaleStats | null = null;
    let computed: number | null = null;

    if (rawScores.length) {
        const meanScore = round(mean(rawScores), 2);
        const medianScore = round(median(rawScores), 2);
        const std = rawScores.length > 1 ? round(stdDev(rawScores), 2) : 0;

        let modeValueKey = scoreableOptions[0]?.value ?? '';
        let modeCount = -1;
        for (const opt of scoreableOptions) {
            const c = scoreCounts.get(opt.value) ?? 0;
            if (c > modeCount) {
                modeCount = c;
                modeValueKey = opt.value;
            }
        }
        const modeIdx = scoreableOptions.findIndex((o) => o.value === modeValueKey);
        const modeScore = numericValues[modeIdx] ?? 0;

        const topBox = segments.filter((s) => POSITIVE_POSITIONS.has(s.position)).reduce((sum, s) => sum + s.percentage, 0);
        const bottomBox = segments.filter((s) => NEGATIVE_POSITIONS.has(s.position)).reduce((sum, s) => sum + s.percentage, 0);
        const neutralPct = segments.filter((s) => s.position === 'neutral').reduce((sum, s) => sum + s.percentage, 0);
        const netScore = round(topBox - bottomBox);
        const naPct = round((naCount / Math.max(totalAnswered, 1)) * 100);

        stats = {
            mean: meanScore,
            median: medianScore,
            mode: modeScore,
            stdDev: std,
            topBoxPct: round(topBox),
            bottomBoxPct: round(bottomBox),
            netScore,
            neutralPct: round(neutralPct),
            naCount,
            naPct,
            nValid,
        };
        computed = round(topBox);
    }

    const bins: BinBar[] = scoreableOptions.map((opt, i) => ({
        label: opt.label,
        lo: numericValues[i],
        hi: numericValues[i],
        count: scoreCounts.get(opt.value) ?? 0,
    }));

    return { segments, stats, bins, computed };
}

// ─────────────────────────────────────────────────────────────────
// NUMBER
// ─────────────────────────────────────────────────────────────────

function computeNumberStats(
    answers: AnswerRecord[],
    nTotal: number,
): { bins: BinBar[]; stats: NumericStats | null; computed: number | null } {
    const values: number[] = [];
    for (const r of answers) {
        const n = answerToNumber(r.answer);
        if (n != null) values.push(n);
    }
    const skipped = nTotal - values.length;
    if (!values.length) return { bins: [], stats: null, computed: null };

    const sortedValues = [...values].sort((a, b) => a - b);
    const n = values.length;

    const meanVal = round(mean(values), 2);
    const medianVal = round(median(values), 2);
    const stdVal = n > 1 ? round(stdDev(values), 2) : 0;
    const p25 = percentile(sortedValues, 25);
    const p75 = percentile(sortedValues, 75);
    const iqr = round(p75 - p25, 2);

    const zeroCount = values.filter((v) => v === 0).length;
    const nonzero = values.filter((v) => v !== 0);
    const nonzeroMean = nonzero.length ? round(mean(nonzero), 2) : null;

    const spread = stdVal || 1;
    const skewRatio = (meanVal - medianVal) / spread;
    const skewnessFlag = Math.abs(skewRatio) < 0.2 ? 'symmetric' : skewRatio > 0 ? 'right_skewed' : 'left_skewed';

    const nBins = Math.max(5, Math.min(10, 1 + Math.floor(3.322 * Math.log10(n))));
    const loB = sortedValues[0];
    const hiB = sortedValues[n - 1];
    const bw = hiB > loB ? (hiB - loB) / nBins : 1;
    const bins: BinBar[] = [];
    for (let i = 0; i < nBins; i++) {
        const binLo = loB + i * bw;
        const binHi = binLo + bw;
        const count = values.filter((v) => v >= binLo && v < binHi).length;
        bins.push({ label: `${binLo.toFixed(0)}–${binHi.toFixed(0)}`, lo: binLo, hi: binHi, count });
    }
    if (bins.length) bins[bins.length - 1].count += values.filter((v) => v === sortedValues[n - 1]).length;

    const stats: NumericStats = {
        mean: meanVal,
        median: medianVal,
        stdDev: stdVal,
        p25,
        p75,
        iqr,
        minVal: sortedValues[0],
        maxVal: sortedValues[n - 1],
        zeroCount,
        zeroPct: round((zeroCount / n) * 100),
        nonzeroMean,
        validResponseRate: validRate(n, nTotal),
        skippedCount: skipped,
        skewnessFlag,
        nValid: n,
    };

    return { bins, stats, computed: meanVal };
}

// ─────────────────────────────────────────────────────────────────
// MATRIX
// ─────────────────────────────────────────────────────────────────

function computeMatrixStats(question: QuestionLike, answers: AnswerRecord[], nTotal: number): MatrixRowStats[] {
    const cfg = question.matrixConfig;
    if (!cfg || !cfg.rows.length) return [];

    const scaleCfg = question.scaleConfig;
    const scaleMin = scaleCfg?.min ?? 1;
    const scaleMax = scaleCfg?.max ?? 5;
    const scaleStep = scaleCfg?.step ?? 1;
    const scaleVals: number[] = [];
    for (let v = scaleMin; v <= scaleMax; v += scaleStep) scaleVals.push(v);

    const rowLabelToIndex = new Map(cfg.rows.map((row, idx) => [row.label.toLowerCase().replace(/\s+/g, '_'), idx]));
    const rowValues = new Map<number, number[]>(cfg.rows.map((_, i) => [i, []]));

    for (const r of answers) {
        const parsed = answerToObject(r.answer);
        if (parsed == null) continue;

        if (Array.isArray(parsed)) {
            parsed.forEach((val, idx) => {
                if (idx < cfg.rows.length) {
                    const n = answerToNumber(val);
                    if (n != null) rowValues.get(idx)?.push(n);
                }
            });
        } else {
            for (const [key, val] of Object.entries(parsed)) {
                const numericKey = parseInt(key, 10);
                const n = answerToNumber(val);
                if (n == null) continue;
                if (Number.isFinite(numericKey) && rowValues.has(numericKey)) {
                    rowValues.get(numericKey)?.push(n);
                } else {
                    const normKey = key.toLowerCase().replace(/\s+/g, '_');
                    const idx = rowLabelToIndex.get(normKey);
                    if (idx != null) rowValues.get(idx)?.push(n);
                }
            }
        }
    }

    const midpoint = (scaleMin + scaleMax) / 2;

    return cfg.rows.map((row, idx) => {
        const vals = rowValues.get(idx) ?? [];
        const nRow = vals.length;

        const meanScore = nRow ? round(mean(vals), 2) : 0;
        const medianScore = nRow ? round(median(vals), 2) : 0;
        const std = nRow > 1 ? round(stdDev(vals), 2) : 0;
        const topBoxPct = round((vals.filter((v) => v > midpoint).length / Math.max(nRow, 1)) * 100);
        const completionRate = round((nRow / Math.max(nTotal, 1)) * 100);

        const freq = new Map(scaleVals.map((v) => [v, 0]));
        for (const v of vals) {
            const key = scaleVals.find((sv) => sv === v);
            if (key != null) freq.set(key, (freq.get(key) ?? 0) + 1);
        }
        const optionBars: OptionBar[] = scaleVals.map((v, i) => {
            const count = freq.get(v) ?? 0;
            return { value: String(v), label: String(v), count, percentage: round((count / Math.max(nRow, 1)) * 100), color: COLORS.primary, rank: i + 1 };
        });

        return { label: row.label, meanScore, medianScore, stdDev: std, topBoxPct, completionRate, optionBars };
    });
}

// ─────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────

export function computeChartData(
    question: QuestionLike,
    surveyQuestion: SurveyQuestionLike,
    answers: AnswerRecord[],
    nRespondents: number,
): ChartData {
    const chartType = autoChartType(question);
    const qtype = question.type;

    let optionBars: OptionBar[] = [];
    let radioStats: RadioStats | null = null;
    let checkboxStats: CheckboxStats | null = null;
    let likertSegments: LikertSegment[] = [];
    let scaleStats: ScaleStats | null = null;
    let scaleBins: BinBar[] = [];
    let numericBins: BinBar[] = [];
    let numericStats: NumericStats | null = null;
    let matrixRows: MatrixRowStats[] = [];
    let textSample: string[] = [];
    let textStats = null;
    let computed: number | null = null;

    if (qtype === 'scale') {
        const r = computeScaleStats(question, surveyQuestion, answers);
        likertSegments = r.segments;
        scaleStats = r.stats;
        scaleBins = r.bins;
        computed = r.computed;
    } else if (qtype === 'radio' || qtype === 'dropdown') {
        const r = computeRadioStats(question, answers, nRespondents);
        optionBars = r.bars;
        radioStats = r.stats;
        computed = r.computed;
    } else if (qtype === 'checkbox') {
        const r = computeCheckboxStats(question, answers, nRespondents);
        optionBars = r.bars;
        checkboxStats = r.stats;
        computed = r.computed;
    } else if (qtype === 'number') {
        const r = computeNumberStats(answers, nRespondents);
        numericBins = r.bins;
        numericStats = r.stats;
        computed = r.computed;
    } else if (qtype === 'matrix') {
        matrixRows = computeMatrixStats(question, answers, nRespondents);
        if (matrixRows.length) computed = round(mean(matrixRows.map((r) => r.meanScore)), 2);
    } else if (qtype === 'text' || qtype === 'textarea') {
        const responses = answers.map((r) => answerToString(r.answer)).filter((v): v is string => v != null);
        textSample = responses.slice(0, 3);
        textStats = analyseText(responses, nRespondents);
    }

    const status = determineStatus(computed, surveyQuestion.targetValue ?? null);
    const delta = computed != null && surveyQuestion.targetValue != null ? round(computed - surveyQuestion.targetValue) : null;

    if (optionBars.length && surveyQuestion.targetValue != null) {
        const color = statusColor(status);
        optionBars.forEach((b) => (b.color = color));
    }

    return {
        surveyQuestionId: surveyQuestion._id,
        questionId: question._id,
        questionType: qtype,
        chartType,
        questionText: question.text,
        questionDescription: question.description ?? '',
        indicatorIds: question.selectedIndicatorTags.map((t) => t.id),
        insightHeadline: surveyQuestion.insightHeadline ?? '',
        sectionTheme: surveyQuestion.sectionTheme,
        isStandardDemographic: question.isStandardDemographic ?? false,
        nRespondents,
        nAnswered: answers.filter((r) => r.answer != null && r.answer !== '').length,
        optionBars,
        radioStats,
        checkboxStats,
        likertSegments,
        scaleStats,
        scaleBins,
        numericBins,
        numericStats,
        matrixRows,
        textSample,
        textStats,
        targetValue: surveyQuestion.targetValue ?? null,
        computedValue: computed,
        status,
        delta,
    };
}
