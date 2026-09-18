// controllers/sniSurveyResponse.controller.ts
// HTTP surface over services/sni/sniRosterEngine.service.ts. Mutation
// endpoints here are deliberately NOT behind `authorize` — mirrors the
// existing surveyResponse.controller.ts convention (start/answers are public
// so anonymous/enumerator-operated field respondents can use them without a
// platform login; only aggregate/staff views like list/export require auth).
import { Request, Response, NextFunction } from 'express';
import * as rosterEngine from '../services/sni/sniRosterEngine.service';

export const startSniSurveyResponse = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { surveyId } = req.params;
        const { wave, participantCode } = req.body;

        if (!wave || wave < 1) {
            return res.status(400).json({ success: false, error: 'wave (>= 1) is required' });
        }

        const result = await rosterEngine.startSurveyResponse(surveyId, Number(wave), participantCode);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const getNextSniScreen = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { responseId } = req.params;
        const screen = await rosterEngine.getNextScreen(responseId);
        res.status(200).json({ success: true, data: { screen } });
    } catch (error) {
        next(error);
    }
};

export const confirmSniPreloadAlter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { responseId } = req.params;
        const { alterId, wave, stillRelevant } = req.body;
        await rosterEngine.confirmPreloadAlter(alterId, Number(wave), Boolean(stillRelevant));
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const completeSniPreload = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { responseId } = req.params;
        const response = await rosterEngine.completePreload(responseId);
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        next(error);
    }
};

export const submitSniNameGeneratorAnswer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { responseId } = req.params;
        const { questionId, selectedAlterIds = [], newAlters = [] } = req.body;

        const result = await rosterEngine.submitNameGeneratorAnswer({
            surveyResponseId: responseId,
            questionId,
            selectedAlterIds,
            newAlters,
        });
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const submitSniAlterBatteryAnswers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { responseId } = req.params;
        const { alterId, wave, answers = [] } = req.body;

        await rosterEngine.submitAlterBatteryAnswers({
            surveyResponseId: responseId,
            alterId,
            wave: Number(wave),
            answers,
        });
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const submitSniStandardAnswer = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { responseId } = req.params;
        const { questionId, answer } = req.body;

        await rosterEngine.submitStandardAnswer({ surveyResponseId: responseId, questionId, answer });
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

export const completeSniSurveyResponse = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { responseId } = req.params;
        const isComplete = await rosterEngine.completeSurveyResponseIfDone(responseId);
        res.status(200).json({ success: true, data: { isComplete } });
    } catch (error) {
        next(error);
    }
};
