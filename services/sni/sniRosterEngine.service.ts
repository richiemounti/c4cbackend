// services/sni/sniRosterEngine.service.ts
// The heart of the SNI build (design brief: "the roster, repeating group,
// piping and cap are the substance of this build" — §3). Implements:
//   - the roster (accumulates alters, dedupes by explicit selection, enforces
//     a configurable cap — §4, §5)
//   - the repeating group (a question battery run once per roster entry,
//     split by temporality — §4.2, §4.5)
//   - piping ([name] substitution — §6)
//   - wave-awareness and roster pre-loading (§4.5, §4.6)
// via one function, getNextScreen, that walks a survey response the same way
// the brief's own respondent-flow diagram does (§7): within each section,
// name generators first, then pending alter-attribute batteries, then
// pending tie-quality batteries, then any ordinary (Kind B) questions —
// before moving to the next section.
import mongoose from 'mongoose';
import SniSurvey from '../../models/sniSurvey.model';
import SniSection from '../../models/sniSection.model';
import SniQuestion from '../../models/sniQuestion.model';
import SniSurveyResponse from '../../models/sniSurveyResponse.model';
import SniAlter from '../../models/sniAlter.model';
import SniAlterTie from '../../models/sniAlterTie.model';
import SniAlterQuestionResponse from '../../models/sniAlterQuestionResponse.model';
import SniQuestionResponse from '../../models/sniQuestionResponse.model';
import { encryptField, encryptOptionalField, decryptField } from '../../utils/sniCrypto';
import { generateParticipantCode } from '../../utils/sniParticipantCode';
import { shouldDisplayQuestion } from './sniConditionalLogic.service';
import { validateStandardAnswer } from './sniAnswerValidation.service';

interface ServiceError extends Error { statusCode?: number; }
function fail(message: string, statusCode = 400): never {
    const err = new Error(message) as ServiceError;
    err.statusCode = statusCode;
    throw err;
}

const PIPING_TOKEN = '[name]';
function applyPiping(text: string, alterName: string): string {
    return text.split(PIPING_TOKEN).join(alterName);
}

interface RosterEntry { id: string; name: string; }

// ─── Starting a wave ────────────────────────────────────────────────────

export async function startSurveyResponse(
    surveyId: string,
    wave: number,
    participantCode?: string,
    options: { bypassStatusCheck?: boolean } = {}
) {
    const survey = await SniSurvey.findById(surveyId);
    if (!survey || survey.archived) fail('Survey not found', 404);
    if (survey.isTemplate) fail('Cannot respond to a template survey directly — activate it for a project first', 400);
    if (!options.bypassStatusCheck && !['published', 'pretest'].includes(survey.status)) {
        fail('Survey is not currently accepting responses', 400);
    }
    if (!survey.project) fail('Survey has no project — malformed state', 500);

    let code = participantCode;
    let isNewParticipant = true;

    if (wave === 1) {
        code = code || generateParticipantCode();
        const collision = await SniSurveyResponse.findOne({ survey: survey._id, participantCode: code });
        if (collision) fail('Generated participant code collided — retry', 409);
    } else {
        if (!code) fail('participantCode is required to start wave 2 or later', 400);
        const priorWave = await SniSurveyResponse.findOne({ survey: survey._id, participantCode: code, wave: { $lt: wave } });
        isNewParticipant = !priorWave;
    }

    const existingForWave = await SniSurveyResponse.findOne({ survey: survey._id, participantCode: code, wave });
    if (existingForWave) fail('This participant has already started this wave', 409);

    const response = await SniSurveyResponse.create({
        survey: survey._id,
        participantCode: code,
        wave,
        status: 'started',
    });

    const preloadRoster = wave > 1
        ? await getPreloadRoster(survey.project.toString(), code as string, wave)
        : [];

    return { response, participantCode: code as string, isNewParticipant, preloadRoster };
}

