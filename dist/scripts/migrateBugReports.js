"use strict";
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
exports.migrateBugReports = migrateBugReports;
// scripts/migrateBugReports.ts - Updated with debugging
const mongoose_1 = __importDefault(require("mongoose"));
const bugReport_model_1 = __importDefault(require("../models/bugReport.model"));
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
function migrateBugReports() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            console.log('Starting bug report migration...');
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
            console.log('Connecting to MongoDB...');
            yield mongoose_1.default.connect(dbUri);
            console.log('✅ Connected to MongoDB successfully');
            // Find all existing bug reports
            const existingReports = yield bugReport_model_1.default.find({});
            console.log(`Found ${existingReports.length} existing bug reports`);
            let updatedCount = 0;
            for (const report of existingReports) {
                const updates = {};
                // Set default feedbackType if not present
                if (!report.feedbackType) {
                    updates.feedbackType = 'bug_report';
                }
                // Map old priority to new priority system
                if (report.priority && !report.priority.startsWith('p')) {
                    const priorityMap = {
                        'critical': 'p0',
                        'high': 'p1',
                        'medium': 'p2',
                        'low': 'p3'
                    };
                    updates.priority = priorityMap[report.priority] || 'p3';
                }
                // Set default category based on existing data
                if (!report.category) {
                    // Try to infer category from title/description
                    const text = (report.title + ' ' + report.description).toLowerCase();
                    if (text.includes('slow') || text.includes('performance') || text.includes('speed')) {
                        updates.category = 'performance';
                    }
                    else if (text.includes('ui') || text.includes('button') || text.includes('display')) {
                        updates.category = 'ui_ux';
                    }
                    else if (text.includes('function') || text.includes('feature') || text.includes('work')) {
                        updates.category = 'functionality';
                    }
                    else {
                        updates.category = 'other';
                    }
                }
                // Set default urgencyLevel if not present
                if (!report.urgencyLevel) {
                    updates.urgencyLevel = report.priority === 'p0' ? 'critical' :
                        report.priority === 'p1' ? 'high' :
                            report.priority === 'p2' ? 'medium' : 'low';
                }
                // Initialize metrics if not present
                if (!report.metrics) {
                    updates.metrics = {
                        viewCount: 0,
                        commentCount: 0,
                        reopenCount: 0
                    };
                }
                // Initialize businessImpact with defaults
                if (!report.businessImpact) {
                    updates.businessImpact = {
                        affectedUsers: 'some',
                        functionalityBlocked: report.priority === 'p0',
                        workaroundAvailable: false,
                        revenueImpact: false,
                        complianceImpact: false
                    };
                }
                // Set default tags as empty array
                if (!report.tags) {
                    updates.tags = [];
                }
                // Set default values for new boolean fields
                if (report.requiresFollowUp === undefined) {
                    updates.requiresFollowUp = false;
                }
                if (report.verifiedByReporter === undefined) {
                    updates.verifiedByReporter = false;
                }
                // Update the report if there are changes
                if (Object.keys(updates).length > 0) {
                    yield bugReport_model_1.default.findByIdAndUpdate(report._id, updates);
                    updatedCount++;
                    console.log(`Updated bug report: ${report._id}`);
                }
            }
            console.log(`✅ Migration completed successfully!`);
            console.log(`Total reports: ${existingReports.length}`);
            console.log(`Updated reports: ${updatedCount}`);
            console.log(`Unchanged reports: ${existingReports.length - updatedCount}`);
        }
        catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
        finally {
            // Close the database connection
            yield mongoose_1.default.connection.close();
            console.log('Database connection closed');
        }
    });
}
// Run migration if called directly
if (require.main === module) {
    migrateBugReports()
        .then(() => {
        console.log('🎉 Migration script completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Migration script failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=migrateBugReports.js.map