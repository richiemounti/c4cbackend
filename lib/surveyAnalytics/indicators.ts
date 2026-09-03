// lib/surveyAnalytics/indicators.ts
// Groups per-question ChartData into per-indicator scores, ports
// pythonvis/aggregator.py::_aggregate_indicators(). Fans out over
// Question.selectedIndicatorTags (many-to-many) rather than the
// Python dummy schema's single indicator_link.

import { ChartData, FrameworkCategory, FrameworkTagRef, IndicatorSummaryRow } from './chartTypes';
import { determineStatus } from './chartStats';

export interface IndicatorTaggedQuestion {
    indicatorIds: string[];
    selectedSdgTags: FrameworkTagRef[];
    selectedEsgTags: FrameworkTagRef[];
    selectedStandardTags: FrameworkTagRef[];
    selectedResilienceTags: FrameworkTagRef[];
}

function round(value: number, decimals = 1): number {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
}

export function aggregateIndicators(
    charts: ChartData[],
    chartQuestionTags: Map<string, IndicatorTaggedQuestion>,
    indicatorNames: Map<string, string>,
    nTotal: number,
): { indicators: IndicatorSummaryRow[]; frameworksPresent: Set<FrameworkCategory> } {
    const chartsByIndicator = new Map<string, ChartData[]>();
    for (const chart of charts) {
        for (const indicatorId of chart.indicatorIds) {
            const bucket = chartsByIndicator.get(indicatorId) ?? [];
            bucket.push(chart);
            chartsByIndicator.set(indicatorId, bucket);
        }
    }

    const indicators: IndicatorSummaryRow[] = [];
    const frameworksPresent = new Set<FrameworkCategory>();

    for (const [indicatorId, contributingCharts] of chartsByIndicator.entries()) {
        const indicatorName = indicatorNames.get(indicatorId);
        if (!indicatorName) continue;

        const validScores = contributingCharts.map((c) => c.computedValue).filter((v): v is number => v != null);
        const target = contributingCharts.map((c) => c.targetValue).find((v) => v != null) ?? null;

        const aggregatedScore = validScores.length ? round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;
        const status = determineStatus(aggregatedScore, target);
        const delta = aggregatedScore != null && target != null ? round(aggregatedScore - target) : null;

        const frameworkTags: Record<string, string[]> = {};
        for (const chart of contributingCharts) {
            const tags = chartQuestionTags.get(chart.surveyQuestionId);
            if (!tags) continue;
            const addTags = (category: FrameworkCategory, refs: FrameworkTagRef[]) => {
                if (!refs.length) return;
                const existing = frameworkTags[category] ?? [];
                frameworkTags[category] = [...new Set([...existing, ...refs.map((r) => r.name)])];
                frameworksPresent.add(category);
            };
            addTags('sdg', tags.selectedSdgTags);
            addTags('esg', tags.selectedEsgTags);
            addTags('standard', tags.selectedStandardTags);
            addTags('resilience', tags.selectedResilienceTags);
        }

        indicators.push({
            indicatorId,
            indicatorName,
            targetValue: target,
            aggregatedScore,
            status,
            delta,
            nTotal,
            frameworkTags,
        });
    }

    return { indicators, frameworksPresent };
}
