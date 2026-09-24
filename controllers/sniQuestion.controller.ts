// controllers/sniQuestion.controller.ts
// Authoring CRUD for SniQuestion. Staff-only. Deliberately thin — the model's
// own pre-validate hook (sniQuestion.model.ts) already enforces the brief's
// "cannot be backfilled" business rules (section-by-role attachment,
// alter_identifier<->name_generator pairing, temporality scoping, conditional-
// logic role restriction), so the controller doesn't re-implement them.
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../middlewares/error.middleware";
import SniQuestion from "../models/sniQuestion.model";

const ASSIGNABLE_FIELDS = [
    'section', 'text', 'description', 'questionRole', 'responseType', 'options',
    'alterIdentifierConfig', 'scaleConfig', 'matrixConfig', 'rwbDimension',
    'isEgoAttribute', 'temporality', 'indicatorLabel', 'conditionalLogic',
    'required', 'validation',
] as const;

export const createSniQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { surveyId } = req.params;
        const payload: Record<string, unknown> = { survey: surveyId, creator: req.user!._id };

        for (const field of ASSIGNABLE_FIELDS) {
            if (req.body[field] !== undefined) payload[field] = req.body[field];
        }

        const question = await SniQuestion.create(payload);
        res.status(201).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};

export const getSniQuestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { surveyId } = req.params;
        const { section, questionRole } = req.query;

        const filter: Record<string, unknown> = { survey: surveyId, archived: false };
        if (section) filter.section = section;
        if (questionRole) filter.questionRole = questionRole;

        const questions = await SniQuestion.find(filter).sort('order');
        res.status(200).json({ success: true, data: questions });
    } catch (error) {
        next(error);
    }
};

export const updateSniQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const question = await SniQuestion.findById(id);
        if (!question) {
            const error = new Error('Question not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        for (const field of ASSIGNABLE_FIELDS) {
            if (req.body[field] !== undefined) (question as any)[field] = req.body[field];
        }
        question.lastUpdatedBy = req.user!._id as any;

        await question.save(); // re-runs the pre-validate business-rule hook
        res.status(200).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};

export const archiveSniQuestion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const question = await SniQuestion.findById(id);
        if (!question) {
            const error = new Error('Question not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }
        question.archived = true;
        question.archivedAt = new Date();
        await question.save();
        res.status(200).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};
