// scripts/fixBothTemplates.ts - UPDATED VERSION
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

async function fixBothTemplates() {
  try {
    await connectToDatabase();

    console.log('='.repeat(60));
    console.log('FIXING BOTH PROJECT AND PROJECT SITE TEMPLATES');
    console.log('='.repeat(60));

    // Access collection directly
    const TaskTemplateCollection = mongoose.connection.collection('tasktemplates');

    // ========================================
    // FIX PROJECT TEMPLATE
    // ========================================
    console.log('\n1. Fixing PROJECT template...\n');

    const projectTemplate: any = await TaskTemplateCollection.findOne({ 
      type: 'project', 
      isActive: true 
    });

    if (!projectTemplate) {
      console.error('❌ No active project template found!');
      console.log('Run: npx ts-node scripts/activateTemplates.ts first');
      return;
    }

    console.log(`Found project template: ${projectTemplate._id}`);
    console.log(`Version: ${projectTemplate.version}`);
    console.log(`Total tasks: ${projectTemplate.tasks.length}\n`);

    const projectUpdates = [
      {
        fieldName: 'villages',
        changes: {
          dataType: 'string',
          helperText: 'List the villages that are covered by this project'
        }
      },
      {
        fieldName: 'gps_coordinates',
        changes: {
          dataType: 'string',
          fieldLabel: 'Enter the Google Maps link for the project location.',
          helperText: 'Paste the URL from Google Maps that shows the main project site',
          description: 'Paste the URL from Google Maps that shows the main project site'
        }
      },
      {
        fieldName: 'shapefiles_uploaded',
        changes: {
          isRequired: false,
          dataType: 'file'
        }
      },
      {
        fieldName: 'governance_notes',
        changes: {
          helperText: 'Explain how the project is governed at different levels. You might include: Who gave permission for the project (e.g., village assembly, district council, government agency)? Which organizations or actors are involved in implementation? Who is responsible for oversight, enforcement, or reporting? Whether any public–private or customary–formal partnerships are in place?'
        }
      },
      {
        fieldName: 'approval_granted_by',
        changes: {
          dataType: 'array',
          options: [],
          description: 'User can input their own tags for approval authorities',
          helperText: 'Add the authorities who granted approval for this project. Press Enter or click + to add each authority as a tag.'
        }
      },
      {
        fieldName: 'implementing_organisations',
        changes: {
          dataType: 'array',
          options: [],
          description: 'User can input their own tags for implementing organizations',
          helperText: 'Add the organizations implementing this project. Press Enter or click + to add each organization as a tag.'
        }
      },
      {
        fieldName: 'oversight_authorities',
        changes: {
          dataType: 'array',
          options: [],
          description: 'User can input their own tags for oversight authorities',
          helperText: 'Add the authorities overseeing this project. Press Enter or click + to add each authority as a tag.',
          isRequired: false
        }
      },
      {
        fieldName: 'partnership_type',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'customary_institutions_involved',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'customary_institutions_details',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'customary_rights_holder',
        changes: {
          options: [
            'Entire community (via village assembly or council)',
            'Clan or lineage group',
            'Traditional leader (e.g. chief, elder, sub-chief)',
            'Women\'s land use group',
            'Youth or pastoral subgroup',
            'Sacred site custodians',
            'Customary trust or association',
            'Other (please specify)'
          ]
        }
      },
      {
        fieldName: 'land_agreements_uploaded',
        changes: {
          helperText: 'Attach any documents that establish formal or informal land access; including contracts, community agreements, FPIC documentation showing community consent. Upload as many documents as you see fit - there is no size limits'
        }
      },
      {
        fieldName: 'conflict_notes',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'access_issues',
        changes: {
          helperText: 'Select \'yes\' if the project area is hard to reach due to poor roads, difficult terrain, seasonal flooding, lack of transport, or security concerns. Consider if this presents any risks to the project and if so complete the risk register.'
        }
      },
      {
        fieldName: 'access_notes',
        changes: {
          isRequired: false,
          helperText: 'Briefly explain.'
        }
      },
      {
        fieldName: 'previous_failure_notes',
        changes: {
          isRequired: false
        }
      }
    ];

    let projectUpdatedCount = 0;
    for (const update of projectUpdates) {
      const taskIndex = projectTemplate.tasks.findIndex((t: any) => t.fieldName === update.fieldName);
      
      if (taskIndex !== -1) {
        console.log(`  ✓ Updating ${update.fieldName}...`);
        Object.assign(projectTemplate.tasks[taskIndex], update.changes);
        projectUpdatedCount++;
      } else {
        console.log(`  ⚠️  Task ${update.fieldName} not found in template`);
      }
    }

    projectTemplate.updatedAt = new Date();
    await TaskTemplateCollection.updateOne(
      { _id: projectTemplate._id },
      { $set: { tasks: projectTemplate.tasks, updatedAt: projectTemplate.updatedAt } }
    );

    console.log(`\n✅ Project template updated!`);
    console.log(`Updated ${projectUpdatedCount} tasks\n`);

    // ========================================
    // FIX PROJECT SITE TEMPLATE
    // ========================================
    console.log('='.repeat(60));
    console.log('2. Fixing PROJECT SITE template...\n');

    const siteTemplate: any = await TaskTemplateCollection.findOne({ 
      type: 'projectSite', 
      isActive: true 
    });

    if (!siteTemplate) {
      console.error('❌ No active project site template found!');
      console.log('Run: npx ts-node scripts/activateTemplates.ts first');
      return;
    }

    console.log(`Found project site template: ${siteTemplate._id}`);
    console.log(`Version: ${siteTemplate.version}`);
    console.log(`Total tasks: ${siteTemplate.tasks.length}\n`);

    const siteUpdates = [
      {
        fieldName: 'site_location_description',
        changes: {
          fieldLabel: 'Site location description',
          isRequired: false
        }
      },
      {
        fieldName: 'admin_level_1',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'admin_level_2',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'admin_level_3',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'gps_coordinates',
        changes: {
          dataType: 'string',
          isRequired: false
        }
      },
      {
        fieldName: 'site_hectare_coverage',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'site_ecological_zone',
        changes: {
          hoverText: ''
        }
      },
      {
        fieldName: 'gender_distribution',
        changes: {
          dataType: 'string',
          isRequired: false
        }
      },
      {
        fieldName: 'age_distribution',
        changes: {
          dataType: 'string',
          isRequired: false
        }
      },
      {
        fieldName: 'ethnic_groups_present',
        changes: {
          dataType: 'array',
          options: [],
          description: 'User can input their own tags for ethnic groups'
        }
      },
      {
        fieldName: 'vulnerability_indicators',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'education_summary',
        changes: {
          dataType: 'array',
          options: [
            'Most have not completed primary school',
            'Most completed primary school',
            'Mixed primary and secondary',
            'Most completed secondary school',
            'Many have vocational or technical training',
            'Some have college or university education',
            'Unknown'
          ]
        }
      },
      {
        fieldName: 'secondary_income_sources',
        changes: {
          isRequired: false
        }
      },
      {
        fieldName: 'cultivated_land_size',
        changes: {
          dataType: 'array',
          options: [
            'None',
            '0.5 hectares or less',
            '0.5–2 hectares',
            '2–5 hectares',
            'More than 5 hectares',
            'Highly variable',
            'Unknown'
          ]
        }
      },
      {
        fieldName: 'livestock_profile',
        changes: {
          dataType: 'object',
          description: 'Two-part selection: livestock type and quantity range',
          options: []
        }
      },
      {
        fieldName: 'wildlife_conflict_summary',
        changes: {
          dataType: 'object',
          description: 'Two-part selection: species and frequency',
          isRequired: false,
          options: []
        }
      }
    ];

    let siteUpdatedCount = 0;
    for (const update of siteUpdates) {
      const taskIndex = siteTemplate.tasks.findIndex((t: any) => t.fieldName === update.fieldName);
      
      if (taskIndex !== -1) {
        console.log(`  ✓ Updating ${update.fieldName}...`);
        Object.assign(siteTemplate.tasks[taskIndex], update.changes);
        siteUpdatedCount++;
      } else {
        console.log(`  ⚠️  Task ${update.fieldName} not found in template`);
      }
    }

    siteTemplate.updatedAt = new Date();
    await TaskTemplateCollection.updateOne(
      { _id: siteTemplate._id },
      { $set: { tasks: siteTemplate.tasks, updatedAt: siteTemplate.updatedAt } }
    );

    console.log(`\n✅ Project site template updated!`);
    console.log(`Updated ${siteUpdatedCount} tasks\n`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Project template: ${projectUpdatedCount} tasks updated`);
    console.log(`✅ Project site template: ${siteUpdatedCount} tasks updated`);
    console.log('\nBoth templates have been successfully updated!');

  } catch (error) {
    console.error('Error fixing templates:', error);
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  fixBothTemplates();
}

export { fixBothTemplates };