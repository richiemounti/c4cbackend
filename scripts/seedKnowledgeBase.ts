// scripts/seedKnowledgeBase.ts
//
// Seeds Themes, SubThemes, and Indicators from the CSV files in data/knowledgebase/.
// Replaces no existing data — fully idempotent (skips records that already exist by name).
//
// Usage:
//   npx ts-node scripts/seedKnowledgeBase.ts                    → DRY RUN (safe, no writes)
//   npx ts-node scripts/seedKnowledgeBase.ts --apply            → apply all phases
//   npx ts-node scripts/seedKnowledgeBase.ts --apply --only=themes
//   npx ts-node scripts/seedKnowledgeBase.ts --apply --only=subthemes
//   npx ts-node scripts/seedKnowledgeBase.ts --apply --only=indicators
//   npx ts-node scripts/seedKnowledgeBase.ts --apply --only=link
//   npx ts-node scripts/seedKnowledgeBase.ts --only=verify      → verify after applying

import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Theme from '../models/theme.model';
import SubTheme from '../models/subtheme.model';
import Indicator from '../models/indicator.model';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CREATOR_ID = new mongoose.Types.ObjectId('69de4f3869452296f6d0ac98');

const DATA_ROOT = path.join(__dirname, '../data/knowledgebase');

const THEMES_CSV     = path.join(DATA_ROOT, 'Private & Shared 3/Themes 30a60bfb014e8041a28dd7477d55e4db.csv');
const SUBTHEMES_CSV  = path.join(DATA_ROOT, 'Private & Shared 2/Sub-theme library 30a60bfb014e80fdbf3dca01d7f171b3.csv');
const INDICATORS_CSV = path.join(DATA_ROOT, 'Private & Shared/Indicator Development (SMART Log) 30a60bfb014e806f8e3adb04271bfcdf.csv');

// ─────────────────────────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────────────────────────

type ThemeToCStage   = 'Stage 1 - Output' | 'Stage 2 - Outcome' | 'Both' | null;
type SubThemeToCStage = 'Stage 1 - Output' | 'Stage 2 - Outcome';

// ─────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps raw CSV ToC Stage values to Theme model enum values.
 * Theme accepts: 'Stage 1 - Output' | 'Stage 2 - Outcome' | 'Both' | null
 */
function mapToCStageTheme(raw: string): ThemeToCStage {
  const s = raw.trim();
  if (s.startsWith('1:')) return 'Stage 1 - Output';
  if (s.startsWith('2:')) return 'Stage 2 - Outcome';
  if (s.toLowerCase().includes('both')) return 'Both';
  return null; // e.g. "Standard for surveys" or empty
}

/**
 * Maps raw CSV ToC Stage values to SubTheme model enum values.
 * SubTheme only accepts: 'Stage 1 - Output' | 'Stage 2 - Outcome'
 * Returns null if unsupported (caller will skip that row with a warning).
 */
function mapToCStageSubTheme(raw: string): SubThemeToCStage | null {
  const s = raw.trim();
  if (s.startsWith('1:')) return 'Stage 1 - Output';
  if (s.startsWith('2:')) return 'Stage 2 - Outcome';
  return null;
}

/**
 * Maps Theme CSV status column to model status enum.
 * "Published on Platform" → 'published', everything else → 'draft'
 */
function mapThemeStatus(raw: string): 'published' | 'draft' {
  if (raw.trim().toLowerCase().includes('published on platform')) return 'published';
  return 'draft';
}

/**
 * Maps SubTheme CSV status column to model status enum.
 * "Published to site" → 'published', everything else → 'draft'
 */
function mapSubThemeStatus(raw: string): 'published' | 'draft' {
  if (raw.trim().toLowerCase().includes('published to site')) return 'published';
  return 'draft';
}

/**
 * Extracts the theme name from a Notion-linked string.
 *
 * Input examples:
 *   "Social Legitimacy (https://www.notion.so/Social-Legitimacy-...)"
 *   "Benefit Sharing Mechanism (https://...), Preparatory Planning (https://...)"
 *
 * Returns the first theme name only (SubTheme has a single theme reference).
 */
