// services/reports/riskRegisterReport.service.ts
import mongoose from "mongoose";
import RiskRegister from "../../models/riskRegister.model";
import Project from "../../models/project.model";
import ProjectSite from "../../models/projectSite.model";
import Organization from "../../models/organization.model";
import User from "../../models/user.model";

// Interface for risk register report filters
interface IRiskReportFilters {
  scope?: 'all' | 'project' | 'site';
  siteIds?: string[];
  status?: string[];
  riskScore?: string[];
  riskType?: string[];
  category?: string[];
  reviewDateFrom?: Date;
  reviewDateTo?: Date;
  ownerIds?: string[];
  includeArchived?: boolean;
  overdueOnly?: boolean;
  limit?: number; // Add limit to prevent massive queries
  skip?: number;  // Add pagination support
}

// Interface for processed risk data
interface IProcessedRiskItem {
  _id: string;
  project: {
    _id: string;
    name: string;
    status?: string;
  };
  projectSite?: {
    _id: string;
    name: string;
    status?: string;
  };
  organization: {
    _id: string;
    name: string;
    country?: string;
    city?: string;
  };
  name: string;
  riskType: string;
  riskDescription: string;
  probability: string;
  consequences: string;
  riskScore: string;
  owner: {
    _id: string;
    name: string;
    email?: string;
  };
  mitigationStrategy: string;
  category: string;
  impactArea: string[];
  identifiedDate: Date;
  reviewDate?: Date;
  status: string;
  mitigationActions: Array<{
    action: string;
    responsible?: {
      _id: string;
      name: string;
      email?: string;
    };
    dueDate?: Date;
    status: string;
    completedAt?: Date;
    notes?: string;
  }>;
  riskHistory: Array<{
    date: Date;
    probability: string;
    consequences: string;
    riskScore: string;
    notes?: string;
    updatedBy?: {
      _id: string;
      name: string;
    };
  }>;
  attachments: Array<{
    filename: string;
    url: string;
    uploadedBy: {
      _id: string;
      name: string;
    };
    uploadedAt: Date;
  }>;
  notes?: string;
  creator: {
    _id: string;
    name: string;
    email?: string;
  };
  lastUpdatedBy?: {
    _id: string;
    name: string;
  };
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isReviewOverdue: boolean;
  daysUntilReview: number | null;
  mitigationProgress: number;
  scope: 'project' | 'site';
}

// Interface for comprehensive risk register report data
interface IRiskRegisterReportData {
  projectInfo: {
    id: string;
    name: string;
    description?: string;
    status: string;
  };
  
  organizationInfo: {
    id: string;
    name: string;
    country?: string;
    city?: string;
  };
  
  reportMetadata: {
    reportingPeriod: Date;
    version: string;
    scope: string;
    totalRisks: number;
    appliedFilters: IRiskReportFilters;
    generatedAt: Date;
    generatedBy: string;
  };
  
  executiveSummary: {
    totalRisks: number;
    risksByScore: {
      high: number;
      medium: number;
      low: number;
    };
    risksByStatus: {
      open: number;
      monitoring: number;
      closed: number;
      transferred: number;
    };
    risksByType: Record<string, number>;
    risksByCategory: Record<string, number>;
    reviewMetrics: {
      reviewOverdue: number;
      dueForReviewSoon: number;
      averageDaysToReview: number;
    };
    mitigationMetrics: {
      averageProgress: number;
      totalActions: number;
      completedActions: number;
    };
    risksByScope: {
      project: number;
      site: number;
    };
    risksBySite: Record<string, number>;
  };
  
  riskDetails: IProcessedRiskItem[];
  
  risksByCategory: Record<string, IProcessedRiskItem[]>;
  risksByType: Record<string, IProcessedRiskItem[]>;
  risksByOwner: Record<string, IProcessedRiskItem[]>;
  
  overdueRisks: IProcessedRiskItem[];
  highPriorityRisks: IProcessedRiskItem[];
  
  availableSites: Array<{
    _id: string;
    name: string;
    riskCount: number;
  }>;
  
