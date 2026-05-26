// scripts/diagnoseTemplates.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskTemplate from '../models/taskTemplate.model';
import ProjectSetup from '../models/projectSetupTask.model';
import ProjectSiteSetup from '../models/projectSiteSetupTask.model';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

async function diagnoseTemplates() {
  try {
    await connectToDatabase();

    console.log('='.repeat(60));
    console.log('TEMPLATE DIAGNOSIS');
    console.log('='.repeat(60));

    // Check all templates
    const allTemplates = await TaskTemplate.find({});
    console.log(`\nTotal templates in database: ${allTemplates.length}`);
    
    // Check active templates
    const activeTemplates = await TaskTemplate.find({ isActive: true });
    console.log(`Active templates: ${activeTemplates.length}`);
    
    if (activeTemplates.length > 2) {
      console.log('\n⚠️  WARNING: More than 2 active templates found (should be 1 project + 1 projectSite)!');
    }

    // Show details of each active template
    for (const template of activeTemplates) {
      console.log('\n' + '-'.repeat(60));
      console.log(`Type: ${template.type}`);
      console.log(`ID: ${template._id}`);
      console.log(`Version: ${template.version}`);
      console.log(`Active: ${template.isActive}`);
      console.log(`Created: ${template.createdAt}`);
      console.log(`Updated: ${template.updatedAt}`);
      console.log(`Number of tasks: ${template.tasks.length}`);
      
      // Show sample of task field names
      console.log('\nTask field names (first 10):');
      template.tasks.slice(0, 10).forEach((task: { fieldName: any; dataType: any; isRequired: any; }, idx: number) => {
        console.log(`  ${idx + 1}. ${task.fieldName} (${task.dataType}) ${task.isRequired ? '[REQUIRED]' : '[OPTIONAL]'}`);
      });
      if (template.tasks.length > 10) {
        console.log(`  ... and ${template.tasks.length - 10} more tasks`);
      }

      // Check specific fields based on template type
      if (template.type === 'project') {
        console.log('\n📋 Checking key PROJECT fields:');
        const fieldsToCheck = [
          'villages',
          'gps_coordinates',
          'shapefiles_uploaded',
          'approval_granted_by',
          'implementing_organisations',
          'oversight_authorities',
          'customary_rights_holder',
          'land_agreements_uploaded'
        ];

        fieldsToCheck.forEach(fieldName => {
          const task = template.tasks.find((t: any) => t.fieldName === fieldName);
          if (task) {
            console.log(`  ✓ ${fieldName}:`);
            console.log(`    - dataType: ${(task as any).dataType}`);
            console.log(`    - isRequired: ${(task as any).isRequired}`);
            if ((task as any).options && (task as any).options.length > 0) {
              console.log(`    - options: ${(task as any).options.length} items`);
            } else if ((task as any).options) {
              console.log(`    - options: [] (empty array)`);
            }
            if ((task as any).helperText) {
              console.log(`    - helperText: ${(task as any).helperText.substring(0, 50)}...`);
            }
          } else {
            console.log(`  ✗ ${fieldName}: NOT FOUND`);
          }
        });
      }

      if (template.type === 'projectSite') {
        console.log('\n📋 Checking key PROJECT SITE fields:');
        const fieldsToCheck = [
          'site_location_description',
          'gps_coordinates',
          'site_hectare_coverage',
          'site_ecological_zone',
          'gender_distribution',
          'age_distribution',
          'ethnic_groups_present',
          'vulnerability_indicators',
          'education_summary',
          'secondary_income_sources',
          'cultivated_land_size',
          'livestock_profile',
          'wildlife_conflict_summary'
        ];

        fieldsToCheck.forEach(fieldName => {
          const task = template.tasks.find((t: any) => t.fieldName === fieldName);
          if (task) {
            console.log(`  ✓ ${fieldName}:`);
            console.log(`    - dataType: ${(task as any).dataType}`);
            console.log(`    - isRequired: ${(task as any).isRequired}`);
            if ((task as any).options && (task as any).options.length > 0) {
              console.log(`    - options: ${(task as any).options.length} items`);
            } else if ((task as any).options) {
              console.log(`    - options: [] (empty array)`);
            }
            if ((task as any).hoverText) {
              console.log(`    - hoverText: "${(task as any).hoverText.substring(0, 40)}${(task as any).hoverText.length > 40 ? '...' : ''}"`);
            } else {
              console.log(`    - hoverText: (empty or not set)`);
            }
          } else {
            console.log(`  ✗ ${fieldName}: NOT FOUND`);
          }
        });
      }
    }

    // Check a sample of project setups
    console.log('\n' + '='.repeat(60));
    console.log('SAMPLE PROJECT SETUPS');
    console.log('='.repeat(60));

    const sampleProjects = await ProjectSetup.find({}).limit(3).populate('project', 'name');
    
    console.log(`\nFound ${sampleProjects.length} sample projects to check:`);
    
    for (const setup of sampleProjects) {
      console.log('\n' + '-'.repeat(60));
      console.log(`Project: ${(setup.project as any)?.name || setup.project}`);
      console.log(`ID: ${setup._id}`);
      console.log(`Number of tasks: ${setup.tasks.length}`);
      console.log(`Progress: ${setup.progress}%`);
      console.log(`Created: ${setup.createdAt}`);
      console.log(`Updated: ${setup.updatedAt}`);
      
      // Check for specific problematic fields
      const problemFields = [
        'villages',
        'gps_coordinates',
        'approval_granted_by',
        'implementing_organisations'
      ];
      
      console.log('\n  Checking key fields:');
      for (const fieldName of problemFields) {
        const task = setup.tasks.find((t: any) => t.fieldName === fieldName);
        if (task) {
          console.log(`    ✓ ${fieldName}: ${(task as any).dataType} ${(task as any).isRequired ? '[REQUIRED]' : '[OPTIONAL]'}`);
        } else {
          console.log(`    ✗ ${fieldName}: NOT FOUND`);
        }
      }
    }

    // Check a sample of project site setups
    console.log('\n' + '='.repeat(60));
    console.log('SAMPLE PROJECT SITE SETUPS');
    console.log('='.repeat(60));

    const sampleSites = await ProjectSiteSetup.find({}).limit(3).populate('projectSite', 'name');
    
    console.log(`\nFound ${sampleSites.length} sample sites to check:`);
    
    for (const setup of sampleSites) {
      console.log('\n' + '-'.repeat(60));
      console.log(`Site: ${(setup.projectSite as any)?.name || setup.projectSite}`);
      console.log(`ID: ${setup._id}`);
      console.log(`Number of tasks: ${setup.tasks.length}`);
      console.log(`Progress: ${setup.progress}%`);
      console.log(`Created: ${setup.createdAt}`);
      console.log(`Updated: ${setup.updatedAt}`);
      
      // Check for specific problematic fields
      const problemFields = [
        'gps_coordinates',
        'site_hectare_coverage',
        'gender_distribution',
        'age_distribution',
        'education_summary'
      ];
      
      console.log('\n  Checking key fields:');
      for (const fieldName of problemFields) {
        const task = setup.tasks.find((t: any) => t.fieldName === fieldName);
        if (task) {
          console.log(`    ✓ ${fieldName}: ${(task as any).dataType} ${(task as any).isRequired ? '[REQUIRED]' : '[OPTIONAL]'}`);
        } else {
          console.log(`    ✗ ${fieldName}: NOT FOUND`);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total templates: ${allTemplates.length}`);
    console.log(`Active templates: ${activeTemplates.length}`);
    console.log(`Project setups checked: ${sampleProjects.length}`);
    console.log(`Site setups checked: ${sampleSites.length}`);

  } catch (error) {
    console.error('Error in diagnosis:', error);
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  diagnoseTemplates();
}

export { diagnoseTemplates };