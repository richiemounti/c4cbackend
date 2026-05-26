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

import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Question from '../models/question.model';
import Theme from '../models/theme.model';
import SubTheme from '../models/subtheme.model';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

const CREATOR_ID = new mongoose.Types.ObjectId('69de4f3869452296f6d0ac98');

const QUESTIONS_CSV = path.join(
  __dirname,
  '../data/knowledgebase/Private & Shared 4/Questions 30a60bfb014e8042a72cc6c14c2ef065_all.csv'
);

// ─────────────────────────────────────────────────────────────────────────────
// Response Option Sets  (clean Notion UUID URL → options array)
// ─────────────────────────────────────────────────────────────────────────────

interface IOption { value: string; label: string; }

const OPTION_SETS: Record<string, IOption[]> = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type PlatformType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime' | 'radio' | 'checkbox' | 'dropdown' | 'scale' | 'matrix' | 'file' | 'location';

function mapAnswerType(raw: string, hasOptions: boolean): PlatformType {
  const map: Record<string, PlatformType> = {
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
  if (raw && map[raw]) return map[raw];
  // Fallback for blank Answer Type
  return hasOptions ? 'scale' : 'text';
}

function mapStatus(raw: string): 'draft' | 'published' {
  const s = raw.trim();
  if (s === 'Approved' || s === 'In the platform') return 'published';
  return 'draft';
}

// Extract Notion UUID and rebuild clean URL: https://www.notion.so/UUID
function normalizeNotionUrl(cell: string): string {
  const urlMatch = cell.match(/https?:\/\/www\.notion\.so\/\S+/);
  if (!urlMatch) return '';
  const url = urlMatch[0].replace(/\)+$/, '');
  const uuidMatch = url.match(/([a-f0-9]{32})(?:\?|$)/);
  if (!uuidMatch) return '';
  return `https://www.notion.so/${uuidMatch[1]}`;
}

