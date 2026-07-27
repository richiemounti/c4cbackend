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
exports.createReview = createReview;
exports.createStakeholderGroupTaskReview = createStakeholderGroupTaskReview;
exports.createProjectSetupTaskReview = createProjectSetupTaskReview;
exports.createProjectSiteSetupTaskReview = createProjectSiteSetupTaskReview;
exports.createStakeholderActionReview = createStakeholderActionReview;
exports.createSocialImpactReview = createSocialImpactReview;
exports.createTOCConsultationPlanReview = createTOCConsultationPlanReview;
exports.createSurveyConfigReview = createSurveyConfigReview;
exports.createSurveyQuestionReview = createSurveyQuestionReview;
exports.createSurveyTranslationReview = createSurveyTranslationReview;
exports.findAccountManagerForOrganization = findAccountManagerForOrganization;
exports.getAccountManagerWorkloadStats = getAccountManagerWorkloadStats;
exports.reviewExistsForModuleItem = reviewExistsForModuleItem;
exports.getPendingReviewsCount = getPendingReviewsCount;
exports.getCriticalReviews = getCriticalReviews;
exports.getOverdueReviews = getOverdueReviews;
exports.getReviewStatistics = getReviewStatistics;
exports.generateReviewTitle = generateReviewTitle;
// utils/reviewHelpers.ts
const review_model_1 = __importDefault(require("../models/review.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Creates a review with optional auto-assignment of reviewers
 */
function createReview(params) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { module, moduleItemId, organizationId, projectId, projectSiteId, submittedBy, title, description, priority = 'medium', nestedPath, nestedItemId, autoAssignReviewers = true, } = params;
        // Create the review
        const review = yield review_model_1.default.create({
            organizationId,
            projectId,
            projectSiteId,
            module,
            moduleItemId,
            nestedPath,
            nestedItemId,
            title,
            description,
            submittedBy,
            priority,
            status: 'pending',
            chatParticipants: [submittedBy],
        });
        // Auto-assign reviewers if requested
        if (autoAssignReviewers) {
            let submitterIsStaff = false;
            if (submittedBy) {
                const submitter = yield user_model_1.default.findById(submittedBy).select('isConnectGoStaff');
                submitterIsStaff = (_a = submitter === null || submitter === void 0 ? void 0 : submitter.isConnectGoStaff) !== null && _a !== void 0 ? _a : false;
            }
            const reviewers = yield getDefaultReviewers(organizationId, projectId, submittedBy, submitterIsStaff);
            if (reviewers.length > 0) {
                review.reviewers = reviewers.map(r => r._id);
                review.chatParticipants = [
                    ...review.chatParticipants,
                    ...reviewers.map(r => r._id)
                ];
                yield review.save();
            }
        }
        return review;
    });
}
/**
 * Gets default reviewers for an organization/project.
 *
 * Staff-triggered reviews route to the least-loaded accountManager.
 * Client-triggered reviews route to org manager(s), falling back to project creator.
 */
function getDefaultReviewers(organizationId, projectId, submittedBy, submitterIsStaff) {
    return __awaiter(this, void 0, void 0, function* () {
        const reviewers = [];
        if (submitterIsStaff) {
            // Staff-triggered: assign to the least-loaded accountManager
            const accountManager = yield findAccountManagerForOrganization(organizationId);
            if (accountManager) {
                const amId = accountManager._id;
                if (!submittedBy || amId.toString() !== submittedBy.toString()) {
                    reviewers.push({ _id: amId });
                }
            }
            return reviewers;
        }
        // Client-triggered: find org manager(s)
        const managerRoleUsers = yield user_model_1.default.find(Object.assign({ 'roles.role': 'manager', 'roles.organization': organizationId, archived: false }, (submittedBy && { _id: { $ne: submittedBy } }))).limit(3);
        reviewers.push(...managerRoleUsers.map(u => ({ _id: u._id })));
        // Fallback to project creator if no managers found
        if (reviewers.length === 0) {
            const Project = mongoose_1.default.model('Project');
            const project = yield Project.findById(projectId).populate('creator');
            if (project && project.creator) {
                const creator = project.creator;
                const creatorId = creator._id;
                if (!submittedBy || creatorId.toString() !== submittedBy.toString()) {
                    reviewers.push({ _id: creatorId });
                }
            }
        }
        return reviewers;
    });
}
/**
 * Auto-creates review for StakeholderGroup task completion
 * UPDATED: Enhanced with better titles, descriptions, and priority logic
 */
