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
exports.runTaskUpdates = runTaskUpdates;
// scripts/updateProjectTasks.ts
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const taskUpdate_service_1 = __importDefault(require("../services/taskUpdate.service"));
const mongodb_1 = require("../database/mongodb");
// Load environment variables FIRST
dotenv_1.default.config();
/**
 * Standalone script to update project and site tasks
 * Run with: npm run update-tasks
 * Or: npm run update-tasks -- --apply (to actually apply changes)
 * Or: npm run update-tasks -- --type=project --apply (to update only projects)
 * Or: npm run update-tasks -- --type=site --apply (to update only sites)
 */
function runTaskUpdates() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Use your existing database connection function
            yield (0, mongodb_1.connectToDatabase)();
            // Log registered models to verify
            console.log('Registered models:', mongoose_1.default.modelNames());
            // Check command line arguments
            const args = process.argv.slice(2);
            const shouldApply = args.includes('--apply');
            const dryRun = !shouldApply;
            // Check if specific type is requested
            const typeArg = args.find(arg => arg.startsWith('--type='));
            const updateType = typeArg ? typeArg.split('=')[1] : 'both'; // both, project, or site
            if (dryRun) {
                console.log('🔍 DRY RUN MODE - No changes will be made');
                console.log('Add --apply flag to actually apply changes');
            }
            else {
                console.log('⚠️  APPLYING CHANGES - This will modify the database');
            }
            if (updateType === 'project' || updateType === 'both') {
                console.log('\n' + '='.repeat(50));
                console.log('PROJECT TASK MODIFICATIONS');
                console.log('='.repeat(50));
                const projectResults = yield taskUpdate_service_1.default.applyProjectTaskModifications(dryRun);
                console.log('\n' + '='.repeat(50));
                console.log('PROJECT SUMMARY');
                console.log('='.repeat(50));
                const projectSummary = {
                    totalModifications: projectResults.length,
                    successful: projectResults.filter(r => r.success).length,
                    failed: projectResults.filter(r => !r.success).length
                };
                console.log(`Total modifications: ${projectSummary.totalModifications}`);
                console.log(`Successful: ${projectSummary.successful}`);
                console.log(`Failed: ${projectSummary.failed}`);
                if (projectSummary.failed > 0) {
                    console.log('\nFailed project modifications:');
                    projectResults.filter(r => !r.success).forEach(r => {
                        console.log(`  - ${r.fieldName}: ${r.error}`);
                    });
                }
            }
            if (updateType === 'site' || updateType === 'both') {
                console.log('\n' + '='.repeat(50));
                console.log('PROJECT SITE TASK MODIFICATIONS');
                console.log('='.repeat(50));
                const siteResults = yield taskUpdate_service_1.default.applyProjectSiteTaskModifications(dryRun);
                console.log('\n' + '='.repeat(50));
                console.log('PROJECT SITE SUMMARY');
                console.log('='.repeat(50));
                const siteSummary = {
                    totalModifications: siteResults.length,
                    successful: siteResults.filter(r => r.success).length,
                    failed: siteResults.filter(r => !r.success).length
                };
                console.log(`Total modifications: ${siteSummary.totalModifications}`);
                console.log(`Successful: ${siteSummary.successful}`);
                console.log(`Failed: ${siteSummary.failed}`);
                if (siteSummary.failed > 0) {
                    console.log('\nFailed site modifications:');
                    siteResults.filter(r => !r.success).forEach(r => {
                        console.log(`  - ${r.fieldName}: ${r.error}`);
                    });
                }
            }
            if (dryRun) {
                console.log('\n🔍 This was a dry run. No changes were made.');
                console.log('Run with --apply flag to apply changes.');
                console.log('Use --type=project or --type=site to update specific types only.');
            }
            else {
                console.log('\n✅ Changes have been applied to the database.');
            }
        }
        catch (error) {
            console.error('Error updating tasks:', error);
            process.exit(1);
        }
        finally {
            yield (0, mongodb_1.disconnectFromDatabase)();
        }
    });
}
// Run if this script is executed directly
if (require.main === module) {
    runTaskUpdates();
}
//# sourceMappingURL=updateProjectTasks.js.map