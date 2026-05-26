// services/reports/theoryOfChangeReport.service.ts - UPDATED VERSION
import mongoose from "mongoose";
import TheoryOfChangeStage from "../../models/theoryOfChangeStage.model";
import StakeholderAction from "../../models/stakeholderAction.model";
import SocialImpact from "../../models/socialImpact.model";
import StakeholderGroup from "../../models/stakeholderGroup.model";
import Project from "../../models/project.model";
import ProjectSite from "../../models/projectSite.model";
import Theme from "../../models/theme.model";
import SubTheme from "../../models/subtheme.model";
import TOCConsultationPlan from "../../models/tocConsultationPlan.model";

// ============================================================================
// INTERFACES
// ============================================================================

interface IToCReportFilters {
  scope?: 'all' | 'project' | 'site';
  siteIds?: string[];
  stageNumbers?: number[];
  stakeholderIds?: string[];
  themeIds?: string[];
  frameworkFilter?: 'themes' | 'sdgs' | 'resilience' | 'indicators' | 'esg' | 'standards';
  includeArchived?: boolean;
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
  };
  // ✅ NEW: Add reportDimension to distinguish between different report types
  reportDimension?: 'stage1' | 'workplan' | 'outcome' | 'full';
}

interface IGanttTimelineItem {
  id: string;
  name: string;
  type: 'action' | 'impact';
  stakeholder: {
    _id: string;
    name: string;
  };
  themes: Array<{
    _id: string;
    name: string;
  }>;
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  progress: number;
  dependencies?: string[];
  responsibility?: {
    name: string;
    role: string;
    email?: string;
  };
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority?: string;
  milestones?: Array<{
    date: Date;
    description: string;
  }>;
  isEstimated?: boolean; // Flag for estimated dates
  estimationMethod?: string; // How dates were estimated
}

interface IStakeholderWorkload {
  stakeholder: any;
  activities: IGanttTimelineItem[];
  totalDuration: number;
  activityCount: number;
  completionRate: number;
  averageProgress: number;
  upcomingDeadlines: number;
  workloadScore: number; // Calculated workload intensity
}

interface ISiteBreakdown {
  siteId: string;
  siteName: string;
  actionCount: number;
  impactCount: number;
  actions?: any[];
  impacts?: any[];
  ganttTimeline?: IGanttTimelineItem[];
  completionRate?: number;
}

interface IFrameworkGroup {
  framework: {
    _id: string;
    name: string;
    code?: string;
    description?: string;
  };
  impacts: any[];
  metrics: {
    totalImpacts: number;
    achievementRate: number;
    riskCount: number;
  };
}

// ============================================================================
// NEW: STAGE 1 DATA REPORT (Data-focused, no heavy visuals)
// ============================================================================

interface IStage1Report {
  reportType: 'toc_stage1';
  projectInfo: any;
  organizationInfo: any;
  scope: 'project' | 'site' | 'all_sites';
  reportMetadata: any;

  stage1Data: {
    totalActions: number;

    // Full action objects — displayed as a table on the frontend
    actions: any[];

    progressSummary: {
      averageProgress: number;
      completedActions: number;
      inProgressActions: number;
      notStartedActions: number;
    };

    timelineSummary: {
      earliestStartDate?: Date;
      latestEndDate?: Date;
      totalDuration: number;
    };
  };
}


// ============================================================================
// WORKPLAN REPORT (STAGE 1 - ACTIONS/OUTPUTS)
// ============================================================================

interface IWorkplanReport {
  reportType: 'toc_workplan';
  projectInfo: any;
  organizationInfo: any;
  scope: 'project' | 'site' | 'all_sites';
  reportMetadata: any;
  
  outputs: {
    totalActions: number;
    actionsWithDates: number;
    actionsWithEstimatedDates: number;
    actionsWithoutDates: number;
    
    actions: any[];
    ganttTimeline: IGanttTimelineItem[];
    workloadDistribution: IStakeholderWorkload[];
    
    timelineAnalysis: {
      projectStartDate?: Date;
      projectEndDate?: Date;
      totalDuration: number;
      criticalPath: IGanttTimelineItem[];
      upcomingDeadlines: Array<{
        item: IGanttTimelineItem;
        daysUntilDue: number;
      }>;
      statusBreakdown: Record<string, number>;
      averageProgress: number;
    };
  };
  
  // Multi-site specific data
  siteBreakdown?: ISiteBreakdown[];
  aggregatedView?: {
    totalSites: number;
    actionsPerSite: Record<string, number>;
    completionRatePerSite: Record<string, number>;
  };
}

// ============================================================================
// OUTCOME REPORT (STAGE 2 - IMPACTS/OUTCOMES)
// ============================================================================

interface IOutcomeReport {
  reportType: 'toc_outcomes';
  projectInfo: any;
  organizationInfo: any;
  scope: 'project' | 'site' | 'all_sites';
  reportMetadata: any;
  
  outcomes: {
    totalImpacts: number;
    impactsWithRisks: number;
    
    impacts: any[];
    
    // Grouped by stakeholder
    byStakeholder: Array<{
      stakeholder: any;
      impacts: any[];
      totalRisks: number;
      achievementRate: number;
      averageProgress: number;
    }>;
    
    // Framework-based grouping (based on user selection)
    byFramework: {
      themes: IFrameworkGroup[];
      sdgs: IFrameworkGroup[];
      resilience: IFrameworkGroup[];
      indicators: IFrameworkGroup[];
      esg: IFrameworkGroup[];
      standards: IFrameworkGroup[];
    };
    availableFrameworks: string[];
    
    // Risk summary
    riskRegister: {
      totalRisks: number;
      bySeverity: Record<'low'|'medium'|'high', number>;
      topRisks: Array<{
        impact: any;
        risk: any;
        stakeholder: any;
      }>;
      mitigationCoverage: number; // % of risks with mitigation
    };
    
    // Measurement tracking
    measurementSummary: {
      impactsWithMeasurementPlan: number;
      indicatorCount: number;
      measurementMethods: Record<string, number>;
    };
  };
  
