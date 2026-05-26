// controllers/stakeholderAction.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import StakeholderAction from "../models/stakeholderAction.model";
import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import Theme from "../models/theme.model";
import SubTheme from "../models/subtheme.model";
import { 
    calculateStageProgress,
    validateMultipleStakeholderThemeRelationships
} from "../services/theoryOfChange.service";
import { CustomError } from "../middlewares/error.middleware";

// Type guard to check if user is authenticated
function isUserAuthenticated(req: Request): req is Request & { user: { _id: mongoose.Types.ObjectId } } {
  return req.user !== undefined;
}

/**
 * Create a new stakeholder action with multiple themes and subthemes
 * @route POST /api/v1/stakeholderActions
 * @access Private
 */
export const createAction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { 
      projectId, 
      projectSiteId, 
      stageId, 
      stakeholderGroupId, 
      themeIds,      // CHANGED: Now expects array of theme IDs
      subThemeIds,   // CHANGED: Now expects array of subtheme IDs
      action, 
      responsibility, 
      timeframe,
      repeatCycle,   // NEW: repeat cycle for this action
      status,        // NEW: initial status (defaults to 'not_started' if omitted)
      priority,      // NEW: action priority (defaults to 'medium' if omitted)
      notes 
    } = req.body;

    // Validate required fields
    if (!projectId || !stageId || !stakeholderGroupId || !themeIds || !subThemeIds || !action) {
      const error = new Error('Required fields missing') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // CHANGED: Validate that themeIds and subThemeIds are arrays
    if (!Array.isArray(themeIds) || !Array.isArray(subThemeIds)) {
      const error = new Error('themeIds and subThemeIds must be arrays') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // CHANGED: Validate that arrays are not empty
    if (themeIds.length === 0 || subThemeIds.length === 0) {
      const error = new Error('At least one theme and one subtheme must be selected') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // CHANGED: Validate multiple stakeholder-theme relationships
    const isValidRelationship = await validateMultipleStakeholderThemeRelationships(stakeholderGroupId, themeIds);
    if (!isValidRelationship) {
      const error = new Error('Invalid stakeholder-theme relationship for one or more selected themes') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if project site exists (if provided)
    if (projectSiteId) {
      const projectSite = await ProjectSite.findById(projectSiteId);
      if (!projectSite) {
        const error = new Error('Project site not found') as CustomError;
        error.statusCode = 404;
        throw error;
      }

      // Verify project site belongs to project
      if (projectSite.project.toString() !== projectId) {
        const error = new Error('Project site does not belong to this project') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Check if ToC stage exists and is Stage 1
    const stage = await TheoryOfChangeStage.findById(stageId);
    if (!stage) {
      const error = new Error('Theory of Change stage not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (stage.stageNumber !== 1) {
      const error = new Error('Stakeholder actions can only be added to Stage 1') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Verify stage belongs to correct project/site
    // Normalize both sides to null so undefined/null mismatches don't produce false positives
    const stageSite = stage.projectSite ? stage.projectSite.toString() : null;
    const reqSite   = projectSiteId     ? projectSiteId.toString()      : null;
    if (stage.project.toString() !== projectId || stageSite !== reqSite) {
      const error = new Error('Theory of Change stage does not match project/site') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // CHANGED: Validate all themes exist
    const themes = await Theme.find({ _id: { $in: themeIds } });
    if (themes.length !== themeIds.length) {
      const foundThemeIds = themes.map(t => t._id.toString());
      const missingThemeIds = themeIds.filter(id => !foundThemeIds.includes(id));
      const error = new Error(`Themes not found: ${missingThemeIds.join(', ')}`) as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Validate all selected themes are compatible with Stage 1
    const invalidStageThemes = themes.filter(t => 
      t.theoryOfChangeStage !== 'Stage 1 - Output' && t.theoryOfChangeStage !== 'Both'
    );
    if (invalidStageThemes.length > 0) {
      const error = new Error(
        `Themes [${invalidStageThemes.map(t => t.name).join(', ')}] are not scoped to Stage 1. ` +
        `Only "Stage 1 - Output" or "Both" themes can be used in stakeholder actions.`
      ) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    

    // CHANGED: Validate all subthemes exist and belong to selected themes
    const subThemes = await SubTheme.find({ _id: { $in: subThemeIds } }).populate('theme');
    if (subThemes.length !== subThemeIds.length) {
      const foundSubThemeIds = subThemes.map(st => st._id.toString());
      const missingSubThemeIds = subThemeIds.filter(id => !foundSubThemeIds.includes(id));
      const error = new Error(`SubThemes not found: ${missingSubThemeIds.join(', ')}`) as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Validate all selected subthemes are scoped to Stage 1
    const invalidStageSubThemes = subThemes.filter(st => 
      (st as any).theoryOfChangeStage !== 'Stage 1 - Output'
    );
    if (invalidStageSubThemes.length > 0) {
      const error = new Error(
        `SubThemes [${invalidStageSubThemes.map(st => st.name).join(', ')}] are not scoped to Stage 1.`
      ) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // CHANGED: Validate that all subthemes belong to selected themes
    const selectedThemeIdStrings = themeIds.map(id => id.toString());
    const invalidSubThemes = subThemes.filter(subTheme => 
      !selectedThemeIdStrings.includes(subTheme.theme._id.toString())
    );

    if (invalidSubThemes.length > 0) {
      const error = new Error(`SubThemes [${invalidSubThemes.map(st => st.name).join(', ')}] do not belong to selected themes`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // CHANGED: Check for existing action with same content (since we can't use theme/subtheme for uniqueness anymore)
    const existingAction = await StakeholderAction.findOne({
      project: projectId,
      projectSite: projectSiteId || null,
      stakeholderGroup: stakeholderGroupId,
      action: action.trim()
    });

    if (existingAction) {
      const error = new Error('An action with the same content already exists for this stakeholder group') as CustomError;
      error.statusCode = 409; // Conflict
      throw error;
    }

    // Create the stakeholder action with multiple themes and subthemes
    const newAction = await StakeholderAction.create({
      project: projectId,
      projectSite: projectSiteId || null,
      stage: stageId,
      stakeholderGroup: stakeholderGroupId,
      themes: themeIds,        // CHANGED: Now stores array of theme IDs
      subThemes: subThemeIds,  // CHANGED: Now stores array of subtheme IDs
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
      await stage.save({ session });
    }

    // After saving, update the stage progress
    await calculateStageProgress(stageId);
    
    await session.commitTransaction();
    session.endSession();

    // CHANGED: Populate multiple themes and subthemes
    const populatedAction = await StakeholderAction.findById(newAction._id)
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')           // CHANGED: Populate multiple themes
      .populate('subThemes', 'name')        // CHANGED: Populate multiple subthemes
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Stakeholder action created successfully',
      data: populatedAction
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Delete a stakeholder action
 * @route DELETE /api/v1/stakeholderActions/:actionId
 * @access Private
 */
export const deleteAction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { actionId } = req.params;

    const action = await StakeholderAction.findById(actionId);
    if (!action) {
      const error = new Error('Stakeholder action not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Soft delete by archiving
    action.archived = true;
    action.archivedAt = new Date();
    action.lastUpdatedBy = req.user._id;
    await action.save({ session });

    // Update stage progress after deletion
    await calculateStageProgress(action.stage.toString());

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Stakeholder action deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all actions for a specific stakeholder group within a stage
 * @route GET /api/v1/stakeholderActions/stage/:stageId/stakeholder/:stakeholderId
 * @access Private
 */
export const getActionsByStakeholder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stageId, stakeholderId } = req.params;

    // Check if stage exists
    const stage = await TheoryOfChangeStage.findById(stageId);
    if (!stage) {
      const error = new Error('Theory of Change stage not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if stakeholder group exists
    const stakeholderGroup = await StakeholderGroup.findById(stakeholderId);
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Get all actions for this stage and stakeholder
    const actions = await StakeholderAction.find({ 
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
      (action.themes as any[]).forEach(theme => {
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
          actionsWithTimeframes: actions.filter(a => a.timeframe?.startDate || a.timeframe?.endDate).length,
          actionsWithResponsibility: actions.filter(a => a.responsibility?.name).length
        }
      }
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get a single stakeholder action by ID
 * @route GET /api/v1/stakeholderActions/:actionId
 * @access Private
 */
export const getActionById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { actionId } = req.params;

    const action = await StakeholderAction.findById(actionId)
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')
      .populate('subThemes', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name');

    if (!action || action.archived) {
      const error = new Error('Stakeholder action not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: action
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid action ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get all actions for a project (across all stages and sites)
 * @route GET /api/v1/stakeholderActions/project/:projectId
 * @access Private
 */
export const getActionsByProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;
    const { projectSiteId } = req.query;

    // Build query
    const query: any = {
      project: projectId,
      archived: { $ne: true }
    };

    if (projectSiteId) {
      query.projectSite = projectSiteId;
    }

    const actions = await StakeholderAction.find(query)
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')
      .populate('subThemes', 'name')
      .populate('stage', 'stageNumber status')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name')
      .sort({ 'stage.stageNumber': 1, createdAt: 1 });

    // Group by stage
    const actionsByStage = actions.reduce((acc: any, action) => {
      const stageNumber = (action.stage as any).stageNumber;
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get all actions for a specific Theory of Change stage
 * @route GET /api/v1/stakeholderActions/stage/:stageId
 * @access Private
 */
export const getActionsByStage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stageId } = req.params;

    // Check if stage exists
    const stage = await TheoryOfChangeStage.findById(stageId);
    if (!stage) {
      const error = new Error('Theory of Change stage not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Verify it's stage 1
    if (stage.stageNumber !== 1) {
      const error = new Error('Stakeholder actions are only available in Stage 1') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // CHANGED: Get all actions with multiple themes and subthemes populated
    const actions = await StakeholderAction.find({ 
      stage: stageId,
      archived: { $ne: true }
    })
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')           // CHANGED: Populate multiple themes
      .populate('subThemes', 'name')        // CHANGED: Populate multiple subthemes
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name')
      .sort({ 'stakeholderGroup': 1, createdAt: 1 });

    // CHANGED: Group actions by stakeholder (themes are now multiple, so grouping logic is simpler)
    const stakeholderGroups = Array.from(
      new Set(actions.map(action => action.stakeholderGroup._id.toString()))
    );

    const actionsByStakeholder = stakeholderGroups.map(groupId => {
      const stakeholderActions = actions.filter(
        action => action.stakeholderGroup._id.toString() === groupId
      );

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
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid stage ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get available subthemes based on selected themes
 * @route POST /api/v1/stakeholderActions/available-subthemes
 * @access Private
 */
export const getAvailableSubThemes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { themeIds } = req.body;

    if (!themeIds || !Array.isArray(themeIds) || themeIds.length === 0) {
      const error = new Error('themeIds array is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Get all subthemes that belong to the selected themes
    const availableSubThemes = await SubTheme.find({ 
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
    const subThemesByTheme = availableSubThemes.reduce((acc: any, subTheme) => {
      const themeId = (subTheme.theme as any)._id.toString();
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
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing stakeholder action
 * @route PUT /api/v1/stakeholderActions/:actionId
 * @access Private
 */
export const updateAction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { actionId } = req.params;
    const { 
      themeIds, 
      subThemeIds, 
      action, 
      responsibility, 
      timeframe,
      repeatCycle,   // NEW
      status,        // NEW
      priority,      // NEW
      progress,      // NEW
      notes 
    } = req.body;

    const existingAction = await StakeholderAction.findById(actionId);
    if (!existingAction) {
      const error = new Error('Stakeholder action not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // If themes/subthemes are being updated, validate them
    if (themeIds && subThemeIds) {
      if (!Array.isArray(themeIds) || !Array.isArray(subThemeIds)) {
        const error = new Error('themeIds and subThemeIds must be arrays') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // Validate relationships
      const isValidRelationship = await validateMultipleStakeholderThemeRelationships(
        existingAction.stakeholderGroup.toString(), 
        themeIds
      );
      if (!isValidRelationship) {
        const error = new Error('Invalid stakeholder-theme relationship for one or more selected themes') as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // Validate subthemes belong to themes
      const subThemes = await SubTheme.find({ _id: { $in: subThemeIds } }).populate('theme');
      const selectedThemeIdStrings = themeIds.map(id => id.toString());
      const invalidSubThemes = subThemes.filter(subTheme => 
        !selectedThemeIdStrings.includes(subTheme.theme._id.toString())
      );

      if (invalidSubThemes.length > 0) {
        const error = new Error(`SubThemes [${invalidSubThemes.map(st => st.name).join(', ')}] do not belong to selected themes`) as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // Validate theme stage compatibility
      const updatedThemes = await Theme.find({ _id: { $in: themeIds } });
      const invalidStageThemes = updatedThemes.filter(t => 
        t.theoryOfChangeStage !== 'Stage 1 - Output' && t.theoryOfChangeStage !== 'Both'
      );
      if (invalidStageThemes.length > 0) {
        const error = new Error(
          `Themes [${invalidStageThemes.map(t => t.name).join(', ')}] are not scoped to Stage 1.`
        ) as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // Validate subtheme stage compatibility
      const invalidStageSubThemes = subThemes.filter(st => 
        (st as any).theoryOfChangeStage !== 'Stage 1 - Output'
      );
      if (invalidStageSubThemes.length > 0) {
        const error = new Error(
          `SubThemes [${invalidStageSubThemes.map(st => st.name).join(', ')}] are not scoped to Stage 1.`
        ) as CustomError;
        error.statusCode = 400;
        throw error;
      }

      existingAction.themes = themeIds;
      existingAction.subThemes = subThemeIds;
    }

    // Update other fields
    if (action !== undefined) existingAction.action = action;
    if (responsibility !== undefined) existingAction.responsibility = responsibility;
    if (timeframe !== undefined) existingAction.timeframe = timeframe;
    if (repeatCycle !== undefined) existingAction.repeatCycle = repeatCycle;
    if (status !== undefined) existingAction.status = status;
    if (priority !== undefined) existingAction.priority = priority;
    if (progress !== undefined) existingAction.progress = progress;
    if (notes !== undefined) existingAction.notes = notes;
    
    existingAction.lastUpdatedBy = req.user._id;

    await existingAction.save({ session });
    await session.commitTransaction();
    session.endSession();

    const populatedAction = await StakeholderAction.findById(actionId)
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
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};