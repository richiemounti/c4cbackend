"use strict";
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
const mongodb_1 = require("../database/mongodb");
const mongoose_1 = __importDefault(require("mongoose"));
const LEGACY_STRING_TO_FLAG = {
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
function convertPermissions(rawPermissions) {
    const flags = Object.assign({}, DEFAULT_PERMISSIONS);
    if (Array.isArray(rawPermissions)) {
        for (const value of rawPermissions) {
            const key = LEGACY_STRING_TO_FLAG[value];
            if (key)
                flags[key] = true;
        }
    }
    return flags;
}
function migratePermissionFlags() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = process.argv.slice(2);
        const shouldApply = args.includes('--apply');
        const dryRun = !shouldApply;
        if (dryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made');
            console.log('Add --apply flag to actually apply changes\n');
        }
        else {
            console.log('⚠️  APPLYING CHANGES - This will modify the database\n');
        }
        yield (0, mongodb_1.connectToDatabase)();
        const db = mongoose_1.default.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }
        const usersCollection = db.collection('users');
        const users = yield usersCollection.find({}).toArray();
        console.log(`Found ${users.length} user(s) to check.\n`);
        let usersChanged = 0;
        let rolesConverted = 0;
        let orgAdminBackfilled = 0;
        for (const user of users) {
            const roles = Array.isArray(user.roles) ? user.roles : [];
            let userChanged = false;
            const newRoles = roles.map((role) => {
                const updatedRole = Object.assign({}, role);
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
                    yield usersCollection.updateOne({ _id: user._id }, { $set: { roles: newRoles } });
                }
            }
        }
        console.log(`\nSummary: ${usersChanged} user(s) affected, ${rolesConverted} role.permissions field(s) converted, ${orgAdminBackfilled} isOrgAdmin field(s) backfilled.`);
        if (dryRun) {
            console.log('\nThis was a dry run — no data was written. Re-run with --apply to persist these changes.');
        }
        else {
            console.log('\n✅ Migration applied.');
        }
        yield (0, mongodb_1.disconnectFromDatabase)();
    });
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
exports.default = migratePermissionFlags;
//# sourceMappingURL=migrate-permission-flags.js.map