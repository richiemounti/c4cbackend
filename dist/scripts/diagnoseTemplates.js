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
exports.diagnoseTemplates = diagnoseTemplates;
const dotenv_1 = __importDefault(require("dotenv"));
const taskTemplate_model_1 = __importDefault(require("../models/taskTemplate.model"));
const projectSetupTask_model_1 = __importDefault(require("../models/projectSetupTask.model"));
const projectSiteSetupTask_model_1 = __importDefault(require("../models/projectSiteSetupTask.model"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
function diagnoseTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            yield (0, mongodb_1.connectToDatabase)();
            console.log('='.repeat(60));
            console.log('TEMPLATE DIAGNOSIS');
            console.log('='.repeat(60));
            // Check all templates
            const allTemplates = yield taskTemplate_model_1.default.find({});
            console.log(`\nTotal templates in database: ${allTemplates.length}`);
            // Check active templates
            const activeTemplates = yield taskTemplate_model_1.default.find({ isActive: true });
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
                template.tasks.slice(0, 10).forEach((task, idx) => {
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
                        const task = template.tasks.find((t) => t.fieldName === fieldName);
                        if (task) {
                            console.log(`  ✓ ${fieldName}:`);
                            console.log(`    - dataType: ${task.dataType}`);
                            console.log(`    - isRequired: ${task.isRequired}`);
                            if (task.options && task.options.length > 0) {
                                console.log(`    - options: ${task.options.length} items`);
                            }
                            else if (task.options) {
                                console.log(`    - options: [] (empty array)`);
                            }
                            if (task.helperText) {
                                console.log(`    - helperText: ${task.helperText.substring(0, 50)}...`);
                            }
                        }
                        else {
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
                        const task = template.tasks.find((t) => t.fieldName === fieldName);
                        if (task) {
                            console.log(`  ✓ ${fieldName}:`);
                            console.log(`    - dataType: ${task.dataType}`);
                            console.log(`    - isRequired: ${task.isRequired}`);
                            if (task.options && task.options.length > 0) {
                                console.log(`    - options: ${task.options.length} items`);
                            }
                            else if (task.options) {
                                console.log(`    - options: [] (empty array)`);
                            }
                            if (task.hoverText) {
                                console.log(`    - hoverText: "${task.hoverText.substring(0, 40)}${task.hoverText.length > 40 ? '...' : ''}"`);
                            }
                            else {
                                console.log(`    - hoverText: (empty or not set)`);
                            }
                        }
                        else {
                            console.log(`  ✗ ${fieldName}: NOT FOUND`);
                        }
                    });
                }
            }
            // Check a sample of project setups
            console.log('\n' + '='.repeat(60));
            console.log('SAMPLE PROJECT SETUPS');
            console.log('='.repeat(60));
            const sampleProjects = yield projectSetupTask_model_1.default.find({}).limit(3).populate('project', 'name');
            console.log(`\nFound ${sampleProjects.length} sample projects to check:`);
            for (const setup of sampleProjects) {
                console.log('\n' + '-'.repeat(60));
                console.log(`Project: ${((_a = setup.project) === null || _a === void 0 ? void 0 : _a.name) || setup.project}`);
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
                    const task = setup.tasks.find((t) => t.fieldName === fieldName);
                    if (task) {
                        console.log(`    ✓ ${fieldName}: ${task.dataType} ${task.isRequired ? '[REQUIRED]' : '[OPTIONAL]'}`);
                    }
                    else {
                        console.log(`    ✗ ${fieldName}: NOT FOUND`);
                    }
                }
            }
            // Check a sample of project site setups
            console.log('\n' + '='.repeat(60));
            console.log('SAMPLE PROJECT SITE SETUPS');
            console.log('='.repeat(60));
            const sampleSites = yield projectSiteSetupTask_model_1.default.find({}).limit(3).populate('projectSite', 'name');
            console.log(`\nFound ${sampleSites.length} sample sites to check:`);
            for (const setup of sampleSites) {
                console.log('\n' + '-'.repeat(60));
                console.log(`Site: ${((_b = setup.projectSite) === null || _b === void 0 ? void 0 : _b.name) || setup.projectSite}`);
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
                    const task = setup.tasks.find((t) => t.fieldName === fieldName);
                    if (task) {
                        console.log(`    ✓ ${fieldName}: ${task.dataType} ${task.isRequired ? '[REQUIRED]' : '[OPTIONAL]'}`);
                    }
                    else {
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
        }
        catch (error) {
            console.error('Error in diagnosis:', error);
        }
        finally {
            yield (0, mongodb_1.disconnectFromDatabase)();
        }
    });
}
if (require.main === module) {
    diagnoseTemplates();
}
//# sourceMappingURL=diagnoseTemplates.js.map