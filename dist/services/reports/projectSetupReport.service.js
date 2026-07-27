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
exports.ProjectSetupReportService = void 0;
const projectSetupTask_model_1 = __importDefault(require("../../models/projectSetupTask.model"));
const project_model_1 = __importDefault(require("../../models/project.model"));
const projectSite_model_1 = __importDefault(require("../../models/projectSite.model"));
class ProjectSetupReportService {
    /**
     * Generate a comprehensive project setup report
     */
    static generateReport(projectId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Fetch all required data
                const [project, projectSetup, projectSites, organization] = yield Promise.all([
                    project_model_1.default.findById(projectId).populate('organization creator'),
                    projectSetupTask_model_1.default.findOne({ project: projectId }).populate('lastUpdatedBy', 'name'),
                    projectSite_model_1.default.find({ project: projectId, archived: { $ne: true } }),
                    null // Will be populated from project.organization
                ]);
                if (!project) {
                    throw new Error('Project not found');
                }
                if (!projectSetup) {
                    throw new Error('Project setup not found');
                }
                // Extract task values helper function
                const getTaskValue = (fieldName) => {
                    const task = projectSetup.tasks.find(t => t.fieldName === fieldName);
                    return (task === null || task === void 0 ? void 0 : task.responseData) || null;
                };
                // Extract task completion info
                const getTaskInfo = (fieldName) => {
                    const task = projectSetup.tasks.find(t => t.fieldName === fieldName);
                    return {
                        isCompleted: (task === null || task === void 0 ? void 0 : task.isCompleted) || false,
                        completedAt: task === null || task === void 0 ? void 0 : task.completedAt,
                        completedBy: task === null || task === void 0 ? void 0 : task.completedBy,
                        responseData: task === null || task === void 0 ? void 0 : task.responseData
                    };
                };
                // Process project sites data
                const processedSites = projectSites.map(site => ({
                    id: site._id.toString(),
                    name: site.name,
                    status: site.status,
                    region: site.region || undefined,
                    city: site.city || undefined,
                    country: site.country || undefined
                }));
                // Process all task details
                const processedTasks = projectSetup.tasks.map(task => ({
                    fieldName: task.fieldName,
                    fieldLabel: task.fieldLabel,
                    dataType: task.dataType,
                    isRequired: task.isRequired,
                    isCompleted: task.isCompleted,
                    completedAt: task.completedAt,
                    completedBy: task.completedBy ? {
                        id: task.completedBy.toString(),
                        name: 'User' // Will need to populate this if needed
                    } : undefined,
                    responseData: task.responseData,
                    step: task.step,
                    sortOrder: task.sortOrder
                }));
                // Calculate progress metrics
                const totalTasks = projectSetup.tasks.length;
                const completedTasks = projectSetup.tasks.filter(t => t.isCompleted).length;
                const requiredTasks = projectSetup.tasks.filter(t => t.isRequired).length;
                const completedRequiredTasks = projectSetup.tasks.filter(t => t.isRequired && t.isCompleted).length;
                const overallProgress = requiredTasks > 0
                    ? Math.round((completedRequiredTasks / requiredTasks) * 100)
                    : Math.round((completedTasks / totalTasks) * 100);
                // Build the comprehensive report data
                const reportData = {
                    projectInfo: {
                        id: project._id.toString(),
                        name: project.name,
                        description: project.description,
                        status: project.status,
                        createdAt: project.createdAt,
                        updatedAt: project.updatedAt
                    },
                    organizationInfo: {
                        id: project.organization._id.toString(),
                        name: project.organization.name
                    },
                    setupProgress: {
                        totalTasks,
                        completedTasks,
                        requiredTasks,
                        completedRequiredTasks,
                        overallProgress,
                        isComplete: projectSetup.isComplete,
                        completedAt: projectSetup.completedAt,
                        lastUpdatedBy: projectSetup.lastUpdatedBy ? {
                            id: projectSetup.lastUpdatedBy._id.toString(),
                            name: projectSetup.lastUpdatedBy.name
                        } : undefined
                    },
                    projectMetadata: {
                        certificationStandard: getTaskValue('certification_standard') || [],
                        projectName: project.name
                    },
                    locationContext: {
                        country: getTaskValue('country') || '',
                        adminLevel1: getTaskValue('admin_level_1') || '',
                        adminLevel2: getTaskValue('admin_level_2') || '',
                        adminLevel3: getTaskValue('admin_level_3') || '',
                        villages: getTaskValue('villages') || '',
                        gpsCoordinates: getTaskValue('gps_coordinates') || '',
                        hectareCoverage: getTaskValue('hectare_coverage') || 0,
                        ecologicalZone: getTaskValue('ecological_zone') || []
                    },
                    governance: {
                        approvalGrantedBy: getTaskValue('approval_granted_by') || [],
                        implementingOrganisations: getTaskValue('implementing_organisations') || [],
                        oversightAuthorities: getTaskValue('oversight_authorities') || [],
                        partnershipType: getTaskValue('partnership_type') || [],
                        customaryInstitutionsInvolved: getTaskValue('customary_institutions_involved') || false,
                        customaryInstitutionsDetails: getTaskValue('customary_institutions_details'),
                        governanceNotes: getTaskValue('governance_notes') || ''
                    },
                    landTenure: {
                        landTenureNotes: getTaskValue('land_tenure_notes'),
                        customaryRightsHolder: getTaskValue('customary_rights_holder') || [],
                        formalRightsHolder: getTaskValue('formal_rights_holder') || [],
                        overlappingClaims: getTaskValue('overlapping_claims') || false,
                        landAgreementsUploaded: getTaskValue('land_agreements_uploaded')
                    },
                    riskAssessment: {
                        conflictHistory: getTaskValue('conflict_history') || false,
                        conflictNotes: getTaskValue('conflict_notes'),
                        politicalRisk: getTaskValue('political_risk') || false,
                        accessIssues: getTaskValue('access_issues') || false,
                        accessNotes: getTaskValue('access_notes'),
                        previousProjectFailures: getTaskValue('previous_project_failures') || false,
                        previousFailureNotes: getTaskValue('previous_failure_notes')
                    },
                    projectSites: processedSites,
                    taskDetails: processedTasks,
                    generationMetadata: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        dataVersion: '1.0',
                        totalRecords: totalTasks
                    }
                };
                return reportData;
            }
            catch (error) {
                console.error('Error generating project setup report:', error);
                throw new Error(`Failed to generate project setup report: ${error}`);
            }
        });
    }
    /**
     * Generate summary statistics for the report
     */
    static generateSummaryStats(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectSetup = yield projectSetupTask_model_1.default.findOne({ project: projectId });
                if (!projectSetup) {
                    throw new Error('Project setup not found');
                }
                const totalTasks = projectSetup.tasks.length;
                const completedTasks = projectSetup.tasks.filter(t => t.isCompleted).length;
                const requiredTasks = projectSetup.tasks.filter(t => t.isRequired).length;
                const completedRequiredTasks = projectSetup.tasks.filter(t => t.isRequired && t.isCompleted).length;
                // Group tasks by step
                const tasksByStep = projectSetup.tasks.reduce((acc, task) => {
                    const step = task.step || 1;
                    if (!acc[step]) {
                        acc[step] = { total: 0, completed: 0 };
                    }
                    acc[step].total++;
                    if (task.isCompleted) {
                        acc[step].completed++;
                    }
                    return acc;
                }, {});
                // Calculate completion percentage
                const completionPercentage = requiredTasks > 0
                    ? Math.round((completedRequiredTasks / requiredTasks) * 100)
                    : Math.round((completedTasks / totalTasks) * 100);
                return {
                    totalTasks,
                    completedTasks,
                    requiredTasks,
                    completedRequiredTasks,
                    completionPercentage,
                    isComplete: projectSetup.isComplete,
                    tasksByStep,
                    lastUpdated: projectSetup.updatedAt
                };
            }
            catch (error) {
                console.error('Error generating summary stats:', error);
                throw new Error(`Failed to generate summary stats: ${error}`);
            }
        });
    }
    /**
     * Get specific task completion status
     */
    static getTaskCompletionStatus(projectId, fieldNames) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectSetup = yield projectSetupTask_model_1.default.findOne({ project: projectId });
                if (!projectSetup) {
                    throw new Error('Project setup not found');
                }
                const taskStatus = fieldNames.map(fieldName => {
                    const task = projectSetup.tasks.find(t => t.fieldName === fieldName);
                    return {
                        fieldName,
                        isCompleted: (task === null || task === void 0 ? void 0 : task.isCompleted) || false,
                        completedAt: task === null || task === void 0 ? void 0 : task.completedAt,
                        responseData: task === null || task === void 0 ? void 0 : task.responseData,
                        isRequired: (task === null || task === void 0 ? void 0 : task.isRequired) || false
                    };
                });
                return taskStatus;
            }
            catch (error) {
                console.error('Error getting task completion status:', error);
                throw new Error(`Failed to get task completion status: ${error}`);
            }
        });
    }
    /**
     * Format task values for display (helper method)
     */
    static formatTaskValue(value) {
        if (value === null || value === undefined) {
            return 'Not provided';
        }
        if (Array.isArray(value)) {
            return value.length > 0 ? value.join(', ') : 'None selected';
        }
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (typeof value === 'number') {
            return value.toLocaleString();
        }
        return String(value);
    }
    /**
     * Get missing required tasks
     */
    static getMissingRequiredTasks(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectSetup = yield projectSetupTask_model_1.default.findOne({ project: projectId });
                if (!projectSetup) {
                    throw new Error('Project setup not found');
                }
                const missingTasks = projectSetup.tasks.filter(task => task.isRequired && !task.isCompleted);
                return missingTasks.map(task => ({
                    fieldName: task.fieldName,
                    fieldLabel: task.fieldLabel,
                    step: task.step,
                    sortOrder: task.sortOrder
                }));
            }
            catch (error) {
                console.error('Error getting missing required tasks:', error);
                throw new Error(`Failed to get missing required tasks: ${error}`);
            }
        });
    }
}
exports.ProjectSetupReportService = ProjectSetupReportService;
exports.default = ProjectSetupReportService;
//# sourceMappingURL=projectSetupReport.service.js.map