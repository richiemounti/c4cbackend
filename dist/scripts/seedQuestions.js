"use strict";
// scripts/seedQuestions.ts  (CSV-driven rewrite)
//
// Seeds all 901 questions from the Notion export CSV into MongoDB.
// Idempotent — skips questions whose text already exists in the DB.
// Runs in four phases:
//   Phase A – load themes + subthemes from DB into name→id maps
//   Phase B – create missing questions from CSV (no conditional logic yet)
//   Phase C – wire conditional logic using the text→id map built in B
//   Phase D – verify counts
//
// Usage:
//   npx ts-node scripts/seedQuestions.ts                  → DRY RUN (safe, no writes)
//   npx ts-node scripts/seedQuestions.ts --apply          → apply all phases
//   npx ts-node scripts/seedQuestions.ts --apply --only=questions
//   npx ts-node scripts/seedQuestions.ts --apply --only=logic
//   npx ts-node scripts/seedQuestions.ts --only=verify
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const question_model_1 = __importDefault(require("../models/question.model"));
const theme_model_1 = __importDefault(require("../models/theme.model"));
const subtheme_model_1 = __importDefault(require("../models/subtheme.model"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
const CREATOR_ID = new mongoose_1.default.Types.ObjectId('69de4f3869452296f6d0ac98');
const QUESTIONS_CSV = path_1.default.join(__dirname, '../data/knowledgebase/Private & Shared 4/Questions 30a60bfb014e8042a72cc6c14c2ef065_all.csv');
const OPTION_SETS = {
    // Yes / No / Don't Know
    'https://www.notion.so/30a60bfb014e8012b2c1f93c372e7eff': [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'dont_know', label: "Don't know" },
    ],
    // Yes / No
    'https://www.notion.so/30a60bfb014e804abef7c04bf746870a': [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
    ],
    // Duration – 5 Point
    'https://www.notion.so/30a60bfb014e8043a079e8236e2f593e': [
        { value: 'short_time', label: 'Only for a short time' },
        { value: 'few_years', label: 'For a few years' },
        { value: 'many_years', label: 'For many years' },
        { value: 'very_long_time', label: 'For a very long time' },
        { value: 'permanently', label: 'Permanently' },
        { value: 'dont_know', label: "Don't know" },
    ],
    // Frequency – 5 Point
    'https://www.notion.so/30a60bfb014e806f9a88d07866eb46b4': [
        { value: 'never', label: 'Never' },
        { value: 'rarely', label: 'Rarely' },
        { value: 'sometimes', label: 'Sometimes' },
        { value: 'often', label: 'Often' },
        { value: 'always', label: 'Always' },
    ],
    // 5-Point Likert – Agreement
    'https://www.notion.so/30a60bfb014e80ceb32cc67952cf8938': [
        { value: 'strongly_disagree', label: 'Strongly Disagree' },
        { value: 'disagree', label: 'Disagree' },
        { value: 'neutral', label: 'Neither Agree nor Disagree' },
        { value: 'agree', label: 'Agree' },
        { value: 'strongly_agree', label: 'Strongly Agree' },
    ],
    // Gender – Standard
    'https://www.notion.so/30a60bfb014e80e8afa9e5dab5dee2ce': [
        { value: 'female', label: 'Female' },
        { value: 'male', label: 'Male' },
        { value: 'non_binary', label: 'Non-binary' },
        { value: 'transgender_man', label: 'Transgender man' },
        { value: 'transgender_woman', label: 'Transgender woman' },
        { value: 'other_gender', label: 'Another gender identity (please specify)' },
        { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
    // Importance – 5 Point
    'https://www.notion.so/32160bfb014e8018bb1bc85df942c3f6': [
        { value: 'not_important', label: 'Not at all important' },
        { value: 'slightly_important', label: 'Slightly important' },
        { value: 'moderately_important', label: 'Moderately important' },
        { value: 'very_important', label: 'Very important' },
        { value: 'extremely_important', label: 'Extremely important' },
        { value: 'dont_know', label: "Don't know" },
    ],
    // Monetary Value – Compensation Scale (5 Point)
    'https://www.notion.so/32160bfb014e80379b9ee8cdda84887c': [
        { value: 'no_money', label: 'No money needed' },
        { value: 'small_amount', label: 'A small amount' },
        { value: 'moderate_amount', label: 'A moderate amount' },
        { value: 'large_amount', label: 'A large amount' },
        { value: 'very_large_amount', label: 'A very large amount' },
        { value: 'dont_know', label: "Don't know" },
    ],
    // Perceived Trade-offs – 5 Point
    'https://www.notion.so/32160bfb014e8047bf19d82632ae4691': [
        { value: 'no_negative', label: 'No negative effects' },
        { value: 'small_negative', label: 'A small negative effect' },
        { value: 'moderate_negative', label: 'A moderate negative effect' },
        { value: 'large_negative', label: 'A large negative effect' },
        { value: 'very_large_negative', label: 'A very large negative effect' },
        { value: 'dont_know', label: "Don't know" },
    ],
    // Types of Negative Effects or Trade-offs
    'https://www.notion.so/32160bfb014e8057ac95d325584d075c': [
        { value: 'increased_costs', label: 'Increased household costs' },
        { value: 'increased_workload', label: 'Increased workload or time burden' },
        { value: 'reduced_land_access', label: 'Reduced access to land or natural resources' },
        { value: 'livelihood_restrictions', label: 'Restrictions on livelihood activities' },
        { value: 'community_conflict', label: 'Conflict or tension within the community' },
        { value: 'household_conflict', label: 'Conflict within the household' },
        { value: 'income_loss', label: 'Loss of income or economic opportunity' },
        { value: 'other', label: 'Other (please specify)' },
    ],
    // Attribution – Contribution Scale (5 Point)
    'https://www.notion.so/32160bfb014e8092a057ee4501d63d61': [
        { value: 'not_at_all', label: 'Not at all' },
        { value: 'small_contribution', label: 'A small contribution' },
        { value: 'moderate_contribution', label: 'A moderate contribution' },
        { value: 'large_contribution', label: 'A large contribution' },
        { value: 'almost_entirely', label: 'Almost entirely' },
        { value: 'dont_know', label: "Don't know" },
    ],
    // Perceived Reach – 5 Point
    'https://www.notion.so/32160bfb014e80f28d64c5a77bf56459': [
        { value: 'very_few', label: 'Very few people' },
        { value: 'some_people', label: 'Some people' },
        { value: 'about_half', label: 'About half of people' },
        { value: 'many_people', label: 'Many people' },
        { value: 'almost_everyone', label: 'Almost everyone' },
        { value: 'dont_know', label: "Don't know" },
    ],
    // Villages – Ntakata Mountains
    'https://www.notion.so/32260bfb014e806893befd3aa0065506': [
        { value: 'bujombe', label: 'Bujombe Village' },
        { value: 'kagunga', label: 'Kagunga Village' },
        { value: 'kapanga', label: 'Kapanga Village' },
        { value: 'katuma', label: 'Katuma Village' },
        { value: 'lugonesi', label: 'Lugonesi Village' },
        { value: 'lwega', label: 'Lwega Village' },
        { value: 'mpembe', label: 'Mpembe Village' },
        { value: 'mwese', label: 'Mwese Village' },
        { value: 'other', label: 'Other' },
    ],
    // Marital status
    'https://www.notion.so/32260bfb014e806ea13ded374160fccf': [
        { value: 'single', label: 'Single' },
        { value: 'married_monogamy', label: 'Married - Monogamy' },
        { value: 'married_polygamy', label: 'Married - Polygamy' },
        { value: 'civil_partnership', label: 'Civil partnership' },
        { value: 'divorced', label: 'Divorced or separated' },
        { value: 'widowed', label: 'Widowed / Widower' },
        { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
    // Livelihood activities
    'https://www.notion.so/32260bfb014e808085ecf49dc9ceab93': [
        { value: 'crop_farming', label: 'Crop farming' },
        { value: 'livestock', label: 'Livestock keeping / pastoralism' },
        { value: 'fishing', label: 'Fishing' },
        { value: 'forest_products', label: 'Forest product collection (e.g., firewood, charcoal, honey, timber)' },
        { value: 'small_business', label: 'Small business / trading' },
        { value: 'wage_labour', label: 'Wage labour / casual labour' },
        { value: 'formal_employment', label: 'Formal employment (government, NGO, company)' },
        { value: 'artisan', label: 'Artisan / skilled trade (carpentry, tailoring, etc.)' },
        { value: 'student', label: 'Student' },
        { value: 'homemaker', label: 'Homemaker / household work' },
        { value: 'unemployed', label: 'Unemployed / not currently working' },
        { value: 'other', label: 'Other (please specify)' },
        { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
    // Education level
    'https://www.notion.so/32260bfb014e808e957bec553227707d': [
        { value: 'no_education', label: 'No formal education' },
        { value: 'some_primary', label: 'Some primary education (not completed)' },
        { value: 'completed_primary', label: 'Completed primary education' },
        { value: 'some_secondary', label: 'Some secondary education (not completed)' },
        { value: 'completed_secondary', label: 'Completed secondary education' },
        { value: 'vocational', label: 'Vocational or technical training' },
        { value: 'university', label: 'College or university education' },
        { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
    // Long-term difficulties
    'https://www.notion.so/32260bfb014e80af99f9f7cd8c5a124b': [
        { value: 'seeing', label: 'Seeing' },
        { value: 'hearing', label: 'Hearing' },
        { value: 'walking', label: 'Walking or climbing steps' },
        { value: 'remembering', label: 'Remembering or concentrating' },
        { value: 'self_care', label: 'Self-care (such as washing or dressing)' },
        { value: 'communicating', label: 'Communicating or being understood' },
        { value: 'no_difficulty', label: 'No difficulty in any of these' },
        { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
    // Community position
    'https://www.notion.so/32260bfb014e80d79726fd074c203750': [
        { value: 'male_head', label: 'Male head of household' },
        { value: 'female_head', label: 'Female head of household' },
        { value: 'young_adult', label: 'Young adult' },
        { value: 'student', label: 'Student' },
        { value: 'religious_leader', label: 'Religious leader' },
        { value: 'elected_community_leader', label: 'Elected community leader' },
        { value: 'traditional_leader', label: 'Traditional leader' },
        { value: 'public_servant', label: 'Public servant' },
        { value: 'none_of_above', label: 'None of the above' },
        { value: 'other', label: 'Other (specify)' },
    ],
    // Household economic situation
    'https://www.notion.so/32860bfb014e807190a5f9508261db25': [
        { value: 'much_worse_off', label: 'Much worse off than most households' },
        { value: 'worse_off', label: 'Worse off than most households' },
        { value: 'same', label: 'About the same as most households' },
        { value: 'better_off', label: 'Better off than most households' },
        { value: 'much_better_off', label: 'Much better off than most households' },
    ],
    // Healthcare Services Utilization
    'https://www.notion.so/32d60bfb014e80f384e9dfca0fce7861': [
        { value: 'consultation', label: 'Consultation' },
        { value: 'treatment', label: 'Treatment' },
        { value: 'maternal_child_health', label: 'Maternal/child health' },
        { value: 'vaccination', label: 'Vaccination' },
        { value: 'emergency_care', label: 'Emergency care' },
        { value: 'other', label: 'Other' },
    ],
};
function mapAnswerType(raw, hasOptions) {
    const map = {
        'Text': 'text',
        'Long Text': 'textarea',
        'Multiple Choice': 'radio',
        'Checkboxes': 'checkbox',
        'Dropdown': 'dropdown',
        'Scale': 'scale',
        'Matrix': 'matrix',
        'Number': 'number',
        'Date': 'date',
        'Time': 'time',
        'File Upload': 'file',
    };
    if (raw && map[raw])
        return map[raw];
    // Fallback for blank Answer Type
    return hasOptions ? 'scale' : 'text';
}
function mapStatus(raw) {
    const s = raw.trim();
    if (s === 'Approved' || s === 'In the platform')
        return 'published';
    return 'draft';
}
// Extract Notion UUID and rebuild clean URL: https://www.notion.so/UUID
function normalizeNotionUrl(cell) {
    const urlMatch = cell.match(/https?:\/\/www\.notion\.so\/\S+/);
    if (!urlMatch)
        return '';
    const url = urlMatch[0].replace(/\)+$/, '');
    const uuidMatch = url.match(/([a-f0-9]{32})(?:\?|$)/);
    if (!uuidMatch)
        return '';
    return `https://www.notion.so/${uuidMatch[1]}`;
}
// Extract display name from "Name (https://...)" cell, normalising whitespace
function extractName(cell) {
    const normalized = cell.replace(/\s+/g, ' ').trim();
    const m = normalized.match(/^(.+?)\s*\(https?:\/\//);
    return m ? m[1].trim() : normalized;
}
function readCsv(filePath) {
    let content = fs_1.default.readFileSync(filePath, 'utf-8');
    if (content.charCodeAt(0) === 0xfeff)
        content = content.slice(1); // strip BOM
    const rows = (0, sync_1.parse)(content, {
        columns: true,
        skip_empty_lines: true,
        trim: false, // we trim manually to preserve intentional spaces
        relax_quotes: true,
        relax_column_count: true,
    });
    console.log(`  CSV loaded: ${rows.length} rows`);
    return rows;
}
// ─────────────────────────────────────────────────────────────────────────────
// Conditional logic helpers
// ─────────────────────────────────────────────────────────────────────────────
function resolveTriggerQuestion(logicSummary, textToId) {
    const lowerSummary = logicSummary.toLowerCase();
    for (const [text, id] of textToId) {
        const snippet = text.trim().toLowerCase().slice(0, 50);
        if (lowerSummary.includes(snippet))
            return id;
    }
    return null;
}
function buildConditionalLogic(logicSummary, triggerQuestionId) {
    const lower = logicSummary.toLowerCase();
    let value = 'yes';
    let operator = 'equals';
    if (lower.includes('responded yes')) {
        value = 'yes';
        operator = 'equals';
    }
    else if (lower.includes('2-5') || lower.includes('2–5')) {
        value = 'no_negative';
        operator = 'notEquals';
    }
    return {
        enabled: true,
        conditions: [{ questionId: triggerQuestionId, operator, value }],
        action: 'show',
        logicOperator: 'AND',
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const ONLY = (_a = args.find(a => a.startsWith('--only='))) === null || _a === void 0 ? void 0 : _a.split('=')[1];
// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        console.log('═'.repeat(60));
        console.log('SEED QUESTIONS — CSV-driven');
        console.log('═'.repeat(60));
        console.log(`Mode : ${DRY_RUN ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}`);
        console.log(`Scope: ${ONLY !== null && ONLY !== void 0 ? ONLY : 'all phases (A→D)'}\n`);
        yield (0, mongodb_1.connectToDatabase)();
        const csvRows = readCsv(QUESTIONS_CSV);
        // ── Phase A: Load themes + subthemes into name→id maps ───────────────────
        if (!ONLY || ONLY === 'questions' || ONLY === 'verify') {
            console.log('\n' + '═'.repeat(60));
            console.log('PHASE A — Load Themes & Subthemes');
            console.log('═'.repeat(60));
            const themeNameToId = new Map();
            const subthemeNameToId = new Map();
            const dbThemes = yield theme_model_1.default.find({}).lean();
            const dbSubthemes = yield subtheme_model_1.default.find({}).lean();
            for (const t of dbThemes)
                themeNameToId.set(t.name, t._id);
            for (const s of dbSubthemes)
                subthemeNameToId.set(s.name, s._id);
            console.log(`  Loaded ${themeNameToId.size} themes, ${subthemeNameToId.size} subthemes from DB`);
            // ── Phase B: Create questions ──────────────────────────────────────────
            if (!ONLY || ONLY === 'questions') {
                console.log('\n' + '═'.repeat(60));
                console.log('PHASE B — Create Questions');
                console.log('═'.repeat(60));
                // Pre-load existing question texts for idempotency (O(1) lookups)
                const existingTexts = new Set();
                const textToId = new Map();
                const allExisting = yield question_model_1.default.find({}, { text: 1 }).lean();
                for (const q of allExisting) {
                    existingTexts.add(q.text.trim());
                    textToId.set(q.text.trim(), q._id);
                }
                console.log(`  Found ${existingTexts.size} existing questions in DB (will skip)`);
                let created = 0, skipped = 0, warnings = 0, errors = 0;
                for (const row of csvRows) {
                    const text = ((_a = row['Question Text']) !== null && _a !== void 0 ? _a : '').replace(/\s+/g, ' ').trim();
                    if (!text)
                        continue;
                    // Idempotency: skip if text already in DB
                    if (existingTexts.has(text)) {
                        skipped++;
                        continue;
                    }
                    // Theme (required)
                    const themeCell = ((_b = row['Theme']) !== null && _b !== void 0 ? _b : '').replace(/\s+/g, ' ').trim();
                    const themeName = themeCell ? extractName(themeCell) : '';
                    const themeId = themeName ? themeNameToId.get(themeName) : undefined;
                    if (!themeId) {
                        if (themeName) {
                            console.warn(`  ⚠️  Theme not in DB "${themeName}" — skipping: "${text.slice(0, 60)}"`);
                        }
                        else {
                            console.warn(`  ⚠️  No theme cell — skipping: "${text.slice(0, 60)}"`);
                        }
                        warnings++;
                        continue;
                    }
                    // Subtheme (optional)
                    const subthemeCell = ((_c = row['Subtheme']) !== null && _c !== void 0 ? _c : '').replace(/\s+/g, ' ').trim();
                    const subthemeName = subthemeCell ? extractName(subthemeCell) : '';
                    const subthemeId = subthemeName ? subthemeNameToId.get(subthemeName) : undefined;
                    if (subthemeName && !subthemeId) {
                        console.warn(`  ⚠️  Subtheme not in DB: "${subthemeName}" (question will have no subtheme)`);
                        warnings++;
                    }
                    // Options
                    const optCell = ((_d = row['Response option set']) !== null && _d !== void 0 ? _d : '').replace(/\s+/g, ' ').trim();
                    const optUrl = optCell ? normalizeNotionUrl(optCell) : '';
                    const options = optUrl ? ((_e = OPTION_SETS[optUrl]) !== null && _e !== void 0 ? _e : []) : [];
                    if (optUrl && !OPTION_SETS[optUrl]) {
                        console.warn(`  ⚠️  Unknown option set URL "${optUrl}" — no options for: "${text.slice(0, 60)}"`);
                        warnings++;
                    }
                    // Answer type
                    const rawType = ((_f = row['Answer Type']) !== null && _f !== void 0 ? _f : '').trim();
                    const answerType = mapAnswerType(rawType, options.length > 0);
                    // Other fields
                    const description = ((_g = row['Description']) !== null && _g !== void 0 ? _g : '').replace(/\s+/g, ' ').trim() || undefined;
                    const required = ((_h = row['Required?']) !== null && _h !== void 0 ? _h : '').trim().toLowerCase() === 'yes';
                    const status = mapStatus(((_j = row['Status']) !== null && _j !== void 0 ? _j : '').trim());
                    const doc = {
                        text,
                        description,
                        type: answerType,
                        required,
                        options,
                        creator: CREATOR_ID,
                        categories: [],
                        theme: themeId,
                        subThemes: subthemeId ? [subthemeId] : [],
                        targetAudience: 'external',
                        status,
                        isTemplate: true,
                        isBespoke: false,
                        isStandardDemographic: false,
                        isGlobalStandard: false,
                        tags: ['csv-seeded'],
                        selectedIndicatorTags: [],
                        selectedSdgTags: [],
                        selectedResilienceTags: [],
                        selectedEsgTags: [],
                        selectedStandardTags: [],
                        archived: false,
                    };
                    if (DRY_RUN) {
                        console.log(`  🔍  Would create: "${text.slice(0, 70)}"`);
                        // Simulate an id for conditional logic resolution
                        const fakeId = new mongoose_1.default.Types.ObjectId();
                        textToId.set(text, fakeId);
                        created++;
                    }
                    else {
                        try {
                            const q = yield question_model_1.default.create(doc);
                            textToId.set(text, q._id);
                            created++;
                        }
                        catch (err) {
                            console.error(`  ❌  Error on "${text.slice(0, 60)}": ${err.message}`);
                            errors++;
                        }
                    }
                }
                console.log(`\n  Summary: ${created} ${DRY_RUN ? 'would be created' : 'created'}, ${skipped} already existed, ${warnings} warnings, ${errors} errors`);
                // ── Phase C: Wire conditional logic ─────────────────────────────────
                if (!ONLY || ONLY === 'logic') {
                    console.log('\n' + '═'.repeat(60));
                    console.log('PHASE C — Conditional Logic');
                    console.log('═'.repeat(60));
                    // If we didn't run Phase B, reload textToId from DB
                    if (ONLY === 'logic') {
                        const all = yield question_model_1.default.find({}, { text: 1 }).lean();
                        for (const q of all)
                            textToId.set(q.text.trim(), q._id);
                        console.log(`  Loaded ${textToId.size} questions from DB for logic wiring`);
                    }
                    let applied = 0, unresolved = 0;
                    for (const row of csvRows) {
                        if (((_k = row['Has Conditional Logic?']) !== null && _k !== void 0 ? _k : '').trim() !== 'Yes')
                            continue;
                        const logicSummary = ((_l = row['Logic Summary']) !== null && _l !== void 0 ? _l : '').replace(/\s+/g, ' ').trim();
                        if (!logicSummary)
                            continue;
                        const text = ((_m = row['Question Text']) !== null && _m !== void 0 ? _m : '').replace(/\s+/g, ' ').trim();
                        if (!text)
                            continue;
                        const questionId = textToId.get(text);
                        if (!questionId) {
                            unresolved++;
                            continue;
                        }
                        const triggerId = resolveTriggerQuestion(logicSummary, textToId);
                        if (!triggerId) {
                            console.warn(`  ⚠️  Could not resolve trigger for: "${text.slice(0, 60)}"`);
                            unresolved++;
                            continue;
                        }
                        const logic = buildConditionalLogic(logicSummary, triggerId);
                        if (DRY_RUN) {
                            console.log(`  🔍  Would wire logic for: "${text.slice(0, 60)}"`);
                        }
                        else {
                            yield question_model_1.default.findByIdAndUpdate(questionId, { conditionalLogic: logic });
                        }
                        applied++;
                    }
                    console.log(`\n  Summary: ${applied} ${DRY_RUN ? 'would wire' : 'wired'} logic, ${unresolved} unresolved`);
                }
            }
        }
        // ── Phase D: Verify ────────────────────────────────────────────────────────
        if (ONLY === 'verify' || (!ONLY && !DRY_RUN)) {
            console.log('\n' + '═'.repeat(60));
            console.log('PHASE D — Verify');
            console.log('═'.repeat(60));
            const total = yield question_model_1.default.countDocuments({});
            const seeded = yield question_model_1.default.countDocuments({ tags: 'csv-seeded' });
            const withLogic = yield question_model_1.default.countDocuments({ 'conditionalLogic.enabled': true });
            const draft = yield question_model_1.default.countDocuments({ tags: 'csv-seeded', status: 'draft' });
            const published = yield question_model_1.default.countDocuments({ tags: 'csv-seeded', status: 'published' });
            console.log(`  Total questions in DB : ${total}`);
            console.log(`  CSV-seeded            : ${seeded}`);
            console.log(`  With conditional logic: ${withLogic}`);
            console.log(`  Draft / Published     : ${draft} / ${published}`);
            const sample = yield question_model_1.default.findOne({ tags: 'csv-seeded' }).populate('theme subThemes');
            if (sample) {
                console.log(`\n  Sample: "${sample.text.slice(0, 80)}"`);
                console.log(`  Type: ${sample.type} | Required: ${sample.required} | Options: ${sample.options.length}`);
            }
        }
        yield (0, mongodb_1.disconnectFromDatabase)();
        console.log(DRY_RUN ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
    });
}
run().catch(err => { console.error('Fatal:', err); process.exit(1); });
//# sourceMappingURL=seedQuestions.js.map