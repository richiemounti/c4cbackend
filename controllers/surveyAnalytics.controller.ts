// controllers/surveyAnalytics.controller.ts
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../middlewares/error.middleware';
import { userHasProjectAccess } from '../lib/authHelpers';
import { getSurveyAnalyticsReport, getSurveysForProjectAccess } from '../services/surveyAnalytics.service';
import { FrameworkCategory } from '../lib/surveyAnalytics/chartTypes';

const VALID_FRAMEWORKS: FrameworkCategory[] = ['sdg', 'esg', 'standard', 'resilience'];

/**
 * @route GET /api/v1/survey-analytics/report
 * @access Private
 */
export const getReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { surveyIds, demographicQuestionId, demographicValue, framework } = req.query;

        if (!surveyIds || typeof surveyIds !== 'string') {
            const error = new Error('surveyIds query parameter is required') as CustomError;
            error.statusCode = 400;
            throw error;
        }

        const ids = surveyIds.split(',').map((id) => id.trim()).filter(Boolean);
        if (!ids.length) {
            const error = new Error('At least one survey ID is required') as CustomError;
            error.statusCode = 400;
            throw error;
        }

        const surveysForAccess = await getSurveysForProjectAccess(ids);
        if (surveysForAccess.length !== ids.length) {
            const error = new Error('One or more surveys were not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        const hasAccess = surveysForAccess.every((s: any) => userHasProjectAccess(req, s.project));
        if (!hasAccess) {
            const error = new Error('Not authorized to access these surveys') as CustomError;
            error.statusCode = 403;
            throw error;
        }

        const frameworkParam = typeof framework === 'string' && VALID_FRAMEWORKS.includes(framework as FrameworkCategory)
            ? (framework as FrameworkCategory)
            : undefined;

        const payload = await getSurveyAnalyticsReport(ids, {
            demographicQuestionId: typeof demographicQuestionId === 'string' ? demographicQuestionId : undefined,
            demographicValue: typeof demographicValue === 'string' ? demographicValue : undefined,
            framework: frameworkParam,
        });

        res.status(200).json({ success: true, data: payload });
    } catch (error: any) {
        if (error.name === 'CastError') {
            error.statusCode = 400;
            error.message = 'Invalid survey ID format';
        }
        next(error);
    }
};
