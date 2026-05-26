// scripts/migrate3_indicators.ts
//
// Step 3 of 3 — Two phases:
//   Phase A: Insert the ~66 indicators missing from the DB
//   Phase B: Re-run indicator → subtheme linking ($addToSet, safe to re-run)
//
// Reads from _all.csv so no rows are filtered out.
// Idempotent — skips indicators that already exist by name.
// Run AFTER migrate2_subthemes.ts so all subthemes are present.
//
// Usage:
//   npx ts-node scripts/migrate3_indicators.ts                        → dry run
//   npx ts-node scripts/migrate3_indicators.ts --apply                → write
//   npx ts-node scripts/migrate3_indicators.ts --apply --only=add     → only insert
//   npx ts-node scripts/migrate3_indicators.ts --apply --only=link    → only re-link
//   npx ts-node scripts/migrate3_indicators.ts --only=verify

import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Indicator from '../models/indicator.model';
import SubTheme from '../models/subtheme.model';
import Theme from '../models/theme.model';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

const CREATOR_ID = new mongoose.Types.ObjectId('69de4f3869452296f6d0ac98');

const INDICATORS_CSV = path.join(
  __dirname,
  '../data/knowledgebase/Private & Shared/Indicator Development (SMART Log) 30a60bfb014e806f8e3adb04271bfcdf_all.csv'
);

// ─── helpers ─────────────────────────────────────────────────────────────────

function extractName(raw: string): string {
  return raw.replace(/\s*\(https?:\/\/[^)]+\)/g, '').trim();
}

function parseEvidence(raw: string): { source: string; url: string[] } | null {
  if (!raw?.trim()) return null;

  const externalUrls: string[] = [];
  const sourceNames: string[]  = [];

  const entries = raw.split(/,\s*(?=[A-Z\u00C0-\u024F])/);
  for (const entry of entries) {
    const urlMatch = entry.match(/\((https?:\/\/[^)]+)\)/);
    if (urlMatch) {
      const url = urlMatch[1].trim();
      if (!url.includes('notion.so')) externalUrls.push(url);
    }
    const name = entry.replace(/\s*\(https?:\/\/[^)]+\)/g, '').trim();
    if (name) sourceNames.push(name);
  }

  const source = sourceNames.join('; ');
  if (!source && externalUrls.length === 0) return null;
  return { source: source.substring(0, 1000), url: externalUrls };
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

// ─── Phase A: insert missing indicators ──────────────────────────────────────

