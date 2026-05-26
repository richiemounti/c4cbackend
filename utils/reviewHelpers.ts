// utils/reviewHelpers.ts
import Review, { ReviewModule, ReviewPriority } from '../models/review.model';
import StakeholderGroup from '../models/stakeholderGroup.model';
import ProjectSetup from '../models/projectSetupTask.model';
import ProjectSiteSetup from '../models/projectSiteSetupTask.model';
import StakeholderAction from '../models/stakeholderAction.model';
import SocialImpact from '../models/socialImpact.model';
import TOCConsultationPlan from '../models/tocConsultationPlan.model';
import Survey from '../models/survey.model';
import SurveyQuestion from '../models/surveyQuestion.model';
import User, { IUserDocument } from '../models/user.model';
import mongoose from 'mongoose';

interface CreateReviewParams {
  module: ReviewModule;
  moduleItemId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  projectSiteId?: mongoose.Types.ObjectId;
  submittedBy: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  priority?: ReviewPriority;
  nestedPath?: string;
  nestedItemId?: string;
  autoAssignReviewers?: boolean;
}

/**
 * Creates a review with optional auto-assignment of reviewers
 */
export async function createReview(params: CreateReviewParams) {
  const {
    module,
    moduleItemId,
    organizationId,
    projectId,
    projectSiteId,
    submittedBy,
    title,
    description,
    priority = 'medium',
    nestedPath,
    nestedItemId,
    autoAssignReviewers = true,
  } = params;

  // Create the review
  const review = await Review.create({
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
      const submitter = await User.findById(submittedBy).select('isConnectGoStaff');
      submitterIsStaff = submitter?.isConnectGoStaff ?? false;
    }
    const reviewers = await getDefaultReviewers(organizationId, projectId, submittedBy, submitterIsStaff);
    if (reviewers.length > 0) {
      review.reviewers = reviewers.map(r => r._id as mongoose.Types.ObjectId);
      review.chatParticipants = [
        ...review.chatParticipants,
        ...reviewers.map(r => r._id as mongoose.Types.ObjectId)
      ];
      await review.save();
    }
  }

  return review;
}

/**
 * Gets default reviewers for an organization/project.
 *
 * Staff-triggered reviews route to the least-loaded accountManager.
 * Client-triggered reviews route to org manager(s), falling back to project creator.
 */
async function getDefaultReviewers(
  organizationId: mongoose.Types.ObjectId,
  projectId: mongoose.Types.ObjectId,
  submittedBy?: mongoose.Types.ObjectId,
  submitterIsStaff?: boolean
): Promise<Array<{ _id: mongoose.Types.ObjectId }>> {
  const reviewers: Array<{ _id: mongoose.Types.ObjectId }> = [];

  if (submitterIsStaff) {
    // Staff-triggered: assign to the least-loaded accountManager
    const accountManager = await findAccountManagerForOrganization(organizationId);
    if (accountManager) {
      const amId = accountManager._id as mongoose.Types.ObjectId;
      if (!submittedBy || amId.toString() !== submittedBy.toString()) {
        reviewers.push({ _id: amId });
      }
    }
    return reviewers;
  }

  // Client-triggered: find org manager(s)
  const managerRoleUsers = await User.find({
    'roles.role': 'manager',
    'roles.organization': organizationId,
    archived: false,
    ...(submittedBy && { _id: { $ne: submittedBy } }),
  }).limit(3);

  reviewers.push(...managerRoleUsers.map(u => ({ _id: u._id as mongoose.Types.ObjectId })));

  // Fallback to project creator if no managers found
  if (reviewers.length === 0) {
    const Project = mongoose.model('Project');
    const project = await Project.findById(projectId).populate('creator');

    if (project && project.creator) {
      const creator = project.creator as any;
      const creatorId = creator._id as mongoose.Types.ObjectId;

      if (!submittedBy || creatorId.toString() !== submittedBy.toString()) {
        reviewers.push({ _id: creatorId });
      }
    }
  }

  return reviewers;
}

/**
 * Auto-creates review for StakeholderGroup task completion
 * UPDATED: Enhanced with better titles, descriptions, and priority logic
 */