  generationMetadata: {
    generatedAt: Date;
    generatedBy: string;
    dataVersion: string;
    totalRecords: number;
    queryExecutionTime: number;
  };
}

export class RiskRegisterReportService {
  /**
   * Generate comprehensive risk register report
   * REFACTORED VERSION - Fixes infinite loop issues
   */
  static async generateReport(
    projectId: string,
    userId: string,
    filters: IRiskReportFilters = { scope: 'all' }
  ): Promise<IRiskRegisterReportData> {
    const startTime = Date.now();
    console.log('='.repeat(80));
    console.log('START: RiskRegisterReportService.generateReport (REFACTORED)');
    console.log('Parameters:', JSON.stringify({ projectId, userId, filters }, null, 2));
    console.log('='.repeat(80));
    
    try {
      // Set default limit to prevent massive queries
      const queryLimit = filters.limit || 1000;
      const querySkip = filters.skip || 0;

      // STEP 1: Fetch project and organization separately (NO POPULATE)
      console.log('\n[STEP 1] Fetching project and organization...');
      const projectStart = Date.now();
      
      const project = await Project.findById(projectId)
        .select('_id name description status organization')
        .lean()
        .maxTimeMS(3000)
        .exec();
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      const organization = await Organization.findById(project.organization)
        .select('_id name country city')
        .lean()
        .maxTimeMS(3000)
        .exec();
      
      if (!organization) {
        throw new Error('Organization not found');
      }
      
      console.log(`[STEP 1] ✓ Completed in ${Date.now() - projectStart}ms`);
      console.log(`[STEP 1] Project: ${project.name}, Org: ${organization.name}`);

      // STEP 2: Build risk query
      console.log('\n[STEP 2] Building risk query...');
      const queryStart = Date.now();
      const riskQuery = this.buildRiskQuery(projectId, filters);
      console.log(`[STEP 2] ✓ Query built in ${Date.now() - queryStart}ms`);

      // STEP 3: Count total risks (for pagination)
      console.log('\n[STEP 3] Counting risks...');
      const countStart = Date.now();
      const totalCount = await RiskRegister.countDocuments(riskQuery)
        .maxTimeMS(3000)
        .exec();
      console.log(`[STEP 3] ✓ Count completed in ${Date.now() - countStart}ms`);
      console.log(`[STEP 3] Total matching risks: ${totalCount}`);

      if (totalCount === 0) {
        console.log('[STEP 3] No risks found, returning empty report');
        return this.createEmptyReport(project, organization, userId, filters, startTime);
      }

      // STEP 4: Fetch risks WITHOUT POPULATE (this is the key fix)
      console.log('\n[STEP 4] Fetching risks WITHOUT populate...');
      const fetchStart = Date.now();
      
      const risks = await RiskRegister.find(riskQuery)
        .select('-__v') // Exclude version key
        .sort({ riskScore: -1, identifiedDate: -1 })
        .limit(queryLimit)
        .skip(querySkip)
        .lean()
        .maxTimeMS(5000)
        .exec();
      
      console.log(`[STEP 4] ✓ Risks fetched in ${Date.now() - fetchStart}ms`);
      console.log(`[STEP 4] Retrieved ${risks.length} risks`);

      // STEP 5: Extract all unique IDs for batch fetching
      console.log('\n[STEP 5] Extracting unique IDs...');
      const extractStart = Date.now();
      
      const userIds = new Set<string>();
      const siteIds = new Set<string>();
      
      risks.forEach((risk: any) => {
        if (risk.owner) userIds.add(risk.owner.toString());
        if (risk.creator) userIds.add(risk.creator.toString());
        if (risk.lastUpdatedBy) userIds.add(risk.lastUpdatedBy.toString());
        if (risk.projectSite) siteIds.add(risk.projectSite.toString());
        
        // Extract users from mitigation actions
        risk.mitigationActions?.forEach((action: any) => {
          if (action.responsible) userIds.add(action.responsible.toString());
        });
        
        // Extract users from risk history
        risk.riskHistory?.forEach((history: any) => {
          if (history.updatedBy) userIds.add(history.updatedBy.toString());
        });
        
        // Extract users from attachments
        risk.attachments?.forEach((attachment: any) => {
          if (attachment.uploadedBy) userIds.add(attachment.uploadedBy.toString());
        });
      });
      
      console.log(`[STEP 5] ✓ Extraction completed in ${Date.now() - extractStart}ms`);
      console.log(`[STEP 5] Found ${userIds.size} unique users, ${siteIds.size} unique sites`);

      // STEP 6: Batch fetch users and sites in parallel
      console.log('\n[STEP 6] Batch fetching related data...');
      const batchStart = Date.now();
      
      const [users, sites] = await Promise.all([
        User.find({ _id: { $in: Array.from(userIds) } })
          .select('_id name email')
          .lean()
          .maxTimeMS(3000)
          .exec(),
        siteIds.size > 0
          ? ProjectSite.find({ _id: { $in: Array.from(siteIds) } })
              .select('_id name status')
              .lean()
              .maxTimeMS(3000)
              .exec()
          : Promise.resolve([])
      ]);
      
      // Create lookup maps for O(1) access
      const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
      const siteMap = new Map(sites.map((s: any) => [s._id.toString(), s]));
      
      console.log(`[STEP 6] ✓ Batch fetch completed in ${Date.now() - batchStart}ms`);
      console.log(`[STEP 6] Fetched ${users.length} users, ${sites.length} sites`);

      // STEP 7: Fetch all project sites for availability list
      console.log('\n[STEP 7] Fetching all project sites...');
      const allSitesStart = Date.now();
      
      const allSites = await ProjectSite.find({ 
        project: projectId, 
        archived: { $ne: true } 
      })
        .select('_id name')
        .lean()
        .maxTimeMS(3000)
        .exec();
      
      console.log(`[STEP 7] ✓ Sites fetched in ${Date.now() - allSitesStart}ms`);
      console.log(`[STEP 7] Found ${allSites.length} total sites`);

      // STEP 8: Process risks with manual "population" using maps
      console.log('\n[STEP 8] Processing risks with manual population...');
      const processStart = Date.now();
      
      const processedRisks = risks.map((risk: any) => 
        this.processRiskDataWithMaps(risk, userMap, siteMap, project, organization)
      );
      
      console.log(`[STEP 8] ✓ Processing completed in ${Date.now() - processStart}ms`);

      // STEP 9: Apply additional client-side filters
      console.log('\n[STEP 9] Applying client-side filters...');
      const filterStart = Date.now();
      const filteredRisks = this.applyClientSideFilters(processedRisks, filters);
      console.log(`[STEP 9] ✓ Filtering completed in ${Date.now() - filterStart}ms`);
      console.log(`[STEP 9] ${filteredRisks.length} risks after filtering`);

      // STEP 10: Generate summary and groupings
      console.log('\n[STEP 10] Generating analytics...');
      const analyticsStart = Date.now();
      
      const executiveSummary = this.generateExecutiveSummary(filteredRisks);
      const risksByCategory = this.groupRisksByCategory(filteredRisks);
      const risksByType = this.groupRisksByType(filteredRisks);
      const risksByOwner = this.groupRisksByOwner(filteredRisks);
      const overdueRisks = this.getOverdueRisks(filteredRisks);
      const highPriorityRisks = this.getHighPriorityRisks(filteredRisks);
      const availableSites = this.getAvailableSites(allSites, processedRisks);
      
      console.log(`[STEP 10] ✓ Analytics completed in ${Date.now() - analyticsStart}ms`);

      // STEP 11: Build final report
      console.log('\n[STEP 11] Building final report...');
      const totalExecutionTime = Date.now() - startTime;
      
      const reportData: IRiskRegisterReportData = {
        projectInfo: {
          id: project._id.toString(),
          name: project.name,
          description: project.description,
          status: project.status
        },
        organizationInfo: {
          id: organization._id.toString(),
          name: organization.name,
          country: organization.country,
          city: organization.city
        },
        reportMetadata: {
          reportingPeriod: new Date(),
          version: 'V1.0',
          scope: filters.scope || 'all',
          totalRisks: filteredRisks.length,
          appliedFilters: filters,
          generatedAt: new Date(),
          generatedBy: userId
        },
        executiveSummary,
        riskDetails: filteredRisks,
        risksByCategory,
        risksByType,
        risksByOwner,
        overdueRisks,
        highPriorityRisks,
        availableSites,
        generationMetadata: {
          generatedAt: new Date(),
          generatedBy: userId,
          dataVersion: '1.0',
          totalRecords: filteredRisks.length,
          queryExecutionTime: totalExecutionTime
        }
      };

      console.log('\n' + '='.repeat(80));
      console.log('SUCCESS: Report generated');
      console.log(`Total execution time: ${totalExecutionTime}ms`);
      console.log(`Total risks: ${reportData.executiveSummary.totalRisks}`);
      console.log('='.repeat(80) + '\n');

      return reportData;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('\n' + '!'.repeat(80));
      console.error('ERROR in generateReport:');
      console.error('Execution time before error:', executionTime, 'ms');
      console.error('Message:', error instanceof Error ? error.message : 'Unknown');
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('!'.repeat(80) + '\n');
      throw error;
    }
  }

