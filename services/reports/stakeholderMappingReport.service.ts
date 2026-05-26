// services/reports/stakeholderMappingReport.service.ts
import mongoose from "mongoose";
import StakeholderGroup from "../../models/stakeholderGroup.model";
import Project from "../../models/project.model";
import ProjectSite from "../../models/projectSite.model";
import Category from "../../models/category.model";
import Organization from "../../models/organization.model";

// Interface for stakeholder mapping report filters
interface IStakeholderReportFilters {
  scope: 'all' | 'project' | 'site';
  siteIds?: string[];
  categories?: string[];
  connectionStrength?: {
    min: number;
    max: number;
  };
  completionStatus?: string[];
  includeArchived?: boolean;
  // NEW: Filter by key insights
  onlyKeyInsights?: boolean; // Only include stakeholders with key insights
}

// Interface for processed stakeholder data
interface IProcessedStakeholder {
  _id: string;
  name: string;
  description?: string;
  category: {
    _id: string;
    name: string;
  };
  project: {
    _id: string;
    name: string;
  };
  projectSite?: {
    _id: string;
    name: string;
  };
  completionStatus: string;
  tasks: Array<{
    taskType: string;
    responses: Array<{
      optionId: string;
      description: string;
      isKeyInsight?: boolean; // NEW: Key insight flag
    }>;
    rating?: number;
    tags?: string[];
    updatedAt: Date;
  }>;
  themes: any[];
  createdAt: Date;
  updatedAt: Date;
  // Computed fields
  averageRating: number;
  taskCompletionCount: number;
  scope: 'project' | 'site';
  // Tags
  allTags: string[];
  tagsByTask: Record<string, string[]>;
  // NEW: Key insights fields
  keyInsights: Array<{
    taskType: string;
    optionId: string;
    description: string;
    rating?: number;
  }>;
  keyInsightCount: number;
  hasKeyInsights: boolean;
  keyInsightsByTask: Record<string, number>;
}

// NEW: Interface for key insight analysis
interface IKeyInsightAnalysis {
  stakeholder: {
    _id: string;
    name: string;
    category: string;
  };
  taskType: string;
  optionId: string;
  description: string;
  rating?: number;
  tags?: string[];
  scope: 'project' | 'site';
  siteName?: string;
}

// Interface for the comprehensive report data
interface IStakeholderMappingReportData {
  projectInfo: {
    id: string;
    name: string;
    description?: string;
    status: string;
  };
  
  organizationInfo: {
    id: string;
    name: string;
  };
  
  reportMetadata: {
    reportingPeriod: Date;
    version: string;
    scope: string;
    totalStakeholders: number;
    appliedFilters: IStakeholderReportFilters;
    generatedAt: Date;
    generatedBy: string;
  };
  
  summary: {
    totalStakeholders: number;
    completedStakeholders: number;
    inProgressStakeholders: number;
    notStartedStakeholders: number;
    completionPercentage: number;
    stakeholdersByCategory: Record<string, {
      total: number;
      completed: number;
      averageRating: number;
    }>;
    stakeholdersByScope: {
      project: number;
      site: number;
    };
    stakeholdersBySite: Record<string, number>;
    averageRatings: {
      overall: number;
      byTaskType: Record<string, number>;
    };
    // NEW: Key insights summary
    totalKeyInsights: number;
    stakeholdersWithKeyInsights: number;
    averageKeyInsightsPerStakeholder: number;
  };
  
  stakeholderData: IProcessedStakeholder[];
  
  stakeholdersByCategory: Record<string, IProcessedStakeholder[]>;
  
  influenceMatrix: Array<{
    stakeholder: IProcessedStakeholder;
    ratings: {
      power: number;
      connections: number;
      risks: number;
      roles: number;
      benefits: number;
      wellbeing: number;
    };
    averageInfluence: number;
  }>;
  
  // Keep tag insights
  tagInsights: {
    totalUniqueTags: number;
    mostCommonTags: Array<{ tag: string; count: number; stakeholders: string[] }>;
    tagsByCategory: Record<string, Array<{ tag: string; count: number }>>;
    tagsByTaskType: Record<string, string[]>;
    tagFrequencyDistribution: Record<string, number>;
  };

