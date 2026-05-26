// controllers/riskManagement.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import RiskRegister from "../models/riskRegister.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import { CustomError } from "../middlewares/error.middleware";

function isUserAuthenticated(req: Request): req is Request & { 
  user: { 
    _id: mongoose.Types.ObjectId; 
    isConnectGoStaff?: boolean;
    primaryRole: string;
    roles: Array<{
      role: string;
      organization?: mongoose.Types.ObjectId;
      projects?: mongoose.Types.ObjectId[];
    }>;
  } 
} {
  return req.user !== undefined;
}

// Helper function to check if user has access to risk register
const hasRiskRegisterAccess = (userRole: string): boolean => {
  const allowedRoles = ['manager', 'projectCreator', 'organiser', 'reviewer'];
  return allowedRoles.includes(userRole);
};

// Helper function to get allowed risk types based on user role
const getAllowedRiskTypes = (userRole: string): string[] => {
  const riskTypePermissions = {
    // ConnectGo staff roles - full access
    admin: [
      'operational', 'financial', 'strategic', 'compliance', 
      'environmental', 'social', 'technical', 'reputational', 
      'political', 'market', 'legal'
    ],
    owner: [
      'operational', 'financial', 'strategic', 'compliance', 
      'environmental', 'social', 'technical', 'reputational', 
      'political', 'market', 'legal'
    ],
    accountManager: [
      'operational', 'financial', 'strategic', 'compliance', 
      'environmental', 'social', 'technical', 'reputational', 
      'political', 'market', 'legal'
    ],
    // Client roles
    manager: [
      'operational', 'financial', 'strategic', 'compliance', 
      'environmental', 'social', 'technical', 'reputational', 
      'political', 'market', 'legal'
    ],
    projectCreator: [
      'operational', 'environmental', 'social', 'technical', 
      'financial', 'market', 'reputational'
    ],
    organiser: [
      'operational', 'environmental', 'social', 'technical'
    ],
    reviewer: [], // Can view all but cannot create
  };
  
  return riskTypePermissions[userRole as keyof typeof riskTypePermissions] || [];
};

// Helper function to check if user can create risks
const canCreateRisks = (userRole: string): boolean => {
  return ['manager', 'projectCreator'].includes(userRole);
};

// Helper function to build user access filters for risks
const buildUserAccessFilters = (user: any): any => {
  const filters: any = { archived: { $ne: true } };
  
  if (user.isConnectGoStaff) {
    return filters; // Admin can see all non-archived risks
  }

  if (user.primaryRole === 'manager') {
    // Managers can see risks for their organizations
    const accessibleOrganizations = user.roles
      .filter((r: any) => r.organization)
      .map((r: any) => r.organization);
    
    if (accessibleOrganizations.length > 0) {
      filters.organization = { $in: accessibleOrganizations };
    }
  } else if (user.primaryRole === 'projectCreator') {
    // Project creators can see risks for their assigned projects
    const accessibleProjects = user.roles
      .filter((r: any) => r.projects && r.projects.length > 0)
      .flatMap((r: any) => r.projects);
    
    if (accessibleProjects.length > 0) {
      filters.project = { $in: accessibleProjects };
    }
  } else if (user.primaryRole === 'organiser') {
    // Organisers can see risks for their assigned project sites
    const accessibleProjects = user.roles
      .filter((r: any) => r.projects && r.projects.length > 0)
      .flatMap((r: any) => r.projects);
    
    if (accessibleProjects.length > 0) {
      filters.$or = [
        { project: { $in: accessibleProjects } },
        { projectSite: { $exists: true, $ne: null } }
      ];
    }
  } else if (user.primaryRole === 'reviewer') {
    // Reviewers can see risks for projects they're reviewing
    const reviewProjects = user.roles
      .filter((r: any) => r.role === 'reviewer' && r.projects && r.projects.length > 0)
      .flatMap((r: any) => r.projects);
    
    if (reviewProjects.length > 0) {
      filters.project = { $in: reviewProjects };
    }
  }

  return filters;
};

