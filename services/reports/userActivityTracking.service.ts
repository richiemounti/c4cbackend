// services/reports/userActivityTracking.service.ts
import mongoose from "mongoose";
import Report from "../../models/report.model";

// Interface for user activity log entry
interface IUserActivityLog {
  _id?: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  activityType: 'view' | 'edit' | 'export' | 'share' | 'approve' | 'comment' | 'restore';
  activityDetails: {
    action: string;
    description?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
  timestamp: Date;
  duration?: number; // Time spent on activity in milliseconds
  context?: {
    source: 'web' | 'api' | 'mobile' | 'system';
    referrer?: string;
    location?: string;
  };
}

// Interface for user session tracking
interface IUserSession {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  activities?: IUserActivityLog[];
  totalDuration: number;
  pageViews: number;
  isActive: boolean;
}

// Interface for collaboration tracking
interface ICollaborationEvent {
  reportId: mongoose.Types.ObjectId;
  participants: Array<{
    userId: mongoose.Types.ObjectId;
    role: string;
    joinedAt: Date;
    leftAt?: Date;
    contributionScore: number;
  }>;
  eventType: 'concurrent_edit' | 'comment_thread' | 'review_session' | 'approval_process';
  startTime: Date;
  endTime?: Date;
  summary?: string;
}

// User Activity Schema
const userActivitySchema = new mongoose.Schema({
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  activityType: {
    type: String,
    enum: ['view', 'edit', 'export', 'share', 'approve', 'comment', 'restore'],
    required: true,
    index: true
  },
  activityDetails: {
    action: {
      type: String,
      required: true
    },
    description: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    ipAddress: String,
    userAgent: String,
    sessionId: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  duration: Number,
  context: {
    source: {
      type: String,
      enum: ['web', 'api', 'mobile', 'system'],
      default: 'web'
    },
    referrer: String,
    location: String
  }
}, {
  timestamps: true
});

// Session Tracking Schema
const userSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  endTime: Date,
  totalDuration: {
    type: Number,
    default: 0
  },
  pageViews: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Collaboration Events Schema
const collaborationEventSchema = new mongoose.Schema({
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true,
    index: true
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    contributionScore: {
      type: Number,
      default: 0
    }
  }],
  eventType: {
    type: String,
    enum: ['concurrent_edit', 'comment_thread', 'review_session', 'approval_process'],
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  endTime: Date,
  summary: String
}, {
  timestamps: true
});

// Indexes for efficient querying
userActivitySchema.index({ reportId: 1, timestamp: -1 });
userActivitySchema.index({ userId: 1, timestamp: -1 });
userActivitySchema.index({ activityType: 1, timestamp: -1 });
userActivitySchema.index({ 'activityDetails.sessionId': 1 });

userSessionSchema.index({ userId: 1, reportId: 1 });
userSessionSchema.index({ startTime: -1 });
userSessionSchema.index({ isActive: 1, startTime: -1 });

collaborationEventSchema.index({ reportId: 1, startTime: -1 });
collaborationEventSchema.index({ eventType: 1, startTime: -1 });

const UserActivity = mongoose.model('UserActivity', userActivitySchema);
const UserSession = mongoose.model('UserSession', userSessionSchema);
const CollaborationEvent = mongoose.model('CollaborationEvent', collaborationEventSchema);

export class UserActivityTrackingService {
  
  /**
   * Log user activity
   */
  static async logActivity(
    reportId: string,
    userId: string,
    activityType: 'view' | 'edit' | 'export' | 'share' | 'approve' | 'comment' | 'restore',
    action: string,
    options: {
      description?: string;
      metadata?: any;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      duration?: number;
      source?: 'web' | 'api' | 'mobile' | 'system';
      referrer?: string;
      location?: string;
    } = {}
  ): Promise<IUserActivityLog> {
    try {
      const activity = new UserActivity({
        reportId: new mongoose.Types.ObjectId(reportId),
        userId: new mongoose.Types.ObjectId(userId),
        activityType,
        activityDetails: {
          action,
          description: options.description,
          metadata: options.metadata,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          sessionId: options.sessionId
        },
        timestamp: new Date(),
        duration: options.duration,
        context: {
          source: options.source || 'web',
          referrer: options.referrer,
          location: options.location
        }
      });

      await activity.save();

      // Update session if sessionId provided
      if (options.sessionId) {
        await this.updateSession(options.sessionId, userId, reportId);
      }

      return activity.toObject() as IUserActivityLog;

    } catch (error) {
      console.error('Error logging user activity:', error);
      throw new Error(`Failed to log activity: ${error}`);
    }
  }

