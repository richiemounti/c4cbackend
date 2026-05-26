// controllers/mobile.controller.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Survey from '../models/survey.model';
import SurveySection from '../models/surveySection.model';
import SurveyQuestion from '../models/surveyQuestion.model';
import SurveyResponse from '../models/surveyResponse.model';
import QuestionResponse from '../models/questionResponse.model';
import Project from '../models/project.model';
import Organization from '../models/organization.model';
import { CustomError } from '../middlewares/error.middleware';
import { isUserAuthenticated, userHasProjectAccess } from '../lib/authHelpers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchAnswer {
    surveyQuestionId: string;
    answer: unknown;
    metadata?: {
        timeSpent?: number;
        skipped?: boolean;
        skipReason?: string;
    };
}

interface BatchResponse {
    clientGeneratedId: string;
    surveyId: string;
    answers: BatchAnswer[];
    gpsCoordinates?: {
        latitude: number;
        longitude: number;
        accuracy: number;
        altitude?: number;
        method?: 'automatic' | 'manual' | 'unavailable';
    } | null;
    respondentInfo?: {
        name?: string;
        email?: string;
        phone?: string;
    };
    consentGiven?: boolean;
    consentFormId?: string;
    consentFormVersion?: string;
    startedAt?: string;
    completedAt?: string;
    deviceId?: string;
    appVersion?: string;
}

interface BatchResult {
    clientId: string;
    success: boolean;
    responseId?: string;
    error?: string;
}

// ─── Helper — resolve accessible project IDs for a user ──────────────────────
// Centralised so every endpoint uses identical access logic.

async function getAccessibleProjectIds(user: any): Promise<string[]> {
    // ConnectGo staff see everything
    if (user.isConnectGoStaff) {
        const ids = await Project.find({ archived: { $ne: true } }).distinct('_id') as unknown[];
        return (ids as mongoose.Types.ObjectId[]).map(id => id.toString());
    }

    // Managers have access to all projects inside their organisations
    const orgIds = user.roles
        .filter((r: any) => r.organization)
        .map((r: any) => r.organization);

    if (user.primaryRole === 'manager' && orgIds.length > 0) {
        const ids = await Project.find({
            organization: { $in: orgIds },
            archived: { $ne: true }
        }).distinct('_id') as unknown[];
        return (ids as mongoose.Types.ObjectId[]).map(id => id.toString());
    }

    // fieldStaff / fieldAgent / other roles have explicit project assignments
    const assignedProjectIds: string[] = user.roles
        .flatMap((r: any) => r.projects || [])
        .map((id: any) => id.toString());

    return [...new Set<string>(assignedProjectIds)];
}

// ─── 1. GET /api/v1/mobile/me ─────────────────────────────────────────────────
/**
 * Returns the authenticated user profile together with their organisations
 * and accessible projects, all in one request.  This is the mobile app's
 * first call after login — it seeds the home screen without extra round-trips.
 */
export const getMobileProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required') as CustomError;
            error.statusCode = 401;
            throw error;
        }
        const user = req.user!;

        const orgIds = user.roles
            .filter((r: any) => r.organization)
            .map((r: any) => r.organization);

        const uniqueOrgIds = [...new Set(orgIds.map((id: any) => id.toString()))];

        const [organizations, accessibleProjectIds] = await Promise.all([
            Organization.find({
                _id: { $in: uniqueOrgIds },
                archived: { $ne: true }
            }).select('_id name country city'),
            getAccessibleProjectIds(user)
        ]);

        const projects = await Project.find({
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
    } catch (error) {
        next(error);
    }
};

// ─── 2. GET /api/v1/mobile/projects/:projectId/surveys ───────────────────────
/**
 * Returns all published surveys for a project — lightweight list only
 * (no sections/questions).  Used to populate the survey picker screen
 * before the user decides what to download.
 */
