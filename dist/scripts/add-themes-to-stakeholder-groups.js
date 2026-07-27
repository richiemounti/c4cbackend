"use strict";
// scripts/add-themes-to-stakeholder-groups.ts
// Migration to add themes field to existing stakeholder groups
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
exports.setDefaultThemeAssociations = exports.addThemesToStakeholderGroups = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from the correct file
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env.development.local') });
// Also try loading from .env as fallback
dotenv_1.default.config();
// Define a loose schema for migration purposes
const stakeholderGroupSchema = new mongoose_1.default.Schema({}, { strict: false });
const StakeholderGroup = mongoose_1.default.model('StakeholderGroup', stakeholderGroupSchema);
const addThemesToStakeholderGroups = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🚀 Adding themes field to existing stakeholder groups...');
        // Connect to MongoDB
        if (!process.env.DB_URI) {
            console.log('❌ Available environment variables:');
            console.log('   NODE_ENV:', process.env.NODE_ENV);
            console.log('   Current working directory:', process.cwd());
            console.log('   Looking for DB_URI...');
            // List all environment variables that contain 'MONGO' or 'DB'
            const relevantEnvVars = Object.keys(process.env).filter(key => key.toLowerCase().includes('mongo') || key.toLowerCase().includes('db'));
            if (relevantEnvVars.length > 0) {
                console.log('   Found related environment variables:', relevantEnvVars);
            }
            else {
                console.log('   No MongoDB-related environment variables found');
            }
            throw new Error('DB_URI environment variable is required');
        }
        yield mongoose_1.default.connect(process.env.DB_URI);
        console.log('✅ Connected to MongoDB');
        // Find stakeholder groups missing themes field
        const stakeholderGroupsNeedingThemes = yield StakeholderGroup.find({
            themes: { $exists: false }
        });
        console.log(`📊 Found ${stakeholderGroupsNeedingThemes.length} stakeholder groups missing themes field`);
        if (stakeholderGroupsNeedingThemes.length === 0) {
            console.log('✅ All stakeholder groups already have themes field!');
            return;
        }
        // Update all stakeholder groups to add the missing themes field
        // Empty array means "no restrictions" - can work with any themes
        const result = yield StakeholderGroup.updateMany({ themes: { $exists: false } }, {
            $set: {
                themes: [] // Empty array = no theme restrictions
            }
        });
        console.log(`✅ Updated ${result.modifiedCount} stakeholder groups with themes field`);
        // Verify the update
        const remainingGroups = yield StakeholderGroup.countDocuments({
            themes: { $exists: false }
        });
        if (remainingGroups === 0) {
            console.log('🎉 All stakeholder groups now have themes field!');
        }
        else {
            console.log(`⚠️  ${remainingGroups} stakeholder groups still missing themes field`);
        }
        // Show final summary
        const totalGroups = yield StakeholderGroup.countDocuments({});
        const groupsWithThemes = yield StakeholderGroup.countDocuments({
            themes: { $exists: true }
        });
        const groupsWithThemeRestrictions = yield StakeholderGroup.countDocuments({
            themes: { $exists: true, $not: { $size: 0 } }
        });
        console.log('\n📈 Final Summary:');
        console.log(`   Total stakeholder groups: ${totalGroups}`);
        console.log(`   Groups with themes field: ${groupsWithThemes}`);
        console.log(`   Groups with theme restrictions: ${groupsWithThemeRestrictions}`);
        console.log(`   Groups with no restrictions (empty themes array): ${groupsWithThemes - groupsWithThemeRestrictions}`);
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
exports.addThemesToStakeholderGroups = addThemesToStakeholderGroups;
/**
 * Set specific theme associations for stakeholder groups
 * You can customize this function based on your business logic
 */
const setDefaultThemeAssociations = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🎯 Setting default theme associations...');
        // Connect to MongoDB if not already connected
        if (mongoose_1.default.connection.readyState === 0) {
            yield mongoose_1.default.connect(process.env.DB_URI);
            console.log('✅ Connected to MongoDB');
        }
        // Define loose schemas for migration purposes
        const themeSchema = new mongoose_1.default.Schema({}, { strict: false });
        const categorySchema = new mongoose_1.default.Schema({}, { strict: false });
        const Theme = mongoose_1.default.model('Theme', themeSchema);
        const Category = mongoose_1.default.model('Category', categorySchema);
        // Get some themes and categories for example associations
        const themes = yield Theme.find({}).limit(3);
        const categories = yield Category.find({}).limit(2);
        if (themes.length > 0 && categories.length > 0) {
            // Example: Associate first category stakeholders with first 2 themes
            const result = yield StakeholderGroup.updateMany({ category: categories[0]._id }, { $set: { themes: [themes[0]._id, themes[1]._id] } });
            console.log(`✅ Associated category "${categories[0].name}" stakeholders with themes: ${themes[0].name}, ${themes[1].name}`);
            console.log(`   Updated ${result.modifiedCount} stakeholder groups`);
            // You can add more associations here based on your business logic
        }
        else {
            console.log('⚠️  No themes or categories found for associations');
        }
        console.log('🎉 Default theme associations completed!');
    }
    catch (error) {
        console.error('❌ Error setting default theme associations:', error);
        throw error;
    }
});
exports.setDefaultThemeAssociations = setDefaultThemeAssociations;
// Run the migration if this file is executed directly
const runMigration = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield addThemesToStakeholderGroups();
        // Optionally set some default associations
        // Uncomment the line below if you want to set default theme associations
        // await setDefaultThemeAssociations();
        console.log('🎉 Stakeholder groups themes migration completed');
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
//# sourceMappingURL=add-themes-to-stakeholder-groups.js.map