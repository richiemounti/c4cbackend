"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchUploadResponses = exports.getSyncStatus = exports.downloadSurveyPackage = exports.getMobileProjectSurveys = exports.getMobileProfile = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const survey_model_1 = __importDefault(require("../models/survey.model"));
const surveySection_model_1 = __importDefault(require("../models/surveySection.model"));
const surveyQuestion_model_1 = __importDefault(require("../models/surveyQuestion.model"));
const surveyResponse_model_1 = __importDefault(require("../models/surveyResponse.model"));
const questionResponse_model_1 = __importDefault(require("../models/questionResponse.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const organization_model_1 = __importDefault(require("../models/organization.model"));
const authHelpers_1 = require("../lib/authHelpers");
// ─── Helper — resolve accessible project IDs for a user ──────────────────────
// Centralised so every endpoint uses identical access logic.
function getAccessibleProjectIds(user) {
    return __awaiter(this, void 0, void 0, function* () {
        // ConnectGo staff see everything
        if (user.isConnectGoStaff) {
            const ids = yield project_model_1.default.find({ archived: { $ne: true } }).distinct('_id');
            return ids.map(id => id.toString());
        }
        // Managers have access to all projects inside their organisations
        const orgIds = user.roles
            .filter((r) => r.organization)
            .map((r) => r.organization);
        if (user.primaryRole === 'manager' && orgIds.length > 0) {
            const ids = yield project_model_1.default.find({
                organization: { $in: orgIds },
                archived: { $ne: true }
            }).distinct('_id');
            return ids.map(id => id.toString());
        }
        // fieldStaff / fieldAgent / other roles have explicit project assignments
        const assignedProjectIds = user.roles
            .flatMap((r) => r.projects || [])
            .map((id) => id.toString());
        return [...new Set(assignedProjectIds)];
    });
}
// ─── 1. GET /api/v1/mobile/me ─────────────────────────────────────────────────
/**
 * Returns the authenticated user profile together with their organisations
 * and accessible projects, all in one request.  This is the mobile app's
 * first call after login — it seeds the home screen without extra round-trips.
 */
const getMobileProfile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const user = req.user;
        const orgIds = user.roles
            .filter((r) => r.organization)
            .map((r) => r.organization);
        const uniqueOrgIds = [...new Set(orgIds.map((id) => id.toString()))];
        const [organizations, accessibleProjectIds] = yield Promise.all([
            organization_model_1.default.find({
                _id: { $in: uniqueOrgIds },
                archived: { $ne: true }
            }).select('_id name country city'),
            getAccessibleProjectIds(user)
        ]);
        const projects = yield project_model_1.default.find({
            _id: { $in: accessibleProjectIds },
            archived: { $ne: true }
        })
            .select('_id name description location status organization coordinates')
            .populate('organization', 'name country city')
            .sort({ name: 1 });
        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    primaryRole: user.primaryRole,
                    isConnectGoStaff: user.isConnectGoStaff
                },
                organizations,
                projects
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMobileProfile = getMobileProfile;
// ─── 2. GET /api/v1/mobile/projects/:projectId/surveys ───────────────────────
/**
 * Returns all published surveys for a project — lightweight list only
 * (no sections/questions).  Used to populate the survey picker screen
 * before the user decides what to download.
 */
const getMobileProjectSurveys = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        // Use the same helper every other controller uses
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        const project = yield project_model_1.default.findById(projectId).select('_id name location');
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        const surveys = yield survey_model_1.default.find({
            project: projectId,
            status: 'published',
            archived: { $ne: true }
        })
            .populate('projectSite', 'name region city')
            .populate('stakeholderGroup', 'name group')
            .select('_id title description category customCategoryName ' +
            'estimatedDuration totalQuestions updatedAt ' +
            'projectSite stakeholderGroup consentRequired')
            .sort({ updatedAt: -1 });
        res.status(200).json({
            success: true,
            count: surveys.length,
            data: {
                project,
                surveys
            }
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getMobileProjectSurveys = getMobileProjectSurveys;
// ─── 3. GET /api/v1/mobile/surveys/:id/download ──────────────────────────────
/**
 * Returns the COMPLETE survey package in a single response:
 * survey metadata + consent form + all sections + all questions (fully
 * populated).  The device saves this to WatermelonDB so the entire survey
 * is available offline without any further API calls.
 *
 * The `packageVersion` field (= survey.updatedAt) is stored locally and
 * compared against the sync-status endpoint on subsequent opens so the
 * device knows whether a re-download is needed.
 */
const downloadSurveyPackage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { id: surveyId } = req.params;
        const survey = yield survey_model_1.default.findById(surveyId)
            .populate('project', '_id name location coordinates')
            .populate('projectSite', '_id name region city coordinates')
            .populate('stakeholderGroup', '_id name group');
        if (!survey) {
            const error = new Error('Survey not found');
            error.statusCode = 404;
            throw error;
        }
        if (survey.status !== 'published') {
            const error = new Error('Survey is not published');
            error.statusCode = 400;
            throw error;
        }
        const projectId = survey.project._id
            ? survey.project._id.toString()
            : survey.project.toString();
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess) {
            const error = new Error('Not authorized to access this survey');
            error.statusCode = 403;
            throw error;
        }
        // Fetch sections and questions in parallel
        const [sections, surveyQuestions] = yield Promise.all([
            surveySection_model_1.default.find({
                survey: surveyId,
                archived: { $ne: true }
            }).sort('order'),
            surveyQuestion_model_1.default.find({
                survey: surveyId,
                archived: { $ne: true }
            })
                .populate({
                path: 'question',
                select: 'text description type options validation ' +
                    'scaleConfig matrixConfig required ' +
                    'isStandardDemographic demographicType demographicCategory'
            })
                .sort('order')
        ]);
        // Fetch consent form if the survey requires one
        let consentForm = null;
        if (survey.consentForm && survey.consentRequired) {
            const ConsentForm = mongoose_1.default.model('ConsentForm');
            consentForm = yield ConsentForm.findById(survey.consentForm).select('_id name description agreementLabel version ' +
                'defaultLanguage translations');
        }
        res.status(200).json({
            success: true,
            data: {
                survey: {
                    _id: survey._id,
                    title: survey.title,
                    description: survey.description,
                    category: survey.category,
                    customCategoryName: survey.customCategoryName,
                    estimatedDuration: survey.estimatedDuration,
                    totalQuestions: survey.totalQuestions,
                    settings: survey.settings,
                    defaultLanguage: survey.defaultLanguage,
                    availableLanguages: survey.availableLanguages,
                    consentRequired: survey.consentRequired,
                    project: survey.project,
                    projectSite: survey.projectSite,
                    stakeholderGroup: survey.stakeholderGroup,
                    // Device uses this to know whether its cached copy is stale
                    packageVersion: survey.updatedAt
                },
                consentForm,
                sections: sections.map(s => ({
                    _id: s._id,
                    title: s.title,
                    description: s.description,
                    order: s.order
                })),
                questions: surveyQuestions.map(sq => ({
                    _id: sq._id, // SurveyQuestion _id
                    question: sq.question, // fully populated Question document
                    section: sq.section, // SurveySection _id or null
                    order: sq.order,
                    required: sq.required,
                    customText: sq.customText,
                    customDescription: sq.customDescription,
                    customOptions: sq.customOptions,
                    conditionalLogic: sq.conditionalLogic
                }))
            }
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid survey ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.downloadSurveyPackage = downloadSurveyPackage;
// ─── 4. GET /api/v1/mobile/sync/status ───────────────────────────────────────
/**
 * Returns the updatedAt timestamp for every published survey the user can
 * access.  The mobile app calls this on launch and after coming online.
 * It compares each entry against the locally stored `packageVersion` and
 * re-downloads only the surveys that have changed — saving bandwidth on
 * slow field connections.
 */
const getSyncStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const accessibleProjectIds = yield getAccessibleProjectIds(req.user);
        if (accessibleProjectIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                serverTime: new Date()
            });
        }
        const surveys = yield survey_model_1.default.find({
            project: { $in: accessibleProjectIds },
            status: 'published',
            archived: { $ne: true }
        })
            .select('_id title project updatedAt')
            .lean(); // plain objects — no mongoose overhead needed here
        res.status(200).json({
            success: true,
            count: surveys.length,
            // serverTime lets the device handle clock-skew gracefully
            serverTime: new Date(),
            data: surveys.map(s => ({
                surveyId: s._id,
                title: s.title,
                projectId: s.project,
                packageVersion: s.updatedAt // ISO string the device stores
            }))
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSyncStatus = getSyncStatus;
// ─── 5. POST /api/v1/mobile/responses/batch ──────────────────────────────────
/**
 * Accepts an array of complete survey responses collected offline.
 * Each entry includes all answers, GPS coordinates, and device metadata.
 *
 * Per-response idempotency via `clientGeneratedId`:
 *   The device generates a UUID before creating the response locally.
 *   If a response was already uploaded (e.g. the device retried after a
 *   timeout), the server returns success without creating a duplicate.
 *
 * The endpoint returns a result for every item so the device knows
 * exactly which records to mark as 'synced' and which need retrying.
 */
const batchUploadResponses = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        return next(error);
    }
    const { responses } = req.body;
    if (!Array.isArray(responses) || responses.length === 0) {
        const error = new Error('responses array is required and must not be empty');
        error.statusCode = 400;
        return next(error);
    }
    // Guard against absurdly large payloads — 50 responses per batch is plenty
    if (responses.length > 50) {
        const error = new Error('Maximum 50 responses per batch');
        error.statusCode = 400;
        return next(error);
    }
    const results = [];
    for (const responseData of responses) {
        // Each response gets its own transaction so a single bad record
        // doesn't roll back the whole batch
        const session = yield mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const { clientGeneratedId, surveyId, answers = [], gpsCoordinates, respondentInfo, consentGiven, consentFormId, consentFormVersion, startedAt, completedAt, deviceId, appVersion } = responseData;
            // ── Validate required fields ──────────────────────────────────────
            if (!clientGeneratedId) {
                throw Object.assign(new Error('clientGeneratedId is required for each response'), { statusCode: 400 });
            }
            if (!surveyId) {
                throw Object.assign(new Error('surveyId is required for each response'), { statusCode: 400 });
            }
            // ── Idempotency check ─────────────────────────────────────────────
            const existing = yield surveyResponse_model_1.default.findOne({
                'mobileMetadata.clientGeneratedId': clientGeneratedId
            }).session(session);
            if (existing) {
                // Already uploaded — return success without inserting again
                results.push({
                    clientId: clientGeneratedId,
                    success: true,
                    responseId: existing._id.toString()
                });
                yield session.abortTransaction();
                session.endSession();
                continue;
            }
            // ── Verify the survey still exists and is published ───────────────
            const survey = yield survey_model_1.default.findById(surveyId).session(session);
            if (!survey) {
                throw Object.assign(new Error(`Survey ${surveyId} not found`), { statusCode: 404 });
            }
            if (survey.status !== 'published') {
                throw Object.assign(new Error(`Survey ${surveyId} is no longer accepting responses`), { statusCode: 400 });
            }
            // ── Verify the field agent still has access to this project ───────
            const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, survey.project.toString());
            if (!hasAccess) {
                throw Object.assign(new Error(`Not authorized to submit responses for survey ${surveyId}`), { statusCode: 403 });
            }
            // ── Build GPS subdocument ─────────────────────────────────────────
            const gpsDoc = gpsCoordinates
                ? {
                    latitude: gpsCoordinates.latitude,
                    longitude: gpsCoordinates.longitude,
                    accuracy: gpsCoordinates.accuracy,
                    altitude: (_a = gpsCoordinates.altitude) !== null && _a !== void 0 ? _a : null,
                    capturedAt: completedAt ? new Date(completedAt) : new Date(),
                    method: (_b = gpsCoordinates.method) !== null && _b !== void 0 ? _b : 'automatic'
                }
                : {
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    altitude: null,
                    capturedAt: null,
                    method: 'unavailable'
                };
            // ── Create the survey response ────────────────────────────────────
            const surveyResponse = new surveyResponse_model_1.default({
                survey: surveyId,
                respondent: req.user._id,
                respondentInfo: respondentInfo !== null && respondentInfo !== void 0 ? respondentInfo : undefined,
                status: 'completed',
                progress: 100,
                consentGiven: consentGiven !== null && consentGiven !== void 0 ? consentGiven : null,
                consentFormId: consentFormId !== null && consentFormId !== void 0 ? consentFormId : undefined,
                consentFormVersion: consentFormVersion !== null && consentFormVersion !== void 0 ? consentFormVersion : undefined,
                consentTimestamp: consentGiven === true
                    ? (startedAt ? new Date(startedAt) : new Date())
                    : undefined,
                gpsCoordinates: gpsDoc,
                mobileMetadata: {
                    collectedOffline: true,
                    deviceId: deviceId !== null && deviceId !== void 0 ? deviceId : null,
                    appVersion: appVersion !== null && appVersion !== void 0 ? appVersion : null,
                    syncedAt: new Date(),
                    clientGeneratedId
                },
                startedAt: startedAt ? new Date(startedAt) : new Date(),
                completedAt: completedAt ? new Date(completedAt) : new Date(),
                lastActivityAt: new Date()
            });
            yield surveyResponse.save({ session });
            // ── Save all answers ──────────────────────────────────────────────
            if (answers.length > 0) {
                const questionResponseDocs = answers.map(a => {
                    var _a;
                    return ({
                        surveyResponse: surveyResponse._id,
                        surveyQuestion: a.surveyQuestionId,
                        answer: a.answer,
                        metadata: a.metadata
                            ? {
                                timeSpent: a.metadata.timeSpent,
                                skipped: (_a = a.metadata.skipped) !== null && _a !== void 0 ? _a : false,
                                skipReason: a.metadata.skipReason
                            }
                            : undefined
                    });
                });
                yield questionResponse_model_1.default.insertMany(questionResponseDocs, { session });
            }
            yield session.commitTransaction();
            session.endSession();
            results.push({
                clientId: clientGeneratedId,
                success: true,
                responseId: surveyResponse._id.toString()
            });
        }
        catch (err) {
            yield session.abortTransaction();
            session.endSession();
            console.error(`[mobile/batch] Failed to process response ${responseData === null || responseData === void 0 ? void 0 : responseData.clientGeneratedId}:`, err.message);
            results.push({
                clientId: (_c = responseData === null || responseData === void 0 ? void 0 : responseData.clientGeneratedId) !== null && _c !== void 0 ? _c : 'unknown',
                success: false,
                error: (_d = err.message) !== null && _d !== void 0 ? _d : 'Unexpected error'
            });
        }
    }
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    res.status(200).json({
        success: true,
        message: `Processed ${responses.length} responses: ${successCount} succeeded, ${failureCount} failed.`,
        data: {
            results,
            summary: {
                total: responses.length,
                succeeded: successCount,
                failed: failureCount
            }
        }
    });
});
exports.batchUploadResponses = batchUploadResponses;
//# sourceMappingURL=mobile.controller.js.map