function createStakeholderGroupTaskReview(stakeholderGroup, taskIndex, completedBy) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const task = stakeholderGroup.tasks[taskIndex];
        // Only create review if task has rating and responses
        if (!task.rating || !task.responses || task.responses.length === 0) {
            return null;
        }
        // ============================================================================
        // 🆕 ENHANCED: Human-readable task type labels
        // ============================================================================
        const taskTypeLabels = {
            connections: 'Connections Analysis',
            power: 'Power Dynamics',
            wellbeing: 'Wellbeing Assessment',
            roles: 'Roles & Responsibilities',
            risks: 'Risk Assessment',
            benefits: 'Benefits Analysis'
        };
        // ============================================================================
        // 🆕 ENHANCED: Better title format with category
        // ============================================================================
        const taskLabel = taskTypeLabels[task.taskType] || task.taskType;
        const categoryName = ((_a = stakeholderGroup.category) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Category';
        const title = `${taskLabel} - ${stakeholderGroup.name} (${categoryName})`;
        // ============================================================================
        // 🆕 ENHANCED: Rich description with all task details
        // ============================================================================
        const responseCount = ((_b = task.responses) === null || _b === void 0 ? void 0 : _b.length) || 0;
        const rating = task.rating || 'Not rated';
        const tags = ((_c = task.tags) === null || _c === void 0 ? void 0 : _c.join(', ')) || 'None';
        const projectName = ((_d = stakeholderGroup.project) === null || _d === void 0 ? void 0 : _d.name) || 'Unknown Project';
        const siteName = (_e = stakeholderGroup.projectSite) === null || _e === void 0 ? void 0 : _e.name;
        const description = `
Review required for stakeholder mapping task completion.

**Stakeholder Group:** ${stakeholderGroup.name}
**Category:** ${categoryName}
**Task Type:** ${taskLabel}
**Responses Provided:** ${responseCount}
**Rating:** ${rating}/5
**Tags:** ${tags}
**Project:** ${projectName}
${siteName ? `**Project Site:** ${siteName}` : ''}

Please review the stakeholder mapping responses for accuracy and completeness.
  `.trim();
        // ============================================================================
        // 🆕 ENHANCED: Priority based on BOTH rating AND task type
        // ============================================================================
        let priority;
        // Critical tasks (risks/benefits) with low ratings
        if ((task.taskType === 'risks' || task.taskType === 'benefits') && task.rating <= 2) {
            priority = 'critical';
        }
        // Critical tasks (risks/benefits) regardless of rating
        else if (task.taskType === 'risks' || task.taskType === 'benefits') {
            priority = 'high';
        }
        // Any task with very low rating
        else if (task.rating === 1) {
            priority = 'high';
        }
        // Any task with low rating
        else if (task.rating === 2) {
            priority = 'medium';
        }
        // Connections task (typically less critical)
        else if (task.taskType === 'connections') {
            priority = 'low';
        }
        // Default for other tasks
        else {
            priority = 'medium';
        }
        // ============================================================================
        // Create the review with enhanced details
        // ============================================================================
        return createReview({
            module: 'stakeholder_group',
            moduleItemId: stakeholderGroup._id,
            organizationId: stakeholderGroup.project.organization,
            projectId: stakeholderGroup.project._id,
            projectSiteId: (_f = stakeholderGroup.projectSite) === null || _f === void 0 ? void 0 : _f._id,
            submittedBy: completedBy,
            title,
            description,
            priority,
            nestedPath: `tasks.${taskIndex}`,
            nestedItemId: task._id.toString(),
            autoAssignReviewers: true, // ✅ Auto-assign reviewers
        });
    });
}
/**
 * Auto-creates review for ProjectSetup task completion
 * ENHANCED: Better titles, shows response data, smarter priority logic
 */
function createProjectSetupTaskReview(projectSetup, taskIndex, completedBy) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const task = projectSetup.tasks[taskIndex];
        // Only create review if task is completed
        if (!task.isCompleted) {
            return null;
        }
        // ============================================================================
        // 🆕 ENHANCED: Better title with project context
        // ============================================================================
        const projectName = ((_a = projectSetup.project) === null || _a === void 0 ? void 0 : _a.name) || 'Project';
        const stepNumber = task.step || '';
        const stepInfo = stepNumber ? ` (Step ${stepNumber})` : '';
        const title = `${task.fieldLabel}${stepInfo} - ${projectName}`;
        // ============================================================================
        // 🆕 ENHANCED: Format response data for display
        // ============================================================================
        const responseDataFormatted = formatResponseData(task.responseData, task.dataType);
        // ============================================================================
        // 🆕 ENHANCED: Rich description with actual response data
        // ============================================================================
        const description = `
**Project:** ${projectName}
**Task:** ${task.fieldLabel}
**Field Type:** ${task.dataType}
**Required:** ${task.isRequired ? 'Yes' : 'No'}

**Response:**
${responseDataFormatted}

${task.description ? `**Context:** ${task.description}` : ''}

Please review this project setup task for accuracy and completeness.
  `.trim();
        // ============================================================================
        // 🆕 ENHANCED: Smarter priority logic
        // ============================================================================
        let priority;
        // Critical fields that need immediate attention
        const criticalFields = [
            'certification_standard',
            'country',
            'land_agreements_uploaded',
            'overlapping_claims',
            'conflict_history',
            'political_risk'
        ];
        if (criticalFields.includes(task.fieldName)) {
            priority = 'critical';
        }
        // Required tasks are high priority
        else if (task.isRequired) {
            priority = 'high';
        }
        // File uploads need attention
        else if (task.dataType === 'file') {
            priority = 'high';
        }
        // Boolean fields about risks/conflicts
        else if (task.dataType === 'boolean' &&
            (task.fieldName.includes('risk') ||
                task.fieldName.includes('conflict') ||
                task.fieldName.includes('issue'))) {
            priority = 'high';
        }
        // Default for optional fields
        else {
            priority = 'medium';
        }
        return createReview({
            module: 'project_setup',
            moduleItemId: projectSetup._id,
            organizationId: projectSetup.project.organization,
            projectId: projectSetup.project._id,
            submittedBy: completedBy,
            title,
            description,
            priority,
            nestedPath: `tasks`,
            nestedItemId: task._id.toString(),
            autoAssignReviewers: true,
        });
    });
}
// ============================================================================
/**
 * Auto-creates review for ProjectSiteSetup task completion
 * ENHANCED: Better titles, shows response data, smarter priority logic
 */
