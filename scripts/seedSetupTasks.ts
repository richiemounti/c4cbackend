// scripts/seedSetupTasks.ts
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

// Import the CSV parser utility
import { convertCSVDataToSetupTasks } from '../utils/csvParser';

// Import models
import ProjectSetup from '../models/projectSetupTask.model';
import ProjectSiteSetup from '../models/projectSiteSetupTask.model';
import TaskTemplate from '../models/taskTemplate.model'; // Add this import

import { connectToDatabase } from '../database/mongodb';

// Load environment variables
dotenv.config();

// Create collection to store default task templates
const createDefaultTaskTemplates = async () => {
  try {
    // Read project setup CSV
    const projectSetupCSVPath = path.join(__dirname, '../data/Set_Up_Your_Project_final.csv');
    const projectSetupCSV = fs.readFileSync(projectSetupCSVPath, 'utf8');
    const projectSetupRecords = parse(projectSetupCSV);
    const projectSetupTasks = convertCSVDataToSetupTasks(projectSetupRecords, false);

    // Read project site setup CSV
    const projectSiteSetupCSVPath = path.join(__dirname, '../data/Set_Up_Your_Sites_final.csv');
    const projectSiteSetupCSV = fs.readFileSync(projectSiteSetupCSVPath, 'utf8');
    const projectSiteSetupRecords = parse(projectSiteSetupCSV);
    const projectSiteSetupTasks = convertCSVDataToSetupTasks(projectSiteSetupRecords, true);

    // Check if templates already exist
    const existingProjectTemplate = await TaskTemplate.findOne({ type: 'project' });
    const existingProjectSiteTemplate = await TaskTemplate.findOne({ type: 'projectSite' });

    // Create or update project template
    if (existingProjectTemplate) {
      console.log('Updating existing project setup template');
      existingProjectTemplate.tasks = projectSetupTasks;
      existingProjectTemplate.updatedAt = new Date();
      await existingProjectTemplate.save();
    } else {
      console.log('Creating new project setup template');
      await TaskTemplate.create({
        type: 'project',
        tasks: projectSetupTasks
      });
    }

    // Create or update project site template
    if (existingProjectSiteTemplate) {
      console.log('Updating existing project site setup template');
      existingProjectSiteTemplate.tasks = projectSiteSetupTasks;
      existingProjectSiteTemplate.updatedAt = new Date();
      await existingProjectSiteTemplate.save();
    } else {
      console.log('Creating new project site setup template');
      await TaskTemplate.create({
        type: 'projectSite',
        tasks: projectSiteSetupTasks
      });
    }

    console.log('Task templates created successfully');
  } catch (error) {
    console.error('Error creating task templates:', error);
  }
};

// Main function to run the script
const seedSetupTasks = async () => {
  try {
    await connectToDatabase();
    await createDefaultTaskTemplates();
    console.log('Setup tasks seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed setup tasks:', error);
    process.exit(1);
  }
};

// Run the script
seedSetupTasks();