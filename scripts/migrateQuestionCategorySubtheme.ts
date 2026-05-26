// scripts/migrateQuestionCategorySubtheme.ts
//
// Migrates Question documents from singular category/subTheme fields
// to plural categories[]/subThemes[] arrays.
//
// Usage:
//   npx ts-node scripts/migrateQuestionCategorySubtheme.ts              → DRY RUN (safe, no writes)
//   npx ts-node scripts/migrateQuestionCategorySubtheme.ts --apply      → apply migration
//   npx ts-node scripts/migrateQuestionCategorySubtheme.ts --only=verify → verify after applying

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// PHASE A — Migrate singular fields to arrays
// ─────────────────────────────────────────────────────────────────────────────

async function migrateFields(dryRun: boolean) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE A — Migrate category → categories, subTheme → subThemes');
  console.log('═'.repeat(60));

  const collection = mongoose.connection.collection('questions');

  // ── Category migration ──
  // Find all docs that have the old singular `category` field set
  const withCategory = await collection.countDocuments({
    category: { $exists: true, $ne: null }
  });

  console.log(`\n  Found ${withCategory} question(s) with a singular 'category' field`);

  if (!dryRun && withCategory > 0) {
    // Step 1: For docs that have category, push it into categories array
    const copyResult = await collection.updateMany(
      { category: { $exists: true, $ne: null } },
      [{ $set: { categories: ['$category'] } }]  // aggregate pipeline to reference own field
    );
    console.log(`  ✅  Copied 'category' → 'categories[]' on ${copyResult.modifiedCount} doc(s)`);

    // Step 2: Unset the old field
    const unsetResult = await collection.updateMany(
      { category: { $exists: true } },
      { $unset: { category: '' } }
    );
    console.log(`  ✅  Removed old 'category' field from ${unsetResult.modifiedCount} doc(s)`);
  } else if (dryRun) {
    console.log(`  🔍  Would copy 'category' → 'categories[]' on ${withCategory} doc(s)`);
    console.log(`  🔍  Would remove old 'category' field from ${withCategory} doc(s)`);
  }

  // For docs that have no category at all, ensure categories is initialised as []
  const withoutCategory = await collection.countDocuments({
    category: { $exists: false },
    categories: { $exists: false }
  });

  console.log(`\n  Found ${withoutCategory} question(s) with no category field (will get empty array)`);

  if (!dryRun && withoutCategory > 0) {
    const initResult = await collection.updateMany(
      { category: { $exists: false }, categories: { $exists: false } },
      { $set: { categories: [] } }
    );
    console.log(`  ✅  Initialised empty 'categories[]' on ${initResult.modifiedCount} doc(s)`);
  } else if (dryRun) {
    console.log(`  🔍  Would initialise empty 'categories[]' on ${withoutCategory} doc(s)`);
  }

  // ── SubTheme migration ──
  const withSubTheme = await collection.countDocuments({
    subTheme: { $exists: true, $ne: null }
  });

  console.log(`\n  Found ${withSubTheme} question(s) with a singular 'subTheme' field`);

  if (!dryRun && withSubTheme > 0) {
    // Step 1: Copy into array
    const copyResult = await collection.updateMany(
      { subTheme: { $exists: true, $ne: null } },
      [{ $set: { subThemes: ['$subTheme'] } }]
    );
    console.log(`  ✅  Copied 'subTheme' → 'subThemes[]' on ${copyResult.modifiedCount} doc(s)`);

    // Step 2: Unset old field
    const unsetResult = await collection.updateMany(
      { subTheme: { $exists: true } },
      { $unset: { subTheme: '' } }
    );
    console.log(`  ✅  Removed old 'subTheme' field from ${unsetResult.modifiedCount} doc(s)`);
  } else if (dryRun) {
    console.log(`  🔍  Would copy 'subTheme' → 'subThemes[]' on ${withSubTheme} doc(s)`);
    console.log(`  🔍  Would remove old 'subTheme' field from ${withSubTheme} doc(s)`);
  }

  const withoutSubTheme = await collection.countDocuments({
    subTheme: { $exists: false },
    subThemes: { $exists: false }
  });

  console.log(`\n  Found ${withoutSubTheme} question(s) with no subTheme field (will get empty array)`);

  if (!dryRun && withoutSubTheme > 0) {
    const initResult = await collection.updateMany(
      { subTheme: { $exists: false }, subThemes: { $exists: false } },
      { $set: { subThemes: [] } }
    );
    console.log(`  ✅  Initialised empty 'subThemes[]' on ${initResult.modifiedCount} doc(s)`);
  } else if (dryRun) {
    console.log(`  🔍  Would initialise empty 'subThemes[]' on ${withoutSubTheme} doc(s)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE B — Verification
// ─────────────────────────────────────────────────────────────────────────────

async function verifyMigration() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE B — Verification');
  console.log('═'.repeat(60));

  const collection = mongoose.connection.collection('questions');

  const total = await collection.countDocuments({});

  // Old fields should be gone
  const stillHasCategory = await collection.countDocuments({ category: { $exists: true } });
  const stillHasSubTheme = await collection.countDocuments({ subTheme: { $exists: true } });

  // New fields should exist on every doc
  const missingCategories = await collection.countDocuments({ categories: { $exists: false } });
  const missingSubThemes  = await collection.countDocuments({ subThemes: { $exists: false } });

  // Sanity check: new array fields should be arrays
  const categoriesNotArray = await collection.countDocuments({
    categories: { $exists: true, $not: { $type: 'array' } }
  });
  const subThemesNotArray = await collection.countDocuments({
    subThemes: { $exists: true, $not: { $type: 'array' } }
  });

  // Stats on how many were migrated with data vs empty
  const withCategoryData  = await collection.countDocuments({ categories: { $exists: true, $ne: [] } });
  const withSubThemeData  = await collection.countDocuments({ subThemes:  { $exists: true, $ne: [] } });

  console.log(`\n  Total questions in collection : ${total}`);
  console.log('');
  console.log(`  Old 'category' field still present  : ${stillHasCategory === 0 ? '✅  0' : `❌  ${stillHasCategory}`}`);
  console.log(`  Old 'subTheme' field still present  : ${stillHasSubTheme === 0 ? '✅  0' : `❌  ${stillHasSubTheme}`}`);
  console.log('');
  console.log(`  Missing 'categories' array          : ${missingCategories === 0 ? '✅  0' : `❌  ${missingCategories}`}`);
  console.log(`  Missing 'subThemes' array           : ${missingSubThemes  === 0 ? '✅  0' : `❌  ${missingSubThemes}`}`);
  console.log('');
  console.log(`  'categories' not an array           : ${categoriesNotArray === 0 ? '✅  0' : `❌  ${categoriesNotArray}`}`);
  console.log(`  'subThemes' not an array            : ${subThemesNotArray  === 0 ? '✅  0' : `❌  ${subThemesNotArray}`}`);
  console.log('');
  console.log(`  Questions with category data        : ${withCategoryData}`);
  console.log(`  Questions with subTheme data        : ${withSubThemeData}`);

  // Sample a migrated doc for a visual spot-check
  const sample = await collection.findOne({ categories: { $ne: [] } });
  if (sample) {
    console.log('\n  Sample migrated document:');
    console.log(`    _id        : ${sample._id}`);
    console.log(`    text       : ${String(sample.text).substring(0, 60)}...`);
    console.log(`    categories : ${JSON.stringify(sample.categories)}`);
    console.log(`    subThemes  : ${JSON.stringify(sample.subThemes)}`);
  }

  const passed =
    stillHasCategory === 0 &&
    stillHasSubTheme === 0 &&
    missingCategories === 0 &&
    missingSubThemes  === 0 &&
    categoriesNotArray === 0 &&
    subThemesNotArray  === 0;

  console.log('\n' + '─'.repeat(60));
  console.log(passed ? '✅  All checks passed.' : '❌  Some checks failed — review above.');

  return passed;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRYPOINT
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];

  console.log('═'.repeat(60));
  console.log('QUESTION CATEGORY/SUBTHEME MIGRATION');
  console.log('═'.repeat(60));
  console.log(`Mode  : ${dryRun ? '🔍 DRY RUN  (add --apply to write)' : '⚠️  APPLYING CHANGES'}`);
  console.log(`Scope : ${only ?? 'all phases (A migrate + B verify)'}`);
  console.log('');

  try {
    await connectToDatabase();

    if (!only || only === 'migrate') await migrateFields(dryRun);
    if (only === 'verify' || (!dryRun && !only)) await verifyMigration();

    console.log('\n' + '═'.repeat(60));
    console.log(dryRun ? '🔍 Dry run complete — no writes made.' : '✅ Migration complete.');
    if (dryRun) console.log('    Run with --apply to execute.');
    console.log('═'.repeat(60));
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) run();

export { run as runQuestionCategorySubthemeMigration };