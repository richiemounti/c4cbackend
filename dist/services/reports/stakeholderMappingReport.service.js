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
exports.StakeholderMappingReportService = void 0;
// services/reports/stakeholderMappingReport.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const stakeholderGroup_model_1 = __importDefault(require("../../models/stakeholderGroup.model"));
const project_model_1 = __importDefault(require("../../models/project.model"));
const projectSite_model_1 = __importDefault(require("../../models/projectSite.model"));
const category_model_1 = __importDefault(require("../../models/category.model"));
class StakeholderMappingReportService {
    /**
     * Generate comprehensive stakeholder mapping report
     */
    static generateReport(projectId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, userId, filters = { scope: 'all' }) {
            try {
                // Fetch project and organization info
                const project = yield project_model_1.default.findById(projectId).populate('organization');
                if (!project) {
                    throw new Error('Project not found');
                }
                // Build stakeholder query based on filters
                const stakeholderQuery = yield this.buildStakeholderQuery(projectId, filters);
                // Fetch stakeholders with all necessary data
                const stakeholders = yield stakeholderGroup_model_1.default.find(stakeholderQuery)
                    .populate('category', 'name')
                    .populate('project', 'name')
                    .populate('projectSite', 'name')
                    .populate('creator', 'name')
                    .sort({ 'category.name': 1, name: 1 });
                // Fetch all sites for metadata
                const allSites = yield projectSite_model_1.default.find({
                    project: projectId,
                    archived: { $ne: true }
                }).select('_id name');
                // Process stakeholder data
                const processedStakeholders = stakeholders.map(stakeholder => this.processStakeholderData(stakeholder));
                // Apply additional filters (including key insights filter)
                const filteredStakeholders = this.applyClientSideFilters(processedStakeholders, filters);
                // Generate summary statistics (enhanced with key insights)
                const summary = this.generateSummaryStats(filteredStakeholders);
                // Group stakeholders by category
                const stakeholdersByCategory = this.groupStakeholdersByCategory(filteredStakeholders);
                // Generate influence matrix
                const influenceMatrix = this.generateInfluenceMatrix(filteredStakeholders);
                // Get site information with stakeholder counts
                const availableSites = this.getAvailableSites(allSites, processedStakeholders);
                // Generate tag insights
                const tagInsights = this.generateTagInsights(filteredStakeholders);
                // NEW: Generate comprehensive key insights analysis
                const keyInsights = this.generateKeyInsights(filteredStakeholders);
                // Build the comprehensive report
                const reportData = {
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
                    reportMetadata: {
                        reportingPeriod: new Date(),
                        version: 'V1.0',
                        scope: filters.scope,
                        totalStakeholders: filteredStakeholders.length,
                        appliedFilters: filters,
                        generatedAt: new Date(),
                        generatedBy: userId
                    },
                    summary,
                    stakeholderData: filteredStakeholders,
                    stakeholdersByCategory,
                    influenceMatrix,
                    availableSites,
                    tagInsights,
                    keyInsights, // NEW: Add key insights
                    generationMetadata: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        dataVersion: '1.0',
                        totalRecords: filteredStakeholders.length
                    }
                };
                return reportData;
            }
            catch (error) {
                console.error('Error generating stakeholder mapping report:', error);
                throw new Error(`Failed to generate stakeholder mapping report: ${error}`);
            }
        });
    }
    /**
     * Build MongoDB query based on filters
     */
    static buildStakeholderQuery(projectId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                project: projectId,
                archived: filters.includeArchived ? undefined : { $ne: true }
            };
            // Handle scope filtering
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
            // Category filtering
            if (filters.categories && filters.categories.length > 0) {
                const categories = yield category_model_1.default.find({
                    name: { $in: filters.categories }
                }).select('_id');
                if (categories.length > 0) {
                    query.category = { $in: categories.map(cat => cat._id) };
                }
            }
            // Completion status filtering
            if (filters.completionStatus && filters.completionStatus.length > 0) {
                query.completionStatus = { $in: filters.completionStatus };
            }
            return query;
        });
    }
    /**
     * Process individual stakeholder data
     */
    static processStakeholderData(stakeholder) {
        // Calculate average rating
        const ratings = stakeholder.tasks
            .filter((task) => task.rating !== undefined)
            .map((task) => task.rating);
        const averageRating = ratings.length > 0
            ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
            : 0;
        // Count completed tasks
        const taskCompletionCount = stakeholder.tasks.filter((task) => task.responses && task.responses.length > 0 && task.rating !== undefined).length;
        // Process tags
        const allTags = [];
        const tagsByTask = {};
        stakeholder.tasks.forEach((task) => {
            if (task.tags && Array.isArray(task.tags) && task.tags.length > 0) {
                tagsByTask[task.taskType] = task.tags;
                allTags.push(...task.tags);
            }
            else {
                tagsByTask[task.taskType] = [];
            }
        });
        const uniqueTags = [...new Set(allTags)];
        // NEW: Process key insights
        const keyInsights = [];
        const keyInsightsByTask = {};
        stakeholder.tasks.forEach((task) => {
            var _a;
            const taskKeyInsights = ((_a = task.responses) === null || _a === void 0 ? void 0 : _a.filter((response) => response.isKeyInsight === true)) || [];
            keyInsightsByTask[task.taskType] = taskKeyInsights.length;
            taskKeyInsights.forEach((response) => {
                keyInsights.push({
                    taskType: task.taskType,
                    optionId: response.optionId,
                    description: response.description,
                    rating: task.rating
                });
            });
        });
        const keyInsightCount = keyInsights.length;
        const hasKeyInsights = keyInsightCount > 0;
        return {
            _id: stakeholder._id.toString(),
            name: stakeholder.name,
            description: stakeholder.description,
            category: {
                _id: stakeholder.category._id.toString(),
                name: stakeholder.category.name
            },
            project: {
                _id: stakeholder.project._id.toString(),
                name: stakeholder.project.name
            },
            projectSite: stakeholder.projectSite ? {
                _id: stakeholder.projectSite._id.toString(),
                name: stakeholder.projectSite.name
            } : undefined,
            completionStatus: stakeholder.completionStatus,
            tasks: stakeholder.tasks.map((task) => ({
                taskType: task.taskType,
                responses: task.responses,
                rating: task.rating,
                tags: task.tags || [],
                updatedAt: task.updatedAt
            })),
            themes: stakeholder.themes || [],
            createdAt: stakeholder.createdAt,
            updatedAt: stakeholder.updatedAt,
            averageRating,
            taskCompletionCount,
            scope: stakeholder.projectSite ? 'site' : 'project',
            allTags: uniqueTags,
            tagsByTask,
            // NEW: Add key insights data
            keyInsights,
            keyInsightCount,
            hasKeyInsights,
            keyInsightsByTask,
        };
    }
    /**
     * NEW: Generate comprehensive key insights analysis
     */
    static generateKeyInsights(stakeholders) {
        // Collect all key insights with full context
        const allInsights = [];
        stakeholders.forEach(stakeholder => {
            stakeholder.keyInsights.forEach(insight => {
                var _a;
                // Find the task to get tags
                const task = stakeholder.tasks.find(t => t.taskType === insight.taskType);
                allInsights.push({
                    stakeholder: {
                        _id: stakeholder._id,
                        name: stakeholder.name,
                        category: stakeholder.category.name
                    },
                    taskType: insight.taskType,
                    optionId: insight.optionId,
                    description: insight.description,
                    rating: insight.rating,
                    tags: (task === null || task === void 0 ? void 0 : task.tags) || [],
                    scope: stakeholder.scope,
                    siteName: (_a = stakeholder.projectSite) === null || _a === void 0 ? void 0 : _a.name
                });
            });
        });
        // Calculate basic statistics
        const totalKeyInsights = allInsights.length;
        const stakeholdersWithKeyInsights = stakeholders.filter(s => s.hasKeyInsights).length;
        const averageKeyInsightsPerStakeholder = stakeholders.length > 0
            ? Math.round((totalKeyInsights / stakeholders.length) * 10) / 10
            : 0;
        const percentageOfStakeholdersWithKeyInsights = stakeholders.length > 0
            ? Math.round((stakeholdersWithKeyInsights / stakeholders.length) * 100)
            : 0;
        // Group by task type
        const byTaskType = {};
        const taskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
        taskTypes.forEach(taskType => {
            const taskInsights = allInsights.filter(i => i.taskType === taskType);
            const uniqueStakeholders = new Set(taskInsights.map(i => i.stakeholder._id));
            byTaskType[taskType] = {
                count: taskInsights.length,
                stakeholders: uniqueStakeholders.size,
                insights: taskInsights
            };
        });
        // Group by category
        const byCategory = {};
        stakeholders.forEach(stakeholder => {
            const category = stakeholder.category.name;
            if (!byCategory[category]) {
                byCategory[category] = {
                    count: 0,
                    stakeholders: 0,
                    insights: []
                };
            }
            if (stakeholder.hasKeyInsights) {
                byCategory[category].stakeholders++;
                byCategory[category].count += stakeholder.keyInsightCount;
                // Add this stakeholder's key insights
                const stakeholderInsights = allInsights.filter(i => i.stakeholder._id === stakeholder._id);
                byCategory[category].insights.push(...stakeholderInsights);
            }
        });
        // Top stakeholders with most key insights
        const topStakeholders = stakeholders
            .filter(s => s.hasKeyInsights)
            .map(s => ({
            stakeholder: {
                _id: s._id,
                name: s.name,
                category: s.category.name
            },
            keyInsightCount: s.keyInsightCount,
            keyInsightsByTask: s.keyInsightsByTask,
            averageRating: s.averageRating
        }))
            .sort((a, b) => b.keyInsightCount - a.keyInsightCount)
            .slice(0, 10);
        // Rating distribution for key insights
        const ratingDistribution = {
            '1': 0, '2': 0, '3': 0, '4': 0, '5': 0
        };
        allInsights.forEach(insight => {
            if (insight.rating) {
                const ratingKey = Math.round(insight.rating).toString();
                if (ratingDistribution[ratingKey] !== undefined) {
                    ratingDistribution[ratingKey]++;
                }
            }
        });
        // Key insights by scope
        const byScope = {
            project: allInsights.filter(i => i.scope === 'project').length,
            site: allInsights.filter(i => i.scope === 'site').length
        };
        // Recent insights (last 10)
        const recentInsights = [...allInsights]
            .sort((a, b) => {
            // We don't have updatedAt on insights directly, so we'll just take the first 10
            // In a real scenario, you might want to track when insights were marked
            return 0;
        })
            .slice(0, 10);
        return {
            totalKeyInsights,
            stakeholdersWithKeyInsights,
            averageKeyInsightsPerStakeholder,
            percentageOfStakeholdersWithKeyInsights,
            byTaskType,
            byCategory,
            topStakeholders,
            ratingDistribution,
            byScope,
            allInsights,
            recentInsights
        };
    }
    /**
     * Generate comprehensive tag insights
     */
    static generateTagInsights(stakeholders) {
        // ... (keep existing implementation)
        const tagData = new Map();
        stakeholders.forEach(stakeholder => {
            stakeholder.allTags.forEach(tag => {
                if (!tagData.has(tag)) {
                    tagData.set(tag, {
                        count: 0,
                        stakeholders: new Set(),
                        categories: new Set(),
                        taskTypes: new Set()
                    });
                }
                const data = tagData.get(tag);
                data.count++;
                data.stakeholders.add(stakeholder.name);
                data.categories.add(stakeholder.category.name);
                Object.entries(stakeholder.tagsByTask).forEach(([taskType, tags]) => {
                    if (tags.includes(tag)) {
                        data.taskTypes.add(taskType);
                    }
                });
            });
        });
        const mostCommonTags = Array.from(tagData.entries())
            .map(([tag, data]) => ({
            tag,
            count: data.count,
            stakeholders: Array.from(data.stakeholders)
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
        const tagsByCategory = {};
        stakeholders.forEach(stakeholder => {
            const category = stakeholder.category.name;
            if (!tagsByCategory[category]) {
                tagsByCategory[category] = [];
            }
            const categoryTags = new Map();
            stakeholder.allTags.forEach(tag => {
                categoryTags.set(tag, (categoryTags.get(tag) || 0) + 1);
            });
            tagsByCategory[category] = Array.from(categoryTags.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count);
        });
        Object.keys(tagsByCategory).forEach(category => {
            const tagCounts = new Map();
            stakeholders
                .filter(s => s.category.name === category)
                .forEach(stakeholder => {
                stakeholder.allTags.forEach(tag => {
                    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
                });
            });
            tagsByCategory[category] = Array.from(tagCounts.entries())
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
        });
        const tagsByTaskType = {};
        const taskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
        taskTypes.forEach(taskType => {
            const taskTags = new Set();
            stakeholders.forEach(stakeholder => {
                if (stakeholder.tagsByTask[taskType]) {
                    stakeholder.tagsByTask[taskType].forEach(tag => taskTags.add(tag));
                }
            });
            tagsByTaskType[taskType] = Array.from(taskTags);
        });
        const tagFrequencyDistribution = {};
        stakeholders.forEach(stakeholder => {
            const tagCount = stakeholder.allTags.length;
            const key = tagCount === 0 ? '0' :
                tagCount <= 5 ? '1-5' :
                    tagCount <= 10 ? '6-10' :
                        tagCount <= 15 ? '11-15' : '16+';
            tagFrequencyDistribution[key] = (tagFrequencyDistribution[key] || 0) + 1;
        });
        return {
            totalUniqueTags: tagData.size,
            mostCommonTags,
            tagsByCategory,
            tagsByTaskType,
            tagFrequencyDistribution
        };
    }
    /**
     * Apply client-side filters
     */
    static applyClientSideFilters(stakeholders, filters) {
        let filtered = [...stakeholders];
        // Connection strength filtering
        if (filters.connectionStrength) {
            const { min, max } = filters.connectionStrength;
            filtered = filtered.filter(stakeholder => {
                const avgRating = stakeholder.averageRating;
                return avgRating >= min && avgRating <= max;
            });
        }
        // NEW: Filter for only stakeholders with key insights
        if (filters.onlyKeyInsights) {
            filtered = filtered.filter(stakeholder => stakeholder.hasKeyInsights);
        }
        return filtered;
    }
    /**
     * Generate summary statistics (enhanced with key insights)
     */
    static generateSummaryStats(stakeholders) {
        const total = stakeholders.length;
        const completed = stakeholders.filter(s => s.completionStatus === 'completed').length;
        const inProgress = stakeholders.filter(s => s.completionStatus === 'in_progress').length;
        const notStarted = stakeholders.filter(s => s.completionStatus === 'not_started').length;
        // Group by category
        const byCategory = stakeholders.reduce((acc, stakeholder) => {
            const category = stakeholder.category.name;
            if (!acc[category]) {
                acc[category] = { total: 0, completed: 0, ratings: [] };
            }
            acc[category].total++;
            if (stakeholder.completionStatus === 'completed') {
                acc[category].completed++;
            }
            if (stakeholder.averageRating > 0) {
                acc[category].ratings.push(stakeholder.averageRating);
            }
            return acc;
        }, {});
        const stakeholdersByCategory = Object.keys(byCategory).reduce((acc, category) => {
            const data = byCategory[category];
            acc[category] = {
                total: data.total,
                completed: data.completed,
                averageRating: data.ratings.length > 0
                    ? Math.round((data.ratings.reduce((sum, rating) => sum + rating, 0) / data.ratings.length) * 10) / 10
                    : 0
            };
            return acc;
        }, {});
        const byScope = stakeholders.reduce((acc, stakeholder) => {
            acc[stakeholder.scope]++;
            return acc;
        }, { project: 0, site: 0 });
        const bySite = stakeholders.reduce((acc, stakeholder) => {
            if (stakeholder.projectSite) {
                const siteName = stakeholder.projectSite.name;
                acc[siteName] = (acc[siteName] || 0) + 1;
            }
            return acc;
        }, {});
        const taskTypeRatings = stakeholders.reduce((acc, stakeholder) => {
            stakeholder.tasks.forEach(task => {
                if (task.rating !== undefined) {
                    if (!acc[task.taskType]) {
                        acc[task.taskType] = [];
                    }
                    acc[task.taskType].push(task.rating);
                }
            });
            return acc;
        }, {});
        const averageRatingsByTaskType = Object.keys(taskTypeRatings).reduce((acc, taskType) => {
            const ratings = taskTypeRatings[taskType];
            acc[taskType] = Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;
            return acc;
        }, {});
        const allRatings = stakeholders.filter(s => s.averageRating > 0).map(s => s.averageRating);
        const overallAverageRating = allRatings.length > 0
            ? Math.round((allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length) * 10) / 10
            : 0;
        // NEW: Calculate key insights summary
        const totalKeyInsights = stakeholders.reduce((sum, s) => sum + s.keyInsightCount, 0);
        const stakeholdersWithKeyInsights = stakeholders.filter(s => s.hasKeyInsights).length;
        const averageKeyInsightsPerStakeholder = stakeholders.length > 0
            ? Math.round((totalKeyInsights / stakeholders.length) * 10) / 10
            : 0;
        return {
            totalStakeholders: total,
            completedStakeholders: completed,
            inProgressStakeholders: inProgress,
            notStartedStakeholders: notStarted,
            completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            stakeholdersByCategory,
            stakeholdersByScope: byScope,
            stakeholdersBySite: bySite,
            averageRatings: {
                overall: overallAverageRating,
                byTaskType: averageRatingsByTaskType
            },
            // NEW: Add key insights summary
            totalKeyInsights,
            stakeholdersWithKeyInsights,
            averageKeyInsightsPerStakeholder
        };
    }
    /**
     * Group stakeholders by category
     */
    static groupStakeholdersByCategory(stakeholders) {
        return stakeholders.reduce((acc, stakeholder) => {
            const category = stakeholder.category.name;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(stakeholder);
            return acc;
        }, {});
    }
    /**
     * Generate influence matrix
     */
    static generateInfluenceMatrix(stakeholders) {
        return stakeholders.map(stakeholder => {
            const ratings = {
                power: this.getTaskRating(stakeholder, 'power'),
                connections: this.getTaskRating(stakeholder, 'connections'),
                risks: this.getTaskRating(stakeholder, 'risks'),
                roles: this.getTaskRating(stakeholder, 'roles'),
                benefits: this.getTaskRating(stakeholder, 'benefits'),
                wellbeing: this.getTaskRating(stakeholder, 'wellbeing')
            };
            const validRatings = Object.values(ratings).filter(rating => rating > 0);
            const averageInfluence = validRatings.length > 0
                ? Math.round((validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length) * 10) / 10
                : 0;
            return {
                stakeholder,
                ratings,
                averageInfluence
            };
        });
    }
    /**
     * Get task rating for a specific task type
     */
    static getTaskRating(stakeholder, taskType) {
        const task = stakeholder.tasks.find(t => t.taskType === taskType);
        return (task === null || task === void 0 ? void 0 : task.rating) || 0;
    }
    /**
     * Get task responses for a specific task type
     */
    static getTaskResponses(stakeholder, taskType) {
        const task = stakeholder.tasks.find(t => t.taskType === taskType);
        if (!task || !task.responses || task.responses.length === 0) {
            return 'Not provided';
        }
        return task.responses
            .map(response => response.description || response.optionId)
            .filter(desc => desc && desc.trim() !== '')
            .join(', ') || 'No description provided';
    }
    /**
     * NEW: Get key insight responses for a specific task type
     */
    static getKeyInsightResponses(stakeholder, taskType) {
        const task = stakeholder.tasks.find(t => t.taskType === taskType);
        if (!task || !task.responses || task.responses.length === 0) {
            return 'None';
        }
        const keyInsights = task.responses
            .filter(response => response.isKeyInsight === true)
            .map(response => response.description || response.optionId)
            .filter(desc => desc && desc.trim() !== '');
        return keyInsights.length > 0 ? keyInsights.join(', ') : 'None';
    }
    /**
     * Get available sites with stakeholder counts (enhanced with key insight counts)
     */
    static getAvailableSites(allSites, stakeholders) {
        return allSites.map(site => {
            const siteStakeholders = stakeholders.filter(s => s.projectSite && s.projectSite._id === site._id.toString());
            const keyInsightCount = siteStakeholders.reduce((sum, s) => sum + s.keyInsightCount, 0);
            return {
                _id: site._id.toString(),
                name: site.name,
                stakeholderCount: siteStakeholders.length,
                keyInsightCount // NEW: Add key insight count
            };
        });
    }
    /**
     * Generate report with specific site filtering
     */
    static generateSiteSpecificReport(projectId, siteId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const filters = {
                scope: 'site',
                siteIds: [siteId]
            };
            return this.generateReport(projectId, userId, filters);
        });
    }
    /**
     * Generate project-only report
     */
    static generateProjectOnlyReport(projectId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const filters = {
                scope: 'project'
            };
            return this.generateReport(projectId, userId, filters);
        });
    }
    /**
     * NEW: Generate key insights only report
     */
    static generateKeyInsightsReport(projectId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, userId, scope = 'all') {
            const filters = {
                scope,
                onlyKeyInsights: true
            };
            return this.generateReport(projectId, userId, filters);
        });
    }
    /**
     * Get stakeholder completion summary
     */
    static getCompletionSummary(projectId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = yield this.buildStakeholderQuery(projectId, filters || { scope: 'all' });
                const stakeholders = yield stakeholderGroup_model_1.default.find(query).select('completionStatus');
                const summary = stakeholders.reduce((acc, stakeholder) => {
                    acc[stakeholder.completionStatus] = (acc[stakeholder.completionStatus] || 0) + 1;
                    return acc;
                }, { completed: 0, in_progress: 0, not_started: 0 });
                const total = stakeholders.length;
                const completionPercentage = total > 0 ? Math.round((summary.completed / total) * 100) : 0;
                return Object.assign(Object.assign({ total }, summary), { completionPercentage });
            }
            catch (error) {
                console.error('Error getting completion summary:', error);
                throw new Error(`Failed to get completion summary: ${error}`);
            }
        });
    }
}
exports.StakeholderMappingReportService = StakeholderMappingReportService;
exports.default = StakeholderMappingReportService;
//# sourceMappingURL=stakeholderMappingReport.service.js.map