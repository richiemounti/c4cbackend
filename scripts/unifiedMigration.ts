// scripts/unifiedMigration.ts
//
// Single authoritative migration script. Replaces:
//   fixBothTemplates.ts, updateProjectTasks.ts, fixHorticulturalCrops.ts,
//   reorderSiteTasks.ts
//
// Usage:
//   npx ts-node scripts/unifiedMigration.ts                    → DRY RUN (safe, no writes)
//   npx ts-node scripts/unifiedMigration.ts --apply            → apply all phases
//   npx ts-node scripts/unifiedMigration.ts --apply --only=templates
//   npx ts-node scripts/unifiedMigration.ts --apply --only=documents
//   npx ts-node scripts/unifiedMigration.ts --apply --only=reorder
//   npx ts-node scripts/unifiedMigration.ts --only=verify      → verify after applying

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ProjectSetup from '../models/projectSetupTask.model';
import ProjectSiteSetup from '../models/projectSiteSetupTask.model';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Shared correct option lists (single source of truth)
// These fix the original CSV-parsing bug where commas inside parentheses
// caused options to be split incorrectly e.g. "Hot desert (e.g. Sahara, Gobi)"
// became two entries: "Hot desert (e.g. Sahara" and "Gobi)"
// ─────────────────────────────────────────────────────────────────────────────

const ECOLOGICAL_ZONE_OPTIONS = [
  'Tropical rainforest (lowland or montane)',
  'Dry deciduous forest',
  'Miombo woodland',
  'Temperate deciduous forest',
  'Boreal forest (taiga)',
  'Mixed conifer–broadleaf forest',
  'Riparian forest',
  'Savannah',
  'Temperate grassland or steppe',
  'Acacia–commiphora bushland',
  'Alpine grassland or heath',
  'Shrubland or scrubland (e.g. Mediterranean maquis)',
  'Mangrove',
  'Wetland / floodplain',
  'Peatland / bog',
  'Riverine / delta system',
  'Semi-arid shrubland',
  'Cold desert (e.g. Tibetan Plateau)',
  'Hot desert (e.g. Sahara, Gobi)',           // ← was split into 2 entries from CSV
  'Agro-ecosystem (farming landscape)',
  'Pastoral landscape',
  'Urban / peri-urban mosaic',
  'Plantation forest / managed timber area',
  'Other (please specify)',
];

