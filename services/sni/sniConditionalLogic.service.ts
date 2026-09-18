// services/sni/sniConditionalLogic.service.ts
// Evaluates SNI's one-level show/hide logic for questionRole 'standard'
// questions (Kind B) — design brief §2: "conditional logic shows or hides a
// question based on an answer; nothing in the roster mechanism is shown or
// hidden on that basis," §3: "one-level show/hide logic" (flat conditions +
// single AND/OR, no nested groups).
//
// Built fresh for SNI: confirmed the equivalent field on the existing
// platform (SurveyQuestion.conditionalLogic) is authored and stored but never
// evaluated anywhere at take-time (see SNI_BUILD_PLAN.md §3b). That gap is
// scoped OUT of this effort per Sam's explicit decision (2026-09-16) — logged
// separately, not fixed here. This evaluator is SNI-only.
import mongoose from 'mongoose';

interface ISniConditionalLogicCondition {
    questionId: mongoose.Types.ObjectId | string;
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan';
    value: any;
}

export interface ISniConditionalLogic {
    enabled: boolean;
    conditions: ISniConditionalLogicCondition[];
    action: 'show' | 'hide';
    logicOperator: 'AND' | 'OR';
}

function evaluateCondition(condition: ISniConditionalLogicCondition, answer: any): boolean {
    const { operator, value } = condition;
    switch (operator) {
        case 'equals':
            return Array.isArray(answer) ? answer.includes(value) : answer === value;
        case 'notEquals':
            return Array.isArray(answer) ? !answer.includes(value) : answer !== value;
        case 'contains':
            if (Array.isArray(answer)) return answer.includes(value);
            if (typeof answer === 'string') return answer.includes(String(value));
            return false;
        case 'notContains':
            if (Array.isArray(answer)) return !answer.includes(value);
            if (typeof answer === 'string') return !answer.includes(String(value));
            return true;
        case 'greaterThan':
            return Number(answer) > Number(value);
        case 'lessThan':
            return Number(answer) < Number(value);
        default:
            return false;
    }
}

/**
 * answersByQuestionId: already-submitted standard-question answers for this
 * survey response, keyed by SniQuestion._id.toString(). A condition whose
 * referenced question hasn't been answered yet evaluates to false (can't be
 * met) rather than throwing — the sequence engine only reaches later
 * questions after earlier ones in the same section are answered, but a
 * condition could in principle reference a question anywhere in the survey.
 */
export function shouldDisplayQuestion(
    conditionalLogic: ISniConditionalLogic | undefined | null,
    answersByQuestionId: Map<string, any>
): boolean {
    if (!conditionalLogic?.enabled || conditionalLogic.conditions.length === 0) {
        return true;
    }

    const results = conditionalLogic.conditions.map((condition) => {
        const answer = answersByQuestionId.get(condition.questionId.toString());
        if (answer === undefined) return false;
        return evaluateCondition(condition, answer);
    });

    const conditionsMet = conditionalLogic.logicOperator === 'OR'
        ? results.some(Boolean)
        : results.every(Boolean);

    return conditionalLogic.action === 'hide' ? !conditionsMet : conditionsMet;
}
