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
exports.RiskRegisterReportService = void 0;
// services/reports/riskRegisterReport.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const riskRegister_model_1 = __importDefault(require("../../models/riskRegister.model"));
const project_model_1 = __importDefault(require("../../models/project.model"));
const projectSite_model_1 = __importDefault(require("../../models/projectSite.model"));
const organization_model_1 = __importDefault(require("../../models/organization.model"));
const user_model_1 = __importDefault(require("../../models/user.model"));
class RiskRegisterReportService {
    /**
     * Generate comprehensive risk register report
     * REFACTORED VERSION - Fixes infinite loop issues
     */
    static generateReport(projectId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (projectId, userId, filters = { scope: 'all' }) {
            const startTime = Date.now();
            console.log('='.repeat(80));
            console.log('START: RiskRegisterReportService.generateReport (REFACTORED)');
            console.log('Parameters:', JSON.stringify({ projectId, userId, filters }, null, 2));
            console.log('='.repeat(80));
            try {
                // Set default limit to prevent massive queries
                const queryLimit = filters.limit || 1000;
                const querySkip = filters.skip || 0;
                // STEP 1: Fetch project and organization separately (NO POPULATE)
                console.log('\n[STEP 1] Fetching project and organization...');
                const projectStart = Date.now();
                const project = yield project_model_1.default.findById(projectId)
                    .select('_id name description status organization')
                    .lean()
                    .maxTimeMS(3000)
                    .exec();
                if (!project) {
                    throw new Error('Project not found');
                }
                const organization = yield organization_model_1.default.findById(project.organization)
                    .select('_id name country city')
                    .lean()
                    .maxTimeMS(3000)
                    .exec();
                if (!organization) {
                    throw new Error('Organization not found');
                }
                console.log(`[STEP 1] ✓ Completed in ${Date.now() - projectStart}ms`);
                console.log(`[STEP 1] Project: ${project.name}, Org: ${organization.name}`);
                // STEP 2: Build risk query
                console.log('\n[STEP 2] Building risk query...');
                const queryStart = Date.now();
                const riskQuery = this.buildRiskQuery(projectId, filters);
                console.log(`[STEP 2] ✓ Query built in ${Date.now() - queryStart}ms`);
                // STEP 3: Count total risks (for pagination)
                console.log('\n[STEP 3] Counting risks...');
                const countStart = Date.now();
                const totalCount = yield riskRegister_model_1.default.countDocuments(riskQuery)
                    .maxTimeMS(3000)
                    .exec();
                console.log(`[STEP 3] ✓ Count completed in ${Date.now() - countStart}ms`);
                console.log(`[STEP 3] Total matching risks: ${totalCount}`);
                if (totalCount === 0) {
                    console.log('[STEP 3] No risks found, returning empty report');
                    return this.createEmptyReport(project, organization, userId, filters, startTime);
                }
                // STEP 4: Fetch risks WITHOUT POPULATE (this is the key fix)
                console.log('\n[STEP 4] Fetching risks WITHOUT populate...');
                const fetchStart = Date.now();
                const risks = yield riskRegister_model_1.default.find(riskQuery)
                    .select('-__v') // Exclude version key
                    .sort({ riskScore: -1, identifiedDate: -1 })
                    .limit(queryLimit)
                    .skip(querySkip)
                    .lean()
                    .maxTimeMS(5000)
                    .exec();
                console.log(`[STEP 4] ✓ Risks fetched in ${Date.now() - fetchStart}ms`);
                console.log(`[STEP 4] Retrieved ${risks.length} risks`);
                // STEP 5: Extract all unique IDs for batch fetching
                console.log('\n[STEP 5] Extracting unique IDs...');
                const extractStart = Date.now();
                const userIds = new Set();
                const siteIds = new Set();
                risks.forEach((risk) => {
                    var _a, _b, _c;
                    if (risk.owner)
                        userIds.add(risk.owner.toString());
                    if (risk.creator)
                        userIds.add(risk.creator.toString());
                    if (risk.lastUpdatedBy)
                        userIds.add(risk.lastUpdatedBy.toString());
                    if (risk.projectSite)
                        siteIds.add(risk.projectSite.toString());
                    // Extract users from mitigation actions
                    (_a = risk.mitigationActions) === null || _a === void 0 ? void 0 : _a.forEach((action) => {
                        if (action.responsible)
                            userIds.add(action.responsible.toString());
                    });
                    // Extract users from risk history
                    (_b = risk.riskHistory) === null || _b === void 0 ? void 0 : _b.forEach((history) => {
                        if (history.updatedBy)
                            userIds.add(history.updatedBy.toString());
                    });
                    // Extract users from attachments
                    (_c = risk.attachments) === null || _c === void 0 ? void 0 : _c.forEach((attachment) => {
                        if (attachment.uploadedBy)
                            userIds.add(attachment.uploadedBy.toString());
                    });
                });
                console.log(`[STEP 5] ✓ Extraction completed in ${Date.now() - extractStart}ms`);
                console.log(`[STEP 5] Found ${userIds.size} unique users, ${siteIds.size} unique sites`);
                // STEP 6: Batch fetch users and sites in parallel
                console.log('\n[STEP 6] Batch fetching related data...');
                const batchStart = Date.now();
                const [users, sites] = yield Promise.all([
                    user_model_1.default.find({ _id: { $in: Array.from(userIds) } })
                        .select('_id name email')
                        .lean()
                        .maxTimeMS(3000)
                        .exec(),
                    siteIds.size > 0
                        ? projectSite_model_1.default.find({ _id: { $in: Array.from(siteIds) } })
                            .select('_id name status')
                            .lean()
                            .maxTimeMS(3000)
                            .exec()
                        : Promise.resolve([])
                ]);
                // Create lookup maps for O(1) access
                const userMap = new Map(users.map((u) => [u._id.toString(), u]));
                const siteMap = new Map(sites.map((s) => [s._id.toString(), s]));
                console.log(`[STEP 6] ✓ Batch fetch completed in ${Date.now() - batchStart}ms`);
                console.log(`[STEP 6] Fetched ${users.length} users, ${sites.length} sites`);
                // STEP 7: Fetch all project sites for availability list
                console.log('\n[STEP 7] Fetching all project sites...');
                const allSitesStart = Date.now();
                const allSites = yield projectSite_model_1.default.find({
                    project: projectId,
                    archived: { $ne: true }
                })
                    .select('_id name')
                    .lean()
                    .maxTimeMS(3000)
                    .exec();
                console.log(`[STEP 7] ✓ Sites fetched in ${Date.now() - allSitesStart}ms`);
                console.log(`[STEP 7] Found ${allSites.length} total sites`);
                // STEP 8: Process risks with manual "population" using maps
                console.log('\n[STEP 8] Processing risks with manual population...');
                const processStart = Date.now();
                const processedRisks = risks.map((risk) => this.processRiskDataWithMaps(risk, userMap, siteMap, project, organization));
                console.log(`[STEP 8] ✓ Processing completed in ${Date.now() - processStart}ms`);
                // STEP 9: Apply additional client-side filters
                console.log('\n[STEP 9] Applying client-side filters...');
                const filterStart = Date.now();
                const filteredRisks = this.applyClientSideFilters(processedRisks, filters);
                console.log(`[STEP 9] ✓ Filtering completed in ${Date.now() - filterStart}ms`);
                console.log(`[STEP 9] ${filteredRisks.length} risks after filtering`);
                // STEP 10: Generate summary and groupings
                console.log('\n[STEP 10] Generating analytics...');
                const analyticsStart = Date.now();
                const executiveSummary = this.generateExecutiveSummary(filteredRisks);
                const risksByCategory = this.groupRisksByCategory(filteredRisks);
                const risksByType = this.groupRisksByType(filteredRisks);
                const risksByOwner = this.groupRisksByOwner(filteredRisks);
                const overdueRisks = this.getOverdueRisks(filteredRisks);
                const highPriorityRisks = this.getHighPriorityRisks(filteredRisks);
                const availableSites = this.getAvailableSites(allSites, processedRisks);
                console.log(`[STEP 10] ✓ Analytics completed in ${Date.now() - analyticsStart}ms`);
                // STEP 11: Build final report
                console.log('\n[STEP 11] Building final report...');
                const totalExecutionTime = Date.now() - startTime;
                const reportData = {
                    projectInfo: {
                        id: project._id.toString(),
                        name: project.name,
                        description: project.description,
                        status: project.status
                    },
                    organizationInfo: {
                        id: organization._id.toString(),
                        name: organization.name,
                        country: organization.country,
                        city: organization.city
                    },
                    reportMetadata: {
                        reportingPeriod: new Date(),
                        version: 'V1.0',
                        scope: filters.scope || 'all',
                        totalRisks: filteredRisks.length,
                        appliedFilters: filters,
                        generatedAt: new Date(),
                        generatedBy: userId
                    },
                    executiveSummary,
                    riskDetails: filteredRisks,
                    risksByCategory,
                    risksByType,
                    risksByOwner,
                    overdueRisks,
                    highPriorityRisks,
                    availableSites,
                    generationMetadata: {
                        generatedAt: new Date(),
                        generatedBy: userId,
                        dataVersion: '1.0',
                        totalRecords: filteredRisks.length,
                        queryExecutionTime: totalExecutionTime
                    }
                };
                console.log('\n' + '='.repeat(80));
                console.log('SUCCESS: Report generated');
                console.log(`Total execution time: ${totalExecutionTime}ms`);
                console.log(`Total risks: ${reportData.executiveSummary.totalRisks}`);
                console.log('='.repeat(80) + '\n');
                return reportData;
            }
            catch (error) {
                const executionTime = Date.now() - startTime;
                console.error('\n' + '!'.repeat(80));
                console.error('ERROR in generateReport:');
                console.error('Execution time before error:', executionTime, 'ms');
                console.error('Message:', error instanceof Error ? error.message : 'Unknown');
                console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
                console.error('!'.repeat(80) + '\n');
                throw error;
            }
        });
    }
    /**
     * Build MongoDB query based on filters (SIMPLIFIED)
     */
    static buildRiskQuery(projectId, filters) {
        const query = {
            project: new mongoose_1.default.Types.ObjectId(projectId),
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
        // Status filtering
        if (filters.status && filters.status.length > 0) {
            query.status = { $in: filters.status };
        }
        // Risk score filtering
        if (filters.riskScore && filters.riskScore.length > 0) {
            query.riskScore = { $in: filters.riskScore };
        }
        // Risk type filtering
        if (filters.riskType && filters.riskType.length > 0) {
            query.riskType = { $in: filters.riskType };
        }
        // Category filtering
        if (filters.category && filters.category.length > 0) {
            query.category = { $in: filters.category };
        }
        // Owner filtering
        if (filters.ownerIds && filters.ownerIds.length > 0) {
            query.owner = { $in: filters.ownerIds.map(id => new mongoose_1.default.Types.ObjectId(id)) };
        }
        // Review date filtering
        if (filters.reviewDateFrom || filters.reviewDateTo) {
            query.reviewDate = {};
            if (filters.reviewDateFrom) {
                query.reviewDate.$gte = filters.reviewDateFrom;
            }
            if (filters.reviewDateTo) {
                query.reviewDate.$lte = filters.reviewDateTo;
            }
        }
        // Overdue only filtering
        if (filters.overdueOnly) {
            query.reviewDate = { $lt: new Date() };
            query.status = { $in: ['open', 'monitoring'] };
        }
        return query;
    }
    /**
     * Process risk data with manual population using maps (KEY FIX)
     */
    static processRiskDataWithMaps(risk, userMap, siteMap, project, organization) {
        var _a, _b, _c, _d;
        const now = new Date();
        // Calculate days until review
        let daysUntilReview = null;
        let isReviewOverdue = false;
        if (risk.reviewDate) {
            const reviewDate = new Date(risk.reviewDate);
            const diffTime = reviewDate.getTime() - now.getTime();
            daysUntilReview = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            isReviewOverdue = reviewDate < now && ['open', 'monitoring'].includes(risk.status);
        }
        // Calculate mitigation progress
        const totalActions = ((_a = risk.mitigationActions) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const completedActions = ((_b = risk.mitigationActions) === null || _b === void 0 ? void 0 : _b.filter((action) => action.status === 'completed').length) || 0;
        const mitigationProgress = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;
        // Helper function to get user safely
        const getUser = (userId) => {
            if (!userId)
                return undefined;
            const id = userId.toString();
            const user = userMap.get(id);
            return user ? {
                _id: user._id.toString(),
                name: user.name,
                email: user.email
            } : {
                _id: id,
                name: 'Unknown User',
                email: ''
            };
        };
        // Get site if exists
        const projectSite = risk.projectSite ? siteMap.get(risk.projectSite.toString()) : undefined;
        return {
            _id: risk._id.toString(),
            project: {
                _id: project._id.toString(),
                name: project.name,
                status: project.status
            },
            projectSite: projectSite ? {
                _id: projectSite._id.toString(),
                name: projectSite.name,
                status: projectSite.status
            } : undefined,
            organization: {
                _id: organization._id.toString(),
                name: organization.name,
                country: organization.country,
                city: organization.city
            },
            name: risk.name,
            riskType: risk.riskType,
            riskDescription: risk.riskDescription,
            probability: risk.probability,
            consequences: risk.consequences,
            riskScore: risk.riskScore,
            owner: getUser(risk.owner),
            mitigationStrategy: risk.mitigationStrategy,
            category: risk.category,
            impactArea: risk.impactArea || [],
            identifiedDate: risk.identifiedDate,
            reviewDate: risk.reviewDate,
            status: risk.status,
            mitigationActions: (risk.mitigationActions || []).map((action) => ({
                action: action.action,
                responsible: getUser(action.responsible),
                dueDate: action.dueDate,
                status: action.status,
                completedAt: action.completedAt,
                notes: action.notes
            })),
            riskHistory: (risk.riskHistory || []).map((history) => {
                var _a, _b;
                return ({
                    date: history.date,
                    probability: history.probability,
                    consequences: history.consequences,
                    riskScore: history.riskScore,
                    notes: history.notes,
                    updatedBy: history.updatedBy ? {
                        _id: ((_a = getUser(history.updatedBy)) === null || _a === void 0 ? void 0 : _a._id) || '',
                        name: ((_b = getUser(history.updatedBy)) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown'
                    } : undefined
                });
            }),
            attachments: (risk.attachments || []).map((attachment) => {
                var _a, _b;
                return ({
                    filename: attachment.filename,
                    url: attachment.url,
                    uploadedBy: {
                        _id: ((_a = getUser(attachment.uploadedBy)) === null || _a === void 0 ? void 0 : _a._id) || '',
                        name: ((_b = getUser(attachment.uploadedBy)) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown'
                    },
                    uploadedAt: attachment.uploadedAt
                });
            }),
            notes: risk.notes,
            creator: getUser(risk.creator),
            lastUpdatedBy: risk.lastUpdatedBy ? {
                _id: ((_c = getUser(risk.lastUpdatedBy)) === null || _c === void 0 ? void 0 : _c._id) || '',
                name: ((_d = getUser(risk.lastUpdatedBy)) === null || _d === void 0 ? void 0 : _d.name) || 'Unknown'
            } : undefined,
            archived: risk.archived || false,
            archivedAt: risk.archivedAt,
            createdAt: risk.createdAt,
            updatedAt: risk.updatedAt,
            isReviewOverdue,
            daysUntilReview,
            mitigationProgress,
            scope: risk.projectSite ? 'site' : 'project'
        };
    }
    /**
     * Apply client-side filters
     */
    static applyClientSideFilters(risks, filters) {
        // Currently all filtering is in MongoDB query
        // Add any additional filtering logic here if needed
        return risks;
    }
    /**
     * Generate executive summary statistics
     */
    static generateExecutiveSummary(risks) {
        const total = risks.length;
        const risksByScore = risks.reduce((acc, risk) => {
            const score = risk.riskScore;
            acc[score] = (acc[score] || 0) + 1;
            return acc;
        }, { high: 0, medium: 0, low: 0 });
        const risksByStatus = risks.reduce((acc, risk) => {
            const status = risk.status;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, { open: 0, monitoring: 0, closed: 0, transferred: 0 });
        const risksByType = risks.reduce((acc, risk) => {
            acc[risk.riskType] = (acc[risk.riskType] || 0) + 1;
            return acc;
        }, {});
        const risksByCategory = risks.reduce((acc, risk) => {
            acc[risk.category] = (acc[risk.category] || 0) + 1;
            return acc;
        }, {});
        const risksByScope = risks.reduce((acc, risk) => {
            acc[risk.scope] = (acc[risk.scope] || 0) + 1;
            return acc;
        }, { project: 0, site: 0 });
        const risksBySite = risks.reduce((acc, risk) => {
            if (risk.projectSite) {
                const siteName = risk.projectSite.name;
                acc[siteName] = (acc[siteName] || 0) + 1;
            }
            return acc;
        }, {});
        const reviewOverdue = risks.filter(risk => risk.isReviewOverdue).length;
        const dueForReviewSoon = risks.filter(risk => risk.daysUntilReview !== null && risk.daysUntilReview >= 0 && risk.daysUntilReview <= 7).length;
        const risksWithReviewDates = risks.filter(risk => risk.daysUntilReview !== null);
        const averageDaysToReview = risksWithReviewDates.length > 0
            ? Math.round(risksWithReviewDates.reduce((sum, risk) => sum + (risk.daysUntilReview || 0), 0) / risksWithReviewDates.length)
            : 0;
        const totalActions = risks.reduce((sum, risk) => sum + risk.mitigationActions.length, 0);
        const completedActions = risks.reduce((sum, risk) => sum + risk.mitigationActions.filter(action => action.status === 'completed').length, 0);
        const averageProgress = risks.length > 0
            ? Math.round(risks.reduce((sum, risk) => sum + risk.mitigationProgress, 0) / risks.length)
            : 0;
        return {
            totalRisks: total,
            risksByScore,
            risksByStatus,
            risksByType,
            risksByCategory,
            reviewMetrics: {
                reviewOverdue,
                dueForReviewSoon,
                averageDaysToReview
            },
            mitigationMetrics: {
                averageProgress,
                totalActions,
                completedActions
            },
            risksByScope,
            risksBySite
        };
    }
    /**
     * Group risks by category
     */
    static groupRisksByCategory(risks) {
        return risks.reduce((acc, risk) => {
            if (!acc[risk.category]) {
                acc[risk.category] = [];
            }
            acc[risk.category].push(risk);
            return acc;
        }, {});
    }
    /**
     * Group risks by type
     */
    static groupRisksByType(risks) {
        return risks.reduce((acc, risk) => {
            if (!acc[risk.riskType]) {
                acc[risk.riskType] = [];
            }
            acc[risk.riskType].push(risk);
            return acc;
        }, {});
    }
    /**
     * Group risks by owner
     */
    static groupRisksByOwner(risks) {
        return risks.reduce((acc, risk) => {
            const ownerName = risk.owner.name;
            if (!acc[ownerName]) {
                acc[ownerName] = [];
            }
            acc[ownerName].push(risk);
            return acc;
        }, {});
    }
    /**
     * Get overdue risks
     */
    static getOverdueRisks(risks) {
        return risks
            .filter(risk => risk.isReviewOverdue)
            .sort((a, b) => {
            if (!a.reviewDate || !b.reviewDate)
                return 0;
            return new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime();
        });
    }
    /**
     * Get high priority risks
     */
    static getHighPriorityRisks(risks) {
        return risks
            .filter(risk => risk.riskScore === 'high' ||
            risk.status === 'open' ||
            risk.isReviewOverdue)
            .sort((a, b) => {
            const scoreOrder = { high: 3, medium: 2, low: 1 };
            const scoreA = scoreOrder[a.riskScore] || 0;
            const scoreB = scoreOrder[b.riskScore] || 0;
            if (scoreA !== scoreB)
                return scoreB - scoreA;
            if (a.isReviewOverdue && !b.isReviewOverdue)
                return -1;
            if (!a.isReviewOverdue && b.isReviewOverdue)
                return 1;
            return 0;
        });
    }
    /**
     * Get available sites with risk counts
     */
    static getAvailableSites(allSites, risks) {
        return allSites.map(site => ({
            _id: site._id.toString(),
            name: site.name,
            riskCount: risks.filter(risk => risk.projectSite && risk.projectSite._id === site._id.toString()).length
        }));
    }
    /**
     * Create empty report when no risks found
     */
    static createEmptyReport(project, organization, userId, filters, startTime) {
        return {
            projectInfo: {
                id: project._id.toString(),
                name: project.name,
                description: project.description,
                status: project.status
            },
            organizationInfo: {
                id: organization._id.toString(),
                name: organization.name,
                country: organization.country,
                city: organization.city
            },
            reportMetadata: {
                reportingPeriod: new Date(),
                version: 'V1.0',
                scope: filters.scope || 'all',
                totalRisks: 0,
                appliedFilters: filters,
                generatedAt: new Date(),
                generatedBy: userId
            },
            executiveSummary: {
                totalRisks: 0,
                risksByScore: { high: 0, medium: 0, low: 0 },
                risksByStatus: { open: 0, monitoring: 0, closed: 0, transferred: 0 },
                risksByType: {},
                risksByCategory: {},
                reviewMetrics: {
                    reviewOverdue: 0,
                    dueForReviewSoon: 0,
                    averageDaysToReview: 0
                },
                mitigationMetrics: {
                    averageProgress: 0,
                    totalActions: 0,
                    completedActions: 0
                },
                risksByScope: { project: 0, site: 0 },
                risksBySite: {}
            },
            riskDetails: [],
            risksByCategory: {},
            risksByType: {},
            risksByOwner: {},
            overdueRisks: [],
            highPriorityRisks: [],
            availableSites: [],
            generationMetadata: {
                generatedAt: new Date(),
                generatedBy: userId,
                dataVersion: '1.0',
                totalRecords: 0,
                queryExecutionTime: Date.now() - startTime
            }
        };
    }
    /**
     * Generate report with specific site filtering
     */
    static generateSiteSpecificReport(projectId, siteId, userId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const reportFilters = Object.assign({ scope: 'site', siteIds: [siteId] }, filters);
            return this.generateReport(projectId, userId, reportFilters);
        });
    }
    /**
     * Generate project-only report
     */
    static generateProjectOnlyReport(projectId, userId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const reportFilters = Object.assign({ scope: 'project' }, filters);
            return this.generateReport(projectId, userId, reportFilters);
        });
    }
    /**
     * Generate overdue risks report
     */
    static generateOverdueRisksReport(projectId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const filters = {
                scope: 'all',
                overdueOnly: true
            };
            return this.generateReport(projectId, userId, filters);
        });
    }
    /**
     * Get risk summary statistics (lightweight version)
     */
    static getRiskSummary(projectId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.buildRiskQuery(projectId, filters || { scope: 'all' });
                // Use aggregation for better performance
                const summary = yield riskRegister_model_1.default.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalRisks: { $sum: 1 },
                            highRisks: {
                                $sum: { $cond: [{ $eq: ['$riskScore', 'high'] }, 1, 0] }
                            },
                            mediumRisks: {
                                $sum: { $cond: [{ $eq: ['$riskScore', 'medium'] }, 1, 0] }
                            },
                            lowRisks: {
                                $sum: { $cond: [{ $eq: ['$riskScore', 'low'] }, 1, 0] }
                            },
                            openRisks: {
                                $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
                            }
                        }
                    }
                ])
                    .option({ maxTimeMS: 3000 })
                    .exec();
                return summary[0] || {
                    totalRisks: 0,
                    highRisks: 0,
                    mediumRisks: 0,
                    lowRisks: 0,
                    openRisks: 0
                };
            }
            catch (error) {
                console.error('Error getting risk summary:', error);
                throw new Error(`Failed to get risk summary: ${error}`);
            }
        });
    }
}
exports.RiskRegisterReportService = RiskRegisterReportService;
exports.default = RiskRegisterReportService;
//# sourceMappingURL=riskRegisterReport.service.js.map