// ─── Wave pre-loading (brief §4.5) ──────────────────────────────────────
// "For each existing alter they are asked whether that person is still
// someone they turn to, before any new names are captured. This is the only
// way to distinguish 'this tie has ended' from 'I didn't happen to mention
// them this time.'"

export async function getPreloadRoster(project: string, participantCode: string, wave: number): Promise<RosterEntry[]> {
    const alters = await SniAlter.find({
        project,
        participantCode,
        archived: false,
        lastSeenWave: { $lt: wave },
    }).sort('firstWave');

    return alters.map((alter) => ({
        id: (alter._id as mongoose.Types.ObjectId).toString(),
        name: decryptField(alter.encryptedName),
    }));
}

// A "no" answer deliberately does NOT bump lastSeenWave — that's what makes
// the alter derive to tie_state 'dropped' at export time, and what excludes
// it from this wave's selectable roster (see getEligibleRosterForSelection).
export async function confirmPreloadAlter(alterId: string, wave: number, stillRelevant: boolean) {
    if (!stillRelevant) return;
    const alter = await SniAlter.findById(alterId);
    if (!alter) fail('Alter not found', 404);
    if (alter.lastSeenWave < wave) {
        alter.lastSeenWave = wave;
        await alter.save();
    }
}

export async function completePreload(surveyResponseId: string) {
    const response = await SniSurveyResponse.findById(surveyResponseId);
    if (!response) fail('Survey response not found', 404);
    response.preloadCompleted = true;
    await response.save();
    return response;
}

// ─── Roster selection ────────────────────────────────────────────────────
// Only alters "active this wave" (reconfirmed at pre-load, or already named
// earlier this same wave in an earlier section) are offered for selection at
// a name generator — this is what makes the roster shared across sub-themes
// 1-3 within one wave (brief §4.2) while staying wave-scoped.

async function getEligibleRosterForSelection(project: string, participantCode: string, wave: number): Promise<RosterEntry[]> {
    const alters = await SniAlter.find({
        project,
        participantCode,
        archived: false,
        lastSeenWave: wave,
    }).sort('firstWave');

    return alters.map((alter) => ({
        id: (alter._id as mongoose.Types.ObjectId).toString(),
        name: decryptField(alter.encryptedName),
    }));
}

// ─── Name generator (brief §5) ───────────────────────────────────────────

interface NewAlterInput {
    name: string;
    facebookUrl?: string;
    phoneNumber?: string;
}