// Helper function to get user-friendly risk source label
const getRiskSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    'manual': 'Manual Entry',
    'project_setup': 'Project Setup',
    'site_setup': 'Site Setup',
    'stakeholder_mapping': 'Stakeholder Mapping',
    'toc_stage1': 'Theory of Change - Stage 1',
    'toc_stage2': 'Theory of Change - Stage 2'
  };
  return labels[source] || source;
};


/**
 * Get risk register summary for dashboard
 * @route GET /api/v1/admin/dashboard/risks
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
export const getRiskRegisterSummary = async (
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

    // Check if user has access to risk register
    if (!req.user.isConnectGoStaff && !hasRiskRegisterAccess(req.user.primaryRole)) {
      const error = new Error('Access to risk register not permitted for your role') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Build base filters based on user access
    const baseFilters: Record<string, any> = buildUserAccessFilters(req.user);

    // Add additional query filters
    const filters: Record<string, any> = { ...baseFilters };
    if (req.query.projectId) {
      filters.project = new mongoose.Types.ObjectId(req.query.projectId as string);
    }
    if (req.query.projectSiteId) {
      filters.projectSite = new mongoose.Types.ObjectId(req.query.projectSiteId as string);
    }
    if (req.query.organizationId && req.user.isConnectGoStaff) {
      filters.organization = new mongoose.Types.ObjectId(req.query.organizationId as string);
    }
    if (req.query.riskScore) filters.riskScore = req.query.riskScore;
    if (req.query.riskType) filters.riskType = req.query.riskType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.riskSource) filters.riskSource = req.query.riskSource;
    if (req.query.owner) {
      filters.owner = new mongoose.Types.ObjectId(req.query.owner as string);
    }
    // Add review date range filters
    if (req.query.reviewDateFrom || req.query.reviewDateTo) {
      filters.reviewDate = {};
      
      if (req.query.reviewDateFrom) {
        filters.reviewDate.$gte = new Date(req.query.reviewDateFrom as string);
      }
      
      if (req.query.reviewDateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(req.query.reviewDateTo as string);
        endDate.setDate(endDate.getDate() + 1);
        filters.reviewDate.$lt = endDate;
      }
    }

    // Get risks with aggregation
    const riskSummary = await RiskRegister.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: "projects",
          localField: "project",
          foreignField: "_id",
          as: "projectInfo"
        }
      },
      {
        $lookup: {
          from: "projectsites",
          localField: "projectSite",
          foreignField: "_id",
          as: "siteInfo"
        }
      },
      {
        $lookup: {
          from: "organizations",
          localField: "organization",
          foreignField: "_id",
          as: "orgInfo"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerInfo"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "comments.author",
          foreignField: "_id",
          as: "commentAuthors"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "comments.starredBy",
          foreignField: "_id",
          as: "commentStarredBy"
        }
      },
      {
        $addFields: {
          isReviewOverdue: {
            $and: [
              { $lt: ["$reviewDate", new Date()] },
              { $eq: ["$status", "open"] }
            ]
          },
          daysUntilReview: {
            $divide: [{ $subtract: ["$reviewDate", new Date()] }, 86400000]
          },
          // Map comment authors and starredBy to comments
          comments: {
            $map: {
              input: "$comments",
              as: "comment",
              in: {
                _id: "$$comment._id",
                text: "$$comment.text",
                isKeyInsight: "$$comment.isKeyInsight",
                starredAt: "$$comment.starredAt",
                createdAt: "$$comment.createdAt",
                author: {
                  $let: {
                    vars: {
                      authorMatch: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$commentAuthors",
                              as: "ca",
                              cond: { $eq: ["$$ca._id", "$$comment.author"] }
                            }
                          },
                          0
                        ]
                      }
                    },
                    in: {
                      _id: "$$authorMatch._id",
                      name: "$$authorMatch.name",
                      email: "$$authorMatch.email"
                    }
                  }
                },
                starredBy: {
                  $cond: {
                    if: { $ifNull: ["$$comment.starredBy", false] },
                    then: {
                      $let: {
                        vars: {
                          starredMatch: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$commentStarredBy",
                                  as: "csb",
                                  cond: { $eq: ["$$csb._id", "$$comment.starredBy"] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          _id: "$$starredMatch._id",
                          name: "$$starredMatch.name",
                          email: "$$starredMatch.email"
                        }
                      }
                    },
                    else: null
                  }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          riskType: 1,
          riskDescription: 1,
          riskSource: 1,
          sourceReference: 1,
          probability: 1,
          consequences: 1,
          riskScore: 1,
          status: 1,
          category: 1,
          impactArea: 1,
          identifiedDate: 1,
          reviewDate: 1,
          isReviewOverdue: 1,
          daysUntilReview: 1,
          mitigationStrategy: 1,
          comments: 1,
          createdAt: 1,
          updatedAt: 1,
          project: {
            _id: { $first: "$projectInfo._id" },
            name: { $first: "$projectInfo.name" }
          },
          projectSite: {
            _id: { $first: "$siteInfo._id" },
            name: { $first: "$siteInfo.name" }
          },
          organization: {
            _id: { $first: "$orgInfo._id" },
            name: { $first: "$orgInfo.name" }
          },
          owner: {
            _id: { $first: "$ownerInfo._id" },
            name: { $first: "$ownerInfo.name" },
            email: { $first: "$ownerInfo.email" }
          }
        }
      },
      { $sort: { riskScore: -1, identifiedDate: -1 } }
    ]);

    // Calculate summary statistics
    const stats = {
      total: riskSummary.length,
      byScore: {
        high: riskSummary.filter(r => r.riskScore === 'high').length,
        medium: riskSummary.filter(r => r.riskScore === 'medium').length,
        low: riskSummary.filter(r => r.riskScore === 'low').length
      },
      byStatus: {
        open: riskSummary.filter(r => r.status === 'open').length,
        monitoring: riskSummary.filter(r => r.status === 'monitoring').length,
        closed: riskSummary.filter(r => r.status === 'closed').length,
        transferred: riskSummary.filter(r => r.status === 'transferred').length
      },
      byType: riskSummary.reduce((acc, risk) => {
        acc[risk.riskType] = (acc[risk.riskType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySource: riskSummary.reduce((acc, risk) => {
        acc[risk.riskSource] = (acc[risk.riskSource] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      reviewOverdue: riskSummary.filter(r => r.isReviewOverdue).length,
      dueForReviewSoon: riskSummary.filter(r => 
        r.daysUntilReview <= 7 && r.daysUntilReview > 0
      ).length
    };

    res.status(200).json({
      success: true,
      data: {
        stats,
        risks: riskSummary
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new risk item
 * @route POST /api/v1/admin/dashboard/risks
 * @access Private (Manager, ProjectCreator only)
 */
