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
exports.migrateStakeholderTags = migrateStakeholderTags;
const mongoose_1 = __importDefault(require("mongoose"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const path_1 = require("path");
const dotenv_1 = require("dotenv");
const fs = __importStar(require("fs"));
// Load environment variables (same as your other migrations)
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
// scripts/migrateStakeholderTags.ts - Updated version
function migrateStakeholderTags() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            console.log('Starting stakeholder tags migration...');
            const dbUri = process.env.DB_URI;
            if (!dbUri) {
                throw new Error('DB_URI environment variable is not set');
            }
            console.log('Connecting to MongoDB...');
            yield mongoose_1.default.connect(dbUri);
            console.log('Connected to MongoDB successfully');
            // Find all stakeholder groups
            const stakeholderGroups = yield stakeholderGroup_model_1.default.find({});
            console.log(`Found ${stakeholderGroups.length} stakeholder groups`);
            let updatedCount = 0;
            let tasksUpdated = 0;
            for (const group of stakeholderGroups) {
                let groupNeedsUpdate = false;
                console.log(`Checking group: ${group.name} (${group.tasks.length} tasks)`);
                // Check each task in the group
                for (let i = 0; i < group.tasks.length; i++) {
                    const task = group.tasks[i];
                    // More comprehensive check: if tags doesn't exist, is null, undefined, or not an array
                    if (!task.tags || !Array.isArray(task.tags)) {
                        console.log(`  - Task ${i} (${task.taskType}): adding tags field`);
                        task.tags = []; // Add empty tags array
                        groupNeedsUpdate = true;
                        tasksUpdated++;
                    }
                    else {
                        console.log(`  - Task ${i} (${task.taskType}): tags field exists (${task.tags.length} tags)`);
                    }
                }
                // Save the group if any task was updated
                if (groupNeedsUpdate) {
                    yield group.save();
                    updatedCount++;
                    console.log(`Updated stakeholder group: ${group._id} - "${group.name}"`);
                }
            }
            console.log(`Migration completed successfully!`);
            console.log(`Total stakeholder groups: ${stakeholderGroups.length}`);
            console.log(`Updated groups: ${updatedCount}`);
            console.log(`Total tasks updated: ${tasksUpdated}`);
            // More detailed validation check
            const totalTasks = yield stakeholderGroup_model_1.default.aggregate([
                { $unwind: '$tasks' },
                { $count: 'total' }
            ]);
            const tasksWithTags = yield stakeholderGroup_model_1.default.aggregate([
                { $unwind: '$tasks' },
                { $match: { 'tasks.tags': { $exists: true, $type: 'array' } } },
                { $count: 'withTags' }
            ]);
            console.log(`Total tasks: ${((_a = totalTasks[0]) === null || _a === void 0 ? void 0 : _a.total) || 0}`);
            console.log(`Tasks with tags field: ${((_b = tasksWithTags[0]) === null || _b === void 0 ? void 0 : _b.withTags) || 0}`);
        }
        catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
        finally {
            yield mongoose_1.default.connection.close();
            console.log('Database connection closed');
        }
    });
}
// Run migration if called directly
if (require.main === module) {
    migrateStakeholderTags()
        .then(() => {
        console.log('Migration script completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=migrateStakeholderTags.js.map