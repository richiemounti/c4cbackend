// controllers/consentForm.controller.ts - FIXED VERSION
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import ConsentForm from "../models/consentForm.model";
import Survey from "../models/survey.model";
import Project from "../models/project.model";
import Organization from "../models/organization.model";
import { CustomError } from "../middlewares/error.middleware";
import { userHasProjectAccess, isCreatorOrHasAccess, isUserAuthenticated } from '../lib/authHelpers';

/**
 * Helper function to check if user has access to an organization
 */
const userHasOrganizationAccess = (req: Request, organizationId: string): boolean => {
  if (!req.user) return false;
  
  // ConnectGo staff have access to all organizations
  if (req.user.isConnectGoStaff) return true;
  
  // Check if user has any role in this organization
  return req.user.roles?.some(role => 
    role.organization?.toString() === organizationId
  ) || false;
};

/**
 * Helper function to get all organization IDs the user has access to
 */
const getUserOrganizationIds = (req: Request): string[] => {
  if (!req.user) return [];
  
  // Extract unique organization IDs from user's roles
  const orgIds = req.user.roles
    ?.filter(role => role.organization)
    .map(role => role.organization!.toString()) || [];
  
  return [...new Set(orgIds)]; // Remove duplicates
};

/**
 * Create a new consent form
 * @route POST /api/v1/consent-forms
 * @access Private
 */
