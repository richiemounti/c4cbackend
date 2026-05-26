// scripts/activateTemplates.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

async function activateTemplates() {
  try {
    await connectToDatabase();

    console.log('='.repeat(60));
    console.log('ACTIVATING TEMPLATES');
    console.log('='.repeat(60));

    // Access the collection directly
    const TaskTemplateCollection = mongoose.connection.collection('tasktemplates');
    
    // Get all templates
    const allTemplates = await TaskTemplateCollection.find({}).toArray();
    
    console.log(`\nFound ${allTemplates.length} templates in database`);

    if (allTemplates.length === 0) {
      console.log('\n❌ No templates found in database!');
      console.log('You need to create templates first.');
      return;
    }

    // Show current state
    console.log('\nCurrent template state:');
    allTemplates.forEach((template: any, idx: number) => {
      console.log(`\n${idx + 1}. ${template.type} template:`);
      console.log(`   _id: ${template._id}`);
      console.log(`   isActive: ${template.isActive}`);
      console.log(`   version: ${template.version}`);
      console.log(`   tasks: ${template.tasks?.length || 0}`);
    });

    // Find the most recent template for each type
    const projectTemplates = allTemplates
      .filter((t: any) => t.type === 'project')
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    const siteTemplates = allTemplates
      .filter((t: any) => t.type === 'projectSite')
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    console.log('\n' + '='.repeat(60));
    console.log('ACTIVATING MOST RECENT TEMPLATES');
    console.log('='.repeat(60));

    // Activate project template
    if (projectTemplates.length > 0) {
      const projectTemplate = projectTemplates[0];
      
      // Deactivate all project templates first
      await TaskTemplateCollection.updateMany(
        { type: 'project' },
        { $set: { isActive: false } }
      );
      
      // Activate the most recent one
      await TaskTemplateCollection.updateOne(
        { _id: projectTemplate._id },
        { $set: { isActive: true, updatedAt: new Date() } }
      );
      
      console.log(`\n✅ Activated PROJECT template: ${projectTemplate._id}`);
      console.log(`   Version: ${projectTemplate.version}`);
      console.log(`   Tasks: ${projectTemplate.tasks?.length || 0}`);
      
      if (projectTemplates.length > 1) {
        console.log(`   (Deactivated ${projectTemplates.length - 1} other project templates)`);
      }
    } else {
      console.log('\n⚠️  No project templates found');
    }

    // Activate project site template
    if (siteTemplates.length > 0) {
      const siteTemplate = siteTemplates[0];
      
      // Deactivate all site templates first
      await TaskTemplateCollection.updateMany(
        { type: 'projectSite' },
        { $set: { isActive: false } }
      );
      
      // Activate the most recent one
      await TaskTemplateCollection.updateOne(
        { _id: siteTemplate._id },
        { $set: { isActive: true, updatedAt: new Date() } }
      );
      
      console.log(`\n✅ Activated PROJECT SITE template: ${siteTemplate._id}`);
      console.log(`   Version: ${siteTemplate.version}`);
      console.log(`   Tasks: ${siteTemplate.tasks?.length || 0}`);
      
      if (siteTemplates.length > 1) {
        console.log(`   (Deactivated ${siteTemplates.length - 1} other site templates)`);
      }
    } else {
      console.log('\n⚠️  No project site templates found');
    }

    // Verify
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION');
    console.log('='.repeat(60));
    
    const activeTemplates = await TaskTemplateCollection.find({ isActive: true }).toArray();
    console.log(`\nActive templates after update: ${activeTemplates.length}`);
    activeTemplates.forEach((template: any) => {
      console.log(`  ✓ ${template.type}: ${template._id}`);
    });

    console.log('\n✅ Templates activated successfully!');
    console.log('You can now run the fixBothTemplates.ts script.');

  } catch (error) {
    console.error('Error activating templates:', error);
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  activateTemplates();
}

export { activateTemplates };