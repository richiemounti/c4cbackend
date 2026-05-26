// services/reports/projectSiteSetupReport.service.ts
import mongoose from "mongoose";
import ProjectSiteSetup from "../../models/projectSiteSetupTask.model";
import ProjectSite from "../../models/projectSite.model";
import Project from "../../models/project.model";
import Organization from "../../models/organization.model";
import User from "../../models/user.model";

// Interface for the processed site report data
interface IProjectSiteSetupReportData {
  siteInfo: {
    id: string;
    name: string;
    description?: string;
    status: string;
    region?: string;
    city?: string;
    country?: string;
    coordinates?: any;
    size?: number;
    sizeUnit?: string;
    siteType?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  
  projectInfo: {
    id: string;
    name: string;
    status: string;
  };
  
  organizationInfo: {
    id: string;
    name: string;
  };
  
  setupProgress: {
    totalTasks: number;
    completedTasks: number;
    requiredTasks: number;
    completedRequiredTasks: number;
    overallProgress: number;
    isComplete: boolean;
    completedAt?: Date;
    lastUpdatedBy?: {
      id: string;
      name: string;
    };
  };
  
  siteMetadata: {
    siteName: string;
    projectName: string;
    siteLocationDescription: string;
  };
  
  location: {
    adminLevel1: string; // Region
    adminLevel2: string; // District
    adminLevel3: string; // Ward/Location
    gpsCoordinates: string;
    siteHectareCoverage: number;
    siteEcologicalZone: string[];
  };
  
  demographics: {
    estimatedPopulation: number;
    genderDistribution: any;
    ageDistribution: any;
    ethnicGroupsPresent: string[];
    vulnerableGroupsPresent: boolean;
    vulnerabilityIndicators: string[];
  };
  
  education: {
    educationSummary: string;
  };
  
  livelihoods: {
    primaryIncomeSources: string[];
    secondaryIncomeSources: string[];
    cultivatedLandSize: any;
    cropsGrown: string[];
    livestockProfile: any[];
  };
  
  wildlifeConflict: {
    wildlifeConflictPresent: boolean;
    wildlifeConflictSummary: any[];
  };
  
  taskDetails: Array<{
    fieldName: string;
    fieldLabel: string;
    dataType: string;
    isRequired: boolean;
    isCompleted: boolean;
    completedAt?: Date;
    completedBy?: {
      id: string;
      name: string;
    };
    responseData: any;
    step: number;
    sortOrder: number;
  }>;
  
  generationMetadata: {
    generatedAt: Date;
    generatedBy: string;
    dataVersion: string;
    totalRecords: number;
  };
}

export class ProjectSiteSetupReportService {
  /**
   * Generate a comprehensive project site setup report
   */
  static async generateReport(
    projectSiteId: string, 
    userId: string
  ): Promise<IProjectSiteSetupReportData> {
    try {
      // Fetch all required data
      const [projectSite, projectSiteSetup] = await Promise.all([
        ProjectSite.findById(projectSiteId).populate({
          path: 'project',
          populate: {
            path: 'organization',
            select: 'name'
          }
        }),
        ProjectSiteSetup.findOne({ projectSite: projectSiteId }).populate('lastUpdatedBy', 'name')
      ]);

      if (!projectSite) {
        throw new Error('Project site not found');
      }

      if (!projectSiteSetup) {
        throw new Error('Project site setup not found');
      }

      // Extract task values helper function
      const getTaskValue = (fieldName: string): any => {
        const task = projectSiteSetup.tasks.find(t => t.fieldName === fieldName);
        return task?.responseData || null;
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
      const processLivestockProfile = (data: any): any[] => {
        if (!data || !Array.isArray(data)) return [];
        return data.map(item => ({
          type: item.type || 'Unknown',
          quantity: item.quantity || 'Unknown'
        }));
      };

      // Process wildlife conflict summary
      const processWildlifeConflictSummary = (data: any): any[] => {
        if (!data || !Array.isArray(data)) return [];
        return data.map(item => ({
          species: item.species || 'Unknown',
          frequency: item.frequency || 'Unknown'
        }));
      };

      // Build the comprehensive report data
      const reportData: IProjectSiteSetupReportData = {
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
          id: (projectSite.project as any)._id.toString(),
          name: (projectSite.project as any).name,
          status: (projectSite.project as any).status
        },

        organizationInfo: {
          id: (projectSite.project as any).organization._id.toString(),
          name: (projectSite.project as any).organization.name
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
            id: (projectSiteSetup.lastUpdatedBy as any)._id.toString(),
            name: (projectSiteSetup.lastUpdatedBy as any).name
          } : undefined
        },

        siteMetadata: {
          siteName: getTaskValue('site_name') || projectSite.name,
          projectName: (projectSite.project as any).name,
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

    } catch (error) {
      console.error('Error generating project site setup report:', error);
      throw new Error(`Failed to generate project site setup report: ${error}`);
    }
  }

  /**
   * Generate summary statistics for the site report
   */
  static async generateSummaryStats(projectSiteId: string) {
    try {
      const projectSiteSetup = await ProjectSiteSetup.findOne({ projectSite: projectSiteId });
      
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
      }, {} as Record<number, { total: number; completed: number }>);

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

    } catch (error) {
      console.error('Error generating site summary stats:', error);
      throw new Error(`Failed to generate site summary stats: ${error}`);
    }
  }

