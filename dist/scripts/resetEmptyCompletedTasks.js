"use strict";
/**
 * scripts/resetEmptyCompletedTasks.ts
 *
 * Finds tasks that are marked isCompleted: true but have empty/null responseData
 * for the known tag fields, and resets isCompleted to false so they can be re-entered.
 *
 * Run once after cleanupTagOptions.ts to fix the inconsistent state where tasks
 * appear complete but have no data.
 *
 * Usage:
 *   npx ts-node scripts/resetEmptyCompletedTasks.ts
 */
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
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config({ path: '.env.development.local' });
const TAG_FIELDS = [
    'ethnic_groups_present',
    'approval_granted_by',
    'implementing_organisations',
    'oversight_authorities',
];
const taskSubSchema = new mongoose_1.default.Schema({ fieldName: String, options: [String], responseData: mongoose_1.default.Schema.Types.Mixed, isCompleted: Boolean }, { strict: false });
const ProjectSetup = mongoose_1.default.models.ProjectSetup ||
    mongoose_1.default.model('ProjectSetup', new mongoose_1.default.Schema({ tasks: [taskSubSchema] }, { strict: false }), 'projectsetups');
const ProjectSiteSetup = mongoose_1.default.models.ProjectSiteSetup ||
    mongoose_1.default.model('ProjectSiteSetup', new mongoose_1.default.Schema({ tasks: [taskSubSchema] }, { strict: false }), 'projectsitesetups');
function resetCollection(Model, label) {
    return __awaiter(this, void 0, void 0, function* () {
        const docs = yield Model.find({}).lean();
        console.log(`\n[${label}] Checking ${docs.length} documents...`);
        let docsUpdated = 0;
        let tasksReset = 0;
        for (const doc of docs) {
            const tasks = doc.tasks || [];
            let docDirty = false;
            const updatedTasks = tasks.map((task) => {
                if (!TAG_FIELDS.includes(task.fieldName))
                    return task;
                const isEmpty = task.isCompleted === true &&
                    (task.responseData === null ||
                        task.responseData === undefined ||
                        (Array.isArray(task.responseData) && task.responseData.length === 0));
                if (isEmpty) {
                    console.log(`  • doc ${doc._id} | "${task.fieldName}" → resetting isCompleted: true → false`);
                    docDirty = true;
                    tasksReset++;
                    return Object.assign(Object.assign({}, task), { isCompleted: false });
                }
                return task;
            });
            if (docDirty) {
                yield Model.updateOne({ _id: doc._id }, { $set: { tasks: updatedTasks } });
                docsUpdated++;
            }
        }
        console.log(`[${label}] Done — ${docsUpdated} doc(s) updated, ${tasksReset} task(s) reset to incomplete`);
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, mongodb_1.connectToDatabase)();
        yield resetCollection(ProjectSetup, 'ProjectSetup');
        yield resetCollection(ProjectSiteSetup, 'ProjectSiteSetup');
        console.log('\nDone.');
        process.exit(0);
    });
}
run().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=resetEmptyCompletedTasks.js.map