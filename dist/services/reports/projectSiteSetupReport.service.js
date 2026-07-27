"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.ProjectSiteSetupReportService = void 0;
const projectSiteSetupTask_model_1 = __importDefault(require("../../models/projectSiteSetupTask.model"));
const projectSite_model_1 = __importDefault(require("../../models/projectSite.model"));
class ProjectSiteSetupReportService {
    /**
     * Generate a comprehensive project site setup report
     */
    static generateReport(projectSiteId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Fetch all required data
                const [projectSite, projectSiteSetup] = yield Promise.all([
                    projectSite_model_1.default.findById(projectSiteId).populate({
                        path: 'project',
                        populate: {
                            path: 'organization',
                            select: 'name'
                        }
                    }),
                    projectSiteSetupTask_model_1.default.findOne({ projectSite: projectSiteId }).populate('lastUpdatedBy', 'name')
                ]);
                if (!projectSite) {
                    throw new Error('Project site not found');
                }
                if (!projectSiteSetup) {
                    throw new Error('Project site setup not found');
                }
                // Extract task values helper function
                const getTaskValue = (fieldName) => {
                    const task = projectSiteSetup.tasks.find(t => t.fieldName === fieldName);
                    return (task === null || task === void 0 ? void 0 : task.responseData) || null;
                };
                // Process all task details
                const processedTasks = projectSiteSetup.tasks.map(task => ({
                    fieldName: task.fieldName,
                    fieldLabel: task.fieldLabel || '',
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
                const totalTasks = projectSiteSetup.tasks.length;
                const completedTasks = projectSiteSetup.tasks.filter(t => t.isCompleted).length;
                const requiredTasks = projectSiteSetup.tasks.filter(t => t.isRequired).length;
                const completedRequiredTasks = projectSiteSetup.tasks.filter(t => t.isRequired && t.isCompleted).length;
                const overallProgress = requiredTasks > 0
                    ? Math.round((completedRequiredTasks / requiredTasks) * 100)
                    : Math.round((completedTasks / totalTasks) * 100);
                // Process livestock profile data
                const processLivestockProfile = (data) => {
                    if (!data || !Array.isArray(data))
                        return [];
                    return data.map(item => ({
                        type: item.type || 'Unknown',
                        quantity: item.quantity || 'Unknown'
                    }));
                };
                // Process wildlife conflict summary
                const processWildlifeConflictSummary = (data) => {
                    if (!data || !Array.isArray(data))
                        return [];
                    return data.map(item => ({
                        species: item.species || 'Unknown',
                        frequency: item.frequency || 'Unknown'
                    }));
                };
                // Build the comprehensive report data
                const reportData = {
                    siteInfo: {
                        id: projectSite._id.toString(),
                        name: projectSite.name,
                        description: projectSite.description || undefined,
                        status: projectSite.status,
                        region: projectSite.region || undefined,
                        city: projectSite.city || undefined,
                        country: projectSite.country || undefined,
                        coordinates: projectSite.coordinates,
                        size: projectSite.size,
                        sizeUnit: projectSite.sizeUnit,
                        siteType: projectSite.siteType,
                        createdAt: projectSite.createdAt,
                        updatedAt: projectSite.updatedAt
                    },
                    projectInfo: {
                        id: projectSite.project._id.toString(),
                        name: projectSite.project.name,
                        status: projectSite.project.status
                    },
                    organizationInfo: {
                        id: projectSite.project.organization._id.toString(),
                        name: projectSite.project.organization.name
                    },
                    setupProgress: {
                        totalTasks,
                        completedTasks,
                        requiredTasks,
                        completedRequiredTasks,
                        overallProgress,
                        isComplete: projectSiteSetup.isComplete,
                        completedAt: projectSiteSetup.completedAt,
                        lastUpdatedBy: projectSiteSetup.lastUpdatedBy ? {
                            id: projectSiteSetup.lastUpdatedBy._id.toString(),
                            name: projectSiteSetup.lastUpdatedBy.name
                        } : undefined
                    },
                    siteMetadata: {
                        siteName: getTaskValue('site_name') || projectSite.name,
                        projectName: projectSite.project.name,
                        siteLocationDescription: getTaskValue('site_location_description') || ''
                    },
                    location: {
                        adminLevel1: getTaskValue('admin_level_1') || '',
                        adminLevel2: getTaskValue('admin_level_2') || '',
                        adminLevel3: getTaskValue('admin_level_3') || '',
                        gpsCoordinates: getTaskValue('gps_coordinates') || '',
                        siteHectareCoverage: getTaskValue('site_hectare_coverage') || 0,
                        siteEcologicalZone: getTaskValue('site_ecological_zone') || []
                    },
                    demographics: {
                        estimatedPopulation: getTaskValue('estimated_population') || 0,
                        genderDistribution: getTaskValue('gender_distribution') || null,
                        ageDistribution: getTaskValue('age_distribution') || null,
                        ethnicGroupsPresent: getTaskValue('ethnic_groups_present') || [],
                        vulnerableGroupsPresent: getTaskValue('vulnerable_groups_present') || false,
                        vulnerabilityIndicators: getTaskValue('vulnerability_indicators') || []
                    },
                    education: {
                        educationSummary: getTaskValue('education_summary') || ''
                    },
                    livelihoods: {
                        primaryIncomeSources: getTaskValue('primary_income_sources') || [],
                        secondaryIncomeSources: getTaskValue('secondary_income_sources') || [],
                        cultivatedLandSize: getTaskValue('cultivated_land_size') || null,
                        cropsGrown: getTaskValue('crops_grown') || [],
                        livestockProfile: processLivestockProfile(getTaskValue('livestock_profile'))
                    },
                    wildlifeConflict: {
                        wildlifeConflictPresent: getTaskValue('wildlife_conflict_present') || false,
                        wildlifeConflictSummary: processWildlifeConflictSummary(getTaskValue('wildlife_conflict_summary'))
                    },
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
                console.error('Error generating project site setup report:', error);
                throw new Error(`Failed to generate project site setup report: ${error}`);
            }
        });
    }
    /**
     * Generate summary statistics for the site report
     */
    static generateSummaryStats(projectSiteId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectSiteSetup = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: projectSiteId });
                if (!projectSiteSetup) {
                    throw new Error('Project site setup not found');
                }
                const totalTasks = projectSiteSetup.tasks.length;
                const completedTasks = projectSiteSetup.tasks.filter(t => t.isCompleted).length;
                const requiredTasks = projectSiteSetup.tasks.filter(t => t.isRequired).length;
                const completedRequiredTasks = projectSiteSetup.tasks.filter(t => t.isRequired && t.isCompleted).length;
                // Group tasks by step
                const tasksByStep = projectSiteSetup.tasks.reduce((acc, task) => {
                    const step = task.step || 2; // Default to step 2 for site tasks
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
                    isComplete: projectSiteSetup.isComplete,
                    tasksByStep,
                    lastUpdated: projectSiteSetup.updatedAt
                };
            }
            catch (error) {
                console.error('Error generating site summary stats:', error);
                throw new Error(`Failed to generate site summary stats: ${error}`);
            }
        });
    }
    /**
     * Get specific task completion status for site
     */
    static getTaskCompletionStatus(projectSiteId, fieldNames) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectSiteSetup = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: projectSiteId });
                if (!projectSiteSetup) {
                    throw new Error('Project site setup not found');
                }
                const taskStatus = fieldNames.map(fieldName => {
                    const task = projectSiteSetup.tasks.find(t => t.fieldName === fieldName);
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
                console.error('Error getting site task completion status:', error);
                throw new Error(`Failed to get site task completion status: ${error}`);
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
            if (value.length === 0)
                return 'None selected';
            // Handle livestock profile formatting
            if (value.length > 0 && typeof value[0] === 'object' && value[0].type) {
                return value.map(item => `${item.type}: ${item.quantity}`).join(', ');
            }
            // Handle wildlife conflict summary formatting
            if (value.length > 0 && typeof value[0] === 'object' && value[0].species) {
                return value.map(item => `${item.species}: ${item.frequency}`).join(', ');
            }
            return value.join(', ');
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
     * Format coordinates for display
     */
    static formatCoordinates(coords) {
        if (!coords)
            return 'Not provided';
        if (typeof coords === 'string') {
            return coords;
        }
        if (typeof coords === 'object' && coords.latitude && coords.longitude) {
            return `${coords.latitude}, ${coords.longitude}`;
        }
        return String(coords);
    }
    /**
     * Format gender distribution for display
     */
    static formatGenderDistribution(distribution) {
        if (!distribution)
            return 'Not provided';
        if (typeof distribution === 'string') {
            return distribution;
        }
        if (typeof distribution === 'object') {
            const parts = [];
            if (distribution.male)
                parts.push(`Male: ${distribution.male}%`);
            if (distribution.female)
                parts.push(`Female: ${distribution.female}%`);
            if (distribution.other)
                parts.push(`Other: ${distribution.other}%`);
            return parts.length > 0 ? parts.join(', ') : 'Not specified';
        }
        return String(distribution);
    }
    /**
     * Format age distribution for display
     */
    static formatAgeDistribution(distribution) {
        if (!distribution)
            return 'Not provided';
        if (typeof distribution === 'string') {
            return distribution;
        }
        if (typeof distribution === 'object') {
            const parts = [];
            if (distribution.youth)
                parts.push(`Youth: ${distribution.youth}%`);
            if (distribution.adults)
                parts.push(`Adults: ${distribution.adults}%`);
            if (distribution.elderly)
                parts.push(`Elderly: ${distribution.elderly}%`);
            return parts.length > 0 ? parts.join(', ') : 'Not specified';
        }
        return String(distribution);
    }
    /**
     * Get missing required tasks for site
     */
    static getMissingRequiredTasks(projectSiteId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectSiteSetup = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: projectSiteId });
                if (!projectSiteSetup) {
                    throw new Error('Project site setup not found');
                }
                const missingTasks = projectSiteSetup.tasks.filter(task => task.isRequired && !task.isCompleted);
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
    /**
     * Compare site data with project data (for consistency checking)
     */
    static compareSiteWithProject(projectSiteId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [projectSite, projectSiteSetup] = yield Promise.all([
                    projectSite_model_1.default.findById(projectSiteId).populate('project'),
                    projectSiteSetupTask_model_1.default.findOne({ projectSite: projectSiteId })
                ]);
                if (!projectSite || !projectSiteSetup) {
                    throw new Error('Project site or setup not found');
                }
                // Get project setup for comparison
                const ProjectSetup = yield Promise.resolve().then(() => __importStar(require('../../models/projectSetupTask.model'))).then(m => m.default);
                const projectSetup = yield ProjectSetup.findOne({ project: projectSite.project });
                if (!projectSetup) {
                    return { hasProjectSetup: false };
                }
                // Compare ecological zones
                const projectEcologyTask = projectSetup.tasks.find(t => t.fieldName === 'ecological_zone');
                const siteEcologyTask = projectSiteSetup.tasks.find(t => t.fieldName === 'site_ecological_zone');
                const projectEcology = (projectEcologyTask === null || projectEcologyTask === void 0 ? void 0 : projectEcologyTask.responseData) || [];
                const siteEcology = (siteEcologyTask === null || siteEcologyTask === void 0 ? void 0 : siteEcologyTask.responseData) || [];
                const ecologyMatch = Array.isArray(projectEcology) && Array.isArray(siteEcology)
                    ? siteEcology.every(zone => projectEcology.includes(zone))
                    : false;
                return {
                    hasProjectSetup: true,
                    comparison: {
                        ecologyMatch,
                        projectEcology,
                        siteEcology
                    }
                };
            }
            catch (error) {
                console.error('Error comparing site with project:', error);
                throw new Error(`Failed to compare site with project: ${error}`);
            }
        });
    }
}
exports.ProjectSiteSetupReportService = ProjectSiteSetupReportService;
exports.default = ProjectSiteSetupReportService;
//# sourceMappingURL=projectSiteSetupReport.service.js.map