export async function createStakeholderGroupTaskReview(
  stakeholderGroup: any,
  taskIndex: number,
  completedBy: mongoose.Types.ObjectId
) {
  const task = stakeholderGroup.tasks[taskIndex];
  
  // Only create review if task has rating and responses
  if (!task.rating || !task.responses || task.responses.length === 0) {
    return null;
  }

  // ============================================================================
  // 🆕 ENHANCED: Human-readable task type labels
  // ============================================================================
  const taskTypeLabels: Record<string, string> = {
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
  const categoryName = stakeholderGroup.category?.name || 'Unknown Category';
  const title = `${taskLabel} - ${stakeholderGroup.name} (${categoryName})`;

  // ============================================================================
  // 🆕 ENHANCED: Rich description with all task details
  // ============================================================================
  const responseCount = task.responses?.length || 0;
  const rating = task.rating || 'Not rated';
  const tags = task.tags?.join(', ') || 'None';
  const projectName = stakeholderGroup.project?.name || 'Unknown Project';
  const siteName = stakeholderGroup.projectSite?.name;
  
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
  let priority: ReviewPriority;
  
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
    projectSiteId: stakeholderGroup.projectSite?._id,
    submittedBy: completedBy,
    title,
    description,
    priority,
    nestedPath: `tasks.${taskIndex}`,
    nestedItemId: task._id.toString(),
    autoAssignReviewers: true, // ✅ Auto-assign reviewers
  });
}

/**
 * Auto-creates review for ProjectSetup task completion
 * ENHANCED: Better titles, shows response data, smarter priority logic
 */
export async function createProjectSetupTaskReview(
  projectSetup: any,
  taskIndex: number,
  completedBy: mongoose.Types.ObjectId
) {
  const task = projectSetup.tasks[taskIndex];
  
  // Only create review if task is completed
  if (!task.isCompleted) {
    return null;
  }

  // ============================================================================
  // 🆕 ENHANCED: Better title with project context
  // ============================================================================
  const projectName = projectSetup.project?.name || 'Project';
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
  let priority: ReviewPriority;
  
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
}

// ============================================================================

/**
 * Auto-creates review for ProjectSiteSetup task completion
 * ENHANCED: Better titles, shows response data, smarter priority logic
 */
export async function createProjectSiteSetupTaskReview(
  projectSiteSetup: any,
  taskIndex: number,
  completedBy: mongoose.Types.ObjectId
) {
  const task = projectSiteSetup.tasks[taskIndex];
  
  if (!task.isCompleted) {
    return null;
  }

  // ============================================================================
  // 🆕 ENHANCED: Better title with site context
  // ============================================================================
  const siteName = projectSiteSetup.projectSite?.name || 'Site';
  const projectName = projectSiteSetup.project?.name || 'Project';
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
  let priority: ReviewPriority;
  
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
}

/**
 * Auto-creates review for StakeholderAction (ToC Stage 1)
 */
export async function createStakeholderActionReview(
  stakeholderAction: any,
  createdBy: mongoose.Types.ObjectId
) {
  const title = `Review: Stakeholder Action - ${stakeholderAction.action.substring(0, 50)}`;
  const description = `Review action for stakeholder group. Status: ${stakeholderAction.status}, Priority: ${stakeholderAction.priority}`;
  
  // Match action priority to review priority
  const priority: ReviewPriority = stakeholderAction.priority || 'medium';

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
}

/**
 * Auto-creates review for SocialImpact (ToC Stage 2)
 */
export async function createSocialImpactReview(
  socialImpact: any,
  createdBy: mongoose.Types.ObjectId
) {
  const title = `Review: Social Impact - ${socialImpact.outcome.substring(0, 50)}`;
  const description = `Review impact outcome. Status: ${socialImpact.status}, Risks: ${socialImpact.risks.length}`;
  
  // Higher priority if there are risks
  const priority: ReviewPriority = socialImpact.risks.length > 0 ? 'high' : 'medium';

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
}

/**
 * Auto-creates review for TOCConsultationPlan
 */
export async function createTOCConsultationPlanReview(
  tocPlan: any,
  completedBy: mongoose.Types.ObjectId
) {
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
}

/**
 * Auto-creates review for Survey configuration
 * ENHANCED: Shows all critical configuration details
 */
