// utils/notifications.ts - Updated with Verification Details Section
import emailService from '../services/email.service';
import { IBugReport } from '../models/bugReport.model';
import { env } from '../config/env';

/**
 * Send bug report notification to admin team using Gmail
 */
export const sendBugReportNotification = async (bugReport: IBugReport): Promise<boolean> => {
  try {
    // Get all notification emails from env
    const allNotificationEmails = env.BUG_REPORT_NOTIFICATION_EMAILS
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    console.log('All configured emails:', allNotificationEmails);

    if (allNotificationEmails.length === 0) {
      console.warn('No bug report notification emails configured');
      return false;
    }

    // Determine recipients based on assignment
    let recipients: string[] = [];
    
    if (bugReport.assignedToTeamMember === 'belinda') {
      // Only send to Belinda if assigned to her
      recipients = ['belinda@connectgo.co.uk'];
      console.log('Report assigned to Belinda - sending notification only to her');
    } else {
      // Send to Kate and Sam (filter out Belinda's email)
      recipients = allNotificationEmails.filter(email => email !== 'belinda@connectgo.co.uk');
      console.log('Report assigned to Kate/Sam or unassigned - sending to:', recipients);
    }

    if (recipients.length === 0) {
      console.warn('No valid recipients determined for notification');
      return false;
    }

    const html = generateBugReportHTML(bugReport);
    const subject = generateSubjectLine(bugReport);

    const result = await emailService.sendEmail({
      to: recipients,
      subject,
      html,
      ...(bugReport.attachments && bugReport.attachments.length > 0 && {
        attachments: bugReport.attachments.map(att => ({
          filename: att.filename,
          content: att.url,
          contentType: getContentType(att.type)
        }))
      })
    });

    console.log(`Bug report notification sent to ${recipients.length} emails:`, result);
    return result;
  } catch (error) {
    console.error('Error sending bug report notification:', error);
    return false;
  }
};

/**
 * Generate subject line based on bug report type and priority
 */
function generateSubjectLine(bugReport: IBugReport): string {
  const typeMap = {
    'bug_report': 'BUG REPORT',
    'user_experience': 'UX FEEDBACK',
    'thematic_feedback': 'THEME FEEDBACK',
    'feature_suggestion': 'FEATURE REQUEST',
    'general_feedback': 'FEEDBACK'
  };

  const priorityEmoji = {
    'p0': '🚨',
    'p1': '⚠️',
    'p2': '📋',
    'p3': '📝',
    'p4': '💡'
  };

  const urgencyMap = {
    'fix_24_hours': '24H',
    'fix_1_3_days': '1-3D',
    'fix_this_week': '1W',
    'fix_2_weeks': '2W',
    'fix_next_month': '1M',
    'later': 'LATER'
  };

  const typeText = typeMap[bugReport.feedbackType] || 'REPORT';
  const priorityIcon = priorityEmoji[bugReport.priority] || '📋';
  const urgencyText = urgencyMap[bugReport.urgencyLevel] || bugReport.urgencyLevel.toUpperCase();
  
  // Add assignment info if available
  const assignmentText = bugReport.assignedToTeamMember 
    ? `[${bugReport.assignedToTeamMember.toUpperCase()}]` 
    : '';

  // NEW: Enhanced subject line for verification status
  if (bugReport.verified) {
    return `✅✅ [VERIFIED] ${priorityIcon} [${typeText}] ${assignmentText} ${bugReport.title}`;
  }

  if (bugReport.status === 'resolved') {
    return `✅ [RESOLVED] ${priorityIcon} [${typeText}] ${assignmentText} ${bugReport.title}`;
  }

  return `${priorityIcon} [${typeText}] ${assignmentText} ${urgencyText}: ${bugReport.title}`;
}

/**
 * Generate comprehensive HTML email content
 */
