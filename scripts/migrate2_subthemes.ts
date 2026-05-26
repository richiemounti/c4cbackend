// scripts/migrate2_subthemes.ts
//
// Step 2 of 3 — Two phases:
//   Phase A: Fix orphaned subthemes (theme = null) by name-matching them to the CSV
//   Phase B: Insert subthemes missing from the DB entirely
//
// Reads from _all.csv so no rows are filtered out.
// Idempotent — skips subthemes that already exist and are correctly linked.
// Run AFTER migrate1_themes.ts so all 45 themes are present.
//
// Usage:
//   npx ts-node scripts/migrate2_subthemes.ts                    → dry run
//   npx ts-node scripts/migrate2_subthemes.ts --apply            → write
//   npx ts-node scripts/migrate2_subthemes.ts --apply --only=fix → only fix orphans
//   npx ts-node scripts/migrate2_subthemes.ts --apply --only=add → only add missing

import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Theme from '../models/theme.model';
import SubTheme from '../models/subtheme.model';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

const CREATOR_ID = new mongoose.Types.ObjectId('69de4f3869452296f6d0ac98');

const SUBTHEMES_CSV = path.join(
  __dirname,
  '../data/knowledgebase/Private & Shared 2/Sub-theme library 30a60bfb014e80fdbf3dca01d7f171b3_all.csv'
);

// ─── helpers ─────────────────────────────────────────────────────────────────

function mapToCStageSubTheme(raw: string): 'Stage 1 - Output' | 'Stage 2 - Outcome' | null {
  const s = raw.trim();
  if (s.startsWith('1:')) return 'Stage 1 - Output';
  if (s.startsWith('2:')) return 'Stage 2 - Outcome';
  return null;
}

function mapSubThemeStatus(raw: string): 'published' | 'draft' {
  if (raw.trim().toLowerCase().includes('published to site')) return 'published';
  return 'draft';
}

function extractThemeName(raw: string): string {
  const match = raw.match(/^(.+?)\s*\(https?:\/\//);
  if (match) return match[1].trim();
  return raw.trim();
}

function readCsv(filePath: string): Record<string, string>[] {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  console.log(`  CSV loaded: ${rows.length} rows`);
  return rows;
}

// ─── Phase A: fix orphaned subthemes ─────────────────────────────────────────

async function fixOrphans(
  dryRun: boolean,
  csvRows: Record<string, string>[],
  themeMap: Map<string, mongoose.Types.ObjectId>
) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE A — Fix Orphaned Subthemes (theme = null)');
  console.log('═'.repeat(60));

  // Find all subthemes in DB with no theme attached
  const orphans = await SubTheme.find({ $or: [{ theme: null }, { theme: { $exists: false } }] }).lean() as any[];
  console.log(`  Found ${orphans.length} orphaned subthemes in DB`);

  if (orphans.length === 0) {
    console.log('  Nothing to fix.');
    return;
  }

  // Build name → CSV row lookup
  const csvByName = new Map<string, Record<string, string>>();
  for (const row of csvRows) {
    const name = row['Sub-theme name']?.trim();
    if (name) csvByName.set(name, row);
  }

  let fixed = 0, notFound = 0, noTheme = 0;

  for (const orphan of orphans) {
    const csvRow = csvByName.get(orphan.name);
    if (!csvRow) {
      console.warn(`  ⚠️   No CSV row found for orphan: "${orphan.name}"`);
      notFound++;
      continue;
    }

    const rawThemeCell = csvRow['Theme database']?.trim() ?? '';
    const themeName    = rawThemeCell ? extractThemeName(rawThemeCell) : '';
    const themeId      = themeMap.get(themeName);

    if (!themeId) {
      console.warn(`  ⚠️   Theme not in DB for orphan "${orphan.name}" → theme: "${themeName}"`);
      noTheme++;
      continue;
    }

    if (dryRun) {
      console.log(`  🔍  Would fix: "${orphan.name}" → theme: "${themeName}"`);
    } else {
      await SubTheme.findByIdAndUpdate(orphan._id, { theme: themeId });
      console.log(`  ✅  Fixed: "${orphan.name}" → theme: "${themeName}"`);
    }
    fixed++;
  }

  console.log(`\n  Summary: ${fixed} ${dryRun ? 'would be fixed' : 'fixed'}, ${notFound} CSV row missing, ${noTheme} theme not found in DB`);
}

// ─── Phase B: insert missing subthemes ───────────────────────────────────────

async function addMissing(
  dryRun: boolean,
  csvRows: Record<string, string>[],
  themeMap: Map<string, mongoose.Types.ObjectId>
) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE B — Add Missing Subthemes');
  console.log('═'.repeat(60));

  let inserted = 0, skipped = 0, errors = 0, unmatched = 0;

  for (const row of csvRows) {
    const name = row['Sub-theme name']?.trim();
    if (!name) continue;

    const rawThemeCell = row['Theme database']?.trim() ?? '';
    const themeName    = rawThemeCell ? extractThemeName(rawThemeCell) : '';
    const themeId      = themeMap.get(themeName);

    if (!themeId) {
      console.warn(`  ⚠️   "${name}" — theme not matched: "${themeName}"`);
      unmatched++;
      continue;
    }

    const rawToC   = row['ToC Stage']?.trim() ?? '';
    const tocStage = mapToCStageSubTheme(rawToC);

    if (!tocStage) {
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
        console.log(`  🔍  Would insert: "${name}" → "${themeName}" [${tocStage}]`);
        inserted++;
      } else {
        await SubTheme.create({ name, description, theme: themeId, theoryOfChangeStage: tocStage, creator: CREATOR_ID, status, archived: false });
        console.log(`  ✅  Inserted: "${name}" → "${themeName}"`);
        inserted++;
      }
    } catch (err: any) {
      console.error(`  ❌  Error on "${name}": ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  Summary: ${inserted} ${dryRun ? 'would be inserted' : 'inserted'}, ${skipped} already existed, ${errors} errors, ${unmatched} skipped (unmatched theme/stage)`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const only   = args.find(a => a.startsWith('--only='))?.split('=')[1];

  console.log('═'.repeat(60));
  console.log('MIGRATE 2 — Orphan Fix + Missing Subthemes');
  console.log('═'.repeat(60));
  console.log(`Mode : ${dryRun ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}`);
  console.log(`Scope: ${only ?? 'both phases (A fix + B add)'}\n`);

  await connectToDatabase();

  // Load all themes from DB into a name → id map
  const themes = await Theme.find({}).lean() as any[];
  const themeMap = new Map<string, mongoose.Types.ObjectId>();
  for (const t of themes) themeMap.set(t.name, t._id);
  console.log(`  Loaded ${themeMap.size} themes from DB`);

  const csvRows = readCsv(SUBTHEMES_CSV);

  if (!only || only === 'fix') {
    await fixOrphans(dryRun, csvRows, themeMap);
  }

  if (!only || only === 'add') {
    await addMissing(dryRun, csvRows, themeMap);
  }

  // Verification
  const total    = await SubTheme.countDocuments({ creator: CREATOR_ID });
  const orphaned = await SubTheme.countDocuments({ $or: [{ theme: null }, { theme: { $exists: false } }] });
  console.log(`\n  DB state: ${total} subthemes total, ${orphaned} still orphaned`);

  await disconnectFromDatabase();
  console.log(dryRun ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
