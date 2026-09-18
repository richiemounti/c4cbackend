// controllers/sniSurvey.controller.ts
// Authoring CRUD for SniSurvey. Staff-only throughout — brief §3: "Survey
// build capacity in the Instrument belongs to ConnectGo staff only... Clients
// never see a survey builder for SNI." Route-level gating via
// authorize + isConnectGoStaff() (routes/sniSurvey.routes.ts), mirroring
// theme.routes.ts's identical pattern for the same kind of staff-managed
// global content.
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../middlewares/error.middleware";
import SniSurvey from "../models/sniSurvey.model";
import SniSection from "../models/sniSection.model";
import SniQuestion from "../models/sniQuestion.model";
import Project from "../models/project.model";
import * as rosterEngine from "../services/sni/sniRosterEngine.service";
import { assertOrganizationHasSniAccess } from "../services/sniAccessGating.service";

export const createSniSurvey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, description, isTemplate, project, rosterCap, consentForm, consentRequired, settings } = req.body;

        if (!isTemplate && !project) {
            const error = new Error('project is required unless isTemplate is true') as CustomError;
            error.statusCode = 400;
            throw error;
        }

        const survey = await SniSurvey.create({
            title,
            description,
            isTemplate: !!isTemplate,
            project: isTemplate ? undefined : project,
            rosterCap,
            consentForm,
            consentRequired,
            settings,
            creator: req.user!._id,
        });

        res.status(201).json({ success: true, data: survey });
    } catch (error) {
        next(error);
    }
};

export const getSniSurveys = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { project, isTemplate, status } = req.query;
        const filter: Record<string, unknown> = { archived: { $ne: true } };
        if (project) filter.project = project;
        if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';
        if (status) filter.status = status;

        const surveys = await SniSurvey.find(filter).sort('-createdAt');
        res.status(200).json({ success: true, data: surveys });
    } catch (error) {
        next(error);
    }
};

export const getSniSurvey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const survey = await SniSurvey.findById(req.params.id);
        if (!survey) {
            const error = new Error('Survey not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({ success: true, data: survey });
    } catch (error) {
        next(error);
    }
};

// Survey + ordered sections + ordered questions, all in one call — what the
// authoring UI and the preview runner both actually need (mirrors the
// existing platform's getSurveyStructure for the same reason: the sequence
// can't be sanity-checked by fetching pieces separately, brief §3 "What Kate
// and Belinda need to be able to do").
export const getSniSurveyStructure = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const survey = await SniSurvey.findById(req.params.id);
        if (!survey) {
            const error = new Error('Survey not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        const [sections, questions] = await Promise.all([
            SniSection.find({ survey: survey._id, archived: false }).sort('order'),
            SniQuestion.find({ survey: survey._id, archived: false }).sort('order'),
        ]);

        res.status(200).json({ success: true, data: { survey, sections, questions } });
    } catch (error) {
        next(error);
    }
};

export const updateSniSurvey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, description, status, rosterCap, consentForm, consentRequired, settings } = req.body;

        const survey = await SniSurvey.findById(req.params.id);
        if (!survey) {
            const error = new Error('Survey not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        if (title !== undefined) survey.title = title;
        if (description !== undefined) survey.description = description;
        if (status !== undefined) survey.status = status;
        if (rosterCap !== undefined) survey.rosterCap = rosterCap;
        if (consentForm !== undefined) survey.consentForm = consentForm;
        if (consentRequired !== undefined) survey.consentRequired = consentRequired;
        if (settings !== undefined) Object.assign(survey.settings, settings);
        survey.lastUpdatedBy = req.user!._id as any;

        await survey.save();
        res.status(200).json({ success: true, data: survey });
    } catch (error) {
        next(error);
    }
};

export const archiveSniSurvey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const survey = await SniSurvey.findById(req.params.id);
        if (!survey) {
            const error = new Error('Survey not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }
        survey.archived = true;
        survey.archivedAt = new Date();
        await survey.save();
        res.status(200).json({ success: true, data: survey });
    } catch (error) {
        next(error);
    }
};

