"use strict";
// scripts/add-demographic-fields.ts
// Simple migration to add only the missing demographic fields
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
exports.addDemographicFields = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from the correct file
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env.development.local') });
// Also try loading from .env as fallback
dotenv_1.default.config();
// Define a loose schema for migration purposes
const questionSchema = new mongoose_1.default.Schema({}, { strict: false });
const Question = mongoose_1.default.model('Question', questionSchema);
const addDemographicFields = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🚀 Adding demographic fields to existing questions...');
        // Connect to MongoDB
        if (!process.env.DB_URI) {
            console.log('❌ Available environment variables:');
            console.log('   NODE_ENV:', process.env.NODE_ENV);
            console.log('   Current working directory:', process.cwd());
            console.log('   Looking for MONGODB_URI...');
            // List all environment variables that contain 'MONGO' or 'DB'
            const relevantEnvVars = Object.keys(process.env).filter(key => key.toLowerCase().includes('mongo') || key.toLowerCase().includes('db'));
            if (relevantEnvVars.length > 0) {
                console.log('   Found related environment variables:', relevantEnvVars);
            }
            else {
                console.log('   No MongoDB-related environment variables found');
            }
            throw new Error('MONGODB_URI environment variable is required');
        }
        yield mongoose_1.default.connect(process.env.DB_URI);
        console.log('✅ Connected to MongoDB');
        // Find questions missing demographic fields
        const questionsNeedingDemographicFields = yield Question.find({
            isStandardDemographic: { $exists: false }
        });
        console.log(`📊 Found ${questionsNeedingDemographicFields.length} questions missing demographic fields`);
        if (questionsNeedingDemographicFields.length === 0) {
            console.log('✅ All questions already have demographic fields!');
            return;
        }
        // Update all questions to add the missing demographic fields
        const result = yield Question.updateMany({ isStandardDemographic: { $exists: false } }, {
            $set: {
                isStandardDemographic: false,
                isGlobalStandard: false
                // Note: We don't set demographicType, demographicCategory, or demographicMetadata
                // because they should only exist when isStandardDemographic is true
            }
        });
        console.log(`✅ Updated ${result.modifiedCount} questions with demographic fields`);
        // Verify the update
        const remainingQuestions = yield Question.countDocuments({
            isStandardDemographic: { $exists: false }
        });
        if (remainingQuestions === 0) {
            console.log('🎉 All questions now have demographic fields!');
        }
        else {
            console.log(`⚠️  ${remainingQuestions} questions still missing demographic fields`);
        }
        // Show final summary
        const totalQuestions = yield Question.countDocuments({});
        const questionsWithDemographics = yield Question.countDocuments({
            isStandardDemographic: { $exists: true }
        });
        const demographicQuestions = yield Question.countDocuments({
            isStandardDemographic: true
        });
        console.log('\n📈 Final Summary:');
        console.log(`   Total questions: ${totalQuestions}`);
        console.log(`   Questions with demographic fields: ${questionsWithDemographics}`);
        console.log(`   Questions marked as demographic: ${demographicQuestions}`);
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
    finally {
        yield mongoose_1.default.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
});
exports.addDemographicFields = addDemographicFields;
// Run the migration if this file is executed directly
const runMigration = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield addDemographicFields();
        console.log('🎉 Demographic fields migration completed');
        process.exit(0);
    }
    catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
});
// Check if this file is being run directly
if (require.main === module) {
    runMigration();
}
//# sourceMappingURL=add-demographic-fields.js.map