  /**
   * Start or update user session
   */
  static async startSession(
    reportId: string,
    userId: string,
    sessionId: string
  ): Promise<IUserSession> {
    try {
      // Check if session already exists
      let session = await UserSession.findOne({ sessionId });

      if (session) {
        // Update existing session
        session.isActive = true;
        session.pageViews += 1;
        await session.save();
      } else {
        // Create new session
        session = new UserSession({
          sessionId,
          userId: new mongoose.Types.ObjectId(userId),
          reportId: new mongoose.Types.ObjectId(reportId),
          startTime: new Date(),
          pageViews: 1,
          isActive: true
        });
        await session.save();
      }

      return session.toObject() as IUserSession;

    } catch (error) {
      console.error('Error starting session:', error);
      throw new Error(`Failed to start session: ${error}`);
    }
  }

  /**
   * End user session
   */
  static async endSession(sessionId: string): Promise<void> {
    try {
      const session = await UserSession.findOne({ sessionId, isActive: true });
      if (session) {
        session.endTime = new Date();
        session.isActive = false;
        session.totalDuration = session.endTime.getTime() - session.startTime.getTime();
        await session.save();
      }

    } catch (error) {
      console.error('Error ending session:', error);
      throw new Error(`Failed to end session: ${error}`);
    }
  }

