"use strict";
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
exports.fixStakeholderTags = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const fixStakeholderTags = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        console.log('Starting tags fix via API route...');
        // Check if database connection exists
        if (!mongoose_1.default.connection.db) {
            return res.status(500).json({
                success: false,
                error: 'Database connection not available'
            });
        }
        const db = mongoose_1.default.connection.db;
        // First, let's check current state
        const totalTasksResult = yield db.collection('stakeholdergroups').aggregate([
            { $unwind: "$tasks" },
            { $count: "total" }
        ]).toArray();
        const tasksWithTagsResult = yield db.collection('stakeholdergroups').aggregate([
            { $unwind: "$tasks" },
            { $match: { "tasks.tags": { $exists: true } } },
            { $count: "withTags" }
        ]).toArray();
        const totalTasks = ((_a = totalTasksResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
        const tasksWithTags = ((_b = tasksWithTagsResult[0]) === null || _b === void 0 ? void 0 : _b.withTags) || 0;
        console.log(`Before fix: ${tasksWithTags}/${totalTasks} tasks have tags`);
        // Apply the fix
        const result = yield db.collection('stakeholdergroups').updateMany({}, [
            {
                $set: {
                    tasks: {
                        $map: {
                            input: "$tasks",
                            as: "task",
                            in: {
                                $mergeObjects: [
                                    "$$task",
                                    {
                                        tags: {
                                            $ifNull: ["$$task.tags", []]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        ]);
        // Check state after fix
        const tasksWithTagsAfterResult = yield db.collection('stakeholdergroups').aggregate([
            { $unwind: "$tasks" },
            { $match: { "tasks.tags": { $exists: true } } },
            { $count: "withTags" }
        ]).toArray();
        const tasksWithTagsAfter = ((_c = tasksWithTagsAfterResult[0]) === null || _c === void 0 ? void 0 : _c.withTags) || 0;
        console.log(`After fix: ${tasksWithTagsAfter}/${totalTasks} tasks have tags`);
        res.json({
            success: true,
            message: 'Tags fix completed successfully',
            details: {
                totalTasks,
                tasksWithTagsBefore: tasksWithTags,
                tasksWithTagsAfter: tasksWithTagsAfter,
                documentsMatched: result.matchedCount,
                documentsModified: result.modifiedCount
            }
        });
    }
    catch (error) {
        console.error('Tags fix failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error
        });
    }
});
exports.fixStakeholderTags = fixStakeholderTags;
//# sourceMappingURL=tempMigration.controller.js.map