// utils/reportTitleGenerator.ts

interface ProjectInfo {
  name: string;
  _id?: string;
}

interface SiteInfo {
  name: string;
  _id?: string;
}

interface TitleGeneratorOptions {
  projectInfo: ProjectInfo;
  siteInfo?: SiteInfo;
  scope: 'project' | 'site' | 'all' | 'all_sites';
  siteIds?: string[];
  reportDimension?: 'stage1' | 'workplan' | 'outcome' | 'full' | 'consultation_plan';
  date?: Date;
}

/**
 * Generate a descriptive, unique report title
 * Format: [Report Type] - [Project Name] ([Scope]) - [Date]
 * 
 * Examples:
 * - "Workplan Report - Project Alpha (All Sites) - Feb 15, 2026"
 * - "Workplan Report - Project Alpha (Site: North Field) - Feb 15, 2026"
 * - "Workplan Report - Project Alpha (Project Only) - Feb 15, 2026"
 * - "Stage 1 Data Report - Project Beta (All Sites) - Feb 15, 2026"
 * - "Outcome Report - Project Gamma (Site: South Field) - Feb 15, 2026"
 * - "Full Theory of Change Report - Project Delta (Project Only) - Feb 15, 2026"
 */
export const generateReportTitle = (
  reportType: string,
  options: TitleGeneratorOptions
): string => {
  const { projectInfo, siteInfo, scope, siteIds, reportDimension, date = new Date() } = options;

  // Determine the report type label
  let reportTypeLabel = '';
  
  if (reportType === 'theory_of_change' || reportType === 'toc_stage1' || reportType === 'toc_workplan' || reportType === 'toc_outcomes' || reportType === 'toc_full') {
    // Theory of Change reports - use dimension to determine label
    switch (reportDimension) {
      case 'stage1':
        reportTypeLabel = 'Stage 1 Data Report';
        break;
      case 'workplan':
        reportTypeLabel = 'Workplan Report';
        break;
      case 'outcome':
        reportTypeLabel = 'Outcome Report';
        break;
      case 'full':
        reportTypeLabel = 'Full Theory of Change Report';
        break;
      case 'consultation_plan':
        reportTypeLabel = 'Consultation Plan Report';
        break;
      default:
        reportTypeLabel = 'Theory of Change Report';
    }
  } else {
    // Other report types
    const reportTypeNames: Record<string, string> = {
      'project_setup': 'Project Setup Report',
      'project_site_setup': 'Project Site Setup Report',
      'stakeholder_mapping': 'Stakeholder Mapping Report',
      'risk_register': 'Risk Register Report'
    };
    reportTypeLabel = reportTypeNames[reportType] || 'Report';
  }

  // Determine scope label
  let scopeLabel = '';
  
  if (scope === 'all_sites' || scope === 'all') {
    scopeLabel = 'All Sites';
  } else if (scope === 'site' && siteInfo) {
    scopeLabel = `Site: ${siteInfo.name}`;
  } else if (scope === 'site' && siteIds && siteIds.length === 1) {
    // If we don't have siteInfo but have a single siteId, use a generic label
    scopeLabel = 'Single Site';
  } else if (scope === 'site' && siteIds && siteIds.length > 1) {
    scopeLabel = `${siteIds.length} Sites`;
  } else {
    // scope === 'project' or default
    scopeLabel = 'Project Only';
  }

  // Format date
  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Construct final title
  return `${reportTypeLabel} - ${projectInfo.name} (${scopeLabel}) - ${formattedDate}`;
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use generateReportTitle with options object instead
 */
export const generateSimpleReportTitle = (
  reportType: string,
  entityName: string,
  date: Date = new Date()
): string => {
  const reportTypeNames: Record<string, string> = {
    'project_setup': 'Project Setup Report',
    'project_site_setup': 'Project Site Setup Report',
    'stakeholder_mapping': 'Stakeholder Mapping Report',
    'theory_of_change': 'Theory of Change Report',
    'toc_stage1': 'Stage 1 Data Report',
    'toc_workplan': 'Workplan Report',
    'toc_outcomes': 'Outcome Report',
    'toc_full': 'Full Theory of Change Report',
    'risk_register': 'Risk Register Report'
  };

  const reportTypeLabel = reportTypeNames[reportType] || 'Report';
  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return `${reportTypeLabel} - ${entityName} - ${formattedDate}`;
};