function createProjectSiteSetupTaskReview(projectSiteSetup, taskIndex, completedBy) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const task = projectSiteSetup.tasks[taskIndex];
        if (!task.isCompleted) {
            return null;
        }
        // ============================================================================
        // 🆕 ENHANCED: Better title with site context
        // ============================================================================
        const siteName = ((_a = projectSiteSetup.projectSite) === null || _a === void 0 ? void 0 : _a.name) || 'Site';
        const projectName = ((_b = projectSiteSetup.project) === null || _b === void 0 ? void 0 : _b.name) || 'Project';
        const stepNumber = task.step || '';
        const stepInfo = stepNumber ? ` (Step ${stepNumber})` : '';
        const title = `${task.fieldLabel}${stepInfo} - ${siteName}`;
        // ============================================================================
        // 🆕 ENHANCED: Format response data for display
        // ============================================================================
        const responseDataFormatted = formatResponseData(task.responseData, task.dataType);
        // ============================================================================
        // 🆕 ENHANCED: Rich description with actual response data
        // ============================================================================
        const description = `
**Project:** ${projectName}
**Site:** ${siteName}
**Task:** ${task.fieldLabel}
**Field Type:** ${task.dataType}
**Required:** ${task.isRequired ? 'Yes' : 'No'}

**Response:**
${responseDataFormatted}

${task.description ? `**Context:** ${task.description}` : ''}

Please review this project site setup task for accuracy and completeness.
  `.trim();
        // ============================================================================
        // 🆕 ENHANCED: Smarter priority logic
        // ============================================================================
        let priority;
        // Critical site-level fields
        const criticalFields = [
            'site_name',
            'estimated_population',
            'vulnerable_groups_present',
            'wildlife_conflict_present',
            'ethnic_groups_present'
        ];
        if (criticalFields.includes(task.fieldName)) {
            priority = 'critical';
        }
        // Required tasks are high priority
        else if (task.isRequired) {
            priority = 'high';
        }
        // Demographic/social data needs careful review
        else if (task.fieldName.includes('demographic') ||
            task.fieldName.includes('population') ||
            task.fieldName.includes('vulnerability') ||
            task.fieldName.includes('conflict')) {
            priority = 'high';
        }
        // File uploads need attention
        else if (task.dataType === 'file') {
            priority = 'high';
        }
        // Default for optional fields
        else {
            priority = 'medium';
        }
        return createReview({
            module: 'project_site_setup',
            moduleItemId: projectSiteSetup._id,
            organizationId: projectSiteSetup.project.organization,
            projectId: projectSiteSetup.project._id,
            projectSiteId: projectSiteSetup.projectSite._id,
            submittedBy: completedBy,
            title,
            description,
            priority,
            nestedPath: `tasks`,
            nestedItemId: task._id.toString(),
            autoAssignReviewers: true,
        });
    });
}
/**
 * Auto-creates review for StakeholderAction (ToC Stage 1)
 */
function createStakeholderActionReview(stakeholderAction, createdBy) {
    return __awaiter(this, void 0, void 0, function* () {
        const title = `Review: Stakeholder Action - ${stakeholderAction.action.substring(0, 50)}`;
        const description = `Review action for stakeholder group. Status: ${stakeholderAction.status}, Priority: ${stakeholderAction.priority}`;
        // Match action priority to review priority
        const priority = stakeholderAction.priority || 'medium';
        return createReview({
            module: 'stakeholder_action',
            moduleItemId: stakeholderAction._id,
            organizationId: stakeholderAction.project.organization,
            projectId: stakeholderAction.project,
            projectSiteId: stakeholderAction.projectSite,
            submittedBy: createdBy,
            title,
            description,
            priority,
        });
    });
}
/**
 * Auto-creates review for SocialImpact (ToC Stage 2)
 */
function createSocialImpactReview(socialImpact, createdBy) {
    return __awaiter(this, void 0, void 0, function* () {
        const title = `Review: Social Impact - ${socialImpact.outcome.substring(0, 50)}`;
        const description = `Review impact outcome. Status: ${socialImpact.status}, Risks: ${socialImpact.risks.length}`;
        // Higher priority if there are risks
        const priority = socialImpact.risks.length > 0 ? 'high' : 'medium';
        return createReview({
            module: 'social_impact',
            moduleItemId: socialImpact._id,
            organizationId: socialImpact.project.organization,
            projectId: socialImpact.project,
            projectSiteId: socialImpact.projectSite,
            submittedBy: createdBy,
            title,
            description,
            priority,
        });
    });
}
/**
 * Auto-creates review for TOCConsultationPlan
 */
function createTOCConsultationPlanReview(tocPlan, completedBy) {
    return __awaiter(this, void 0, void 0, function* () {
        // Only create review when plan is marked as completed
        if (!tocPlan.isCompleted) {
            return null;
        }
        const title = `Review: TOC Consultation Plan`;
        const description = `Review consultation plan with ${tocPlan.selectedStakeholderCount} stakeholder groups selected`;
        return createReview({
            module: 'toc_consultation_plan',
            moduleItemId: tocPlan._id,
            organizationId: tocPlan.project.organization,
            projectId: tocPlan.project,
            projectSiteId: tocPlan.projectSite,
            submittedBy: completedBy,
            title,
            description,
            priority: 'high', // Consultation plans are important
        });
    });
}
/**
 * Auto-creates review for Survey configuration
 * ENHANCED: Shows all critical configuration details
 */