export const getMobileProjectSurveys = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required') as CustomError;
            error.statusCode = 401;
            throw error;
        }

        const { projectId } = req.params;

        // Use the same helper every other controller uses
        const hasAccess = userHasProjectAccess(req, projectId);
        if (!hasAccess) {
            const error = new Error('Not authorized to access this project') as CustomError;
            error.statusCode = 403;
            throw error;
        }

        const project = await Project.findById(projectId).select('_id name location');
        if (!project) {
            const error = new Error('Project not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        const surveys = await Survey.find({
            project: projectId,
            status: 'published',
            archived: { $ne: true }
        })
            .populate('projectSite', 'name region city')
            .populate('stakeholderGroup', 'name group')
            .select(
                '_id title description category customCategoryName ' +
                'estimatedDuration totalQuestions updatedAt ' +
                'projectSite stakeholderGroup consentRequired'
            )
            .sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            count: surveys.length,
            data: {
                project,
                surveys
            }
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project ID format') as CustomError;
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
};

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
export const downloadSurveyPackage = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required') as CustomError;
            error.statusCode = 401;
            throw error;
        }

        const { id: surveyId } = req.params;

        const survey = await Survey.findById(surveyId)
            .populate('project', '_id name location coordinates')
            .populate('projectSite', '_id name region city coordinates')
            .populate('stakeholderGroup', '_id name group');

        if (!survey) {
            const error = new Error('Survey not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        if (survey.status !== 'published') {
            const error = new Error('Survey is not published') as CustomError;
            error.statusCode = 400;
            throw error;
        }

        const projectId = (survey.project as any)._id
            ? (survey.project as any)._id.toString()
            : survey.project.toString();

        const hasAccess = userHasProjectAccess(req, projectId);
        if (!hasAccess) {
            const error = new Error('Not authorized to access this survey') as CustomError;
            error.statusCode = 403;
            throw error;
        }

        // Fetch sections and questions in parallel
        const [sections, surveyQuestions] = await Promise.all([
            SurveySection.find({
                survey: surveyId,
                archived: { $ne: true }
            }).sort('order'),

            SurveyQuestion.find({
                survey: surveyId,
                archived: { $ne: true }
            })
                .populate({
                    path: 'question',
                    select:
                        'text description type options validation ' +
                        'scaleConfig matrixConfig required ' +
                        'isStandardDemographic demographicType demographicCategory'
                })
                .sort('order')
        ]);

        // Fetch consent form if the survey requires one
        let consentForm = null;
        if (survey.consentForm && survey.consentRequired) {
            const ConsentForm = mongoose.model('ConsentForm');
            consentForm = await ConsentForm.findById(survey.consentForm).select(
                '_id name description agreementLabel version ' +
                'defaultLanguage translations'
            );
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
                    _id: sq._id,                    // SurveyQuestion _id
                    question: sq.question,          // fully populated Question document
                    section: sq.section,            // SurveySection _id or null
                    order: sq.order,
                    required: sq.required,
                    customText: sq.customText,
                    customDescription: sq.customDescription,
                    customOptions: sq.customOptions,
                    conditionalLogic: sq.conditionalLogic
                }))
            }
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid survey ID format') as CustomError;
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
};

// ─── 4. GET /api/v1/mobile/sync/status ───────────────────────────────────────
/**
 * Returns the updatedAt timestamp for every published survey the user can
 * access.  The mobile app calls this on launch and after coming online.
 * It compares each entry against the locally stored `packageVersion` and
 * re-downloads only the surveys that have changed — saving bandwidth on
 * slow field connections.
 */
