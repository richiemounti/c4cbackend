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
exports.activateTemplates = activateTemplates;
// scripts/activateTemplates.ts
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
function activateTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            yield (0, mongodb_1.connectToDatabase)();
            console.log('='.repeat(60));
            console.log('ACTIVATING TEMPLATES');
            console.log('='.repeat(60));
            // Access the collection directly
            const TaskTemplateCollection = mongoose_1.default.connection.collection('tasktemplates');
            // Get all templates
            const allTemplates = yield TaskTemplateCollection.find({}).toArray();
            console.log(`\nFound ${allTemplates.length} templates in database`);
            if (allTemplates.length === 0) {
                console.log('\n❌ No templates found in database!');
                console.log('You need to create templates first.');
                return;
            }
            // Show current state
            console.log('\nCurrent template state:');
            allTemplates.forEach((template, idx) => {
                var _a;
                console.log(`\n${idx + 1}. ${template.type} template:`);
                console.log(`   _id: ${template._id}`);
                console.log(`   isActive: ${template.isActive}`);
                console.log(`   version: ${template.version}`);
                console.log(`   tasks: ${((_a = template.tasks) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
            });
            // Find the most recent template for each type
            const projectTemplates = allTemplates
                .filter((t) => t.type === 'project')
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            const siteTemplates = allTemplates
                .filter((t) => t.type === 'projectSite')
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            console.log('\n' + '='.repeat(60));
            console.log('ACTIVATING MOST RECENT TEMPLATES');
            console.log('='.repeat(60));
            // Activate project template
            if (projectTemplates.length > 0) {
                const projectTemplate = projectTemplates[0];
                // Deactivate all project templates first
                yield TaskTemplateCollection.updateMany({ type: 'project' }, { $set: { isActive: false } });
                // Activate the most recent one
                yield TaskTemplateCollection.updateOne({ _id: projectTemplate._id }, { $set: { isActive: true, updatedAt: new Date() } });
                console.log(`\n✅ Activated PROJECT template: ${projectTemplate._id}`);
                console.log(`   Version: ${projectTemplate.version}`);
                console.log(`   Tasks: ${((_a = projectTemplate.tasks) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
                if (projectTemplates.length > 1) {
                    console.log(`   (Deactivated ${projectTemplates.length - 1} other project templates)`);
                }
            }
            else {
                console.log('\n⚠️  No project templates found');
            }
            // Activate project site template
            if (siteTemplates.length > 0) {
                const siteTemplate = siteTemplates[0];
                // Deactivate all site templates first
                yield TaskTemplateCollection.updateMany({ type: 'projectSite' }, { $set: { isActive: false } });
                // Activate the most recent one
                yield TaskTemplateCollection.updateOne({ _id: siteTemplate._id }, { $set: { isActive: true, updatedAt: new Date() } });
                console.log(`\n✅ Activated PROJECT SITE template: ${siteTemplate._id}`);
                console.log(`   Version: ${siteTemplate.version}`);
                console.log(`   Tasks: ${((_b = siteTemplate.tasks) === null || _b === void 0 ? void 0 : _b.length) || 0}`);
                if (siteTemplates.length > 1) {
                    console.log(`   (Deactivated ${siteTemplates.length - 1} other site templates)`);
                }
            }
            else {
                console.log('\n⚠️  No project site templates found');
            }
            // Verify
            console.log('\n' + '='.repeat(60));
            console.log('VERIFICATION');
            console.log('='.repeat(60));
            const activeTemplates = yield TaskTemplateCollection.find({ isActive: true }).toArray();
            console.log(`\nActive templates after update: ${activeTemplates.length}`);
            activeTemplates.forEach((template) => {
                console.log(`  ✓ ${template.type}: ${template._id}`);
            });
            console.log('\n✅ Templates activated successfully!');
            console.log('You can now run the fixBothTemplates.ts script.');
        }
        catch (error) {
            console.error('Error activating templates:', error);
        }
        finally {
            yield (0, mongodb_1.disconnectFromDatabase)();
        }
    });
}
if (require.main === module) {
    activateTemplates();
}
//# sourceMappingURL=activateTemplates.js.map