  // NEW: Key insights section
  keyInsights: {
    totalKeyInsights: number;
    stakeholdersWithKeyInsights: number;
    averageKeyInsightsPerStakeholder: number;
    percentageOfStakeholdersWithKeyInsights: number;
    
    // Key insights by task type
    byTaskType: Record<string, {
      count: number;
      stakeholders: number;
      insights: IKeyInsightAnalysis[];
    }>;
    
    // Key insights by category
    byCategory: Record<string, {
      count: number;
      stakeholders: number;
      insights: IKeyInsightAnalysis[];
    }>;
    
    // Top stakeholders with most key insights
    topStakeholders: Array<{
      stakeholder: {
        _id: string;
        name: string;
        category: string;
      };
      keyInsightCount: number;
      keyInsightsByTask: Record<string, number>;
      averageRating: number;
    }>;
    
    // Key insights distribution by rating
    ratingDistribution: Record<string, number>; // '1': count, '2': count, etc.
    
    // Key insights by scope
    byScope: {
      project: number;
      site: number;
    };
    
    // All key insights (flattened for easy access)
    allInsights: IKeyInsightAnalysis[];
    
    // Key insights timeline (if dates are available)
    recentInsights: IKeyInsightAnalysis[]; // Last 10 most recent
  };

  availableSites: Array<{
    _id: string;
    name: string;
    stakeholderCount: number;
    keyInsightCount: number; // NEW: Count of key insights per site
  }>;
  
  generationMetadata: {
    generatedAt: Date;
    generatedBy: string;
    dataVersion: string;
    totalRecords: number;
  };
}

export class StakeholderMappingReportService {
  /**
   * Generate comprehensive stakeholder mapping report
   */
  static async generateReport(
    projectId: string,
    userId: string,
    filters: IStakeholderReportFilters = { scope: 'all' }
  ): Promise<IStakeholderMappingReportData> {
    try {
      // Fetch project and organization info
      const project = await Project.findById(projectId).populate('organization');
      if (!project) {
        throw new Error('Project not found');
      }

      // Build stakeholder query based on filters
      const stakeholderQuery = await this.buildStakeholderQuery(projectId, filters);
      
      // Fetch stakeholders with all necessary data
      const stakeholders = await StakeholderGroup.find(stakeholderQuery)
        .populate('category', 'name')
        .populate('project', 'name')
        .populate('projectSite', 'name')
        .populate('creator', 'name')
        .sort({ 'category.name': 1, name: 1 });

      // Fetch all sites for metadata
      const allSites = await ProjectSite.find({ 
        project: projectId, 
        archived: { $ne: true } 
      }).select('_id name');

      // Process stakeholder data
      const processedStakeholders = stakeholders.map(stakeholder => 
        this.processStakeholderData(stakeholder)
      );

      // Apply additional filters (including key insights filter)
      const filteredStakeholders = this.applyClientSideFilters(processedStakeholders, filters);

      // Generate summary statistics (enhanced with key insights)
      const summary = this.generateSummaryStats(filteredStakeholders);

      // Group stakeholders by category
      const stakeholdersByCategory = this.groupStakeholdersByCategory(filteredStakeholders);

      // Generate influence matrix
      const influenceMatrix = this.generateInfluenceMatrix(filteredStakeholders);

      // Get site information with stakeholder counts
      const availableSites = this.getAvailableSites(allSites, processedStakeholders);

      // Generate tag insights
      const tagInsights = this.generateTagInsights(filteredStakeholders);

      // NEW: Generate comprehensive key insights analysis
      const keyInsights = this.generateKeyInsights(filteredStakeholders);

      // Build the comprehensive report
      const reportData: IStakeholderMappingReportData = {
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

        reportMetadata: {
          reportingPeriod: new Date(),
          version: 'V1.0',
          scope: filters.scope,
          totalStakeholders: filteredStakeholders.length,
          appliedFilters: filters,
          generatedAt: new Date(),
          generatedBy: userId
        },

        summary,
        stakeholderData: filteredStakeholders,
        stakeholdersByCategory,
        influenceMatrix,
        availableSites,
        tagInsights,
        keyInsights, // NEW: Add key insights

        generationMetadata: {
          generatedAt: new Date(),
          generatedBy: userId,
          dataVersion: '1.0',
          totalRecords: filteredStakeholders.length
        }
      };

      return reportData;

    } catch (error) {
      console.error('Error generating stakeholder mapping report:', error);
      throw new Error(`Failed to generate stakeholder mapping report: ${error}`);
    }
  }

