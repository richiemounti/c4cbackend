// lib/surveyAnalytics/narrative.ts
// Template-based executive-summary narrative generator — no LLM/AI.
// Ports pythonvis/aggregator.py::_generate_executive_summary().

import { ChartData, IndicatorSummaryRow, QuestionStatus } from './chartTypes';

export function generateExecutiveSummary(
    projectName: string,
    groupLabel: string,
    nRespondents: number,
    collectionPeriod: string,
    indicatorResults: IndicatorSummaryRow[],
    charts: ChartData[],
): string {
    const periodStr = collectionPeriod ? ` collected in ${collectionPeriod}` : '';
    const opening = `This report presents findings from ${nRespondents} ${groupLabel || 'respondents'} in the ${projectName || 'project'} programme${periodStr}.`;

    const headlinesByStatus: Record<Extract<QuestionStatus, 'on_track' | 'caution' | 'risk'>, string[]> = {
        on_track: [],
        caution: [],
        risk: [],
    };
    for (const chart of charts) {
        if (chart.insightHeadline && chart.status in headlinesByStatus) {
            headlinesByStatus[chart.status as 'on_track' | 'caution' | 'risk'].push(chart.insightHeadline);
        }
    }
    const body = [...headlinesByStatus.on_track, ...headlinesByStatus.caution, ...headlinesByStatus.risk].join(' ');

    const atRisk = indicatorResults.filter((ir) => ir.status === 'risk');
    const cautious = indicatorResults.filter((ir) => ir.status === 'caution');
    const needsAttention = [...atRisk, ...cautious];

    let closing = '';
    if (needsAttention.length) {
        const names = needsAttention.map((ir) => ir.indicatorName);
        if (names.length === 1) {
            closing = `The area requiring closest attention is ${names[0]}.`;
        } else if (names.length === 2) {
            closing = `The areas requiring closest attention are ${names[0]} and ${names[1]}.`;
        } else {
            const allButLast = names.slice(0, -1).join(', ');
            closing = `Areas requiring closest attention include ${allButLast}, and ${names[names.length - 1]}.`;
        }
    } else {
        const onTrackCount = indicatorResults.filter((ir) => ir.status === 'on_track').length;
        if (onTrackCount > 0) {
            const word = onTrackCount > 1 ? 'indicators are' : 'indicator is';
            closing = `All ${onTrackCount} tracked ${word} on track.`;
        }
    }

    return [opening, body, closing].filter(Boolean).join(' ');
}
