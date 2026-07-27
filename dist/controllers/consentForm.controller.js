"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicConsentForm = exports.cloneConsentForm = exports.getAvailableConsentFormsForProject = exports.archiveConsentForm = exports.updateConsentForm = exports.getConsentForm = exports.getConsentForms = exports.createConsentForm = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const consentForm_model_1 = __importDefault(require("../models/consentForm.model"));
const survey_model_1 = __importDefault(require("../models/survey.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const organization_model_1 = __importDefault(require("../models/organization.model"));
const authHelpers_1 = require("../lib/authHelpers");
/**
 * Helper function to check if user has access to an organization
 */
const userHasOrganizationAccess = (req, organizationId) => {
    var _a;
    if (!req.user)
        return false;
    // ConnectGo staff have access to all organizations
    if (req.user.isConnectGoStaff)
        return true;
    // Check if user has any role in this organization
    return ((_a = req.user.roles) === null || _a === void 0 ? void 0 : _a.some(role => { var _a; return ((_a = role.organization) === null || _a === void 0 ? void 0 : _a.toString()) === organizationId; })) || false;
};
/**
 * Helper function to get all organization IDs the user has access to
 */
const getUserOrganizationIds = (req) => {
    var _a;
    if (!req.user)
        return [];
    // Extract unique organization IDs from user's roles
    const orgIds = ((_a = req.user.roles) === null || _a === void 0 ? void 0 : _a.filter(role => role.organization).map(role => role.organization.toString())) || [];
    return [...new Set(orgIds)]; // Remove duplicates
};
/**
 * Create a new consent form
 * @route POST /api/v1/consent-forms
 * @access Private
 */
const createConsentForm = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { name, description, version, organizationId, projectId, isTemplate, templateCategory, defaultLanguage, translations } = req.body;
        // Validate authentication
        if (!(0, authHelpers_1.isUserAuthenticated)(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Validate required fields
        if (!name || !description) {
            const error = new Error('Name and description are required');
            error.statusCode = 400;
            throw error;
        }
        // Validate scope
        if (projectId) {
            const project = yield project_model_1.default.findById(projectId).session(session);
            if (!project) {
                const error = new Error('Project not found');
                error.statusCode = 404;
                throw error;
            }
            // Check project access
            const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
            if (!hasAccess) {
                const error = new Error('Not authorized to create consent forms for this project');
                error.statusCode = 403;
                throw error;
            }
        }
        if (organizationId) {
            const organization = yield organization_model_1.default.findById(organizationId).session(session);
            if (!organization) {
                const error = new Error('Organization not found');
                error.statusCode = 404;
                throw error;
            }
            // Check if user has access to this organization
            const hasOrgAccess = userHasOrganizationAccess(req, organizationId);
            if (!hasOrgAccess) {
                const error = new Error('Not authorized to create consent forms for this organization');
                error.statusCode = 403;
                throw error;
            }
        }
        // Validate template category
        if (isTemplate && !templateCategory) {
            const error = new Error('Template category is required for template consent forms');
            error.statusCode = 400;
            throw error;
        }
        // Create the consent form
        const newConsentForm = new consentForm_model_1.default({
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
        yield newConsentForm.save({ session });
        yield session.commitTransaction();
        // Populate the response
        const populatedConsentForm = yield consentForm_model_1.default.findById(newConsentForm._id)
            .populate('organization', 'name')
            .populate('project', 'name')
            .populate('creator', 'name email');
        res.status(201).json({
            success: true,
            message: 'Consent form created successfully',
            data: populatedConsentForm
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.createConsentForm = createConsentForm;
/**
 * Get all consent forms with filtering
 * @route GET /api/v1/consent-forms
 * @access Private
 */
const getConsentForms = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { organization, project, isTemplate, isActive, templateCategory, page = 1, limit = 50, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        // Build filter object
        const filter = { archived: { $ne: true } };
        if (organization)
            filter.organization = organization;
        if (project)
            filter.project = project;
        if (isTemplate !== undefined)
            filter.isTemplate = isTemplate === 'true';
        if (isActive !== undefined)
            filter.isActive = isActive === 'true';
        if (templateCategory)
            filter.templateCategory = templateCategory;
        // Add search functionality
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        // Access control: non-staff users can only see their org/project consent forms
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const userOrgIds = getUserOrganizationIds(req);
            const userProjects = yield project_model_1.default.find({
                $or: [
                    { creator: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id },
                    { 'team.user': (_c = req.user) === null || _c === void 0 ? void 0 : _c._id }
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
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        // Execute query
        const [consentForms, totalCount] = yield Promise.all([
            consentForm_model_1.default.find(filter)
                .populate('organization', 'name')
                .populate('project', 'name')
                .populate('creator', 'name email')
                .sort(sort)
                .skip(skip)
                .limit(Number(limit)),
            consentForm_model_1.default.countDocuments(filter)
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
    }
    catch (error) {
        next(error);
    }
});
exports.getConsentForms = getConsentForms;
/**
 * Get single consent form
 * @route GET /api/v1/consent-forms/:id
 * @access Private
 */
const getConsentForm = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const consentFormId = req.params.id;
        const consentForm = yield consentForm_model_1.default.findById(consentFormId)
            .populate('organization', 'name')
            .populate('project', 'name')
            .populate('creator', 'name email')
            .populate('lastUpdatedBy', 'name email');
        if (!consentForm) {
            const error = new Error('Consent form not found');
            error.statusCode = 404;
            throw error;
        }
        if (consentForm.archived) {
            const error = new Error('Consent form is archived');
            error.statusCode = 410;
            throw error;
        }
        // Access control
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const hasOrgAccess = consentForm.organization &&
                userHasOrganizationAccess(req, consentForm.organization._id.toString());
            const hasProjectAccess = consentForm.project &&
                (0, authHelpers_1.userHasProjectAccess)(req, consentForm.project._id.toString());
            const isGlobalTemplate = consentForm.isTemplate &&
                !consentForm.organization &&
                !consentForm.project;
            if (!hasOrgAccess && !hasProjectAccess && !isGlobalTemplate) {
                const error = new Error('Not authorized to access this consent form');
                error.statusCode = 403;
                throw error;
            }
        }
        res.status(200).json({
            success: true,
            data: consentForm
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid consent form ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getConsentForm = getConsentForm;
/**
 * Update consent form
 * @route PUT /api/v1/consent-forms/:id
 * @access Private
 */
const updateConsentForm = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const consentFormId = req.params.id;
        const { name, description, agreementLabel, isActive, defaultLanguage, translations } = req.body;
        const consentForm = yield consentForm_model_1.default.findById(consentFormId);
        if (!consentForm) {
            const error = new Error('Consent form not found');
            error.statusCode = 404;
            throw error;
        }
        if (consentForm.archived) {
            const error = new Error('Cannot update an archived consent form');
            error.statusCode = 400;
            throw error;
        }
        // Check permissions
        const isCreator = consentForm.creator.toString() === ((_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString());
        const hasProjectAccess = consentForm.project &&
            (0, authHelpers_1.userHasProjectAccess)(req, consentForm.project.toString());
        const hasOrgAccess = consentForm.organization &&
            userHasOrganizationAccess(req, consentForm.organization.toString());
        if (!isCreator && !hasProjectAccess && !hasOrgAccess && !((_c = req.user) === null || _c === void 0 ? void 0 : _c.isConnectGoStaff)) {
            const error = new Error('Not authorized to update this consent form');
            error.statusCode = 403;
            throw error;
        }
        // Update fields
        if (name !== undefined)
            consentForm.name = name;
        if (description !== undefined)
            consentForm.description = description; // Version will auto-increment
        if (agreementLabel !== undefined)
            consentForm.agreementLabel = agreementLabel; // ADD
        if (isActive !== undefined)
            consentForm.isActive = isActive;
        if (defaultLanguage !== undefined)
            consentForm.defaultLanguage = defaultLanguage;
        if (translations !== undefined)
            consentForm.translations = translations;
        if (req.user) {
            consentForm.lastUpdatedBy = req.user._id;
        }
        yield consentForm.save({ session });
        yield session.commitTransaction();
        // Return updated consent form
        const updatedConsentForm = yield consentForm_model_1.default.findById(consentFormId)
            .populate('organization', 'name')
            .populate('project', 'name')
            .populate('creator', 'name email')
            .populate('lastUpdatedBy', 'name email');
        res.status(200).json({
            success: true,
            message: 'Consent form updated successfully',
            data: updatedConsentForm
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.updateConsentForm = updateConsentForm;
/**
 * Archive consent form
 * @route DELETE /api/v1/consent-forms/:id
 * @access Private
 */
const archiveConsentForm = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const consentFormId = req.params.id;
        const consentForm = yield consentForm_model_1.default.findById(consentFormId);
        if (!consentForm) {
            const error = new Error('Consent form not found');
            error.statusCode = 404;
            throw error;
        }
        if (consentForm.archived) {
            const error = new Error('Consent form is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Check permissions
        const isCreator = consentForm.creator.toString() === ((_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString());
        const hasProjectAccess = consentForm.project &&
            (0, authHelpers_1.userHasProjectAccess)(req, consentForm.project.toString());
        const hasOrgAccess = consentForm.organization &&
            userHasOrganizationAccess(req, consentForm.organization.toString());
        if (!isCreator && !hasProjectAccess && !hasOrgAccess && !((_c = req.user) === null || _c === void 0 ? void 0 : _c.isConnectGoStaff)) {
            const error = new Error('Not authorized to archive this consent form');
            error.statusCode = 403;
            throw error;
        }
        // Check if consent form is being used by active surveys
        const activeSurveyCount = yield survey_model_1.default.countDocuments({
            consentForm: consentFormId,
            status: { $in: ['draft', 'published'] },
            archived: { $ne: true }
        });
        if (activeSurveyCount > 0) {
            const error = new Error(`Cannot archive consent form: it is being used by ${activeSurveyCount} active survey(s)`);
            error.statusCode = 400;
            throw error;
        }
        // Archive the consent form
        consentForm.archived = true;
        consentForm.archivedAt = new Date();
        consentForm.isActive = false;
        if (req.user) {
            consentForm.lastUpdatedBy = req.user._id;
        }
        yield consentForm.save({ session });
        yield session.commitTransaction();
        res.status(200).json({
            success: true,
            message: 'Consent form archived successfully',
            data: consentForm
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.archiveConsentForm = archiveConsentForm;
/**
 * Get consent forms available for a project
 * @route GET /api/v1/consent-forms/available/:projectId
 * @access Private
 */
const getAvailableConsentFormsForProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.params;
        // Validate project
        const project = yield project_model_1.default.findById(projectId).populate('organization');
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check access
        const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
        if (!hasAccess) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        // Get consent forms: project-specific, org-wide, and global templates
        const consentForms = yield consentForm_model_1.default.find({
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
            projectSpecific: consentForms.filter(cf => { var _a; return ((_a = cf.project) === null || _a === void 0 ? void 0 : _a.toString()) === projectId; }),
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
    }
    catch (error) {
        next(error);
    }
});
exports.getAvailableConsentFormsForProject = getAvailableConsentFormsForProject;
/**
 * Clone consent form
 * @route POST /api/v1/consent-forms/:id/clone
 * @access Private
 */
const cloneConsentForm = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const consentFormId = req.params.id;
        const { name, projectId, organizationId } = req.body;
        const sourceConsentForm = yield consentForm_model_1.default.findById(consentFormId);
        if (!sourceConsentForm) {
            const error = new Error('Source consent form not found');
            error.statusCode = 404;
            throw error;
        }
        // Check access to source
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff)) {
            const hasOrgAccess = sourceConsentForm.organization &&
                userHasOrganizationAccess(req, sourceConsentForm.organization.toString());
            const hasProjectAccess = sourceConsentForm.project &&
                (0, authHelpers_1.userHasProjectAccess)(req, sourceConsentForm.project.toString());
            const isGlobalTemplate = sourceConsentForm.isTemplate &&
                !sourceConsentForm.organization &&
                !sourceConsentForm.project;
            if (!hasOrgAccess && !hasProjectAccess && !isGlobalTemplate) {
                const error = new Error('Not authorized to clone this consent form');
                error.statusCode = 403;
                throw error;
            }
        }
        // Validate target scope
        if (projectId) {
            const hasAccess = (0, authHelpers_1.userHasProjectAccess)(req, projectId);
            if (!hasAccess) {
                const error = new Error('Not authorized to create consent forms for target project');
                error.statusCode = 403;
                throw error;
            }
        }
        if (organizationId) {
            const hasAccess = userHasOrganizationAccess(req, organizationId);
            if (!hasAccess) {
                const error = new Error('Not authorized to create consent forms for target organization');
                error.statusCode = 403;
                throw error;
            }
        }
        // Clone the consent form
        const clonedConsentForm = new consentForm_model_1.default(Object.assign(Object.assign({}, sourceConsentForm.toObject()), { _id: undefined, name: name || `${sourceConsentForm.name} (Copy)`, version: '1.0', project: projectId || null, organization: organizationId || null, isTemplate: false, creator: (_b = req.user) === null || _b === void 0 ? void 0 : _b._id, lastUpdatedBy: (_c = req.user) === null || _c === void 0 ? void 0 : _c._id, createdAt: undefined, updatedAt: undefined, archived: false, archivedAt: null }));
        yield clonedConsentForm.save({ session });
        yield session.commitTransaction();
        const populatedClonedConsentForm = yield consentForm_model_1.default.findById(clonedConsentForm._id)
            .populate('organization', 'name')
            .populate('project', 'name')
            .populate('creator', 'name email');
        res.status(201).json({
            success: true,
            message: 'Consent form cloned successfully',
            data: populatedClonedConsentForm
        });
    }
    catch (error) {
        yield session.abortTransaction();
        next(error);
    }
    finally {
        session.endSession();
    }
});
exports.cloneConsentForm = cloneConsentForm;
// Add to consentForm.controller.ts
/**
 * Get consent form for public survey (no auth required)
 * @route GET /api/v1/consent-forms/public/:consentFormId
 * @access Public
 */
const getPublicConsentForm = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { consentFormId } = req.params;
        const consentForm = yield consentForm_model_1.default.findById(consentFormId);
        if (!consentForm) {
            const error = new Error('Consent form not found');
            error.statusCode = 404;
            throw error;
        }
        if (!consentForm.isActive || consentForm.archived) {
            const error = new Error('Consent form is not available');
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
    }
    catch (error) {
        next(error);
    }
});
exports.getPublicConsentForm = getPublicConsentForm;
//# sourceMappingURL=consentForm.controller.js.map