function createSurveyConfigReview(survey, createdBy) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        // Only create review when survey is published
        if (survey.status !== 'published') {
            return null;
        }
        // ============================================================================
        // 🆕 ENHANCED: Better title with context
        // ============================================================================
        const projectName = ((_a = survey.project) === null || _a === void 0 ? void 0 : _a.name) || 'Project';
        const stakeholderName = ((_b = survey.stakeholderGroup) === null || _b === void 0 ? void 0 : _b.name) || 'All Stakeholders';
        const categoryLabel = survey.category ? ` (${survey.category})` : '';
        const title = `Survey: ${survey.title}${categoryLabel} - ${stakeholderName}`;
        // ============================================================================
        // 🆕 ENHANCED: Rich description with all configuration details
        // ============================================================================
        // Format category with icon
        const categoryLabels = {
            baseline: '📊 Baseline Survey',
            monitoring: '📈 Monitoring Survey',
            endline: '🎯 Endline Survey',
            evaluation: '📋 Evaluation Survey',
            other: '📝 Other Survey'
        };
        const categoryInfo = categoryLabels[survey.category] || survey.category || 'Not specified';
        // Format access settings
        const accessInfo = [];
        if ((_c = survey.settings) === null || _c === void 0 ? void 0 : _c.isPublic)
            accessInfo.push('Public');
        if ((_d = survey.settings) === null || _d === void 0 ? void 0 : _d.requiresAuth)
            accessInfo.push('Requires authentication');
        if ((_e = survey.settings) === null || _e === void 0 ? void 0 : _e.allowAnonymous)
            accessInfo.push('Anonymous responses allowed');
        const access = accessInfo.length > 0 ? accessInfo.join(', ') : 'Not configured';
        // Format response controls
        const responseControls = [];
        if ((_f = survey.settings) === null || _f === void 0 ? void 0 : _f.allowMultipleResponses) {
            responseControls.push('Multiple responses allowed');
        }
        else {
            responseControls.push('One response per user');
        }
        if ((_g = survey.settings) === null || _g === void 0 ? void 0 : _g.maxResponses) {
            responseControls.push(`Max responses: ${survey.settings.maxResponses}`);
        }
        if ((_h = survey.settings) === null || _h === void 0 ? void 0 : _h.allowSaveAndContinue) {
            responseControls.push('Save & continue enabled');
        }
        const controls = responseControls.join('\n• ');
        // Format sampling calculator
        let samplingInfo = 'Not configured';
        if ((_k = (_j = survey.settings) === null || _j === void 0 ? void 0 : _j.samplingCalculator) === null || _k === void 0 ? void 0 : _k.isEnabled) {
            const calc = survey.settings.samplingCalculator;
            samplingInfo = `Enabled
• Confidence Level: ${calc.confidenceLevel}%
• Margin of Error: ${calc.marginOfError}%
• Calculated Sample Size: ${calc.calculatedSampleSize || 'Not calculated'}`;
        }
        // Format survey features
        const features = [];
        if ((_l = survey.settings) === null || _l === void 0 ? void 0 : _l.showProgressBar)
            features.push('Progress bar');
        if ((_m = survey.settings) === null || _m === void 0 ? void 0 : _m.randomizeQuestions)
            features.push('Question randomization');
        if ((_o = survey.settings) === null || _o === void 0 ? void 0 : _o.sendConfirmationEmail)
            features.push('Confirmation emails');
        if ((_p = survey.settings) === null || _p === void 0 ? void 0 : _p.notifyOnResponse)
            features.push('Response notifications');
        const featuresInfo = features.length > 0 ? features.join(', ') : 'None enabled';
        // Format languages
        const languagesInfo = survey.availableLanguages && survey.availableLanguages.length > 0
            ? `${survey.availableLanguages.length} languages (Default: ${survey.defaultLanguage})`
            : `Single language (${survey.defaultLanguage || 'en'})`;
        // Format ToC stage
        const tocStageInfo = ((_q = survey.theoryOfChangeStage) === null || _q === void 0 ? void 0 : _q.name) || 'Not linked to ToC stage';
        const description = `
**Project:** ${projectName}
**Stakeholder Group:** ${stakeholderName}
**Category:** ${categoryInfo}
**Status:** ${survey.status}
**Sequence:** #${survey.sequenceNumber || 'Not set'}

**Survey Details:**
Title: ${survey.title}
Description: ${survey.description || 'No description provided'}
Questions: ${survey.totalQuestions || 0}
Estimated Duration: ${survey.estimatedDuration || 0} minutes
Languages: ${languagesInfo}

**Access & Privacy:**
${access}

**Response Controls:**
• ${controls}

**Sampling Configuration:**
${samplingInfo}

**Features:**
${featuresInfo}

**Theory of Change:**
${tocStageInfo}

Please review this survey configuration for appropriateness, sampling adequacy, and data protection compliance.
  `.trim();
        // ============================================================================
        // 🆕 ENHANCED: Smarter priority logic
        // ============================================================================
        let priority;
        // Critical if baseline/endline survey OR high response limit
        if ((survey.category === 'baseline' || survey.category === 'endline') ||
            (((_r = survey.settings) === null || _r === void 0 ? void 0 : _r.maxResponses) && survey.settings.maxResponses > 1000)) {
            priority = 'critical';
        }
        // High if sampling calculator enabled OR allows anonymous responses OR no questions yet
        else if (((_t = (_s = survey.settings) === null || _s === void 0 ? void 0 : _s.samplingCalculator) === null || _t === void 0 ? void 0 : _t.isEnabled) ||
            ((_u = survey.settings) === null || _u === void 0 ? void 0 : _u.allowAnonymous) ||
            !survey.totalQuestions || survey.totalQuestions === 0) {
            priority = 'high';
        }
        // Medium if monitoring survey OR has questions
        else if (survey.category === 'monitoring' ||
            (survey.totalQuestions && survey.totalQuestions > 0)) {
            priority = 'medium';
        }
        // Low for other surveys
        else {
            priority = 'low';
        }
        return createReview({
            module: 'survey',
            moduleItemId: survey._id,
            organizationId: survey.project.organization,
            projectId: survey.project._id,
            projectSiteId: (_v = survey.projectSite) === null || _v === void 0 ? void 0 : _v._id,
            submittedBy: createdBy,
            title,
            description,
            priority,
            autoAssignReviewers: true,
        });
    });
}
// ============================================================================
/**
 * Auto-creates review for SurveyQuestion
 * ENHANCED: Shows question content and configuration details
 */