  /**
   * Build MongoDB query based on filters
   */
  private static async buildStakeholderQuery(projectId: string, filters: IStakeholderReportFilters) {
    const query: any = {
      project: projectId,
      archived: filters.includeArchived ? undefined : { $ne: true }
    };

    // Handle scope filtering
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

    // Category filtering
    if (filters.categories && filters.categories.length > 0) {
      const categories = await Category.find({ 
        name: { $in: filters.categories } 
      }).select('_id');
      if (categories.length > 0) {
        query.category = { $in: categories.map(cat => cat._id) };
      }
    }

    // Completion status filtering
    if (filters.completionStatus && filters.completionStatus.length > 0) {
      query.completionStatus = { $in: filters.completionStatus };
    }

    return query;
  }

  /**
   * Process individual stakeholder data
   */
  private static processStakeholderData(stakeholder: any): IProcessedStakeholder {
    // Calculate average rating
    const ratings = stakeholder.tasks
      .filter((task: any) => task.rating !== undefined)
      .map((task: any) => task.rating);
    const averageRating = ratings.length > 0 
      ? Math.round((ratings.reduce((sum: number, rating: number) => sum + rating, 0) / ratings.length) * 10) / 10
      : 0;

    // Count completed tasks
    const taskCompletionCount = stakeholder.tasks.filter((task: any) => 
      task.responses && task.responses.length > 0 && task.rating !== undefined
    ).length;

    // Process tags
    const allTags: string[] = [];
    const tagsByTask: Record<string, string[]> = {};
    
    stakeholder.tasks.forEach((task: any) => {
      if (task.tags && Array.isArray(task.tags) && task.tags.length > 0) {
        tagsByTask[task.taskType] = task.tags;
        allTags.push(...task.tags);
      } else {
        tagsByTask[task.taskType] = [];
      }
    });

    const uniqueTags = [...new Set(allTags)];

    // NEW: Process key insights
    const keyInsights: Array<{
      taskType: string;
      optionId: string;
      description: string;
      rating?: number;
    }> = [];
    
    const keyInsightsByTask: Record<string, number> = {};

    stakeholder.tasks.forEach((task: any) => {
      const taskKeyInsights = task.responses?.filter((response: any) => response.isKeyInsight === true) || [];
      
      keyInsightsByTask[task.taskType] = taskKeyInsights.length;
      
      taskKeyInsights.forEach((response: any) => {
        keyInsights.push({
          taskType: task.taskType,
          optionId: response.optionId,
          description: response.description,
          rating: task.rating
        });
      });
    });

    const keyInsightCount = keyInsights.length;
    const hasKeyInsights = keyInsightCount > 0;

    return {
      _id: stakeholder._id.toString(),
      name: stakeholder.name,
      description: stakeholder.description,
      category: {
        _id: stakeholder.category._id.toString(),
        name: stakeholder.category.name
      },
      project: {
        _id: stakeholder.project._id.toString(),
        name: stakeholder.project.name
      },
      projectSite: stakeholder.projectSite ? {
        _id: stakeholder.projectSite._id.toString(),
        name: stakeholder.projectSite.name
      } : undefined,
      completionStatus: stakeholder.completionStatus,
      tasks: stakeholder.tasks.map((task: any) => ({
        taskType: task.taskType,
        responses: task.responses,
        rating: task.rating,
        tags: task.tags || [],
        updatedAt: task.updatedAt
      })),
      themes: stakeholder.themes || [],
      createdAt: stakeholder.createdAt,
      updatedAt: stakeholder.updatedAt,
      averageRating,
      taskCompletionCount,
      scope: stakeholder.projectSite ? 'site' : 'project',
      allTags: uniqueTags,
      tagsByTask,
      // NEW: Add key insights data
      keyInsights,
      keyInsightCount,
      hasKeyInsights,
      keyInsightsByTask,
    };
  }