function generateBugReportHTML(bugReport: IBugReport): string {
  const priorityColors = {
    'p0': '#dc2626', // Red
    'p1': '#f97316', // Orange
    'p2': '#f59e0b', // Amber
    'p3': '#2563eb', // Blue
    'p4': '#10b981'  // Green
  };

  const urgencyColors = {
    'fix_24_hours': '#dc2626',
    'fix_1_3_days': '#f97316',
    'fix_this_week': '#f59e0b',
    'fix_2_weeks': '#2563eb',
    'fix_next_month': '#10b943ff',
    'later': '#08fa51ff'
  };

  const priorityColor = priorityColors[bugReport.priority] || '#2563eb';
  const urgencyColor = urgencyColors[bugReport.urgencyLevel] || '#2563eb';

  // Base template
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; line-height: 1.6;">
      <h1 style="color: ${priorityColor};">
        ${getFeedbackTypeIcon(bugReport.feedbackType)} ${getFeedbackTypeTitle(bugReport.feedbackType)}
      </h1>
      
      <!-- Summary Card -->
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${priorityColor};">
        <h2 style="margin-top: 0; color: ${priorityColor};">${bugReport.title}</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
          <div>
            <strong>Priority:</strong> 
            <span style="color: ${priorityColor}; font-weight: bold;">${bugReport.priority.toUpperCase()}</span>
          </div>
          <div>
            <strong>Urgency:</strong> 
            <span style="color: ${urgencyColor}; font-weight: bold;">${bugReport.urgencyLevel.toUpperCase()}</span>
          </div>
          <div>
            <strong>Category:</strong> ${formatCategory(bugReport.category)}
          </div>
          <div>
            <strong>Overall Score:</strong> 
            <span style="font-weight: bold;">${bugReport.overallScore || 'N/A'}</span>
          </div>
        </div>
        
        ${bugReport.bugType ? `
        <div style="margin-top: 10px;">
          <strong>Estimated Effort:</strong> 
          <span style="background-color: ${getEffortColor(bugReport.bugType)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${bugReport.bugType.toUpperCase()}
          </span>
        </div>
        ` : ''}
      </div>

      <!-- Description -->
      <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
        <h3 style="margin-top: 0;">Description</h3>
        <p style="white-space: pre-wrap;">${bugReport.description}</p>
      </div>`;

    // Add assignment section after summary card
    if (bugReport.assignedToTeamMember || bugReport.sourceOfFeedback) {
      html += generateAssignmentAndSourceSection(bugReport);
    }

  // Add content based on feedback type
  switch (bugReport.feedbackType) {
    case 'bug_report':
      html += generateBugReportSection(bugReport);
      break;
    case 'user_experience':
      html += generateUserExperienceSection(bugReport);
      break;
    case 'thematic_feedback':
      html += generateThematicFeedbackSection(bugReport);
      break;
    case 'feature_suggestion':
      html += generateFeatureSuggestionSection(bugReport);
      break;
    case 'general_feedback':
      html += generateGeneralFeedbackSection(bugReport);
      break;
  }

  // Add status section (includes resolution details)
  html += generateStatusSection(bugReport);
  
  // NEW: Add verification section if bug is verified
  if (bugReport.verified && bugReport.verificationDetails) {
    html += generateVerificationSection(bugReport);
  }

  // Add common sections
  html += generateBusinessImpactSection(bugReport);
  html += generateSystemInfoSection(bugReport);
  html += generateReporterInfoSection(bugReport);
  html += generateAttachmentsSection(bugReport);
  html += generateActionSection(bugReport);

  // Close the main div
  html += '</div>';

  return html;
}

/**
 * Generate bug-specific sections based on feedback type
 */
function generateBugReportSection(bugReport: IBugReport): string {
  return `
    <!-- Bug Report Details -->
    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <h3 style="margin-top: 0; color: #dc2626;">Bug Details</h3>
      
      ${bugReport.steps ? `
      <div style="margin-bottom: 15px;">
        <h4>Steps to Reproduce:</h4>
        <p style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${bugReport.steps}</p>
      </div>
      ` : ''}
      
      ${bugReport.expectedBehavior ? `
      <div style="margin-bottom: 15px;">
        <h4>Expected Behavior:</h4>
        <p style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${bugReport.expectedBehavior}</p>
      </div>
      ` : ''}
      
      ${bugReport.actualBehavior ? `
      <div style="margin-bottom: 15px;">
        <h4>Actual Behavior:</h4>
        <p style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${bugReport.actualBehavior}</p>
      </div>
      ` : ''}
    </div>
  `;
}

function generateUserExperienceSection(bugReport: IBugReport): string {
  if (!bugReport.userExperienceRating) return '';
  
  const rating = bugReport.userExperienceRating;
  
  return `
    <!-- User Experience Ratings -->
    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
      <h3 style="margin-top: 0; color: #2563eb;">User Experience Ratings</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <div>
          <strong>Overall Satisfaction:</strong> ${generateStarRating(rating.overallSatisfaction)}
        </div>
        ${rating.easeOfUse ? `<div><strong>Ease of Use:</strong> ${generateStarRating(rating.easeOfUse)}</div>` : ''}
        ${rating.speed ? `<div><strong>Speed:</strong> ${generateStarRating(rating.speed)}</div>` : ''}
        ${rating.visualAppeal ? `<div><strong>Visual Appeal:</strong> ${generateStarRating(rating.visualAppeal)}</div>` : ''}
        ${rating.functionalityClarity ? `<div><strong>Functionality Clarity:</strong> ${generateStarRating(rating.functionalityClarity)}</div>` : ''}
      </div>
      
      ${bugReport.performanceIssues ? generatePerformanceIssuesSection(bugReport.performanceIssues) : ''}
    </div>
  `;
}

function generateThematicFeedbackSection(bugReport: IBugReport): string {
  if (!bugReport.thematicFeedback) return '';
  
  const feedback = bugReport.thematicFeedback;
  
  return `
    <!-- Thematic Feedback -->
    <div style="background-color: #fef3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
      <h3 style="margin-top: 0; color: #7c3aed;">Thematic Feedback</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        ${feedback.lookAndFeelRating ? `<div><strong>Look & Feel:</strong> ${generateStarRating(feedback.lookAndFeelRating)}</div>` : ''}
        ${feedback.fontReadability ? `<div><strong>Font Readability:</strong> ${generateStarRating(feedback.fontReadability)}</div>` : ''}
        ${feedback.layoutIntuitive ? `<div><strong>Layout Intuitive:</strong> ${generateStarRating(feedback.layoutIntuitive)}</div>` : ''}
        ${feedback.brandConsistency ? `<div><strong>Brand Consistency:</strong> ${generateStarRating(feedback.brandConsistency)}</div>` : ''}
        ${feedback.colorSchemeAppropriate !== undefined ? `<div><strong>Color Scheme:</strong> ${feedback.colorSchemeAppropriate ? '✅ Appropriate' : '❌ Needs Improvement'}</div>` : ''}
      </div>
      
      ${feedback.specificThematicComments ? `
      <div style="margin-top: 15px;">
        <h4>Specific Comments:</h4>
        <p style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${feedback.specificThematicComments}</p>
      </div>
      ` : ''}
    </div>
  `;
}

function generateFeatureSuggestionSection(bugReport: IBugReport): string {
  if (!bugReport.featureSuggestion) return '';
  
  const suggestion = bugReport.featureSuggestion;
  
  return `
    <!-- Feature Suggestion -->
    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">Feature Suggestion</h3>
      
      <div style="margin-bottom: 15px;">
        <h4>Description:</h4>
        <p style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${suggestion.description}</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
        <div>
          <strong>Business Value:</strong> 
          <span style="background-color: ${getValueColor(suggestion.businessValue)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${suggestion.businessValue.toUpperCase()}
          </span>
        </div>
        <div>
          <strong>User Impact:</strong> 
          <span style="background-color: ${getValueColor(suggestion.userImpact)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${suggestion.userImpact.toUpperCase()}
          </span>
        </div>
        <div>
          <strong>Suggested Priority:</strong> 
          <span style="background-color: ${getValueColor(suggestion.suggestedPriority)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${suggestion.suggestedPriority.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  `;
}

