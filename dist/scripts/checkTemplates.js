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
exports.checkTemplates = checkTemplates;
// scripts/checkTemplates.ts - TypeScript-safe version
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
function checkTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, mongodb_1.connectToDatabase)();
            console.log('='.repeat(60));
            console.log('CHECKING DATABASE FOR TEMPLATES');
            console.log('='.repeat(60));
            // Ensure connection is ready
            const db = mongoose_1.default.connection.db;
            if (!db) {
                throw new Error('Database connection not ready');
            }
            // Check what collections exist
            const collections = yield db.listCollections().toArray();
            console.log('\nAvailable collections:');
            collections.forEach(col => {
                console.log(`  - ${col.name}`);
            });
            // Try to find the TaskTemplate collection
            const templateCollectionNames = collections
                .map(c => c.name)
                .filter(name => name.toLowerCase().includes('template'));
            console.log('\nTemplate-related collections:');
            if (templateCollectionNames.length === 0) {
                console.log('  ⚠️  No template collections found!');
            }
            else {
                templateCollectionNames.forEach(name => console.log(`  - ${name}`));
            }
            // Check if we can access TaskTemplate collection
            try {
                const TaskTemplateCollection = db.collection('tasktemplates');
                const count = yield TaskTemplateCollection.countDocuments();
                console.log(`\n✓ Found 'tasktemplates' collection with ${count} documents`);
                if (count > 0) {
                    const allTemplates = yield TaskTemplateCollection.find({}).toArray();
                    console.log('\nTemplate documents found:');
                    allTemplates.forEach((template, idx) => {
                        var _a;
                        console.log(`\n${idx + 1}. Template:`);
                        console.log(`   _id: ${template._id}`);
                        console.log(`   type: ${template.type}`);
                        console.log(`   version: ${template.version}`);
                        console.log(`   isActive: ${template.isActive}`);
                        console.log(`   createdAt: ${template.createdAt}`);
                        console.log(`   updatedAt: ${template.updatedAt}`);
                        console.log(`   tasks: ${((_a = template.tasks) === null || _a === void 0 ? void 0 : _a.length) || 0} tasks`);
                    });
                    // Check if any are active
                    const activeCount = allTemplates.filter((t) => t.isActive).length;
                    console.log(`\n📊 Summary:`);
                    console.log(`   Total templates: ${count}`);
                    console.log(`   Active templates: ${activeCount}`);
                    console.log(`   Inactive templates: ${count - activeCount}`);
                    if (activeCount === 0) {
                        console.log('\n⚠️  WARNING: No active templates found!');
                        console.log('   You may need to set isActive: true on your templates');
                        console.log('   Run: npx ts-node scripts/activateTemplates.ts');
                    }
                    else {
                        console.log('\n✅ Active templates are ready!');
                        console.log('   You can now run: npx ts-node scripts/fixBothTemplates.ts');
                    }
                }
                else {
                    console.log('\n⚠️  No templates found in collection!');
                    console.log('   You need to create templates first.');
                }
            }
            catch (err) {
                console.log('\n❌ Could not access tasktemplates collection');
                console.log(`   Error: ${err}`);
            }
            // Also check for alternative collection names
            const alternativeNames = ['TaskTemplate', 'taskTemplate', 'task_templates', 'TaskTemplates'];
            for (const altName of alternativeNames) {
                try {
                    const altCollection = db.collection(altName);
                    const altCount = yield altCollection.countDocuments();
                    if (altCount > 0) {
                        console.log(`\n✓ Also found '${altName}' collection with ${altCount} documents`);
                    }
                }
                catch (err) {
                    // Collection doesn't exist, that's fine
                }
            }
        }
        catch (error) {
            console.error('Error checking templates:', error);
        }
        finally {
            yield (0, mongodb_1.disconnectFromDatabase)();
        }
    });
}
if (require.main === module) {
    checkTemplates();
}
//# sourceMappingURL=checkTemplates.js.map