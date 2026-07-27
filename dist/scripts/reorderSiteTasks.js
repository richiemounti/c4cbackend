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
exports.reorderSiteTasks = reorderSiteTasks;
const dotenv_1 = __importDefault(require("dotenv"));
const taskUpdate_service_1 = __importDefault(require("../services/taskUpdate.service"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
function reorderSiteTasks() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, mongodb_1.connectToDatabase)();
            const args = process.argv.slice(2);
            const shouldApply = args.includes('--apply');
            const dryRun = !shouldApply;
            console.log('='.repeat(60));
            console.log('PROJECT SITE TASK REORDERING');
            console.log('='.repeat(60));
            console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚠️  APPLYING CHANGES'}`);
            console.log('\nChanges to be made:');
            console.log('  • Task 6 (gps_coordinates) → Position 2');
            console.log('  • Task 2 (site_location_description) → Position 3');
            console.log('  • Task 3 (admin_level_1) → Position 4');
            console.log('  • Task 4 (admin_level_2) → Position 5');
            console.log('  • Task 5 (admin_level_3) → Position 6');
            console.log('='.repeat(60));
            console.log('');
            const reorderMap = [
                { fieldName: 'gps_coordinates', newSortOrder: 2 },
                { fieldName: 'site_location_description', newSortOrder: 3 },
                { fieldName: 'admin_level_1', newSortOrder: 4 },
                { fieldName: 'admin_level_2', newSortOrder: 5 },
                { fieldName: 'admin_level_3', newSortOrder: 6 },
            ];
            const results = yield taskUpdate_service_1.default.reorderTasks('projectSite', reorderMap, dryRun);
            console.log('\n' + '='.repeat(60));
            console.log('REORDERING RESULTS');
            console.log('='.repeat(60));
            let successCount = 0;
            let errorCount = 0;
            results.forEach(result => {
                if (result.error) {
                    console.log(`❌ ${result.fieldName}: ${result.error}`);
                    errorCount++;
                }
                else if (dryRun) {
                    console.log(`✓ ${result.fieldName} → sortOrder ${result.newSortOrder}`);
                    console.log(`  Would affect: ${result.affectedSites || 0} site(s)`);
                    successCount++;
                }
                else {
                    console.log(`✅ ${result.fieldName} → sortOrder ${result.newSortOrder}`);
                    console.log(`  Updated: ${result.documentsUpdated} document(s)`);
                    console.log(`  Template: ${result.templateUpdated ? 'Updated' : 'Skipped'}`);
                    successCount++;
                }
            });
            console.log('\n' + '='.repeat(60));
            console.log('SUMMARY');
            console.log('='.repeat(60));
            console.log(`Total tasks processed: ${results.length}`);
            console.log(`Successful: ${successCount}`);
            console.log(`Failed: ${errorCount}`);
            if (dryRun) {
                console.log('\n🔍 This was a dry run. No changes were made.');
                console.log('Run with --apply flag to apply changes:');
                console.log('  npm run reorder-tasks:apply');
            }
            else {
                console.log('\n✅ Task reordering completed successfully!');
            }
        }
        catch (error) {
            console.error('\n❌ Error reordering tasks:', error);
            process.exit(1);
        }
        finally {
            yield (0, mongodb_1.disconnectFromDatabase)();
        }
    });
}
if (require.main === module) {
    reorderSiteTasks();
}
//# sourceMappingURL=reorderSiteTasks.js.map