function createSurveyQuestionReview(surveyQuestion, createdBy) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        // Populate question and survey if not already populated
        if (!((_a = surveyQuestion.question) === null || _a === void 0 ? void 0 : _a.text)) {
            yield surveyQuestion.populate('question');
        }
        if (!((_b = surveyQuestion.survey) === null || _b === void 0 ? void 0 : _b.title)) {
            yield surveyQuestion.populate('survey');
        }
        if (surveyQuestion.section && !((_c = surveyQuestion.section) === null || _c === void 0 ? void 0 : _c.title)) {
            yield surveyQuestion.populate('section');
        }
        const question = surveyQuestion.question;
        const survey = surveyQuestion.survey;
        const section = surveyQuestion.section;
        // ============================================================================
        // 🆕 ENHANCED: Better title with context
        // ============================================================================
        const questionPreview = ((_d = question.text) === null || _d === void 0 ? void 0 : _d.substring(0, 60)) || 'Question';
        const surveyTitle = survey.title || 'Survey';
        const title = `Question: ${questionPreview}${question.text && question.text.length > 60 ? '...' : ''} - ${surveyTitle}`;
        // ============================================================================
        // 🆕 ENHANCED: Rich description with question details
        // ============================================================================
        // Format question type with icon
        const typeIcons = {
            'single_choice': '◉',
            'multiple_choice': '☑',
            'text': '📝',
            'number': '🔢',
            'date': '📅',
            'rating': '⭐',
            'scale': '📊',
            'yes_no': '✓/✗',
            'dropdown': '▼',
            'file_upload': '📎',
            'matrix': '⊞'
        };
        const typeIcon = typeIcons[question.type] || '❓';
        const questionType = `${typeIcon} ${question.type || 'unknown'}`;
        // Format question options
        let optionsInfo = 'No options';
        if (question.options && question.options.length > 0) {
            optionsInfo = question.options.map((opt, i) => `${i + 1}. ${opt.text || opt}`).join('\n');
        }
        // Custom options override
        if (surveyQuestion.customOptions && surveyQuestion.customOptions.length > 0) {
            optionsInfo = `Custom options:\n${surveyQuestion.customOptions.map((opt, i) => `${i + 1}. ${opt.text || opt}`).join('\n')}`;
        }
        // Format conditional logic
        let conditionalInfo = 'No conditional logic';
        if ((_e = surveyQuestion.conditionalLogic) === null || _e === void 0 ? void 0 : _e.enabled) {
            const conditions = surveyQuestion.conditionalLogic.conditions || [];
            if (conditions.length > 0) {
                conditionalInfo = `${surveyQuestion.conditionalLogic.action === 'show' ? 'Show' : 'Hide'} if:\n${conditions.map((c, i) => `${i + 1}. Question ${c.questionId} ${c.operator} "${c.value}"`).join('\n')}`;
            }
        }
        // Format section info
        const sectionInfo = (section === null || section === void 0 ? void 0 : section.title)
            ? `${section.title} (Order: ${surveyQuestion.order})`
            : `Order: ${surveyQuestion.order}`;
        // Format validation rules
        let validationInfo = 'No validation';
        if (question.validation) {
            const rules = [];
            if (question.validation.required)
                rules.push('Required field');
            if (question.validation.minLength)
                rules.push(`Min length: ${question.validation.minLength}`);
            if (question.validation.maxLength)
                rules.push(`Max length: ${question.validation.maxLength}`);
            if (question.validation.min)
                rules.push(`Min value: ${question.validation.min}`);
            if (question.validation.max)
                rules.push(`Max value: ${question.validation.max}`);
            if (question.validation.pattern)
                rules.push(`Pattern: ${question.validation.pattern}`);
            if (rules.length > 0) {
                validationInfo = rules.join('\n• ');
            }
        }
        // Format metadata
        const metadata = [];
        if (question.theme)
            metadata.push(`Theme: ${question.theme.name || question.theme}`);
        if (question.subTheme)
            metadata.push(`Sub-theme: ${question.subTheme.name || question.subTheme}`);
        if (question.indicator)
            metadata.push(`Indicator: ${question.indicator.name || question.indicator}`);
        const metadataInfo = metadata.length > 0 ? metadata.join('\n') : 'No metadata';
        const description = `
**Survey:** ${survey.title}
**Section:** ${sectionInfo}
**Question Type:** ${questionType}
**Required:** ${surveyQuestion.required ? '✅ Yes' : '❌ No'}

**Question Text:**
${question.text}

${question.helperText ? `**Helper Text:**\n${question.helperText}\n` : ''}

**Options:**
${optionsInfo}

**Conditional Logic:**
${conditionalInfo}

**Validation:**
• ${validationInfo}

**Metadata:**
${metadataInfo}

Please review this question for clarity, appropriateness, and proper configuration.
  `.trim();
        // ============================================================================
        // 🆕 ENHANCED: Smarter priority logic
        // ============================================================================
        let priority;
        // Critical if required question with conditional logic OR file upload type
        if ((surveyQuestion.required && ((_f = surveyQuestion.conditionalLogic) === null || _f === void 0 ? void 0 : _f.enabled)) ||
            question.type === 'file_upload') {
            priority = 'critical';
        }
        // High if required OR has complex conditional logic OR has validation
        else if (surveyQuestion.required ||
            (((_g = surveyQuestion.conditionalLogic) === null || _g === void 0 ? void 0 : _g.enabled) && ((_h = surveyQuestion.conditionalLogic.conditions) === null || _h === void 0 ? void 0 : _h.length) > 1) ||
            (question.validation && Object.keys(question.validation).length > 1)) {
            priority = 'high';
        }
        // Medium if has conditional logic OR custom options
        else if (((_j = surveyQuestion.conditionalLogic) === null || _j === void 0 ? void 0 : _j.enabled) ||
            (surveyQuestion.customOptions && surveyQuestion.customOptions.length > 0)) {
            priority = 'medium';
        }
        // Low for simple optional questions
        else {
            priority = 'low';
        }
        return createReview({
            module: 'survey_question',
            moduleItemId: surveyQuestion._id,
            organizationId: survey.project.organization,
            projectId: survey.project._id,
            projectSiteId: (_k = survey.projectSite) === null || _k === void 0 ? void 0 : _k._id,
            submittedBy: createdBy,
            title,
            description,
            priority,
            autoAssignReviewers: true,
        });
    });
}
/**
 * Auto-creates review for SurveyTranslation when submitted for review
 */
