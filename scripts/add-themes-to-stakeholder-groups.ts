  // scripts/add-themes-to-stakeholder-groups.ts
// Migration to add themes field to existing stakeholder groups

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the correct file
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

// Also try loading from .env as fallback
dotenv.config();

// Define interfaces for migration purposes
interface IStakeholderGroup extends mongoose.Document {
  themes?: mongoose.Types.ObjectId[];
  category?: mongoose.Types.ObjectId;
  name?: string;
  [key: string]: any; // Allow other properties
}

interface ITheme extends mongoose.Document {
  name?: string;
  _id: mongoose.Types.ObjectId;
  [key: string]: any;
}

interface ICategory extends mongoose.Document {
  name?: string;
  _id: mongoose.Types.ObjectId;
  [key: string]: any;
}

// Define a loose schema for migration purposes
const stakeholderGroupSchema = new mongoose.Schema({}, { strict: false });
const StakeholderGroup = mongoose.model<IStakeholderGroup>('StakeholderGroup', stakeholderGroupSchema);

const addThemesToStakeholderGroups = async (): Promise<void> => {
  try {
    console.log('🚀 Adding themes field to existing stakeholder groups...');
    
    // Connect to MongoDB
    if (!process.env.DB_URI) {
      console.log('❌ Available environment variables:');
      console.log('   NODE_ENV:', process.env.NODE_ENV);
      console.log('   Current working directory:', process.cwd());
      console.log('   Looking for DB_URI...');
      
      // List all environment variables that contain 'MONGO' or 'DB'
      const relevantEnvVars = Object.keys(process.env).filter(key => 
        key.toLowerCase().includes('mongo') || key.toLowerCase().includes('db')
      );
      
      if (relevantEnvVars.length > 0) {
        console.log('   Found related environment variables:', relevantEnvVars);
      } else {
        console.log('   No MongoDB-related environment variables found');
      }
      
      throw new Error('DB_URI environment variable is required');
    }
    
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find stakeholder groups missing themes field
    const stakeholderGroupsNeedingThemes = await StakeholderGroup.find({
      themes: { $exists: false }
    });
    
    console.log(`📊 Found ${stakeholderGroupsNeedingThemes.length} stakeholder groups missing themes field`);
    
    if (stakeholderGroupsNeedingThemes.length === 0) {
      console.log('✅ All stakeholder groups already have themes field!');
      return;
    }
    
    // Update all stakeholder groups to add the missing themes field
    // Empty array means "no restrictions" - can work with any themes
    const result = await StakeholderGroup.updateMany(
      { themes: { $exists: false } },
      {
        $set: {
          themes: [] // Empty array = no theme restrictions
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} stakeholder groups with themes field`);
    
    // Verify the update
    const remainingGroups: number = await StakeholderGroup.countDocuments({
      themes: { $exists: false }
    });
    
    if (remainingGroups === 0) {
      console.log('🎉 All stakeholder groups now have themes field!');
    } else {
      console.log(`⚠️  ${remainingGroups} stakeholder groups still missing themes field`);
    }
    
    // Show final summary
    const totalGroups: number = await StakeholderGroup.countDocuments({});
    const groupsWithThemes: number = await StakeholderGroup.countDocuments({ 
      themes: { $exists: true } 
    });
    const groupsWithThemeRestrictions: number = await StakeholderGroup.countDocuments({ 
      themes: { $exists: true, $not: { $size: 0 } }
    });
    
    console.log('\n📈 Final Summary:');
    console.log(`   Total stakeholder groups: ${totalGroups}`);
    console.log(`   Groups with themes field: ${groupsWithThemes}`);
    console.log(`   Groups with theme restrictions: ${groupsWithThemeRestrictions}`);
    console.log(`   Groups with no restrictions (empty themes array): ${groupsWithThemes - groupsWithThemeRestrictions}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

/**
 * Set specific theme associations for stakeholder groups
 * You can customize this function based on your business logic
 */
const setDefaultThemeAssociations = async (): Promise<void> => {
  try {
    console.log('🎯 Setting default theme associations...');
    
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.DB_URI!);
      console.log('✅ Connected to MongoDB');
    }
    
    // Define loose schemas for migration purposes
    const themeSchema = new mongoose.Schema({}, { strict: false });
    const categorySchema = new mongoose.Schema({}, { strict: false });
    const Theme = mongoose.model<ITheme>('Theme', themeSchema);
    const Category = mongoose.model<ICategory>('Category', categorySchema);
    
    // Get some themes and categories for example associations
    const themes = await Theme.find({}).limit(3);
    const categories = await Category.find({}).limit(2);
    
    if (themes.length > 0 && categories.length > 0) {
      // Example: Associate first category stakeholders with first 2 themes
      const result = await StakeholderGroup.updateMany(
        { category: categories[0]._id },
        { $set: { themes: [themes[0]._id, themes[1]._id] } }
      );
      
      console.log(`✅ Associated category "${categories[0].name}" stakeholders with themes: ${themes[0].name}, ${themes[1].name}`);
      console.log(`   Updated ${result.modifiedCount} stakeholder groups`);
      
      // You can add more associations here based on your business logic
    } else {
      console.log('⚠️  No themes or categories found for associations');
    }
    
    console.log('🎉 Default theme associations completed!');
    
  } catch (error) {
    console.error('❌ Error setting default theme associations:', error);
    throw error;
  }
};

// Run the migration if this file is executed directly
const runMigration = async (): Promise<void> => {
  try {
    await addThemesToStakeholderGroups();
    
    // Optionally set some default associations
    // Uncomment the line below if you want to set default theme associations
    // await setDefaultThemeAssociations();
    
    console.log('🎉 Stakeholder groups themes migration completed');
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
};

// Check if this file is being run directly
if (require.main === module) {
  runMigration();
}

export { addThemesToStakeholderGroups, setDefaultThemeAssociations };