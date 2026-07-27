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
exports.updateAction = exports.getAvailableSubThemes = exports.getActionsByStage = exports.getActionsByProject = exports.getActionById = exports.getActionsByStakeholder = exports.deleteAction = exports.createAction = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const stakeholderAction_model_1 = __importDefault(require("../models/stakeholderAction.model"));
const theoryOfChangeStage_model_1 = __importDefault(require("../models/theoryOfChangeStage.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const theme_model_1 = __importDefault(require("../models/theme.model"));
const subtheme_model_1 = __importDefault(require("../models/subtheme.model"));
const theoryOfChange_service_1 = require("../services/theoryOfChange.service");
// Type guard to check if user is authenticated
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Create a new stakeholder action with multiple themes and subthemes
 * @route POST /api/v1/stakeholderActions
 * @access Private
 */
const createAction = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId, projectSiteId, stageId, stakeholderGroupId, themeIds, // CHANGED: Now expects array of theme IDs
        subThemeIds, // CHANGED: Now expects array of subtheme IDs
        action, responsibility, timeframe, repeatCycle, // NEW: repeat cycle for this action
        status, // NEW: initial status (defaults to 'not_started' if omitted)
        priority, // NEW: action priority (defaults to 'medium' if omitted)
        notes } = req.body;
        // Validate required fields
        if (!projectId || !stageId || !stakeholderGroupId || !themeIds || !subThemeIds || !action) {
            const error = new Error('Required fields missing');
            error.statusCode = 400;
            throw error;
        }
        // CHANGED: Validate that themeIds and subThemeIds are arrays
        if (!Array.isArray(themeIds) || !Array.isArray(subThemeIds)) {
            const error = new Error('themeIds and subThemeIds must be arrays');
            error.statusCode = 400;
            throw error;
        }
        // CHANGED: Validate that arrays are not empty
        if (themeIds.length === 0 || subThemeIds.length === 0) {
            const error = new Error('At least one theme and one subtheme must be selected');
            error.statusCode = 400;
            throw error;
        }
        // CHANGED: Validate multiple stakeholder-theme relationships
        const isValidRelationship = yield (0, theoryOfChange_service_1.validateMultipleStakeholderThemeRelationships)(stakeholderGroupId, themeIds);
        if (!isValidRelationship) {
            const error = new Error('Invalid stakeholder-theme relationship for one or more selected themes');
            error.statusCode = 400;
            throw error;
        }
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if project site exists (if provided)
        if (projectSiteId) {
            const projectSite = yield projectSite_model_1.default.findById(projectSiteId);
            if (!projectSite) {
                const error = new Error('Project site not found');
                error.statusCode = 404;
                throw error;
            }
            // Verify project site belongs to project
            if (projectSite.project.toString() !== projectId) {
                const error = new Error('Project site does not belong to this project');
                error.statusCode = 400;
                throw error;
            }
        }
        // Check if ToC stage exists and is Stage 1
        const stage = yield theoryOfChangeStage_model_1.default.findById(stageId);
        if (!stage) {
            const error = new Error('Theory of Change stage not found');
            error.statusCode = 404;
            throw error;
        }
        if (stage.stageNumber !== 1) {
            const error = new Error('Stakeholder actions can only be added to Stage 1');
            error.statusCode = 400;
            throw error;
        }
        // Verify stage belongs to correct project/site
        // Normalize both sides to null so undefined/null mismatches don't produce false positives
        const stageSite = stage.projectSite ? stage.projectSite.toString() : null;
        const reqSite = projectSiteId ? projectSiteId.toString() : null;
        if (stage.project.toString() !== projectId || stageSite !== reqSite) {
            const error = new Error('Theory of Change stage does not match project/site');
            error.statusCode = 400;
            throw error;
        }
        // CHANGED: Validate all themes exist
        const themes = yield theme_model_1.default.find({ _id: { $in: themeIds } });
        if (themes.length !== themeIds.length) {
            const foundThemeIds = themes.map(t => t._id.toString());
            const missingThemeIds = themeIds.filter(id => !foundThemeIds.includes(id));
            const error = new Error(`Themes not found: ${missingThemeIds.join(', ')}`);
            error.statusCode = 404;
            throw error;
        }
        // Validate all selected themes are compatible with Stage 1
        const invalidStageThemes = themes.filter(t => t.theoryOfChangeStage !== 'Stage 1 - Output' && t.theoryOfChangeStage !== 'Both');
        if (invalidStageThemes.length > 0) {
            const error = new Error(`Themes [${invalidStageThemes.map(t => t.name).join(', ')}] are not scoped to Stage 1. ` +
                `Only "Stage 1 - Output" or "Both" themes can be used in stakeholder actions.`);
            error.statusCode = 400;
            throw error;
        }
        // CHANGED: Validate all subthemes exist and belong to selected themes
        const subThemes = yield subtheme_model_1.default.find({ _id: { $in: subThemeIds } }).populate('theme');
        if (subThemes.length !== subThemeIds.length) {
            const foundSubThemeIds = subThemes.map(st => st._id.toString());
            const missingSubThemeIds = subThemeIds.filter(id => !foundSubThemeIds.includes(id));
            const error = new Error(`SubThemes not found: ${missingSubThemeIds.join(', ')}`);
            error.statusCode = 404;
            throw error;
        }
        // Validate all selected subthemes are scoped to Stage 1
        const invalidStageSubThemes = subThemes.filter(st => st.theoryOfChangeStage !== 'Stage 1 - Output');
        if (invalidStageSubThemes.length > 0) {
            const error = new Error(`SubThemes [${invalidStageSubThemes.map(st => st.name).join(', ')}] are not scoped to Stage 1.`);
            error.statusCode = 400;
            throw error;
        }
        // CHANGED: Validate that all subthemes belong to selected themes
        const selectedThemeIdStrings = themeIds.map(id => id.toString());
        const invalidSubThemes = subThemes.filter(subTheme => !selectedThemeIdStrings.includes(subTheme.theme._id.toString()));
        if (invalidSubThemes.length > 0) {
            const error = new Error(`SubThemes [${invalidSubThemes.map(st => st.name).join(', ')}] do not belong to selected themes`);
            error.statusCode = 400;
            throw error;
        }
        // CHANGED: Check for existing action with same content (since we can't use theme/subtheme for uniqueness anymore)
        const existingAction = yield stakeholderAction_model_1.default.findOne({
            project: projectId,
            projectSite: projectSiteId || null,
            stakeholderGroup: stakeholderGroupId,
            action: action.trim()
        });
        if (existingAction) {
            const error = new Error('An action with the same content already exists for this stakeholder group');
            error.statusCode = 409; // Conflict
            throw error;
        }
        // Create the stakeholder action with multiple themes and subthemes
        const newAction = yield stakeholderAction_model_1.default.create({
            project: projectId,
            projectSite: projectSiteId || null,
            stage: stageId,
            stakeholderGroup: stakeholderGroupId,
            themes: themeIds, // CHANGED: Now stores array of theme IDs
            subThemes: subThemeIds, // CHANGED: Now stores array of subtheme IDs
            action,
            responsibility,
            timeframe,
            repeatCycle: repeatCycle || 'no_repeat',
            status: status || 'not_started',
            priority: priority || 'medium',
            notes,
            creator: req.user._id,
            lastUpdatedBy: req.user._id
        });
        // Update the stage status to in_progress if it's not already completed
        if (stage.status !== 'completed') {
            stage.status = 'in_progress';
            if (stage.progress === 0) {
                stage.progress = 1;
            }
            stage.lastUpdatedBy = req.user._id;
            yield stage.save({ session });
        }
        // After saving, update the stage progress
        yield (0, theoryOfChange_service_1.calculateStageProgress)(stageId);
        yield session.commitTransaction();
        session.endSession();
        // CHANGED: Populate multiple themes and subthemes
        const populatedAction = yield stakeholderAction_model_1.default.findById(newAction._id)
            .populate('stakeholderGroup', 'name')
            .populate('themes', 'name') // CHANGED: Populate multiple themes
            .populate('subThemes', 'name') // CHANGED: Populate multiple subthemes
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name');
        res.status(201).json({
            success: true,
            message: 'Stakeholder action created successfully',
            data: populatedAction
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createAction = createAction;
/**
 * Delete a stakeholder action
 * @route DELETE /api/v1/stakeholderActions/:actionId
 * @access Private
 */
const deleteAction = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { actionId } = req.params;
        const action = yield stakeholderAction_model_1.default.findById(actionId);
        if (!action) {
            const error = new Error('Stakeholder action not found');
            error.statusCode = 404;
            throw error;
        }
        // Soft delete by archiving
        action.archived = true;
        action.archivedAt = new Date();
        action.lastUpdatedBy = req.user._id;
        yield action.save({ session });
        // Update stage progress after deletion
        yield (0, theoryOfChange_service_1.calculateStageProgress)(action.stage.toString());
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: 'Stakeholder action deleted successfully'
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.deleteAction = deleteAction;
/**
 * Get all actions for a specific stakeholder group within a stage
 * @route GET /api/v1/stakeholderActions/stage/:stageId/stakeholder/:stakeholderId
 * @access Private
 */
const getActionsByStakeholder = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stageId, stakeholderId } = req.params;
        // Check if stage exists
        const stage = yield theoryOfChangeStage_model_1.default.findById(stageId);
        if (!stage) {
            const error = new Error('Theory of Change stage not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if stakeholder group exists
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderId);
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Get all actions for this stage and stakeholder
        const actions = yield stakeholderAction_model_1.default.find({
            stage: stageId,
            stakeholderGroup: stakeholderId,
            archived: { $ne: true }
        })
            .populate('themes', 'name')
            .populate('subThemes', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name')
            .sort({ createdAt: 1 });
        // Group by theme
        const themeGroups = new Map();
        actions.forEach(action => {
            action.themes.forEach(theme => {
                const themeId = theme._id.toString();
                if (!themeGroups.has(themeId)) {
                    themeGroups.set(themeId, {
                        theme: theme,
                        actions: []
                    });
                }
                themeGroups.get(themeId).actions.push(action);
            });
        });
        const actionsByTheme = Array.from(themeGroups.values());
        res.status(200).json({
            success: true,
            count: actions.length,
            data: {
                actions,
                actionsByTheme,
                summary: {
                    actionCount: actions.length,
                    actionsWithTimeframes: actions.filter(a => { var _a, _b; return ((_a = a.timeframe) === null || _a === void 0 ? void 0 : _a.startDate) || ((_b = a.timeframe) === null || _b === void 0 ? void 0 : _b.endDate); }).length,
                    actionsWithResponsibility: actions.filter(a => { var _a; return (_a = a.responsibility) === null || _a === void 0 ? void 0 : _a.name; }).length
                }
            }
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getActionsByStakeholder = getActionsByStakeholder;
/**
 * Get a single stakeholder action by ID
 * @route GET /api/v1/stakeholderActions/:actionId
 * @access Private
 */
const getActionById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { actionId } = req.params;
        const action = yield stakeholderAction_model_1.default.findById(actionId)
            .populate('stakeholderGroup', 'name')
            .populate('themes', 'name')
            .populate('subThemes', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name');
        if (!action || action.archived) {
            const error = new Error('Stakeholder action not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: action
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid action ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getActionById = getActionById;
/**
 * Get all actions for a project (across all stages and sites)
 * @route GET /api/v1/stakeholderActions/project/:projectId
 * @access Private
 */
const getActionsByProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.params;
        const { projectSiteId } = req.query;
        // Build query
        const query = {
            project: projectId,
            archived: { $ne: true }
        };
        if (projectSiteId) {
            query.projectSite = projectSiteId;
        }
        const actions = yield stakeholderAction_model_1.default.find(query)
            .populate('stakeholderGroup', 'name')
            .populate('themes', 'name')
            .populate('subThemes', 'name')
            .populate('stage', 'stageNumber status')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name')
            .sort({ 'stage.stageNumber': 1, createdAt: 1 });
        // Group by stage
        const actionsByStage = actions.reduce((acc, action) => {
            const stageNumber = action.stage.stageNumber;
            if (!acc[stageNumber]) {
                acc[stageNumber] = {
                    stage: action.stage,
                    actions: []
                };
            }
            acc[stageNumber].actions.push(action);
            return acc;
        }, {});
        res.status(200).json({
            success: true,
            count: actions.length,
            data: {
                actions,
                actionsByStage: Object.values(actionsByStage)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getActionsByProject = getActionsByProject;
/**
 * Get all actions for a specific Theory of Change stage
 * @route GET /api/v1/stakeholderActions/stage/:stageId
 * @access Private
 */
const getActionsByStage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { stageId } = req.params;
        // Check if stage exists
        const stage = yield theoryOfChangeStage_model_1.default.findById(stageId);
        if (!stage) {
            const error = new Error('Theory of Change stage not found');
            error.statusCode = 404;
            throw error;
        }
        // Verify it's stage 1
        if (stage.stageNumber !== 1) {
            const error = new Error('Stakeholder actions are only available in Stage 1');
            error.statusCode = 400;
            throw error;
        }
        // CHANGED: Get all actions with multiple themes and subthemes populated
        const actions = yield stakeholderAction_model_1.default.find({
            stage: stageId,
            archived: { $ne: true }
        })
            .populate('stakeholderGroup', 'name')
            .populate('themes', 'name') // CHANGED: Populate multiple themes
            .populate('subThemes', 'name') // CHANGED: Populate multiple subthemes
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name')
            .sort({ 'stakeholderGroup': 1, createdAt: 1 });
        // CHANGED: Group actions by stakeholder (themes are now multiple, so grouping logic is simpler)
        const stakeholderGroups = Array.from(new Set(actions.map(action => action.stakeholderGroup._id.toString())));
        const actionsByStakeholder = stakeholderGroups.map(groupId => {
            const stakeholderActions = actions.filter(action => action.stakeholderGroup._id.toString() === groupId);
            return {
                stakeholderGroup: stakeholderActions[0].stakeholderGroup,
                actions: stakeholderActions
            };
        });
        res.status(200).json({
            success: true,
            count: actions.length,
            data: {
                actions,
                actionsByStakeholder
            }
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid stage ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getActionsByStage = getActionsByStage;
/**
 * Get available subthemes based on selected themes
 * @route POST /api/v1/stakeholderActions/available-subthemes
 * @access Private
 */
const getAvailableSubThemes = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { themeIds } = req.body;
        if (!themeIds || !Array.isArray(themeIds) || themeIds.length === 0) {
            const error = new Error('themeIds array is required');
            error.statusCode = 400;
            throw error;
        }
        // Get all subthemes that belong to the selected themes
        const availableSubThemes = yield subtheme_model_1.default.find({
            theme: { $in: themeIds },
            theoryOfChangeStage: { $in: ['Stage 1 - Output', 'Both'] },
            archived: { $ne: true }
        })
            .populate('theme', 'name')
            .populate('indicatorTags', 'name')
            .populate('sdgTags', 'code name')
            .populate('resilienceTags', 'code name')
            .populate('esgTags', 'code name type')
            .populate('standardTags', 'code name issuingBody')
            .sort({ theme: 1, name: 1 });
        // Group subthemes by their parent theme
        const subThemesByTheme = availableSubThemes.reduce((acc, subTheme) => {
            const themeId = subTheme.theme._id.toString();
            if (!acc[themeId]) {
                acc[themeId] = {
                    theme: subTheme.theme,
                    subThemes: []
                };
            }
            acc[themeId].subThemes.push({
                _id: subTheme._id,
                name: subTheme.name,
                description: subTheme.description,
                indicatorTags: subTheme.indicatorTags,
                sdgTags: subTheme.sdgTags,
                resilienceTags: subTheme.resilienceTags,
                esgTags: subTheme.esgTags,
                standardTags: subTheme.standardTags
            });
            return acc;
        }, {});
        res.status(200).json({
            success: true,
            data: {
                availableSubThemes,
                subThemesByTheme: Object.values(subThemesByTheme)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAvailableSubThemes = getAvailableSubThemes;
/**
 * Update an existing stakeholder action
 * @route PUT /api/v1/stakeholderActions/:actionId
 * @access Private
 */
const updateAction = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { actionId } = req.params;
        const { themeIds, subThemeIds, action, responsibility, timeframe, repeatCycle, // NEW
        status, // NEW
        priority, // NEW
        progress, // NEW
        notes } = req.body;
        const existingAction = yield stakeholderAction_model_1.default.findById(actionId);
        if (!existingAction) {
            const error = new Error('Stakeholder action not found');
            error.statusCode = 404;
            throw error;
        }
        // If themes/subthemes are being updated, validate them
        if (themeIds && subThemeIds) {
            if (!Array.isArray(themeIds) || !Array.isArray(subThemeIds)) {
                const error = new Error('themeIds and subThemeIds must be arrays');
                error.statusCode = 400;
                throw error;
            }
            // Validate relationships
            const isValidRelationship = yield (0, theoryOfChange_service_1.validateMultipleStakeholderThemeRelationships)(existingAction.stakeholderGroup.toString(), themeIds);
            if (!isValidRelationship) {
                const error = new Error('Invalid stakeholder-theme relationship for one or more selected themes');
                error.statusCode = 400;
                throw error;
            }
            // Validate subthemes belong to themes
            const subThemes = yield subtheme_model_1.default.find({ _id: { $in: subThemeIds } }).populate('theme');
            const selectedThemeIdStrings = themeIds.map(id => id.toString());
            const invalidSubThemes = subThemes.filter(subTheme => !selectedThemeIdStrings.includes(subTheme.theme._id.toString()));
            if (invalidSubThemes.length > 0) {
                const error = new Error(`SubThemes [${invalidSubThemes.map(st => st.name).join(', ')}] do not belong to selected themes`);
                error.statusCode = 400;
                throw error;
            }
            // Validate theme stage compatibility
            const updatedThemes = yield theme_model_1.default.find({ _id: { $in: themeIds } });
            const invalidStageThemes = updatedThemes.filter(t => t.theoryOfChangeStage !== 'Stage 1 - Output' && t.theoryOfChangeStage !== 'Both');
            if (invalidStageThemes.length > 0) {
                const error = new Error(`Themes [${invalidStageThemes.map(t => t.name).join(', ')}] are not scoped to Stage 1.`);
                error.statusCode = 400;
                throw error;
            }
            // Validate subtheme stage compatibility
            const invalidStageSubThemes = subThemes.filter(st => st.theoryOfChangeStage !== 'Stage 1 - Output');
            if (invalidStageSubThemes.length > 0) {
                const error = new Error(`SubThemes [${invalidStageSubThemes.map(st => st.name).join(', ')}] are not scoped to Stage 1.`);
                error.statusCode = 400;
                throw error;
            }
            existingAction.themes = themeIds;
            existingAction.subThemes = subThemeIds;
        }
        // Update other fields
        if (action !== undefined)
            existingAction.action = action;
        if (responsibility !== undefined)
            existingAction.responsibility = responsibility;
        if (timeframe !== undefined)
            existingAction.timeframe = timeframe;
        if (repeatCycle !== undefined)
            existingAction.repeatCycle = repeatCycle;
        if (status !== undefined)
            existingAction.status = status;
        if (priority !== undefined)
            existingAction.priority = priority;
        if (progress !== undefined)
            existingAction.progress = progress;
        if (notes !== undefined)
            existingAction.notes = notes;
        existingAction.lastUpdatedBy = req.user._id;
        yield existingAction.save({ session });
        yield session.commitTransaction();
        session.endSession();
        const populatedAction = yield stakeholderAction_model_1.default.findById(actionId)
            .populate('stakeholderGroup', 'name')
            .populate('themes', 'name')
            .populate('subThemes', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name');
        res.status(200).json({
            success: true,
            message: 'Stakeholder action updated successfully',
            data: populatedAction
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.updateAction = updateAction;
//# sourceMappingURL=stakeholderAction.controller.js.map