  // Multi-site specific data
  siteBreakdown?: ISiteBreakdown[];
  aggregatedView?: {
    totalSites: number;
    impactsPerSite: Record<string, number>;
    riskCountPerSite: Record<string, number>;
  };
}

// ============================================================================
// CONSULTATION PLAN REPORT
// ============================================================================

interface IConsultationPlanReport {
  reportType: 'consultation_plan';
  projectInfo: any;
  siteInfo: any;
  reportMetadata: any;
  
  consultationPlan: {
    planId: string;
    status: string;
    isCompleted: boolean;
    
    selectedStakeholders: Array<{
      stakeholderGroup: any;
      notes?: string;
    }>;
    
    planning: {
      expectedParticipants: string;
      invitationStrategy: string;
      venue: string;
      underrepresentedGroups: string;
      budget: string;
      permissions: string;
    };
    
    timeline: {
      startDate?: Date;
      endDate?: Date;
      description?: string;
      duration?: number;
    };
    
    completionStatus: {
      isCompleted: boolean;
      completionPercentage: number;
      completedSections: string[];
      missingSections: string[];
    };
  };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class TheoryOfChangeReportService {
// Add this to TheoryOfChangeReportService class

  /**
 * Main report generation router method
 * Routes to appropriate ToC report based on stageNumbers and reportDimension filters
 */
static async generateReport(
  projectId: string,
  userId: string,
  filters: IToCReportFilters = { scope: 'all' }
): Promise<IStage1Report | IWorkplanReport | IOutcomeReport> { // ✅ UPDATED: Add IStage1Report to return type
  
  try {
    // ✅ NEW: Check for explicit reportDimension first
    if (filters.reportDimension) {
      switch (filters.reportDimension) {
        case 'stage1':
          return await this.generateStage1Report(projectId, userId, filters);
        case 'workplan':
          return await this.generateWorkplanReport(projectId, userId, filters);
        case 'outcome':
          return await this.generateOutcomeReport(projectId, userId, filters);
        case 'full':
          // Full report generation would need to be implemented separately
          // For now, throw an error or default to workplan
          console.warn('Full report requested via generateReport. Consider using generateFullToCReport instead.');
          throw new Error('Please use generateFullToCReport for full reports');
        default:
          throw new Error(`Unknown report dimension: ${filters.reportDimension}`);
      }
    }
    
    // ✅ UPDATED: Fallback to stageNumbers-based routing if no reportDimension specified
    
    // If no stage numbers specified, default to Stage 1 Data Report
    if (!filters.stageNumbers || filters.stageNumbers.length === 0) {
      console.log('No stage numbers specified, defaulting to Stage 1 Data Report');
      return await this.generateStage1Report(projectId, userId, filters);
    }
    
    // If only Stage 1 is requested - default to Stage 1 Data Report (can be changed to workplan if preferred)
    if (filters.stageNumbers.includes(1) && !filters.stageNumbers.includes(2)) {
      console.log('Stage 1 requested, generating Stage 1 Data Report');
      return await this.generateStage1Report(projectId, userId, filters);
    }
    
    // If only Stage 2 is requested
    if (filters.stageNumbers.includes(2) && !filters.stageNumbers.includes(1)) {
      console.log('Stage 2 requested, generating Outcome Report');
      return await this.generateOutcomeReport(projectId, userId, filters);
    }
    
    // If both stages are requested, throw error directing to use generateFullToCReport
    if (filters.stageNumbers.includes(1) && filters.stageNumbers.includes(2)) {
      console.warn('Both Stage 1 and Stage 2 requested. Use generateFullToCReport instead.');
      throw new Error('For reports combining both stages, please use generateFullToCReport method');
    }
    
    // Fallback - should never reach here
    console.warn('Unexpected filter configuration, defaulting to Stage 1 Data Report');
    return await this.generateStage1Report(projectId, userId, filters);
    
  } catch (error) {
    console.error('Error generating Theory of Change report:', error);
    throw error;
  }
}

  /**
 * Generate Stage 1 Data Report (Data-focused)
 * Focus: Detailed action data, breakdowns, and summaries
 * No heavy visualizations - just the data
 */
static async generateStage1Report(
  projectId: string,
  userId: string,
  filters: IToCReportFilters = { scope: 'all' }
): Promise<IStage1Report> {
  try {
    const project = await Project.findById(projectId).populate('organization');
    if (!project) throw new Error('Project not found');

    filters.stageNumbers = [1];

    const stageQuery = this.buildStageQuery(projectId, filters);
    const stages = await TheoryOfChangeStage.find(stageQuery);
    const { actions } = await this.fetchActionsAndImpacts(stages, filters);

    // Progress summary — simple counts, no breakdown maps
    const completedActions   = actions.filter(a => a.status === 'completed').length;
    const inProgressActions  = actions.filter(a => a.status === 'in_progress').length;
    const notStartedActions  = actions.filter(a => a.status === 'not_started').length;
    const averageProgress    = actions.length > 0
      ? Math.round(actions.reduce((sum, a) => sum + (a.progress || 0), 0) / actions.length)
      : 0;

    // Timeline boundaries
    const datePairs = actions.filter(a => a.timeframe?.startDate && a.timeframe?.endDate);
    const allDates  = datePairs.flatMap(a => [a.timeframe.startDate, a.timeframe.endDate]);
    const earliestStartDate = allDates.length > 0
      ? new Date(Math.min(...allDates.map((d: Date) => d.getTime()))) : undefined;
    const latestEndDate = allDates.length > 0
      ? new Date(Math.max(...allDates.map((d: Date) => d.getTime()))) : undefined;
    const totalDuration = earliestStartDate && latestEndDate
      ? Math.ceil((latestEndDate.getTime() - earliestStartDate.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    const report: IStage1Report = {
      reportType: 'toc_stage1',
      projectInfo: {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        status: project.status
      },
      organizationInfo: {
        id: (project.organization as any)._id.toString(),
        name: (project.organization as any).name
      },
      scope: filters.scope === 'site' ? 'site' :
             (filters.scope === 'all' ? 'all_sites' : 'project'),
      reportMetadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        version: '2.0',
        appliedFilters: filters
      },
      stage1Data: {
        totalActions: actions.length,
        actions,  // full objects — the table renders directly from this
        progressSummary: {
          averageProgress,
          completedActions,
          inProgressActions,
          notStartedActions
        },
        timelineSummary: {
          earliestStartDate,
          latestEndDate,
          totalDuration
        }
      }
    };

    return report;

  } catch (error) {
    console.error('Error generating Stage 1 report:', error);
    throw new Error(`Failed to generate Stage 1 report: ${error}`);
  }
}

  // ==========================================================================
  // WORKPLAN REPORT GENERATION (STAGE 1 ONLY)
  // ==========================================================================
  
  /**
 * Generate Workplan Report (Visual-focused)
 * Focus: Gantt charts, timeline visualization, workload metrics
 * This is the VISUAL representation of Stage 1 data
 */
static async generateWorkplanReport(
  projectId: string,
  userId: string,
  filters: IToCReportFilters = { scope: 'all' }
): Promise<IWorkplanReport> {
  try {
    const project = await Project.findById(projectId).populate('organization');
    if (!project) {
      throw new Error('Project not found');
    }

    // Force Stage 1 only
    filters.stageNumbers = [1];

    const stageQuery = this.buildStageQuery(projectId, filters);
    const stages = await TheoryOfChangeStage.find(stageQuery);
    const { actions } = await this.fetchActionsAndImpacts(stages, filters);

    // ✅ UPDATED: Since dates are now required, no estimation needed
    // But keep validation for data integrity
    this.validateActionDependencies(actions);

    // Generate Gantt timeline (no estimation since dates are required)
    const ganttTimeline = this.generateGanttTimeline(actions);

    // Calculate workload distribution
    const workloadDistribution = this.calculateStakeholderWorkloads(ganttTimeline);

    // Generate timeline analysis with enhanced metrics
    const timelineAnalysis = this.analyzeTimeline(ganttTimeline);

    const report: IWorkplanReport = {
      reportType: 'toc_workplan',
      projectInfo: {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        status: project.status
      },
      organizationInfo: {
        id: (project.organization as any)._id.toString(),
        name: (project.organization as any).name
      },
      scope: filters.scope === 'site' ? 'site' : 
             (filters.scope === 'all' ? 'all_sites' : 'project'),
      reportMetadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        version: '2.0',
        appliedFilters: filters
      },
      outputs: {
        totalActions: actions.length,
        actionsWithDates: actions.length, // All should have dates now
        actionsWithEstimatedDates: 0, // No more estimates
        actionsWithoutDates: 0, // Should be 0
        actions,
        ganttTimeline,
        workloadDistribution,
        timelineAnalysis
      }
      // ✅ REMOVED: siteBreakdown and aggregatedView
    };

    return report;

  } catch (error) {
    console.error('Error generating workplan report:', error);
    throw new Error(`Failed to generate workplan report: ${error}`);
  }
}

// ✅ NEW: Simplified Gantt timeline generation (no date estimation)
private static generateGanttTimeline(actions: any[]): IGanttTimelineItem[] {
  const ganttTimeline: IGanttTimelineItem[] = [];
  
  actions.forEach(action => {
    const startDate = new Date(action.timeframe.startDate);
    const endDate = new Date(action.timeframe.endDate);
    const duration = this.calculateDuration(startDate, endDate);
    
    ganttTimeline.push({
      id: action._id.toString(),
      name: action.action,
      type: 'action',
      stakeholder: {
        _id: action.stakeholderGroup._id.toString(),
        name: action.stakeholderGroup.name
      },
      themes: action.themes.map((theme: any) => ({
        _id: theme._id.toString(),
        name: theme.name
      })),
      startDate,
      endDate,
      duration,
      progress: action.progress || 0,
      status: action.status || 'not_started',
      priority: action.priority,
      responsibility: action.responsibility ? {
        name: action.responsibility.name,
        role: action.responsibility.role || 'Unknown',
        email: action.responsibility.email
      } : undefined,
      dependencies: action.dependencies?.map((dep: any) => dep.toString()) || [],
      milestones: action.milestones || [],
      isEstimated: false, // No more estimates
      estimationMethod: undefined
    });
  });
  
  // Sort by start date
  ganttTimeline.sort((a, b) => {
    const aDate = a.startDate || new Date();
    const bDate = b.startDate || new Date();
    return aDate.getTime() - bDate.getTime();
  });
  
  return ganttTimeline;
}

  // ==========================================================================
  // OUTCOME REPORT GENERATION (STAGE 2 ONLY)
  // ==========================================================================
  
  static async generateOutcomeReport(
    projectId: string,
    userId: string,
    filters: IToCReportFilters = { scope: 'all' }
  ): Promise<IOutcomeReport> {
    try {
      // Fetch project info
      const project = await Project.findById(projectId).populate('organization');
      if (!project) {
        throw new Error('Project not found');
      }

      // Force Stage 2 only
      filters.stageNumbers = [2];

      // Get Stage 2 data
      const stageQuery = this.buildStageQuery(projectId, filters);
      const stages = await TheoryOfChangeStage.find(stageQuery);
      const { impacts } = await this.fetchActionsAndImpacts(stages, filters);

      // Get subthemes for framework analysis
      const subThemes = await SubTheme.find({ archived: { $ne: true } })
        .populate('theme', 'name')
        .populate('indicatorTags', 'name code description')
        .populate('sdgTags', 'name code')
        .populate('resilienceTags', 'name code')
        .populate('esgTags', 'name code')
        .populate('standardTags', 'name code');

      // Group by stakeholder
      const byStakeholder = this.groupImpactsByStakeholder(impacts);

      // Group by selected framework
      // Generate ALL frameworks
      const [themes, sdgs, resilience, indicators, esg, standards] = await Promise.all([
        this.groupByFramework(impacts, subThemes, 'themes'),
        this.groupByFramework(impacts, subThemes, 'sdgs'),
        this.groupByFramework(impacts, subThemes, 'resilience'),
        this.groupByFramework(impacts, subThemes, 'indicators'),
        this.groupByFramework(impacts, subThemes, 'esg'),
        this.groupByFramework(impacts, subThemes, 'standards')
      ]);
      
      const byFramework = {
        themes,
        sdgs,
        resilience,
        indicators,
        esg,
        standards
      };
      // Generate risk register
      const riskRegister = this.generateRiskRegister(impacts);

      // Generate measurement summary
      const measurementSummary = this.generateMeasurementSummary(impacts);

      // Handle multi-site reports
      let siteBreakdown: ISiteBreakdown[] | undefined;
      let aggregatedView: any | undefined;

      if (filters.scope === 'all' || (filters.siteIds && filters.siteIds.length > 1)) {
        const sites = await ProjectSite.find({ 
          project: projectId, 
          archived: { $ne: true } 
        });
        
        siteBreakdown = await this.generateSiteBreakdown(sites, [], impacts, 'outcome');
        aggregatedView = this.generateAggregatedView(siteBreakdown);
      }

      const report: IOutcomeReport = {
        reportType: 'toc_outcomes',
        projectInfo: {
          id: project._id.toString(),
          name: project.name,
          description: project.description,
          status: project.status
        },
        organizationInfo: {
          id: (project.organization as any)._id.toString(),
          name: (project.organization as any).name
        },
        scope: filters.scope === 'site' ? 'site' : 
               (filters.scope === 'all' ? 'all_sites' : 'project'),
        reportMetadata: {
          generatedAt: new Date(),
          generatedBy: userId,
          version: '2.0',
          appliedFilters: filters
        },
        outcomes: {
          totalImpacts: impacts.length,
          impactsWithRisks: impacts.filter(impact => impact.risks.length > 0).length,
          impacts,
          byStakeholder,
          byFramework,
          availableFrameworks: ['themes', 'sdgs', 'resilience', 'indicators', 'esg', 'standards'], // ✅ ADD THIS
          riskRegister,
          measurementSummary
        },
        siteBreakdown,
        aggregatedView
      };

      return report;

    } catch (error) {
      console.error('Error generating outcome report:', error);
      throw new Error(`Failed to generate outcome report: ${error}`);
    }
  }

  // ==========================================================================
  // CONSULTATION PLAN REPORT GENERATION
  // ==========================================================================
  
  static async generateConsultationPlanReport(
    projectId: string,
    siteId: string,
    userId: string
  ): Promise<IConsultationPlanReport> {
    try {
      // Fetch project and site info
      const project = await Project.findById(projectId);
      const site = await ProjectSite.findById(siteId);

      if (!project) throw new Error('Project not found');
      if (!site) throw new Error('Project site not found');

      // Fetch consultation plan
      const consultationPlan = await TOCConsultationPlan.findOne({
        projectSite: siteId
      }).populate('stakeholderGroups.stakeholderGroup', 'name description') as any;

      if (!consultationPlan) {
        throw new Error('Consultation plan not found for this site');
      }

      // Extract selected stakeholders
      const selectedStakeholders = consultationPlan.stakeholderGroups
        .filter((sg: { isSelected: any; }) => sg.isSelected)
        .map((sg: { stakeholderGroup: any; notes: any; }) => ({
          stakeholderGroup: sg.stakeholderGroup,
          notes: sg.notes
        }));

      // Calculate completion status
      const completionStatus = this.calculateConsultationCompletionStatus(consultationPlan);

      // Calculate timeline duration
      const timeline = consultationPlan.plannedConsultationDates;
      let duration: number | undefined;
      if (timeline.startDate && timeline.endDate) {
        duration = Math.ceil(
          (timeline.endDate.getTime() - timeline.startDate.getTime()) / (24 * 60 * 60 * 1000)
        );
      }

      const report: IConsultationPlanReport = {
        reportType: 'consultation_plan',
        projectInfo: {
          id: project._id.toString(),
          name: project.name,
          description: project.description
        },
        siteInfo: {
          id: site._id.toString(),
          name: site.name,
          location: (site as any).location
        },
        reportMetadata: {
          generatedAt: new Date(),
          generatedBy: userId,
          version: '2.0'
        },
        consultationPlan: {
          planId: consultationPlan._id.toString(),
          status: consultationPlan.status,
          isCompleted: consultationPlan.isCompleted,
          selectedStakeholders,
          planning: {
            expectedParticipants: consultationPlan.consultationQuestions.howManyPeople,
            invitationStrategy: consultationPlan.consultationQuestions.whoInvitedHow,
            venue: consultationPlan.consultationQuestions.whereHow,
            underrepresentedGroups: consultationPlan.consultationQuestions.underRepresentedGroups,
            budget: consultationPlan.consultationQuestions.costsPlanning,
            permissions: consultationPlan.consultationQuestions.permissions
          },
          timeline: {
            startDate: timeline.startDate,
            endDate: timeline.endDate,
            description: timeline.dateDescription,
            duration
          },
          completionStatus
        }
      };

      return report;

    } catch (error) {
      console.error('Error generating consultation plan report:', error);
      throw new Error(`Failed to generate consultation plan report: ${error}`);
    }
  }

// services/reports/theoryOfChangeReport.service.ts - PART 2 (Helper Methods)

  // ==========================================================================
  // DEPENDENCY VALIDATION
  // ==========================================================================
  
  private static validateActionDependencies(actions: any[]): void {
    const actionMap = new Map(actions.map(action => [action._id.toString(), action]));
    
    // Build dependency graph
    const graph = new Map<string, Set<string>>();
    actions.forEach(action => {
      const actionId = action._id.toString();
      graph.set(actionId, new Set());
      
      if (action.dependencies && action.dependencies.length > 0) {
        action.dependencies.forEach((depId: any) => {
          const depIdStr = depId.toString();
          // Only add if dependency exists in our action set
          if (actionMap.has(depIdStr)) {
            graph.get(actionId)!.add(depIdStr);
          }
        });
      }
    });
    
    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];
    
    const detectCycle = (nodeId: string, path: string[] = []): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const neighbors = graph.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (detectCycle(neighbor, [...path])) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Cycle detected
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
          return true;
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    // Check all nodes
    for (const actionId of graph.keys()) {
      if (!visited.has(actionId)) {
        detectCycle(actionId);
      }
    }
    
    // If cycles detected, throw error with details
    if (cycles.length > 0) {
      const cycleDetails = cycles.map(cycle => {
        const actionNames = cycle.map(id => {
          const action = actionMap.get(id);
          return action ? action.action.substring(0, 50) : id;
        });
        return actionNames.join(' → ');
      }).join('\n');
      
      throw new Error(
        `Circular dependencies detected in actions:\n${cycleDetails}\n` +
        'Please resolve these circular dependencies before generating reports.'
      );
    }
  }

