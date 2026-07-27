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
exports.migrateTheoryOfChangeModels = migrateTheoryOfChangeModels;
// scripts/migrateTheoryOfChangeModels.ts
const mongoose_1 = __importDefault(require("mongoose"));
const stakeholderAction_model_1 = __importDefault(require("../models/stakeholderAction.model"));
const socialImpact_model_1 = __importDefault(require("../models/socialImpact.model"));
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
function migrateTheoryOfChangeModels() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            console.log('Starting Theory of Change models migration...');
            // Debug environment variables
            console.log('Environment check:');
            console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
            console.log(`DB_URI exists: ${!!process.env.DB_URI}`);
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
            console.log('Connected to MongoDB successfully');
            // ===== MIGRATE STAKEHOLDER ACTIONS =====
            console.log('\n=== Migrating StakeholderAction documents ===');
            // Find all existing stakeholder actions
            const existingActions = yield stakeholderAction_model_1.default.find({});
            console.log(`Found ${existingActions.length} existing stakeholder actions`);
            let actionsUpdatedCount = 0;
            for (const action of existingActions) {
                const updates = {};
                // Add status if not present
                if (!action.status) {
                    updates.status = 'not_started';
                }
                // Add progress if not present
                if (action.progress === undefined || action.progress === null) {
                    updates.progress = 0;
                }
                // Add dependencies if not present
                if (!action.dependencies) {
                    updates.dependencies = [];
                }
                // Add priority if not present
                if (!action.priority) {
                    updates.priority = 'medium';
                }
                // Add milestones if not present
                if (!action.milestones) {
                    updates.milestones = [];
                }
                // Enhance timeframe structure if basic timeframe exists but missing new fields
                if (action.timeframe) {
                    const timeframeUpdates = {};
                    // Preserve existing startDate and endDate
                    if (action.timeframe.startDate) {
                        timeframeUpdates.startDate = action.timeframe.startDate;
                    }
                    if (action.timeframe.endDate) {
                        timeframeUpdates.endDate = action.timeframe.endDate;
                    }
                    // Add estimatedDuration if not present
                    if (!action.timeframe.estimatedDuration) {
                        // Calculate from existing dates or set default
                        if (action.timeframe.startDate && action.timeframe.endDate) {
                            const duration = Math.ceil((action.timeframe.endDate.getTime() - action.timeframe.startDate.getTime())
                                / (24 * 60 * 60 * 1000));
                            timeframeUpdates.estimatedDuration = duration > 0 ? duration : 7; // default 7 days
                        }
                        else {
                            timeframeUpdates.estimatedDuration = 7; // default 7 days
                        }
                    }
                    // Add isFlexible if not present
                    if (action.timeframe.isFlexible === undefined) {
                        timeframeUpdates.isFlexible = false;
                    }
                    if (Object.keys(timeframeUpdates).length > 0) {
                        updates.timeframe = timeframeUpdates;
                    }
                }
                else {
                    // Create basic timeframe structure if completely missing
                    updates.timeframe = {
                        startDate: null,
                        endDate: null,
                        estimatedDuration: 7,
                        isFlexible: false
                    };
                }
                // Update the action if there are changes
                if (Object.keys(updates).length > 0) {
                    yield stakeholderAction_model_1.default.findByIdAndUpdate(action._id, updates);
                    actionsUpdatedCount++;
                    console.log(`Updated action: ${action._id} - "${(_a = action.action) === null || _a === void 0 ? void 0 : _a.substring(0, 50)}..."`);
                }
            }
            // ===== MIGRATE SOCIAL IMPACTS =====
            console.log('\n=== Migrating SocialImpact documents ===');
            // Find all existing social impacts
            const existingImpacts = yield socialImpact_model_1.default.find({});
            console.log(`Found ${existingImpacts.length} existing social impacts`);
            let impactsUpdatedCount = 0;
            for (const impact of existingImpacts) {
                const updates = {};
                // Add status if not present
                if (!impact.status) {
                    updates.status = 'planned';
                }
                // Add progress if not present
                if (impact.progress === undefined || impact.progress === null) {
                    updates.progress = 0;
                }
                // Add timeframe structure if not present
                if (!impact.timeframe) {
                    updates.timeframe = {
                        targetDate: null,
                        reviewDate: null,
                        estimatedDuration: 30 // Default 30 days for impacts
                    };
                }
                else {
                    // Enhance existing timeframe
                    const timeframeUpdates = Object.assign({}, impact.timeframe);
                    if (!timeframeUpdates.estimatedDuration) {
                        timeframeUpdates.estimatedDuration = 30;
                    }
                    updates.timeframe = timeframeUpdates;
                }
                // Add measurementPlan if not present
                if (!impact.measurementPlan) {
                    updates.measurementPlan = {
                        indicators: [],
                        measurementMethod: '',
                        frequency: 'quarterly'
                    };
                }
                // Update the impact if there are changes
                if (Object.keys(updates).length > 0) {
                    yield socialImpact_model_1.default.findByIdAndUpdate(impact._id, updates);
                    impactsUpdatedCount++;
                    console.log(`Updated impact: ${impact._id} - "${(_b = impact.outcome) === null || _b === void 0 ? void 0 : _b.substring(0, 50)}..."`);
                }
            }
            // ===== VALIDATION CHECKS =====
            console.log('\n=== Running validation checks ===');
            // Check StakeholderActions
            const actionsWithStatus = yield stakeholderAction_model_1.default.countDocuments({ status: { $exists: true } });
            const actionsWithProgress = yield stakeholderAction_model_1.default.countDocuments({ progress: { $exists: true } });
            const actionsWithDependencies = yield stakeholderAction_model_1.default.countDocuments({ dependencies: { $exists: true } });
            console.log(`StakeholderActions validation:`);
            console.log(`- With status field: ${actionsWithStatus}/${existingActions.length}`);
            console.log(`- With progress field: ${actionsWithProgress}/${existingActions.length}`);
            console.log(`- With dependencies field: ${actionsWithDependencies}/${existingActions.length}`);
            // Check SocialImpacts
            const impactsWithStatus = yield socialImpact_model_1.default.countDocuments({ status: { $exists: true } });
            const impactsWithProgress = yield socialImpact_model_1.default.countDocuments({ progress: { $exists: true } });
            const impactsWithTimeframe = yield socialImpact_model_1.default.countDocuments({ timeframe: { $exists: true } });
            console.log(`SocialImpacts validation:`);
            console.log(`- With status field: ${impactsWithStatus}/${existingImpacts.length}`);
            console.log(`- With progress field: ${impactsWithProgress}/${existingImpacts.length}`);
            console.log(`- With timeframe field: ${impactsWithTimeframe}/${existingImpacts.length}`);
            console.log(`\nMigration completed successfully!`);
            console.log(`StakeholderActions - Total: ${existingActions.length}, Updated: ${actionsUpdatedCount}, Unchanged: ${existingActions.length - actionsUpdatedCount}`);
            console.log(`SocialImpacts - Total: ${existingImpacts.length}, Updated: ${impactsUpdatedCount}, Unchanged: ${existingImpacts.length - impactsUpdatedCount}`);
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
    migrateTheoryOfChangeModels()
        .then(() => {
        console.log('Migration script completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=migrateTheoryOfChangeModels.js.map