function extractThemeName(raw: string): string {
  const match = raw.match(/^(.+?)\s*\(https?:\/\//);
  if (match) return match[1].trim();
  return raw.trim();
}

/**
 * Extracts a plain name from a Notion-linked string.
 *
 * Input:  "Adult learning and peer support (https://www.notion.so/...)"
 * Output: "Adult learning and peer support"
 */
function extractName(raw: string): string {
  return raw.replace(/\s*\(https?:\/\/[^)]+\)/g, '').trim();
}

/**
 * Parses the "Indicator sources" column into evidence fields.
 *
 * The CSV sources column contains Notion internal page links, e.g.:
 *   "Caring for the Caregiver (https://www.notion.so/Caring-for-the-Caregiver-...?pvs=21)"
 *
 * These Notion URLs are internal references — the real source URL (e.g. a UNICEF PDF)
 * lives inside that Notion page and cannot be read from the CSV.  The model's URL
 * validator also rejects Notion URLs because of query-string characters (?pvs=21).
 *
 * Strategy:
 *   - Always extract and store the human-readable source name in evidence.source
 *   - Only store a URL in evidence.url if it is NOT a notion.so link
 *     (i.e. a genuine external source URL that was embedded directly in the cell)
 */
function parseEvidence(raw: string): { source: string; url: string[] } | null {
  if (!raw?.trim()) return null;

  const externalUrls: string[] = [];
  const sourceNames: string[] = [];

  // Each source entry looks like: "Source Name (https://...)"
  // Split by comma only when the next token starts an uppercase word (new source entry)
  const entries = raw.split(/,\s*(?=[A-Z\u00C0-\u024F])/);

  for (const entry of entries) {
    const urlMatch = entry.match(/\((https?:\/\/[^)]+)\)/);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      // Only keep real external URLs — skip Notion internal page links
      if (!url.includes('notion.so')) {
        externalUrls.push(url);
      }
    }
    // Always keep the human-readable name (strip the URL part)
    const name = entry.replace(/\s*\(https?:\/\/[^)]+\)/g, '').trim();
    if (name) sourceNames.push(name);
  }

  const source = sourceNames.join('; ');
  if (!source && externalUrls.length === 0) return null;

  return {
    source: source.substring(0, 1000), // respect model maxLength
    url: externalUrls,
  };
}

/**
 * Reads and parses a CSV file using csv-parse/sync.
 * Returns an array of row objects keyed by header names.
 */