function generateGeneralFeedbackSection(bugReport: IBugReport): string {
  return `
    <!-- General Feedback -->
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
      <h3 style="margin-top: 0; color: #6b7280;">General Feedback</h3>
      <p>This is general feedback that doesn't fit into specific categories but provides valuable user insights.</p>
    </div>
  `;
}

function generateBusinessImpactSection(bugReport: IBugReport): string {
  if (!bugReport.businessImpact) return '';
  
  const impact = bugReport.businessImpact;
  
  return `
    <!-- Business Impact -->
    <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <h3 style="margin-top: 0; color: #f59e0b;">Business Impact Assessment</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        ${impact.affectedUsers ? `<div><strong>Affected Users:</strong> ${impact.affectedUsers.toUpperCase()}</div>` : ''}
        <div><strong>Functionality Blocked:</strong> ${impact.functionalityBlocked ? '🚫 Yes' : '✅ No'}</div>
        <div><strong>Workaround Available:</strong> ${impact.workaroundAvailable ? '✅ Yes' : '❌ No'}</div>
        <div><strong>Revenue Impact:</strong> ${impact.revenueImpact ? '💰 Yes' : '✅ No'}</div>
        <div><strong>Compliance Impact:</strong> ${impact.complianceImpact ? '⚖️ Yes' : '✅ No'}</div>
      </div>
    </div>
  `;
}