  /**
   * NEW: Generate comprehensive key insights analysis
   */
  private static generateKeyInsights(stakeholders: IProcessedStakeholder[]) {
    // Collect all key insights with full context
    const allInsights: IKeyInsightAnalysis[] = [];
    
    stakeholders.forEach(stakeholder => {
      stakeholder.keyInsights.forEach(insight => {
        // Find the task to get tags
        const task = stakeholder.tasks.find(t => t.taskType === insight.taskType);
        
        allInsights.push({
          stakeholder: {
            _id: stakeholder._id,
            name: stakeholder.name,
            category: stakeholder.category.name
          },
          taskType: insight.taskType,
          optionId: insight.optionId,
          description: insight.description,
          rating: insight.rating,
          tags: task?.tags || [],
          scope: stakeholder.scope,
          siteName: stakeholder.projectSite?.name
        });
      });
    });

    // Calculate basic statistics
    const totalKeyInsights = allInsights.length;
    const stakeholdersWithKeyInsights = stakeholders.filter(s => s.hasKeyInsights).length;
    const averageKeyInsightsPerStakeholder = stakeholders.length > 0 
      ? Math.round((totalKeyInsights / stakeholders.length) * 10) / 10
      : 0;
    const percentageOfStakeholdersWithKeyInsights = stakeholders.length > 0
      ? Math.round((stakeholdersWithKeyInsights / stakeholders.length) * 100)
      : 0;

    // Group by task type
    const byTaskType: Record<string, {
      count: number;
      stakeholders: number;
      insights: IKeyInsightAnalysis[];
    }> = {};

    const taskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
    taskTypes.forEach(taskType => {
      const taskInsights = allInsights.filter(i => i.taskType === taskType);
      const uniqueStakeholders = new Set(taskInsights.map(i => i.stakeholder._id));
      
      byTaskType[taskType] = {
        count: taskInsights.length,
        stakeholders: uniqueStakeholders.size,
        insights: taskInsights
      };
    });

    // Group by category
    const byCategory: Record<string, {
      count: number;
      stakeholders: number;
      insights: IKeyInsightAnalysis[];
    }> = {};

    stakeholders.forEach(stakeholder => {
      const category = stakeholder.category.name;
      if (!byCategory[category]) {
        byCategory[category] = {
          count: 0,
          stakeholders: 0,
          insights: []
        };
      }
      
      if (stakeholder.hasKeyInsights) {
        byCategory[category].stakeholders++;
        byCategory[category].count += stakeholder.keyInsightCount;
        
        // Add this stakeholder's key insights
        const stakeholderInsights = allInsights.filter(
          i => i.stakeholder._id === stakeholder._id
        );
        byCategory[category].insights.push(...stakeholderInsights);
      }
    });

    // Top stakeholders with most key insights
    const topStakeholders = stakeholders
      .filter(s => s.hasKeyInsights)
      .map(s => ({
        stakeholder: {
          _id: s._id,
          name: s.name,
          category: s.category.name
        },
        keyInsightCount: s.keyInsightCount,
        keyInsightsByTask: s.keyInsightsByTask,
        averageRating: s.averageRating
      }))
      .sort((a, b) => b.keyInsightCount - a.keyInsightCount)
      .slice(0, 10);

    // Rating distribution for key insights
    const ratingDistribution: Record<string, number> = {
      '1': 0, '2': 0, '3': 0, '4': 0, '5': 0
    };
    
    allInsights.forEach(insight => {
      if (insight.rating) {
        const ratingKey = Math.round(insight.rating).toString();
        if (ratingDistribution[ratingKey] !== undefined) {
          ratingDistribution[ratingKey]++;
        }
      }
    });

    // Key insights by scope
    const byScope = {
      project: allInsights.filter(i => i.scope === 'project').length,
      site: allInsights.filter(i => i.scope === 'site').length
    };

    // Recent insights (last 10)
    const recentInsights = [...allInsights]
      .sort((a, b) => {
        // We don't have updatedAt on insights directly, so we'll just take the first 10
        // In a real scenario, you might want to track when insights were marked
        return 0;
      })
      .slice(0, 10);

    return {
      totalKeyInsights,
      stakeholdersWithKeyInsights,
      averageKeyInsightsPerStakeholder,
      percentageOfStakeholdersWithKeyInsights,
      byTaskType,
      byCategory,
      topStakeholders,
      ratingDistribution,
      byScope,
      allInsights,
      recentInsights
    };
  }

