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
exports.pulseSurveyController = void 0;
const pulseSurvey_model_1 = __importDefault(require("../models/pulseSurvey.model"));
const pulseSurveyResponse_model_1 = __importDefault(require("../models/pulseSurveyResponse.model"));
const mongoose_1 = __importDefault(require("mongoose"));
exports.pulseSurveyController = {
    // ============ PULSE SURVEY TEMPLATE MANAGEMENT ============
    /**
     * Create or update a pulse survey template for a specific module
     * POST /api/pulse-surveys
     */
    createOrUpdatePulseSurvey(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                const { moduleType, title, description, questions, isActive, showToAllUsers } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
                // Validate required fields
                if (!moduleType || !title || !questions || !Array.isArray(questions)) {
                    yield session.abortTransaction();
                    return res.status(400).json({
                        message: 'Module type, title, and questions array are required'
                    });
                }
                // Check if pulse survey already exists for this module
                const existingSurvey = yield pulseSurvey_model_1.default.findOne({ moduleType }).session(session);
                let pulseSurvey;
                if (existingSurvey) {
                    // Update existing survey
                    existingSurvey.title = title;
                    existingSurvey.description = description;
                    existingSurvey.questions.splice(0, existingSurvey.questions.length);
                    questions.forEach((q) => existingSurvey.questions.push(q));
                    existingSurvey.isActive = isActive !== undefined ? isActive : existingSurvey.isActive;
                    existingSurvey.showToAllUsers = showToAllUsers !== undefined ? showToAllUsers : existingSurvey.showToAllUsers;
                    existingSurvey.lastUpdatedBy = userId;
                    pulseSurvey = yield existingSurvey.save({ session });
                }
                else {
                    // Create new survey
                    pulseSurvey = yield pulseSurvey_model_1.default.create([{
                            moduleType,
                            title,
                            description,
                            questions,
                            isActive: isActive !== undefined ? isActive : true,
                            showToAllUsers: showToAllUsers !== undefined ? showToAllUsers : true,
                            creator: userId,
                            lastUpdatedBy: userId
                        }], { session });
                    pulseSurvey = pulseSurvey[0];
                }
                yield session.commitTransaction();
                res.status(existingSurvey ? 200 : 201).json({
                    message: `Pulse survey ${existingSurvey ? 'updated' : 'created'} successfully`,
                    pulseSurvey
                });
            }
            catch (error) {
                yield session.abortTransaction();
                console.error('Error creating/updating pulse survey:', error);
                res.status(500).json({
                    message: 'Error creating/updating pulse survey',
                    error: error.message
                });
            }
            finally {
                session.endSession();
            }
        });
    },
    /**
     * Get pulse survey template for a specific module
     * GET /api/pulse-surveys/:moduleType
     */
    getPulseSurveyByModule(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { moduleType } = req.params;
                const pulseSurvey = yield pulseSurvey_model_1.default.findOne({
                    moduleType,
                    isActive: true,
                    archived: false
                });
                if (!pulseSurvey) {
                    return res.status(404).json({
                        message: 'No active pulse survey found for this module'
                    });
                }
                res.status(200).json({ pulseSurvey });
            }
            catch (error) {
                console.error('Error fetching pulse survey:', error);
                res.status(500).json({
                    message: 'Error fetching pulse survey',
                    error: error.message
                });
            }
        });
    },
    /**
     * Get all pulse survey templates
     * GET /api/pulse-surveys
     */
    getAllPulseSurveys(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { includeArchived } = req.query;
                const query = {};
                if (includeArchived !== 'true') {
                    query.archived = false;
                }
                const pulseSurveys = yield pulseSurvey_model_1.default.find(query)
                    .populate('creator', 'firstName lastName email')
                    .populate('lastUpdatedBy', 'firstName lastName email')
                    .sort({ moduleType: 1 });
                res.status(200).json({
                    pulseSurveys,
                    count: pulseSurveys.length
                });
            }
            catch (error) {
                console.error('Error fetching pulse surveys:', error);
                res.status(500).json({
                    message: 'Error fetching pulse surveys',
                    error: error.message
                });
            }
        });
    },
    /**
     * Archive a pulse survey template
     * DELETE /api/pulse-surveys/:id
     */
    archivePulseSurvey(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                const { id } = req.params;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
                const pulseSurvey = yield pulseSurvey_model_1.default.findById(id).session(session);
                if (!pulseSurvey) {
                    yield session.abortTransaction();
                    return res.status(404).json({ message: 'Pulse survey not found' });
                }
                pulseSurvey.archived = true;
                pulseSurvey.archivedAt = new Date();
                pulseSurvey.lastUpdatedBy = userId;
                yield pulseSurvey.save({ session });
                yield session.commitTransaction();
                res.status(200).json({
                    message: 'Pulse survey archived successfully',
                    pulseSurvey
                });
            }
            catch (error) {
                yield session.abortTransaction();
                console.error('Error archiving pulse survey:', error);
                res.status(500).json({
                    message: 'Error archiving pulse survey',
                    error: error.message
                });
            }
            finally {
                session.endSession();
            }
        });
    },
    // ============ PULSE SURVEY RESPONSES ============
    /**
     * Submit a pulse survey response
     * POST /api/pulse-surveys/responses
     */
    submitPulseSurveyResponse(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                const { pulseSurveyId, moduleType, moduleReference, moduleReferenceModel, organizationId, projectId, projectSiteId, responses, additionalComments, timeToComplete, metadata } = req.body;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
                // Validate required fields
                if (!pulseSurveyId || !moduleType || !moduleReference || !moduleReferenceModel ||
                    !organizationId || !projectId || !responses) {
                    yield session.abortTransaction();
                    return res.status(400).json({
                        message: 'Missing required fields for pulse survey response'
                    });
                }
                // Check if response already exists (prevent duplicates)
                const existingResponse = yield pulseSurveyResponse_model_1.default.findOne({
                    moduleReference,
                    respondent: userId
                }).session(session);
                if (existingResponse) {
                    yield session.abortTransaction();
                    return res.status(409).json({
                        message: 'You have already submitted feedback for this module',
                        existingResponse
                    });
                }
                // Verify pulse survey exists
                const pulseSurvey = yield pulseSurvey_model_1.default.findById(pulseSurveyId).session(session);
                if (!pulseSurvey) {
                    yield session.abortTransaction();
                    return res.status(404).json({ message: 'Pulse survey not found' });
                }
                // Create the response
                const pulseSurveyResponse = yield pulseSurveyResponse_model_1.default.create([{
                        pulseSurvey: pulseSurveyId,
                        moduleType,
                        moduleReference,
                        moduleReferenceModel,
                        organization: organizationId,
                        project: projectId,
                        projectSite: projectSiteId || undefined,
                        respondent: userId,
                        responses,
                        additionalComments,
                        timeToComplete,
                        metadata,
                        status: 'submitted',
                        completedAt: new Date()
                    }], { session });
                yield session.commitTransaction();
                res.status(201).json({
                    message: 'Pulse survey response submitted successfully',
                    response: pulseSurveyResponse[0]
                });
            }
            catch (error) {
                yield session.abortTransaction();
                console.error('Error submitting pulse survey response:', error);
                // Handle duplicate key error
                if (error.code === 11000) {
                    return res.status(409).json({
                        message: 'You have already submitted feedback for this module'
                    });
                }
                res.status(500).json({
                    message: 'Error submitting pulse survey response',
                    error: error.message
                });
            }
            finally {
                session.endSession();
            }
        });
    },
    /**
     * Get pulse survey responses with filters
     * GET /api/pulse-surveys/responses
     */
    getPulseSurveyResponses(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { organizationId, projectId, projectSiteId, moduleType, startDate, endDate, page = 1, limit = 50 } = req.query;
                // Build query
                const query = {};
                if (organizationId)
                    query.organization = organizationId;
                if (projectId)
                    query.project = projectId;
                if (projectSiteId)
                    query.projectSite = projectSiteId;
                if (moduleType)
                    query.moduleType = moduleType;
                if (startDate || endDate) {
                    query.completedAt = {};
                    if (startDate)
                        query.completedAt.$gte = new Date(startDate);
                    if (endDate)
                        query.completedAt.$lte = new Date(endDate);
                }
                // Calculate pagination
                const skip = (Number(page) - 1) * Number(limit);
                // Get responses
                const responses = yield pulseSurveyResponse_model_1.default.find(query)
                    .populate('pulseSurvey', 'title moduleType')
                    .populate('respondent', 'firstName lastName email')
                    .populate('organization', 'name')
                    .populate('project', 'name')
                    .populate('projectSite', 'name')
                    .sort({ completedAt: -1 })
                    .skip(skip)
                    .limit(Number(limit));
                const totalCount = yield pulseSurveyResponse_model_1.default.countDocuments(query);
                res.status(200).json({
                    responses,
                    pagination: {
                        currentPage: Number(page),
                        totalPages: Math.ceil(totalCount / Number(limit)),
                        totalCount,
                        limit: Number(limit)
                    }
                });
            }
            catch (error) {
                console.error('Error fetching pulse survey responses:', error);
                res.status(500).json({
                    message: 'Error fetching pulse survey responses',
                    error: error.message
                });
            }
        });
    },
    /**
     * Get analytics for pulse surveys
     * GET /api/pulse-surveys/analytics
     */
    getPulseSurveyAnalytics(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { organizationId, projectId, projectSiteId, moduleType, startDate, endDate } = req.query;
                // Build match query
                const matchQuery = {};
                if (organizationId)
                    matchQuery.organization = new mongoose_1.default.Types.ObjectId(organizationId);
                if (projectId)
                    matchQuery.project = new mongoose_1.default.Types.ObjectId(projectId);
                if (projectSiteId)
                    matchQuery.projectSite = new mongoose_1.default.Types.ObjectId(projectSiteId);
                if (moduleType)
                    matchQuery.moduleType = moduleType;
                if (startDate || endDate) {
                    matchQuery.completedAt = {};
                    if (startDate)
                        matchQuery.completedAt.$gte = new Date(startDate);
                    if (endDate)
                        matchQuery.completedAt.$lte = new Date(endDate);
                }
                // Get overall statistics
                const overallStats = yield pulseSurveyResponse_model_1.default.aggregate([
                    { $match: matchQuery },
                    {
                        $group: {
                            _id: null,
                            totalResponses: { $sum: 1 },
                            averageRating: { $avg: '$averageRating' },
                            averageTimeToComplete: { $avg: '$timeToComplete' }
                        }
                    }
                ]);
                // Get statistics by module type
                const statsByModule = yield pulseSurveyResponse_model_1.default.aggregate([
                    { $match: matchQuery },
                    {
                        $group: {
                            _id: '$moduleType',
                            totalResponses: { $sum: 1 },
                            averageRating: { $avg: '$averageRating' },
                            averageTimeToComplete: { $avg: '$timeToComplete' }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]);
                // Get rating distribution
                const ratingDistribution = yield pulseSurveyResponse_model_1.default.aggregate([
                    { $match: matchQuery },
                    {
                        $bucket: {
                            groupBy: '$averageRating',
                            boundaries: [0, 1, 2, 3, 4, 5, 6],
                            default: 'Other',
                            output: {
                                count: { $sum: 1 }
                            }
                        }
                    }
                ]);
                // Get responses over time (by month)
                const responsesTrend = yield pulseSurveyResponse_model_1.default.aggregate([
                    { $match: matchQuery },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$completedAt' },
                                month: { $month: '$completedAt' }
                            },
                            count: { $sum: 1 },
                            averageRating: { $avg: '$averageRating' }
                        }
                    },
                    { $sort: { '_id.year': 1, '_id.month': 1 } }
                ]);
                res.status(200).json({
                    overall: overallStats[0] || {
                        totalResponses: 0,
                        averageRating: 0,
                        averageTimeToComplete: 0
                    },
                    byModule: statsByModule,
                    ratingDistribution,
                    responsesTrend
                });
            }
            catch (error) {
                console.error('Error fetching pulse survey analytics:', error);
                res.status(500).json({
                    message: 'Error fetching pulse survey analytics',
                    error: error.message
                });
            }
        });
    },
    /**
     * Check if user needs to complete pulse survey for a module
     * GET /api/pulse-surveys/check-required/:moduleType/:moduleReference
     */
    checkPulseSurveyRequired(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { moduleType, moduleReference } = req.params;
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
                // Check if pulse survey exists and is active for this module
                const pulseSurvey = yield pulseSurvey_model_1.default.findOne({
                    moduleType,
                    isActive: true,
                    archived: false
                });
                if (!pulseSurvey) {
                    return res.status(200).json({
                        required: false,
                        message: 'No active pulse survey for this module'
                    });
                }
                // Check if user has already responded
                const existingResponse = yield pulseSurveyResponse_model_1.default.findOne({
                    moduleReference,
                    respondent: userId
                });
                if (existingResponse) {
                    return res.status(200).json({
                        required: false,
                        alreadyCompleted: true,
                        message: 'User has already completed this pulse survey',
                        completedAt: existingResponse.completedAt
                    });
                }
                res.status(200).json({
                    required: true,
                    pulseSurvey
                });
            }
            catch (error) {
                console.error('Error checking pulse survey requirement:', error);
                res.status(500).json({
                    message: 'Error checking pulse survey requirement',
                    error: error.message
                });
            }
        });
    }
};
//# sourceMappingURL=pulseSurvey.controller.js.map