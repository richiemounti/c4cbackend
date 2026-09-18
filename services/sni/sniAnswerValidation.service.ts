// services/sni/sniAnswerValidation.service.ts
// Validates a standard (Kind B) question's submitted answer against its
// required/options/validation/scaleConfig/matrixConfig — built fresh for
// SNI. Confirmed the existing platform's submitAnswer (surveyResponse.controller.ts)
// enforces none of this either (no reference to Question.validation/required/
// options/scaleConfig/matrixConfig anywhere in it) — same category of gap as
// the conditional-logic one (SNI_BUILD_PLAN.md §3b), same precedent applied:
// build it correctly for SNI, leave the existing platform's gap untouched.
export interface AnswerValidationResult {
    valid: boolean;
    error?: string;
}

function isEmptyAnswer(answer: any): boolean {
    return answer === undefined || answer === null || answer === ''
        || (Array.isArray(answer) && answer.length === 0);
}

export function validateStandardAnswer(question: any, answer: any): AnswerValidationResult {
    if (question.required && isEmptyAnswer(answer)) {
        return { valid: false, error: 'This question is required' };
    }
    if (isEmptyAnswer(answer)) {
        return { valid: true }; // not required, empty is fine
    }

    const options = (question.options || []) as Array<{ value: string }>;
    const validOptionValues = options.map((o) => o.value);

    switch (question.responseType) {
        case 'radio':
        case 'dropdown': {
            if (!validOptionValues.includes(answer)) {
                return { valid: false, error: 'Answer is not one of the allowed options' };
            }
            break;
        }
        case 'checkbox': {
            const answers = Array.isArray(answer) ? answer : [answer];
            for (const a of answers) {
                if (!validOptionValues.includes(a)) {
                    return { valid: false, error: `"${a}" is not one of the allowed options` };
                }
            }
            break;
        }
        case 'number': {
            const num = Number(answer);
            if (Number.isNaN(num)) return { valid: false, error: 'Answer must be a number' };
            if (question.validation?.min !== undefined && question.validation.min !== null && num < question.validation.min) {
                return { valid: false, error: `Must be at least ${question.validation.min}` };
            }
            if (question.validation?.max !== undefined && question.validation.max !== null && num > question.validation.max) {
                return { valid: false, error: `Must be at most ${question.validation.max}` };
            }
            break;
        }
        case 'scale': {
            const num = Number(answer);
            if (Number.isNaN(num)) return { valid: false, error: 'Answer must be a number' };
            const { min, max } = question.scaleConfig || {};
            if (min !== undefined && min !== null && num < min) return { valid: false, error: 'Answer is below the scale minimum' };
            if (max !== undefined && max !== null && num > max) return { valid: false, error: 'Answer is above the scale maximum' };
            break;
        }
        case 'text':
        case 'textarea': {
            if (question.validation?.pattern) {
                try {
                    const re = new RegExp(question.validation.pattern);
                    if (!re.test(String(answer))) {
                        return { valid: false, error: question.validation.errorMessage || 'Answer does not match the required format' };
                    }
                } catch {
                    // A malformed pattern is an authoring bug, not a respondent error —
                    // don't block submission on it.
                }
            }
            break;
        }
        case 'matrix': {
            if (typeof answer !== 'object' || Array.isArray(answer)) {
                return { valid: false, error: 'Matrix answer must be an object keyed by row' };
            }
            const validColumns = (question.matrixConfig?.columns || []).map((c: any) => c.value);
            for (const cell of Object.values(answer)) {
                const cellValues = Array.isArray(cell) ? cell : [cell];
                for (const v of cellValues) {
                    if (!validColumns.includes(v)) {
                        return { valid: false, error: `"${v}" is not a valid column for this matrix` };
                    }
                }
            }
            break;
        }
        default:
            // date/time/datetime/file/location — no extra shape validation built
            // yet, matching the existing platform's own lack of validation for
            // these types too. Not a gap introduced by SNI.
            break;
    }

    return { valid: true };
}
