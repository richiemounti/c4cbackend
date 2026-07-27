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
exports.TheoryOfChangeReportService = void 0;
// services/reports/theoryOfChangeReport.service.ts - UPDATED VERSION
const mongoose_1 = __importDefault(require("mongoose"));
const theoryOfChangeStage_model_1 = __importDefault(require("../../models/theoryOfChangeStage.model"));
const stakeholderAction_model_1 = __importDefault(require("../../models/stakeholderAction.model"));
const socialImpact_model_1 = __importDefault(require("../../models/socialImpact.model"));
const project_model_1 = __importDefault(require("../../models/project.model"));
const projectSite_model_1 = __importDefault(require("../../models/projectSite.model"));
const subtheme_model_1 = __importDefault(require("../../models/subtheme.model"));
const tocConsultationPlan_model_1 = __importDefault(require("../../models/tocConsultationPlan.model"));
// ============================================================================
// SERVICE CLASS
// ============================================================================
class TheoryOfChangeReportService {
    // Add this to TheoryOfChangeReportService class
    /**
   * Main report generation router method
   * Routes to appropriate ToC report based on stageNumbers and reportDimension filters
   */
    static generateReport(projectId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, userId, filters = { scope: 'all' }) {
            try {
                // ✅ NEW: Check for explicit reportDimension first
                if (filters.reportDimension) {
                    switch (filters.reportDimension) {
                        case 'stage1':
                            return yield this.generateStage1Report(projectId, userId, filters);
                        case 'workplan':
                            return yield this.generateWorkplanReport(projectId, userId, filters);
                        case 'outcome':
                            return yield this.generateOutcomeReport(projectId, userId, filters);
                        case 'full':
                            // Full report generation would need to be implemented separately
                            // For now, throw an error or default to workplan
                            console.warn('Full report requested via generateReport. Consider using generateFullToCReport instead.');
                            throw new Error('Please use generateFullToCReport for full reports');
                        default:
                            throw new Error(`Unknown report dimension: ${filters.reportDimension}`);
                    }
                }
                // ✅ UPDATED: Fallback to stageNumbers-based routing if no reportDimension specified
                // If no stage numbers specified, default to Stage 1 Data Report
                if (!filters.stageNumbers || filters.stageNumbers.length === 0) {
                    console.log('No stage numbers specified, defaulting to Stage 1 Data Report');
                    return yield this.generateStage1Report(projectId, userId, filters);
                }
                // If only Stage 1 is requested - default to Stage 1 Data Report (can be changed to workplan if preferred)
                if (filters.stageNumbers.includes(1) && !filters.stageNumbers.includes(2)) {
                    console.log('Stage 1 requested, generating Stage 1 Data Report');
                    return yield this.generateStage1Report(projectId, userId, filters);
                }
                // If only Stage 2 is requested
                if (filters.stageNumbers.includes(2) && !filters.stageNumbers.includes(1)) {
                    console.log('Stage 2 requested, generating Outcome Report');
                    return yield this.generateOutcomeReport(projectId, userId, filters);
                }
                // If both stages are requested, throw error directing to use generateFullToCReport
                if (filters.stageNumbers.includes(1) && filters.stageNumbers.includes(2)) {
                    console.warn('Both Stage 1 and Stage 2 requested. Use generateFullToCReport instead.');
                    throw new Error('For reports combining both stages, please use generateFullToCReport method');
                }
                // Fallback - should never reach here
                console.warn('Unexpected filter configuration, defaulting to Stage 1 Data Report');
                return yield this.generateStage1Report(projectId, userId, filters);
            }
            catch (error) {
                console.error('Error generating Theory of Change report:', error);
                throw error;
            }
        });
    }
    /**
   * Generate Stage 1 Data Report (Data-focused)
   * Focus: Detailed action data, breakdowns, and summaries
   * No heavy visualizations - just the data
   */
    static generateStage1Report(projectId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, userId, filters = { scope: 'all' }) {
            try {
                const project = yield project_model_1.default.findById(projectId).populate('organization');
                if (!project)
                    throw new Error('Project not found');
                filters.stageNumbers = [1];
                const stageQuery = this.buildStageQuery(projectId, filters);
                const stages = yield theoryOfChangeStage_model_1.default.find(stageQuery);
                const { actions } = yield this.fetchActionsAndImpacts(stages, filters);
                // Progress summary — simple counts, no breakdown maps
                const completedActions = actions.filter(a => a.status === 'completed').length;
                const inProgressActions = actions.filter(a => a.status === 'in_progress').length;
                const notStartedActions = actions.filter(a => a.status === 'not_started').length;
                const averageProgress = actions.length > 0
                    ? Math.round(actions.reduce((sum, a) => sum + (a.progress || 0), 0) / actions.length)
                    : 0;
                // Timeline boundaries
                const datePairs = actions.filter(a => { var _a, _b; return ((_a = a.timeframe) === null || _a === void 0 ? void 0 : _a.startDate) && ((_b = a.timeframe) === null || _b === void 0 ? void 0 : _b.endDate); });
                const allDates = datePairs.flatMap(a => [a.timeframe.startDate, a.timeframe.endDate]);
                const earliestStartDate = allDates.length > 0
                    ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : undefined;
                const latestEndDate = allDates.length > 0
                    ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : undefined;
                const totalDuration = earliestStartDate && latestEndDate
                    ? Math.ceil((latestEndDate.getTime() - earliestStartDate.getTime()) / (24 * 60 * 60 * 1000))
                    : 0;
                const report = {
                    reportType: 'toc_stage1',
                    projectInfo: {
                        id: project._id.toString(),
                        name: project.name,
                        description: project.description,
                        status: project.status
                    },
                    organizationInfo: {
                        id: project.organization._id.toString(),
                        name: project.organization.name
                    },
                    scope: filters.scope === 'site' ? 'site' :
                        (filters.scope === 'all' ? 'all_sites' : 'project'),
                    reportMetadata: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        version: '2.0',
                        appliedFilters: filters
                    },
                    stage1Data: {
                        totalActions: actions.length,
                        actions, // full objects — the table renders directly from this
                        progressSummary: {
                            averageProgress,
                            completedActions,
                            inProgressActions,
                            notStartedActions
                        },
                        timelineSummary: {
                            earliestStartDate,
                            latestEndDate,
                            totalDuration
                        }
                    }
                };
                return report;
            }
            catch (error) {
                console.error('Error generating Stage 1 report:', error);
                throw new Error(`Failed to generate Stage 1 report: ${error}`);
            }
        });
    }
    // ==========================================================================
    // WORKPLAN REPORT GENERATION (STAGE 1 ONLY)
    // ==========================================================================
    /**
   * Generate Workplan Report (Visual-focused)
   * Focus: Gantt charts, timeline visualization, workload metrics
   * This is the VISUAL representation of Stage 1 data
   */
    static generateWorkplanReport(projectId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, userId, filters = { scope: 'all' }) {
            try {
                const project = yield project_model_1.default.findById(projectId).populate('organization');
                if (!project) {
                    throw new Error('Project not found');
                }
                // Force Stage 1 only
                filters.stageNumbers = [1];
                const stageQuery = this.buildStageQuery(projectId, filters);
                const stages = yield theoryOfChangeStage_model_1.default.find(stageQuery);
                const { actions } = yield this.fetchActionsAndImpacts(stages, filters);
                // ✅ UPDATED: Since dates are now required, no estimation needed
                // But keep validation for data integrity
                this.validateActionDependencies(actions);
                // Generate Gantt timeline (no estimation since dates are required)
                const ganttTimeline = this.generateGanttTimeline(actions);
                // Calculate workload distribution
                const workloadDistribution = this.calculateStakeholderWorkloads(ganttTimeline);
                // Generate timeline analysis with enhanced metrics
                const timelineAnalysis = this.analyzeTimeline(ganttTimeline);
                const report = {
                    reportType: 'toc_workplan',
                    projectInfo: {
                        id: project._id.toString(),
                        name: project.name,
                        description: project.description,
                        status: project.status
                    },
                    organizationInfo: {
                        id: project.organization._id.toString(),
                        name: project.organization.name
                    },
                    scope: filters.scope === 'site' ? 'site' :
                        (filters.scope === 'all' ? 'all_sites' : 'project'),
                    reportMetadata: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        version: '2.0',
                        appliedFilters: filters
                    },
                    outputs: {
                        totalActions: actions.length,
                        actionsWithDates: actions.length, // All should have dates now
                        actionsWithEstimatedDates: 0, // No more estimates
                        actionsWithoutDates: 0, // Should be 0
                        actions,
                        ganttTimeline,
                        workloadDistribution,
                        timelineAnalysis
                    }
                    // ✅ REMOVED: siteBreakdown and aggregatedView
                };
                return report;
            }
            catch (error) {
                console.error('Error generating workplan report:', error);
                throw new Error(`Failed to generate workplan report: ${error}`);
            }
        });
    }
    // ✅ NEW: Simplified Gantt timeline generation (no date estimation)
    static generateGanttTimeline(actions) {
        const ganttTimeline = [];
        actions.forEach(action => {
            var _a;
            const startDate = new Date(action.timeframe.startDate);
            const endDate = new Date(action.timeframe.endDate);
            const duration = this.calculateDuration(startDate, endDate);
            ganttTimeline.push({
                id: action._id.toString(),
                name: action.action,
                type: 'action',
                stakeholder: {
                    _id: action.stakeholderGroup._id.toString(),
                    name: action.stakeholderGroup.name
                },
                themes: action.themes.map((theme) => ({
                    _id: theme._id.toString(),
                    name: theme.name
                })),
                startDate,
                endDate,
                duration,
                progress: action.progress || 0,
                status: action.status || 'not_started',
                priority: action.priority,
                responsibility: action.responsibility ? {
                    name: action.responsibility.name,
                    role: action.responsibility.role || 'Unknown',
                    email: action.responsibility.email
                } : undefined,
                dependencies: ((_a = action.dependencies) === null || _a === void 0 ? void 0 : _a.map((dep) => dep.toString())) || [],
                milestones: action.milestones || [],
                isEstimated: false, // No more estimates
                estimationMethod: undefined
            });
        });
        // Sort by start date
        ganttTimeline.sort((a, b) => {
            const aDate = a.startDate || new Date();
            const bDate = b.startDate || new Date();
            return aDate.getTime() - bDate.getTime();
        });
        return ganttTimeline;
    }
    // ==========================================================================
    // OUTCOME REPORT GENERATION (STAGE 2 ONLY)
    // ==========================================================================
    static generateOutcomeReport(projectId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, userId, filters = { scope: 'all' }) {
            try {
                // Fetch project info
                const project = yield project_model_1.default.findById(projectId).populate('organization');
                if (!project) {
                    throw new Error('Project not found');
                }
                // Force Stage 2 only
                filters.stageNumbers = [2];
                // Get Stage 2 data
                const stageQuery = this.buildStageQuery(projectId, filters);
                const stages = yield theoryOfChangeStage_model_1.default.find(stageQuery);
                const { impacts } = yield this.fetchActionsAndImpacts(stages, filters);
                // Get subthemes for framework analysis
                const subThemes = yield subtheme_model_1.default.find({ archived: { $ne: true } })
                    .populate('theme', 'name')
                    .populate('indicatorTags', 'name code description')
                    .populate('sdgTags', 'name code')
                    .populate('resilienceTags', 'name code')
                    .populate('esgTags', 'name code')
                    .populate('standardTags', 'name code');
                // Group by stakeholder
                const byStakeholder = this.groupImpactsByStakeholder(impacts);
                // Group by selected framework
                // Generate ALL frameworks
                const [themes, sdgs, resilience, indicators, esg, standards] = yield Promise.all([
                    this.groupByFramework(impacts, subThemes, 'themes'),
                    this.groupByFramework(impacts, subThemes, 'sdgs'),
                    this.groupByFramework(impacts, subThemes, 'resilience'),
                    this.groupByFramework(impacts, subThemes, 'indicators'),
                    this.groupByFramework(impacts, subThemes, 'esg'),
                    this.groupByFramework(impacts, subThemes, 'standards')
                ]);
                const byFramework = {
                    themes,
                    sdgs,
                    resilience,
                    indicators,
                    esg,
                    standards
                };
                // Generate risk register
                const riskRegister = this.generateRiskRegister(impacts);
                // Generate measurement summary
                const measurementSummary = this.generateMeasurementSummary(impacts);
                // Handle multi-site reports
                let siteBreakdown;
                let aggregatedView;
                if (filters.scope === 'all' || (filters.siteIds && filters.siteIds.length > 1)) {
                    const sites = yield projectSite_model_1.default.find({
                        project: projectId,
                        archived: { $ne: true }
                    });
                    siteBreakdown = yield this.generateSiteBreakdown(sites, [], impacts, 'outcome');
                    aggregatedView = this.generateAggregatedView(siteBreakdown);
                }
                const report = {
                    reportType: 'toc_outcomes',
                    projectInfo: {
                        id: project._id.toString(),
                        name: project.name,
                        description: project.description,
                        status: project.status
                    },
                    organizationInfo: {
                        id: project.organization._id.toString(),
                        name: project.organization.name
                    },
                    scope: filters.scope === 'site' ? 'site' :
                        (filters.scope === 'all' ? 'all_sites' : 'project'),
                    reportMetadata: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        version: '2.0',
                        appliedFilters: filters
                    },
                    outcomes: {
                        totalImpacts: impacts.length,
                        impactsWithRisks: impacts.filter(impact => impact.risks.length > 0).length,
                        impacts,
                        byStakeholder,
                        byFramework,
                        availableFrameworks: ['themes', 'sdgs', 'resilience', 'indicators', 'esg', 'standards'], // ✅ ADD THIS
                        riskRegister,
                        measurementSummary
                    },
                    siteBreakdown,
                    aggregatedView
                };
                return report;
            }
            catch (error) {
                console.error('Error generating outcome report:', error);
                throw new Error(`Failed to generate outcome report: ${error}`);
            }
        });
    }
    // ==========================================================================
    // CONSULTATION PLAN REPORT GENERATION
    // ==========================================================================
    static generateConsultationPlanReport(projectId, siteId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Fetch project and site info
                const project = yield project_model_1.default.findById(projectId);
                const site = yield projectSite_model_1.default.findById(siteId);
                if (!project)
                    throw new Error('Project not found');
                if (!site)
                    throw new Error('Project site not found');
                // Fetch consultation plan
                const consultationPlan = yield tocConsultationPlan_model_1.default.findOne({
                    projectSite: siteId
                }).populate('stakeholderGroups.stakeholderGroup', 'name description');
                if (!consultationPlan) {
                    throw new Error('Consultation plan not found for this site');
                }
                // Extract selected stakeholders
                const selectedStakeholders = consultationPlan.stakeholderGroups
                    .filter((sg) => sg.isSelected)
                    .map((sg) => ({
                    stakeholderGroup: sg.stakeholderGroup,
                    notes: sg.notes
                }));
                // Calculate completion status
                const completionStatus = this.calculateConsultationCompletionStatus(consultationPlan);
                // Calculate timeline duration
                const timeline = consultationPlan.plannedConsultationDates;
                let duration;
                if (timeline.startDate && timeline.endDate) {
                    duration = Math.ceil((timeline.endDate.getTime() - timeline.startDate.getTime()) / (24 * 60 * 60 * 1000));
                }
                const report = {
                    reportType: 'consultation_plan',
                    projectInfo: {
                        id: project._id.toString(),
                        name: project.name,
                        description: project.description
                    },
                    siteInfo: {
                        id: site._id.toString(),
                        name: site.name,
                        location: site.location
                    },
                    reportMetadata: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        version: '2.0'
                    },
                    consultationPlan: {
                        planId: consultationPlan._id.toString(),
                        status: consultationPlan.status,
                        isCompleted: consultationPlan.isCompleted,
                        selectedStakeholders,
                        planning: {
                            expectedParticipants: consultationPlan.consultationQuestions.howManyPeople,
                            invitationStrategy: consultationPlan.consultationQuestions.whoInvitedHow,
                            venue: consultationPlan.consultationQuestions.whereHow,
                            underrepresentedGroups: consultationPlan.consultationQuestions.underRepresentedGroups,
                            budget: consultationPlan.consultationQuestions.costsPlanning,
                            permissions: consultationPlan.consultationQuestions.permissions
                        },
                        timeline: {
                            startDate: timeline.startDate,
                            endDate: timeline.endDate,
                            description: timeline.dateDescription,
                            duration
                        },
                        completionStatus
                    }
                };
                return report;
            }
            catch (error) {
                console.error('Error generating consultation plan report:', error);
                throw new Error(`Failed to generate consultation plan report: ${error}`);
            }
        });
    }
    // services/reports/theoryOfChangeReport.service.ts - PART 2 (Helper Methods)
    // ==========================================================================
    // DEPENDENCY VALIDATION
    // ==========================================================================
    static validateActionDependencies(actions) {
        const actionMap = new Map(actions.map(action => [action._id.toString(), action]));
        // Build dependency graph
        const graph = new Map();
        actions.forEach(action => {
            const actionId = action._id.toString();
            graph.set(actionId, new Set());
            if (action.dependencies && action.dependencies.length > 0) {
                action.dependencies.forEach((depId) => {
                    const depIdStr = depId.toString();
                    // Only add if dependency exists in our action set
                    if (actionMap.has(depIdStr)) {
                        graph.get(actionId).add(depIdStr);
                    }
                });
            }
        });
        // Detect cycles using DFS
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        const detectCycle = (nodeId, path = []) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);
            const neighbors = graph.get(nodeId) || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (detectCycle(neighbor, [...path])) {
                        return true;
                    }
                }
                else if (recursionStack.has(neighbor)) {
                    // Cycle detected
                    const cycleStart = path.indexOf(neighbor);
                    const cycle = path.slice(cycleStart);
                    cycles.push(cycle);
                    return true;
                }
            }
            recursionStack.delete(nodeId);
            return false;
        };
        // Check all nodes
        for (const actionId of graph.keys()) {
            if (!visited.has(actionId)) {
                detectCycle(actionId);
            }
        }
        // If cycles detected, throw error with details
        if (cycles.length > 0) {
            const cycleDetails = cycles.map(cycle => {
                const actionNames = cycle.map(id => {
                    const action = actionMap.get(id);
                    return action ? action.action.substring(0, 50) : id;
                });
                return actionNames.join(' → ');
            }).join('\n');
            throw new Error(`Circular dependencies detected in actions:\n${cycleDetails}\n` +
                'Please resolve these circular dependencies before generating reports.');
        }
    }
    // ==========================================================================
    // GANTT TIMELINE WITH DATE ESTIMATION
    // ==========================================================================
    static generateGanttTimelineWithEstimation(actions) {
        return __awaiter(this, void 0, void 0, function* () {
            const ganttTimeline = [];
            // First pass: Process actions with actual dates
            const actionsWithDates = actions.filter(action => { var _a, _b; return ((_a = action.timeframe) === null || _a === void 0 ? void 0 : _a.startDate) && ((_b = action.timeframe) === null || _b === void 0 ? void 0 : _b.endDate); });
            const actionsWithoutDates = actions.filter(action => { var _a, _b; return !((_a = action.timeframe) === null || _a === void 0 ? void 0 : _a.startDate) || !((_b = action.timeframe) === null || _b === void 0 ? void 0 : _b.endDate); });
            // Calculate project baseline dates from existing actions
            let earliestDate = null;
            let latestDate = null;
            actionsWithDates.forEach(action => {
                const start = new Date(action.timeframe.startDate);
                const end = new Date(action.timeframe.endDate);
                if (!earliestDate || start < earliestDate)
                    earliestDate = start;
                if (!latestDate || end > latestDate)
                    latestDate = end;
            });
            // If no dates exist at all, use current date as baseline
            if (!earliestDate) {
                earliestDate = new Date();
                latestDate = new Date();
                latestDate.setDate(latestDate.getDate() + 90); // Default 90-day project
            }
            // Process actions with dates
            actionsWithDates.forEach(action => {
                ganttTimeline.push(this.createGanttItem(action, false));
            });
            // Estimate dates for actions without dates
            actionsWithoutDates.forEach((action, index) => {
                const estimatedDates = this.estimateActionDates(action, earliestDate, latestDate, index, actionsWithoutDates.length);
                ganttTimeline.push(this.createGanttItem(action, true, estimatedDates));
            });
            // Sort by start date
            ganttTimeline.sort((a, b) => {
                const aDate = a.startDate || new Date();
                const bDate = b.startDate || new Date();
                return aDate.getTime() - bDate.getTime();
            });
            return ganttTimeline;
        });
    }
    static createGanttItem(action, isEstimated, estimatedDates) {
        var _a, _b, _c;
        let startDate;
        let endDate;
        let duration;
        let estimationMethod;
        if (isEstimated && estimatedDates) {
            startDate = estimatedDates.startDate;
            endDate = estimatedDates.endDate;
            duration = estimatedDates.duration;
            estimationMethod = estimatedDates.method;
        }
        else {
            startDate = (_a = action.timeframe) === null || _a === void 0 ? void 0 : _a.startDate;
            endDate = (_b = action.timeframe) === null || _b === void 0 ? void 0 : _b.endDate;
            duration = this.calculateDuration(startDate, endDate);
        }
        return {
            id: action._id.toString(),
            name: action.action,
            type: 'action',
            stakeholder: {
                _id: action.stakeholderGroup._id.toString(),
                name: action.stakeholderGroup.name
            },
            themes: action.themes.map((theme) => ({
                _id: theme._id.toString(),
                name: theme.name
            })),
            startDate,
            endDate,
            duration,
            progress: action.progress || 0,
            status: action.status || 'not_started',
            priority: action.priority,
            responsibility: action.responsibility ? {
                name: action.responsibility.name,
                role: action.responsibility.role || 'Unknown',
                email: action.responsibility.email
            } : undefined,
            dependencies: ((_c = action.dependencies) === null || _c === void 0 ? void 0 : _c.map((dep) => dep.toString())) || [],
            milestones: action.milestones || [],
            isEstimated,
            estimationMethod
        };
    }
    static estimateActionDates(action, projectStart, projectEnd, actionIndex, totalActions) {
        var _a;
        const projectDuration = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (24 * 60 * 60 * 1000));
        // Method 1: Use estimatedDuration if provided
        if ((_a = action.timeframe) === null || _a === void 0 ? void 0 : _a.estimatedDuration) {
            const duration = action.timeframe.estimatedDuration;
            // Distribute across project timeline based on priority
            let startOffset;
            if (action.priority === 'critical' || action.priority === 'high') {
                // Start early in project
                startOffset = Math.floor(projectDuration * 0.1);
            }
            else if (action.priority === 'medium') {
                // Start mid-project
                startOffset = Math.floor(projectDuration * 0.3);
            }
            else {
                // Start later
                startOffset = Math.floor(projectDuration * 0.5);
            }
            const startDate = new Date(projectStart);
            startDate.setDate(startDate.getDate() + startOffset);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + duration);
            return {
                startDate,
                endDate,
                duration,
                method: 'Based on estimated duration and priority'
            };
        }
        // Method 2: Distribute evenly across project timeline
        const avgDuration = Math.max(Math.floor(projectDuration / (totalActions + 1)), 7); // Min 7 days
        const startOffset = Math.floor((actionIndex + 1) * (projectDuration / (totalActions + 1)));
        const startDate = new Date(projectStart);
        startDate.setDate(startDate.getDate() + startOffset);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + avgDuration);
        return {
            startDate,
            endDate,
            duration: avgDuration,
            method: 'Distributed evenly across project timeline'
        };
    }
    // ==========================================================================
    // WORKLOAD CALCULATION
    // ==========================================================================
    static calculateStakeholderWorkloads(ganttTimeline) {
        const workloadMap = new Map();
        ganttTimeline.forEach(item => {
            const stakeholderId = item.stakeholder._id;
            if (!workloadMap.has(stakeholderId)) {
                workloadMap.set(stakeholderId, {
                    stakeholder: item.stakeholder,
                    activities: [],
                    totalDuration: 0,
                    completedActivities: 0,
                    totalProgress: 0,
                    highPriorityCount: 0
                });
            }
            const workload = workloadMap.get(stakeholderId);
            workload.activities.push(item);
            workload.totalDuration += item.duration || 0;
            workload.totalProgress += item.progress;
            if (item.status === 'completed') {
                workload.completedActivities++;
            }
            if (item.priority === 'high' || item.priority === 'critical') {
                workload.highPriorityCount++;
            }
        });
        return Array.from(workloadMap.values()).map(workload => {
            const activityCount = workload.activities.length;
            const completionRate = activityCount > 0
                ? Math.round((workload.completedActivities / activityCount) * 100)
                : 0;
            const averageProgress = activityCount > 0
                ? Math.round(workload.totalProgress / activityCount)
                : 0;
            // Calculate upcoming deadlines (next 14 days)
            const now = new Date();
            const fourteenDaysFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
            const upcomingDeadlines = workload.activities.filter((activity) => {
                return activity.endDate &&
                    activity.endDate >= now &&
                    activity.endDate <= fourteenDaysFromNow &&
                    activity.status !== 'completed';
            }).length;
            // Calculate workload score (higher = more intense)
            const workloadScore = (workload.totalDuration * 0.3) +
                (activityCount * 5) +
                (upcomingDeadlines * 10) +
                (workload.highPriorityCount * 15) +
                ((100 - completionRate) * 0.2);
            return {
                stakeholder: workload.stakeholder,
                activities: workload.activities,
                totalDuration: workload.totalDuration,
                activityCount,
                completionRate,
                averageProgress,
                upcomingDeadlines,
                workloadScore: Math.round(workloadScore)
            };
        })
            .sort((a, b) => b.workloadScore - a.workloadScore); // Sort by workload intensity
    }
    // ==========================================================================
    // TIMELINE ANALYSIS
    // ==========================================================================
    static analyzeTimeline(ganttTimeline) {
        if (ganttTimeline.length === 0) {
            return {
                projectStartDate: undefined,
                projectEndDate: undefined,
                totalDuration: 0,
                criticalPath: [],
                upcomingDeadlines: [],
                statusBreakdown: {},
                averageProgress: 0
            };
        }
        // Find project boundaries
        const dates = ganttTimeline
            .filter(item => item.startDate && item.endDate)
            .flatMap(item => [item.startDate, item.endDate]);
        const projectStartDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined;
        const projectEndDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;
        const totalDuration = projectStartDate && projectEndDate
            ? Math.ceil((projectEndDate.getTime() - projectStartDate.getTime()) / (24 * 60 * 60 * 1000))
            : 0;
        // Find critical path (simplified - items with most dependencies and longest duration)
        const criticalPath = this.findCriticalPath(ganttTimeline);
        // Find upcoming deadlines
        const upcomingDeadlines = this.getUpcomingDeadlines(ganttTimeline);
        // Status breakdown
        const statusBreakdown = ganttTimeline.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
        }, {});
        // Average progress
        const averageProgress = ganttTimeline.length > 0
            ? Math.round(ganttTimeline.reduce((sum, item) => sum + item.progress, 0) / ganttTimeline.length)
            : 0;
        return {
            projectStartDate,
            projectEndDate,
            totalDuration,
            criticalPath,
            upcomingDeadlines,
            statusBreakdown,
            averageProgress
        };
    }
    static findCriticalPath(ganttTimeline) {
        // Calculate complexity score for each item
        const scoredItems = ganttTimeline.map(item => {
            var _a;
            return ({
                item,
                score: (item.duration || 0) * 2 +
                    (((_a = item.dependencies) === null || _a === void 0 ? void 0 : _a.length) || 0) * 10 +
                    (item.priority === 'critical' ? 50 : item.priority === 'high' ? 30 : 0) +
                    (item.status === 'in_progress' ? 20 : 0) +
                    (100 - item.progress) * 0.3
            });
        })
            .sort((a, b) => b.score - a.score);
        // Return top 5 critical items
        return scoredItems.slice(0, 5).map(scored => scored.item);
    }
    static getUpcomingDeadlines(ganttTimeline) {
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
        return ganttTimeline
            .filter(item => {
            return item.endDate &&
                item.endDate >= now &&
                item.endDate <= thirtyDaysFromNow &&
                item.status !== 'completed';
        })
            .map(item => ({
            item,
            daysUntilDue: Math.ceil((item.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        }))
            .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    }
    // ==========================================================================
    // OUTCOME REPORT HELPERS
    // ==========================================================================
    static groupImpactsByStakeholder(impacts) {
        const stakeholderMap = new Map();
        impacts.forEach(impact => {
            const stakeholderId = impact.stakeholderGroup._id.toString();
            if (!stakeholderMap.has(stakeholderId)) {
                stakeholderMap.set(stakeholderId, {
                    stakeholder: impact.stakeholderGroup,
                    impacts: [],
                    totalRisks: 0,
                    completedImpacts: 0,
                    totalProgress: 0
                });
            }
            const group = stakeholderMap.get(stakeholderId);
            group.impacts.push(impact);
            group.totalRisks += impact.risks.length;
            group.totalProgress += impact.progress || 0;
            if (impact.status === 'achieved') {
                group.completedImpacts++;
            }
        });
        return Array.from(stakeholderMap.values()).map(group => ({
            stakeholder: group.stakeholder,
            impacts: group.impacts,
            totalRisks: group.totalRisks,
            achievementRate: group.impacts.length > 0
                ? Math.round((group.completedImpacts / group.impacts.length) * 100)
                : 0,
            averageProgress: group.impacts.length > 0
                ? Math.round(group.totalProgress / group.impacts.length)
                : 0
        }));
    }
    static groupByFramework(impacts, subThemes, frameworkType) {
        return __awaiter(this, void 0, void 0, function* () {
            const frameworkGroups = [];
            const frameworkMap = new Map();
            // Extract framework items based on type
            subThemes.forEach(subTheme => {
                let tags = [];
                switch (frameworkType) {
                    case 'themes':
                        if (subTheme.theme) {
                            tags = [subTheme.theme];
                        }
                        break;
                    case 'sdgs':
                        tags = subTheme.sdgTags || [];
                        break;
                    case 'resilience':
                        tags = subTheme.resilienceTags || [];
                        break;
                    case 'indicators':
                        tags = subTheme.indicatorTags || [];
                        break;
                    case 'esg':
                        tags = subTheme.esgTags || [];
                        break;
                    case 'standards':
                        tags = subTheme.standardTags || [];
                        break;
                }
                tags.forEach(tag => {
                    const tagId = tag._id.toString();
                    if (!frameworkMap.has(tagId)) {
                        frameworkMap.set(tagId, {
                            framework: tag,
                            relatedSubThemes: new Set([subTheme._id.toString()]),
                            impacts: []
                        });
                    }
                    else {
                        frameworkMap.get(tagId).relatedSubThemes.add(subTheme._id.toString());
                    }
                });
            });
            // Map impacts to framework items
            impacts.forEach(impact => {
                const impactSubThemeIds = impact.subThemes.map((st) => st._id.toString());
                frameworkMap.forEach((data, frameworkId) => {
                    const hasMatch = impactSubThemeIds.some((stId) => data.relatedSubThemes.has(stId));
                    if (hasMatch) {
                        data.impacts.push(impact);
                    }
                });
            });
            // Build framework groups
            frameworkMap.forEach((data, frameworkId) => {
                const achievedImpacts = data.impacts.filter((i) => i.status === 'achieved').length;
                const totalRisks = data.impacts.reduce((sum, i) => sum + i.risks.length, 0);
                frameworkGroups.push({
                    framework: {
                        _id: frameworkId,
                        name: data.framework.name,
                        code: data.framework.code,
                        description: data.framework.description
                    },
                    impacts: data.impacts,
                    metrics: {
                        totalImpacts: data.impacts.length,
                        achievementRate: data.impacts.length > 0
                            ? Math.round((achievedImpacts / data.impacts.length) * 100)
                            : 0,
                        riskCount: totalRisks
                    }
                });
            });
            return frameworkGroups.sort((a, b) => b.impacts.length - a.impacts.length);
        });
    }
    static generateRiskRegister(impacts) {
        const allRisks = [];
        impacts.forEach(impact => {
            impact.risks.forEach((risk) => {
                allRisks.push({
                    impact,
                    risk,
                    stakeholder: impact.stakeholderGroup
                });
            });
        });
        const bySeverity = {
            low: allRisks.filter(r => r.risk.severity === 'low').length,
            medium: allRisks.filter(r => r.risk.severity === 'medium').length,
            high: allRisks.filter(r => r.risk.severity === 'high').length
        };
        // Top risks (high severity + no mitigation)
        const topRisks = allRisks
            .filter(r => r.risk.severity === 'high' ||
            (r.risk.severity === 'medium' && !r.risk.mitigation))
            .sort((a, b) => {
            const severityScore = { high: 3, medium: 2, low: 1 };
            return severityScore[b.risk.severity] -
                severityScore[a.risk.severity];
        })
            .slice(0, 10);
        const risksWithMitigation = allRisks.filter(r => r.risk.mitigation && r.risk.mitigation.trim()).length;
        const mitigationCoverage = allRisks.length > 0
            ? Math.round((risksWithMitigation / allRisks.length) * 100)
            : 0;
        return {
            totalRisks: allRisks.length,
            bySeverity,
            topRisks,
            mitigationCoverage
        };
    }
    static generateMeasurementSummary(impacts) {
        const impactsWithMeasurementPlan = impacts.filter(impact => { var _a, _b; return ((_b = (_a = impact.measurementPlan) === null || _a === void 0 ? void 0 : _a.indicators) === null || _b === void 0 ? void 0 : _b.length) > 0; }).length;
        const allIndicators = new Set();
        const methodCounts = {};
        impacts.forEach(impact => {
            var _a, _b;
            if ((_a = impact.measurementPlan) === null || _a === void 0 ? void 0 : _a.indicators) {
                impact.measurementPlan.indicators.forEach((ind) => allIndicators.add(ind));
            }
            if ((_b = impact.measurementPlan) === null || _b === void 0 ? void 0 : _b.measurementMethod) {
                const method = impact.measurementPlan.measurementMethod;
                methodCounts[method] = (methodCounts[method] || 0) + 1;
            }
        });
        return {
            impactsWithMeasurementPlan,
            indicatorCount: allIndicators.size,
            measurementMethods: methodCounts
        };
    }
    // ==========================================================================
    // MULTI-SITE HELPERS
    // ==========================================================================
    static generateSiteBreakdown(sites, actions, impacts, reportType) {
        return __awaiter(this, void 0, void 0, function* () {
            const breakdown = [];
            for (const site of sites) {
                const siteId = site._id.toString();
                // Filter actions/impacts for this site
                const siteActions = actions.filter(action => { var _a, _b; return ((_b = (_a = action.stage) === null || _a === void 0 ? void 0 : _a.projectSite) === null || _b === void 0 ? void 0 : _b.toString()) === siteId; });
                const siteImpacts = impacts.filter(impact => { var _a, _b; return ((_b = (_a = impact.stage) === null || _a === void 0 ? void 0 : _a.projectSite) === null || _b === void 0 ? void 0 : _b.toString()) === siteId; });
                let ganttTimeline;
                let completionRate;
                if (reportType === 'workplan' && siteActions.length > 0) {
                    this.validateActionDependencies(siteActions);
                    ganttTimeline = yield this.generateGanttTimelineWithEstimation(siteActions);
                    const completed = siteActions.filter(a => a.status === 'completed').length;
                    completionRate = Math.round((completed / siteActions.length) * 100);
                }
                else if (reportType === 'outcome' && siteImpacts.length > 0) {
                    const achieved = siteImpacts.filter(i => i.status === 'achieved').length;
                    completionRate = Math.round((achieved / siteImpacts.length) * 100);
                }
                breakdown.push({
                    siteId,
                    siteName: site.name,
                    actionCount: siteActions.length,
                    impactCount: siteImpacts.length,
                    actions: reportType === 'workplan' ? siteActions : undefined,
                    impacts: reportType === 'outcome' ? siteImpacts : undefined,
                    ganttTimeline,
                    completionRate
                });
            }
            return breakdown.sort((a, b) => (b.actionCount + b.impactCount) - (a.actionCount + a.impactCount));
        });
    }
    static generateAggregatedView(siteBreakdown) {
        const actionsPerSite = {};
        const impactsPerSite = {};
        const completionRatePerSite = {};
        const riskCountPerSite = {};
        siteBreakdown.forEach(site => {
            actionsPerSite[site.siteName] = site.actionCount;
            impactsPerSite[site.siteName] = site.impactCount;
            completionRatePerSite[site.siteName] = site.completionRate || 0;
            if (site.impacts) {
                const riskCount = site.impacts.reduce((sum, impact) => sum + impact.risks.length, 0);
                riskCountPerSite[site.siteName] = riskCount;
            }
        });
        return {
            totalSites: siteBreakdown.length,
            actionsPerSite,
            impactsPerSite,
            completionRatePerSite,
            riskCountPerSite
        };
    }
    // ==========================================================================
    // CONSULTATION PLAN HELPERS
    // ==========================================================================
    static calculateConsultationCompletionStatus(plan) {
        const sections = {
            stakeholders: plan.stakeholderGroups.some((sg) => sg.isSelected),
            questions: Object.values(plan.consultationQuestions).some((q) => q && typeof q === 'string' && q.trim() !== ''),
            dates: plan.plannedConsultationDates.startDate ||
                plan.plannedConsultationDates.endDate ||
                (plan.plannedConsultationDates.dateDescription &&
                    plan.plannedConsultationDates.dateDescription.trim() !== '')
        };
        const completedSections = Object.entries(sections)
            .filter(([_, completed]) => completed)
            .map(([section, _]) => section);
        const missingSections = Object.entries(sections)
            .filter(([_, completed]) => !completed)
            .map(([section, _]) => section);
        const completionPercentage = Math.round((completedSections.length / Object.keys(sections).length) * 100);
        return {
            isCompleted: plan.isCompleted,
            completionPercentage,
            completedSections,
            missingSections
        };
    }
    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================
    static buildStageQuery(projectId, filters) {
        const query = {
            project: projectId,
            archived: filters.includeArchived ? undefined : { $ne: true }
        };
        switch (filters.scope) {
            case 'project':
                query.projectSite = null;
                break;
            case 'site':
                query.projectSite = { $ne: null };
                if (filters.siteIds && filters.siteIds.length > 0) {
                    query.projectSite = { $in: filters.siteIds.map(id => new mongoose_1.default.Types.ObjectId(id)) };
                }
                break;
            case 'all':
            default:
                if (filters.siteIds && filters.siteIds.length > 0) {
                    query.$or = [
                        { projectSite: null },
                        { projectSite: { $in: filters.siteIds.map(id => new mongoose_1.default.Types.ObjectId(id)) } }
                    ];
                }
                break;
        }
        if (filters.stageNumbers && filters.stageNumbers.length > 0) {
            query.stageNumber = { $in: filters.stageNumbers };
        }
        return query;
    }
    static fetchActionsAndImpacts(stages, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const stageIds = stages.map(stage => stage._id);
            const actionQuery = {
                stage: { $in: stageIds },
                archived: { $ne: true }
            };
            if (filters.stakeholderIds && filters.stakeholderIds.length > 0) {
                actionQuery.stakeholderGroup = {
                    $in: filters.stakeholderIds.map(id => new mongoose_1.default.Types.ObjectId(id))
                };
            }
            if (filters.themeIds && filters.themeIds.length > 0) {
                actionQuery.themes = {
                    $in: filters.themeIds.map(id => new mongoose_1.default.Types.ObjectId(id))
                };
            }
            const actions = yield stakeholderAction_model_1.default.find(actionQuery)
                .populate({
                path: 'stakeholderGroup',
                select: 'name description category estimatedPopulation completionStatus themes',
                populate: {
                    path: 'category',
                    select: 'name'
                }
            })
                .populate('themes', 'name')
                .populate('subThemes', 'name')
                .populate('stage', 'stageNumber status progress projectSite')
                .populate('dependencies')
                .sort({ createdAt: 1 });
            const impactQuery = {
                stage: { $in: stageIds },
                archived: { $ne: true }
            };
            if (filters.stakeholderIds && filters.stakeholderIds.length > 0) {
                impactQuery.stakeholderGroup = {
                    $in: filters.stakeholderIds.map(id => new mongoose_1.default.Types.ObjectId(id))
                };
            }
            if (filters.themeIds && filters.themeIds.length > 0) {
                impactQuery.themes = {
                    $in: filters.themeIds.map(id => new mongoose_1.default.Types.ObjectId(id))
                };
            }
            const impacts = yield socialImpact_model_1.default.find(impactQuery)
                .populate('stakeholderGroup', 'name')
                .populate('themes', 'name')
                .populate('subThemes', 'name')
                .populate('stage', 'stageNumber status progress projectSite')
                .sort({ createdAt: 1 });
            return { actions, impacts };
        });
    }
    static calculateDuration(startDate, endDate) {
        if (!startDate || !endDate)
            return 0;
        return Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    }
}
exports.TheoryOfChangeReportService = TheoryOfChangeReportService;
exports.default = TheoryOfChangeReportService;
//# sourceMappingURL=theoryOfChangeReport.service.js.map