function generateSystemInfoSection(bugReport: IBugReport): string {
  const system = bugReport.systemInfo;
  
  return `
    <!-- System Information -->
    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">System Information</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; font-size: 14px;">
        <div><strong>URL:</strong> <code style="background-color: #e5e7eb; padding: 2px 4px; border-radius: 3px;">${system.url}</code></div>
        <div><strong>Platform:</strong> ${system.platform}</div>
        ${system.deviceType ? `<div><strong>Device Type:</strong> ${system.deviceType}</div>` : ''}
        <div><strong>Screen Size:</strong> ${system.screenSize}</div>
        ${system.browserVersion ? `<div><strong>Browser:</strong> ${system.browserVersion}</div>` : ''}
        ${system.connectionSpeed ? `<div><strong>Connection:</strong> ${system.connectionSpeed}</div>` : ''}
        <div><strong>Timestamp:</strong> ${system.timestamp}</div>
      </div>
    </div>
  `;
}

function generateReporterInfoSection(bugReport: IBugReport): string {
  const system = bugReport.systemInfo;
  
  return `
    <!-- Reporter Information -->
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Reporter Information</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        ${system.userName ? `<div><strong>Name:</strong> ${system.userName}</div>` : ''}
        ${system.userEmail ? `<div><strong>Email:</strong> ${system.userEmail}</div>` : ''}
        ${system.userId ? `<div><strong>User ID:</strong> ${system.userId}</div>` : ''}
        <div><strong>Report ID:</strong> <code style="background-color: #e5e7eb; padding: 2px 4px; border-radius: 3px;">${bugReport._id}</code></div>
      </div>
      
      ${bugReport.tags && bugReport.tags.length > 0 ? `
      <div style="margin-top: 15px;">
        <strong>Tags:</strong> 
        ${bugReport.tags.map(tag => `<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px;">${tag}</span>`).join('')}
      </div>
      ` : ''}
    </div>
  `;
}

function generateAttachmentsSection(bugReport: IBugReport): string {
  if (!bugReport.attachments || bugReport.attachments.length === 0) return '';
  
  return `
    <!-- Attachments -->
    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Attachments</h3>
      
      ${bugReport.attachments.map(attachment => `
        <div style="margin-bottom: 10px; padding: 10px; background-color: white; border-radius: 4px;">
          <strong>${getAttachmentIcon(attachment.type)} ${attachment.filename}</strong>
          <br>
          <small style="color: #6b7280;">Type: ${attachment.type} | Uploaded: ${new Date(attachment.uploadedAt).toLocaleString()}</small>
        </div>
      `).join('')}
    </div>
  `;
}