export async function createSurveyConfigReview(
  survey: any,
  createdBy: mongoose.Types.ObjectId
) {
  // Only create review when survey is published
  if (survey.status !== 'published') {
    return null;
  }

  // ============================================================================
  // 🆕 ENHANCED: Better title with context
  // ============================================================================
  const projectName = survey.project?.name || 'Project';
  const stakeholderName = survey.stakeholderGroup?.name || 'All Stakeholders';
  const categoryLabel = survey.category ? ` (${survey.category})` : '';
  const title = `Survey: ${survey.title}${categoryLabel} - ${stakeholderName}`;

  // ============================================================================
  // 🆕 ENHANCED: Rich description with all configuration details
  // ============================================================================
  
  // Format category with icon
  const categoryLabels: Record<string, string> = {
    baseline: '📊 Baseline Survey',
    monitoring: '📈 Monitoring Survey',
    endline: '🎯 Endline Survey',
    evaluation: '📋 Evaluation Survey',
    other: '📝 Other Survey'
  };
  const categoryInfo = categoryLabels[survey.category] || survey.category || 'Not specified';

  // Format access settings
  const accessInfo = [];
  if (survey.settings?.isPublic) accessInfo.push('Public');
  if (survey.settings?.requiresAuth) accessInfo.push('Requires authentication');
  if (survey.settings?.allowAnonymous) accessInfo.push('Anonymous responses allowed');
  const access = accessInfo.length > 0 ? accessInfo.join(', ') : 'Not configured';

  // Format response controls
  const responseControls = [];
  if (survey.settings?.allowMultipleResponses) {
    responseControls.push('Multiple responses allowed');
  } else {
    responseControls.push('One response per user');
  }
  if (survey.settings?.maxResponses) {
    responseControls.push(`Max responses: ${survey.settings.maxResponses}`);
  }
  if (survey.settings?.allowSaveAndContinue) {
    responseControls.push('Save & continue enabled');
  }
  const controls = responseControls.join('\n• ');

  // Format sampling calculator
  let samplingInfo = 'Not configured';
  if (survey.settings?.samplingCalculator?.isEnabled) {
    const calc = survey.settings.samplingCalculator;
    samplingInfo = `Enabled
• Confidence Level: ${calc.confidenceLevel}%
• Margin of Error: ${calc.marginOfError}%
• Calculated Sample Size: ${calc.calculatedSampleSize || 'Not calculated'}`;
  }

  // Format survey features
  const features = [];
  if (survey.settings?.showProgressBar) features.push('Progress bar');
  if (survey.settings?.randomizeQuestions) features.push('Question randomization');
  if (survey.settings?.sendConfirmationEmail) features.push('Confirmation emails');
  if (survey.settings?.notifyOnResponse) features.push('Response notifications');
  const featuresInfo = features.length > 0 ? features.join(', ') : 'None enabled';

  // Format languages
  const languagesInfo = survey.availableLanguages && survey.availableLanguages.length > 0
    ? `${survey.availableLanguages.length} languages (Default: ${survey.defaultLanguage})`
    : `Single language (${survey.defaultLanguage || 'en'})`;

  // Format ToC stage
  const tocStageInfo = survey.theoryOfChangeStage?.name || 'Not linked to ToC stage';

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
  let priority: ReviewPriority;

  // Critical if baseline/endline survey OR high response limit
  if ((survey.category === 'baseline' || survey.category === 'endline') ||
      (survey.settings?.maxResponses && survey.settings.maxResponses > 1000)) {
    priority = 'critical';
  }
  // High if sampling calculator enabled OR allows anonymous responses OR no questions yet
  else if (survey.settings?.samplingCalculator?.isEnabled ||
           survey.settings?.allowAnonymous ||
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
    projectSiteId: survey.projectSite?._id,
    submittedBy: createdBy,
    title,
    description,
    priority,
    autoAssignReviewers: true,
  });
}

// ============================================================================

/**
 * Auto-creates review for SurveyQuestion
 * ENHANCED: Shows question content and configuration details
 */