function createSurveyTranslationReview(translation, submittedBy) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        // Only create review when translation is in pending_review state
        if (translation.status !== 'pending_review') {
            return null;
        }
        // Ensure survey and project are populated
        if (!((_a = translation.survey) === null || _a === void 0 ? void 0 : _a.project)) {
            yield translation.populate({
                path: 'survey',
                populate: { path: 'project' },
            });
        }
        if (!((_c = (_b = translation.survey) === null || _b === void 0 ? void 0 : _b.project) === null || _c === void 0 ? void 0 : _c.organization)) {
            yield translation.populate({
                path: 'survey',
                populate: { path: 'project', populate: { path: 'organization' } },
            });
        }
        const survey = translation.survey;
        const project = survey === null || survey === void 0 ? void 0 : survey.project;
        if (!(project === null || project === void 0 ? void 0 : project._id) || !(project === null || project === void 0 ? void 0 : project.organization)) {
            return null;
        }
        // Build title
        const languageName = translation.languageName || translation.language.toUpperCase();
        const surveyTitle = survey.title || 'Survey';
        const methodLabel = translation.translationMethod === 'machine'
            ? ' [Machine]'
            : translation.translationMethod === 'hybrid'
                ? ' [Hybrid]'
                : '';
        const title = `Translation (${languageName}${methodLabel}): ${surveyTitle}`;
        // Format translator info
        const translatorInfo = ((_d = translation.translator) === null || _d === void 0 ? void 0 : _d.name)
            ? `**Translator:** ${translation.translator.name} (${translation.translator.email || 'no email'})`
            : '**Translator:** Unknown';
        // Format completion
        const completionInfo = `**Completion:** ${translation.completionPercentage || 0}%`;
        // Format translated content counts
        const questionCount = ((_e = translation.translatedQuestions) === null || _e === void 0 ? void 0 : _e.length) || 0;
        const sectionCount = ((_f = translation.translatedSections) === null || _f === void 0 ? void 0 : _f.length) || 0;
        // Format method
        const methodDescriptions = {
            human: 'Human translation — review for linguistic accuracy and cultural appropriateness',
            machine: 'Machine translation (AI-generated) — thorough review required for accuracy',
            hybrid: 'Hybrid translation (machine + human post-edit) — review for consistency and quality',
        };
        const methodDescription = methodDescriptions[translation.translationMethod] || 'Translation method unknown';
        const description = `
**Survey:** ${surveyTitle}
**Language:** ${languageName} (${translation.language})
**Translation Method:** ${translation.translationMethod || 'human'} — ${methodDescription}

${translatorInfo}
${completionInfo}

**Translated Content:**
• Sections translated: ${sectionCount}
• Questions translated: ${questionCount}

${translation.notes ? `**Translator Notes:**\n${translation.notes}` : ''}

Please review this translation for linguistic accuracy, cultural appropriateness, and consistency with the original survey content.
  `.trim();
        // Priority logic
        let priority;
        // Machine translations need thorough human QA
        if (translation.translationMethod === 'machine') {
            priority = 'critical';
        }
        // Hybrid translations still need careful review
        else if (translation.translationMethod === 'hybrid') {
            priority = 'high';
        }
        // Incomplete human translation submitted early
        else if ((translation.completionPercentage || 0) < 100) {
            priority = 'high';
        }
        // Human translation, fully complete
        else {
            priority = 'medium';
        }
        return createReview({
            module: 'survey_translation',
            moduleItemId: translation._id,
            organizationId: project.organization._id || project.organization,
            projectId: project._id,
            projectSiteId: (_g = survey.projectSite) === null || _g === void 0 ? void 0 : _g._id,
            submittedBy,
            title,
            description,
            priority,
            autoAssignReviewers: true,
        });
    });
}
/**
 * Finds the least-loaded account manager using escalated review count as workload metric.
 * Tiers: 0-5 = green (optimal), 6-7 = orange (near capacity), 8+ = red (over capacity)
 * Always assigns to the lowest-loaded AM, even if all are over capacity.
 */
