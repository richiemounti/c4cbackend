"use strict";
/**
 * scripts/restoreTagData.ts
 *
 * Targeted restore of tag field responseData for a specific ProjectSetup document.
 * Fill in the RESTORE_DATA values below from your Atlas backup before running.
 *
 * Usage:
 *   npx ts-node scripts/restoreTagData.ts
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
// ─── FILL THESE IN FROM YOUR BACKUP ──────────────────────────────────────────
// Document ID of the ProjectSetup that had data deleted
const TARGET_DOC_ID = '69e0afab3eebc5c8b6443a48';
// For each field, provide the array of values from the backup.
// These will be stored as proper tag arrays (responseData) and isCompleted: true.
// Example:
//   approval_granted_by: ['Village Council', 'District Office', 'National Authority']
const RESTORE_DATA = {
    approval_granted_by: [], // ← paste values from backup here
    implementing_organisations: [], // ← paste values from backup here
    oversight_authorities: [], // ← paste values from backup here
};
// ─────────────────────────────────────────────────────────────────────────────
const taskSubSchema = new mongoose_1.default.Schema({ fieldName: String, options: [String], responseData: mongoose_1.default.Schema.Types.Mixed, isCompleted: Boolean }, { strict: false });
const ProjectSetup = mongoose_1.default.models.ProjectSetup ||
    mongoose_1.default.model('ProjectSetup', new mongoose_1.default.Schema({ tasks: [taskSubSchema] }, { strict: false }), 'projectsetups');
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, mongodb_1.connectToDatabase)();
        const doc = yield ProjectSetup.findById(TARGET_DOC_ID).lean();
        if (!doc) {
            console.error(`Document ${TARGET_DOC_ID} not found.`);
            process.exit(1);
        }
        const tasks = doc.tasks || [];
        let changed = 0;
        const updatedTasks = tasks.map((task) => {
            const restoreValues = RESTORE_DATA[task.fieldName];
            if (restoreValues === undefined)
                return task;
            if (restoreValues.length === 0) {
                console.log(`  ⚠️  "${task.fieldName}" — no restore values provided, skipping`);
                return task;
            }
            console.log(`  ✅ "${task.fieldName}" → restoring: ${JSON.stringify(restoreValues)}`);
            changed++;
            return Object.assign(Object.assign({}, task), { responseData: restoreValues, options: [], isCompleted: true });
        });
        if (changed === 0) {
            console.log('No fields restored — did you fill in RESTORE_DATA above?');
            process.exit(0);
        }
        yield ProjectSetup.updateOne({ _id: TARGET_DOC_ID }, { $set: { tasks: updatedTasks } });
        console.log(`\nRestored ${changed} field(s) on document ${TARGET_DOC_ID}`);
        process.exit(0);
    });
}
run().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=restoreTagData.js.map