export const getSyncStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required') as CustomError;
            error.statusCode = 401;
            throw error;
        }

        const accessibleProjectIds = await getAccessibleProjectIds(req.user!);

        if (accessibleProjectIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                serverTime: new Date()
            });
        }

        const surveys = await Survey.find({
            project: { $in: accessibleProjectIds },
            status: 'published',
            archived: { $ne: true }
        })
            .select('_id title project updatedAt')
            .lean();   // plain objects — no mongoose overhead needed here

        res.status(200).json({
            success: true,
            count: surveys.length,
            // serverTime lets the device handle clock-skew gracefully
            serverTime: new Date(),
            data: surveys.map(s => ({
                surveyId: s._id,
                title: s.title,
                projectId: s.project,
                packageVersion: s.updatedAt   // ISO string the device stores
            }))
        });
    } catch (error) {
        next(error);
    }
};

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
export const batchUploadResponses = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!isUserAuthenticated(req)) {
        const error = new Error('Authentication required') as CustomError;
        error.statusCode = 401;
        return next(error);
    }

    const { responses } = req.body as { responses: BatchResponse[] };

    if (!Array.isArray(responses) || responses.length === 0) {
        const error = new Error('responses array is required and must not be empty') as CustomError;
        error.statusCode = 400;
        return next(error);
    }

    // Guard against absurdly large payloads — 50 responses per batch is plenty
    if (responses.length > 50) {
        const error = new Error('Maximum 50 responses per batch') as CustomError;
        error.statusCode = 400;
        return next(error);
    }

    const results: BatchResult[] = [];

    for (const responseData of responses) {
        // Each response gets its own transaction so a single bad record
        // doesn't roll back the whole batch
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const {
                clientGeneratedId,
                surveyId,
                answers = [],
                gpsCoordinates,
                respondentInfo,
                consentGiven,
                consentFormId,
                consentFormVersion,
                startedAt,
                completedAt,
                deviceId,
                appVersion
            } = responseData;

            // ── Validate required fields ──────────────────────────────────────
            if (!clientGeneratedId) {
                throw Object.assign(
                    new Error('clientGeneratedId is required for each response'),
                    { statusCode: 400 }
                );
            }

            if (!surveyId) {
                throw Object.assign(
                    new Error('surveyId is required for each response'),
                    { statusCode: 400 }
                );
            }

            // ── Idempotency check ─────────────────────────────────────────────
            const existing = await SurveyResponse.findOne({
                'mobileMetadata.clientGeneratedId': clientGeneratedId
            }).session(session);

            if (existing) {
                // Already uploaded — return success without inserting again
                results.push({
                    clientId: clientGeneratedId,
                    success: true,
                    responseId: (existing._id as mongoose.Types.ObjectId).toString()
                });
                await session.abortTransaction();
                session.endSession();
                continue;
            }

            // ── Verify the survey still exists and is published ───────────────
            const survey = await Survey.findById(surveyId).session(session);
            if (!survey) {
                throw Object.assign(
                    new Error(`Survey ${surveyId} not found`),
                    { statusCode: 404 }
                );
            }

            if (survey.status !== 'published') {
                throw Object.assign(
                    new Error(`Survey ${surveyId} is no longer accepting responses`),
                    { statusCode: 400 }
                );
            }

            // ── Verify the field agent still has access to this project ───────
            const hasAccess = userHasProjectAccess(req, survey.project.toString());
            if (!hasAccess) {
                throw Object.assign(
                    new Error(`Not authorized to submit responses for survey ${surveyId}`),
                    { statusCode: 403 }
                );
            }

            // ── Build GPS subdocument ─────────────────────────────────────────
            const gpsDoc = gpsCoordinates
                ? {
                    latitude: gpsCoordinates.latitude,
                    longitude: gpsCoordinates.longitude,
                    accuracy: gpsCoordinates.accuracy,
                    altitude: gpsCoordinates.altitude ?? null,
                    capturedAt: completedAt ? new Date(completedAt) : new Date(),
                    method: gpsCoordinates.method ?? 'automatic'
                }
                : {
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    altitude: null,
                    capturedAt: null,
                    method: 'unavailable' as const
                };

            // ── Create the survey response ────────────────────────────────────
            const surveyResponse = new SurveyResponse({
                survey: surveyId,
                respondent: req.user!._id,
                respondentInfo: respondentInfo ?? undefined,
                status: 'completed',
                progress: 100,
                consentGiven: consentGiven ?? null,
                consentFormId: consentFormId ?? undefined,
                consentFormVersion: consentFormVersion ?? undefined,
                consentTimestamp: consentGiven === true
                    ? (startedAt ? new Date(startedAt) : new Date())
                    : undefined,
                gpsCoordinates: gpsDoc,
                mobileMetadata: {
                    collectedOffline: true,
                    deviceId: deviceId ?? null,
                    appVersion: appVersion ?? null,
                    syncedAt: new Date(),
                    clientGeneratedId
                },
                startedAt: startedAt ? new Date(startedAt) : new Date(),
                completedAt: completedAt ? new Date(completedAt) : new Date(),
                lastActivityAt: new Date()
            });

            await surveyResponse.save({ session });

            // ── Save all answers ──────────────────────────────────────────────
            if (answers.length > 0) {
                const questionResponseDocs = answers.map(a => ({
                    surveyResponse: surveyResponse._id,
                    surveyQuestion: a.surveyQuestionId,
                    answer: a.answer,
                    metadata: a.metadata
                        ? {
                            timeSpent: a.metadata.timeSpent,
                            skipped: a.metadata.skipped ?? false,
                            skipReason: a.metadata.skipReason
                        }
                        : undefined
                }));

                await QuestionResponse.insertMany(questionResponseDocs, { session });
            }

            await session.commitTransaction();
            session.endSession();

            results.push({
                clientId: clientGeneratedId,
                success: true,
                responseId: (surveyResponse._id as mongoose.Types.ObjectId).toString()
            });

        } catch (err: any) {
            await session.abortTransaction();
            session.endSession();

            console.error(
                `[mobile/batch] Failed to process response ${responseData?.clientGeneratedId}:`,
                err.message
            );

            results.push({
                clientId: responseData?.clientGeneratedId ?? 'unknown',
                success: false,
                error: err.message ?? 'Unexpected error'
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
};