const INCOME_SOURCE_OPTIONS = [
  'Subsistence farming',
  'Commercial agriculture',
  'Livestock keeping',
  'Fishing',
  'Timber harvesting',
  'Charcoal production',
  'Mining or quarrying',
  'Crafts or artisanal work',
  'Small business or trade',
  'Public sector work (e.g. teaching, health)', // ← was split into 2 entries from CSV
  'Tourism-related income',
  'Day labour or seasonal work',
  'Remittances',
  'None',
  'Other (please specify)',
];

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT SETUP — task changes
// Verified against the actual DB document (document 10)
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_TASK_UPDATES: Array<{
  fieldName: string;
  changes: Record<string, any>;
  description: string;
}> = [
  {
    fieldName: 'villages',
    changes: {
      dataType: 'string',
      helperText: 'List the villages that are covered by this project',
    },
    description: 'Change to string, update helper text',
  },
  {
    fieldName: 'gps_coordinates',
    changes: {
      dataType: 'string',
      fieldLabel: 'Enter the Google Maps link for the project location.',
      helperText: 'Paste the URL from Google Maps that shows the main project site',
      description: 'Paste the URL from Google Maps that shows the main project site',
    },
    description: 'Change to string (Google Maps URL), update labels',
  },
  {
    fieldName: 'shapefiles_uploaded',
    changes: {
      isRequired: false,
      dataType: 'boolean',
      helperText:
        'Select Yes if you have shapefiles for the project boundary. A file upload section will appear after selecting Yes, where you can attach your boundary shapefiles.',
    },
    description: 'Keep as boolean with conditional file upload trigger (Yes → upload section appears); removed incorrect file-type override from earlier migration',
  },
  {
    fieldName: 'ecological_zone',
    changes: {
      // FIX: CSV parsing split "Hot desert (e.g. Sahara, Gobi)" into two options.
      // Confirmed broken in real document: options has "Hot desert (e.g. Sahara" and "Gobi)" as separate entries.
      options: ECOLOGICAL_ZONE_OPTIONS,
    },
    description: 'Fix CSV-split options: "Hot desert (e.g. Sahara, Gobi)" was incorrectly split into two entries',
  },
  {
    fieldName: 'governance_notes',
    changes: {
      helperText:
        'Explain how the project is governed at different levels. You might include: Who gave permission for the project (e.g., village assembly, district council, government agency)? Which organizations or actors are involved in implementation? Who is responsible for oversight, enforcement, or reporting? Whether any public–private or customary–formal partnerships are in place?',
    },
    description: 'Fix grammar in helper text',
  },
  {
    fieldName: 'approval_granted_by',
    changes: {
      dataType: 'array',
      options: [],
      description: 'User can input their own tags for approval authorities',
      helperText:
        'Add the authorities who granted approval for this project. Press Enter or click + to add each authority as a tag.',
    },
    description: 'Convert to free-entry tag array (empty options = user types their own)',
  },
  {
    fieldName: 'implementing_organisations',
    changes: {
      dataType: 'array',
      options: [],
      description: 'User can input their own tags for implementing organizations',
      helperText:
        'Add the organizations implementing this project. Press Enter or click + to add each organization as a tag.',
    },
    description: 'Convert to free-entry tag array',
  },
  {
    fieldName: 'oversight_authorities',
    changes: {
      dataType: 'array',
      options: [],
      description: 'User can input their own tags for oversight authorities',
      helperText:
        'Add the authorities overseeing this project. Press Enter or click + to add each authority as a tag.',
      isRequired: false,
    },
    description: 'Convert to free-entry tag array, make optional',
  },
  {
    fieldName: 'partnership_type',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'customary_institutions_involved',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'customary_institutions_details',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'customary_rights_holder',
    changes: {
      options: [
        'Entire community (via village assembly or council)',
        'Clan or lineage group',
        'Traditional leader (e.g. chief, elder, sub-chief)',
        "Women's land use group",
        'Youth or pastoral subgroup',
        'Sacred site custodians',
        'Customary trust or association',
        'Other (please specify)',
      ],
    },
    description: 'Fix options array (was mis-parsed from CSV)',
  },
  {
    fieldName: 'land_agreements_uploaded',
    changes: {
      dataType: 'boolean',
      helperText:
        'Select Yes if you have land agreements or MOUs to upload. A file upload section will appear after selecting Yes. Attach contracts, community agreements, FPIC documentation, or land use approvals — upload as many documents as needed.',
    },
    description: 'Keep as boolean with conditional file upload trigger; update helper text to describe Yes → upload section behaviour',
  },
  {
    fieldName: 'conflict_notes',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'access_issues',
    changes: {
      helperText:
        "Select 'yes' if the project area is hard to reach due to poor roads, difficult terrain, seasonal flooding, lack of transport, or security concerns. Consider if this presents any risks to the project and if so complete the risk register.",
    },
    description: 'Add risk register reference to helper text',
  },
  {
    fieldName: 'access_notes',
    changes: { isRequired: false, helperText: 'Briefly explain.' },
    description: 'Make optional, shorten helper text',
  },
  {
    fieldName: 'previous_failure_notes',
    changes: { isRequired: false },
    description: 'Make optional',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT SITE SETUP — task changes
// Verified against the actual DB document (document 11)
// ─────────────────────────────────────────────────────────────────────────────

const SITE_TASK_UPDATES: Array<{
  fieldName: string;
  changes: Record<string, any>;
  description: string;
}> = [
  {
    fieldName: 'site_location_description',
    changes: {
      fieldLabel: 'Site location description',
      isRequired: false,
      helperText: 'Paste the URL from Google Maps that shows the main site',
    },
    description: 'Make optional, update helper text to Google Maps URL prompt',
  },
  {
    fieldName: 'admin_level_1',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'admin_level_2',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'admin_level_3',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'gps_coordinates',
    changes: {
      dataType: 'string',
      isRequired: false,
      helperText: 'Paste the URL from Google Maps that shows the main site location.',
    },
    description: 'Change to string (Google Maps URL), make optional',
  },
  {
    fieldName: 'site_hectare_coverage',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'site_ecological_zone',
    changes: {
      hoverText: '',
      // FIX: Same CSV-split bug as ecological_zone — "Hot desert (e.g. Sahara, Gobi)"
      // was split into two entries. Confirmed in real document.
      options: ECOLOGICAL_ZONE_OPTIONS,
    },
    description: 'Clear hover text, fix CSV-split options for Hot desert',
  },
  {
    fieldName: 'gender_distribution',
    changes: { dataType: 'string', isRequired: false },
    description: 'Change to free-text string, make optional',
  },
  {
    fieldName: 'age_distribution',
    changes: { dataType: 'string', isRequired: false },
    description: 'Change to free-text string, make optional',
  },
  {
    fieldName: 'ethnic_groups_present',
    changes: {
      dataType: 'array',
      options: [],
      description: 'User can input their own tags for ethnic groups',
    },
    description: 'Convert to free-entry tag array',
  },
  {
    fieldName: 'vulnerability_indicators',
    changes: { isRequired: false },
    description: 'Make optional',
  },
  {
    fieldName: 'education_summary',
    changes: {
      dataType: 'array',
      options: [
        'Most have not completed primary school',
        'Most completed primary school',
        'Mixed primary and secondary',
        'Most completed secondary school',
        'Many have vocational or technical training',
        'Some have college or university education',
        'Unknown',
      ],
    },
    description: 'Change to single-select array with predefined options',
  },
  {
    fieldName: 'primary_income_sources',
    changes: {
      // FIX: CSV parsing split "Public sector work (e.g. teaching, health)" into two options.
      // Confirmed broken in real document: "Public sector work (e.g. teaching" and "health)" are separate entries.
      options: INCOME_SOURCE_OPTIONS,
    },
    description: 'Fix CSV-split options: "Public sector work (e.g. teaching, health)" was incorrectly split',
  },
  {
    fieldName: 'secondary_income_sources',
    changes: {
      isRequired: false,
      // FIX: Same CSV-split bug as primary_income_sources
      options: INCOME_SOURCE_OPTIONS,
    },
    description: 'Make optional, fix CSV-split options for Public sector work',
  },
  {
    fieldName: 'cultivated_land_size',
    changes: {
      dataType: 'array',
      options: [
        'None',
        '0.5 hectares or less',
        '0.5–2 hectares',
        '2–5 hectares',
        'More than 5 hectares',
        'Highly variable',
        'Unknown',
      ],
    },
    description: 'Change to single-select array with predefined options',
  },
  {
    fieldName: 'crops_grown',
    changes: {
      options: [
        'Maize',
        'Upland rice',
        'Paddy rice',
        'Cassava',
        'Millet',
        'Sorghum',
        'Sesame',
        'Groundnuts',
        'Sunflower',
        'Cashew',
        'Soybean',
        'Tobacco',
        'Beans',
        'Pigeon pea',
        'Horticultural crops (e.g. tomato, onion)', // was split in original CSV
        'Banana or plantain',
        'Sugarcane',
        'Other (please specify)',
      ],
    },
    description: 'Fix horticultural crops option (was incorrectly split from original CSV import)',
  },
  {
    fieldName: 'livestock_profile',
    changes: {
      dataType: 'object',
      description: 'Two-part selection: livestock type and quantity range',
      options: [],
    },
    description: 'Change to structured object (type + quantity bands)',
  },
  {
    fieldName: 'wildlife_conflict_summary',
    changes: {
      dataType: 'object',
      description: 'Two-part selection: species and frequency',
      isRequired: false,
      options: [],
    },
    description: 'Change to structured object (species + frequency), make optional',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sort order changes for PROJECT SITE tasks
// Verified against real document: gps is at sortOrder 2, location_description at 3
// ─────────────────────────────────────────────────────────────────────────────

const SITE_SORT_ORDER: Array<{ fieldName: string; newSortOrder: number }> = [
  { fieldName: 'gps_coordinates', newSortOrder: 2 },
  { fieldName: 'site_location_description', newSortOrder: 3 },
  { fieldName: 'admin_level_1', newSortOrder: 4 },
  { fieldName: 'admin_level_2', newSortOrder: 5 },
  { fieldName: 'admin_level_3', newSortOrder: 6 },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function applyChangesToTasks(
  tasks: any[],
  updates: Array<{ fieldName: string; changes: Record<string, any> }>
): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const { fieldName, changes } of updates) {
    const idx = tasks.findIndex((t: any) => t.fieldName === fieldName);
    if (idx !== -1) {
      Object.assign(tasks[idx], changes);
      matched.push(fieldName);
    } else {
      missing.push(fieldName);
    }
  }

  return { matched, missing };
}

async function updateExistingDocs(
  Model: typeof ProjectSetup | typeof ProjectSiteSetup,
  fieldName: string,
  changes: Record<string, any>,
  dryRun: boolean
): Promise<number> {
  const matchCriteria = { 'tasks.fieldName': fieldName };

  if (dryRun) {
    return Model.countDocuments(matchCriteria);
  }

  const setMap: Record<string, any> = {};
  for (const [key, value] of Object.entries(changes)) {
    setMap[`tasks.$.${key}`] = value;
  }

  const result = await Model.updateMany(matchCriteria, { $set: setMap });
  return result.modifiedCount;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE A — Update templates
// ─────────────────────────────────────────────────────────────────────────────

async function updateTemplates(dryRun: boolean) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE A — Templates');
  console.log('═'.repeat(60));

  const collection = mongoose.connection.collection('tasktemplates');

  const projectTemplate: any = await collection.findOne({ type: 'project', isActive: true });
  if (!projectTemplate) {
    console.error('❌  No active project template found. Run activateTemplates.ts first.');
  } else {
    console.log(`\n[project template]  id=${projectTemplate._id}  tasks=${projectTemplate.tasks.length}`);
    const { matched, missing } = applyChangesToTasks(projectTemplate.tasks, PROJECT_TASK_UPDATES);

    if (!dryRun) {
      await collection.updateOne(
        { _id: projectTemplate._id },
        { $set: { tasks: projectTemplate.tasks, updatedAt: new Date() } }
      );
      console.log(`  ✅  Updated ${matched.length} tasks`);
    } else {
      console.log(`  🔍  Would update ${matched.length} tasks`);
    }
    if (missing.length) console.log(`  ⚠️   Fields not found in template: ${missing.join(', ')}`);
  }

  const siteTemplate: any = await collection.findOne({ type: 'projectSite', isActive: true });
  if (!siteTemplate) {
    console.error('❌  No active projectSite template found. Run activateTemplates.ts first.');
  } else {
    console.log(`\n[projectSite template]  id=${siteTemplate._id}  tasks=${siteTemplate.tasks.length}`);
    const { matched, missing } = applyChangesToTasks(siteTemplate.tasks, SITE_TASK_UPDATES);

    for (const { fieldName, newSortOrder } of SITE_SORT_ORDER) {
      const idx = siteTemplate.tasks.findIndex((t: any) => t.fieldName === fieldName);
      if (idx !== -1) siteTemplate.tasks[idx].sortOrder = newSortOrder;
    }

    if (!dryRun) {
      await collection.updateOne(
        { _id: siteTemplate._id },
        { $set: { tasks: siteTemplate.tasks, updatedAt: new Date() } }
      );
      console.log(`  ✅  Updated ${matched.length} tasks (+ sort order)`);
    } else {
      console.log(`  🔍  Would update ${matched.length} tasks (+ sort order)`);
    }
    if (missing.length) console.log(`  ⚠️   Fields not found in template: ${missing.join(', ')}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE B — Update existing ProjectSetup / ProjectSiteSetup documents
// ─────────────────────────────────────────────────────────────────────────────

async function updateExistingDocuments(dryRun: boolean) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE B — Existing documents');
  console.log('═'.repeat(60));

  console.log('\n[ProjectSetup documents]');
  for (const { fieldName, changes, description } of PROJECT_TASK_UPDATES) {
    const count = await updateExistingDocs(ProjectSetup, fieldName, changes, dryRun);
    console.log(`  ${dryRun ? '🔍' : '✅'}  ${fieldName}: ${count} doc(s)  — ${description}`);
  }

  console.log('\n[ProjectSiteSetup documents]');
  for (const { fieldName, changes, description } of SITE_TASK_UPDATES) {
    const count = await updateExistingDocs(ProjectSiteSetup, fieldName, changes, dryRun);
    console.log(`  ${dryRun ? '🔍' : '✅'}  ${fieldName}: ${count} doc(s)  — ${description}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE C — Reorder site task sort orders in existing documents
// ─────────────────────────────────────────────────────────────────────────────

async function reorderSiteTasks(dryRun: boolean) {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE C — Site task sort order');
  console.log('═'.repeat(60));

  for (const { fieldName, newSortOrder } of SITE_SORT_ORDER) {
    const matchCriteria = { 'tasks.fieldName': fieldName };

    if (dryRun) {
      const count = await ProjectSiteSetup.countDocuments(matchCriteria);
      console.log(`  🔍  ${fieldName} → sortOrder ${newSortOrder}  (${count} doc(s) would be updated)`);
    } else {
      const result = await ProjectSiteSetup.updateMany(matchCriteria, {
        $set: { 'tasks.$.sortOrder': newSortOrder },
      });
      console.log(`  ✅  ${fieldName} → sortOrder ${newSortOrder}  (${result.modifiedCount} doc(s) updated)`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE D — Verification: spot-check real docs against expected values
// Run with --only=verify after applying to confirm everything landed correctly
// ─────────────────────────────────────────────────────────────────────────────

async function verifyDocuments() {
  console.log('\n' + '═'.repeat(60));
  console.log('PHASE D — Verification (sample check)');
  console.log('═'.repeat(60));

  const checksProject: Array<{ fieldName: string; check: string; expected: any; getter: (t: any) => any }> = [
    { fieldName: 'ecological_zone', check: 'options length', expected: ECOLOGICAL_ZONE_OPTIONS.length, getter: (t) => t.options?.length },
    { fieldName: 'ecological_zone', check: 'no split "Gobi)" entry', expected: false, getter: (t) => t.options?.includes('Gobi)') },
    { fieldName: 'villages', check: 'dataType is string', expected: 'string', getter: (t) => t.dataType },
    { fieldName: 'gps_coordinates', check: 'dataType is string', expected: 'string', getter: (t) => t.dataType },
    { fieldName: 'shapefiles_uploaded', check: 'dataType is boolean', expected: 'boolean', getter: (t) => t.dataType },
    { fieldName: 'shapefiles_uploaded', check: 'isRequired is false', expected: false, getter: (t) => t.isRequired },
    { fieldName: 'oversight_authorities', check: 'isRequired is false', expected: false, getter: (t) => t.isRequired },
    { fieldName: 'conflict_notes', check: 'isRequired is false', expected: false, getter: (t) => t.isRequired },
    { fieldName: 'access_notes', check: 'isRequired is false', expected: false, getter: (t) => t.isRequired },
  ];

  const checksSite: Array<{ fieldName: string; check: string; expected: any; getter: (t: any) => any }> = [
    { fieldName: 'site_ecological_zone', check: 'options length', expected: ECOLOGICAL_ZONE_OPTIONS.length, getter: (t) => t.options?.length },
    { fieldName: 'site_ecological_zone', check: 'no split "Gobi)" entry', expected: false, getter: (t) => t.options?.includes('Gobi)') },
    { fieldName: 'site_ecological_zone', check: 'hoverText is empty', expected: '', getter: (t) => t.hoverText },
    { fieldName: 'primary_income_sources', check: 'options length', expected: INCOME_SOURCE_OPTIONS.length, getter: (t) => t.options?.length },
    { fieldName: 'primary_income_sources', check: 'no split "health)" entry', expected: false, getter: (t) => t.options?.includes('health)') },
    { fieldName: 'secondary_income_sources', check: 'options length', expected: INCOME_SOURCE_OPTIONS.length, getter: (t) => t.options?.length },
    { fieldName: 'secondary_income_sources', check: 'isRequired is false', expected: false, getter: (t) => t.isRequired },
    { fieldName: 'crops_grown', check: 'no split horticultural entry', expected: false, getter: (t) => t.options?.some((o: string) => o === 'Horticultural crops (e.g. tomato') },
    { fieldName: 'gps_coordinates', check: 'sortOrder is 2', expected: 2, getter: (t) => t.sortOrder },
    { fieldName: 'site_location_description', check: 'sortOrder is 3', expected: 3, getter: (t) => t.sortOrder },
    { fieldName: 'gender_distribution', check: 'dataType is string', expected: 'string', getter: (t) => t.dataType },
    { fieldName: 'wildlife_conflict_summary', check: 'isRequired is false', expected: false, getter: (t) => t.isRequired },
  ];

  const sampleProject = await ProjectSetup.findOne({});
  if (sampleProject) {
    console.log(`\n[ProjectSetup sample: ${sampleProject._id}]`);
    for (const { fieldName, check, expected, getter } of checksProject) {
      const task = sampleProject.tasks.find((t: any) => t.fieldName === fieldName);
      if (!task) { console.log(`  ⚠️   ${fieldName} — task not found in document`); continue; }
      const actual = getter(task);
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      console.log(`  ${pass ? '✅' : '❌'}  ${fieldName} — ${check}: expected=${JSON.stringify(expected)}, got=${JSON.stringify(actual)}`);
    }
  } else {
    console.log('  ⚠️   No ProjectSetup documents found to verify.');
  }

  const sampleSite = await ProjectSiteSetup.findOne({});
  if (sampleSite) {
    console.log(`\n[ProjectSiteSetup sample: ${sampleSite._id}]`);
    for (const { fieldName, check, expected, getter } of checksSite) {
      const task = sampleSite.tasks.find((t: any) => t.fieldName === fieldName);
      if (!task) { console.log(`  ⚠️   ${fieldName} — task not found in document`); continue; }
      const actual = getter(task);
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      console.log(`  ${pass ? '✅' : '❌'}  ${fieldName} — ${check}: expected=${JSON.stringify(expected)}, got=${JSON.stringify(actual)}`);
    }
  } else {
    console.log('  ⚠️   No ProjectSiteSetup documents found to verify.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRYPOINT
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];

  console.log('═'.repeat(60));
  console.log('YOUTH IMPACT UNIFIED MIGRATION SCRIPT');
  console.log('═'.repeat(60));
  console.log(`Mode  : ${dryRun ? '🔍 DRY RUN  (add --apply to write)' : '⚠️  APPLYING CHANGES'}`);
  console.log(`Scope : ${only ?? 'all phases (A templates + B documents + C reorder + D verify)'}`);
  console.log('');

  try {
    await connectToDatabase();

    if (!only || only === 'templates') await updateTemplates(dryRun);
    if (!only || only === 'documents') await updateExistingDocuments(dryRun);
    if (!only || only === 'reorder') await reorderSiteTasks(dryRun);
    if (only === 'verify' || (!dryRun && !only)) await verifyDocuments();

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

export { run as runUnifiedMigration };