  // ==========================================================================
  // GANTT TIMELINE WITH DATE ESTIMATION
  // ==========================================================================
  
  private static async generateGanttTimelineWithEstimation(
    actions: any[]
  ): Promise<IGanttTimelineItem[]> {
    const ganttTimeline: IGanttTimelineItem[] = [];
    
    // First pass: Process actions with actual dates
    const actionsWithDates = actions.filter(action => 
      action.timeframe?.startDate && action.timeframe?.endDate
    );
    
    const actionsWithoutDates = actions.filter(action => 
      !action.timeframe?.startDate || !action.timeframe?.endDate
    );
    
    // Calculate project baseline dates from existing actions
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;
    
    actionsWithDates.forEach(action => {
      const start = new Date(action.timeframe.startDate);
      const end = new Date(action.timeframe.endDate);
      
      if (!earliestDate || start < earliestDate) earliestDate = start;
      if (!latestDate || end > latestDate) latestDate = end;
    });
    
    // If no dates exist at all, use current date as baseline
    if (!earliestDate) {
      earliestDate = new Date();
      latestDate = new Date();
      latestDate.setDate(latestDate.getDate() + 90); // Default 90-day project
    }
    
    // Process actions with dates
    actionsWithDates.forEach(action => {
      ganttTimeline.push(this.createGanttItem(action, false));
    });
    
    // Estimate dates for actions without dates
    actionsWithoutDates.forEach((action, index) => {
      const estimatedDates = this.estimateActionDates(
        action, 
        earliestDate!, 
        latestDate!, 
        index,
        actionsWithoutDates.length
      );
      
      ganttTimeline.push(this.createGanttItem(action, true, estimatedDates));
    });
    
    // Sort by start date
    ganttTimeline.sort((a, b) => {
      const aDate = a.startDate || new Date();
      const bDate = b.startDate || new Date();
      return aDate.getTime() - bDate.getTime();
    });
    
    return ganttTimeline;
  }
  
