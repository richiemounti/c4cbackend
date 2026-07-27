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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sync_1 = require("csv-parse/sync");
const dotenv_1 = __importDefault(require("dotenv"));
// Import the CSV parser utility
const csvParser_1 = require("../utils/csvParser");
const taskTemplate_model_1 = __importDefault(require("../models/taskTemplate.model")); // Add this import
const mongodb_1 = require("../database/mongodb");
// Load environment variables
dotenv_1.default.config();
// Create collection to store default task templates
const createDefaultTaskTemplates = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Read project setup CSV
        const projectSetupCSVPath = path_1.default.join(__dirname, '../data/Set up your project_YouthImpact_16 03 26 - Project_ UX _ Build specification.csv');
        const projectSetupCSV = fs_1.default.readFileSync(projectSetupCSVPath, 'utf8');
        const projectSetupRecords = (0, sync_1.parse)(projectSetupCSV);
        const projectSetupTasks = (0, csvParser_1.convertCSVDataToSetupTasks)(projectSetupRecords, false);
        // Read project site setup CSV
        const projectSiteSetupCSVPath = path_1.default.join(__dirname, '../data/Set_Up_Your_Sites_YouthImpact.csv');
        const projectSiteSetupCSV = fs_1.default.readFileSync(projectSiteSetupCSVPath, 'utf8');
        const projectSiteSetupRecords = (0, sync_1.parse)(projectSiteSetupCSV);
        const projectSiteSetupTasks = (0, csvParser_1.convertCSVDataToSetupTasks)(projectSiteSetupRecords, true);
        // Check if templates already exist
        const existingProjectTemplate = yield taskTemplate_model_1.default.findOne({ type: 'project' });
        const existingProjectSiteTemplate = yield taskTemplate_model_1.default.findOne({ type: 'projectSite' });
        // Create or update project template
        if (existingProjectTemplate) {
            console.log('Updating existing project setup template');
            existingProjectTemplate.tasks = projectSetupTasks;
            existingProjectTemplate.updatedAt = new Date();
            yield existingProjectTemplate.save();
        }
        else {
            console.log('Creating new project setup template');
            yield taskTemplate_model_1.default.create({
                type: 'project',
                tasks: projectSetupTasks
            });
        }
        // Create or update project site template
        if (existingProjectSiteTemplate) {
            console.log('Updating existing project site setup template');
            existingProjectSiteTemplate.tasks = projectSiteSetupTasks;
            existingProjectSiteTemplate.updatedAt = new Date();
            yield existingProjectSiteTemplate.save();
        }
        else {
            console.log('Creating new project site setup template');
            yield taskTemplate_model_1.default.create({
                type: 'projectSite',
                tasks: projectSiteSetupTasks
            });
        }
        console.log('Task templates created successfully');
    }
    catch (error) {
        console.error('Error creating task templates:', error);
    }
});
// Main function to run the script
const seedSetupTasks = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, mongodb_1.connectToDatabase)();
        yield createDefaultTaskTemplates();
        console.log('Setup tasks seeded successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Failed to seed setup tasks:', error);
        process.exit(1);
    }
});
// Run the script
seedSetupTasks();
//# sourceMappingURL=seedSetupTasks.js.map