export async function submitNameGeneratorAnswer(params: {
    surveyResponseId: string;
    questionId: string;
    selectedAlterIds: string[];
    newAlters: NewAlterInput[];
}) {
    const { surveyResponseId, questionId, selectedAlterIds, newAlters } = params;

    const response = await SniSurveyResponse.findById(surveyResponseId);
    if (!response) fail('Survey response not found', 404);

    const question = await SniQuestion.findById(questionId);
    if (!question) fail('Question not found', 404);
    if (question.questionRole !== 'name_generator') fail('Question is not a name generator', 400);
    if (!question.section) fail('Name generator question is missing its section', 500);

    const survey = await SniSurvey.findById(response.survey);
    if (!survey || !survey.project) fail('Survey not found', 404);

    // Cap is enforced across the whole roster (all sub-themes combined, brief
    // §4.3), not per-question or per-section — existing alters always remain
    // selectable even once the cap blocks new ones (brief §5, item 4).
    const currentCount = await SniAlter.countDocuments({
        project: survey.project,
        participantCode: response.participantCode,
        archived: false,
    });
    if (currentCount + newAlters.length > survey.rosterCap) {
        fail(`Roster cap of ${survey.rosterCap} would be exceeded — existing alters remain selectable`, 400);
    }

    // Alter identity is established by selection, not by string matching
    // (brief §5) — no fuzzy/dedup-by-name logic here, ever.
    const createdAlterIds: mongoose.Types.ObjectId[] = [];
    for (const newAlter of newAlters) {
        const alter = await SniAlter.create({
            project: survey.project,
            participantCode: response.participantCode,
            source: 'free_text',
            encryptedName: encryptField(newAlter.name),
            encryptedFacebookUrl: encryptOptionalField(newAlter.facebookUrl),
            encryptedPhoneNumber: encryptOptionalField(newAlter.phoneNumber),
            firstWave: response.wave,
            lastSeenWave: response.wave,
            firstSurveyResponse: response._id,
        });
        createdAlterIds.push(alter._id as mongoose.Types.ObjectId);
    }

    const allAlterIds = [
        ...selectedAlterIds.map((id) => new mongoose.Types.ObjectId(id)),
        ...createdAlterIds,
    ];

    for (const alterId of allAlterIds) {
        // Filter fields (alter/section/wave) populate the inserted doc automatically;
        // $setOnInsert covers the rest. Unique index on {alter,section,wave} makes
        // this idempotent against retries.
        await SniAlterTie.findOneAndUpdate(
            { alter: alterId, section: question.section, wave: response.wave },
            { $setOnInsert: { surveyResponse: response._id, generatorQuestion: question._id } },
            { upsert: true }
        );
        await SniAlter.updateOne(
            { _id: alterId, lastSeenWave: { $lt: response.wave } },
            { $set: { lastSeenWave: response.wave } }
        );
    }

    // Records this name generator as reached-and-answered — including "no one"
    // (both arrays empty), which is a valid, explicit answer (brief §5, item 5),
    // not an unanswered question. Without this, the sequence engine can't tell
    // "not yet reached" apart from "respondent said no one."
    await SniQuestionResponse.findOneAndUpdate(
        { surveyResponse: response._id, question: question._id },
        { $set: { answer: { selectedAlterIds, newAlterIds: createdAlterIds.map(String) } } },
        { upsert: true }
    );

    return { createdAlterIds: createdAlterIds.map(String), tiedAlterIds: allAlterIds.map(String) };
}

// ─── Split battery — alter attribute / tie quality (brief §4.2, §4.5) ────

async function alterQuestionNeedsAnswering(alterId: mongoose.Types.ObjectId, question: any, wave: number): Promise<boolean> {
    // Stable alter_attribute questions: asked once ever, first wave only —
    // check across ALL waves. Everything else (time-varying alter_attribute,
    // and tie_quality — always implicitly time-varying, brief §4.5 table):
    // check this wave only.
    const isStableOnce = question.questionRole === 'alter_attribute' && question.temporality === 'stable';
    const query: Record<string, unknown> = { alter: alterId, question: question._id };
    if (!isStableOnce) query.wave = wave;
    const existing = await SniAlterQuestionResponse.findOne(query);
    return !existing;
}

// Mirrors alterQuestionNeedsAnswering's stable-check, but for ego-level
// questions (isEgoAttribute + temporality:'stable' on a questionRole:'standard'
// question) — "asked once ever" here means once across every wave of THIS
// respondent's own responses, not just this one. Ordinary standard questions
// (isEgoAttribute false, or time_varying) never hit this path — they're
// scoped to the current response only, same as before.
async function stableEgoAttributeAlreadyAnswered(
    question: any,
    surveyId: mongoose.Types.ObjectId,
    participantCode: string,
    currentResponseId: mongoose.Types.ObjectId
): Promise<boolean> {
    const priorResponses = await SniSurveyResponse.find({
        survey: surveyId,
        participantCode,
        _id: { $ne: currentResponseId },
    }).select('_id');
    if (priorResponses.length === 0) return false;

    const existing = await SniQuestionResponse.findOne({
        surveyResponse: { $in: priorResponses.map((r) => r._id) },
        question: question._id,
    });
    return !!existing;
}

function withPipedText<T extends { text: string; toObject: () => any }>(question: T, alterName: string) {
    const plain = question.toObject();
    return { ...plain, text: applyPiping(plain.text, alterName) };
}

