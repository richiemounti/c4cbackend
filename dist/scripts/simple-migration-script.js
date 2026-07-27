"use strict";
// simple-migration-script.ts - Direct MongoDB operations to avoid validation errors
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = require("path");
const dotenv_1 = require("dotenv");
const fs = __importStar(require("fs"));
// Load environment variables
const envPaths = [
    (0, path_1.resolve)(__dirname, '../.env.development.local'),
    (0, path_1.resolve)(__dirname, '../.env.development'),
    (0, path_1.resolve)(__dirname, '../.env.local'),
    (0, path_1.resolve)(__dirname, '../.env')
];
let envLoaded = false;
for (const path of envPaths) {
    if (fs.existsSync(path)) {
        console.log(`Loading environment from ${path}`);
        (0, dotenv_1.config)({ path });
        envLoaded = true;
        break;
    }
}
if (!envLoaded) {
    console.log('No .env file found, using process.env variables');
}
function simpleMigration() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🚀 Starting SIMPLE bug report migration...');
            // Validate and connect to DB
            const dbUri = process.env.DB_URI;
            if (!dbUri) {
                throw new Error('DB_URI environment variable is not set');
            }
            console.log('🔗 Connecting to MongoDB...');
            yield mongoose_1.default.connect(dbUri);
            console.log('✅ Connected successfully!');
            // Get the collection directly (bypasses Mongoose model validation)
            const db = mongoose_1.default.connection.db;
            const collection = db.collection('bugreports');
            console.log('\n📊 Starting data fixes...');
            // 1. Fix urgencyLevel values (most critical)
            console.log('\n🚨 Fixing urgencyLevel...');
            // Fix string "null" values
            let result = yield collection.updateMany({ urgencyLevel: "null" }, { $set: { urgencyLevel: "fix_this_week" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "null"`);
            // Fix "medium"
            result = yield collection.updateMany({ urgencyLevel: "medium" }, { $set: { urgencyLevel: "fix_this_week" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "medium"`);
            // Fix "high"
            result = yield collection.updateMany({ urgencyLevel: "high" }, { $set: { urgencyLevel: "fix_1_3_days" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "high"`);
            // Fix "low"
            result = yield collection.updateMany({ urgencyLevel: "low" }, { $set: { urgencyLevel: "fix_next_month" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "low"`);
            // Fix "critical"
            result = yield collection.updateMany({ urgencyLevel: "critical" }, { $set: { urgencyLevel: "fix_24_hours" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "critical"`);
            // Fix "blocker"
            result = yield collection.updateMany({ urgencyLevel: "blocker" }, { $set: { urgencyLevel: "fix_24_hours" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "blocker"`);
            // Fix actual null values
            result = yield collection.updateMany({ urgencyLevel: null }, { $set: { urgencyLevel: "fix_this_week" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel null`);
            // Fix missing urgencyLevel
            result = yield collection.updateMany({ urgencyLevel: { $exists: false } }, { $set: { urgencyLevel: "fix_this_week" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with missing urgencyLevel`);
            // 2. Fix bugType values
            console.log('\n🔧 Fixing bugType...');
            // Fix string "null" bugType
            result = yield collection.updateMany({ bugType: "null" }, { $set: { bugType: "fix" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with bugType "null"`);
            // Fix actual null bugType
            result = yield collection.updateMany({ bugType: null }, { $set: { bugType: "fix" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with bugType null`);
            // Fix missing bugType
            result = yield collection.updateMany({ bugType: { $exists: false } }, { $set: { bugType: "fix" } });
            console.log(`✅ Fixed ${result.modifiedCount} documents with missing bugType`);
            // 3. Migrate old estimatedEffort field
            console.log('\n🔄 Migrating estimatedEffort to bugType...');
            // Migrate "trivial" -> "fix"
            result = yield collection.updateMany({ estimatedEffort: "trivial" }, {
                $set: { bugType: "fix" },
                $unset: { estimatedEffort: "" }
            });
            console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort "trivial" -> bugType "fix"`);
            // Migrate "minor" -> "fix"
            result = yield collection.updateMany({ estimatedEffort: "minor" }, {
                $set: { bugType: "fix" },
                $unset: { estimatedEffort: "" }
            });
            console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort "minor" -> bugType "fix"`);
            // Migrate "moderate" -> "food_for_thought"
            result = yield collection.updateMany({ estimatedEffort: "moderate" }, {
                $set: { bugType: "food_for_thought" },
                $unset: { estimatedEffort: "" }
            });
            console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort "moderate" -> bugType "food_for_thought"`);
            // Migrate string "null" estimatedEffort
            result = yield collection.updateMany({ estimatedEffort: "null" }, {
                $set: { bugType: "fix" },
                $unset: { estimatedEffort: "" }
            });
            console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort "null" -> bugType "fix"`);
            // Migrate actual null estimatedEffort
            result = yield collection.updateMany({ estimatedEffort: null }, {
                $set: { bugType: "fix" },
                $unset: { estimatedEffort: "" }
            });
            console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort null -> bugType "fix"`);
            // Remove any remaining estimatedEffort fields
            result = yield collection.updateMany({ estimatedEffort: { $exists: true } }, { $unset: { estimatedEffort: "" } });
            console.log(`✅ Removed remaining estimatedEffort fields from ${result.modifiedCount} documents`);
            // 4. Fix assignedToTeamMember
            console.log('\n👥 Fixing assignedToTeamMember...');
            // Remove string "null" values
            result = yield collection.updateMany({ assignedToTeamMember: "null" }, { $unset: { assignedToTeamMember: "" } });
            console.log(`✅ Removed ${result.modifiedCount} assignedToTeamMember "null" values`);
            // Remove empty strings
            result = yield collection.updateMany({ assignedToTeamMember: "" }, { $unset: { assignedToTeamMember: "" } });
            console.log(`✅ Removed ${result.modifiedCount} empty assignedToTeamMember values`);
            // 5. Verification
            console.log('\n🔍 Verifying migration...');
            const totalDocs = yield collection.countDocuments();
            console.log(`📊 Total documents: ${totalDocs}`);
            // Check remaining invalid urgencyLevel values
            const invalidUrgency = yield collection.countDocuments({
                urgencyLevel: {
                    $nin: ['fix_24_hours', 'fix_1_3_days', 'fix_this_week', 'fix_2_weeks', 'fix_next_month', 'later']
                }
            });
            console.log(`⚠️  Documents with invalid urgencyLevel: ${invalidUrgency}`);
            // Check remaining invalid bugType values
            const invalidBugType = yield collection.countDocuments({
                $or: [
                    { bugType: { $nin: ['fix', 'food_for_thought', 'pipeline'] } },
                    { bugType: { $exists: false } }
                ]
            });
            console.log(`⚠️  Documents with invalid/missing bugType: ${invalidBugType}`);
            // Check remaining estimatedEffort fields
            const remainingEstimatedEffort = yield collection.countDocuments({
                estimatedEffort: { $exists: true }
            });
            console.log(`⚠️  Documents with remaining estimatedEffort: ${remainingEstimatedEffort}`);
            if (invalidUrgency === 0 && invalidBugType === 0 && remainingEstimatedEffort === 0) {
                console.log('\n🎉 SUCCESS! All critical issues have been fixed!');
            }
            else {
                console.log('\n⚠️  Some issues remain. You may need to check individual documents.');
            }
        }
        catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
        finally {
            yield mongoose_1.default.connection.close();
            console.log('🔌 Database connection closed');
        }
    });
}
// Run migration
if (require.main === module) {
    simpleMigration()
        .then(() => {
        console.log('\n✅ Simple migration completed!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('\n💥 Simple migration failed:', error);
        process.exit(1);
    });
}
exports.default = simpleMigration;
//# sourceMappingURL=simple-migration-script.js.map