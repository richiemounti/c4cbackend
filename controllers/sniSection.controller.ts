// controllers/sniSection.controller.ts
// Authoring CRUD for SniSection (sub-themes). Staff-only, same as sniSurvey.controller.ts.
import { Request, Response, NextFunction } from "express";
import { CustomError } from "../middlewares/error.middleware";
import SniSection from "../models/sniSection.model";

export const createSniSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { surveyId } = req.params;
        const { title, description, separatelyAdministered } = req.body;

        const section = await SniSection.create({
            survey: surveyId,
            title,
            description,
            separatelyAdministered: !!separatelyAdministered,
        });

        res.status(201).json({ success: true, data: section });
    } catch (error) {
        next(error);
    }
};

export const getSniSections = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { surveyId } = req.params;
        const sections = await SniSection.find({ survey: surveyId, archived: false }).sort('order');
        res.status(200).json({ success: true, data: sections });
    } catch (error) {
        next(error);
    }
};

export const updateSniSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { title, description, order, separatelyAdministered } = req.body;

        const section = await SniSection.findById(id);
        if (!section) {
            const error = new Error('Section not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }

        if (title !== undefined) section.title = title;
        if (description !== undefined) section.description = description;
        if (order !== undefined) section.order = order;
        if (separatelyAdministered !== undefined) section.separatelyAdministered = separatelyAdministered;

        await section.save();
        res.status(200).json({ success: true, data: section });
    } catch (error) {
        next(error);
    }
};

export const archiveSniSection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const section = await SniSection.findById(id);
        if (!section) {
            const error = new Error('Section not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }
        section.archived = true;
        section.archivedAt = new Date();
        await section.save();
        res.status(200).json({ success: true, data: section });
    } catch (error) {
        next(error);
    }
};
