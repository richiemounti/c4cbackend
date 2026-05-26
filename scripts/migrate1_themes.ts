// scripts/migrate1_themes.ts
//
// Step 1 of 3 — Adds the 22 themes missing from the DB.
// Reads from the _all.csv (full export) so no rows are filtered out.
// Fully idempotent — skips themes that already exist by name.
//
// Usage:
//   npx ts-node scripts/migrate1_themes.ts           → dry run
//   npx ts-node scripts/migrate1_themes.ts --apply   → write to DB

import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Theme from '../models/theme.model';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

const CREATOR_ID = new mongoose.Types.ObjectId('69de4f3869452296f6d0ac98');

const THEMES_CSV = path.join(
  __dirname,
  '../data/knowledgebase/Private & Shared 3/Themes 30a60bfb014e8041a28dd7477d55e4db_all.csv'
);

// ─── helpers (identical to seedKnowledgeBase pattern) ────────────────────────

function mapToCStageTheme(raw: string): 'Stage 1 - Output' | 'Stage 2 - Outcome' | 'Both' | null {
  const s = raw.trim();
  if (s.startsWith('1:')) return 'Stage 1 - Output';
  if (s.startsWith('2:')) return 'Stage 2 - Outcome';
  if (s.toLowerCase().includes('both')) return 'Both';
  return null;
}

function mapThemeStatus(raw: string): 'published' | 'draft' {
  const s = raw.trim().toLowerCase();
  if (s.includes('published on platform')) return 'published';
  if (s.includes('in review')) return 'draft';
  return 'draft';
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

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  console.log('═'.repeat(60));
  console.log('MIGRATE 1 — Missing Themes');
  console.log('═'.repeat(60));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}\n`);

  await connectToDatabase();

  const rows = readCsv(THEMES_CSV);

  let inserted = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const name = row['Theme Name']?.trim();
    if (!name) continue;

    const description = row['Descriptor']?.trim() || undefined;
    const tocStage    = mapToCStageTheme(row['ToC Stage'] ?? '');
    const status      = mapThemeStatus(row['Theme Status'] ?? '');

    try {
      const existing = await Theme.findOne({ name });
      if (existing) {
        console.log(`  ⏭️   Already exists: "${name}"`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  🔍  Would insert: "${name}" [toc=${tocStage ?? 'null'}, status=${status}]`);
        inserted++;
      } else {
        await Theme.create({ name, description, theoryOfChangeStage: tocStage, creator: CREATOR_ID, status, archived: false });
        console.log(`  ✅  Inserted: "${name}"`);
        inserted++;
      }
    } catch (err: any) {
      console.error(`  ❌  Error on "${name}": ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  Summary: ${inserted} ${dryRun ? 'would be inserted' : 'inserted'}, ${skipped} already existed, ${errors} errors`);

  // Verification
  const total     = await Theme.countDocuments({ creator: CREATOR_ID });
  const published = await Theme.countDocuments({ creator: CREATOR_ID, status: 'published' });
  console.log(`\n  DB state: ${total} themes total (${published} published)`);

  await disconnectFromDatabase();
  console.log(dryRun ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
