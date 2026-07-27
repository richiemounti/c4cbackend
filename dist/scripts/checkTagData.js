"use strict";
/**
 * scripts/checkTagData.ts
 * Shows the current state of tag fields in the DB so we know exactly what data remains.
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
function checkCollection(Model, label) {
    return __awaiter(this, void 0, void 0, function* () {
        const docs = yield Model.find({}).lean();
        console.log(`\n===== ${label} (${docs.length} docs) =====`);
        for (const doc of docs) {
            const tasks = doc.tasks || [];
            const relevant = tasks.filter(t => TAG_FIELDS.includes(t.fieldName));
            if (relevant.length === 0)
                continue;
            console.log(`\nDoc _id: ${doc._id}`);
            for (const t of relevant) {
                console.log(`  Field: ${t.fieldName}`);
                console.log(`    isCompleted : ${t.isCompleted}`);
                console.log(`    options     : ${JSON.stringify(t.options)}`);
                console.log(`    responseData: ${JSON.stringify(t.responseData)}`);
            }
        }
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, mongodb_1.connectToDatabase)();
        yield checkCollection(ProjectSetup, 'ProjectSetup');
        yield checkCollection(ProjectSiteSetup, 'ProjectSiteSetup');
        process.exit(0);
    });
}
run().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=checkTagData.js.map