function readCsv(filePath: string): Record<string, string>[] {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Strip UTF-8 BOM (ef bb bf) — Notion CSV exports always include one.
  // Without this, the first column header becomes "\uFEFFTheme Name" instead of
  // "Theme Name", causing every row to be silently skipped.
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (rows.length === 0) {
    console.warn(`  ⚠️   CSV parsed 0 rows — file may be empty or misformatted: ${path.basename(filePath)}`);
  } else {
    console.log(`  ℹ️   CSV loaded: ${rows.length} rows  (columns: ${Object.keys(rows[0]).join(', ')})`);
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE A — Seed Themes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seeds all rows from the Themes CSV into the Theme collection.
 * Returns a Map of theme name → ObjectId for use by later phases.
 */
async function seedThemes(dryRun: boolean): Promise<Map<string, mongoose.Types.ObjectId>> {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE A — Themes');
  console.log('═'.repeat(60));

  const rows = readCsv(THEMES_CSV);
  const themeMap = new Map<string, mongoose.Types.ObjectId>();
  let inserted = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const name = row['Theme Name']?.trim();
    if (!name) continue;

    const description   = row['Descriptor']?.trim() || undefined;
    const tocStage      = mapToCStageTheme(row['ToC Stage'] ?? '');
    const status        = mapThemeStatus(row['Theme Status'] ?? '');

    try {
      const existing = await Theme.findOne({ name });
      if (existing) {
        themeMap.set(name, existing._id as mongoose.Types.ObjectId);
        console.log(`  ⏭️   Already exists: "${name}"`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  🔍  Would insert: "${name}" [tocStage=${tocStage ?? 'null'}, status=${status}]`);
        themeMap.set(name, new mongoose.Types.ObjectId()); // placeholder for sub-theme dry run
      } else {
        const theme = await Theme.create({
          name,
          description,
          theoryOfChangeStage: tocStage,
          creator: CREATOR_ID,
          status,
          archived: false,
        });
        themeMap.set(name, theme._id as mongoose.Types.ObjectId);
        console.log(`  ✅  Inserted: "${name}"`);
        inserted++;
      }
    } catch (err: any) {
      console.error(`  ❌  Error on "${name}": ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  Summary: ${dryRun ? '(dry run) ' : ''}${inserted} inserted, ${skipped} already existed, ${errors} errors`);
  return themeMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE B — Seed SubThemes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seeds all rows from the SubThemes CSV.
 * Matches each sub-theme to a Theme using the "Theme database" column.
 * The theme name is extracted from the Notion-linked cell and looked up in themeMap.
 */
async function seedSubThemes(
  dryRun: boolean,
  themeMap: Map<string, mongoose.Types.ObjectId>
): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE B — SubThemes');
  console.log('═'.repeat(60));

  const rows = readCsv(SUBTHEMES_CSV);
  let inserted = 0, skipped = 0, errors = 0, unmatched = 0;

  for (const row of rows) {
    const name = row['Sub-theme name']?.trim();
    if (!name) continue;

    // ── Resolve parent Theme ──────────────────────────────────────────────────
    const rawThemeCell = row['Theme database']?.trim() ?? '';
    const themeName    = rawThemeCell ? extractThemeName(rawThemeCell) : '';
    const themeId      = themeMap.get(themeName);

    if (!themeId) {
      console.warn(`  ⚠️   "${name}" — theme not matched: "${themeName}"`);
      unmatched++;
      continue;
    }

    // ── ToC Stage ─────────────────────────────────────────────────────────────
    const rawToC    = row['ToC Stage']?.trim() ?? '';
    const tocStage  = mapToCStageSubTheme(rawToC);

    if (!tocStage) {
      // SubTheme model only allows Stage 1 or Stage 2 — "Both Stages" is not supported
      console.warn(`  ⚠️   "${name}" — unsupported ToC stage: "${rawToC}" (skipping)`);
      unmatched++;
      continue;
    }

    const description = row['Descriptor']?.trim() || undefined;
    const status      = mapSubThemeStatus(row['Status'] ?? '');

    try {
      const existing = await SubTheme.findOne({ name });
      if (existing) {
        console.log(`  ⏭️   Already exists: "${name}"`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  🔍  Would insert: "${name}" → Theme: "${themeName}" [${tocStage}, ${status}]`);
      } else {
        await SubTheme.create({
          name,
          description,
          theme: themeId,
          theoryOfChangeStage: tocStage,
          creator: CREATOR_ID,
          status,
          archived: false,
        });
        console.log(`  ✅  Inserted: "${name}" → Theme: "${themeName}"`);
        inserted++;
      }
    } catch (err: any) {
      console.error(`  ❌  Error on "${name}": ${err.message}`);
      errors++;
    }
  }

  console.log(
    `\n  Summary: ${dryRun ? '(dry run) ' : ''}${inserted} inserted, ${skipped} already existed, ` +
    `${errors} errors, ${unmatched} skipped (unmatched theme or unsupported ToC stage)`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE C — Seed Indicators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seeds all rows from the Indicators CSV into the Indicator collection.
 * Returns a Map of indicator statement (name) → ObjectId for use by Phase D.
 */
async function seedIndicators(dryRun: boolean): Promise<Map<string, mongoose.Types.ObjectId>> {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE C — Indicators');
  console.log('═'.repeat(60));

  const rows = readCsv(INDICATORS_CSV);
  const indicatorMap = new Map<string, mongoose.Types.ObjectId>();
  let inserted = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const name = row['Indicator statement']?.trim();
    if (!name) continue;

    const description = row['Indicator descriptor']?.trim() || undefined;
    const evidence    = parseEvidence(row['Indicator sources'] ?? '');
    const label       = name.length > 80 ? name.substring(0, 77) + '...' : name;

    try {
      const existing = await Indicator.findOne({ name });
      if (existing) {
        indicatorMap.set(name, existing._id as mongoose.Types.ObjectId);
        console.log(`  ⏭️   Already exists: "${label}"`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  🔍  Would insert: "${label}"`);
        indicatorMap.set(name, new mongoose.Types.ObjectId()); // placeholder for link dry run
      } else {
        const indicator = await Indicator.create({
          name,
          description,
          evidence: evidence ?? null,
          creator: CREATOR_ID,
          status: 'active',
          archived: false,
        });
        indicatorMap.set(name, indicator._id as mongoose.Types.ObjectId);
        console.log(`  ✅  Inserted: "${label}"`);
        inserted++;
      }
    } catch (err: any) {
      console.error(`  ❌  Error on "${label}": ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  Summary: ${dryRun ? '(dry run) ' : ''}${inserted} inserted, ${skipped} already existed, ${errors} errors`);
  return indicatorMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE D — Link Indicators → SubThemes (populate indicatorTags)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the "Sub-themes" column from the Indicators CSV and adds each indicator's
 * ObjectId into the matching SubTheme's indicatorTags array.
 * Uses $addToSet so running this multiple times is safe.
 */
async function linkIndicatorsToSubThemes(
  dryRun: boolean,
  indicatorMap: Map<string, mongoose.Types.ObjectId>
): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE D — Link Indicators → SubThemes');
  console.log('═'.repeat(60));

  const rows = readCsv(INDICATORS_CSV);

  // Build: subThemeName → Set of indicator ObjectId strings
  const subThemeToIndicators = new Map<string, Set<string>>();

  for (const row of rows) {
    const indicatorName = row['Indicator statement']?.trim();
    if (!indicatorName) continue;

    const indicatorId = indicatorMap.get(indicatorName);
    if (!indicatorId) continue;

    const rawSubThemeCell = row['Sub-themes']?.trim();
    if (!rawSubThemeCell) continue;

    // Each sub-theme cell looks like: "Sub-theme name (https://www.notion.so/...)"
    const subThemeName = extractName(rawSubThemeCell);
    if (!subThemeName) continue;

    if (!subThemeToIndicators.has(subThemeName)) {
      subThemeToIndicators.set(subThemeName, new Set());
    }
    subThemeToIndicators.get(subThemeName)!.add(indicatorId.toString());
  }

  let linked = 0, missing = 0;

  for (const [subThemeName, indicatorIdSet] of subThemeToIndicators.entries()) {
    const subTheme = await SubTheme.findOne({ name: subThemeName });

    if (!subTheme) {
      console.warn(`  ⚠️   SubTheme not found for linking: "${subThemeName}"`);
      missing++;
      continue;
    }

    const ids = Array.from(indicatorIdSet).map(id => new mongoose.Types.ObjectId(id));

    if (dryRun) {
      console.log(`  🔍  Would link ${ids.length} indicator(s) → SubTheme: "${subThemeName}"`);
    } else {
      await SubTheme.updateOne(
        { _id: subTheme._id },
        { $addToSet: { indicatorTags: { $each: ids } } }
      );
      console.log(`  ✅  Linked ${ids.length} indicator(s) → SubTheme: "${subThemeName}"`);
      linked++;
    }
  }

  console.log(`\n  Summary: ${dryRun ? '(dry run) ' : ''}${linked} sub-themes linked, ${missing} sub-themes not found`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE E — Verification
// ─────────────────────────────────────────────────────────────────────────────

async function verify(): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE E — Verification');
  console.log('═'.repeat(60));

  const themeTotal        = await Theme.countDocuments({ creator: CREATOR_ID });
  const themePublished    = await Theme.countDocuments({ creator: CREATOR_ID, status: 'published' });
  const subThemeTotal     = await SubTheme.countDocuments({ creator: CREATOR_ID });
  const subThemePublished = await SubTheme.countDocuments({ creator: CREATOR_ID, status: 'published' });
  const indicatorTotal    = await Indicator.countDocuments({ creator: CREATOR_ID });
  const linkedSubThemes   = await SubTheme.countDocuments({
    creator: CREATOR_ID,
    indicatorTags: { $exists: true, $not: { $size: 0 } },
  });

  console.log(`\n  Themes    : ${themeTotal} total  (${themePublished} published)`);
  console.log(`  SubThemes : ${subThemeTotal} total  (${subThemePublished} published)`);
  console.log(`  Indicators: ${indicatorTotal} total`);
  console.log(`  SubThemes with at least 1 indicator link: ${linkedSubThemes}`);

  // Spot-check: verify a sub-theme correctly resolves to its parent theme
  const sample = await SubTheme.findOne({ creator: CREATOR_ID }).populate('theme').lean() as any;
  if (sample) {
    console.log(`\n  Sample SubTheme spot-check:`);
    console.log(`    Name      : "${sample.name}"`);
    console.log(`    Theme     : "${sample.theme?.name ?? '⚠️ unresolved'}" (id: ${sample.theme?._id ?? 'none'})`);
    console.log(`    ToC Stage : ${sample.theoryOfChangeStage}`);
    console.log(`    Status    : ${sample.status}`);
    console.log(`    Indicator tags: ${sample.indicatorTags?.length ?? 0}`);
  }

  // Spot-check: verify a published theme exists
  const pubTheme = await Theme.findOne({ creator: CREATOR_ID, status: 'published' }).lean() as any;
  if (pubTheme) {
    console.log(`\n  Sample published Theme spot-check:`);
    console.log(`    Name      : "${pubTheme.name}"`);
    console.log(`    ToC Stage : ${pubTheme.theoryOfChangeStage}`);
    console.log(`    Status    : ${pubTheme.status}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRYPOINT
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const args    = process.argv.slice(2);
  const dryRun  = !args.includes('--apply');
  const only    = args.find(a => a.startsWith('--only='))?.split('=')[1];

  console.log('═'.repeat(60));
  console.log('YOUTH IMPACT KNOWLEDGE BASE SEED SCRIPT');
  console.log('═'.repeat(60));
  console.log(`Mode   : ${dryRun ? '🔍 DRY RUN  (add --apply to write)' : '⚠️  APPLYING CHANGES'}`);
  console.log(`Scope  : ${only ?? 'all phases (A themes + B subthemes + C indicators + D link + E verify)'}`);
  console.log(`Creator: ${CREATOR_ID}`);
  console.log('');

  try {
    await connectToDatabase();

    // These maps are built in Phase A/C and consumed in Phase B/D.
    // When running a phase in isolation (--only=), they are reloaded from DB.
    let themeMap     = new Map<string, mongoose.Types.ObjectId>();
    let indicatorMap = new Map<string, mongoose.Types.ObjectId>();

    // ── Phase A: Themes ───────────────────────────────────────────────────────
    if (!only || only === 'themes') {
      themeMap = await seedThemes(dryRun);
    }

    // ── Phase B: SubThemes ────────────────────────────────────────────────────
    if (!only || only === 'subthemes') {
      if (only === 'subthemes') {
        // Running sub-themes in isolation — load existing themes from DB
        const themes = await Theme.find({}).lean() as any[];
        for (const t of themes) themeMap.set(t.name, t._id);
        console.log(`  ℹ️   Loaded ${themeMap.size} themes from DB for sub-theme matching.`);
      }
      await seedSubThemes(dryRun, themeMap);
    }

    // ── Phase C: Indicators ───────────────────────────────────────────────────
    if (!only || only === 'indicators') {
      indicatorMap = await seedIndicators(dryRun);
    }

    // ── Phase D: Link Indicators → SubThemes ──────────────────────────────────
    if (!only || only === 'link') {
      if (only === 'link') {
        // Running link in isolation — load existing indicators from DB
        const indicators = await Indicator.find({}).lean() as any[];
        for (const i of indicators) indicatorMap.set(i.name, i._id);
        console.log(`  ℹ️   Loaded ${indicatorMap.size} indicators from DB for linking.`);
      }
      await linkIndicatorsToSubThemes(dryRun, indicatorMap);
    }

    // ── Phase E: Verify ───────────────────────────────────────────────────────
    if (only === 'verify' || (!dryRun && !only)) {
      await verify();
    }

    console.log('\n' + '═'.repeat(60));
    console.log(dryRun ? '🔍 Dry run complete — no writes made.' : '✅ Seed complete.');
    if (dryRun) console.log('    Run with --apply to execute.');
    console.log('═'.repeat(60));

  } catch (err) {
    console.error('\n❌ Seed script failed:', err);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) run();

export { run as runKnowledgeBaseSeed };
