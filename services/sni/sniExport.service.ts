// services/sni/sniExport.service.ts
// Builds the three export tables from brief §11 — "the contract between
// Sam's build and this work" (Belinda's R analysis pipeline):
//   - Ego table:  one row per respondent per wave (ego_id, wave, standard/
//     demographic answers)
//   - Alter table: one row per unique alter per respondent per wave (ego_id,
//     alter_id, wave, alter-attribute answers, tie_state)
//   - Tie table:  one row per ego-alter-subtheme-wave (ego_id, alter_id, wave,
//     sub_theme, generator_question_id, tie_others/tie_self/tie_environment)
//
// No names anywhere — alter_id (SniAlter._id) only, per brief §9/§11. This
// function never calls decryptField.
//
// KNOWN GAP, deliberately not fixed here: ego-level (standard/demographic)
// questions have no stable/time-varying concept the way alter_attribute
// questions do — every standard question is re-collected fresh every wave,
// because each wave is its own SniSurveyResponse and the sequence engine has
// no "already answered in an earlier wave, skip" check for questionRole
// 'standard'. Brief §11 says ego characteristics "carry the same stable/
// time-varying split as alter attributes" — that split isn't built. Not
// wrong for export (whatever was recorded that wave is correctly reported),
// just more respondent burden than the brief ultimately wants. A fast-follow
// for whenever wave 2/3 planning starts for real (not a September item).
import SniSurvey from '../../models/sniSurvey.model';
import SniSection from '../../models/sniSection.model';
import SniQuestion from '../../models/sniQuestion.model';
import SniSurveyResponse from '../../models/sniSurveyResponse.model';
import SniAlter from '../../models/sniAlter.model';
import SniAlterTie from '../../models/sniAlterTie.model';
import SniAlterQuestionResponse from '../../models/sniAlterQuestionResponse.model';
import SniQuestionResponse from '../../models/sniQuestionResponse.model';

export interface SniExportTables {
    egoRows: Record<string, any>[];
    alterRows: Record<string, any>[];
    tieRows: Record<string, any>[];
}

function formatAnswer(answer: any): string {
    if (answer === undefined || answer === null) return '';
    if (Array.isArray(answer)) return answer.join('; ');
    if (typeof answer === 'object') return JSON.stringify(answer);
    return String(answer);
}