  /**
   * Get user activity for a report
   */
  static async getReportActivity(
    reportId: string,
    options: {
      userId?: string;
      activityTypes?: string[];
      fromDate?: Date;
      toDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    activities: any[];
    pagination: any;
    summary: any;
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = { reportId };

      if (options.userId) {
        query.userId = options.userId;
      }

      if (options.activityTypes && options.activityTypes.length > 0) {
        query.activityType = { $in: options.activityTypes };
      }

      if (options.fromDate || options.toDate) {
        query.timestamp = {};
        if (options.fromDate) {
          query.timestamp.$gte = options.fromDate;
        }
        if (options.toDate) {
          query.timestamp.$lte = options.toDate;
        }
      }

      // Execute queries
      const [activities, totalCount, summary] = await Promise.all([
        UserActivity.find(query)
          .populate('userId', 'name email')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit),
        UserActivity.countDocuments(query),
        this.generateActivitySummary(reportId, options)
      ]);

      return {
        activities,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1
        },
        summary
      };

    } catch (error) {
      console.error('Error getting report activity:', error);
      throw new Error(`Failed to get report activity: ${error}`);
    }
  }

  /**
   * Get user activity summary for a user
   */
  static async getUserActivitySummary(
    userId: string,
    options: {
      reportId?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<{
    totalActivities: number;
    activitiesByType: Record<string, number>;
    recentActivities: any[];
    mostActiveReports: Array<{
      reportId: string;
      reportTitle: string;
      activityCount: number;
    }>;
    timeSpentByReport: Array<{
      reportId: string;
      reportTitle: string;
      totalTime: number;
    }>;
  }> {
    try {
      const query: any = { userId };

      if (options.reportId) {
        query.reportId = options.reportId;
      }

      if (options.fromDate || options.toDate) {
        query.timestamp = {};
        if (options.fromDate) {
          query.timestamp.$gte = options.fromDate;
        }
        if (options.toDate) {
          query.timestamp.$lte = options.toDate;
        }
      }

      // Aggregate user activity data
      const [activitiesAgg, recentActivities] = await Promise.all([
        UserActivity.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                activityType: '$activityType',
                reportId: '$reportId'
              },
              count: { $sum: 1 },
              totalDuration: { $sum: { $ifNull: ['$duration', 0] } }
            }
          }
        ]),
        UserActivity.find(query)
          .populate('reportId', 'title reportType')
          .sort({ timestamp: -1 })
          .limit(10)
      ]);

      // Process aggregated data
      const activitiesByType: Record<string, number> = {};
      const reportActivity = new Map();
      const reportTimeSpent = new Map();

      activitiesAgg.forEach(item => {
        const { activityType, reportId } = item._id;
        const { count, totalDuration } = item;

        // Count by activity type
        activitiesByType[activityType] = (activitiesByType[activityType] || 0) + count;

        // Count by report
        const reportIdStr = reportId.toString();
        reportActivity.set(reportIdStr, (reportActivity.get(reportIdStr) || 0) + count);
        reportTimeSpent.set(reportIdStr, (reportTimeSpent.get(reportIdStr) || 0) + totalDuration);
      });

      // Get report details for top active reports
      const topReportIds = Array.from(reportActivity.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reportId]) => reportId);

      const reportDetails = await Report.find({
        _id: { $in: topReportIds }
      }).select('_id title');

      const reportDetailsMap = new Map();
        reportDetails.forEach(report => {
          reportDetailsMap.set((report._id as mongoose.Types.ObjectId).toString(), report.title);
      });

      const mostActiveReports = Array.from(reportActivity.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reportId, count]) => ({
          reportId,
          reportTitle: reportDetailsMap.get(reportId) || 'Unknown Report',
          activityCount: count
        }));

      const timeSpentByReport = Array.from(reportTimeSpent.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reportId, totalTime]) => ({
          reportId,
          reportTitle: reportDetailsMap.get(reportId) || 'Unknown Report',
          totalTime
        }));

      return {
        totalActivities: Object.values(activitiesByType).reduce((sum, count) => sum + count, 0),
        activitiesByType,
        recentActivities,
        mostActiveReports,
        timeSpentByReport
      };

    } catch (error) {
      console.error('Error getting user activity summary:', error);
      throw new Error(`Failed to get user activity summary: ${error}`);
    }
  }

  /**
   * Track collaboration events
   */
  static async trackCollaboration(
    reportId: string,
    eventType: 'concurrent_edit' | 'comment_thread' | 'review_session' | 'approval_process',
    participants: Array<{
      userId: string;
      role: string;
    }>
  ): Promise<ICollaborationEvent> {
    try {
      const collaborationEvent = new CollaborationEvent({
        reportId: new mongoose.Types.ObjectId(reportId),
        eventType,
        participants: participants.map(p => ({
          userId: new mongoose.Types.ObjectId(p.userId),
          role: p.role,
          joinedAt: new Date(),
          contributionScore: 0
        })),
        startTime: new Date()
      });

      await collaborationEvent.save();
      return collaborationEvent.toObject() as ICollaborationEvent;

    } catch (error) {
      console.error('Error tracking collaboration:', error);
      throw new Error(`Failed to track collaboration: ${error}`);
    }
  }

  /**
   * End collaboration event
   */
  static async endCollaboration(
    collaborationEventId: string,
    summary?: string
  ): Promise<void> {
    try {
      const event = await CollaborationEvent.findById(collaborationEventId);
      if (event) {
        event.endTime = new Date();
        event.summary = summary;
        await event.save();
      }

    } catch (error) {
      console.error('Error ending collaboration:', error);
      throw new Error(`Failed to end collaboration: ${error}`);
    }
  }

  /**
   * Get collaboration analytics for a report
   */
  static async getCollaborationAnalytics(
    reportId: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    activeCollaborators: Array<{
      userId: string;
      name: string;
      contributionScore: number;
      eventsParticipated: number;
    }>;
    collaborationTimeline: any[];
  }> {
    try {
      const query: any = { reportId };

      if (options.fromDate || options.toDate) {
        query.startTime = {};
        if (options.fromDate) {
          query.startTime.$gte = options.fromDate;
        }
        if (options.toDate) {
          query.startTime.$lte = options.toDate;
        }
      }

      const events = await CollaborationEvent.find(query)
        .populate('participants.userId', 'name email')
        .sort({ startTime: -1 });

      // Analyze collaboration data
      const eventsByType: Record<string, number> = {};
      const collaboratorMap = new Map();

      events.forEach(event => {
        // Count by event type
        eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

        // Track collaborator participation
        event.participants.forEach(participant => {
          const userId = participant.userId._id.toString();
          if (!collaboratorMap.has(userId)) {
            collaboratorMap.set(userId, {
              userId,
              name: (participant.userId as any).name,
              contributionScore: 0,
              eventsParticipated: 0
            });
          }
          const collaborator = collaboratorMap.get(userId);
          collaborator.contributionScore += participant.contributionScore || 0;
          collaborator.eventsParticipated += 1;
        });
      });

      const activeCollaborators = Array.from(collaboratorMap.values())
        .sort((a, b) => b.contributionScore - a.contributionScore);

      return {
        totalEvents: events.length,
        eventsByType,
        activeCollaborators,
        collaborationTimeline: events.slice(0, 20) // Recent 20 events
      };

    } catch (error) {
      console.error('Error getting collaboration analytics:', error);
      throw new Error(`Failed to get collaboration analytics: ${error}`);
    }
  }

  /**
   * Clean up old activity logs
   */
  static async cleanupOldActivity(
    retentionDays: number = 365
  ): Promise<{
    activitiesDeleted: number;
    sessionsDeleted: number;
    collaborationEventsDeleted: number;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

      const [activitiesResult, sessionsResult, collaborationResult] = await Promise.all([
        UserActivity.deleteMany({ timestamp: { $lt: cutoffDate } }),
        UserSession.deleteMany({ startTime: { $lt: cutoffDate } }),
        CollaborationEvent.deleteMany({ startTime: { $lt: cutoffDate } })
      ]);

      return {
        activitiesDeleted: activitiesResult.deletedCount || 0,
        sessionsDeleted: sessionsResult.deletedCount || 0,
        collaborationEventsDeleted: collaborationResult.deletedCount || 0
      };

    } catch (error) {
      console.error('Error cleaning up old activity:', error);
      throw new Error(`Failed to cleanup old activity: ${error}`);
    }
  }

  // Private helper methods
  private static async updateSession(
    sessionId: string,
    userId: string,
    reportId: string
  ): Promise<void> {
    try {
      const session = await UserSession.findOne({ sessionId });
      if (session) {
        session.pageViews += 1;
        await session.save();
      }
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }

  private static async generateActivitySummary(
    reportId: string,
    options: any
  ): Promise<any> {
    try {
      const query: any = { reportId };

      if (options.fromDate || options.toDate) {
        query.timestamp = {};
        if (options.fromDate) {
          query.timestamp.$gte = options.fromDate;
        }
        if (options.toDate) {
          query.timestamp.$lte = options.toDate;
        }
      }

      const summary = await UserActivity.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              activityType: '$activityType',
              userId: '$userId'
            },
            count: { $sum: 1 },
            totalDuration: { $sum: { $ifNull: ['$duration', 0] } }
          }
        },
        {
          $group: {
            _id: '$_id.activityType',
            count: { $sum: '$count' },
            uniqueUsers: { $addToSet: '$_id.userId' },
            totalDuration: { $sum: '$totalDuration' }
          }
        }
      ]);

      const result: any = {};
      summary.forEach(item => {
        result[item._id] = {
          count: item.count,
          uniqueUsers: item.uniqueUsers.length,
          totalDuration: item.totalDuration
        };
      });

      return result;

    } catch (error) {
      console.error('Error generating activity summary:', error);
      return {};
    }
  }
}

export default UserActivityTrackingService;
export { 
  IUserActivityLog, 
  IUserSession, 
  ICollaborationEvent,
  UserActivity,
  UserSession,
  CollaborationEvent
};