function findAccountManagerForOrganization(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        const accountManagers = yield user_model_1.default.find({
            primaryRole: 'accountManager',
            isConnectGoStaff: true,
            archived: false,
        }).select('_id name email primaryRole photo');
        if (accountManagers.length === 0)
            return null;
        // Count active escalated reviews per account manager
        const workloadCounts = yield review_model_1.default.aggregate([
            {
                $match: {
                    status: 'escalated',
                    escalatedTo: { $in: accountManagers.map((am) => am._id) },
                },
            },
            {
                $group: {
                    _id: '$escalatedTo',
                    count: { $sum: 1 },
                },
            },
        ]);
        const countMap = new Map();
        for (const entry of workloadCounts) {
            countMap.set(entry._id.toString(), entry.count);
        }
        const amWithLoad = accountManagers.map((am) => {
            var _a;
            const load = (_a = countMap.get(am._id.toString())) !== null && _a !== void 0 ? _a : 0;
            const tier = load <= 5 ? 'green' : load <= 7 ? 'orange' : 'red';
            return { am, load, tier };
        });
        // Sort: green first, then orange, then red; within tier sort by lowest load
        amWithLoad.sort((a, b) => {
            const tierOrder = { green: 0, orange: 1, red: 2 };
            if (tierOrder[a.tier] !== tierOrder[b.tier]) {
                return tierOrder[a.tier] - tierOrder[b.tier];
            }
            return a.load - b.load;
        });
        return amWithLoad[0].am;
    });
}
/**
 * Gets workload stats for ALL account managers — used by the workload controller.
 */
function getAccountManagerWorkloadStats() {
    return __awaiter(this, void 0, void 0, function* () {
        const accountManagers = yield user_model_1.default.find({
            primaryRole: 'accountManager',
            isConnectGoStaff: true,
            archived: false,
        }).select('_id name email photo');
        if (accountManagers.length === 0)
            return [];
        const workloadCounts = yield review_model_1.default.aggregate([
            {
                $match: {
                    status: 'escalated',
                    escalatedTo: { $in: accountManagers.map((am) => am._id) },
                },
            },
            {
                $group: {
                    _id: '$escalatedTo',
                    count: { $sum: 1 },
                },
            },
        ]);
        const countMap = new Map();
        for (const entry of workloadCounts) {
            countMap.set(entry._id.toString(), entry.count);
        }
        return accountManagers.map((am) => {
            var _a;
            const load = (_a = countMap.get(am._id.toString())) !== null && _a !== void 0 ? _a : 0;
            const tier = load <= 5 ? 'green' : load <= 7 ? 'orange' : 'red';
            return {
                _id: am._id,
                name: am.name,
                email: am.email,
                photo: am.photo,
                escalatedCount: load,
                capacityTier: tier,
                capacityPercentage: Math.min(Math.round((load / 8) * 100), 100),
            };
        });
    });
}
/**
 * Checks if a review already exists for a module item
 */
function reviewExistsForModuleItem(module, moduleItemId, nestedItemId) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = {
            module,
            moduleItemId,
            status: { $in: ['pending', 'in_review', 'escalated'] }, // Don't count resolved/approved
        };
        if (nestedItemId) {
            query.nestedItemId = nestedItemId;
        }
        const existingReview = yield review_model_1.default.findOne(query);
        return !!existingReview;
    });
}
/**
 * Gets pending reviews count for a user
 */
function getPendingReviewsCount(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const count = yield review_model_1.default.countDocuments({
            $or: [
                { reviewers: userId },
                { currentReviewer: userId },
                { escalatedTo: userId },
            ],
            status: { $in: ['pending', 'in_review', 'escalated'] },
        });
        return count;
    });
}
/**
 * Gets critical reviews for dashboard
 */
