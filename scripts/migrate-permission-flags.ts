// scripts/migrate-permission-flags.ts
//
// One-time data migration: converts each user.roles[] entry's `permissions` field
// from the old string-array shape (Option B: ['submit_data', 'invite_users', ...])
// to the new IPermissions boolean-object shape, and backfills `isOrgAdmin` so that
// existing `manager` role entries keep the blanket org/project access they had
// before hasProjectAccess()/hasPermission() started checking `isOrgAdmin` instead
// of `role === 'manager'`.
//
// Operates on the raw `users` collection (not the Mongoose model) so it works
// regardless of whether the new schema has already been deployed — reading old
// array-shaped `permissions` data through the new object-shaped schema would
// otherwise risk a cast mismatch.
//
// Run with: npm run migrate:permission-flags       (dry run, no writes)
//           npm run migrate:permission-flags -- --apply   (applies changes)

import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';
import mongoose from 'mongoose';

const LEGACY_STRING_TO_FLAG: Record<string, string> = {
  submit_data: 'submitData',
  data_collector: 'useDataCollector',
  risk_register: 'viewRiskRegister',
  report: 'generateReports',
  learn_and_tell: 'learnAndTell',
  invite_users: 'inviteUsers',
};

const DEFAULT_PERMISSIONS = {
  submitData: false,
  useDataCollector: false,
  viewRiskRegister: false,
  generateReports: false,
  learnAndTell: false,
  inviteUsers: false,
};

function convertPermissions(rawPermissions: unknown): Record<string, boolean> {
  const flags = { ...DEFAULT_PERMISSIONS };
  if (Array.isArray(rawPermissions)) {
    for (const value of rawPermissions) {
      const key = LEGACY_STRING_TO_FLAG[value];
      if (key) flags[key as keyof typeof flags] = true;
    }
  }
  return flags;
}

async function migratePermissionFlags() {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  const dryRun = !shouldApply;

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('Add --apply flag to actually apply changes\n');
  } else {
    console.log('⚠️  APPLYING CHANGES - This will modify the database\n');
  }

  await connectToDatabase();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  const usersCollection = db.collection('users');
  const users = await usersCollection.find({}).toArray();

  console.log(`Found ${users.length} user(s) to check.\n`);

  let usersChanged = 0;
  let rolesConverted = 0;
  let orgAdminBackfilled = 0;

  for (const user of users) {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    let userChanged = false;

    const newRoles = roles.map((role: any) => {
      const updatedRole = { ...role };

      if (updatedRole.isOrgAdmin === undefined || updatedRole.isOrgAdmin === null) {
        updatedRole.isOrgAdmin = updatedRole.role === 'manager';
        userChanged = true;
        orgAdminBackfilled++;
      }

      if (Array.isArray(updatedRole.permissions) || updatedRole.permissions === undefined || updatedRole.permissions === null) {
        updatedRole.permissions = convertPermissions(updatedRole.permissions);
        userChanged = true;
        rolesConverted++;
      }

      return updatedRole;
    });

    if (userChanged) {
      usersChanged++;
      console.log(`👤 ${user.email}: ${newRoles.length} role entry(ies) updated`);

      if (!dryRun) {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { roles: newRoles } }
        );
      }
    }
  }

  console.log(`\nSummary: ${usersChanged} user(s) affected, ${rolesConverted} role.permissions field(s) converted, ${orgAdminBackfilled} isOrgAdmin field(s) backfilled.`);

  if (dryRun) {
    console.log('\nThis was a dry run — no data was written. Re-run with --apply to persist these changes.');
  } else {
    console.log('\n✅ Migration applied.');
  }

  await disconnectFromDatabase();
}

if (require.main === module) {
  migratePermissionFlags()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export default migratePermissionFlags;
