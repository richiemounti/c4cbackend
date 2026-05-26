// controllers/riskAnalytics.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import RiskChangeLog from "../models/riskChangeLog.model";
import RiskRegister from "../models/riskRegister.model";
import { CustomError } from "../middlewares/error.middleware";

// Type guard for authenticated requests
function isUserAuthenticated(req: Request): req is Request & { 
  user: { 
    _id: mongoose.Types.ObjectId; 
    isConnectGoStaff?: boolean;
    primaryRole: string;
  } 
} {
  return req.user !== undefined;
}

/**
 * Get change logs for a specific risk
 * @route GET /api/v1/admin/dashboard/risks/:riskId/changelog
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
export const getRiskChangelog = async (
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

    const { riskId } = req.params;
    const { limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(riskId)) {
      const error = new Error('Invalid risk ID format') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const changeLogs = await RiskChangeLog.find({ riskId })
      .populate('changedBy', 'name email')
      .sort({ changedAt: -1 })
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: {
        count: changeLogs.length,
        changeLogs: changeLogs.map(log => log.toDisplayFormat())
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get risk trends over time for visualizations
 * @route GET /api/v1/admin/dashboard/risks/analytics/trends
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
export const getRiskTrends = async (
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

    const { projectId, startDate, endDate, interval = 'week' } = req.query;

    if (!projectId) {
      const error = new Error('Project ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Calculate date range (default: last 90 days)
    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get risk snapshots at different time points
    const risks = await RiskRegister.find({
      project: new mongoose.Types.ObjectId(projectId as string),
      createdAt: { $lte: end },
      archived: { $ne: true }
    }).select('name riskScore status createdAt updatedAt');

    // Get change logs in the date range
    const changeLogs = await RiskChangeLog.find({
      project: new mongoose.Types.ObjectId(projectId as string),
      changedAt: { $gte: start, $lte: end }
    }).sort({ changedAt: 1 });

    // Build timeline data
    const timelineData = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const snapshot = {
        date: new Date(currentDate),
        totalRisks: 0,
        highRisks: 0,
        mediumRisks: 0,
        lowRisks: 0,
        openRisks: 0,
        closedRisks: 0
      };

      // Count risks that existed at this point in time
      risks.forEach(risk => {
        if (new Date(risk.createdAt) <= currentDate) {
          snapshot.totalRisks++;
          
          // Get the risk state at this point by checking change logs
          let currentScore = risk.riskScore;
          let currentStatus = risk.status;

          // Apply changes up to this date
          changeLogs.forEach(log => {
            if (log.riskId.toString() === risk._id!.toString() && 
                log.changedAt <= currentDate) {
              log.changes.forEach(change => {
                if (change.field === 'riskScore') currentScore = change.newValue;
                if (change.field === 'status') currentStatus = change.newValue;
              });
            }
          });

          // Count by score
          if (currentScore === 'high') snapshot.highRisks++;
          else if (currentScore === 'medium') snapshot.mediumRisks++;
          else if (currentScore === 'low') snapshot.lowRisks++;

          // Count by status
          if (currentStatus === 'open' || currentStatus === 'monitoring') {
            snapshot.openRisks++;
          } else {
            snapshot.closedRisks++;
          }
        }
      });

      timelineData.push(snapshot);

      // Move to next interval
      if (interval === 'day') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else {
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        interval,
        startDate: start,
        endDate: end,
        trends: timelineData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get status change analysis
 * @route GET /api/v1/admin/dashboard/risks/analytics/status-changes
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
export const getStatusChanges = async (
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

    const { projectId, startDate, endDate } = req.query;

    if (!projectId) {
      const error = new Error('Project ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const statusChanges = await RiskChangeLog.aggregate([
      {
        $match: {
          project: new mongoose.Types.ObjectId(projectId as string),
          changeType: 'status',
          changedAt: { $gte: start, $lte: end }
        }
      },
      {
        $unwind: '$changes'
      },
      {
        $match: {
          'changes.field': 'status'
        }
      },
      {
        $group: {
          _id: {
            from: '$changes.oldValueLabel',
            to: '$changes.newValueLabel'
          },
          count: { $sum: 1 },
          risks: { $addToSet: '$riskId' }
        }
      },
      {
        $project: {
          _id: 0,
          fromStatus: '$_id.from',
          toStatus: '$_id.to',
          count: 1,
          riskCount: { $size: '$risks' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        statusChanges
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get mitigation effectiveness analysis
 * @route GET /api/v1/admin/dashboard/risks/analytics/mitigation-effectiveness
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
export const getMitigationEffectiveness = async (
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

    const { projectId } = req.query;

    if (!projectId) {
      const error = new Error('Project ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const risks = await RiskRegister.find({
      project: new mongoose.Types.ObjectId(projectId as string),
      archived: { $ne: true }
    }).select('name riskScore riskHistory mitigationActions createdAt');

    const effectiveness = risks.map(risk => {
      // Get initial risk score
      const initialScore = risk.riskHistory.length > 0 
        ? risk.riskHistory[0].riskScore 
        : risk.riskScore;
      
      // Calculate days tracked
      const daysTracked = Math.floor(
        (Date.now() - new Date(risk.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Count completed actions
      const actionsCompleted = risk.mitigationActions.filter(
        a => a.status === 'completed'
      ).length;
      
      const totalActions = risk.mitigationActions.length;
      
      // Calculate effectiveness score (0-100)
      const effectiveness = calculateEffectiveness(
        initialScore,
        risk.riskScore,
        actionsCompleted,
        totalActions
      );
      
      return {
        riskId: risk._id,
        riskName: risk.name,
        initialScore,
        currentScore: risk.riskScore,
        daysTracked,
        actionsCompleted,
        totalActions,
        completionRate: totalActions > 0 ? Math.round((actionsCompleted / totalActions) * 100) : 0,
        effectiveness
      };
    });

    // Sort by effectiveness (descending)
    effectiveness.sort((a, b) => b.effectiveness - a.effectiveness);

    res.status(200).json({
      success: true,
      data: {
        effectiveness,
        averageEffectiveness: effectiveness.length > 0
          ? Math.round(effectiveness.reduce((sum, e) => sum + e.effectiveness, 0) / effectiveness.length)
          : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate effectiveness score based on risk improvement and action completion
 */