  private static createGanttItem(
    action: any, 
    isEstimated: boolean,
    estimatedDates?: { startDate: Date; endDate: Date; duration: number; method: string }
  ): IGanttTimelineItem {
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let duration: number | undefined;
    let estimationMethod: string | undefined;
    
    if (isEstimated && estimatedDates) {
      startDate = estimatedDates.startDate;
      endDate = estimatedDates.endDate;
      duration = estimatedDates.duration;
      estimationMethod = estimatedDates.method;
    } else {
      startDate = action.timeframe?.startDate;
      endDate = action.timeframe?.endDate;
      duration = this.calculateDuration(startDate, endDate);
    }
    
    return {
      id: action._id.toString(),
      name: action.action,
      type: 'action',
      stakeholder: {
        _id: action.stakeholderGroup._id.toString(),
        name: action.stakeholderGroup.name
      },
      themes: action.themes.map((theme: any) => ({
        _id: theme._id.toString(),
        name: theme.name
      })),
      startDate,
      endDate,
      duration,
      progress: action.progress || 0,
      status: action.status || 'not_started',
      priority: action.priority,
      responsibility: action.responsibility ? {
        name: action.responsibility.name,
        role: action.responsibility.role || 'Unknown',
        email: action.responsibility.email
      } : undefined,
      dependencies: action.dependencies?.map((dep: any) => dep.toString()) || [],
      milestones: action.milestones || [],
      isEstimated,
      estimationMethod
    };
  }
  