function generateActionSection(bugReport: IBugReport): string {
  return `
    <!-- Action Required -->
    <div style="background-color: #1f2937; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <h3 style="margin-top: 0;">Action Required</h3>
      <p>This ${getFeedbackTypeTitle(bugReport.feedbackType).toLowerCase()} requires your attention.</p>
      
      ${env.FRONTEND_URL ? `
      <a href="${env.FRONTEND_URL}/admin/bug-reports/${bugReport._id}" 
         style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px;">
        📋 View Full Report
      </a>
      ` : ''}
      
      <div style="margin-top: 15px; font-size: 14px; color: #d1d5db;">
        <p><strong>Reported:</strong> ${new Date(bugReport.createdAt).toLocaleString()}</p>
        <p><strong>Report ID:</strong> ${bugReport._id}</p>
      </div>
    </div>
  `;
}

/**
 * Generate status and resolution section for email
 */
function generateStatusSection(bugReport: IBugReport): string {
  const statusColors = {
    'new': '#10b981',           // Green
    'triaged': '#3b82f6',       // Blue
    'resolved': '#059669',      // Emerald
    'cannot-reproduce': '#6b7280', // Gray
    'duplicate': '#f97316',     // Orange
    'deferred': '#84cc16'       // Lime
  };

  const statusEmojis = {
    'new': '🆕',
    'triaged': '🔍',
    'resolved': '✅',
    'cannot-reproduce': '❓',
    'duplicate': '🔄',
    'deferred': '⏳'
  };

  const statusColor = statusColors[bugReport.status] || '#6b7280';
  const statusEmoji = statusEmojis[bugReport.status] || '📋';

  let statusSection = `
    <!-- Status Information -->
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
      <h3 style="margin-top: 0; color: ${statusColor};">Status Information</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
        <div>
          <strong>Current Status:</strong> 
          <span style="background-color: ${statusColor}; color: white; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: bold;">
            ${statusEmoji} ${formatStatusText(bugReport.status)}
          </span>
        </div>
        
        ${bugReport.assignedTo ? `
        <div>
          <strong>Assigned To:</strong> ${bugReport.assignedTo}
        </div>
        ` : ''}
        
        <div>
          <strong>Requires Follow-up:</strong> ${bugReport.requiresFollowUp ? '🔔 Yes' : '✅ No'}
        </div>
        
        ${bugReport.followUpDate ? `
        <div>
          <strong>Follow-up Date:</strong> ${new Date(bugReport.followUpDate).toLocaleDateString()}
        </div>
        ` : ''}

        <!-- NEW: Resolution and Verification Status -->
        <div>
          <strong>Resolution Status:</strong> ${bugReport.resolved ? '✅ Resolved' : '⏳ Unresolved'}
        </div>
        
        <div>
          <strong>Verification Status:</strong> 
          ${bugReport.verified ? '✅✅ Verified' : 
            bugReport.resolved ? '⏳ Awaiting Verification' : '➖ N/A'}
        </div>
      </div>
      
      <!-- Metrics -->
      <div style="margin-top: 15px; padding: 15px; background-color: white; border-radius: 4px;">
        <h4 style="margin-top: 0; margin-bottom: 10px;">Metrics</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; font-size: 14px;">
          <div><strong>Views:</strong> ${bugReport.metrics.viewCount}</div>
          <div><strong>Comments:</strong> ${bugReport.metrics.commentCount}</div>
          <div><strong>Reopened:</strong> ${bugReport.metrics.reopenCount} times</div>
          ${bugReport.metrics.timeToFirstResponse ? `<div><strong>First Response:</strong> ${Math.round(bugReport.metrics.timeToFirstResponse / 3600)} hours</div>` : ''}
          ${bugReport.metrics.timeToResolution ? `<div><strong>Resolution Time:</strong> ${Math.round(bugReport.metrics.timeToResolution / 3600)} hours</div>` : ''}
          ${bugReport.metrics.timeToVerification ? `<div><strong>Verification Time:</strong> ${Math.round(bugReport.metrics.timeToVerification / 3600)} hours</div>` : ''}
        </div>
      </div>
    </div>
  `;

  // Add resolution section if status is resolved
  if (bugReport.status === 'resolved' && bugReport.resolution) {
    statusSection += `
      <!-- Resolution Details -->
      <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
        <h3 style="margin-top: 0; color: #059669;">✅ Resolution Details</h3>
        
        <div style="margin-bottom: 15px;">
          <strong>Resolution:</strong>
          <p style="white-space: pre-wrap; background-color: white; padding: 15px; border-radius: 4px; margin-top: 8px; border: 1px solid #d1fae5;">
            ${bugReport.resolution}
          </p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; font-size: 14px;">
          ${bugReport.resolvedAt ? `
          <div>
            <strong>Resolved At:</strong> ${new Date(bugReport.resolvedAt).toLocaleString()}
          </div>
          ` : ''}
          
          ${bugReport.resolvedBy ? `
          <div>
            <strong>Resolved By:</strong> ${bugReport.resolvedBy}
          </div>
          ` : ''}
          
          <div>
            <strong>Verified by Reporter:</strong> ${bugReport.verifiedByReporter ? '✅ Yes' : '⏳ Pending'}
          </div>
        </div>
        
        ${!bugReport.verified ? `
        <div style="margin-top: 15px; padding: 12px; background-color: #fef3c7; border-radius: 4px; border-left: 3px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;">
            <strong>⏳ Awaiting Verification:</strong> The bug has been resolved but not yet verified.
          </p>
        </div>
        ` : ''}
      </div>
    `;
  }

  return statusSection;
}

