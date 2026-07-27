"use strict";
// check-data-script.ts - TypeScript version with concurrent checking
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
// Load environment variables with better path resolution
const envPaths = [
    (0, path_1.resolve)(__dirname, '../.env.development.local'),
    (0, path_1.resolve)(__dirname, '../.env.development'),
    (0, path_1.resolve)(__dirname, '../.env.local'),
    (0, path_1.resolve)(__dirname, '../.env')
];
// Try to load from the first existing file
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
class BugReportDataChecker {
    constructor() {
        this.db = null;
        this.collection = null;
        // Valid enum values
        this.validEnums = {
            urgencyLevel: ['fix_24_hours', 'fix_1_3_days', 'fix_this_week', 'fix_2_weeks', 'fix_next_month', 'later'],
            status: ['new', 'triaged', 'resolved', 'verified', 'cannot-reproduce', 'duplicate', 'deferred'],
            priority: ['p0', 'p1', 'p2', 'p3', 'p4'],
            bugType: ['fix', 'food_for_thought', 'pipeline'],
            assignedToTeamMember: ['kate', 'sam', 'belinda']
        };
        this.stats = {
            totalDocuments: 0,
            checksPerformed: 0,
            issues: [],
            startTime: new Date()
        };
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log('Starting bug report data check...');
            // Debug environment variables
            console.log('Environment check:');
            console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
            console.log(`DB_URI exists: ${!!process.env.DB_URI}`);
            console.log(`DB_URI length: ${((_a = process.env.DB_URI) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
            // Check if DB_URI starts with the correct format
            if (process.env.DB_URI) {
                const uri = process.env.DB_URI;
                console.log(`DB_URI starts with mongodb: ${uri.startsWith('mongodb://')}`);
                console.log(`DB_URI starts with mongodb+srv: ${uri.startsWith('mongodb+srv://')}`);
                console.log(`DB_URI first 20 chars: ${uri.substring(0, 20)}...`);
            }
            // Validate DB_URI
            const dbUri = process.env.DB_URI;
            if (!dbUri) {
                throw new Error('DB_URI environment variable is not set');
            }
            if (!dbUri.startsWith('mongodb://') && !dbUri.startsWith('mongodb+srv://')) {
                throw new Error(`Invalid DB_URI format. Expected to start with "mongodb://" or "mongodb+srv://", but got: ${dbUri.substring(0, 20)}...`);
            }
            console.log('🔗 Connecting to MongoDB...');
            yield mongoose_1.default.connect(dbUri);
            console.log('✅ Connected to MongoDB successfully!');
            this.db = mongoose_1.default.connection.db; // Assert non-null since we just connected
            this.collection = this.db.collection('bugreports');
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield mongoose_1.default.connection.close();
            console.log('🔌 Database connection closed');
        });
    }
    checkField(fieldName_1, validValues_1) {
        return __awaiter(this, arguments, void 0, function* (fieldName, validValues, allowEmpty = false) {
            if (!this.collection) {
                throw new Error('Collection not initialized');
            }
            // Get all distinct values for this field
            const allValues = yield this.collection.distinct(fieldName);
            // Find invalid values
            const invalidValues = allValues.filter((value) => {
                if (allowEmpty && (value === '' || value === null || value === undefined)) {
                    return false;
                }
                return !validValues.includes(value);
            });
            // Count documents with invalid values
            let invalidCount = 0;
            if (invalidValues.length > 0) {
                const invalidCountPromises = invalidValues.map((value) => __awaiter(this, void 0, void 0, function* () {
                    if (value === null || value === undefined) {
                        return this.collection.countDocuments({ [fieldName]: value });
                    }
                    return this.collection.countDocuments({ [fieldName]: value });
                }));
                const counts = yield Promise.all(invalidCountPromises);
                invalidCount = counts.reduce((sum, count) => sum + count, 0);
            }
            const result = {
                field: fieldName,
                totalValues: allValues,
                invalidValues,
                invalidCount,
                isValid: invalidValues.length === 0
            };
            this.stats.checksPerformed++;
            if (!result.isValid) {
                this.stats.issues.push(result);
            }
            return result;
        });
    }
    checkEmptyStrings(fieldName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.collection)
                throw new Error('Collection not initialized');
            const emptyCount = yield this.collection.countDocuments({ [fieldName]: '' });
            const result = {
                field: `${fieldName} (empty strings)`,
                totalValues: [''],
                invalidValues: emptyCount > 0 ? [''] : [],
                invalidCount: emptyCount,
                isValid: emptyCount === 0
            };
            this.stats.checksPerformed++;
            if (!result.isValid) {
                this.stats.issues.push(result);
            }
            return result;
        });
    }
    checkOldFields() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.collection)
                throw new Error('Collection not initialized');
            const oldFieldChecks = [
                {
                    fieldName: 'estimatedEffort',
                    displayName: 'estimatedEffort (old field)'
                }
            ];
            const results = yield Promise.all(oldFieldChecks.map((_a) => __awaiter(this, [_a], void 0, function* ({ fieldName, displayName }) {
                const count = yield this.collection.countDocuments({
                    [fieldName]: { $exists: true }
                });
                const distinctValues = count > 0
                    ? yield this.collection.distinct(fieldName)
                    : [];
                const result = {
                    field: displayName,
                    totalValues: distinctValues,
                    invalidValues: count > 0 ? distinctValues : [],
                    invalidCount: count,
                    isValid: count === 0
                };
                this.stats.checksPerformed++;
                if (!result.isValid) {
                    this.stats.issues.push(result);
                }
                return result;
            })));
            return results;
        });
    }
    printFieldResult(result, emoji) {
        console.log(`\n${emoji} ${result.field.toUpperCase()}:`);
        console.log(`Found values: [${result.totalValues.map(v => `"${v}"`).join(', ')}]`);
        if (result.isValid) {
            console.log('✅ All values are valid!');
        }
        else {
            console.log(`⚠️  Found ${result.invalidCount} documents with invalid values:`);
            result.invalidValues.forEach(value => {
                console.log(`   - "${value}"`);
            });
        }
    }
    checkAllData() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('\n📊 CHECKING BUG REPORT DATA...\n');
            if (!this.collection)
                throw new Error('Collection not initialized');
            // Get total document count
            this.stats.totalDocuments = yield this.collection.countDocuments();
            console.log(`📋 Total bug reports: ${this.stats.totalDocuments}`);
            if (this.stats.totalDocuments === 0) {
                console.log('No bug reports found in database.');
                return;
            }
            // Run all field checks concurrently for better performance
            const fieldChecks = yield Promise.all([
                this.checkField('urgencyLevel', this.validEnums.urgencyLevel),
                this.checkField('status', this.validEnums.status),
                this.checkField('priority', this.validEnums.priority),
                this.checkField('bugType', this.validEnums.bugType),
                this.checkField('assignedToTeamMember', this.validEnums.assignedToTeamMember, true),
                this.checkEmptyStrings('assignedToTeamMember')
            ]);
            // Check for old fields
            const oldFieldResults = yield this.checkOldFields();
            // Print results
            const [urgencyResult, statusResult, priorityResult, bugTypeResult, teamMemberResult, emptyTeamMemberResult] = fieldChecks;
            this.printFieldResult(urgencyResult, '🚨');
            this.printFieldResult(statusResult, '📊');
            this.printFieldResult(priorityResult, '🔥');
            this.printFieldResult(bugTypeResult, '🔧');
            this.printFieldResult(teamMemberResult, '👥');
            if (!emptyTeamMemberResult.isValid) {
                console.log(`\n⚠️  Found ${emptyTeamMemberResult.invalidCount} documents with empty assignedToTeamMember`);
            }
            // Print old field results
            oldFieldResults.forEach(result => {
                if (!result.isValid) {
                    console.log(`\n🔄 ${result.field.toUpperCase()}:`);
                    console.log(`⚠️  Found ${result.invalidCount} documents with old field`);
                    console.log(`Values: [${result.totalValues.map(v => `"${v}"`).join(', ')}]`);
                }
            });
        });
    }
    printSummary() {
        this.stats.endTime = new Date();
        this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
        console.log('\n📝 SUMMARY:');
        console.log(`⏱️  Check duration: ${this.stats.duration}ms`);
        console.log(`🔍 Checks performed: ${this.stats.checksPerformed}`);
        console.log(`📋 Total documents: ${this.stats.totalDocuments}`);
        if (this.stats.issues.length === 0) {
            console.log('✅ ALL DATA IS VALID! No migration needed.');
        }
        else {
            console.log('⚠️  MIGRATION NEEDED! Found issues with:');
            this.stats.issues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.field}: ${issue.invalidCount} documents`);
            });
            console.log('\n🚀 Run migration: npm run migrate:bug-reports');
        }
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.connect();
                yield this.checkAllData();
                this.printSummary();
            }
            catch (error) {
                console.error('❌ Error checking data:', error);
                throw error;
            }
            finally {
                yield this.disconnect();
            }
        });
    }
}
// Main execution
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const checker = new BugReportDataChecker();
        try {
            yield checker.run();
            process.exit(0);
        }
        catch (error) {
            console.error('💥 Data check failed:', error);
            process.exit(1);
        }
    });
}
// Handle process termination gracefully
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('\n⚠️  Received SIGINT. Shutting down gracefully...');
    yield mongoose_1.default.connection.close();
    process.exit(0);
}));
// Run the check
if (require.main === module) {
    main();
}
exports.default = BugReportDataChecker;
//# sourceMappingURL=check-data-script.js.map