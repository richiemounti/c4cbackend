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
exports.fixHorticulturalCrops = fixHorticulturalCrops;
const dotenv_1 = __importDefault(require("dotenv"));
const taskUpdate_service_1 = __importDefault(require("../services/taskUpdate.service"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
function fixHorticulturalCrops() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, mongodb_1.connectToDatabase)();
            const args = process.argv.slice(2);
            const shouldApply = args.includes('--apply');
            const dryRun = !shouldApply;
            console.log('='.repeat(60));
            console.log('FIXING HORTICULTURAL CROPS OPTIONS');
            console.log('='.repeat(60));
            console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '⚠️  APPLYING CHANGES'}`);
            console.log('');
            // The correct options array for crops_grown
            const correctOptions = [
                "Maize",
                "Upland rice",
                "Paddy rice",
                "Cassava",
                "Millet",
                "Sorghum",
                "Sesame",
                "Groundnuts",
                "Sunflower",
                "Cashew",
                "Soybean",
                "Tobacco",
                "Beans",
                "Pigeon pea",
                "Horticultural crops (e.g. tomato, onion)", // FIXED: Combined into one option
                "Banana or plantain",
                "Sugarcane",
                "Other (please specify)"
            ];
            const result = yield taskUpdate_service_1.default.updateTaskGlobally('crops_grown', {
                options: correctOptions
            }, {
                dryRun,
                setupType: 'projectSite',
                onlyIncompleted: false
            });
            console.log(`Result: ${JSON.stringify(result, null, 2)}`);
            // Update template
            if (!dryRun) {
                const templateResult = yield taskUpdate_service_1.default.updateTaskTemplate('projectSite', 'crops_grown', { options: correctOptions });
                console.log(`Template updated: ${(templateResult === null || templateResult === void 0 ? void 0 : templateResult.modifiedCount) || 0} document(s)`);
            }
            console.log('\n' + '='.repeat(60));
            if (dryRun) {
                console.log('🔍 This was a dry run. Run with --apply to fix.');
            }
            else {
                console.log('✅ Horticultural crops option fixed!');
            }
        }
        catch (error) {
            console.error('\n❌ Error:', error);
            process.exit(1);
        }
        finally {
            yield (0, mongodb_1.disconnectFromDatabase)();
        }
    });
}
if (require.main === module) {
    fixHorticulturalCrops();
}
//# sourceMappingURL=fixHorticulturalCrops.js.map