export async function getPendingAlterAttributeBattery(alterId: string, surveyId: string, wave: number) {
    const alter = await SniAlter.findById(alterId);
    if (!alter) fail('Alter not found', 404);
    const alterName = decryptField(alter.encryptedName);

    const questions = await SniQuestion.find({ survey: surveyId, questionRole: 'alter_attribute', archived: false }).sort('order');
    const pending = [];
    for (const q of questions) {
        if (await alterQuestionNeedsAnswering(alter._id as mongoose.Types.ObjectId, q, wave)) {
            pending.push(withPipedText(q as any, alterName));
        }
    }
    return pending;
}

export async function getPendingTieQualityBattery(alterId: string, sectionId: string, wave: number) {
    const alter = await SniAlter.findById(alterId);
    if (!alter) fail('Alter not found', 404);
    const alterName = decryptField(alter.encryptedName);

    const questions = await SniQuestion.find({ section: sectionId, questionRole: 'tie_quality', archived: false }).sort('order');
    const pending = [];
    for (const q of questions) {
        if (await alterQuestionNeedsAnswering(alter._id as mongoose.Types.ObjectId, q, wave)) {
            pending.push(withPipedText(q as any, alterName));
        }
    }
    return pending;
}

export async function submitAlterBatteryAnswers(params: {
    surveyResponseId: string;
    alterId: string;
    wave: number;
    answers: Array<{ questionId: string; answer: any }>;
}) {
    const { surveyResponseId, alterId, wave, answers } = params;
    for (const { questionId, answer } of answers) {
        const question = await SniQuestion.findById(questionId);
        if (!question) fail(`Question ${questionId} not found`, 404);
        const validation = validateStandardAnswer(question.toObject(), answer);
        if (!validation.valid) fail(`${questionId}: ${validation.error || 'Invalid answer'}`, 400);

        await SniAlterQuestionResponse.findOneAndUpdate(
            { alter: alterId, question: questionId, wave },
            { $set: { answer, surveyResponse: surveyResponseId } },
            { upsert: true }
        );
    }
}

// ─── Standard (Kind B) questions ─────────────────────────────────────────

export async function submitStandardAnswer(params: { surveyResponseId: string; questionId: string; answer: any }) {
    const { surveyResponseId, questionId, answer } = params;
    const question = await SniQuestion.findById(questionId);
    if (!question) fail('Question not found', 404);
    if (question.questionRole !== 'standard') fail('Question is not a standard question', 400);

    const validation = validateStandardAnswer(question.toObject(), answer);
    if (!validation.valid) fail(validation.error || 'Invalid answer', 400);

    await SniQuestionResponse.findOneAndUpdate(
        { surveyResponse: surveyResponseId, question: questionId },
        { $set: { answer } },
        { upsert: true }
    );
}

// ─── Sequence engine — "what's next" ─────────────────────────────────────
// This is the runtime-generated question sequence the brief describes:
// "the number of question instances is unknown at design time and is
// determined at runtime by what the respondent says" (§2). One call = one
// screen; the caller (controller) re-calls after every submission.

export type SniScreen =
    | { type: 'preload_confirmation'; alters: RosterEntry[] }
    | { type: 'name_generator_question'; question: any; roster: RosterEntry[] }
    | { type: 'standard_question'; question: any }
    | { type: 'alter_attribute_battery'; alter: RosterEntry; questions: any[] }
    | { type: 'tie_quality_battery'; alter: RosterEntry; section: string; questions: any[] };

