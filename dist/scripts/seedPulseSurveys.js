"use strict";
// scripts/seedPulseSurveys.ts
//
// Seeds pulse survey templates for all active module types.
//
// Usage:
//   npx ts-node scripts/seedPulseSurveys.ts                  → DRY RUN (safe, no writes)
//   npx ts-node scripts/seedPulseSurveys.ts --apply          → write to DB
//   npx ts-node scripts/seedPulseSurveys.ts --only=verify    → verify after applying
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.runSeedPulseSurveys = run;
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("../database/mongodb");
const pulseSurvey_model_1 = __importDefault(require("../models/pulseSurvey.model"));
dotenv_1.default.config();
// ─────────────────────────────────────────────────────────────────────────────
// Shared time-estimate question — appended last on every module
// ─────────────────────────────────────────────────────────────────────────────
const TIME_ESTIMATE_QUESTION = {
    questionText: 'Please estimate how long this module took to complete.',
    questionType: 'rating',
    ratingScale: {
        min: 1,
        max: 5,
        labels: {
            low: 'Less than 30 mins',
            high: 'More than 3 hours',
        },
    },
    isRequired: false,
    order: 5,
};
// ─────────────────────────────────────────────────────────────────────────────
// Per-module question sets
// ─────────────────────────────────────────────────────────────────────────────
const SETUP_QUESTIONS = [
    {
        questionText: 'How would you rate your overall experience completing this module?',
        questionType: 'rating',
        ratingScale: { min: 1, max: 5, labels: { low: 'Poor', high: 'Excellent' } },
        isRequired: true,
        order: 1,
    },
    {
        questionText: 'Was the process easy to understand?',
        questionType: 'yes_no',
        isRequired: true,
        order: 2,
    },
    {
        questionText: 'Which aspect needs the most improvement?',
        questionType: 'multiple_choice',
        options: [
            { value: 'instructions', label: 'Instructions clarity' },
            { value: 'navigation', label: 'Navigation flow' },
            { value: 'design', label: 'Visual design' },
            { value: 'speed', label: 'System speed' },
        ],
        isRequired: false,
        order: 3,
    },
    {
        questionText: 'What did you find most helpful during this setup?',
        questionType: 'text',
        isRequired: false,
        order: 4,
    },
    TIME_ESTIMATE_QUESTION,
];
const TOC_QUESTIONS = [
    {
        questionText: 'How would you rate your overall experience completing this stage?',
        questionType: 'rating',
        ratingScale: { min: 1, max: 5, labels: { low: 'Poor', high: 'Excellent' } },
        isRequired: true,
        order: 1,
    },
    {
        questionText: 'Did the platform provide enough guidance for this stage?',
        questionType: 'yes_no',
        isRequired: true,
        order: 2,
    },
    {
        questionText: 'Which aspect of this stage was most challenging?',
        questionType: 'multiple_choice',
        options: [
            { value: 'understanding_concepts', label: 'Understanding the concepts' },
            { value: 'entering_data', label: 'Entering the data' },
            { value: 'linking_outcomes', label: 'Linking outputs to outcomes' },
            { value: 'evidence', label: 'Providing supporting evidence' },
        ],
        isRequired: false,
        order: 3,
    },
    {
        questionText: 'Any additional comments on this stage?',
        questionType: 'text',
        isRequired: false,
        order: 4,
    },
    TIME_ESTIMATE_QUESTION,
];
const SURVEY_CREATION_QUESTIONS = [
    {
        questionText: 'How would you rate your experience building this survey?',
        questionType: 'rating',
        ratingScale: { min: 1, max: 5, labels: { low: 'Poor', high: 'Excellent' } },
        isRequired: true,
        order: 1,
    },
    {
        questionText: 'Was the survey builder easy to use?',
        questionType: 'yes_no',
        isRequired: true,
        order: 2,
    },
    {
        questionText: 'Which part of the survey builder needs improvement?',
        questionType: 'multiple_choice',
        options: [
            { value: 'question_types', label: 'Available question types' },
            { value: 'section_management', label: 'Section management' },
            { value: 'logic_flow', label: 'Question logic and flow' },
            { value: 'preview', label: 'Survey preview' },
        ],
        isRequired: false,
        order: 3,
    },
    {
        questionText: 'What would make the survey builder more useful for your work?',
        questionType: 'text',
        isRequired: false,
        order: 4,
    },
    TIME_ESTIMATE_QUESTION,
];
const SURVEY_ANALYSIS_QUESTIONS = [
    {
        questionText: 'How useful were the analysis results for your project?',
        questionType: 'rating',
        ratingScale: { min: 1, max: 5, labels: { low: 'Not useful', high: 'Very useful' } },
        isRequired: true,
        order: 1,
    },
    {
        questionText: 'Were the results presented in a clear and understandable way?',
        questionType: 'yes_no',
        isRequired: true,
        order: 2,
    },
    {
        questionText: 'Which area of the analysis needs improvement?',
        questionType: 'multiple_choice',
        options: [
            { value: 'visualisations', label: 'Charts and visualisations' },
            { value: 'filtering', label: 'Filtering and segmentation' },
            { value: 'exports', label: 'Data export options' },
            { value: 'interpretation', label: 'Interpretation guidance' },
        ],
        isRequired: false,
        order: 3,
    },
    {
        questionText: 'Any additional comments on the analysis experience?',
        questionType: 'text',
        isRequired: false,
        order: 4,
    },
    TIME_ESTIMATE_QUESTION,
];
// ─────────────────────────────────────────────────────────────────────────────
// Survey definitions — one entry per enum value in the model
// ─────────────────────────────────────────────────────────────────────────────
const PULSE_SURVEYS = [
    {
        moduleType: 'setup_project',
        title: 'Project Setup — Module Feedback',
        description: 'Help us improve the platform by sharing your experience completing the project setup module.',
        questions: SETUP_QUESTIONS,
    },
    {
        moduleType: 'setup_site',
        title: 'Site Setup — Module Feedback',
        description: 'Help us improve the platform by sharing your experience completing the site setup module.',
        questions: SETUP_QUESTIONS,
    },
    {
        moduleType: 'theory_of_change_stage_1',
        title: 'Theory of Change (Stage 1) — Module Feedback',
        description: 'Help us improve the platform by sharing your experience completing Stage 1 of the Theory of Change.',
        questions: TOC_QUESTIONS,
    },
    {
        moduleType: 'theory_of_change_stage_2',
        title: 'Theory of Change (Stage 2) — Module Feedback',
        description: 'Help us improve the platform by sharing your experience completing Stage 2 of the Theory of Change.',
        questions: TOC_QUESTIONS,
    },
    {
        moduleType: 'survey_creation',
        title: 'Survey Creation — Module Feedback',
        description: 'Help us improve the platform by sharing your experience building this survey.',
        questions: SURVEY_CREATION_QUESTIONS,
    },
    {
        moduleType: 'survey_analysis',
        title: 'Survey Analysis — Module Feedback',
        description: 'Help us improve the platform by sharing your experience reviewing the survey analysis.',
        questions: SURVEY_ANALYSIS_QUESTIONS,
    },
];
// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────
function seedSurveys(dryRun) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n' + '═'.repeat(60));
        console.log('PHASE A — Seed pulse survey templates');
        console.log('═'.repeat(60));
        const mongoose = (yield Promise.resolve().then(() => __importStar(require('mongoose')))).default;
        const systemUserId = process.env.SYSTEM_USER_ID || new mongoose.Types.ObjectId().toHexString();
        for (const surveyDef of PULSE_SURVEYS) {
            const existing = yield pulseSurvey_model_1.default.findOne({ moduleType: surveyDef.moduleType });
            if (existing) {
                console.log(`\n[${surveyDef.moduleType}]  id=${existing._id}  — already exists`);
                if (dryRun) {
                    console.log(`  🔍  Would update title, description and all ${surveyDef.questions.length} questions`);
                }
                else {
                    existing.title = surveyDef.title;
                    existing.description = surveyDef.description;
                    existing.questions.splice(0, existing.questions.length);
                    surveyDef.questions.forEach((q) => existing.questions.push(q));
                    existing.lastUpdatedBy = new mongoose.Types.ObjectId(systemUserId);
                    yield existing.save();
                    console.log(`  ✅  Updated  (${surveyDef.questions.length} questions)`);
                }
            }
            else {
                console.log(`\n[${surveyDef.moduleType}]  — not found, will create`);
                if (dryRun) {
                    console.log(`  🔍  Would create with ${surveyDef.questions.length} questions`);
                }
                else {
                    const created = yield pulseSurvey_model_1.default.create({
                        moduleType: surveyDef.moduleType,
                        title: surveyDef.title,
                        description: surveyDef.description,
                        questions: surveyDef.questions,
                        isActive: true,
                        showToAllUsers: true,
                        creator: new mongoose.Types.ObjectId(systemUserId),
                        lastUpdatedBy: new mongoose.Types.ObjectId(systemUserId),
                    });
                    console.log(`  ✅  Created  id=${created._id}  (${surveyDef.questions.length} questions)`);
                }
            }
        }
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Verify
// ─────────────────────────────────────────────────────────────────────────────
function verifySurveys() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n' + '═'.repeat(60));
        console.log('PHASE B — Verification');
        console.log('═'.repeat(60));
        for (const surveyDef of PULSE_SURVEYS) {
            const survey = yield pulseSurvey_model_1.default.findOne({
                moduleType: surveyDef.moduleType,
                archived: false,
            });
            if (!survey) {
                console.log(`\n  ❌  ${surveyDef.moduleType} — NOT FOUND`);
                continue;
            }
            console.log(`\n[${surveyDef.moduleType}]  id=${survey._id}`);
            const checks = [
                {
                    label: 'isActive is true',
                    pass: survey.isActive === true,
                },
                {
                    label: `question count is ${surveyDef.questions.length}`,
                    pass: survey.questions.length === surveyDef.questions.length,
                    detail: `got ${survey.questions.length}`,
                },
                {
                    label: 'time-estimate question present',
                    pass: survey.questions.some((q) => q.questionText.toLowerCase().includes('how long')),
                },
                {
                    label: 'time-estimate question is not required',
                    pass: (() => {
                        const q = survey.questions.find((q) => q.questionText.toLowerCase().includes('how long'));
                        return q ? q.isRequired === false : false;
                    })(),
                },
                {
                    label: 'rating questions have ratingScale',
                    pass: survey.questions
                        .filter((q) => q.questionType === 'rating')
                        .every((q) => q.ratingScale && q.ratingScale.min !== undefined),
                },
                {
                    label: 'multiple_choice questions have options',
                    pass: survey.questions
                        .filter((q) => q.questionType === 'multiple_choice')
                        .every((q) => Array.isArray(q.options) && q.options.length > 0),
                },
            ];
            for (const { label, pass, detail } of checks) {
                console.log(`  ${pass ? '✅' : '❌'}  ${label}${detail ? `  (${detail})` : ''}`);
            }
        }
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────────────────────
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const args = process.argv.slice(2);
        const dryRun = !args.includes('--apply');
        const only = (_a = args.find((a) => a.startsWith('--only='))) === null || _a === void 0 ? void 0 : _a.split('=')[1];
        console.log('═'.repeat(60));
        console.log('YOUTH IMPACT — SEED PULSE SURVEYS');
        console.log('═'.repeat(60));
        console.log(`Mode  : ${dryRun ? '🔍 DRY RUN  (add --apply to write)' : '⚠️  APPLYING CHANGES'}`);
        console.log(`Scope : ${only !== null && only !== void 0 ? only : 'seed + verify'}`);
        console.log('');
        try {
            yield (0, mongodb_1.connectToDatabase)();
            if (!only || only === 'seed')
                yield seedSurveys(dryRun);
            if (only === 'verify' || (!dryRun && !only))
                yield verifySurveys();
            console.log('\n' + '═'.repeat(60));
            console.log(dryRun ? '🔍 Dry run complete — no writes made.' : '✅ Seed complete.');
            if (dryRun)
                console.log('    Run with --apply to execute.');
            console.log('═'.repeat(60));
        }
        catch (err) {
            console.error('\n❌ Seed failed:', err);
            process.exit(1);
        }
        finally {
            yield (0, mongodb_1.disconnectFromDatabase)();
        }
    });
}
if (require.main === module)
    run();
//# sourceMappingURL=seedPulseSurveys.js.map