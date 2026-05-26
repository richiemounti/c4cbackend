// services/reports/projectSetupReport.service.ts
import mongoose from "mongoose";
import ProjectSetup from "../../models/projectSetupTask.model";
import Project from "../../models/project.model";
import ProjectSite from "../../models/projectSite.model";
import Organization from "../../models/organization.model";
import User from "../../models/user.model";

// Interface for the processed report data
interface IProjectSetupReportData {
  projectInfo: {
    id: string;
    name: string;
    description?: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
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
  
  projectMetadata: {
    certificationStandard: string[];
    projectName: string;
  };
  
  locationContext: {
    country: string;
    adminLevel1: string; // Region/State
    adminLevel2: string; // District
    adminLevel3: string; // Ward/Location
    villages: string;
    gpsCoordinates: string;
    hectareCoverage: number;
    ecologicalZone: string[];
  };
  
  governance: {
    approvalGrantedBy: string[];
    implementingOrganisations: string[];
    oversightAuthorities: string[];
    partnershipType: string[];
    customaryInstitutionsInvolved: boolean;
    customaryInstitutionsDetails?: string;
    governanceNotes: string;
  };
  
  landTenure: {
    landTenureNotes?: string;
    customaryRightsHolder: string[];
    formalRightsHolder: string[];
    overlappingClaims: boolean;
    landAgreementsUploaded: any;
  };
  
  riskAssessment: {
    conflictHistory: boolean;
    conflictNotes?: string;
    politicalRisk: boolean;
    accessIssues: boolean;
    accessNotes?: string;
    previousProjectFailures: boolean;
    previousFailureNotes?: string;
  };
  
  projectSites: Array<{
    id: string;
    name: string;
    status: string;
    region?: string;
    city?: string;
    country?: string;
  }>;
  
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

export class ProjectSetupReportService {
  /**
   * Generate a comprehensive project setup report
   */
  static async generateReport(
    projectId: string, 
    userId: string
  ): Promise<IProjectSetupReportData> {
    try {
      // Fetch all required data
      const [project, projectSetup, projectSites, organization] = await Promise.all([
        Project.findById(projectId).populate('organization creator'),
        ProjectSetup.findOne({ project: projectId }).populate('lastUpdatedBy', 'name'),
        ProjectSite.find({ project: projectId, archived: { $ne: true } }),
        null // Will be populated from project.organization
      ]);

      if (!project) {
        throw new Error('Project not found');
      }

      if (!projectSetup) {
        throw new Error('Project setup not found');
      }

      // Extract task values helper function
      const getTaskValue = (fieldName: string): any => {
        const task = projectSetup.tasks.find(t => t.fieldName === fieldName);
        return task?.responseData || null;
      };

      // Extract task completion info
      const getTaskInfo = (fieldName: string) => {
        const task = projectSetup.tasks.find(t => t.fieldName === fieldName);
        return {
          isCompleted: task?.isCompleted || false,
          completedAt: task?.completedAt,
          completedBy: task?.completedBy,
          responseData: task?.responseData
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
      const reportData: IProjectSetupReportData = {
        projectInfo: {
          id: project._id.toString(),
          name: project.name,
          description: project.description,
          status: project.status,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },

        organizationInfo: {
          id: (project.organization as any)._id.toString(),
          name: (project.organization as any).name
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
            id: (projectSetup.lastUpdatedBy as any)._id.toString(),
            name: (projectSetup.lastUpdatedBy as any).name
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

    } catch (error) {
      console.error('Error generating project setup report:', error);
      throw new Error(`Failed to generate project setup report: ${error}`);
    }
  }

  /**
   * Generate summary statistics for the report
   */
  static async generateSummaryStats(projectId: string) {
    try {
      const projectSetup = await ProjectSetup.findOne({ project: projectId });
      
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
        isComplete: projectSetup.isComplete,
        tasksByStep,
        lastUpdated: projectSetup.updatedAt
      };

    } catch (error) {
      console.error('Error generating summary stats:', error);
      throw new Error(`Failed to generate summary stats: ${error}`);
    }
  }

  /**
   * Get specific task completion status
   */
  static async getTaskCompletionStatus(projectId: string, fieldNames: string[]) {
    try {
      const projectSetup = await ProjectSetup.findOne({ project: projectId });
      
      if (!projectSetup) {
        throw new Error('Project setup not found');
      }

      const taskStatus = fieldNames.map(fieldName => {
        const task = projectSetup.tasks.find(t => t.fieldName === fieldName);
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
      console.error('Error getting task completion status:', error);
      throw new Error(`Failed to get task completion status: ${error}`);
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
  static async getMissingRequiredTasks(projectId: string) {
    try {
      const projectSetup = await ProjectSetup.findOne({ project: projectId });
      
      if (!projectSetup) {
        throw new Error('Project setup not found');
      }

      const missingTasks = projectSetup.tasks.filter(task => 
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
}

export default ProjectSetupReportService;