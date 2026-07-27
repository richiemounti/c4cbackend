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
exports.getEligibleReviewers = exports.getReviewsByModule = exports.getReviewStats = exports.getEscalatedReviews = exports.resolveIssue = exports.addIssue = exports.addReviewer = exports.inviteStaffCollaborator = exports.escalateReview = exports.updateReviewStatus = exports.getReviewsByModuleItem = exports.getReviewById = exports.getMyReviews = exports.createReviewManually = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const review_model_1 = __importDefault(require("../models/review.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const reviewHelpers_1 = require("../utils/reviewHelpers");
const streamChat_service_1 = require("../services/streamChat.service");
// Type guard to check if user is authenticated
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
// Safely extract an ID string from a field that may be a populated object or a plain ObjectId
function idStr(field) {
    var _a;
    if (!field)
        return '';
    return ((_a = field._id) !== null && _a !== void 0 ? _a : field).toString();
}
// Helper function to check if user has review access
function hasReviewAccess(user, review) {
    var _a, _b;
    const userId = user._id.toString();
    const isParticipant = idStr(review.submittedBy) === userId ||
        ((_a = review.reviewers) === null || _a === void 0 ? void 0 : _a.some((r) => idStr(r) === userId)) ||
        ((_b = review.chatParticipants) === null || _b === void 0 ? void 0 : _b.some((p) => idStr(p) === userId)) ||
        (review.escalatedTo && idStr(review.escalatedTo) === userId);
    // Staff: only see reviews they created or were explicitly invited to
    if (user.isConnectGoStaff) {
        return isParticipant;
    }
    // Client: org membership + review_management permission grants full access
    if (user.hasPermission('review_management') && user.hasOrganizationAccess(review.organizationId)) {
        return true;
    }
    // Fallback: direct participant
    return isParticipant;
}
/**
 * Create a new review
 * @route POST /api/v1/reviews
 * @access Private
 */
const createReviewManually = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { module, moduleItemId, organizationId, projectId, projectSiteId, title, description, priority, reviewers, nestedPath, nestedItemId, dueDate, } = req.body;
        // Validate required fields
        if (!module || !moduleItemId || !organizationId || !projectId || !title) {
            const error = new Error('Required fields missing: module, moduleItemId, organizationId, projectId, title');
            error.statusCode = 400;
            throw error;
        }
        // ✅ UPDATED: Check review_management permission OR org access
        const hasPermission = req.user.hasPermission('review_management');
        const hasOrgAccess = req.user.hasOrganizationAccess(organizationId);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasPermission && !hasOrgAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to create reviews for this organization');
            error.statusCode = 403;
            throw error;
        }
        // Check if review already exists for this module item
        const exists = yield (0, reviewHelpers_1.reviewExistsForModuleItem)(module, moduleItemId, nestedItemId);
        if (exists) {
            const error = new Error('A review already exists for this item');
            error.statusCode = 409;
            throw error;
        }
        // Create the review
        const review = yield (0, reviewHelpers_1.createReview)({
            module,
            moduleItemId,
            organizationId,
            projectId,
            projectSiteId,
            submittedBy: req.user._id,
            title,
            description,
            priority: priority || 'medium',
            nestedPath,
            nestedItemId,
            autoAssignReviewers: !reviewers || reviewers.length === 0,
        });
        // If specific reviewers provided, assign them
        if (reviewers && reviewers.length > 0) {
            for (const reviewerId of reviewers) {
                review.addReviewer(reviewerId, req.user._id);
            }
            yield review.save();
        }
        // Set due date if provided
        if (dueDate) {
            review.dueDate = new Date(dueDate);
            yield review.save();
        }
        // STREAM CHAT INTEGRATION: Sync users to Stream Chat
        try {
            yield (0, streamChat_service_1.upsertStreamChatUser)(req.user._id.toString(), {
                name: req.user.name,
                email: req.user.email,
                image: req.user.photo,
                role: req.user.primaryRole,
            });
            if (reviewers && reviewers.length > 0) {
                for (const reviewerId of reviewers) {
                    const reviewer = yield user_model_1.default.findById(reviewerId);
                    if (reviewer) {
                        yield (0, streamChat_service_1.upsertStreamChatUser)(reviewerId, {
                            name: reviewer.name,
                            email: reviewer.email,
                            image: reviewer.photo,
                            role: reviewer.primaryRole,
                        });
                    }
                }
            }
            console.log(`✅ Users synced to Stream Chat for review: ${review._id}`);
        }
        catch (streamChatError) {
            console.error('Failed to sync users to Stream Chat:', streamChatError);
        }
        // Populate the review
        const populatedReview = yield review_model_1.default.findById(review._id)
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .populate('organizationId', 'name')
            .populate('projectId', 'name');
        res.status(201).json({
            success: true,
            message: 'Review created successfully',
            data: populatedReview,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createReviewManually = createReviewManually;
/**
 * Get all reviews for a user (as submitter, reviewer, or escalated to)
 * @route GET /api/v1/reviews/my-reviews
 * @access Private
 */
const getMyReviews = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { status, priority, module } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        // Build query
        const query = {
            $or: [
                { submittedBy: req.user._id },
                { reviewers: req.user._id },
                { currentReviewer: req.user._id },
                { escalatedTo: req.user._id },
            ],
        };
        if (status) {
            query.status = status;
        }
        if (priority) {
            query.priority = priority;
        }
        if (module) {
            query.module = module;
        }
        // Get reviews with pagination
        const reviews = yield review_model_1.default.find(query)
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .populate('currentReviewer', 'name email')
            .populate('escalatedTo', 'name email')
            .populate('organizationId', 'name')
            .populate('projectId', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = yield review_model_1.default.countDocuments(query);
        res.status(200).json({
            success: true,
            count: reviews.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: reviews,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyReviews = getMyReviews;
/**
 * Get a single review by ID
 * @route GET /api/v1/reviews/:reviewId
 * @access Private
 */
const getReviewById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reviewId } = req.params;
        const review = yield review_model_1.default.findById(reviewId)
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .populate('currentReviewer', 'name email')
            .populate('escalatedTo', 'name email')
            .populate('resolvedBy', 'name email')
            .populate('organizationId', 'name')
            .populate('projectId', 'name')
            .populate('projectSiteId', 'name')
            .populate('issues.raisedBy', 'name email')
            .populate('issues.resolvedBy', 'name email')
            .populate('activityLog.performedBy', 'name email')
            .populate('chatParticipants', 'name email');
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // ✅ UPDATED: Use helper function with review_management check
        if (!hasReviewAccess(req.user, review)) {
            const error = new Error('Not authorized to access this review');
            error.statusCode = 403;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: review,
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid review ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getReviewById = getReviewById;
/**
 * Get reviews for a specific module item
 * @route GET /api/v1/reviews/module/:module/item/:moduleItemId
 * @access Private
 */
const getReviewsByModuleItem = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { module, moduleItemId } = req.params;
        const { nestedItemId } = req.query;
        // ✅ FIXED: Validate module type to prevent errors
        const validModules = [
            'stakeholder_group',
            'project_setup',
            'project_site_setup',
            'stakeholder_action',
            'social_impact',
            'toc_consultation_plan',
            'survey',
            'survey_question',
            'survey_translation',
        ];
        if (!validModules.includes(module)) {
            const error = new Error(`Invalid module type: ${module}. Valid types are: ${validModules.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }
        const query = {
            module,
            moduleItemId,
        };
        if (nestedItemId) {
            query.nestedItemId = nestedItemId;
        }
        // Staff visibility: staff only see reviews they are explicitly involved in
        if (req.user.isConnectGoStaff) {
            const userId = req.user._id;
            query.$or = [
                { submittedBy: userId },
                { reviewers: userId },
                { chatParticipants: userId },
                { escalatedTo: userId },
            ];
        }
        const reviews = yield review_model_1.default.find(query)
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .populate('escalatedTo', 'name email')
            .populate('organizationId', 'name')
            .populate('projectId', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReviewsByModuleItem = getReviewsByModuleItem;
/**
 * Update review status
 * @route PATCH /api/v1/reviews/:reviewId/status
 * @access Private
 */
const updateReviewStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reviewId } = req.params;
        const { status, reason } = req.body;
        if (!status) {
            const error = new Error('Status is required');
            error.statusCode = 400;
            throw error;
        }
        const review = yield review_model_1.default.findById(reviewId);
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // ✅ UPDATED: Use helper function with review_management check
        if (!hasReviewAccess(req.user, review)) {
            const error = new Error('Not authorized to change review status');
            error.statusCode = 403;
            throw error;
        }
        // Change status using the method
        review.changeStatus(status, req.user._id, reason);
        // If changing to in_review, set current reviewer
        if (status === 'in_review' && !review.currentReviewer) {
            review.currentReviewer = req.user._id;
        }
        yield review.save();
        const populatedReview = yield review_model_1.default.findById(reviewId)
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .populate('currentReviewer', 'name email')
            .populate('escalatedTo', 'name email');
        res.status(200).json({
            success: true,
            message: 'Review status updated successfully',
            data: populatedReview,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateReviewStatus = updateReviewStatus;
/**
 * Escalate review to staff
 * @route POST /api/v1/reviews/:reviewId/escalate
 * @access Private
 */
const escalateReview = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reviewId } = req.params;
        const { staffAccountManagerId, reason } = req.body;
        if (!reason) {
            const error = new Error('Escalation reason is required');
            error.statusCode = 400;
            throw error;
        }
        const review = yield review_model_1.default.findById(reviewId);
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // ✅ UPDATED: Use helper function with review_management check
        if (!hasReviewAccess(req.user, review)) {
            const error = new Error('Not authorized to escalate this review');
            error.statusCode = 403;
            throw error;
        }
        // Find account manager if not provided
        let accountManagerId = staffAccountManagerId;
        if (!accountManagerId) {
            const accountManager = yield (0, reviewHelpers_1.findAccountManagerForOrganization)(review.organizationId);
            if (!accountManager) {
                const error = new Error('No account manager found for this organization');
                error.statusCode = 404;
                throw error;
            }
            accountManagerId = accountManager._id;
        }
        // Verify the account manager is staff
        const staffUser = yield user_model_1.default.findById(accountManagerId);
        if (!staffUser || !staffUser.isConnectGoStaff) {
            const error = new Error('Invalid staff account manager');
            error.statusCode = 400;
            throw error;
        }
        // Escalate using the method
        review.escalate(accountManagerId, reason, req.user._id);
        yield review.save();
        // STREAM CHAT INTEGRATION: Add staff to chat channel
        try {
            if (review.streamChannelCreated && review.streamChannelId) {
                yield (0, streamChat_service_1.upsertStreamChatUser)(accountManagerId.toString(), {
                    name: staffUser.name,
                    email: staffUser.email,
                    image: staffUser.photo,
                    role: 'staff',
                });
                yield (0, streamChat_service_1.addChannelMember)(review.streamChannelId, accountManagerId.toString());
                yield (0, streamChat_service_1.sendSystemMessage)(review.streamChannelId, `🔔 Review escalated to ${staffUser.name} (Account Manager)`, req.user._id.toString());
                console.log(`✅ Staff added to Stream Chat channel: ${review.streamChannelId}`);
            }
        }
        catch (streamChatError) {
            console.error('Failed to add staff to Stream Chat channel:', streamChatError);
        }
        const populatedReview = yield review_model_1.default.findById(reviewId)
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .populate('escalatedTo', 'name email')
            .populate('escalatedBy', 'name email');
        res.status(200).json({
            success: true,
            message: 'Review escalated to staff successfully',
            data: populatedReview,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.escalateReview = escalateReview;
/**
 * Invite a staff collaborator to an escalated review.
 * Account managers can bring in other staff (analysts, admins, etc.)
 * to chime in and offer solutions on a review already escalated to them.
 * @route POST /api/v1/reviews/:reviewId/staff-collaborators
 * @access Private - Account Manager or ConnectGo Staff only
 */
const inviteStaffCollaborator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Only ConnectGo staff (account managers, admins, etc.) can invite collaborators
        if (!req.user.isConnectGoStaff) {
            const error = new Error('ConnectGo staff access required');
            error.statusCode = 403;
            throw error;
        }
        const { reviewId } = req.params;
        const { collaboratorId, message } = req.body;
        if (!collaboratorId) {
            const error = new Error('Collaborator ID is required');
            error.statusCode = 400;
            throw error;
        }
        const review = yield review_model_1.default.findById(reviewId);
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // Review must be escalated before staff can collaborate
        if (review.status !== 'escalated') {
            const error = new Error('Only escalated reviews can have staff collaborators added');
            error.statusCode = 400;
            throw error;
        }
        // Verify the collaborator exists and is ConnectGo staff
        const collaborator = yield user_model_1.default.findById(collaboratorId);
        if (!collaborator) {
            const error = new Error('Collaborator not found');
            error.statusCode = 404;
            throw error;
        }
        if (!collaborator.isConnectGoStaff) {
            const error = new Error('Collaborator must be a ConnectGo staff member');
            error.statusCode = 400;
            throw error;
        }
        // Check if already a participant
        const alreadyParticipant = review.chatParticipants.some((p) => p.toString() === collaboratorId);
        if (alreadyParticipant) {
            const error = new Error('This staff member is already a collaborator');
            error.statusCode = 409;
            throw error;
        }
        // Add to chat participants and log the activity
        review.chatParticipants.push(collaborator._id);
        review.addActivity('staff_collaborator_invited', req.user._id, message || `${collaborator.name} invited to collaborate on this review`, undefined, collaboratorId);
        yield review.save();
        // Stream Chat: sync collaborator and add to channel
        try {
            yield (0, streamChat_service_1.upsertStreamChatUser)(collaboratorId, {
                name: collaborator.name,
                email: collaborator.email,
                image: collaborator.photo,
                role: collaborator.primaryRole,
            });
            if (review.streamChannelCreated && review.streamChannelId) {
                yield (0, streamChat_service_1.addChannelMember)(review.streamChannelId, collaboratorId);
                yield (0, streamChat_service_1.sendSystemMessage)(review.streamChannelId, `🤝 ${collaborator.name} has been invited to collaborate on this review${message ? `: "${message}"` : ''}`, req.user._id.toString());
            }
        }
        catch (streamChatError) {
            console.error('Failed to add collaborator to Stream Chat channel:', streamChatError);
        }
        const populatedReview = yield review_model_1.default.findById(reviewId)
            .populate('chatParticipants', 'name email primaryRole photo')
            .populate('escalatedTo', 'name email')
            .populate('escalatedBy', 'name email');
        res.status(200).json({
            success: true,
            message: `${collaborator.name} has been invited to collaborate`,
            data: populatedReview,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.inviteStaffCollaborator = inviteStaffCollaborator;
/**
 * Add reviewer to review
 * @route POST /api/v1/reviews/:reviewId/reviewers
 * @access Private
 */
const addReviewer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reviewId } = req.params;
        const { reviewerId } = req.body;
        if (!reviewerId) {
            const error = new Error('Reviewer ID is required');
            error.statusCode = 400;
            throw error;
        }
        const review = yield review_model_1.default.findById(reviewId);
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to add reviewers
        const hasPermission = req.user.hasPermission('review_management');
        const hasOrgAccess = req.user.hasOrganizationAccess(review.organizationId);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasPermission && !hasOrgAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to add reviewers');
            error.statusCode = 403;
            throw error;
        }
        // Verify the reviewer exists
        const reviewerUser = yield user_model_1.default.findById(reviewerId);
        if (!reviewerUser) {
            const error = new Error('Reviewer not found');
            error.statusCode = 404;
            throw error;
        }
        // Validate who can be added as reviewer based on the requester's context
        if (reviewerUser.isConnectGoStaff) {
            // Staff can only be added if:
            // - The requester is also staff (staff inviting staff), OR
            // - The reviewer is an accountManager (clients can pull in an AM for help)
            const requesterIsStaff = req.user.isConnectGoStaff;
            const reviewerIsAccountManager = reviewerUser.primaryRole === 'accountManager';
            if (!requesterIsStaff && !reviewerIsAccountManager) {
                const error = new Error('Only account managers can be added to client reviews');
                error.statusCode = 400;
                throw error;
            }
        }
        else {
            // Client users: must have project or organization access
            const hasProjectAccess = reviewerUser.hasProjectAccess(review.projectId);
            const hasOrgAccessReviewer = reviewerUser.hasOrganizationAccess(review.organizationId);
            if (!hasProjectAccess && !hasOrgAccessReviewer) {
                const error = new Error('Reviewer does not have access to this project or organization');
                error.statusCode = 400;
                throw error;
            }
        }
        // Add reviewer using the method
        review.addReviewer(reviewerId, req.user._id);
        yield review.save();
        // STREAM CHAT INTEGRATION: Add reviewer to chat channel
        try {
            if (review.streamChannelCreated && review.streamChannelId) {
                yield (0, streamChat_service_1.upsertStreamChatUser)(reviewerId, {
                    name: reviewerUser.name,
                    email: reviewerUser.email,
                    image: reviewerUser.photo,
                    role: reviewerUser.primaryRole,
                });
                yield (0, streamChat_service_1.addChannelMember)(review.streamChannelId, reviewerId);
                yield (0, streamChat_service_1.sendSystemMessage)(review.streamChannelId, `${reviewerUser.name} was added as a reviewer`, req.user._id.toString());
                console.log(`✅ Reviewer added to Stream Chat channel: ${review.streamChannelId}`);
            }
        }
        catch (streamChatError) {
            console.error('Failed to add reviewer to Stream Chat channel:', streamChatError);
        }
        const populatedReview = yield review_model_1.default.findById(reviewId)
            .populate('reviewers', 'name email');
        res.status(200).json({
            success: true,
            message: 'Reviewer added successfully',
            data: populatedReview,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addReviewer = addReviewer;
/**
 * Add issue to review
 * @route POST /api/v1/reviews/:reviewId/issues
 * @access Private
 */
const addIssue = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reviewId } = req.params;
        const { field, issueType, severity, description, suggestedFix } = req.body;
        if (!issueType || !severity || !description) {
            const error = new Error('Required fields missing: issueType, severity, description');
            error.statusCode = 400;
            throw error;
        }
        const review = yield review_model_1.default.findById(reviewId);
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // ✅ UPDATED: Use helper function with review_management check
        if (!hasReviewAccess(req.user, review)) {
            const error = new Error('Not authorized to add issues to this review');
            error.statusCode = 403;
            throw error;
        }
        // Add issue using the method
        review.addIssue({
            field,
            issueType,
            severity,
            description,
            suggestedFix,
            raisedBy: req.user._id,
        });
        yield review.save();
        const populatedReview = yield review_model_1.default.findById(reviewId)
            .populate('issues.raisedBy', 'name email');
        res.status(200).json({
            success: true,
            message: 'Issue added successfully',
            data: populatedReview,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addIssue = addIssue;
/**
 * Resolve issue
 * @route PATCH /api/v1/reviews/:reviewId/issues/:issueId/resolve
 * @access Private
 */
const resolveIssue = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reviewId, issueId } = req.params;
        const { resolutionNotes } = req.body;
        const review = yield review_model_1.default.findById(reviewId);
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // ✅ UPDATED: Use helper function with review_management check
        if (!hasReviewAccess(req.user, review)) {
            const error = new Error('Not authorized to resolve issues in this review');
            error.statusCode = 403;
            throw error;
        }
        // Resolve issue using the method
        review.resolveIssue(new mongoose_1.default.Types.ObjectId(issueId), req.user._id, resolutionNotes);
        yield review.save();
        const populatedReview = yield review_model_1.default.findById(reviewId)
            .populate('issues.resolvedBy', 'name email');
        res.status(200).json({
            success: true,
            message: 'Issue resolved successfully',
            data: populatedReview,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.resolveIssue = resolveIssue;
/**
 * Get escalated reviews for staff
 * @route GET /api/v1/reviews/escalated
 * @access Private - Staff only
 */
const getEscalatedReviews = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('ConnectGo staff access required');
            error.statusCode = 403;
            throw error;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const query = {
            status: 'escalated',
        };
        // Account managers only see their assigned reviews
        if (req.user.primaryRole === 'accountManager') {
            query.escalatedTo = req.user._id;
        }
        const reviews = yield review_model_1.default.find(query)
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .populate('escalatedBy', 'name email')
            .populate('organizationId', 'name')
            .populate('projectId', 'name')
            .sort({ escalatedAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = yield review_model_1.default.countDocuments(query);
        res.status(200).json({
            success: true,
            count: reviews.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: reviews,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getEscalatedReviews = getEscalatedReviews;
/**
 * Get review statistics for dashboard
 * @route GET /api/v1/reviews/statistics/:organizationId
 * @access Private
 */
const getReviewStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { organizationId } = req.params;
        // ✅ UPDATED: Check review_management permission OR org access
        const hasPermission = req.user.hasPermission('review_management');
        const hasOrgAccess = req.user.hasOrganizationAccess(organizationId);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasPermission && !hasOrgAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to access organization statistics');
            error.statusCode = 403;
            throw error;
        }
        const stats = yield (0, reviewHelpers_1.getReviewStatistics)(new mongoose_1.default.Types.ObjectId(organizationId));
        const criticalReviews = yield (0, reviewHelpers_1.getCriticalReviews)(new mongoose_1.default.Types.ObjectId(organizationId));
        const overdueReviews = yield (0, reviewHelpers_1.getOverdueReviews)(new mongoose_1.default.Types.ObjectId(organizationId));
        const pendingCount = yield (0, reviewHelpers_1.getPendingReviewsCount)(req.user._id);
        res.status(200).json({
            success: true,
            data: {
                statistics: stats,
                criticalReviews,
                overdueReviews,
                myPendingCount: pendingCount,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReviewStats = getReviewStats;
/**
 * Get reviews by module and module item ID
 * @route GET /api/v1/reviews/module/:projectId/:module/:moduleItemId
 * @access Private
 */
const getReviewsByModule = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId, module, moduleItemId } = req.params;
        // ✅ FIXED: Validate module type
        const validModules = [
            'stakeholder_group',
            'project_setup',
            'project_site_setup',
            'stakeholder_action',
            'social_impact',
            'toc_consultation_plan',
            'survey',
            'survey_question',
            'survey_translation',
        ];
        if (!validModules.includes(module)) {
            const error = new Error(`Invalid module type: ${module}. Valid types are: ${validModules.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }
        // Check if user has access to this project
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // ✅ UPDATED: Check review_management permission OR project access
        const hasPermission = req.user.hasPermission('review_management');
        const hasProjectAccess = req.user.hasProjectAccess(project._id);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasPermission && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        // Find all reviews for this module item
        const reviews = yield review_model_1.default.find({
            projectId: new mongoose_1.default.Types.ObjectId(projectId),
            module: module,
            moduleItemId: new mongoose_1.default.Types.ObjectId(moduleItemId),
        })
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .populate('currentReviewer', 'name email')
            .populate('escalatedTo', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReviewsByModule = getReviewsByModule;
/**
 * Get eligible reviewers for a review
 * Users must have project access AND review_management permission
 * Excludes ConnectGo staff users
 * @route GET /api/v1/reviews/:reviewId/eligible-reviewers
 * @access Private
 */
const getEligibleReviewers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reviewId } = req.params;
        // Get the review to know which project and organization
        const review = yield review_model_1.default.findById(reviewId)
            .select('organizationId projectId submittedBy reviewers');
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has access to this review
        if (!hasReviewAccess(req.user, review)) {
            const error = new Error('Not authorized to access this review');
            error.statusCode = 403;
            throw error;
        }
        // Get current reviewer IDs to exclude them
        const currentReviewerIds = review.reviewers.map(r => r.toString());
        const baseExclude = {
            _id: {
                $ne: review.submittedBy,
                $nin: currentReviewerIds,
            },
            archived: false,
        };
        let eligibleUsers = [];
        if (req.user.isConnectGoStaff) {
            // Staff adding to a review: they can invite other ConnectGo staff members
            const staffUsers = yield user_model_1.default.find(Object.assign(Object.assign({}, baseExclude), { isConnectGoStaff: true, _id: Object.assign(Object.assign({}, baseExclude._id), { $ne: req.user._id, $nin: currentReviewerIds }) })).select('name email primaryRole photo');
            eligibleUsers = staffUsers.map(u => ({
                _id: u._id,
                name: u.name,
                email: u.email,
                role: u.primaryRole,
                photo: u.photo,
                isStaff: true,
            }));
        }
        else {
            // Client adding to a review:
            // 1. Client users who have org/project access
            const clientUsers = yield user_model_1.default.find(Object.assign(Object.assign({}, baseExclude), { isConnectGoStaff: false })).select('name email primaryRole roles photo');
            const clientEligible = clientUsers.filter(user => {
                return (user.hasProjectAccess(review.projectId) ||
                    user.hasOrganizationAccess(review.organizationId));
            });
            // 2. AccountManager staff (clients can bring in AM for help)
            const accountManagers = yield user_model_1.default.find(Object.assign(Object.assign({}, baseExclude), { isConnectGoStaff: true, primaryRole: 'accountManager', _id: { $ne: review.submittedBy, $nin: currentReviewerIds } })).select('name email primaryRole photo');
            eligibleUsers = [
                ...clientEligible.map(u => ({
                    _id: u._id,
                    name: u.name,
                    email: u.email,
                    role: u.primaryRole,
                    photo: u.photo,
                    isStaff: false,
                })),
                ...accountManagers.map(u => ({
                    _id: u._id,
                    name: u.name,
                    email: u.email,
                    role: u.primaryRole,
                    photo: u.photo,
                    isStaff: true,
                })),
            ];
        }
        const formattedUsers = eligibleUsers;
        res.status(200).json({
            success: true,
            count: formattedUsers.length,
            data: formattedUsers,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getEligibleReviewers = getEligibleReviewers;
// Update the default export at the bottom to include the new function
exports.default = {
    createReviewManually: exports.createReviewManually,
    getMyReviews: exports.getMyReviews,
    getReviewById: exports.getReviewById,
    getReviewsByModuleItem: exports.getReviewsByModuleItem,
    updateReviewStatus: exports.updateReviewStatus,
    escalateReview: exports.escalateReview,
    inviteStaffCollaborator: exports.inviteStaffCollaborator, // ✅ ADD
    addReviewer: // ✅ ADD
    exports.addReviewer,
    addIssue: exports.addIssue,
    resolveIssue: exports.resolveIssue,
    getEscalatedReviews: exports.getEscalatedReviews,
    getReviewStats: exports.getReviewStats,
    getReviewsByModule: exports.getReviewsByModule,
    getEligibleReviewers: exports.getEligibleReviewers, // ✅ ADD THIS
};
//# sourceMappingURL=review.controller.js.map