/**
 * NEW: Generate verification section for email
 */
function generateVerificationSection(bugReport: IBugReport): string {
  if (!bugReport.verified || !bugReport.verificationDetails) return '';

  return `
    <!-- Verification Details -->
    <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">✅✅ Verification Details</h3>
      
      <div style="margin-bottom: 15px;">
        <strong>Verification Notes:</strong>
        <p style="white-space: pre-wrap; background-color: white; padding: 15px; border-radius: 4px; margin-top: 8px; border: 1px solid #d1fae5;">
          ${bugReport.verificationDetails}
        </p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; font-size: 14px;">
        ${bugReport.verifiedAt ? `
        <div>
          <strong>Verified At:</strong> ${new Date(bugReport.verifiedAt).toLocaleString()}
        </div>
        ` : ''}
        
        ${bugReport.verifiedBy ? `
        <div>
          <strong>Verified By:</strong> ${bugReport.verifiedBy}
        </div>
        ` : ''}
        
        <div>
          <strong>Status:</strong> 
          <span style="background-color: #10b981; color: white; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: bold;">
            ✅✅ VERIFIED
          </span>
        </div>
      </div>
      
      <div style="margin-top: 15px; padding: 12px; background-color: #d1fae5; border-radius: 4px; border-left: 3px solid #10b981;">
        <p style="margin: 0; color: #047857;">
          <strong>✅ Verification Complete:</strong> This bug has been successfully resolved and verified.
        </p>
      </div>
    </div>
  `;
}

