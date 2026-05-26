// scripts/checkTemplates.ts - TypeScript-safe version
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

async function checkTemplates() {
  try {
    await connectToDatabase();

    console.log('='.repeat(60));
    console.log('CHECKING DATABASE FOR TEMPLATES');
    console.log('='.repeat(60));

    // Ensure connection is ready
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not ready');
    }

    // Check what collections exist
    const collections = await db.listCollections().toArray();
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
    } else {
      templateCollectionNames.forEach(name => console.log(`  - ${name}`));
    }

    // Check if we can access TaskTemplate collection
    try {
      const TaskTemplateCollection = db.collection('tasktemplates');
      const count = await TaskTemplateCollection.countDocuments();
      console.log(`\n✓ Found 'tasktemplates' collection with ${count} documents`);

      if (count > 0) {
        const allTemplates = await TaskTemplateCollection.find({}).toArray();
        console.log('\nTemplate documents found:');
        allTemplates.forEach((template: any, idx: number) => {
          console.log(`\n${idx + 1}. Template:`);
          console.log(`   _id: ${template._id}`);
          console.log(`   type: ${template.type}`);
          console.log(`   version: ${template.version}`);
          console.log(`   isActive: ${template.isActive}`);
          console.log(`   createdAt: ${template.createdAt}`);
          console.log(`   updatedAt: ${template.updatedAt}`);
          console.log(`   tasks: ${template.tasks?.length || 0} tasks`);
        });

        // Check if any are active
        const activeCount = allTemplates.filter((t: any) => t.isActive).length;
        console.log(`\n📊 Summary:`);
        console.log(`   Total templates: ${count}`);
        console.log(`   Active templates: ${activeCount}`);
        console.log(`   Inactive templates: ${count - activeCount}`);

        if (activeCount === 0) {
          console.log('\n⚠️  WARNING: No active templates found!');
          console.log('   You may need to set isActive: true on your templates');
          console.log('   Run: npx ts-node scripts/activateTemplates.ts');
        } else {
          console.log('\n✅ Active templates are ready!');
          console.log('   You can now run: npx ts-node scripts/fixBothTemplates.ts');
        }
      } else {
        console.log('\n⚠️  No templates found in collection!');
        console.log('   You need to create templates first.');
      }
    } catch (err) {
      console.log('\n❌ Could not access tasktemplates collection');
      console.log(`   Error: ${err}`);
    }

    // Also check for alternative collection names
    const alternativeNames = ['TaskTemplate', 'taskTemplate', 'task_templates', 'TaskTemplates'];
    for (const altName of alternativeNames) {
      try {
        const altCollection = db.collection(altName);
        const altCount = await altCollection.countDocuments();
        if (altCount > 0) {
          console.log(`\n✓ Also found '${altName}' collection with ${altCount} documents`);
        }
      } catch (err) {
        // Collection doesn't exist, that's fine
      }
    }

  } catch (error) {
    console.error('Error checking templates:', error);
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  checkTemplates();
}

export { checkTemplates };