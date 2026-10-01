// controllers/sniMobile.controller.ts
// SNI's mobile surface, scoped deliberately narrower than the existing
// mobile.controller.ts: that one is a full offline-first design (its own
// comment: "the device saves this to WatermelonDB so the entire survey is
// available offline without any further API calls") built around a STATIC
// question list. SNI's roster engine is the opposite — getNextScreen is
// stateful and server-computed at every step (live roster/tie/wave queries),
// so there is no "download package" that lets a device run the sequence
// fully offline without porting the entire engine client-side.
//
// Decision (Sam, 2026-10-01, no mobile app or spec exists yet to build a
// heavier offline-replication layer against): the mobile app consumes the
// *exact same* `/sni/surveys/:surveyId/responses/*` endpoints as the web
// preview/live flow, live, from its own native UI — this file only adds the
// one genuinely mobile-specific piece, a lightweight "which published SNI
// surveys does this field agent's project have" list (this is also the
// mechanism behind "only published, selected surveys should appear on
// mobile" from the client-activation work). Revisit full offline support
// once a real mobile app and its constraints exist.
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../middlewares/error.middleware";
import Project from "../models/project.model";
import SniSurvey from "../models/sniSurvey.model";
import { userHasProjectAccess } from "../lib/authHelpers";

function isUserAuthenticated(req: Request): boolean {
    return !!req.user;
}

// GET /api/v1/sni/mobile/projects/:projectId/surveys
// Mirrors getMobileProjectSurveys's shape and access check exactly — only
// the model queried differs (SniSurvey, isTemplate:false, project-scoped).
export const getMobileSniProjectSurveys = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required') as CustomError;
            error.statusCode = 401;
            throw error;
        }

        const { projectId } = req.params;

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

        const surveys = await SniSurvey.find({
            project: projectId,
            isTemplate: false,
            status: 'published',
            archived: { $ne: true },
        }).select('_id title description rosterCap consentRequired updatedAt').sort({ updatedAt: -1 });

        res.status(200).json({ success: true, count: surveys.length, data: { project, surveys } });
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project ID format') as CustomError;
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
};