// Extract display name from "Name (https://...)" cell, normalising whitespace
function extractName(cell: string): string {
  const normalized = cell.replace(/\s+/g, ' ').trim();
  const m = normalized.match(/^(.+?)\s*\(https?:\/\//);
  return m ? m[1].trim() : normalized;
}

function readCsv(filePath: string): Record<string, string>[] {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // strip BOM
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: false,           // we trim manually to preserve intentional spaces
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  console.log(`  CSV loaded: ${rows.length} rows`);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conditional logic helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveTriggerQuestion(
  logicSummary: string,
  textToId: Map<string, mongoose.Types.ObjectId>
): mongoose.Types.ObjectId | null {
  const lowerSummary = logicSummary.toLowerCase();
  for (const [text, id] of textToId) {
    const snippet = text.trim().toLowerCase().slice(0, 50);
    if (lowerSummary.includes(snippet)) return id;
  }
  return null;
}

function buildConditionalLogic(
  logicSummary: string,
  triggerQuestionId: mongoose.Types.ObjectId
) {
  const lower = logicSummary.toLowerCase();
  let value: any = 'yes';
  let operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' = 'equals';

  if (lower.includes('responded yes')) {
    value = 'yes';
    operator = 'equals';
  } else if (lower.includes('2-5') || lower.includes('2–5')) {
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

const args   = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const ONLY   = args.find(a => a.startsWith('--only='))?.split('=')[1];

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('═'.repeat(60));
  console.log('SEED QUESTIONS — CSV-driven');
  console.log('═'.repeat(60));
  console.log(`Mode : ${DRY_RUN ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}`);
  console.log(`Scope: ${ONLY ?? 'all phases (A→D)'}\n`);

  await connectToDatabase();

  const csvRows = readCsv(QUESTIONS_CSV);

  // ── Phase A: Load themes + subthemes into name→id maps ───────────────────
  if (!ONLY || ONLY === 'questions' || ONLY === 'verify') {
    console.log('\n' + '═'.repeat(60));
    console.log('PHASE A — Load Themes & Subthemes');
    console.log('═'.repeat(60));

    const themeNameToId   = new Map<string, mongoose.Types.ObjectId>();
    const subthemeNameToId = new Map<string, mongoose.Types.ObjectId>();

    const dbThemes    = await Theme.find({}).lean() as any[];
    const dbSubthemes = await SubTheme.find({}).lean() as any[];

    for (const t of dbThemes)    themeNameToId.set(t.name, t._id);
    for (const s of dbSubthemes) subthemeNameToId.set(s.name, s._id);

    console.log(`  Loaded ${themeNameToId.size} themes, ${subthemeNameToId.size} subthemes from DB`);

    // ── Phase B: Create questions ──────────────────────────────────────────
    if (!ONLY || ONLY === 'questions') {
      console.log('\n' + '═'.repeat(60));
      console.log('PHASE B — Create Questions');
      console.log('═'.repeat(60));

      // Pre-load existing question texts for idempotency (O(1) lookups)
      const existingTexts = new Set<string>();
      const textToId      = new Map<string, mongoose.Types.ObjectId>();

      const allExisting = await Question.find({}, { text: 1 }).lean() as any[];
      for (const q of allExisting) {
        existingTexts.add(q.text.trim());
        textToId.set(q.text.trim(), q._id);
      }
      console.log(`  Found ${existingTexts.size} existing questions in DB (will skip)`);

      let created = 0, skipped = 0, warnings = 0, errors = 0;

      for (const row of csvRows) {
        const text = (row['Question Text'] ?? '').replace(/\s+/g, ' ').trim();
        if (!text) continue;

        // Idempotency: skip if text already in DB
        if (existingTexts.has(text)) {
          skipped++;
          continue;
        }

        // Theme (required)
        const themeCell = (row['Theme'] ?? '').replace(/\s+/g, ' ').trim();
        const themeName = themeCell ? extractName(themeCell) : '';
        const themeId   = themeName ? themeNameToId.get(themeName) : undefined;

        if (!themeId) {
          if (themeName) {
            console.warn(`  ⚠️  Theme not in DB "${themeName}" — skipping: "${text.slice(0, 60)}"`);
          } else {
            console.warn(`  ⚠️  No theme cell — skipping: "${text.slice(0, 60)}"`);
          }
          warnings++;
          continue;
        }

        // Subtheme (optional)
        const subthemeCell = (row['Subtheme'] ?? '').replace(/\s+/g, ' ').trim();
        const subthemeName = subthemeCell ? extractName(subthemeCell) : '';
        const subthemeId   = subthemeName ? subthemeNameToId.get(subthemeName) : undefined;

        if (subthemeName && !subthemeId) {
          console.warn(`  ⚠️  Subtheme not in DB: "${subthemeName}" (question will have no subtheme)`);
          warnings++;
        }

        // Options
        const optCell    = (row['Response option set'] ?? '').replace(/\s+/g, ' ').trim();
        const optUrl     = optCell ? normalizeNotionUrl(optCell) : '';
        const options    = optUrl ? (OPTION_SETS[optUrl] ?? []) : [];

        if (optUrl && !OPTION_SETS[optUrl]) {
          console.warn(`  ⚠️  Unknown option set URL "${optUrl}" — no options for: "${text.slice(0, 60)}"`);
          warnings++;
        }

        // Answer type
        const rawType    = (row['Answer Type'] ?? '').trim();
        const answerType = mapAnswerType(rawType, options.length > 0);

        // Other fields
        const description = (row['Description'] ?? '').replace(/\s+/g, ' ').trim() || undefined;
        const required    = (row['Required?'] ?? '').trim().toLowerCase() === 'yes';
        const status      = mapStatus((row['Status'] ?? '').trim());

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
          targetAudience: 'external' as const,
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
          const fakeId = new mongoose.Types.ObjectId();
          textToId.set(text, fakeId);
          created++;
        } else {
          try {
            const q = await Question.create(doc);
            textToId.set(text, q._id as mongoose.Types.ObjectId);
            created++;
          } catch (err: any) {
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
          const all = await Question.find({}, { text: 1 }).lean() as any[];
          for (const q of all) textToId.set(q.text.trim(), q._id);
          console.log(`  Loaded ${textToId.size} questions from DB for logic wiring`);
        }

        let applied = 0, unresolved = 0;

        for (const row of csvRows) {
          if ((row['Has Conditional Logic?'] ?? '').trim() !== 'Yes') continue;
          const logicSummary = (row['Logic Summary'] ?? '').replace(/\s+/g, ' ').trim();
          if (!logicSummary) continue;

          const text = (row['Question Text'] ?? '').replace(/\s+/g, ' ').trim();
          if (!text) continue;

          const questionId = textToId.get(text);
          if (!questionId) { unresolved++; continue; }

          const triggerId = resolveTriggerQuestion(logicSummary, textToId);
          if (!triggerId) {
            console.warn(`  ⚠️  Could not resolve trigger for: "${text.slice(0, 60)}"`);
            unresolved++;
            continue;
          }

          const logic = buildConditionalLogic(logicSummary, triggerId);

          if (DRY_RUN) {
            console.log(`  🔍  Would wire logic for: "${text.slice(0, 60)}"`);
          } else {
            await Question.findByIdAndUpdate(questionId, { conditionalLogic: logic });
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

    const total     = await Question.countDocuments({});
    const seeded    = await Question.countDocuments({ tags: 'csv-seeded' });
    const withLogic = await Question.countDocuments({ 'conditionalLogic.enabled': true });
    const draft     = await Question.countDocuments({ tags: 'csv-seeded', status: 'draft' });
    const published = await Question.countDocuments({ tags: 'csv-seeded', status: 'published' });

    console.log(`  Total questions in DB : ${total}`);
    console.log(`  CSV-seeded            : ${seeded}`);
    console.log(`  With conditional logic: ${withLogic}`);
    console.log(`  Draft / Published     : ${draft} / ${published}`);

    const sample = await Question.findOne({ tags: 'csv-seeded' }).populate('theme subThemes');
    if (sample) {
      console.log(`\n  Sample: "${sample.text.slice(0, 80)}"`);
      console.log(`  Type: ${sample.type} | Required: ${sample.required} | Options: ${sample.options.length}`);
    }
  }

  await disconnectFromDatabase();
  console.log(DRY_RUN ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