export async function getNextScreen(surveyResponseId: string): Promise<SniScreen | null> {
    const response = await SniSurveyResponse.findById(surveyResponseId);
    if (!response) fail('Survey response not found', 404);

    const survey = await SniSurvey.findById(response.survey);
    if (!survey || !survey.project) fail('Survey not found', 404);

    if (!response.preloadCompleted) {
        const alters = await getPreloadRoster(survey.project.toString(), response.participantCode, response.wave);
        return { type: 'preload_confirmation', alters };
    }

    const sections = await SniSection.find({ survey: survey._id, archived: false }).sort('order');

    for (const section of sections) {
        const screen = await getNextScreenForSection(response, survey, section);
        if (screen) return screen;
    }

    return null; // survey complete
}

async function getNextScreenForSection(response: any, survey: any, section: any): Promise<SniScreen | null> {
    // 1. Name generators, in order — always first within a section (brief §7).
    const nameGenQuestions = await SniQuestion.find({ section: section._id, questionRole: 'name_generator', archived: false }).sort('order');
    for (const q of nameGenQuestions) {
        const answered = await SniQuestionResponse.findOne({ surveyResponse: response._id, question: q._id });
        if (!answered) {
            const roster = await getEligibleRosterForSelection(survey.project.toString(), response.participantCode, response.wave);
            return { type: 'name_generator_question', question: q, roster };
        }
    }

    // Alters tied to THIS section, THIS wave, THIS response — the order they
    // were named in drives the order their batteries run in.
    const ties = await SniAlterTie.find({ section: section._id, wave: response.wave, surveyResponse: response._id }).sort('createdAt');

    // 2. Alter-attribute batteries (survey-scoped, but only "pending" for
    // alters who came up in this section — see needsAnswering's cross-wave check).
    for (const tie of ties) {
        const pending = await getPendingAlterAttributeBattery(tie.alter.toString(), survey._id.toString(), response.wave);
        if (pending.length > 0) {
            const alter = await SniAlter.findById(tie.alter);
            return {
                type: 'alter_attribute_battery',
                alter: { id: tie.alter.toString(), name: decryptField(alter!.encryptedName) },
                questions: pending,
            };
        }
    }

    // 3. Tie-quality batteries (section-scoped).
    for (const tie of ties) {
        const pending = await getPendingTieQualityBattery(tie.alter.toString(), section._id.toString(), response.wave);
        if (pending.length > 0) {
            const alter = await SniAlter.findById(tie.alter);
            return {
                type: 'tie_quality_battery',
                alter: { id: tie.alter.toString(), name: decryptField(alter!.encryptedName) },
                section: section._id.toString(),
                questions: pending,
            };
        }
    }

    // 4. Ordinary (Kind B) questions — one-level show/hide applies (brief §2-3).
    const standardQuestions = await SniQuestion.find({ section: section._id, questionRole: 'standard', archived: false }).sort('order');
    if (standardQuestions.length > 0) {
        const existingAnswers = await SniQuestionResponse.find({ surveyResponse: response._id });
        const answersByQuestionId = new Map(existingAnswers.map((a) => [a.question.toString(), a.answer]));

        for (const q of standardQuestions) {
            if (answersByQuestionId.has((q._id as mongoose.Types.ObjectId).toString())) continue;

            if ((q as any).isEgoAttribute && q.temporality === 'stable') {
                const alreadyAnswered = await stableEgoAttributeAlreadyAnswered(
                    q, survey._id as mongoose.Types.ObjectId, response.participantCode, response._id as mongoose.Types.ObjectId
                );
                if (alreadyAnswered) continue;
            }

            if (shouldDisplayQuestion(q.conditionalLogic as any, answersByQuestionId)) {
                return { type: 'standard_question', question: q };
            }
        }
    }

    return null; // this section is complete
}

// ─── Completion ───────────────────────────────────────────────────────────

export async function completeSurveyResponseIfDone(surveyResponseId: string): Promise<boolean> {
    const next = await getNextScreen(surveyResponseId);
    if (next !== null) return false;

    const response = await SniSurveyResponse.findById(surveyResponseId);
    if (response && response.status !== 'completed') {
        response.status = 'completed';
        response.completedAt = new Date();
        await response.save();
    }
    return true;
}