async function addMissingIndicators(
  dryRun: boolean,
  csvRows: Record<string, string>[]
): Promise<Map<string, mongoose.Types.ObjectId>> {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE A — Add Missing Indicators');
  console.log('═'.repeat(60));

  const indicatorMap = new Map<string, mongoose.Types.ObjectId>();

  // Pre-populate map with everything already in DB
  const existing = await Indicator.find({}).lean() as any[];
  for (const ind of existing) indicatorMap.set(ind.name, ind._id);
  console.log(`  Found ${existing.length} existing indicators in DB`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const row of csvRows) {
    const name = row['Indicator statement']?.trim();
    if (!name) continue;

    if (indicatorMap.has(name)) {
      skipped++;
      continue;
    }

    const description = row['Indicator descriptor']?.trim() || undefined;
    const evidence    = parseEvidence(row['Indicator sources'] ?? '');
    const label       = name.length > 80 ? name.substring(0, 77) + '...' : name;

    try {
      if (dryRun) {
        console.log(`  🔍  Would insert: "${label}"`);
        indicatorMap.set(name, new mongoose.Types.ObjectId());
        inserted++;
      } else {
        const ind = await Indicator.create({
          name, description, evidence: evidence ?? null,
          creator: CREATOR_ID, status: 'active', archived: false,
        });
        indicatorMap.set(name, ind._id as mongoose.Types.ObjectId);
        console.log(`  ✅  Inserted: "${label}"`);
        inserted++;
      }
    } catch (err: any) {
      console.error(`  ❌  Error on "${label}": ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  Summary: ${inserted} ${dryRun ? 'would be inserted' : 'inserted'}, ${skipped} already existed, ${errors} errors`);
  return indicatorMap;
}

// ─── Phase B: link indicators → subthemes ────────────────────────────────────

async function linkIndicators(
  dryRun: boolean,
  csvRows: Record<string, string>[],
  indicatorMap: Map<string, mongoose.Types.ObjectId>
) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE B — Link Indicators → Subthemes');
  console.log('═'.repeat(60));

  // Build subThemeName → Set<indicatorId>
  const subThemeToIndicators = new Map<string, Set<string>>();

  for (const row of csvRows) {
    const indicatorName = row['Indicator statement']?.trim();
    if (!indicatorName) continue;
    const indicatorId = indicatorMap.get(indicatorName);
    if (!indicatorId) continue;

    const rawCell = row['Sub-themes']?.trim();
    if (!rawCell) continue;

    const subThemeName = extractName(rawCell);
    if (!subThemeName) continue;

    if (!subThemeToIndicators.has(subThemeName)) subThemeToIndicators.set(subThemeName, new Set());
    subThemeToIndicators.get(subThemeName)!.add(indicatorId.toString());
  }

  let linked = 0, missing = 0;

  for (const [subThemeName, idSet] of subThemeToIndicators.entries()) {
    const subTheme = await SubTheme.findOne({ name: subThemeName });
    if (!subTheme) {
      console.warn(`  ⚠️   SubTheme not found: "${subThemeName}"`);
      missing++;
      continue;
    }

    const ids = Array.from(idSet).map(id => new mongoose.Types.ObjectId(id));

    if (dryRun) {
      console.log(`  🔍  Would link ${ids.length} indicator(s) → "${subThemeName}"`);
    } else {
      await SubTheme.updateOne({ _id: subTheme._id }, { $addToSet: { indicatorTags: { $each: ids } } });
      console.log(`  ✅  Linked ${ids.length} indicator(s) → "${subThemeName}"`);
    }
    linked++;
  }

  console.log(`\n  Summary: ${linked} subthemes ${dryRun ? 'would be updated' : 'updated'}, ${missing} subthemes not found`);
}

// ─── Phase C: verify ─────────────────────────────────────────────────────────

async function verify() {
  console.log('\n' + '═'.repeat(60));
  console.log('VERIFY');
  console.log('═'.repeat(60));

  const themes     = await Theme.countDocuments({ creator: CREATOR_ID });
  const subthemes  = await SubTheme.countDocuments({ creator: CREATOR_ID });
  const orphans    = await SubTheme.countDocuments({ $or: [{ theme: null }, { theme: { $exists: false } }] });
  const indicators = await Indicator.countDocuments({ creator: CREATOR_ID });
  const linked     = await SubTheme.countDocuments({ creator: CREATOR_ID, indicatorTags: { $exists: true, $not: { $size: 0 } } });

  console.log(`  Themes              : ${themes}`);
  console.log(`  Subthemes           : ${subthemes} (${orphans} orphaned)`);
  console.log(`  Indicators          : ${indicators}`);
  console.log(`  Subthemes w/ links  : ${linked}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const only   = args.find(a => a.startsWith('--only='))?.split('=')[1];

  console.log('═'.repeat(60));
  console.log('MIGRATE 3 — Missing Indicators + Re-link');
  console.log('═'.repeat(60));
  console.log(`Mode : ${dryRun ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}`);
  console.log(`Scope: ${only ?? 'both phases (A add + B link)'}\n`);

  await connectToDatabase();

  const csvRows = readCsv(INDICATORS_CSV);

  let indicatorMap = new Map<string, mongoose.Types.ObjectId>();

  if (!only || only === 'add') {
    indicatorMap = await addMissingIndicators(dryRun, csvRows);
  }

  if (!only || only === 'link') {
    if (only === 'link') {
      // Running link in isolation — reload from DB
      const all = await Indicator.find({}).lean() as any[];
      for (const i of all) indicatorMap.set(i.name, i._id);
      console.log(`  Loaded ${indicatorMap.size} indicators from DB for linking`);
    }
    await linkIndicators(dryRun, csvRows, indicatorMap);
  }

  if (only === 'verify' || (!dryRun && !only)) {
    await verify();
  }

  await disconnectFromDatabase();
  console.log(dryRun ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