// New function to generate assignment and source section
function generateAssignmentAndSourceSection(bugReport: IBugReport): string {
  return `
    <!-- Assignment and Source Information -->
    <div style="background-color: #fef3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #a855f7;">
      <h3 style="margin-top: 0; color: #a855f7;">Assignment & Source Information</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
        ${bugReport.assignedToTeamMember ? `
        <div>
          <strong>Assigned To:</strong> 
          <span style="background-color: #a855f7; color: white; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: bold;">
            ${bugReport.assignedToTeamMember.charAt(0).toUpperCase() + bugReport.assignedToTeamMember.slice(1)}
          </span>
        </div>
        ` : ''}
        
        ${bugReport.sourceOfFeedback ? `
        <div>
          <strong>Feedback Source:</strong> ${bugReport.sourceOfFeedback.source}
        </div>
        
        ${bugReport.sourceOfFeedback.contactPerson ? `
        <div>
          <strong>Contact Person:</strong> ${bugReport.sourceOfFeedback.contactPerson}
        </div>
        ` : ''}
        
        ${bugReport.sourceOfFeedback.source ? `
        <div style="grid-column: 1 / -1;">
          <strong>Additional Details:</strong>
          <p style="margin: 8px 0; padding: 10px; background-color: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            ${bugReport.sourceOfFeedback.source}
          </p>
        </div>
        ` : ''}
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Helper function to format status text
 */
function formatStatusText(status: string): string {
  const statusTexts = {
    'new': 'New',
    'triaged': 'Triaged',
    'resolved': 'Resolved',
    'cannot-reproduce': 'Cannot Reproduce',
    'duplicate': 'Duplicate',
    'deferred': 'Deferred'
  };
  return statusTexts[status as keyof typeof statusTexts] || status;
}

/**
 * Helper functions for formatting
 */
function getUrgencyDisplay(urgencyLevel: string): string {
  const urgencyLabels = {
    'fix_24_hours': '🚨 Fix within 24 hours',
    'fix_1_3_days': '⚠️ Fix within 1-3 days',
    'fix_this_week': '📅 Fix within this week',
    'fix_2_weeks': '📆 Fix within 2 weeks',
    'fix_next_month': '🗓️ Fix within next month',
    'later': '⏰ Fix later'
  };
  return urgencyLabels[urgencyLevel as keyof typeof urgencyLabels] || urgencyLevel;
}

function getTypeDisplay(type: string): string {
  const typeLabels = {
    'fix': '🔧 Fix',
    'food_for_thought': '💭 Food for Thought',
    'pipeline': '🚀 Pipeline'
  };
  return typeLabels[type as keyof typeof typeLabels] || type;
}

function getFeedbackTypeIcon(type: string): string {
  const icons = {
    'bug_report': '🐛',
    'user_experience': '👤',
    'thematic_feedback': '🎨',
    'feature_suggestion': '💡',
    'general_feedback': '💬'
  };
  return icons[type as keyof typeof icons] || '📋';
}

function getFeedbackTypeTitle(type: string): string {
  const titles = {
    'bug_report': 'Bug Report',
    'user_experience': 'User Experience Feedback',
    'thematic_feedback': 'Thematic Feedback',
    'feature_suggestion': 'Feature Suggestion',
    'general_feedback': 'General Feedback'
  };
  return titles[type as keyof typeof titles] || 'Report';
}

function formatCategory(category: string): string {
  return category.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function generateStarRating(rating: number): string {
  const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  return `${stars} (${rating}/5)`;
}

function getEffortColor(effort: string): string {
  const colors = {
    'fix': '#10b981',
    'food_for_thought': '#3b82f6',
    'pipeline': '#f59e0b'
  };
  return colors[effort as keyof typeof colors] || '#6b7280';
}

function getValueColor(value: string): string {
  const colors = {
    'low': '#6b7280',
    'medium': '#f59e0b',
    'high': '#dc2626'
  };
  return colors[value as keyof typeof colors] || '#6b7280';
}

function getAttachmentIcon(type: string): string {
  const icons = {
    'screenshot': '📷',
    'video': '🎥',
    'document': '📄',
    'log_file': '📋',
    'other': '📎'
  };
  return icons[type as keyof typeof icons] || '📎';
}

function getContentType(type: string): string {
  const contentTypes = {
    'screenshot': 'image/png',
    'video': 'video/mp4',
    'document': 'application/pdf',
    'log_file': 'text/plain',
    'other': 'application/octet-stream'
  };
  return contentTypes[type as keyof typeof contentTypes] || 'application/octet-stream';
}

function generatePerformanceIssuesSection(performance: any): string {
  return `
    <div style="margin-top: 15px; padding: 15px; background-color: white; border-radius: 4px;">
      <h4 style="margin-top: 0;">Performance Issues</h4>
      ${performance.pageLoadTime ? `<p><strong>Page Load Time:</strong> ${performance.pageLoadTime}s</p>` : ''}
      ${performance.timeToInteractive ? `<p><strong>Time to Interactive:</strong> ${performance.timeToInteractive}s</p>` : ''}
      ${performance.specificSlowAreas ? `<p><strong>Slow Areas:</strong> ${performance.specificSlowAreas.join(', ')}</p>` : ''}
      ${performance.browserFreeze ? `<p style="color: #dc2626;"><strong>Browser Freeze:</strong> ⚠️ Reported</p>` : ''}
      ${performance.memoryIssues ? `<p style="color: #dc2626;"><strong>Memory Issues:</strong> ⚠️ Reported</p>` : ''}
    </div>
  `;
}