export async function createSurveyQuestionReview(
  surveyQuestion: any,
  createdBy: mongoose.Types.ObjectId
) {
  // Populate question and survey if not already populated
  if (!surveyQuestion.question?.text) {
    await surveyQuestion.populate('question');
  }
  if (!surveyQuestion.survey?.title) {
    await surveyQuestion.populate('survey');
  }
  if (surveyQuestion.section && !surveyQuestion.section?.title) {
    await surveyQuestion.populate('section');
  }

  const question = surveyQuestion.question;
  const survey = surveyQuestion.survey;
  const section = surveyQuestion.section;

  // ============================================================================
  // 🆕 ENHANCED: Better title with context
  // ============================================================================
  const questionPreview = question.text?.substring(0, 60) || 'Question';
  const surveyTitle = survey.title || 'Survey';
  const title = `Question: ${questionPreview}${question.text && question.text.length > 60 ? '...' : ''} - ${surveyTitle}`;

  // ============================================================================
  // 🆕 ENHANCED: Rich description with question details
  // ============================================================================
  
  // Format question type with icon
  const typeIcons: Record<string, string> = {
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
    optionsInfo = question.options.map((opt: any, i: number) => 
      `${i + 1}. ${opt.text || opt}`
    ).join('\n');
  }
  
  // Custom options override
  if (surveyQuestion.customOptions && surveyQuestion.customOptions.length > 0) {
    optionsInfo = `Custom options:\n${surveyQuestion.customOptions.map((opt: any, i: number) => 
      `${i + 1}. ${opt.text || opt}`
    ).join('\n')}`;
  }

  // Format conditional logic
  let conditionalInfo = 'No conditional logic';
  if (surveyQuestion.conditionalLogic?.enabled) {
    const conditions = surveyQuestion.conditionalLogic.conditions || [];
    if (conditions.length > 0) {
      conditionalInfo = `${surveyQuestion.conditionalLogic.action === 'show' ? 'Show' : 'Hide'} if:\n${
        conditions.map((c: any, i: number) => 
          `${i + 1}. Question ${c.questionId} ${c.operator} "${c.value}"`
        ).join('\n')
      }`;
    }
  }

  // Format section info
  const sectionInfo = section?.title 
    ? `${section.title} (Order: ${surveyQuestion.order})`
    : `Order: ${surveyQuestion.order}`;

  // Format validation rules
  let validationInfo = 'No validation';
  if (question.validation) {
    const rules = [];
    if (question.validation.required) rules.push('Required field');
    if (question.validation.minLength) rules.push(`Min length: ${question.validation.minLength}`);
    if (question.validation.maxLength) rules.push(`Max length: ${question.validation.maxLength}`);
    if (question.validation.min) rules.push(`Min value: ${question.validation.min}`);
    if (question.validation.max) rules.push(`Max value: ${question.validation.max}`);
    if (question.validation.pattern) rules.push(`Pattern: ${question.validation.pattern}`);
    if (rules.length > 0) {
      validationInfo = rules.join('\n• ');
    }
  }

  // Format metadata
  const metadata = [];
  if (question.theme) metadata.push(`Theme: ${question.theme.name || question.theme}`);
  if (question.subTheme) metadata.push(`Sub-theme: ${question.subTheme.name || question.subTheme}`);
  if (question.indicator) metadata.push(`Indicator: ${question.indicator.name || question.indicator}`);
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
  let priority: ReviewPriority;

  // Critical if required question with conditional logic OR file upload type
  if ((surveyQuestion.required && surveyQuestion.conditionalLogic?.enabled) ||
      question.type === 'file_upload') {
    priority = 'critical';
  }
  // High if required OR has complex conditional logic OR has validation
  else if (surveyQuestion.required ||
           (surveyQuestion.conditionalLogic?.enabled && surveyQuestion.conditionalLogic.conditions?.length > 1) ||
           (question.validation && Object.keys(question.validation).length > 1)) {
    priority = 'high';
  }
  // Medium if has conditional logic OR custom options
  else if (surveyQuestion.conditionalLogic?.enabled ||
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
    projectSiteId: survey.projectSite?._id,
    submittedBy: createdBy,
    title,
    description,
    priority,
    autoAssignReviewers: true,
  });
}


/**
 * Auto-creates review for SurveyTranslation when submitted for review
 */
export async function createSurveyTranslationReview(
  translation: any,
  submittedBy: mongoose.Types.ObjectId
) {
  // Only create review when translation is in pending_review state
  if (translation.status !== 'pending_review') {
    return null;
  }

  // Ensure survey and project are populated
  if (!translation.survey?.project) {
    await translation.populate({
      path: 'survey',
      populate: { path: 'project' },
    });
  }
  if (!translation.survey?.project?.organization) {
    await translation.populate({
      path: 'survey',
      populate: { path: 'project', populate: { path: 'organization' } },
    });
  }

  const survey = translation.survey;
  const project = survey?.project;

  if (!project?._id || !project?.organization) {
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
  const translatorInfo = translation.translator?.name
    ? `**Translator:** ${translation.translator.name} (${translation.translator.email || 'no email'})`
    : '**Translator:** Unknown';

  // Format completion
  const completionInfo = `**Completion:** ${translation.completionPercentage || 0}%`;

  // Format translated content counts
  const questionCount = translation.translatedQuestions?.length || 0;
  const sectionCount = translation.translatedSections?.length || 0;

  // Format method
  const methodDescriptions: Record<string, string> = {
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
  let priority: ReviewPriority;

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
    projectSiteId: survey.projectSite?._id,
    submittedBy,
    title,
    description,
    priority,
    autoAssignReviewers: true,
  });
}

