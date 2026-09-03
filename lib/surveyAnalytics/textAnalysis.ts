// lib/surveyAnalytics/textAnalysis.ts
// Lightweight keyword-based word-frequency, bigram, and sentiment analysis.
// No ML/NLP dependency by design — ports pythonvis/preprocessor.py's heuristic.

import { TextStats } from './chartTypes';

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
    'i', 'my', 'we', 'our', 'you', 'your', 'they', 'their', 'it', 'its', 'this', 'that',
    'these', 'those', 'not', 'no', 'so', 'if', 'as', 'by', 'from', 'up', 'out', 'about',
    'into', 'through', 'during', 'before', 'after', 'than', 'also', 'just', 'more',
    'very', 'too', 'how', 'what', 'when', 'where', 'which', 'who', 'there', 'here',
    'some', 'any', 'all', 'both', 'each', 'few', 'most', 'other', 'such', 'same', 'own',
]);

const POSITIVE_WORDS = new Set([
    'improved', 'improvement', 'better', 'good', 'great', 'excellent', 'positive',
    'increase', 'increased', 'benefit', 'benefits', 'helpful', 'help', 'support',
    'supported', 'happy', 'satisfied', 'accessible', 'access', 'opportunity',
    'opportunities', 'successful', 'success', 'effective', 'strong', 'stable',
    'reliable', 'trust', 'fair', 'fairness', 'transparent', 'inclusive', 'together',
    'community', 'clean', 'safe', 'protected', 'protect', 'sustainable', 'grow',
    'growth', 'training', 'learn', 'learned', 'appreciate', 'valued', 'glad',
    'hopeful', 'progress', 'forward', 'thank', 'grateful',
]);

const NEGATIVE_WORDS = new Set([
    'worse', 'bad', 'poor', 'difficult', 'problem', 'problems', 'issue', 'issues',
    'concern', 'concerns', 'challenge', 'challenges', 'lack', 'lacking', 'limited',
    'absent', 'not', 'no', 'never', 'failed', 'failure', 'lost', 'loss', 'reduced',
    'decrease', 'decreased', 'unfair', 'unequal', 'excluded', 'ignored', 'conflict',
    'dispute', 'corrupt', 'unclear', 'confused', 'late', 'slow', 'insufficient',
    'inadequate', 'disappointed', 'unhappy', 'worried', 'fear', 'hard', 'struggle',
    'damaged', 'destroyed', 'degraded', 'polluted', 'scarce', 'shortage', 'barrier',
    'obstacle', 'complain', 'complaint', 'delay', 'neglect',
]);

function tokenize(text: string): string[] {
    const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
    return words
        .map((w) => w.replace(/^'+|'+$/g, ''))
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function topN<T>(counts: Map<T, number>, n: number): [T, number][] {
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function analyseText(responses: string[], nTotal: number): TextStats {
    const validResponses = responses.map((r) => r.trim()).filter((r) => r.length > 0);
    const skipped = nTotal - validResponses.length;

    if (validResponses.length === 0) {
        return {
            responseCount: 0,
            validResponseRate: 0,
            skippedCount: skipped,
            avgLengthWords: 0,
            topWords: [],
            topBigrams: [],
            sentimentPositive: 0,
            sentimentNeutral: 0,
            sentimentNegative: 0,
            sentimentPositivePct: 0,
            sentimentNeutralPct: 0,
            sentimentNegativePct: 0,
        };
    }

    const allTokens: string[] = [];
    const wordCounts: number[] = [];
    for (const resp of validResponses) {
        const tokens = tokenize(resp);
        allTokens.push(...tokens);
        wordCounts.push(tokens.length);
    }

    const avgWords = Math.round(mean(wordCounts) * 10) / 10;

    const wordFreq = new Map<string, number>();
    for (const t of allTokens) wordFreq.set(t, (wordFreq.get(t) ?? 0) + 1);
    const topWords = topN(wordFreq, 20);

    const bigramFreq = new Map<string, number>();
    for (const resp of validResponses) {
        const tokens = tokenize(resp);
        for (let i = 0; i < tokens.length - 1; i++) {
            const bigram = `${tokens[i]} ${tokens[i + 1]}`;
            bigramFreq.set(bigram, (bigramFreq.get(bigram) ?? 0) + 1);
        }
    }
    const topBigrams = topN(bigramFreq, 15);

    let positiveCount = 0;
    let negativeCount = 0;
    for (const resp of validResponses) {
        const wordsInResp = new Set((resp.toLowerCase().match(/[a-z]+/g) ?? []));
        let positiveHits = 0;
        let negativeHits = 0;
        for (const w of wordsInResp) {
            if (POSITIVE_WORDS.has(w)) positiveHits++;
            if (NEGATIVE_WORDS.has(w)) negativeHits++;
        }
        if (positiveHits > negativeHits) positiveCount++;
        else if (negativeHits > positiveHits) negativeCount++;
    }

    const neutralCount = validResponses.length - positiveCount - negativeCount;
    const total = validResponses.length;

    return {
        responseCount: total,
        validResponseRate: Math.round((total / Math.max(nTotal, 1)) * 1000) / 10,
        skippedCount: skipped,
        avgLengthWords: avgWords,
        topWords,
        topBigrams,
        sentimentPositive: positiveCount,
        sentimentNeutral: neutralCount,
        sentimentNegative: negativeCount,
        sentimentPositivePct: Math.round((positiveCount / total) * 1000) / 10,
        sentimentNeutralPct: Math.round((neutralCount / total) * 1000) / 10,
        sentimentNegativePct: Math.round((negativeCount / total) * 1000) / 10,
    };
}
