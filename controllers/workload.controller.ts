// controllers/workload.controller.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Project from '../models/project.model';
import ProjectSite from '../models/projectSite.model';
import Review from '../models/review.model';
import User, { IUserDocument } from '../models/user.model';
import { CustomError } from '../middlewares/error.middleware';
import { getAccountManagerWorkloadStats } from '../utils/reviewHelpers';

function isUserAuthenticated(
  req: Request
): req is Request & { user: IUserDocument & { _id: mongoose.Types.ObjectId } } {
  return req.user !== undefined;
}

/**
 * Get workload summary for the admin dashboard.
 * Workload = escalated review count per account manager.
 * @route GET /api/v1/admin/workload/summary
 * @access Private - ConnectGo staff only
 */
export const getWorkloadSummary = async (
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

    if (!req.user.isConnectGoStaff) {
      const error = new Error('Staff access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Active projects (not archived, not completed)
    const activeProjects = await Project.countDocuments({
      archived: { $ne: true },
      status: { $nin: ['completed', 'archived'] },
    });

    // Active sites
    const activeSites = await ProjectSite.countDocuments({
      archived: { $ne: true },
      status: { $nin: ['completed', 'archived'] },
    });

    // Projects by stage for breakdown
    const projectsByStage = await Project.aggregate([
      { $match: { archived: { $ne: true } } },
      { $group: { _id: '$stage', count: { $sum: 1 } } },
    ]);

    const itemsByStage: Record<string, number> = {
      onboarding: 0,
      design: 0,
      measure: 0,
      learn: 0,
      tell: 0,
    };
    for (const entry of projectsByStage) {
      if (entry._id && itemsByStage.hasOwnProperty(entry._id)) {
        itemsByStage[entry._id] = entry.count;
      }
    }

    // Completed items (projects + sites marked completed)
    const completedProjects = await Project.countDocuments({ status: 'completed' });
    const completedSites = await ProjectSite.countDocuments({ status: 'completed' });
    const completedItems = completedProjects + completedSites;

    const totalItems = activeProjects + activeSites;

    // Capacity is based on the most loaded account manager
    const amStats = await getAccountManagerWorkloadStats();
    
    let overallCapacityStatus: 'green' | 'orange' | 'red' = 'green';
    let overallCapacityPercentage = 0;

    if (amStats.length > 0) {
      // Use the most loaded AM to represent overall capacity
      const mostLoaded = amStats.reduce((max, am) =>
        am.escalatedCount > max.escalatedCount ? am : max
      );
      overallCapacityStatus = mostLoaded.capacityTier;
      overallCapacityPercentage = mostLoaded.capacityPercentage;
    }

    // Build workload items (active projects with org/stage info)
    const projectItems = await Project.find({
      archived: { $ne: true },
      status: { $nin: ['completed', 'archived'] },
    })
      .populate('organization', 'name')
      .select('name status stage organization')
      .limit(50)
      .lean();

    const items = projectItems.map((p: any) => ({
      _id: p._id,
      type: 'project' as const,
      name: p.name,
      organization: {
        _id: p.organization?._id,
        name: p.organization?.name || 'Unknown',
      },
      status: p.status,
      stage: p.stage || 'onboarding',
      isCompleted: p.status === 'completed',
    }));

    res.status(200).json({
      success: true,
      data: {
        totalItems,
        activeProjects,
        activeSites,
        completedItems,
        capacityStatus: overallCapacityStatus,
        capacityPercentage: overallCapacityPercentage,
        itemsByStage,
        items,
        accountManagers: amStats, // Per-AM breakdown for the detailed view
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a project or site as completed
 * @route POST /api/v1/admin/workload/:itemType/:itemId/complete
 * @access Private - ConnectGo staff only
 */
export const markItemCompleted = async (
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

    if (!req.user.isConnectGoStaff) {
      const error = new Error('Staff access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { itemType, itemId } = req.params;

    if (!['project', 'site'].includes(itemType)) {
      const error = new Error('Invalid item type. Must be "project" or "site"') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const Model = (itemType === 'project' ? Project : ProjectSite) as mongoose.Model<any>;
    const item = await Model.findById(itemId);

    if (!item) {
      const error = new Error(`${itemType} not found`) as CustomError;
      error.statusCode = 404;
      throw error;
    }

    (item as any).status = 'completed';
    await item.save();

    res.status(200).json({
      success: true,
      message: `${itemType} marked as completed`,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get support & escalation statistics.
 * Pulls from Review model as the source of truth for escalation data.
 * @route GET /api/v1/admin/support/stats
 * @access Private - ConnectGo staff only
 */
export const getSupportEscalationStats = async (
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

    if (!req.user.isConnectGoStaff) {
      const error = new Error('Staff access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const totalEscalated = await Review.countDocuments({ status: 'escalated' });
    const resolvedEscalated = await Review.countDocuments({ status: 'resolved' });
    const totalReviews = await Review.countDocuments({});

    // Satisfaction = percentage of reviews that were resolved without escalation
    const directlyResolved = await Review.countDocuments({
      status: { $in: ['approved', 'resolved'] },
      escalatedTo: { $exists: false },
    });
    const overallSatisfaction =
      totalReviews > 0 ? Math.round((directlyResolved / totalReviews) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        chatbotQuestions: 0,       // Placeholder — wire to your chatbot system when ready
        clientIncidents: totalEscalated,
        satisfactionSurveys: 0,    // Placeholder — wire to pulse survey when ready
        overallSatisfaction,
        categorizedSupport: [
          { category: 'client_incidents', count: totalEscalated },
          { category: 'satisfaction_surveys', count: 0 },
          { category: 'chatbot_questions', count: 0 },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get incident statistics.
 * @route GET /api/v1/admin/incidents/stats
 * @access Private - ConnectGo staff only
 */
export const getIncidentStats = async (
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

    if (!req.user.isConnectGoStaff) {
      const error = new Error('Staff access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, open, resolved, critical, recent] = await Promise.all([
      Review.countDocuments({ status: 'escalated' }),
      Review.countDocuments({ status: 'escalated' }),
      Review.countDocuments({ status: 'resolved', escalatedTo: { $exists: true } }),
      Review.countDocuments({ status: 'escalated', priority: 'critical' }),
      Review.countDocuments({
        status: 'escalated',
        escalatedAt: { $gte: sevenDaysAgo },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalIncidents: total,
        openIncidents: open,
        resolvedIncidents: resolved,
        criticalIncidents: critical,
        recentIncidents: recent,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getWorkloadSummary,
  markItemCompleted,
  getSupportEscalationStats,
  getIncidentStats,
};