function calculateEffectiveness(
  initialScore: string,
  currentScore: string,
  completed: number,
  total: number
): number {
  const scoreValues: Record<string, number> = { 
    low: 1, 
    medium: 2, 
    high: 3 
  };
  
  const improvement = scoreValues[initialScore] - scoreValues[currentScore];
  const completionRate = total > 0 ? completed / total : 0;
  
  // Effectiveness score components:
  // - 50% from risk score improvement (normalized to 0-50)
  // - 50% from mitigation action completion rate (0-50)
  const improvementScore = ((improvement + 2) / 4) * 50; // Normalize to 0-50
  const completionScore = completionRate * 50;
  
  return Math.round(improvementScore + completionScore);
}

/**
 * Get change statistics for a project
 * @route GET /api/v1/admin/dashboard/risks/analytics/change-stats
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
export const getChangeStats = async (
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

    const { projectId, startDate, endDate } = req.query;

    if (!projectId) {
      const error = new Error('Project ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const stats = await RiskChangeLog.getChangeStats(
      new mongoose.Types.ObjectId(projectId as string),
      start,
      end
    );

    // Get most active users
    const activeUsers = await RiskChangeLog.aggregate([
      {
        $match: {
          project: new mongoose.Types.ObjectId(projectId as string),
          changedAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$changedBy',
          changeCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          userName: '$user.name',
          userEmail: '$user.email',
          changeCount: 1
        }
      },
      { $sort: { changeCount: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        changesByType: stats,
        mostActiveUsers: activeUsers
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getRiskChangelog,
  getRiskTrends,
  getStatusChanges,
  getMitigationEffectiveness,
  getChangeStats
};