export async function buildSniExportTables(
    surveyId: string,
    options: { includeTestResponses?: boolean } = {}
): Promise<SniExportTables> {
    const survey = await SniSurvey.findById(surveyId);
    if (!survey) throw new Error('Survey not found');
    if (survey.isTemplate || !survey.project) throw new Error('Cannot export a template survey');

    const responseFilter: Record<string, unknown> = { survey: surveyId, status: 'completed' };
    if (!options.includeTestResponses) responseFilter.isTestResponse = false;

    const responses = await SniSurveyResponse.find(responseFilter).sort({ participantCode: 1, wave: 1 });
    const responseIds = responses.map((r) => r._id);
    const responseById = new Map(responses.map((r) => [(r._id as any).toString(), r]));

    const [standardQuestions, alterAttributeQuestions, tieQualityQuestions, sections] = await Promise.all([
        SniQuestion.find({ survey: surveyId, questionRole: 'standard', archived: false }).sort('order'),
        SniQuestion.find({ survey: surveyId, questionRole: 'alter_attribute', archived: false }).sort('order'),
        SniQuestion.find({ survey: surveyId, questionRole: 'tie_quality', archived: false }).sort('order'),
        SniSection.find({ survey: surveyId, archived: false }),
    ]);
    const sectionById = new Map(sections.map((s) => [(s._id as any).toString(), s]));
    const tieQualityQuestionsBySection = new Map<string, typeof tieQualityQuestions>();
    for (const q of tieQualityQuestions) {
        const key = q.section!.toString();
        if (!tieQualityQuestionsBySection.has(key)) tieQualityQuestionsBySection.set(key, []);
        tieQualityQuestionsBySection.get(key)!.push(q);
    }

    const [standardAnswers, alterQuestionAnswers, ties] = await Promise.all([
        SniQuestionResponse.find({ surveyResponse: { $in: responseIds } }),
        SniAlterQuestionResponse.find({ surveyResponse: { $in: responseIds } }),
        SniAlterTie.find({ surveyResponse: { $in: responseIds } }),
    ]);

    const standardAnswersByResponse = new Map<string, Map<string, any>>();
    for (const a of standardAnswers) {
        const key = a.surveyResponse.toString();
        if (!standardAnswersByResponse.has(key)) standardAnswersByResponse.set(key, new Map());
        standardAnswersByResponse.get(key)!.set(a.question.toString(), a.answer);
    }

    // Generic {alter, question, wave} -> answer, covers both alter_attribute
    // and tie_quality rows since SniAlterQuestionResponse is shared between them.
    const alterAnswersByWaveKey = new Map<string, any>();
    // {alter, question} -> answer at whichever wave it was actually recorded —
    // for stable alter_attribute questions, only ever answered once (firstWave).
    const alterAnswersStable = new Map<string, any>();
    for (const a of alterQuestionAnswers) {
        const alterId = a.alter.toString();
        const questionId = a.question.toString();
        alterAnswersByWaveKey.set(`${alterId}:${questionId}:${a.wave}`, a.answer);
        if (!alterAnswersStable.has(`${alterId}:${questionId}`)) {
            alterAnswersStable.set(`${alterId}:${questionId}`, a.answer);
        }
    }

    const participantCodes = Array.from(new Set(responses.map((r) => r.participantCode)));
    const alters = await SniAlter.find({ project: survey.project, participantCode: { $in: participantCodes }, archived: false });
    const altersByParticipant = new Map<string, typeof alters>();
    for (const alter of alters) {
        if (!altersByParticipant.has(alter.participantCode)) altersByParticipant.set(alter.participantCode, []);
        altersByParticipant.get(alter.participantCode)!.push(alter);
    }

    // ─── Ego table ───
    const egoRows: Record<string, any>[] = [];
    for (const response of responses) {
        const row: Record<string, any> = { ego_id: response.participantCode, wave: response.wave };
        const answers = standardAnswersByResponse.get((response._id as any).toString()) || new Map();
        for (const q of standardQuestions) {
            row[q.text] = formatAnswer(answers.get((q._id as any).toString()));
        }
        egoRows.push(row);
    }

    // ─── Alter table ───
    const alterRows: Record<string, any>[] = [];
    for (const response of responses) {
        const respondentAlters = altersByParticipant.get(response.participantCode) || [];
        for (const alter of respondentAlters) {
            if (alter.firstWave > response.wave) continue; // didn't exist yet at this wave

            const tieState = alter.firstWave === response.wave
                ? 'new'
                : (alter.lastSeenWave === response.wave ? 'retained' : 'dropped');

            const alterId = (alter._id as any).toString();
            const row: Record<string, any> = {
                ego_id: response.participantCode,
                alter_id: alterId,
                wave: response.wave,
                tie_state: tieState,
            };
            for (const q of alterAttributeQuestions) {
                const questionId = (q._id as any).toString();
                const answer = q.temporality === 'stable'
                    ? alterAnswersStable.get(`${alterId}:${questionId}`)
                    : alterAnswersByWaveKey.get(`${alterId}:${questionId}:${response.wave}`);
                row[q.text] = formatAnswer(answer);
            }
            alterRows.push(row);
        }
    }

    // ─── Tie table (edge list) ───
    const tieRows: Record<string, any>[] = [];
    for (const tie of ties) {
        const response = responseById.get(tie.surveyResponse.toString());
        if (!response) continue; // filtered out (e.g. test response excluded)

        const section = sectionById.get(tie.section.toString());
        const alterId = tie.alter.toString();
        const row: Record<string, any> = {
            ego_id: response.participantCode,
            alter_id: alterId,
            wave: tie.wave,
            sub_theme: section?.title || tie.section.toString(),
            generator_question_id: tie.generatorQuestion.toString(),
            tie_others: '',
            tie_self: '',
            tie_environment: '',
        };

        const dimensionQuestions = tieQualityQuestionsBySection.get(tie.section.toString()) || [];
        for (const q of dimensionQuestions) {
            const answer = alterAnswersByWaveKey.get(`${alterId}:${(q._id as any).toString()}:${tie.wave}`);
            const formatted = formatAnswer(answer);
            if (q.rwbDimension === 'others') row.tie_others = formatted;
            else if (q.rwbDimension === 'self') row.tie_self = formatted;
            else if (q.rwbDimension === 'environment') row.tie_environment = formatted;
            else row[`tie_${q.text}`] = formatted; // no RWB dimension tagged — generic fallback column
        }

        tieRows.push(row);
    }

    return { egoRows, alterRows, tieRows };
}