// Clones a template's SniSurvey + SniSection + SniQuestion tree into a new
// project-scoped survey (mirrors the existing platform's cloneSurvey pattern).
// This is the "activate a pre-built survey" step of the brief's client
// journey (§3: "create a project -> select the Social Networks Instrument ->
// pay -> activate a pre-built survey -> preview it -> deploy"), which is why
// route auth (routes/sniSurvey.routes.ts) allows real client project-access
// users through, not just staff — the billing gate below is what actually
// protects it now. Staff still bypass the paywall (same pattern as
// assertOrganizationCanCreateProject's bypassPaywall), for support/testing.
export const cloneSniSurveyForProject = async (req: Request, res: Response, next: NextFunction) => {
    const session = await SniSurvey.db.startSession();
    session.startTransaction();

    try {
        const { templateId } = req.params;
        const { project } = req.body;

        if (!project) {
            const error = new Error('project is required') as CustomError;
            error.statusCode = 400;
            throw error;
        }

        const projectDoc = await Project.findById(project).session(session);
        if (!projectDoc) {
            const error = new Error('Project not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        await assertOrganizationHasSniAccess(projectDoc.organization.toString(), {
            bypassPaywall: req.user?.isConnectGoStaff === true,
        });

        const template = await SniSurvey.findById(templateId).session(session);
        if (!template || !template.isTemplate) {
            const error = new Error('Template survey not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        const [clonedSurvey] = await SniSurvey.create([{
            title: template.title,
            description: template.description,
            isTemplate: false,
            templateSource: template._id,
            project,
            status: 'draft',
            rosterCap: template.rosterCap,
            consentForm: template.consentForm,
            consentRequired: template.consentRequired,
            settings: template.settings,
            creator: req.user!._id,
        }], { session });

        const templateSections = await SniSection.find({ survey: template._id, archived: false }).sort('order').session(session);
        const sectionIdMap = new Map<string, any>();

        for (const templateSection of templateSections) {
            const [clonedSection] = await SniSection.create([{
                survey: clonedSurvey._id,
                title: templateSection.title,
                description: templateSection.description,
                order: templateSection.order,
                separatelyAdministered: templateSection.separatelyAdministered,
            }], { session });
            sectionIdMap.set((templateSection._id as any).toString(), clonedSection._id);
        }

        const templateQuestions = await SniQuestion.find({ survey: template._id, archived: false }).sort('order').session(session);
        for (const templateQuestion of templateQuestions) {
            const plain: any = templateQuestion.toObject();
            delete plain._id;
            delete plain.createdAt;
            delete plain.updatedAt;

            await SniQuestion.create([{
                ...plain,
                survey: clonedSurvey._id,
                section: plain.section ? sectionIdMap.get(plain.section.toString()) : null,
                creator: req.user!._id,
                // conditionalLogic.conditions reference SniQuestion IDs from the
                // template, which don't exist on the clone — cross-question
                // conditional logic doesn't survive cloning yet (flagged, not fixed
                // here: mirroring the existing cloneSurvey's own known limitation).
            }], { session });
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ success: true, data: clonedSurvey });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

// Staff-only preview start — bypasses the published/pretest status
// restriction the real respondent-facing `start` endpoint enforces, so
// authors can walk a survey (including roster behaviour) while it's still in
// draft. Brief §3: "Kate and Belinda cannot sanity-check a roster survey by
// reading the question list... without preview they are authoring blind."
// Always marks the response isTestResponse so it never contaminates real data.
export const startSniPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { surveyId } = req.params;
        const wave = Number(req.body.wave) || 1;
        const participantCode = req.body.participantCode;

        const result = await rosterEngine.startSurveyResponse(surveyId, wave, participantCode, { bypassStatusCheck: true });
        result.response.isTestResponse = true;
        await result.response.save();

        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};