  private static estimateActionDates(
    action: any,
    projectStart: Date,
    projectEnd: Date,
    actionIndex: number,
    totalActions: number
  ): { startDate: Date; endDate: Date; duration: number; method: string } {
    const projectDuration = Math.ceil(
      (projectEnd.getTime() - projectStart.getTime()) / (24 * 60 * 60 * 1000)
    );
    
    // Method 1: Use estimatedDuration if provided
    if (action.timeframe?.estimatedDuration) {
      const duration = action.timeframe.estimatedDuration;
      
      // Distribute across project timeline based on priority
      let startOffset: number;
      if (action.priority === 'critical' || action.priority === 'high') {
        // Start early in project
        startOffset = Math.floor(projectDuration * 0.1);
      } else if (action.priority === 'medium') {
        // Start mid-project
        startOffset = Math.floor(projectDuration * 0.3);
      } else {
        // Start later
        startOffset = Math.floor(projectDuration * 0.5);
      }
      
      const startDate = new Date(projectStart);
      startDate.setDate(startDate.getDate() + startOffset);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration);
      
      return {
        startDate,
        endDate,
        duration,
        method: 'Based on estimated duration and priority'
      };
    }
    
    // Method 2: Distribute evenly across project timeline
    const avgDuration = Math.max(Math.floor(projectDuration / (totalActions + 1)), 7); // Min 7 days
    const startOffset = Math.floor((actionIndex + 1) * (projectDuration / (totalActions + 1)));
    