export const createRiskItem = async (
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

    // Check if user can create risks
    if (!req.user.isConnectGoStaff && !canCreateRisks(req.user.primaryRole)) {
      const error = new Error('Risk creation not permitted for your role') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const {
      projectId,
      projectSiteId,
      organizationId,
      name,
      riskType,
      riskDescription,
      riskSource = 'manual',
      sourceReference,
      probability,
      consequences,
      owner,
      mitigationStrategy,
      category = 'current',
      impactArea = [],
      reviewDate,
      reviewFrequency = 'quarterly',
      comment // ✅ NEW: Single initial comment instead of notes
    } = req.body;

    // Validate required fields
    if (!projectId || !organizationId || !name || !riskType || !riskDescription || 
        !probability || !consequences || !owner || !mitigationStrategy || !reviewDate) {
      const error = new Error('Missing required fields. Review date is mandatory for all risks.') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate riskSource
    const validRiskSources = ['manual', 'project_setup', 'site_setup', 'stakeholder_mapping', 'toc_stage1', 'toc_stage2'];
    if (!validRiskSources.includes(riskSource)) {
      const error = new Error(`Invalid risk source. Must be one of: ${validRiskSources.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user can create this risk type
    const allowedRiskTypes = getAllowedRiskTypes(req.user.primaryRole);
    if (!req.user.isConnectGoStaff && !allowedRiskTypes.includes(riskType)) {
      const error = new Error(`Risk type '${riskType}' not permitted for your role`) as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Verify project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check project access based on user role
    if (!req.user.isConnectGoStaff) {
      let hasAccess = false;

      if (req.user.primaryRole === 'manager') {
        // Managers can create risks for projects in their organizations
        const userOrganizations = req.user.roles
          .filter(r => r.organization)
          .map(r => r.organization?.toString());
        hasAccess = userOrganizations.includes(project.organization.toString());
      } else if (req.user.primaryRole === 'projectCreator') {
        // Project creators can create risks for their assigned projects
        const userProjects = req.user.roles
          .filter(r => r.projects && r.projects.length > 0)
          .flatMap(r => r.projects)
          .map(p => p?.toString());
        hasAccess = userProjects.includes(projectId);
      }

      if (!hasAccess) {
        const error = new Error('Not authorized to create risks for this project') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Verify project site exists and belongs to project (if provided)
    if (projectSiteId) {
      const projectSite = await ProjectSite.findById(projectSiteId);
      if (!projectSite) {
        const error = new Error('Project site not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      if (projectSite.project.toString() !== projectId) {
        const error = new Error('Project site does not belong to this project') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Calculate risk score
    const calculateRiskScore = (probability: string, consequences: string): string => {
      const probabilityValues: Record<string, number> = {
        'very_low': 1, 'low': 2, 'medium': 3, 'high': 4, 'very_high': 5
      };
      const consequenceValues: Record<string, number> = {
        'negligible': 1, 'minor': 2, 'moderate': 3, 'major': 4, 'catastrophic': 5
      };
      
      const probValue = probabilityValues[probability] || 3;
      const consValue = consequenceValues[consequences] || 3;
      const score = probValue * consValue;
      
      if (score <= 6) return 'low';
      if (score <= 15) return 'medium';
      return 'high';
    };

    const riskScore = calculateRiskScore(probability, consequences);

    // Validate owner is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(owner)) {
      const error = new Error('Owner must be a valid user ID') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // ✅ NEW: Prepare comments array with initial comment if provided
    const comments = [];
    if (comment && comment.trim()) {
      comments.push({
        text: comment.trim(),
        author: req.user._id,
        createdAt: new Date()
      });
    }

    // Create risk item
    const riskItem = new RiskRegister({
      project: projectId,
      projectSite: projectSiteId || null,
      organization: organizationId,
      name,
      riskType,
      riskDescription,
      riskSource,
      sourceReference: sourceReference || undefined,
      probability,
      consequences,
      riskScore,
      owner,
      mitigationStrategy,
      category,
      impactArea,
      reviewDate: new Date(reviewDate),
      reviewFrequency, // ✅ ADD THIS LINE
      comments, // ✅ NEW: Add comments array
      creator: req.user._id,
      lastUpdatedBy: req.user._id
    });

    await riskItem.save();

    // Populate the response
    await riskItem.populate([
      { path: 'project', select: 'name status' },
      { path: 'projectSite', select: 'name status' },
      { path: 'organization', select: 'name country city' },
      { path: 'owner', select: 'name email' },
      { path: 'creator', select: 'name email' },
      { path: 'comments.author', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Risk item created successfully',
      data: riskItem
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed risk information
 * @route GET /api/v1/admin/dashboard/risks/:riskId
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
export const getRiskDetails = async (
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

    // Check if user has access to risk register
    if (!req.user.isConnectGoStaff && !hasRiskRegisterAccess(req.user.primaryRole)) {
      const error = new Error('Access to risk register not permitted for your role') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { riskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(riskId)) {
      const error = new Error('Invalid risk ID format') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Build access filters and find the risk
    const accessFilters = buildUserAccessFilters(req.user);
    const risk = await RiskRegister.findOne({ _id: riskId, ...accessFilters })
      .populate('project', 'name status')
      .populate('projectSite', 'name status')
      .populate('organization', 'name country city')
      .populate('owner', 'name email')
      .populate('creator', 'name email')
      .populate('lastUpdatedBy', 'name email')
      .populate('mitigationActions.responsible', 'name email')
      .populate('riskHistory.updatedBy', 'name email')
      .populate('comments.author', 'name email')
      .populate('comments.starredBy', 'name email'); // ✅ NEW: Populate starredBy

    if (!risk) {
      const error = new Error('Risk not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Add calculated fields
    const riskWithCalculations = {
      ...risk.toObject(),
      riskSourceLabel: getRiskSourceLabel(risk.riskSource),
      isReviewOverdue: risk.reviewDate < new Date() && risk.status === 'open',
      daysUntilReview: Math.ceil((risk.reviewDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      mitigationProgress: risk.mitigationActions.length > 0 ? 
        Math.round((risk.mitigationActions.filter(a => a.status === 'completed').length / risk.mitigationActions.length) * 100) : 0
    };

    res.status(200).json({
      success: true,
      data: riskWithCalculations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update risk item
 * @route PUT /api/v1/admin/dashboard/risks/:riskId
 * @access Private (Manager, ProjectCreator, Risk Owner)
 */
export const updateRiskItem = async (
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
    const updateData = req.body;

    // Build access filters
    const accessFilters = buildUserAccessFilters(req.user);
    const risk = await RiskRegister.findOne({ _id: riskId, ...accessFilters });

    if (!risk) {
      const error = new Error('Risk not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user can update this risk
    const canUpdate = req.user.isConnectGoStaff || 
                     ['manager', 'projectCreator'].includes(req.user.primaryRole) ||
                     risk.owner.toString() === req.user._id.toString();

    if (!canUpdate) {
      const error = new Error('Not authorized to update this risk') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // If updating risk type, check permissions
    if (updateData.riskType && !req.user.isConnectGoStaff) {
      const allowedRiskTypes = getAllowedRiskTypes(req.user.primaryRole);
      if (!allowedRiskTypes.includes(updateData.riskType)) {
        const error = new Error(`Risk type '${updateData.riskType}' not permitted for your role`) as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Validate riskSource if provided
    if (updateData.riskSource) {
      const validRiskSources = ['manual', 'project_setup', 'site_setup', 'stakeholder_mapping', 'toc_stage1', 'toc_stage2'];
      if (!validRiskSources.includes(updateData.riskSource)) {
        const error = new Error(`Invalid risk source. Must be one of: ${validRiskSources.join(', ')}`) as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Update allowed fields
    const fieldsToUpdate = [
      'name', 'riskType', 'riskDescription', 'riskSource', 'sourceReference',
      'probability', 'consequences', 'owner', 'mitigationStrategy', 'category', 
      'impactArea', 'reviewDate', 'reviewFrequency', 'status', 'mitigationActions'
    ];

    fieldsToUpdate.forEach(field => {
      if (updateData[field] !== undefined) {
        (risk as any)[field] = updateData[field];
      }
    });

    if (updateData.reviewDate) {
      risk.reviewDate = new Date(updateData.reviewDate);
    }

    risk.lastUpdatedBy = req.user._id;
    await risk.save();

    await risk.populate([
      'project', 
      'projectSite', 
      'organization', 
      'owner', 
      'lastUpdatedBy',
      'comments.author' // ✅ NEW: Populate comment authors
    ]);

    res.status(200).json({
      success: true,
      message: 'Risk updated successfully',
      data: risk
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ NEW: Add comment to risk
 * @route POST /api/v1/admin/dashboard/risks/:riskId/comments
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer, Risk Owner)
 */
export const addComment = async (
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
    const { text } = req.body;

    if (!text || !text.trim()) {
      const error = new Error('Comment text is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const accessFilters = buildUserAccessFilters(req.user);
    const risk = await RiskRegister.findOne({ _id: riskId, ...accessFilters });

    if (!risk) {
      const error = new Error('Risk not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Anyone with access to view the risk can add comments
    // ✅ FIXED: Added isKeyInsight field
    const newComment = {
      text: text.trim(),
      author: req.user._id,
      isKeyInsight: false, // ✅ NEW: Default to false, can be starred later
      createdAt: new Date()
    };

    risk.comments.push(newComment);
    risk.lastUpdatedBy = req.user._id;
    
    await risk.save();
    await risk.populate('comments.author', 'name email');

    // Get the newly added comment
    const addedComment = risk.comments[risk.comments.length - 1];

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: addedComment
    });
  } catch (error) {
    next(error);
  }
};


/**
 * ✅ NEW: Toggle comment as key insight
 * @route PUT /api/v1/admin/dashboard/risks/:riskId/comments/:commentId/star
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
export const toggleCommentKeyInsight = async (
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

    const { riskId, commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(riskId) || !mongoose.Types.ObjectId.isValid(commentId)) {
      const error = new Error('Invalid risk ID or comment ID format') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const accessFilters = buildUserAccessFilters(req.user);
    const risk = await RiskRegister.findOne({ _id: riskId, ...accessFilters });

    if (!risk) {
      const error = new Error('Risk not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Find the comment
    const comment = risk.comments.find((c: any) => c._id.toString() === commentId);

    if (!comment) {
      const error = new Error('Comment not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Toggle the key insight status
    comment.isKeyInsight = !comment.isKeyInsight;
    
    if (comment.isKeyInsight) {
      // Starring the comment
      comment.starredBy = req.user._id;
      comment.starredAt = new Date();
    } else {
      // Unstarring the comment
      comment.starredBy = undefined;
      comment.starredAt = undefined;
    }

    risk.lastUpdatedBy = req.user._id;
    await risk.save();
    await risk.populate('comments.author', 'name email');
    await risk.populate('comments.starredBy', 'name email');

    res.status(200).json({
      success: true,
      message: comment.isKeyInsight ? 'Comment marked as key insight' : 'Comment unmarked as key insight',
      data: {
        comment,
        isKeyInsight: comment.isKeyInsight
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add mitigation action to risk
 * @route POST /api/v1/admin/dashboard/risks/:riskId/mitigation-actions
 * @access Private (Manager, ProjectCreator, Risk Owner)
 */
export const addMitigationAction = async (
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
    const { action, responsible, dueDate, notes } = req.body;

    if (!action) {
      const error = new Error('Action description is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const accessFilters = buildUserAccessFilters(req.user);
    const risk = await RiskRegister.findOne({ _id: riskId, ...accessFilters });

    if (!risk) {
      const error = new Error('Risk not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user can add mitigation actions
    const canAddActions = req.user.isConnectGoStaff || 
                         ['manager', 'projectCreator'].includes(req.user.primaryRole) ||
                         risk.owner.toString() === req.user._id.toString();

    if (!canAddActions) {
      const error = new Error('Not authorized to add mitigation actions to this risk') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    risk.mitigationActions.push({
      action,
      responsible: responsible || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status: 'not_started',
      notes: notes || ''
    });

    risk.lastUpdatedBy = req.user._id;
    await risk.save();

    res.status(201).json({
      success: true,
      message: 'Mitigation action added successfully',
      data: {
        action: risk.mitigationActions[risk.mitigationActions.length - 1],
        totalActions: risk.mitigationActions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update mitigation action status
 * @route PUT /api/v1/admin/dashboard/risks/:riskId/mitigation-actions/:actionId
 * @access Private (Manager, ProjectCreator, Risk Owner, Action Responsible)
 */
export const updateMitigationAction = async (
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

    const { riskId, actionId } = req.params;
    const { status, notes } = req.body;

    const accessFilters = buildUserAccessFilters(req.user);
    const risk = await RiskRegister.findOne({ _id: riskId, ...accessFilters });

    if (!risk) {
      const error = new Error('Risk not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const action = risk.mitigationActions.find((a: any) => a._id.toString() === actionId);

    if (!action) {
      const error = new Error('Mitigation action not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user can update this action
    const canUpdateAction = req.user.isConnectGoStaff || 
                           ['manager', 'projectCreator'].includes(req.user.primaryRole) ||
                           risk.owner.toString() === req.user._id.toString() ||
                           (action.responsible && action.responsible.toString() === req.user._id.toString());

    if (!canUpdateAction) {
      const error = new Error('Not authorized to update this mitigation action') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Update action
    if (status) action.status = status;
    if (notes !== undefined) action.notes = notes;

    if (status === 'completed') {
      action.completedAt = new Date();
    }

    risk.lastUpdatedBy = req.user._id;
    await risk.save();

    res.status(200).json({
      success: true,
      message: 'Mitigation action updated successfully',
      data: action
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add review comment to risk (Reviewer specific functionality)
 * @route POST /api/v1/admin/dashboard/risks/:riskId/review-comments
 * @access Private (Reviewer, Manager, Admin)
 * @deprecated Use addComment endpoint instead
 */
export const addReviewComment = async (
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
    const { comment } = req.body;

    if (!comment) {
      const error = new Error('Comment is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Only reviewers, managers and admins can add review comments
    const canAddComment = req.user.isConnectGoStaff || 
                         ['manager', 'reviewer'].includes(req.user.primaryRole);

    if (!canAddComment) {
      const error = new Error('Not authorized to add review comments') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const accessFilters = buildUserAccessFilters(req.user);
    const risk = await RiskRegister.findOne({ _id: riskId, ...accessFilters });

    if (!risk) {
      const error = new Error('Risk not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // ✅ UPDATED: Use new comment system
    const reviewComment = {
      text: `[REVIEW] ${comment.trim()}`,
      author: req.user._id,
      isKeyInsight: false,
      createdAt: new Date()
    };
    
    risk.comments.push(reviewComment);
    risk.lastUpdatedBy = req.user._id;
    
    await risk.save();
    await risk.populate('comments.author', 'name email');

    const addedComment = risk.comments[risk.comments.length - 1];

    res.status(201).json({
      success: true,
      message: 'Review comment added successfully',
      data: addedComment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get risks assigned to current user
 * @route GET /api/v1/dashboard/my-risks
 * @access Private (All authenticated users with risk access)
 */
export const getMyRisks = async (
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

    if (!req.user.isConnectGoStaff && !hasRiskRegisterAccess(req.user.primaryRole)) {
      const error = new Error('Access to risk register not permitted for your role') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Find risks where user is owner or responsible for mitigation actions
    const baseFilters = buildUserAccessFilters(req.user);
    
    const myRisks = await RiskRegister.find({
      ...baseFilters,
      $or: [
        { owner: req.user._id },
        { 'mitigationActions.responsible': req.user._id }
      ]
    })
    .populate('project', 'name status')
    .populate('projectSite', 'name status')
    .populate('organization', 'name country city')
    .populate('owner', 'name email')
    .populate('comments.author', 'name email')
    .populate('comments.starredBy', 'name email') // ✅ NEW: Populate starredBy

    // Calculate user-specific statistics
    const stats = {
      total: myRisks.length,
      asOwner: myRisks.filter(r => r.owner._id.toString() === req.user._id.toString()).length,
      byScore: {
        high: myRisks.filter(r => r.riskScore === 'high').length,
        medium: myRisks.filter(r => r.riskScore === 'medium').length,
        low: myRisks.filter(r => r.riskScore === 'low').length
      },
      byStatus: {
        open: myRisks.filter(r => r.status === 'open').length,
        monitoring: myRisks.filter(r => r.status === 'monitoring').length,
        closed: myRisks.filter(r => r.status === 'closed').length
      },
      bySource: myRisks.reduce((acc, risk) => {
        acc[risk.riskSource] = (acc[risk.riskSource] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      overdue: myRisks.filter(r => 
        r.reviewDate < new Date() && r.status === 'open'
      ).length
    };

    res.status(200).json({
      success: true,
      data: {
        stats,
        risks: myRisks
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive/Delete risk (Admin and Manager only)
 * @route DELETE /api/v1/admin/dashboard/risks/:riskId
 * @access Private (Admin, Manager only)
 */
export const archiveRisk = async (
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

    // Only admins and managers can archive risks
    if (!req.user.isConnectGoStaff && req.user.primaryRole !== 'manager') {
      const error = new Error('Not authorized to archive risks') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { riskId } = req.params;

    const accessFilters = buildUserAccessFilters(req.user);
    const risk = await RiskRegister.findOne({ _id: riskId, ...accessFilters });

    if (!risk) {
      const error = new Error('Risk not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Archive the risk instead of deleting
    risk.archived = true;
    risk.archivedAt = new Date();
    risk.lastUpdatedBy = req.user._id;
    
    await risk.save();

    res.status(200).json({
      success: true,
      message: 'Risk archived successfully'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getRiskRegisterSummary,
  createRiskItem,
  getRiskDetails,
  updateRiskItem,
  addComment,
  toggleCommentKeyInsight, // ✅ NEW
  addMitigationAction,
  updateMitigationAction,
  addReviewComment,
  getMyRisks,
  archiveRisk
};