  /**
   * Get specific task completion status for site
   */
  static async getTaskCompletionStatus(projectSiteId: string, fieldNames: string[]) {
    try {
      const projectSiteSetup = await ProjectSiteSetup.findOne({ projectSite: projectSiteId });
      
      if (!projectSiteSetup) {
        throw new Error('Project site setup not found');
      }

      const taskStatus = fieldNames.map(fieldName => {
        const task = projectSiteSetup.tasks.find(t => t.fieldName === fieldName);
        return {
          fieldName,
          isCompleted: task?.isCompleted || false,
          completedAt: task?.completedAt,
          responseData: task?.responseData,
          isRequired: task?.isRequired || false
        };
      });

      return taskStatus;

    } catch (error) {
      console.error('Error getting site task completion status:', error);
      throw new Error(`Failed to get site task completion status: ${error}`);
    }
  }

  /**
   * Format task values for display (helper method)
   */
  static formatTaskValue(value: any): string {
    if (value === null || value === undefined) {
      return 'Not provided';
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return 'None selected';
      
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
  static formatCoordinates(coords: any): string {
    if (!coords) return 'Not provided';
    
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
  static formatGenderDistribution(distribution: any): string {
    if (!distribution) return 'Not provided';
    
    if (typeof distribution === 'string') {
      return distribution;
    }
    
    if (typeof distribution === 'object') {
      const parts = [];
      if (distribution.male) parts.push(`Male: ${distribution.male}%`);
      if (distribution.female) parts.push(`Female: ${distribution.female}%`);
      if (distribution.other) parts.push(`Other: ${distribution.other}%`);
      return parts.length > 0 ? parts.join(', ') : 'Not specified';
    }
    
    return String(distribution);
  }

  /**
   * Format age distribution for display
   */
  static formatAgeDistribution(distribution: any): string {
    if (!distribution) return 'Not provided';
    
    if (typeof distribution === 'string') {
      return distribution;
    }
    
    if (typeof distribution === 'object') {
      const parts = [];
      if (distribution.youth) parts.push(`Youth: ${distribution.youth}%`);
      if (distribution.adults) parts.push(`Adults: ${distribution.adults}%`);
      if (distribution.elderly) parts.push(`Elderly: ${distribution.elderly}%`);
      return parts.length > 0 ? parts.join(', ') : 'Not specified';
    }
    
    return String(distribution);
  }

  /**
   * Get missing required tasks for site
   */
  static async getMissingRequiredTasks(projectSiteId: string) {
    try {
      const projectSiteSetup = await ProjectSiteSetup.findOne({ projectSite: projectSiteId });
      
      if (!projectSiteSetup) {
        throw new Error('Project site setup not found');
      }

      const missingTasks = projectSiteSetup.tasks.filter(task => 
        task.isRequired && !task.isCompleted
      );

      return missingTasks.map(task => ({
        fieldName: task.fieldName,
        fieldLabel: task.fieldLabel,
        step: task.step,
        sortOrder: task.sortOrder
      }));

    } catch (error) {
      console.error('Error getting missing required tasks:', error);
      throw new Error(`Failed to get missing required tasks: ${error}`);
    }
  }

  /**
   * Compare site data with project data (for consistency checking)
   */
  static async compareSiteWithProject(projectSiteId: string) {
    try {
      const [projectSite, projectSiteSetup] = await Promise.all([
        ProjectSite.findById(projectSiteId).populate('project'),
        ProjectSiteSetup.findOne({ projectSite: projectSiteId })
      ]);

      if (!projectSite || !projectSiteSetup) {
        throw new Error('Project site or setup not found');
      }

      // Get project setup for comparison
      const ProjectSetup = await import('../../models/projectSetupTask.model').then(m => m.default);
      const projectSetup = await ProjectSetup.findOne({ project: projectSite.project });

      if (!projectSetup) {
        return { hasProjectSetup: false };
      }

      // Compare ecological zones
      const projectEcologyTask = projectSetup.tasks.find(t => t.fieldName === 'ecological_zone');
      const siteEcologyTask = projectSiteSetup.tasks.find(t => t.fieldName === 'site_ecological_zone');
      
      const projectEcology = projectEcologyTask?.responseData || [];
      const siteEcology = siteEcologyTask?.responseData || [];
      
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

    } catch (error) {
      console.error('Error comparing site with project:', error);
      throw new Error(`Failed to compare site with project: ${error}`);
    }
  }
}

export default ProjectSiteSetupReportService;