function getCriticalReviews(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        const reviews = yield review_model_1.default.find({
            organizationId,
            $or: [
                { priority: 'critical' },
                {
                    issues: {
                        $elemMatch: {
                            severity: 'critical',
                            resolvedAt: { $exists: false },
                        },
                    },
                },
            ],
            status: { $in: ['pending', 'in_review', 'escalated'] },
        })
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .sort({ createdAt: -1 })
            .limit(10);
        return reviews;
    });
}
/**
 * Gets overdue reviews
 */
function getOverdueReviews(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        const reviews = yield review_model_1.default.find({
            organizationId,
            dueDate: { $lt: now },
            status: { $in: ['pending', 'in_review', 'escalated'] },
        })
            .populate('submittedBy', 'name email')
            .populate('reviewers', 'name email')
            .sort({ dueDate: 1 });
        return reviews;
    });
}
/**
 * Gets review statistics for dashboard
 */
function getReviewStatistics(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        const stats = yield review_model_1.default.aggregate([
            {
                $match: {
                    organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
                },
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);
        const statsObj = {
            pending: 0,
            in_review: 0,
            approved: 0,
            escalated: 0,
            resolved: 0,
        };
        stats.forEach(stat => {
            statsObj[stat._id] = stat.count;
        });
        // Calculate additional metrics
        const totalReviews = Object.values(statsObj).reduce((a, b) => a + b, 0);
        const activeReviews = statsObj.pending + statsObj.in_review + statsObj.escalated;
        const completedReviews = statsObj.approved + statsObj.resolved;
        const escalationRate = totalReviews > 0 ? (statsObj.escalated / totalReviews) * 100 : 0;
        return {
            byStatus: statsObj,
            totalReviews,
            activeReviews,
            completedReviews,
            escalationRate: Math.round(escalationRate * 100) / 100, // Round to 2 decimals
        };
    });
}
/**
 * Helper to generate review title based on module
 */
function generateReviewTitle(module, itemName) {
    const prefixes = {
        stakeholder_group: 'Stakeholder Group Task',
        project_setup: 'Project Setup',
        project_site_setup: 'Site Setup',
        stakeholder_action: 'Stakeholder Action',
        social_impact: 'Social Impact',
        toc_consultation_plan: 'Consultation Plan',
        survey: 'Survey Configuration',
        survey_question: 'Survey Question',
        survey_translation: 'Survey Translation',
    };
    return `Review: ${prefixes[module]} - ${itemName.substring(0, 50)}`;
}
/**
 * Formats response data for display in review descriptions
 * Handles different data types appropriately
 */
function formatResponseData(responseData, dataType) {
    if (!responseData) {
        return '_No response provided_';
    }
    switch (dataType) {
        case 'string':
            // Truncate long strings
            if (typeof responseData === 'string') {
                return responseData.length > 500
                    ? `${responseData.substring(0, 500)}... _(truncated)_`
                    : responseData;
            }
            return String(responseData);
        case 'number':
            // Format numbers with commas
            return Number(responseData).toLocaleString();
        case 'boolean':
            return responseData ? '✅ Yes' : '❌ No';
        case 'array':
            if (Array.isArray(responseData)) {
                if (responseData.length === 0) {
                    return '_Empty array_';
                }
                // Format as bullet list
                return responseData.map(item => `• ${item}`).join('\n');
            }
            return JSON.stringify(responseData, null, 2);
        case 'object':
            // Format complex objects (like livestock_profile)
            if (Array.isArray(responseData)) {
                return responseData.map((item, index) => {
                    if (typeof item === 'object') {
                        const formatted = Object.entries(item)
                            .map(([key, value]) => `  ${key}: ${value}`)
                            .join('\n');
                        return `${index + 1}.\n${formatted}`;
                    }
                    return `• ${JSON.stringify(item)}`;
                }).join('\n');
            }
            return JSON.stringify(responseData, null, 2);
        case 'file':
            // Handle file uploads
            if (responseData.files && Array.isArray(responseData.files)) {
                if (responseData.files.length === 0) {
                    return '_No files uploaded_';
                }
                return responseData.files.map((file, index) => `${index + 1}. ${file.originalName || file.filename} (${formatFileSize(file.size)})`).join('\n');
            }
            // Single file (backward compatibility)
            if (responseData.filename) {
                return `${responseData.originalName || responseData.filename} (${formatFileSize(responseData.size)})`;
            }
            return '_File data present_';
        case 'date':
            // Format dates nicely
            try {
                const date = new Date(responseData);
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            catch (_a) {
                return String(responseData);
            }
        default:
            // Fallback for unknown types
            if (typeof responseData === 'object') {
                return JSON.stringify(responseData, null, 2);
            }
            return String(responseData);
    }
}
/**
 * Helper to format file sizes
 */
function formatFileSize(bytes) {
    if (!bytes)
        return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(2);
    return `${size} ${sizes[i]}`;
}
exports.default = {
    createReview,
    createStakeholderGroupTaskReview,
    createProjectSetupTaskReview,
    createProjectSiteSetupTaskReview,
    createStakeholderActionReview,
    createSocialImpactReview,
    createTOCConsultationPlanReview,
    createSurveyConfigReview,
    createSurveyQuestionReview,
    createSurveyTranslationReview,
    findAccountManagerForOrganization,
    reviewExistsForModuleItem,
    getPendingReviewsCount,
    getCriticalReviews,
    getOverdueReviews,
    getReviewStatistics,
    generateReviewTitle,
};
//# sourceMappingURL=reviewHelpers.js.map