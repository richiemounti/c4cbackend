// controllers/dashboardDetails.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import ProjectSetup from "../models/projectSetupTask.model";
import ProjectSiteSetup from "../models/projectSiteSetupTask.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
import TOCConsultationPlan from "../models/tocConsultationPlan.model";
import Review from "../models/review.model";
import RiskRegister from "../models/riskRegister.model";
import { CustomError } from "../middlewares/error.middleware";

function isUserAuthenticated(req: Request): req is Request & { 
  user: { 
    _id: mongoose.Types.ObjectId; 
    isConnectGoStaff?: boolean; 
  } 
} {
  return req.user !== undefined;
}

/**
 * Get comprehensive project details for dashboard
 * @route GET /api/v1/admin/dashboard/project/:projectId/detail
 * @access Private (Admin only)
 */
export const getProjectDetailForDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { projectId } = req.params;

    // Get project with all related data
    const [
      project,
      projectSetup,
      sites,
      tocStages,
      stakeholderGroups,
      reviews,
      risks
    ] = await Promise.all([
      Project.findById(projectId).populate(['organization', 'creator']),
      ProjectSetup.findOne({ project: projectId }),
      ProjectSite.find({ project: projectId, archived: { $ne: true } }),
      TheoryOfChangeStage.find({ project: projectId, projectSite: null }).sort('stageNumber'),
      StakeholderGroup.find({ project: projectId, projectSite: null }).populate('category'),
      Review.find({ project: projectId }).sort('-createdAt').limit(10),
      RiskRegister.find({ project: projectId, archived: { $ne: true } }).sort('-createdAt').limit(10)
    ]);

    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Get site details with their setups
    const siteDetails = await Promise.all(
      sites.map(async (site: any) => {
        const [siteSetup, siteStakeholders, siteConsultationPlan] = await Promise.all([
          ProjectSiteSetup.findOne({ projectSite: site._id }),
          StakeholderGroup.find({ projectSite: site._id }).populate('category'),
          TOCConsultationPlan.findOne({ projectSite: site._id })
        ]);

        // Calculate consultation plan progress with virtual field access
        let consultationProgress = 0;
        let consultationComplete = false;
        
        if (siteConsultationPlan) {
          // Access virtual field safely
          const planDoc = siteConsultationPlan as any;
          consultationProgress = planDoc.completionPercentage || 0;
          consultationComplete = siteConsultationPlan.isCompleted;
        }

        return {
          _id: site._id,
          name: site.name,
          description: site.description,
          location: `${site.city || ''}, ${site.country || ''}`.trim().replace(/^,\s*/, ''),
          status: site.status,
          siteType: site.siteType,
          size: site.size,
          sizeUnit: site.sizeUnit,
          setupProgress: siteSetup?.progress || 0,
          setupComplete: siteSetup?.isComplete || false,
          stakeholderCount: siteStakeholders.length,
          completedStakeholders: siteStakeholders.filter((s: any) => s.completionStatus === 'completed').length,
          consultationPlanComplete: consultationComplete,
          consultationPlanProgress: consultationProgress,
          lastActivity: site.updatedAt
        };
      })
    );

    // Calculate overall project progress
    const setupProgress = projectSetup ? projectSetup.progress : 0;
    const sitesProgress = siteDetails.length > 0 ? 
      siteDetails.reduce((sum: number, site: any) => sum + site.setupProgress, 0) / siteDetails.length : 0;
    const tocProgress = tocStages.length > 0 ? 
      tocStages.reduce((sum: number, stage: any) => sum + stage.progress, 0) / tocStages.length : 0;
    
    const overallProgress = Math.round((setupProgress * 0.3) + (sitesProgress * 0.4) + (tocProgress * 0.3));

    // Determine project stage
    let projectStage = 'onboarding';
    if (projectSetup?.isComplete) {
      if (tocStages.length > 0) {
        if (project.status === 'active') {
          projectStage = 'measure';
        } else if (project.status === 'completed') {
          projectStage = 'learn';
        } else {
          projectStage = 'design';
        }
      } else {
        projectStage = 'design';
      }
    }

    const projectDetail = {
      // Basic project info
      _id: project._id,
      name: project.name,
      description: project.description,
      location: project.location,
      status: project.status,
      stage: projectStage,
      startDate: project.startDate,
      endDate: project.endDate,
      progress: overallProgress,
      
      // Organization info
      organization: {
        _id: (project.organization as any)._id,
        name: (project.organization as any).name,
        country: (project.organization as any).country,
        city: (project.organization as any).city
      },
      
      // Setup info
      setup: {
        progress: setupProgress,
        isComplete: projectSetup?.isComplete || false,
        completedTasks: projectSetup?.tasks.filter((t: any) => t.isCompleted).length || 0,
        totalTasks: projectSetup?.tasks.filter((t: any) => t.isRequired).length || 0,
        lastUpdated: projectSetup?.updatedAt
      },
      
      // Sites summary
      sites: {
        total: siteDetails.length,
        summary: siteDetails,
        averageProgress: sitesProgress
      },
      
      // Theory of Change
      theoryOfChange: {
        stages: tocStages.map((stage: any) => ({
          _id: stage._id,
          stageNumber: stage.stageNumber,
          status: stage.status,
          progress: stage.progress,
          completedAt: stage.completedAt
        })),
        averageProgress: tocProgress
      },
      
      // Stakeholder mapping (project level)
      stakeholderMapping: {
        total: stakeholderGroups.length,
        completed: stakeholderGroups.filter((s: any) => s.completionStatus === 'completed').length,
        inProgress: stakeholderGroups.filter((s: any) => s.completionStatus === 'in_progress').length,
        notStarted: stakeholderGroups.filter((s: any) => s.completionStatus === 'not_started').length
      },
      
      // Recent reviews
      recentReviews: reviews.map((review: any) => ({
        _id: review._id,
        title: review.title,
        status: review.status,
        priority: review.priority,
        progress: review.progress,
        dueDate: review.dueDate,
        isOverdue: review.dueDate && review.dueDate < new Date(),
        createdAt: review.createdAt
      })),
      
      // Risk summary
      risks: {
        total: risks.length,
        high: risks.filter((r: any) => r.riskScore === 'high').length,
        medium: risks.filter((r: any) => r.riskScore === 'medium').length,
        low: risks.filter((r: any) => r.riskScore === 'low').length,
        recent: risks.slice(0, 5).map((risk: any) => ({
          _id: risk._id,
          name: risk.name,
          riskType: risk.riskType,
          riskScore: risk.riskScore,
          status: risk.status,
          owner: risk.owner,
          createdAt: risk.createdAt
        }))
      },
      
      // Metadata
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      creator: (project.creator as any)?.name || 'Unknown'
    };

    res.status(200).json({
      success: true,
      data: projectDetail
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get comprehensive project site details for dashboard
 * @route GET /api/v1/admin/dashboard/project-site/:siteId/detail
 * @access Private (Admin only)
 */
export const getProjectSiteDetailForDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { siteId } = req.params;

    // Get site with all related data
    const [
      site,
      siteSetup,
      consultationPlan,
      tocStages,
      stakeholderGroups,
      reviews,
      risks
    ] = await Promise.all([
      ProjectSite.findById(siteId).populate('project'),
      ProjectSiteSetup.findOne({ projectSite: siteId }),
      TOCConsultationPlan.findOne({ projectSite: siteId }),
      TheoryOfChangeStage.find({ projectSite: siteId }).sort('stageNumber'),
      StakeholderGroup.find({ projectSite: siteId }).populate('category'),
      Review.find({ projectSite: siteId }).sort('-createdAt').limit(10),
      RiskRegister.find({ projectSite: siteId, archived: { $ne: true } }).sort('-createdAt').limit(10)
    ]);

    if (!site) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Calculate consultation progress safely
    let consultationProgress = 0;
    if (consultationPlan) {
      const planDoc = consultationPlan as any;
      consultationProgress = planDoc.completionPercentage || 0;
    }

    // Calculate overall site progress
    const setupProgress = siteSetup ? siteSetup.progress : 0;
    const stakeholderProgress = stakeholderGroups.length > 0 ? 
      (stakeholderGroups.filter((s: any) => s.completionStatus === 'completed').length / stakeholderGroups.length) * 100 : 0;
    const tocProgress = tocStages.length > 0 ? 
      tocStages.reduce((sum: number, stage: any) => sum + stage.progress, 0) / tocStages.length : 0;
    
    const overallProgress = Math.round(
      (setupProgress * 0.25) + 
      (consultationProgress * 0.25) + 
      (stakeholderProgress * 0.25) + 
      (tocProgress * 0.25)
    );

    // Determine site stage
    let siteStage = 'onboarding';
    if (siteSetup?.isComplete) {
      if (consultationPlan?.isCompleted) {
        if (tocStages.length > 0) {
          if (site.status === 'active') {
            siteStage = 'measure';
          } else {
            siteStage = 'design';
          }
        } else {
          siteStage = 'design';
        }
      } else {
        siteStage = 'design';
      }
    }

    // Build stakeholder breakdown by category
    const stakeholderByCategory = stakeholderGroups.reduce((acc: Record<string, any>, sg: any) => {
      const categoryName = sg.category?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = { total: 0, completed: 0 };
      }
      acc[categoryName].total++;
      if (sg.completionStatus === 'completed') {
        acc[categoryName].completed++;
      }
      return acc;
    }, {});

    const siteDetail = {
      // Basic site info
      _id: site._id,
      name: site.name,
      description: site.description,
      address: site.address,
      region: site.region,
      city: site.city,
      country: site.country,
      coordinates: site.coordinates,
      size: site.size,
      sizeUnit: site.sizeUnit,
      siteType: site.siteType,
      status: site.status,
      stage: siteStage,
      progress: overallProgress,
      
      // Project reference
      project: {
        _id: (site.project as any)._id,
        name: (site.project as any).name,
        status: (site.project as any).status
      },
      
      // Site setup
      setup: {
        progress: setupProgress,
        isComplete: siteSetup?.isComplete || false,
        completedTasks: siteSetup?.tasks.filter((t: any) => t.isCompleted).length || 0,
        totalTasks: siteSetup?.tasks.filter((t: any) => t.isRequired).length || 0,
        lastUpdated: siteSetup?.updatedAt
      },
      
      // Consultation plan
      consultation: {
        isComplete: consultationPlan?.isCompleted || false,
        progress: consultationProgress,
        selectedStakeholders: (consultationPlan as any)?.selectedStakeholderCount || 0,
        status: consultationPlan?.status || 'not_started',
        lastUpdated: consultationPlan?.updatedAt
      },
      
      // Stakeholder mapping
      stakeholderMapping: {
        total: stakeholderGroups.length,
        completed: stakeholderGroups.filter((s: any) => s.completionStatus === 'completed').length,
        inProgress: stakeholderGroups.filter((s: any) => s.completionStatus === 'in_progress').length,
        notStarted: stakeholderGroups.filter((s: any) => s.completionStatus === 'not_started').length,
        progress: stakeholderProgress,
        byCategory: stakeholderByCategory
      },
      
      // Theory of Change stages
      theoryOfChange: {
        stages: tocStages.map((stage: any) => ({
          _id: stage._id,
          stageNumber: stage.stageNumber,
          status: stage.status,
          progress: stage.progress,
          completedAt: stage.completedAt
        })),
        averageProgress: tocProgress
      },
      
      // Recent reviews
      recentReviews: reviews.map((review: any) => ({
        _id: review._id,
        title: review.title,
        status: review.status,
        priority: review.priority,
        progress: review.progress,
        dueDate: review.dueDate,
        isOverdue: review.dueDate && review.dueDate < new Date(),
        createdAt: review.createdAt
      })),
      
      // Risk summary
      risks: {
        total: risks.length,
        high: risks.filter((r: any) => r.riskScore === 'high').length,
        medium: risks.filter((r: any) => r.riskScore === 'medium').length,
        low: risks.filter((r: any) => r.riskScore === 'low').length,
        recent: risks.slice(0, 5).map((risk: any) => ({
          _id: risk._id,
          name: risk.name,
          riskType: risk.riskType,
          riskScore: risk.riskScore,
          status: risk.status,
          owner: risk.owner,
          createdAt: risk.createdAt
        }))
      },
      
      // Site contacts
      contacts: site.contacts,
      
      // Metadata
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
      creator: site.creator
    };

    res.status(200).json({
      success: true,
      data: siteDetail
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get project setup tasks with completion status
 * @route GET /api/v1/admin/dashboard/project/:projectId/setup-tasks
 * @access Private (Admin only)
 */
export const getProjectSetupTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { projectId } = req.params;

    const [project, projectSetup] = await Promise.all([
      Project.findById(projectId),
      ProjectSetup.findOne({ project: projectId })
    ]);

    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!projectSetup) {
      return res.status(200).json({
        success: true,
        data: {
          project: { _id: project._id, name: project.name },
          setup: null,
          tasks: [],
          progress: 0,
          isComplete: false
        }
      });
    }

    // Group tasks by step
    const tasksByStep = projectSetup.tasks.reduce((acc: Record<string, any[]>, task: any) => {
      const stepKey = task.step.toString();
      if (!acc[stepKey]) {
        acc[stepKey] = [];
      }
      acc[stepKey].push({
        _id: task._id,
        fieldName: task.fieldName,
        fieldLabel: task.fieldLabel,
        description: task.description,
        userFacingCopy: task.userFacingCopy,
        dataType: task.dataType,
        options: task.options,
        helperText: task.helperText,
        hoverText: task.hoverText,
        isRequired: task.isRequired,
        isCompleted: task.isCompleted,
        completedAt: task.completedAt,
        completedBy: task.completedBy,
        responseData: task.responseData,
        sortOrder: task.sortOrder
      });
      return acc;
    }, {});

    // Sort tasks within each step
    Object.keys(tasksByStep).forEach((step: string) => {
      tasksByStep[step].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    });

    res.status(200).json({
      success: true,
      data: {
        project: {
          _id: project._id,
          name: project.name,
          status: project.status
        },
        setup: {
          _id: projectSetup._id,
          progress: projectSetup.progress,
          isComplete: projectSetup.isComplete,
          completedAt: projectSetup.completedAt,
          lastUpdatedBy: projectSetup.lastUpdatedBy
        },
        tasksByStep,
        summary: {
          totalTasks: projectSetup.tasks.length,
          completedTasks: projectSetup.tasks.filter((t: any) => t.isCompleted).length,
          requiredTasks: projectSetup.tasks.filter((t: any) => t.isRequired).length,
          completedRequiredTasks: projectSetup.tasks.filter((t: any) => t.isRequired && t.isCompleted).length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get project site setup tasks with completion status
 * @route GET /api/v1/admin/dashboard/project-site/:siteId/setup-tasks
 * @access Private (Admin only)
 */
export const getSiteSetupTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { siteId } = req.params;

    const [site, siteSetup] = await Promise.all([
      ProjectSite.findById(siteId).populate('project', 'name status'),
      ProjectSiteSetup.findOne({ projectSite: siteId })
    ]);

    if (!site) {
      const error = new Error('Project site not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!siteSetup) {
      return res.status(200).json({
        success: true,
        data: {
          site: { _id: site._id, name: site.name },
          project: site.project,
          setup: null,
          tasks: [],
          progress: 0,
          isComplete: false
        }
      });
    }

    // Group tasks by step
    const tasksByStep = siteSetup.tasks.reduce((acc: Record<string, any[]>, task: any) => {
      const stepKey = task.step.toString();
      if (!acc[stepKey]) {
        acc[stepKey] = [];
      }
      acc[stepKey].push({
        _id: task._id,
        fieldName: task.fieldName,
        fieldLabel: task.fieldLabel,
        description: task.description,
        userFacingCopy: task.userFacingCopy,
        dataType: task.dataType,
        options: task.options,
        helperText: task.helperText,
        hoverText: task.hoverText,
        isRequired: task.isRequired,
        isCompleted: task.isCompleted,
        completedAt: task.completedAt,
        completedBy: task.completedBy,
        responseData: task.responseData,
        sortOrder: task.sortOrder
      });
      return acc;
    }, {});

    // Sort tasks within each step
    Object.keys(tasksByStep).forEach((step: string) => {
      tasksByStep[step].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    });

    res.status(200).json({
      success: true,
      data: {
        site: {
          _id: site._id,
          name: site.name,
          status: site.status
        },
        project: site.project,
        setup: {
          _id: siteSetup._id,
          progress: siteSetup.progress,
          isComplete: siteSetup.isComplete,
          completedAt: siteSetup.completedAt,
          lastUpdatedBy: siteSetup.lastUpdatedBy
        },
        tasksByStep,
        summary: {
          totalTasks: siteSetup.tasks.length,
          completedTasks: siteSetup.tasks.filter((t: any) => t.isCompleted).length,
          requiredTasks: siteSetup.tasks.filter((t: any) => t.isRequired).length,
          completedRequiredTasks: siteSetup.tasks.filter((t: any) => t.isRequired && t.isCompleted).length
        }
      }
    });
  } catch (error) {
    next(error);
  }
};