  /**
   * Generate comprehensive tag insights
   */
  private static generateTagInsights(stakeholders: IProcessedStakeholder[]) {
    // ... (keep existing implementation)
    const tagData = new Map<string, {
      count: number;
      stakeholders: Set<string>;
      categories: Set<string>;
      taskTypes: Set<string>;
    }>();

    stakeholders.forEach(stakeholder => {
      stakeholder.allTags.forEach(tag => {
        if (!tagData.has(tag)) {
          tagData.set(tag, {
            count: 0,
            stakeholders: new Set(),
            categories: new Set(),
            taskTypes: new Set()
          });
        }
        
        const data = tagData.get(tag)!;
        data.count++;
        data.stakeholders.add(stakeholder.name);
        data.categories.add(stakeholder.category.name);
        
        Object.entries(stakeholder.tagsByTask).forEach(([taskType, tags]) => {
          if (tags.includes(tag)) {
            data.taskTypes.add(taskType);
          }
        });
      });
    });

    const mostCommonTags = Array.from(tagData.entries())
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        stakeholders: Array.from(data.stakeholders)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const tagsByCategory: Record<string, Array<{ tag: string; count: number }>> = {};
    stakeholders.forEach(stakeholder => {
      const category = stakeholder.category.name;
      if (!tagsByCategory[category]) {
        tagsByCategory[category] = [];
      }
      
      const categoryTags = new Map<string, number>();
      stakeholder.allTags.forEach(tag => {
        categoryTags.set(tag, (categoryTags.get(tag) || 0) + 1);
      });
      
      tagsByCategory[category] = Array.from(categoryTags.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    });

    Object.keys(tagsByCategory).forEach(category => {
      const tagCounts = new Map<string, number>();
      
      stakeholders
        .filter(s => s.category.name === category)
        .forEach(stakeholder => {
          stakeholder.allTags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        });
      
      tagsByCategory[category] = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    });

    const tagsByTaskType: Record<string, string[]> = {};
    const taskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
    
    taskTypes.forEach(taskType => {
      const taskTags = new Set<string>();
      stakeholders.forEach(stakeholder => {
        if (stakeholder.tagsByTask[taskType]) {
          stakeholder.tagsByTask[taskType].forEach(tag => taskTags.add(tag));
        }
      });
      tagsByTaskType[taskType] = Array.from(taskTags);
    });

    const tagFrequencyDistribution: Record<string, number> = {};
    stakeholders.forEach(stakeholder => {
      const tagCount = stakeholder.allTags.length;
      const key = tagCount === 0 ? '0' : 
                  tagCount <= 5 ? '1-5' :
                  tagCount <= 10 ? '6-10' : 
                  tagCount <= 15 ? '11-15' : '16+';
      tagFrequencyDistribution[key] = (tagFrequencyDistribution[key] || 0) + 1;
    });

    return {
      totalUniqueTags: tagData.size,
      mostCommonTags,
      tagsByCategory,
      tagsByTaskType,
      tagFrequencyDistribution
    };
  }

  /**
   * Apply client-side filters
   */
  private static applyClientSideFilters(
    stakeholders: IProcessedStakeholder[], 
    filters: IStakeholderReportFilters
  ): IProcessedStakeholder[] {
    let filtered = [...stakeholders];

    // Connection strength filtering
    if (filters.connectionStrength) {
      const { min, max } = filters.connectionStrength;
      filtered = filtered.filter(stakeholder => {
        const avgRating = stakeholder.averageRating;
        return avgRating >= min && avgRating <= max;
      });
    }

    // NEW: Filter for only stakeholders with key insights
    if (filters.onlyKeyInsights) {
      filtered = filtered.filter(stakeholder => stakeholder.hasKeyInsights);
    }

    return filtered;
  }

  /**
   * Generate summary statistics (enhanced with key insights)
   */
  private static generateSummaryStats(stakeholders: IProcessedStakeholder[]) {
    const total = stakeholders.length;
    const completed = stakeholders.filter(s => s.completionStatus === 'completed').length;
    const inProgress = stakeholders.filter(s => s.completionStatus === 'in_progress').length;
    const notStarted = stakeholders.filter(s => s.completionStatus === 'not_started').length;
    
    // Group by category
    const byCategory = stakeholders.reduce((acc, stakeholder) => {
      const category = stakeholder.category.name;
      if (!acc[category]) {
        acc[category] = { total: 0, completed: 0, ratings: [] };
      }
      acc[category].total++;
      if (stakeholder.completionStatus === 'completed') {
        acc[category].completed++;
      }
      if (stakeholder.averageRating > 0) {
        acc[category].ratings.push(stakeholder.averageRating);
      }
      return acc;
    }, {} as Record<string, { total: number; completed: number; ratings: number[] }>);

    const stakeholdersByCategory = Object.keys(byCategory).reduce((acc, category) => {
      const data = byCategory[category];
      acc[category] = {
        total: data.total,
        completed: data.completed,
        averageRating: data.ratings.length > 0 
          ? Math.round((data.ratings.reduce((sum, rating) => sum + rating, 0) / data.ratings.length) * 10) / 10
          : 0
      };
      return acc;
    }, {} as Record<string, { total: number; completed: number; averageRating: number }>);

    const byScope = stakeholders.reduce((acc, stakeholder) => {
      acc[stakeholder.scope]++;
      return acc;
    }, { project: 0, site: 0 });

    const bySite = stakeholders.reduce((acc, stakeholder) => {
      if (stakeholder.projectSite) {
        const siteName = stakeholder.projectSite.name;
        acc[siteName] = (acc[siteName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const taskTypeRatings = stakeholders.reduce((acc, stakeholder) => {
      stakeholder.tasks.forEach(task => {
        if (task.rating !== undefined) {
          if (!acc[task.taskType]) {
            acc[task.taskType] = [];
          }
          acc[task.taskType].push(task.rating);
        }
      });
      return acc;
    }, {} as Record<string, number[]>);

    const averageRatingsByTaskType = Object.keys(taskTypeRatings).reduce((acc, taskType) => {
      const ratings = taskTypeRatings[taskType];
      acc[taskType] = Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;
      return acc;
    }, {} as Record<string, number>);

    const allRatings = stakeholders.filter(s => s.averageRating > 0).map(s => s.averageRating);
    const overallAverageRating = allRatings.length > 0 
      ? Math.round((allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length) * 10) / 10
      : 0;

    // NEW: Calculate key insights summary
    const totalKeyInsights = stakeholders.reduce((sum, s) => sum + s.keyInsightCount, 0);
    const stakeholdersWithKeyInsights = stakeholders.filter(s => s.hasKeyInsights).length;
    const averageKeyInsightsPerStakeholder = stakeholders.length > 0
      ? Math.round((totalKeyInsights / stakeholders.length) * 10) / 10
      : 0;

    return {
      totalStakeholders: total,
      completedStakeholders: completed,
      inProgressStakeholders: inProgress,
      notStartedStakeholders: notStarted,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      stakeholdersByCategory,
      stakeholdersByScope: byScope,
      stakeholdersBySite: bySite,
      averageRatings: {
        overall: overallAverageRating,
        byTaskType: averageRatingsByTaskType
      },
      // NEW: Add key insights summary
      totalKeyInsights,
      stakeholdersWithKeyInsights,
      averageKeyInsightsPerStakeholder
    };
  }

  /**
   * Group stakeholders by category
   */
  private static groupStakeholdersByCategory(stakeholders: IProcessedStakeholder[]) {
    return stakeholders.reduce((acc, stakeholder) => {
      const category = stakeholder.category.name;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(stakeholder);
      return acc;
    }, {} as Record<string, IProcessedStakeholder[]>);
  }

  /**
   * Generate influence matrix
   */
  private static generateInfluenceMatrix(stakeholders: IProcessedStakeholder[]) {
    return stakeholders.map(stakeholder => {
      const ratings = {
        power: this.getTaskRating(stakeholder, 'power'),
        connections: this.getTaskRating(stakeholder, 'connections'),
        risks: this.getTaskRating(stakeholder, 'risks'),
        roles: this.getTaskRating(stakeholder, 'roles'),
        benefits: this.getTaskRating(stakeholder, 'benefits'),
        wellbeing: this.getTaskRating(stakeholder, 'wellbeing')
      };

      const validRatings = Object.values(ratings).filter(rating => rating > 0);
      const averageInfluence = validRatings.length > 0 
        ? Math.round((validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length) * 10) / 10
        : 0;

      return {
        stakeholder,
        ratings,
        averageInfluence
      };
    });
  }

  /**
   * Get task rating for a specific task type
   */
  private static getTaskRating(stakeholder: IProcessedStakeholder, taskType: string): number {
    const task = stakeholder.tasks.find(t => t.taskType === taskType);
    return task?.rating || 0;
  }

  /**
   * Get task responses for a specific task type
   */
  static getTaskResponses(stakeholder: IProcessedStakeholder, taskType: string): string {
    const task = stakeholder.tasks.find(t => t.taskType === taskType);
    if (!task || !task.responses || task.responses.length === 0) {
      return 'Not provided';
    }
    
    return task.responses
      .map(response => response.description || response.optionId)
      .filter(desc => desc && desc.trim() !== '')
      .join(', ') || 'No description provided';
  }

  /**
   * NEW: Get key insight responses for a specific task type
   */
  static getKeyInsightResponses(stakeholder: IProcessedStakeholder, taskType: string): string {
    const task = stakeholder.tasks.find(t => t.taskType === taskType);
    if (!task || !task.responses || task.responses.length === 0) {
      return 'None';
    }
    
    const keyInsights = task.responses
      .filter(response => response.isKeyInsight === true)
      .map(response => response.description || response.optionId)
      .filter(desc => desc && desc.trim() !== '');
    
    return keyInsights.length > 0 ? keyInsights.join(', ') : 'None';
  }

  /**
   * Get available sites with stakeholder counts (enhanced with key insight counts)
   */
  private static getAvailableSites(
    allSites: any[], 
    stakeholders: IProcessedStakeholder[]
  ) {
    return allSites.map(site => {
      const siteStakeholders = stakeholders.filter(s => 
        s.projectSite && s.projectSite._id === site._id.toString()
      );
      
      const keyInsightCount = siteStakeholders.reduce((sum, s) => sum + s.keyInsightCount, 0);
      
      return {
        _id: site._id.toString(),
        name: site.name,
        stakeholderCount: siteStakeholders.length,
        keyInsightCount // NEW: Add key insight count
      };
    });
  }

  /**
   * Generate report with specific site filtering
   */
  static async generateSiteSpecificReport(
    projectId: string,
    siteId: string,
    userId: string
  ) {
    const filters: IStakeholderReportFilters = {
      scope: 'site',
      siteIds: [siteId]
    };
    
    return this.generateReport(projectId, userId, filters);
  }

  /**
   * Generate project-only report
   */
  static async generateProjectOnlyReport(
    projectId: string,
    userId: string
  ) {
    const filters: IStakeholderReportFilters = {
      scope: 'project'
    };
    
    return this.generateReport(projectId, userId, filters);
  }

  /**
   * NEW: Generate key insights only report
   */
  static async generateKeyInsightsReport(
    projectId: string,
    userId: string,
    scope: 'all' | 'project' | 'site' = 'all'
  ) {
    const filters: IStakeholderReportFilters = {
      scope,
      onlyKeyInsights: true
    };
    
    return this.generateReport(projectId, userId, filters);
  }

  /**
   * Get stakeholder completion summary
   */
  static async getCompletionSummary(projectId: string, filters?: IStakeholderReportFilters) {
    try {
      const query = await this.buildStakeholderQuery(projectId, filters || { scope: 'all' });
      const stakeholders = await StakeholderGroup.find(query).select('completionStatus');
      
      const summary = stakeholders.reduce((acc, stakeholder) => {
        acc[stakeholder.completionStatus] = (acc[stakeholder.completionStatus] || 0) + 1;
        return acc;
      }, { completed: 0, in_progress: 0, not_started: 0 } as Record<string, number>);

      const total = stakeholders.length;
      const completionPercentage = total > 0 ? Math.round((summary.completed / total) * 100) : 0;

      return {
        total,
        ...summary,
        completionPercentage
      };

    } catch (error) {
      console.error('Error getting completion summary:', error);
      throw new Error(`Failed to get completion summary: ${error}`);
    }
  }
}

export default StakeholderMappingReportService;