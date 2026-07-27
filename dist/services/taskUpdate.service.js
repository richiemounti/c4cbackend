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
exports.TaskUpdateService = void 0;
// services/taskUpdate.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const projectSetupTask_model_1 = __importDefault(require("../models/projectSetupTask.model"));
const projectSiteSetupTask_model_1 = __importDefault(require("../models/projectSiteSetupTask.model"));
const taskTemplate_model_1 = __importDefault(require("../models/taskTemplate.model"));
class TaskUpdateService {
    /**
     * Update task properties globally across all projects
     */
    static updateTaskGlobally(fieldName_1, updates_1) {
        return __awaiter(this, arguments, void 0, function* (fieldName, updates, options = {}) {
            const { onlyIncompleted = false, dryRun = false, setupType = 'both' } = options;
            // Build update query
            const updateFields = {};
            Object.entries(updates).forEach(([key, value]) => {
                updateFields[`tasks.$.${key}`] = value;
            });
            // Build match criteria
            const matchCriteria = { "tasks.fieldName": fieldName };
            if (onlyIncompleted) {
                matchCriteria["tasks.isCompleted"] = false;
            }
            if (dryRun) {
                // Return count of affected documents
                const results = {};
                if (setupType === 'project' || setupType === 'both') {
                    results.affectedProjects = yield projectSetupTask_model_1.default.countDocuments(matchCriteria);
                }
                if (setupType === 'projectSite' || setupType === 'both') {
                    results.affectedSites = yield projectSiteSetupTask_model_1.default.countDocuments(matchCriteria);
                }
                return results;
            }
            // Execute updates
            const results = {};
            if (setupType === 'project' || setupType === 'both') {
                const projectResult = yield projectSetupTask_model_1.default.updateMany(matchCriteria, { $set: updateFields });
                results.projectsUpdated = projectResult.modifiedCount;
            }
            if (setupType === 'projectSite' || setupType === 'both') {
                const siteResult = yield projectSiteSetupTask_model_1.default.updateMany(matchCriteria, { $set: updateFields });
                results.sitesUpdated = siteResult.modifiedCount;
            }
            return results;
        });
    }
    /**
     * Update task template in TaskTemplate collection
     * Returns null if TaskTemplate model doesn't exist
     */
    static updateTaskTemplate(type, fieldName, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check if TaskTemplate model exists
                if (!mongoose_1.default.modelNames().includes('TaskTemplate')) {
                    console.warn(`  ⚠️  TaskTemplate model not found - skipping template update for ${fieldName}`);
                    return { modifiedCount: 0, skipped: true };
                }
                // Build update query for template
                const updateFields = {};
                Object.entries(updates).forEach(([key, value]) => {
                    updateFields[`tasks.$.${key}`] = value;
                });
                const result = yield taskTemplate_model_1.default.updateMany({
                    type,
                    "tasks.fieldName": fieldName,
                    isActive: true
                }, { $set: updateFields });
                return result;
            }
            catch (error) {
                console.warn(`  ⚠️  Could not update TaskTemplate for ${fieldName}: ${error instanceof Error ? error.message : error}`);
                return { modifiedCount: 0, error: true };
            }
        });
    }
    // Add this method to the TaskUpdateService class
    /**
     * Reorder tasks by updating their sortOrder
     */
    static reorderTasks(setupType_1, reorderMap_1) {
        return __awaiter(this, arguments, void 0, function* (setupType, reorderMap, dryRun = false) {
            console.log(`${dryRun ? 'DRY RUN - ' : ''}Reordering tasks...`);
            const results = [];
            for (const { fieldName, newSortOrder } of reorderMap) {
                try {
                    const updateFields = {
                        'tasks.$.sortOrder': newSortOrder
                    };
                    const matchCriteria = {
                        'tasks.fieldName': fieldName
                    };
                    if (dryRun) {
                        // Count affected documents
                        let projectCount = 0;
                        let siteCount = 0;
                        if (setupType === 'project') {
                            projectCount = yield projectSetupTask_model_1.default.countDocuments(matchCriteria);
                        }
                        else if (setupType === 'projectSite') {
                            siteCount = yield projectSiteSetupTask_model_1.default.countDocuments(matchCriteria);
                        }
                        results.push({
                            fieldName,
                            newSortOrder,
                            affectedProjects: projectCount,
                            affectedSites: siteCount
                        });
                        console.log(`  ${fieldName} → sortOrder: ${newSortOrder} (would affect ${setupType === 'project' ? projectCount : siteCount} documents)`);
                    }
                    else {
                        // Execute updates
                        const Model = setupType === 'project' ? projectSetupTask_model_1.default : projectSiteSetupTask_model_1.default;
                        const result = yield Model.updateMany(matchCriteria, { $set: updateFields });
                        // Update template
                        const templateResult = yield this.updateTaskTemplate(setupType, fieldName, { sortOrder: newSortOrder });
                        results.push({
                            fieldName,
                            newSortOrder,
                            documentsUpdated: result.modifiedCount,
                            templateUpdated: (templateResult === null || templateResult === void 0 ? void 0 : templateResult.modifiedCount) || 0
                        });
                        console.log(`  ${fieldName} → sortOrder: ${newSortOrder} (${result.modifiedCount} documents updated)`);
                    }
                }
                catch (error) {
                    console.error(`  Error reordering ${fieldName}:`, error);
                    results.push({
                        fieldName,
                        newSortOrder,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
            return results;
        });
    }
    /**
     * Apply all project task modifications as specified
     */
    static applyProjectTaskModifications() {
        return __awaiter(this, arguments, void 0, function* (dryRun = true) {
            console.log(`${dryRun ? 'DRY RUN - ' : ''}Applying project task modifications...`);
            const modifications = [
                {
                    fieldName: "villages",
                    updates: {
                        dataType: "string",
                        helperText: "List the villages that are covered by this project"
                    },
                    description: "Task 6: Update helper text for villages"
                },
                {
                    fieldName: "gps_coordinates",
                    updates: {
                        dataType: "string",
                        fieldLabel: "Enter the Google Maps link for the project location.",
                        helperText: "Paste the URL from Google Maps that shows the main project site",
                        description: "Paste the URL from Google Maps that shows the main project site"
                    },
                    description: "Task 7: Update helper text for GPS coordinates"
                },
                {
                    fieldName: "shapefiles_uploaded",
                    updates: {
                        isRequired: false,
                        dataType: "file"
                    },
                    description: "Task 8: Make shapefiles upload not compulsory"
                },
                {
                    fieldName: "governance_notes",
                    updates: {
                        helperText: "Explain how the project is governed at different levels. You might include: Who gave permission for the project (e.g., village assembly, district council, government agency)? Which organizations or actors are involved in implementation? Who is responsible for oversight, enforcement, or reporting? Whether any public–private or customary–formal partnerships are in place?"
                    },
                    description: "Task 11: Fix grammar in governance helper text"
                },
                {
                    fieldName: "approval_granted_by",
                    updates: {
                        dataType: "array",
                        options: [],
                        description: "User can input their own tags for approval authorities",
                        helperText: "Add the authorities who granted approval for this project. Press Enter or click + to add each authority as a tag."
                    },
                    description: "Task 12: Convert to taggable array field"
                },
                {
                    fieldName: "implementing_organisations",
                    updates: {
                        dataType: "array",
                        options: [],
                        description: "User can input their own tags for implementing organizations",
                        helperText: "Add the organizations implementing this project. Press Enter or click + to add each organization as a tag."
                    },
                    description: "Task 13: Convert to taggable array field"
                },
                {
                    fieldName: "oversight_authorities",
                    updates: {
                        dataType: "array",
                        options: [],
                        description: "User can input their own tags for oversight authorities",
                        helperText: "Add the authorities overseeing this project. Press Enter or click + to add each authority as a tag.",
                        isRequired: false
                    },
                    description: "Task 14: Convert to taggable array field and make not compulsory"
                },
                {
                    fieldName: "partnership_type",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 15: Make not compulsory"
                },
                {
                    fieldName: "customary_institutions_involved",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 16: Make not compulsory"
                },
                {
                    fieldName: "customary_institutions_details",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 17: Make not compulsory"
                },
                {
                    fieldName: "customary_rights_holder",
                    updates: {
                        options: [
                            "Entire community (via village assembly or council)",
                            "Clan or lineage group",
                            "Traditional leader (e.g. chief, elder, sub-chief)",
                            "Women's land use group",
                            "Youth or pastoral subgroup",
                            "Sacred site custodians",
                            "Customary trust or association",
                            "Other (please specify)"
                        ]
                    },
                    description: "Task 19: Fix array parsing for traditional leader option"
                },
                {
                    fieldName: "land_agreements_uploaded",
                    updates: {
                        helperText: "Attach any documents that establish formal or informal land access; including contracts, community agreements, FPIC documentation showing community consent. Upload as many documents as you see fit - there is no size limits"
                    },
                    description: "Task 22: Upload as many files as you want"
                },
                {
                    fieldName: "conflict_notes",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 24: Make not compulsory"
                },
                {
                    fieldName: "access_issues",
                    updates: {
                        helperText: "Select ‘yes’ if the project area is hard to reach due to poor roads, difficult terrain, seasonal flooding, lack of transport, or security concerns. Consider if this presents any risks to the project and if so complete the risk register."
                    },
                    description: "Task 26: Add to copy"
                },
                {
                    fieldName: "access_notes",
                    updates: {
                        isRequired: false,
                        helperText: "Briefly explain."
                    },
                    description: "Task 27: Make not compulsory"
                },
                {
                    fieldName: "previous_failure_notes",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 29: Make not compulsory"
                }
            ];
            return yield this.applyModifications('project', modifications, dryRun);
        });
    }
    /**
     * Apply all project site task modifications as specified
     */
    static applyProjectSiteTaskModifications() {
        return __awaiter(this, arguments, void 0, function* (dryRun = true) {
            console.log(`${dryRun ? 'DRY RUN - ' : ''}Applying project site task modifications...`);
            const modifications = [
                {
                    fieldName: "site_location_description",
                    updates: {
                        fieldLabel: "Site location description",
                        isRequired: false,
                        helperText: "Paste the URL from Google Maps that shows the main site"
                    },
                    description: "Task 2 (was 3): Make not compulsory"
                },
                {
                    fieldName: "admin_level_1",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 3 (was 4): Make not compulsory"
                },
                {
                    fieldName: "admin_level_2",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 4 (was 5): Make not compulsory"
                },
                {
                    fieldName: "admin_level_3",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 5 (was 6): Make not compulsory"
                },
                {
                    fieldName: "gps_coordinates",
                    updates: {
                        dataType: "string",
                        isRequired: false
                    },
                    description: "Task 6: Change to text field and make not compulsory"
                },
                {
                    fieldName: "site_hectare_coverage",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 7: Make not compulsory"
                },
                {
                    fieldName: "site_ecological_zone",
                    updates: {
                        hoverText: ""
                    },
                    description: "Task 8: Remove hover text"
                },
                {
                    fieldName: "gender_distribution",
                    updates: {
                        dataType: "string",
                        isRequired: false
                    },
                    description: "Task 10: Change to text field and make not compulsory"
                },
                {
                    fieldName: "age_distribution",
                    updates: {
                        dataType: "string",
                        isRequired: false
                    },
                    description: "Task 11: Change to text field and make not compulsory"
                },
                {
                    fieldName: "ethnic_groups_present",
                    updates: {
                        dataType: "array",
                        options: [],
                        description: "User can input their own tags for ethnic groups"
                    },
                    description: "Task 12: Make taggable array for user input"
                },
                {
                    fieldName: "vulnerability_indicators",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 14: Make not compulsory"
                },
                {
                    fieldName: "education_summary",
                    updates: {
                        dataType: "array",
                        options: [
                            "Most have not completed primary school",
                            "Most completed primary school",
                            "Mixed primary and secondary",
                            "Most completed secondary school",
                            "Many have vocational or technical training",
                            "Some have college or university education",
                            "Unknown"
                        ]
                    },
                    description: "Task 15: Change to array with education options"
                },
                {
                    fieldName: "secondary_income_sources",
                    updates: {
                        isRequired: false
                    },
                    description: "Task 17: Make not compulsory"
                },
                {
                    fieldName: "cultivated_land_size",
                    updates: {
                        dataType: "array",
                        options: [
                            "None",
                            "0.5 hectares or less",
                            "0.5–2 hectares",
                            "2–5 hectares",
                            "More than 5 hectares",
                            "Highly variable",
                            "Unknown"
                        ]
                    },
                    description: "Task 18: Change to array with land size options"
                },
                {
                    fieldName: "livestock_profile",
                    updates: {
                        dataType: "object",
                        description: "Two-part selection: livestock type and quantity range",
                        options: []
                    },
                    description: "Task 20: Change to structured livestock selection (type + quantity)"
                },
                {
                    fieldName: "wildlife_conflict_summary",
                    updates: {
                        dataType: "object",
                        description: "Two-part selection: species and frequency",
                        isRequired: false,
                        options: []
                    },
                    description: "Task 21: Change to structured wildlife conflict (species + frequency) and make optional"
                }
            ];
            return yield this.applyModifications('projectSite', modifications, dryRun);
        });
    }
    /**
     * Generic method to apply modifications
     */
    static applyModifications(setupType, modifications, dryRun) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            for (const mod of modifications) {
                try {
                    console.log(`${dryRun ? 'SIMULATING: ' : 'APPLYING: '}${mod.description}`);
                    // Update existing setups
                    const setupResult = yield this.updateTaskGlobally(mod.fieldName, mod.updates, {
                        dryRun,
                        setupType,
                        onlyIncompleted: false
                    });
                    // Update task templates
                    let templateResult = null;
                    if (!dryRun) {
                        templateResult = yield this.updateTaskTemplate(setupType, mod.fieldName, mod.updates);
                    }
                    results.push({
                        fieldName: mod.fieldName,
                        description: mod.description,
                        setupResult,
                        templateResult,
                        success: true
                    });
                    console.log(`  Result: ${JSON.stringify(setupResult)}`);
                }
                catch (error) {
                    console.error(`  Error: ${error}`);
                    results.push({
                        fieldName: mod.fieldName,
                        description: mod.description,
                        error: error,
                        success: false
                    });
                }
            }
            console.log(`\n${dryRun ? 'DRY RUN COMPLETE' : 'MODIFICATIONS APPLIED'}`);
            console.log(`Processed ${results.length} modifications`);
            console.log(`Successful: ${results.filter(r => r.success).length}`);
            console.log(`Failed: ${results.filter(r => !r.success).length}`);
            return results;
        });
    }
}
exports.TaskUpdateService = TaskUpdateService;
exports.default = TaskUpdateService;
//# sourceMappingURL=taskUpdate.service.js.map