  /**
   * Build MongoDB query based on filters (SIMPLIFIED)
   */
  private static buildRiskQuery(projectId: string, filters: IRiskReportFilters) {
    const query: any = {
      project: new mongoose.Types.ObjectId(projectId),
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

    // Status filtering
    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }

    // Risk score filtering
    if (filters.riskScore && filters.riskScore.length > 0) {
      query.riskScore = { $in: filters.riskScore };
    }

    // Risk type filtering
    if (filters.riskType && filters.riskType.length > 0) {
      query.riskType = { $in: filters.riskType };
    }

    // Category filtering
    if (filters.category && filters.category.length > 0) {
      query.category = { $in: filters.category };
    }

    // Owner filtering
    if (filters.ownerIds && filters.ownerIds.length > 0) {
      query.owner = { $in: filters.ownerIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // Review date filtering
    if (filters.reviewDateFrom || filters.reviewDateTo) {
      query.reviewDate = {};
      if (filters.reviewDateFrom) {
        query.reviewDate.$gte = filters.reviewDateFrom;
      }
      if (filters.reviewDateTo) {
        query.reviewDate.$lte = filters.reviewDateTo;
      }
    }

    // Overdue only filtering
    if (filters.overdueOnly) {
      query.reviewDate = { $lt: new Date() };
      query.status = { $in: ['open', 'monitoring'] };
    }

    return query;
  }

  /**
   * Process risk data with manual population using maps (KEY FIX)
   */
  private static processRiskDataWithMaps(
    risk: any,
    userMap: Map<string, any>,
    siteMap: Map<string, any>,
    project: any,
    organization: any
  ): IProcessedRiskItem {
    const now = new Date();
    
    // Calculate days until review
    let daysUntilReview: number | null = null;
    let isReviewOverdue = false;
    
    if (risk.reviewDate) {
      const reviewDate = new Date(risk.reviewDate);
      const diffTime = reviewDate.getTime() - now.getTime();
      daysUntilReview = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isReviewOverdue = reviewDate < now && ['open', 'monitoring'].includes(risk.status);
    }

    // Calculate mitigation progress
    const totalActions = risk.mitigationActions?.length || 0;
    const completedActions = risk.mitigationActions?.filter(
      (action: any) => action.status === 'completed'
    ).length || 0;
    const mitigationProgress = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

    // Helper function to get user safely
    const getUser = (userId: any) => {
      if (!userId) return undefined;
      const id = userId.toString();
      const user = userMap.get(id);
      return user ? {
        _id: user._id.toString(),
        name: user.name,
        email: user.email
      } : {
        _id: id,
        name: 'Unknown User',
        email: ''
      };
    };

    // Get site if exists
    const projectSite = risk.projectSite ? siteMap.get(risk.projectSite.toString()) : undefined;

    return {
      _id: risk._id.toString(),
      project: {
        _id: project._id.toString(),
        name: project.name,
        status: project.status
      },
      projectSite: projectSite ? {
        _id: projectSite._id.toString(),
        name: projectSite.name,
        status: projectSite.status
      } : undefined,
      organization: {
        _id: organization._id.toString(),
        name: organization.name,
        country: organization.country,
        city: organization.city
      },
      name: risk.name,
      riskType: risk.riskType,
      riskDescription: risk.riskDescription,
      probability: risk.probability,
      consequences: risk.consequences,
      riskScore: risk.riskScore,
      owner: getUser(risk.owner)!,
      mitigationStrategy: risk.mitigationStrategy,
      category: risk.category,
      impactArea: risk.impactArea || [],
      identifiedDate: risk.identifiedDate,
      reviewDate: risk.reviewDate,
      status: risk.status,
      mitigationActions: (risk.mitigationActions || []).map((action: any) => ({
        action: action.action,
        responsible: getUser(action.responsible),
        dueDate: action.dueDate,
        status: action.status,
        completedAt: action.completedAt,
        notes: action.notes
      })),
      riskHistory: (risk.riskHistory || []).map((history: any) => ({
        date: history.date,
        probability: history.probability,
        consequences: history.consequences,
        riskScore: history.riskScore,
        notes: history.notes,
        updatedBy: history.updatedBy ? {
          _id: getUser(history.updatedBy)?._id || '',
          name: getUser(history.updatedBy)?.name || 'Unknown'
        } : undefined
      })),
      attachments: (risk.attachments || []).map((attachment: any) => ({
        filename: attachment.filename,
        url: attachment.url,
        uploadedBy: {
          _id: getUser(attachment.uploadedBy)?._id || '',
          name: getUser(attachment.uploadedBy)?.name || 'Unknown'
        },
        uploadedAt: attachment.uploadedAt
      })),
      notes: risk.notes,
      creator: getUser(risk.creator)!,
      lastUpdatedBy: risk.lastUpdatedBy ? {
        _id: getUser(risk.lastUpdatedBy)?._id || '',
        name: getUser(risk.lastUpdatedBy)?.name || 'Unknown'
      } : undefined,
      archived: risk.archived || false,
      archivedAt: risk.archivedAt,
      createdAt: risk.createdAt,
      updatedAt: risk.updatedAt,
      isReviewOverdue,
      daysUntilReview,
      mitigationProgress,
      scope: risk.projectSite ? 'site' : 'project'
    };
  }

  /**
   * Apply client-side filters
   */
  private static applyClientSideFilters(
    risks: IProcessedRiskItem[], 
    filters: IRiskReportFilters
  ): IProcessedRiskItem[] {
    // Currently all filtering is in MongoDB query
    // Add any additional filtering logic here if needed
    return risks;
  }

  /**
   * Generate executive summary statistics
   */
  private static generateExecutiveSummary(risks: IProcessedRiskItem[]) {
    const total = risks.length;
    
    const risksByScore = risks.reduce((acc, risk) => {
      const score = risk.riskScore as keyof typeof acc;
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, { high: 0, medium: 0, low: 0 });

    const risksByStatus = risks.reduce((acc, risk) => {
      const status = risk.status as keyof typeof acc;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { open: 0, monitoring: 0, closed: 0, transferred: 0 });

    const risksByType = risks.reduce((acc, risk) => {
      acc[risk.riskType] = (acc[risk.riskType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const risksByCategory = risks.reduce((acc, risk) => {
      acc[risk.category] = (acc[risk.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const risksByScope = risks.reduce((acc, risk) => {
      acc[risk.scope] = (acc[risk.scope] || 0) + 1;
      return acc;
    }, { project: 0, site: 0 });

    const risksBySite = risks.reduce((acc, risk) => {
      if (risk.projectSite) {
        const siteName = risk.projectSite.name;
        acc[siteName] = (acc[siteName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const reviewOverdue = risks.filter(risk => risk.isReviewOverdue).length;
    const dueForReviewSoon = risks.filter(risk => 
      risk.daysUntilReview !== null && risk.daysUntilReview >= 0 && risk.daysUntilReview <= 7
    ).length;
    
    const risksWithReviewDates = risks.filter(risk => risk.daysUntilReview !== null);
    const averageDaysToReview = risksWithReviewDates.length > 0 
      ? Math.round(risksWithReviewDates.reduce((sum, risk) => sum + (risk.daysUntilReview || 0), 0) / risksWithReviewDates.length)
      : 0;

    const totalActions = risks.reduce((sum, risk) => sum + risk.mitigationActions.length, 0);
    const completedActions = risks.reduce((sum, risk) => 
      sum + risk.mitigationActions.filter(action => action.status === 'completed').length, 0
    );
    const averageProgress = risks.length > 0 
      ? Math.round(risks.reduce((sum, risk) => sum + risk.mitigationProgress, 0) / risks.length)
      : 0;

    return {
      totalRisks: total,
      risksByScore,
      risksByStatus,
      risksByType,
      risksByCategory,
      reviewMetrics: {
        reviewOverdue,
        dueForReviewSoon,
        averageDaysToReview
      },
      mitigationMetrics: {
        averageProgress,
        totalActions,
        completedActions
      },
      risksByScope,
      risksBySite
    };
  }

  /**
   * Group risks by category
   */
  private static groupRisksByCategory(risks: IProcessedRiskItem[]) {
    return risks.reduce((acc, risk) => {
      if (!acc[risk.category]) {
        acc[risk.category] = [];
      }
      acc[risk.category].push(risk);
      return acc;
    }, {} as Record<string, IProcessedRiskItem[]>);
  }

  /**
   * Group risks by type
   */
  private static groupRisksByType(risks: IProcessedRiskItem[]) {
    return risks.reduce((acc, risk) => {
      if (!acc[risk.riskType]) {
        acc[risk.riskType] = [];
      }
      acc[risk.riskType].push(risk);
      return acc;
    }, {} as Record<string, IProcessedRiskItem[]>);
  }

  /**
   * Group risks by owner
   */
  private static groupRisksByOwner(risks: IProcessedRiskItem[]) {
    return risks.reduce((acc, risk) => {
      const ownerName = risk.owner.name;
      if (!acc[ownerName]) {
        acc[ownerName] = [];
      }
      acc[ownerName].push(risk);
      return acc;
    }, {} as Record<string, IProcessedRiskItem[]>);
  }

  /**
   * Get overdue risks
   */
  private static getOverdueRisks(risks: IProcessedRiskItem[]): IProcessedRiskItem[] {
    return risks
      .filter(risk => risk.isReviewOverdue)
      .sort((a, b) => {
        if (!a.reviewDate || !b.reviewDate) return 0;
        return new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime();
      });
  }

  /**
   * Get high priority risks
   */
  private static getHighPriorityRisks(risks: IProcessedRiskItem[]): IProcessedRiskItem[] {
    return risks
      .filter(risk => 
        risk.riskScore === 'high' || 
        risk.status=== 'open' || 
        risk.isReviewOverdue
      )
      .sort((a, b) => {
        const scoreOrder = { high: 3, medium: 2, low: 1 };
        const scoreA = scoreOrder[a.riskScore as keyof typeof scoreOrder] || 0;
        const scoreB = scoreOrder[b.riskScore as keyof typeof scoreOrder] || 0;
        
        if (scoreA !== scoreB) return scoreB - scoreA;
        if (a.isReviewOverdue && !b.isReviewOverdue) return -1;
        if (!a.isReviewOverdue && b.isReviewOverdue) return 1;
        
        return 0;
      });
  }

  /**
   * Get available sites with risk counts
   */
  private static getAvailableSites(
    allSites: any[], 
    risks: IProcessedRiskItem[]
  ) {
    return allSites.map(site => ({
      _id: site._id.toString(),
      name: site.name,
      riskCount: risks.filter(risk => 
        risk.projectSite && risk.projectSite._id === site._id.toString()
      ).length
    }));
  }

  /**
   * Create empty report when no risks found
   */
  private static createEmptyReport(
    project: any,
    organization: any,
    userId: string,
    filters: IRiskReportFilters,
    startTime: number
  ): IRiskRegisterReportData {
    return {
      projectInfo: {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        status: project.status
      },
      organizationInfo: {
        id: organization._id.toString(),
        name: organization.name,
        country: organization.country,
        city: organization.city
      },
      reportMetadata: {
        reportingPeriod: new Date(),
        version: 'V1.0',
        scope: filters.scope || 'all',
        totalRisks: 0,
        appliedFilters: filters,
        generatedAt: new Date(),
        generatedBy: userId
      },
      executiveSummary: {
        totalRisks: 0,
        risksByScore: { high: 0, medium: 0, low: 0 },
        risksByStatus: { open: 0, monitoring: 0, closed: 0, transferred: 0 },
        risksByType: {},
        risksByCategory: {},
        reviewMetrics: {
          reviewOverdue: 0,
          dueForReviewSoon: 0,
          averageDaysToReview: 0
        },
        mitigationMetrics: {
          averageProgress: 0,
          totalActions: 0,
          completedActions: 0
        },
        risksByScope: { project: 0, site: 0 },
        risksBySite: {}
      },
      riskDetails: [],
      risksByCategory: {},
      risksByType: {},
      risksByOwner: {},
      overdueRisks: [],
      highPriorityRisks: [],
      availableSites: [],
      generationMetadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        dataVersion: '1.0',
        totalRecords: 0,
        queryExecutionTime: Date.now() - startTime
      }
    };
  }

  /**
   * Generate report with specific site filtering
   */
  static async generateSiteSpecificReport(
    projectId: string,
    siteId: string,
    userId: string,
    filters?: Partial<IRiskReportFilters>
  ) {
    const reportFilters: IRiskReportFilters = {
      scope: 'site',
      siteIds: [siteId],
      ...filters
    };
    
    return this.generateReport(projectId, userId, reportFilters);
  }

  /**
   * Generate project-only report
   */
  static async generateProjectOnlyReport(
    projectId: string,
    userId: string,
    filters?: Partial<IRiskReportFilters>
  ) {
    const reportFilters: IRiskReportFilters = {
      scope: 'project',
      ...filters
    };
    
    return this.generateReport(projectId, userId, reportFilters);
  }

  /**
   * Generate overdue risks report
   */
  static async generateOverdueRisksReport(
    projectId: string,
    userId: string
  ) {
    const filters: IRiskReportFilters = {
      scope: 'all',
      overdueOnly: true
    };
    
    return this.generateReport(projectId, userId, filters);
  }

  /**
   * Get risk summary statistics (lightweight version)
   */
  static async getRiskSummary(projectId: string, filters?: IRiskReportFilters) {
    try {
      const query = this.buildRiskQuery(projectId, filters || { scope: 'all' });
      
      // Use aggregation for better performance
      const summary = await RiskRegister.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRisks: { $sum: 1 },
            highRisks: {
              $sum: { $cond: [{ $eq: ['$riskScore', 'high'] }, 1, 0] }
            },
            mediumRisks: {
              $sum: { $cond: [{ $eq: ['$riskScore', 'medium'] }, 1, 0] }
            },
            lowRisks: {
              $sum: { $cond: [{ $eq: ['$riskScore', 'low'] }, 1, 0] }
            },
            openRisks: {
              $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
            }
          }
        }
      ])
      .option({ maxTimeMS: 3000 })
      .exec();

      return summary[0] || {
        totalRisks: 0,
        highRisks: 0,
        mediumRisks: 0,
        lowRisks: 0,
        openRisks: 0
      };

    } catch (error) {
      console.error('Error getting risk summary:', error);
      throw new Error(`Failed to get risk summary: ${error}`);
    }
  }
}

export default RiskRegisterReportService;