export const createConsentForm = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      description,
      version,
      organizationId,
      projectId,
      isTemplate,
      templateCategory,
      defaultLanguage,
      translations
    } = req.body;

    // Validate authentication
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Validate required fields
    if (!name || !description) {
      const error = new Error('Name and description are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate scope
    if (projectId) {
      const project = await Project.findById(projectId).session(session);
      if (!project) {
        const error = new Error('Project not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      // Check project access
      const hasAccess = userHasProjectAccess(req, projectId);
      if (!hasAccess) {
        const error = new Error('Not authorized to create consent forms for this project') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    if (organizationId) {
      const organization = await Organization.findById(organizationId).session(session);
      if (!organization) {
        const error = new Error('Organization not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      // Check if user has access to this organization
      const hasOrgAccess = userHasOrganizationAccess(req, organizationId);
      if (!hasOrgAccess) {
        const error = new Error('Not authorized to create consent forms for this organization') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Validate template category
    if (isTemplate && !templateCategory) {
      const error = new Error('Template category is required for template consent forms') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Create the consent form
    const newConsentForm = new ConsentForm({
      name,
      description,
      version: version || '1.0',
      organization: organizationId || null,
      project: projectId || null,
      isTemplate: isTemplate || false,
      templateCategory,
      defaultLanguage: defaultLanguage || 'en',
      translations: translations || [],
      creator: req.user._id,
      lastUpdatedBy: req.user._id
    });

    await newConsentForm.save({ session });
    await session.commitTransaction();

    // Populate the response
    const populatedConsentForm = await ConsentForm.findById(newConsentForm._id)
      .populate('organization', 'name')
      .populate('project', 'name')
      .populate('creator', 'name email');

    res.status(201).json({
      success: true,
      message: 'Consent form created successfully',
      data: populatedConsentForm
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Get all consent forms with filtering
 * @route GET /api/v1/consent-forms
 * @access Private
 */
export const getConsentForms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      organization,
      project,
      isTemplate,
      isActive,
      templateCategory,
      page = 1,
      limit = 50,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter: any = { archived: { $ne: true } };

    if (organization) filter.organization = organization;
    if (project) filter.project = project;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (templateCategory) filter.templateCategory = templateCategory;

    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Access control: non-staff users can only see their org/project consent forms
    if (!req.user?.isConnectGoStaff) {
      const userOrgIds = getUserOrganizationIds(req);
      
      const userProjects = await Project.find({
        $or: [
          { creator: req.user?._id },
          { 'team.user': req.user?._id }
        ]
      }).select('_id');

      const projectIds = userProjects.map(p => p._id);

      filter.$or = [
        { organization: { $in: userOrgIds } },
        { project: { $in: projectIds } },
        { isTemplate: true, organization: null, project: null } // Global templates
      ];
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [consentForms, totalCount] = await Promise.all([
      ConsentForm.find(filter)
        .populate('organization', 'name')
        .populate('project', 'name')
        .populate('creator', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      ConsentForm.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: consentForms.length,
      data: consentForms,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalItems: totalCount,
        itemsPerPage: Number(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single consent form
 * @route GET /api/v1/consent-forms/:id
 * @access Private
 */
export const getConsentForm = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const consentFormId = req.params.id;

    const consentForm = await ConsentForm.findById(consentFormId)
      .populate('organization', 'name')
      .populate('project', 'name')
      .populate('creator', 'name email')
      .populate('lastUpdatedBy', 'name email');

    if (!consentForm) {
      const error = new Error('Consent form not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (consentForm.archived) {
      const error = new Error('Consent form is archived') as CustomError;
      error.statusCode = 410;
      throw error;
    }

    // Access control
    if (!req.user?.isConnectGoStaff) {
      const hasOrgAccess = consentForm.organization && 
        userHasOrganizationAccess(req, consentForm.organization._id.toString());
      
      const hasProjectAccess = consentForm.project && 
        userHasProjectAccess(req, consentForm.project._id.toString());
      
      const isGlobalTemplate = consentForm.isTemplate && 
        !consentForm.organization && 
        !consentForm.project;

      if (!hasOrgAccess && !hasProjectAccess && !isGlobalTemplate) {
        const error = new Error('Not authorized to access this consent form') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    res.status(200).json({
      success: true,
      data: consentForm
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid consent form ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update consent form
 * @route PUT /api/v1/consent-forms/:id
 * @access Private
 */
export const updateConsentForm = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const consentFormId = req.params.id;
    const {
      name,
      description,
      agreementLabel,
      isActive,
      defaultLanguage,
      translations
    } = req.body;

    const consentForm = await ConsentForm.findById(consentFormId);
    if (!consentForm) {
      const error = new Error('Consent form not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (consentForm.archived) {
      const error = new Error('Cannot update an archived consent form') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check permissions
    const isCreator = consentForm.creator.toString() === req.user?._id?.toString();
    const hasProjectAccess = consentForm.project && 
      userHasProjectAccess(req, consentForm.project.toString());
    const hasOrgAccess = consentForm.organization && 
      userHasOrganizationAccess(req, consentForm.organization.toString());

    if (!isCreator && !hasProjectAccess && !hasOrgAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to update this consent form') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Update fields
    if (name !== undefined) consentForm.name = name;
    if (description !== undefined) consentForm.description = description; // Version will auto-increment
    if (agreementLabel !== undefined) consentForm.agreementLabel = agreementLabel;  // ADD
    if (isActive !== undefined) consentForm.isActive = isActive;
    if (defaultLanguage !== undefined) consentForm.defaultLanguage = defaultLanguage;
    if (translations !== undefined) consentForm.translations = translations;
    
    if (req.user) {
      consentForm.lastUpdatedBy = req.user._id as any;
    }

    await consentForm.save({ session });
    await session.commitTransaction();

    // Return updated consent form
    const updatedConsentForm = await ConsentForm.findById(consentFormId)
      .populate('organization', 'name')
      .populate('project', 'name')
      .populate('creator', 'name email')
      .populate('lastUpdatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Consent form updated successfully',
      data: updatedConsentForm
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Archive consent form
 * @route DELETE /api/v1/consent-forms/:id
 * @access Private
 */
export const archiveConsentForm = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const consentFormId = req.params.id;

    const consentForm = await ConsentForm.findById(consentFormId);
    if (!consentForm) {
      const error = new Error('Consent form not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (consentForm.archived) {
      const error = new Error('Consent form is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check permissions
    const isCreator = consentForm.creator.toString() === req.user?._id?.toString();
    const hasProjectAccess = consentForm.project && 
      userHasProjectAccess(req, consentForm.project.toString());
    const hasOrgAccess = consentForm.organization && 
      userHasOrganizationAccess(req, consentForm.organization.toString());

    if (!isCreator && !hasProjectAccess && !hasOrgAccess && !req.user?.isConnectGoStaff) {
      const error = new Error('Not authorized to archive this consent form') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check if consent form is being used by active surveys
    const activeSurveyCount = await Survey.countDocuments({
      consentForm: consentFormId,
      status: { $in: ['draft', 'published'] },
      archived: { $ne: true }
    });

    if (activeSurveyCount > 0) {
      const error = new Error(`Cannot archive consent form: it is being used by ${activeSurveyCount} active survey(s)`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the consent form
    consentForm.archived = true;
    consentForm.archivedAt = new Date();
    consentForm.isActive = false;
    if (req.user) {
      consentForm.lastUpdatedBy = req.user._id as any;
    }

    await consentForm.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Consent form archived successfully',
      data: consentForm
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * Get consent forms available for a project
 * @route GET /api/v1/consent-forms/available/:projectId
 * @access Private
 */
export const getAvailableConsentFormsForProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;

    // Validate project
    const project = await Project.findById(projectId).populate('organization');
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check access
    const hasAccess = userHasProjectAccess(req, projectId);
    if (!hasAccess) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get consent forms: project-specific, org-wide, and global templates
    const consentForms = await ConsentForm.find({
      archived: { $ne: true },
      isActive: true,
      $or: [
        { project: projectId }, // Project-specific
        { organization: project.organization, project: null }, // Org-wide
        { isTemplate: true, organization: null, project: null } // Global templates
      ]
    })
    .populate('organization', 'name')
    .populate('project', 'name')
    .populate('creator', 'name email')
    .sort({ isTemplate: -1, createdAt: -1 });

    // Group by scope for easier selection
    const grouped = {
      projectSpecific: consentForms.filter(cf => cf.project?.toString() === projectId),
      organizationWide: consentForms.filter(cf => cf.organization && !cf.project),
      globalTemplates: consentForms.filter(cf => cf.isTemplate && !cf.organization && !cf.project)
    };

    res.status(200).json({
      success: true,
      count: consentForms.length,
      data: {
        all: consentForms,
        grouped
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clone consent form
 * @route POST /api/v1/consent-forms/:id/clone
 * @access Private
 */
export const cloneConsentForm = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const consentFormId = req.params.id;
    const { name, projectId, organizationId } = req.body;

    const sourceConsentForm = await ConsentForm.findById(consentFormId);
    if (!sourceConsentForm) {
      const error = new Error('Source consent form not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check access to source
    if (!req.user?.isConnectGoStaff) {
      const hasOrgAccess = sourceConsentForm.organization && 
        userHasOrganizationAccess(req, sourceConsentForm.organization.toString());
      
      const hasProjectAccess = sourceConsentForm.project && 
        userHasProjectAccess(req, sourceConsentForm.project.toString());
      
      const isGlobalTemplate = sourceConsentForm.isTemplate && 
        !sourceConsentForm.organization && 
        !sourceConsentForm.project;

      if (!hasOrgAccess && !hasProjectAccess && !isGlobalTemplate) {
        const error = new Error('Not authorized to clone this consent form') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Validate target scope
    if (projectId) {
      const hasAccess = userHasProjectAccess(req, projectId);
      if (!hasAccess) {
        const error = new Error('Not authorized to create consent forms for target project') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    if (organizationId) {
      const hasAccess = userHasOrganizationAccess(req, organizationId);
      if (!hasAccess) {
        const error = new Error('Not authorized to create consent forms for target organization') as CustomError;
        error.statusCode = 403;
        throw error;
      }
    }

    // Clone the consent form
    const clonedConsentForm = new ConsentForm({
      ...sourceConsentForm.toObject(),
      _id: undefined,
      name: name || `${sourceConsentForm.name} (Copy)`,
      version: '1.0', // Reset version for clone
      project: projectId || null,
      organization: organizationId || null,
      isTemplate: false, // Clones are not templates by default
      creator: req.user?._id,
      lastUpdatedBy: req.user?._id,
      createdAt: undefined,
      updatedAt: undefined,
      archived: false,
      archivedAt: null
    });

    await clonedConsentForm.save({ session });
    await session.commitTransaction();

    const populatedClonedConsentForm = await ConsentForm.findById(clonedConsentForm._id)
      .populate('organization', 'name')
      .populate('project', 'name')
      .populate('creator', 'name email');

    res.status(201).json({
      success: true,
      message: 'Consent form cloned successfully',
      data: populatedClonedConsentForm
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Add to consentForm.controller.ts

/**
 * Get consent form for public survey (no auth required)
 * @route GET /api/v1/consent-forms/public/:consentFormId
 * @access Public
 */
export const getPublicConsentForm = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { consentFormId } = req.params;

    const consentForm = await ConsentForm.findById(consentFormId);

    if (!consentForm) {
      const error = new Error('Consent form not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!consentForm.isActive || consentForm.archived) {
      const error = new Error('Consent form is not available') as CustomError;
      error.statusCode = 410;
      throw error;
    }

    // Return only necessary fields for public view
    res.status(200).json({
      success: true,
      data: {
        _id: consentForm._id,
        name: consentForm.name,
        description: consentForm.description,
        agreementLabel: consentForm.agreementLabel,
        version: consentForm.version,
        defaultLanguage: consentForm.defaultLanguage,
        translations: consentForm.translations
      }
    });
  } catch (error) {
    next(error);
  }
};