    const startDate = new Date(projectStart);
    startDate.setDate(startDate.getDate() + startOffset);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + avgDuration);
    
    return {
      startDate,
      endDate,
      duration: avgDuration,
      method: 'Distributed evenly across project timeline'
    };
  }

  // ==========================================================================
  // WORKLOAD CALCULATION
  // ==========================================================================
  
  private static calculateStakeholderWorkloads(
    ganttTimeline: IGanttTimelineItem[]
  ): IStakeholderWorkload[] {
    const workloadMap = new Map();
    
    ganttTimeline.forEach(item => {
      const stakeholderId = item.stakeholder._id;
      if (!workloadMap.has(stakeholderId)) {
        workloadMap.set(stakeholderId, {
          stakeholder: item.stakeholder,
          activities: [],
          totalDuration: 0,
          completedActivities: 0,
          totalProgress: 0,
          highPriorityCount: 0
        });
      }
      
      const workload = workloadMap.get(stakeholderId);
      workload.activities.push(item);
      workload.totalDuration += item.duration || 0;
      workload.totalProgress += item.progress;
      
      if (item.status === 'completed') {
        workload.completedActivities++;
      }
      
      if (item.priority === 'high' || item.priority === 'critical') {
        workload.highPriorityCount++;
      }
    });

    return Array.from(workloadMap.values()).map(workload => {
      const activityCount = workload.activities.length;
      const completionRate = activityCount > 0 
        ? Math.round((workload.completedActivities / activityCount) * 100)
        : 0;
      const averageProgress = activityCount > 0
        ? Math.round(workload.totalProgress / activityCount)
        : 0;
      
      // Calculate upcoming deadlines (next 14 days)
      const now = new Date();
      const fourteenDaysFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
      const upcomingDeadlines = workload.activities.filter((activity: IGanttTimelineItem) => {
        return activity.endDate && 
              activity.endDate >= now && 
              activity.endDate <= fourteenDaysFromNow && 
              activity.status !== 'completed';
      }).length;
      
      // Calculate workload score (higher = more intense)
      const workloadScore = 
        (workload.totalDuration * 0.3) +
        (activityCount * 5) +
        (upcomingDeadlines * 10) +
        (workload.highPriorityCount * 15) +
        ((100 - completionRate) * 0.2);
      
      return {
        stakeholder: workload.stakeholder,
        activities: workload.activities,
        totalDuration: workload.totalDuration,
        activityCount,
        completionRate,
        averageProgress,
        upcomingDeadlines,
        workloadScore: Math.round(workloadScore)
      };
    })
    .sort((a, b) => b.workloadScore - a.workloadScore); // Sort by workload intensity
  }

  // ==========================================================================
  // TIMELINE ANALYSIS
  // ==========================================================================
  
  private static analyzeTimeline(ganttTimeline: IGanttTimelineItem[]) {
    if (ganttTimeline.length === 0) {
      return {
        projectStartDate: undefined,
        projectEndDate: undefined,
        totalDuration: 0,
        criticalPath: [],
        upcomingDeadlines: [],
        statusBreakdown: {},
        averageProgress: 0
      };
    }
    
    // Find project boundaries
    const dates = ganttTimeline
      .filter(item => item.startDate && item.endDate)
      .flatMap(item => [item.startDate!, item.endDate!]);
    
    const projectStartDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined;
    const projectEndDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;
    
    const totalDuration = projectStartDate && projectEndDate
      ? Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    
    // Find critical path (simplified - items with most dependencies and longest duration)
    const criticalPath = this.findCriticalPath(ganttTimeline);
    
    // Find upcoming deadlines
    const upcomingDeadlines = this.getUpcomingDeadlines(ganttTimeline);
    
    // Status breakdown
    const statusBreakdown = ganttTimeline.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Average progress
    const averageProgress = ganttTimeline.length > 0
      ? Math.round(ganttTimeline.reduce((sum, item) => sum + item.progress, 0) / ganttTimeline.length)
      : 0;
    
    return {
      projectStartDate,
      projectEndDate,
      totalDuration,
      criticalPath,
      upcomingDeadlines,
      statusBreakdown,
      averageProgress
    };
  }
  
  private static findCriticalPath(ganttTimeline: IGanttTimelineItem[]): IGanttTimelineItem[] {
    // Calculate complexity score for each item
    const scoredItems = ganttTimeline.map(item => ({
      item,
      score: 
        (item.duration || 0) * 2 + 
        (item.dependencies?.length || 0) * 10 +
        (item.priority === 'critical' ? 50 : item.priority === 'high' ? 30 : 0) +
        (item.status === 'in_progress' ? 20 : 0) +
        (100 - item.progress) * 0.3
    }))
    .sort((a, b) => b.score - a.score);
    
    // Return top 5 critical items
    return scoredItems.slice(0, 5).map(scored => scored.item);
  }
  
  private static getUpcomingDeadlines(ganttTimeline: IGanttTimelineItem[]) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    return ganttTimeline
      .filter(item => {
        return item.endDate && 
               item.endDate >= now && 
               item.endDate <= thirtyDaysFromNow && 
               item.status !== 'completed';
      })
      .map(item => ({
        item,
        daysUntilDue: Math.ceil((item.endDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      }))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  // ==========================================================================
  // OUTCOME REPORT HELPERS
  // ==========================================================================
  
  private static groupImpactsByStakeholder(impacts: any[]) {
    const stakeholderMap = new Map();
    
    impacts.forEach(impact => {
      const stakeholderId = impact.stakeholderGroup._id.toString();
      if (!stakeholderMap.has(stakeholderId)) {
        stakeholderMap.set(stakeholderId, {
          stakeholder: impact.stakeholderGroup,
          impacts: [],
          totalRisks: 0,
          completedImpacts: 0,
          totalProgress: 0
        });
      }
      
      const group = stakeholderMap.get(stakeholderId);
      group.impacts.push(impact);
      group.totalRisks += impact.risks.length;
      group.totalProgress += impact.progress || 0;
      
      if (impact.status === 'achieved') {
        group.completedImpacts++;
      }
    });
    
    return Array.from(stakeholderMap.values()).map(group => ({
      stakeholder: group.stakeholder,
      impacts: group.impacts,
      totalRisks: group.totalRisks,
      achievementRate: group.impacts.length > 0 
        ? Math.round((group.completedImpacts / group.impacts.length) * 100)
        : 0,
      averageProgress: group.impacts.length > 0
        ? Math.round(group.totalProgress / group.impacts.length)
        : 0
    }));
  }
  
  private static async groupByFramework(
    impacts: any[],
    subThemes: any[],
    frameworkType: string
  ): Promise<IFrameworkGroup[]> {
    const frameworkGroups: IFrameworkGroup[] = [];
    const frameworkMap = new Map();
    
    // Extract framework items based on type
    subThemes.forEach(subTheme => {
      let tags: any[] = [];
      
      switch (frameworkType) {
        case 'themes':
          if (subTheme.theme) {
            tags = [subTheme.theme];
          }
          break;
        case 'sdgs':
          tags = subTheme.sdgTags || [];
          break;
        case 'resilience':
          tags = subTheme.resilienceTags || [];
          break;
        case 'indicators':
          tags = subTheme.indicatorTags || [];
          break;
        case 'esg':
          tags = subTheme.esgTags || [];
          break;
        case 'standards':
          tags = subTheme.standardTags || [];
          break;
      }
      
      tags.forEach(tag => {
        const tagId = tag._id.toString();
        if (!frameworkMap.has(tagId)) {
          frameworkMap.set(tagId, {
            framework: tag,
            relatedSubThemes: new Set([subTheme._id.toString()]),
            impacts: []
          });
        } else {
          frameworkMap.get(tagId).relatedSubThemes.add(subTheme._id.toString());
        }
      });
    });
    
    // Map impacts to framework items
    impacts.forEach(impact => {
      const impactSubThemeIds = impact.subThemes.map((st: any) => st._id.toString());
      
      frameworkMap.forEach((data, frameworkId) => {
        const hasMatch = impactSubThemeIds.some((stId: string) => 
          data.relatedSubThemes.has(stId)
        );
        
        if (hasMatch) {
          data.impacts.push(impact);
        }
      });
    });
    
    // Build framework groups
    frameworkMap.forEach((data, frameworkId) => {
      const achievedImpacts = data.impacts.filter((i: any) => i.status === 'achieved').length;
      const totalRisks = data.impacts.reduce((sum: number, i: any) => sum + i.risks.length, 0);
      
      frameworkGroups.push({
        framework: {
          _id: frameworkId,
          name: data.framework.name,
          code: data.framework.code,
          description: data.framework.description
        },
        impacts: data.impacts,
        metrics: {
          totalImpacts: data.impacts.length,
          achievementRate: data.impacts.length > 0 
            ? Math.round((achievedImpacts / data.impacts.length) * 100)
            : 0,
          riskCount: totalRisks
        }
      });
    });
    
    return frameworkGroups.sort((a, b) => b.impacts.length - a.impacts.length);
  }
  
  private static generateRiskRegister(impacts: any[]) {
    const allRisks: any[] = [];
    
    impacts.forEach(impact => {
      impact.risks.forEach((risk: any) => {
        allRisks.push({
          impact,
          risk,
          stakeholder: impact.stakeholderGroup
        });
      });
    });
    
    const bySeverity = {
      low: allRisks.filter(r => r.risk.severity === 'low').length,
      medium: allRisks.filter(r => r.risk.severity === 'medium').length,
      high: allRisks.filter(r => r.risk.severity === 'high').length
    };
    
    // Top risks (high severity + no mitigation)
    const topRisks = allRisks
      .filter(r => r.risk.severity === 'high' || 
                   (r.risk.severity === 'medium' && !r.risk.mitigation))
      .sort((a, b) => {
        const severityScore = { high: 3, medium: 2, low: 1 };
        return severityScore[b.risk.severity as keyof typeof severityScore] - 
               severityScore[a.risk.severity as keyof typeof severityScore];
      })
      .slice(0, 10);
    
    const risksWithMitigation = allRisks.filter(r => r.risk.mitigation && r.risk.mitigation.trim()).length;
    const mitigationCoverage = allRisks.length > 0 
      ? Math.round((risksWithMitigation / allRisks.length) * 100)
      : 0;
    
    return {
      totalRisks: allRisks.length,
      bySeverity,
      topRisks,
      mitigationCoverage
    };
  }
  
  private static generateMeasurementSummary(impacts: any[]) {
    const impactsWithMeasurementPlan = impacts.filter(
      impact => impact.measurementPlan?.indicators?.length > 0
    ).length;
    
    const allIndicators = new Set<string>();
    const methodCounts: Record<string, number> = {};
    
    impacts.forEach(impact => {
      if (impact.measurementPlan?.indicators) {
        impact.measurementPlan.indicators.forEach((ind: string) => allIndicators.add(ind));
      }
      
      if (impact.measurementPlan?.measurementMethod) {
        const method = impact.measurementPlan.measurementMethod;
        methodCounts[method] = (methodCounts[method] || 0) + 1;
      }
    });
    
    return {
      impactsWithMeasurementPlan,
      indicatorCount: allIndicators.size,
      measurementMethods: methodCounts
    };
  }

  // ==========================================================================
  // MULTI-SITE HELPERS
  // ==========================================================================
  
  private static async generateSiteBreakdown(
    sites: any[],
    actions: any[],
    impacts: any[],
    reportType: 'workplan' | 'outcome'
  ): Promise<ISiteBreakdown[]> {
    const breakdown: ISiteBreakdown[] = [];
    
    for (const site of sites) {
      const siteId = site._id.toString();
      
      // Filter actions/impacts for this site
      const siteActions = actions.filter(action => 
        action.stage?.projectSite?.toString() === siteId
      );
      
      const siteImpacts = impacts.filter(impact => 
        impact.stage?.projectSite?.toString() === siteId
      );
      
      let ganttTimeline: IGanttTimelineItem[] | undefined;
      let completionRate: number | undefined;
      
      if (reportType === 'workplan' && siteActions.length > 0) {
        this.validateActionDependencies(siteActions);
        ganttTimeline = await this.generateGanttTimelineWithEstimation(siteActions);
        
        const completed = siteActions.filter(a => a.status === 'completed').length;
        completionRate = Math.round((completed / siteActions.length) * 100);
      } else if (reportType === 'outcome' && siteImpacts.length > 0) {
        const achieved = siteImpacts.filter(i => i.status === 'achieved').length;
        completionRate = Math.round((achieved / siteImpacts.length) * 100);
      }
      
      breakdown.push({
        siteId,
        siteName: site.name,
        actionCount: siteActions.length,
        impactCount: siteImpacts.length,
        actions: reportType === 'workplan' ? siteActions : undefined,
        impacts: reportType === 'outcome' ? siteImpacts : undefined,
        ganttTimeline,
        completionRate
      });
    }
    
    return breakdown.sort((a, b) => 
      (b.actionCount + b.impactCount) - (a.actionCount + a.impactCount)
    );
  }
  
  private static generateAggregatedView(siteBreakdown: ISiteBreakdown[]) {
    const actionsPerSite: Record<string, number> = {};
    const impactsPerSite: Record<string, number> = {};
    const completionRatePerSite: Record<string, number> = {};
    const riskCountPerSite: Record<string, number> = {};
    
    siteBreakdown.forEach(site => {
      actionsPerSite[site.siteName] = site.actionCount;
      impactsPerSite[site.siteName] = site.impactCount;
      completionRatePerSite[site.siteName] = site.completionRate || 0;
      
      if (site.impacts) {
        const riskCount = site.impacts.reduce((sum, impact) => sum + impact.risks.length, 0);
        riskCountPerSite[site.siteName] = riskCount;
      }
    });
    
    return {
      totalSites: siteBreakdown.length,
      actionsPerSite,
      impactsPerSite,
      completionRatePerSite,
      riskCountPerSite
    };
  }

  // ==========================================================================
  // CONSULTATION PLAN HELPERS
  // ==========================================================================
  
  private static calculateConsultationCompletionStatus(plan: any) {
    const sections = {
      stakeholders: plan.stakeholderGroups.some((sg: any) => sg.isSelected),
      questions: Object.values(plan.consultationQuestions).some(
        (q: any) => q && typeof q === 'string' && q.trim() !== ''
      ),
      dates: plan.plannedConsultationDates.startDate || 
             plan.plannedConsultationDates.endDate || 
             (plan.plannedConsultationDates.dateDescription && 
              plan.plannedConsultationDates.dateDescription.trim() !== '')
    };
    
    const completedSections = Object.entries(sections)
      .filter(([_, completed]) => completed)
      .map(([section, _]) => section);
    
    const missingSections = Object.entries(sections)
      .filter(([_, completed]) => !completed)
      .map(([section, _]) => section);
    
    const completionPercentage = Math.round(
      (completedSections.length / Object.keys(sections).length) * 100
    );
    
    return {
      isCompleted: plan.isCompleted,
      completionPercentage,
      completedSections,
      missingSections
    };
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  private static buildStageQuery(projectId: string, filters: IToCReportFilters) {
    const query: any = {
      project: projectId,
      archived: filters.includeArchived ? undefined : { $ne: true }
    };

    switch (filters.scope) {
      case 'project':
        query.projectSite = null;
        break;
      case 'site':
        query.projectSite = { $ne: null };
        if (filters.siteIds && filters.siteIds.length > 0) {
          query.projectSite = { $in: filters.siteIds.map(id => new mongoose.Types.ObjectId(id)) };
        }
        break;
      case 'all':
      default:
        if (filters.siteIds && filters.siteIds.length > 0) {
          query.$or = [
            { projectSite: null },
            { projectSite: { $in: filters.siteIds.map(id => new mongoose.Types.ObjectId(id)) } }
          ];
        }
        break;
    }

    if (filters.stageNumbers && filters.stageNumbers.length > 0) {
      query.stageNumber = { $in: filters.stageNumbers };
    }

    return query;
  }
  
  private static async fetchActionsAndImpacts(stages: any[], filters: IToCReportFilters) {
    const stageIds = stages.map(stage => stage._id);

    const actionQuery: any = {
      stage: { $in: stageIds },
      archived: { $ne: true }
    };

    if (filters.stakeholderIds && filters.stakeholderIds.length > 0) {
      actionQuery.stakeholderGroup = { 
        $in: filters.stakeholderIds.map(id => new mongoose.Types.ObjectId(id)) 
      };
    }

    if (filters.themeIds && filters.themeIds.length > 0) {
      actionQuery.themes = { 
        $in: filters.themeIds.map(id => new mongoose.Types.ObjectId(id)) 
      };
    }

    const actions = await StakeholderAction.find(actionQuery)
      .populate({
        path: 'stakeholderGroup',
        select: 'name description category estimatedPopulation completionStatus themes',
        populate: {
          path: 'category',
          select: 'name'
        }
      })
      .populate('themes', 'name')
      .populate('subThemes', 'name')
      .populate('stage', 'stageNumber status progress projectSite')
      .populate('dependencies')
      .sort({ createdAt: 1 }
    );

    const impactQuery: any = {
      stage: { $in: stageIds },
      archived: { $ne: true }
    };

    if (filters.stakeholderIds && filters.stakeholderIds.length > 0) {
      impactQuery.stakeholderGroup = { 
        $in: filters.stakeholderIds.map(id => new mongoose.Types.ObjectId(id)) 
      };
    }

    if (filters.themeIds && filters.themeIds.length > 0) {
      impactQuery.themes = { 
        $in: filters.themeIds.map(id => new mongoose.Types.ObjectId(id)) 
      };
    }

    const impacts = await SocialImpact.find(impactQuery)
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')
      .populate('subThemes', 'name')
      .populate('stage', 'stageNumber status progress projectSite')
      .sort({ createdAt: 1 });

    return { actions, impacts };
  }
  
  private static calculateDuration(startDate?: Date, endDate?: Date): number {
    if (!startDate || !endDate) return 0;
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  }
}

export default TheoryOfChangeReportService;