/**
 * Finds the least-loaded account manager using escalated review count as workload metric.
 * Tiers: 0-5 = green (optimal), 6-7 = orange (near capacity), 8+ = red (over capacity)
 * Always assigns to the lowest-loaded AM, even if all are over capacity.
 */
export async function findAccountManagerForOrganization(
  organizationId: mongoose.Types.ObjectId
): Promise<IUserDocument | null> {
  const accountManagers = await User.find({
    primaryRole: 'accountManager',
    isConnectGoStaff: true,
    archived: false,
  }).select('_id name email primaryRole photo');

  if (accountManagers.length === 0) return null;

  // Count active escalated reviews per account manager
  const workloadCounts = await Review.aggregate([
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

  const countMap = new Map<string, number>();
  for (const entry of workloadCounts) {
    countMap.set(entry._id.toString(), entry.count);
  }

  const amWithLoad = accountManagers.map((am) => {
    const load = countMap.get((am._id as mongoose.Types.ObjectId).toString()) ?? 0;
    const tier: 'green' | 'orange' | 'red' =
      load <= 5 ? 'green' : load <= 7 ? 'orange' : 'red';
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
}

/**
 * Gets workload stats for ALL account managers — used by the workload controller.
 */
export async function getAccountManagerWorkloadStats() {
  const accountManagers = await User.find({
    primaryRole: 'accountManager',
    isConnectGoStaff: true,
    archived: false,
  }).select('_id name email photo');

  if (accountManagers.length === 0) return [];

  const workloadCounts = await Review.aggregate([
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

  const countMap = new Map<string, number>();
  for (const entry of workloadCounts) {
    countMap.set(entry._id.toString(), entry.count);
  }

  return accountManagers.map((am) => {
    const load = countMap.get((am._id as mongoose.Types.ObjectId).toString()) ?? 0;
    const tier: 'green' | 'orange' | 'red' =
      load <= 5 ? 'green' : load <= 7 ? 'orange' : 'red';
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
}

/**
 * Checks if a review already exists for a module item
 */
export async function reviewExistsForModuleItem(
  module: ReviewModule,
  moduleItemId: mongoose.Types.ObjectId,
  nestedItemId?: string
) {
  const query: any = {
    module,
    moduleItemId,
    status: { $in: ['pending', 'in_review', 'escalated'] }, // Don't count resolved/approved
  };

  if (nestedItemId) {
    query.nestedItemId = nestedItemId;
  }

  const existingReview = await Review.findOne(query);
  return !!existingReview;
}

/**
 * Gets pending reviews count for a user
 */
export async function getPendingReviewsCount(userId: mongoose.Types.ObjectId) {
  const count = await Review.countDocuments({
    $or: [
      { reviewers: userId },
      { currentReviewer: userId },
      { escalatedTo: userId },
    ],
    status: { $in: ['pending', 'in_review', 'escalated'] },
  });

  return count;
}

/**
 * Gets critical reviews for dashboard
 */
export async function getCriticalReviews(organizationId: mongoose.Types.ObjectId) {
  const reviews = await Review.find({
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
}

/**
 * Gets overdue reviews
 */
export async function getOverdueReviews(organizationId: mongoose.Types.ObjectId) {
  const now = new Date();
  
  const reviews = await Review.find({
    organizationId,
    dueDate: { $lt: now },
    status: { $in: ['pending', 'in_review', 'escalated'] },
  })
    .populate('submittedBy', 'name email')
    .populate('reviewers', 'name email')
    .sort({ dueDate: 1 });

  return reviews;
}

/**
 * Gets review statistics for dashboard
 */
export async function getReviewStatistics(organizationId: mongoose.Types.ObjectId) {
  const stats = await Review.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const statsObj: Record<string, number> = {
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
}

/**
 * Helper to generate review title based on module
 */
export function generateReviewTitle(module: ReviewModule, itemName: string): string {
  const prefixes: Record<ReviewModule, string> = {
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
function formatResponseData(responseData: any, dataType: string): string {
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
        return responseData.files.map((file: any, index: number) => 
          `${index + 1}. ${file.originalName || file.filename} (${formatFileSize(file.size)})`
        ).join('\n');
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
      } catch {
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
function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  
  return `${size} ${sizes[i]}`;
}


export default {
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