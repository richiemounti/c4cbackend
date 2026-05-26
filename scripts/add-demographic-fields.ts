// scripts/add-demographic-fields.ts
// Simple migration to add only the missing demographic fields

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the correct file
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

// Also try loading from .env as fallback
dotenv.config();

// Define a loose schema for migration purposes
const questionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', questionSchema);

const addDemographicFields = async (): Promise<void> => {
  try {
    console.log('🚀 Adding demographic fields to existing questions...');
    
    // Connect to MongoDB
    if (!process.env.DB_URI) {
      console.log('❌ Available environment variables:');
      console.log('   NODE_ENV:', process.env.NODE_ENV);
      console.log('   Current working directory:', process.cwd());
      console.log('   Looking for MONGODB_URI...');
      
      // List all environment variables that contain 'MONGO' or 'DB'
      const relevantEnvVars = Object.keys(process.env).filter(key => 
        key.toLowerCase().includes('mongo') || key.toLowerCase().includes('db')
      );
      
      if (relevantEnvVars.length > 0) {
        console.log('   Found related environment variables:', relevantEnvVars);
      } else {
        console.log('   No MongoDB-related environment variables found');
      }
      
      throw new Error('MONGODB_URI environment variable is required');
    }
    
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find questions missing demographic fields
    const questionsNeedingDemographicFields = await Question.find({
      isStandardDemographic: { $exists: false }
    });
    
    console.log(`📊 Found ${questionsNeedingDemographicFields.length} questions missing demographic fields`);
    
    if (questionsNeedingDemographicFields.length === 0) {
      console.log('✅ All questions already have demographic fields!');
      return;
    }
    
    // Update all questions to add the missing demographic fields
    const result = await Question.updateMany(
      { isStandardDemographic: { $exists: false } },
      {
        $set: {
          isStandardDemographic: false,
          isGlobalStandard: false
          // Note: We don't set demographicType, demographicCategory, or demographicMetadata
          // because they should only exist when isStandardDemographic is true
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} questions with demographic fields`);
    
    // Verify the update
    const remainingQuestions: number = await Question.countDocuments({
      isStandardDemographic: { $exists: false }
    });
    
    if (remainingQuestions === 0) {
      console.log('🎉 All questions now have demographic fields!');
    } else {
      console.log(`⚠️  ${remainingQuestions} questions still missing demographic fields`);
    }
    
    // Show final summary
    const totalQuestions: number = await Question.countDocuments({});
    const questionsWithDemographics: number = await Question.countDocuments({ 
      isStandardDemographic: { $exists: true } 
    });
    const demographicQuestions: number = await Question.countDocuments({ 
      isStandardDemographic: true 
    });
    
    console.log('\n📈 Final Summary:');
    console.log(`   Total questions: ${totalQuestions}`);
    console.log(`   Questions with demographic fields: ${questionsWithDemographics}`);
    console.log(`   Questions marked as demographic: ${demographicQuestions}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the migration if this file is executed directly
const runMigration = async (): Promise<void> => {
  try {
    await addDemographicFields();
    console.log('🎉 Demographic fields migration completed');
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

export { addDemographicFields };