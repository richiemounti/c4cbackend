// controllers/socialImpact.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import SocialImpact from "../models/socialImpact.model";
import RiskRegister from "../models/riskRegister.model";
import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
import Project from "../models/project.model";
import ProjectSite from "../models/projectSite.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import Theme from "../models/theme.model";
import SubTheme from "../models/subtheme.model";

import { 
  validateMultipleStakeholderThemeRelationships,
  getSDGsForMultipleSubThemes,
  getResilienceTagsForMultipleSubThemes,
  calculateStageProgress
} from "../services/theoryOfChange.service";
import { CustomError } from "../middlewares/error.middleware";

// Type guard to check if user is authenticated
function isUserAuthenticated(req: Request): req is Request & { user: { _id: mongoose.Types.ObjectId } } {
  return req.user !== undefined;
}

/**
 * Define a new social impact outcome with multiple themes and subthemes
 * @route POST /api/v1/socialImpacts
 * @access Private
 */
export const defineOutcome = async (
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
      outcome, 
      notes
    } = req.body;

    // Validate required fields
    if (!projectId || !stageId || !stakeholderGroupId || !themeIds || !subThemeIds || !outcome) {
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

    // Check if ToC stage exists and is Stage 2
    const stage = await TheoryOfChangeStage.findById(stageId);
    if (!stage) {
      const error = new Error('Theory of Change stage not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (stage.stageNumber !== 2) {
      const error = new Error('Social impacts can only be added to Stage 2') as CustomError;
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

    // Check if stakeholder group exists
    const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId);
    if (!stakeholderGroup) {
      const error = new Error('Stakeholder group not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // CHANGED: Validate multiple stakeholder-theme relationships
    const isValidRelationship = await validateMultipleStakeholderThemeRelationships(stakeholderGroupId, themeIds);
    if (!isValidRelationship) {
      const error = new Error('Invalid stakeholder-theme relationship for one or more selected themes') as CustomError;
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

    // Validate all selected themes are compatible with Stage 2
    const invalidStageThemes = themes.filter(t => 
      t.theoryOfChangeStage !== 'Stage 2 - Outcome' && t.theoryOfChangeStage !== 'Both'
    );
    if (invalidStageThemes.length > 0) {
      const error = new Error(
        `Themes [${invalidStageThemes.map(t => t.name).join(', ')}] are not scoped to Stage 2. ` +
        `Only "Stage 2 - Outcome" or "Both" themes can be used in social impacts.`
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

    // Validate all selected subthemes are scoped to Stage 2
    const invalidStageSubThemes = subThemes.filter(st => 
      (st as any).theoryOfChangeStage !== 'Stage 2 - Outcome'
    );
    if (invalidStageSubThemes.length > 0) {
      const error = new Error(
        `SubThemes [${invalidStageSubThemes.map(st => st.name).join(', ')}] are not scoped to Stage 2.`
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

    // CHANGED: Check for existing impact with same outcome content
    const existingImpact = await SocialImpact.findOne({
      project: projectId,
      projectSite: projectSiteId || null,
      stakeholderGroup: stakeholderGroupId,
      outcome: outcome.trim()
    });

    if (existingImpact) {
      const error = new Error('A social impact with the same outcome already exists for this stakeholder group') as CustomError;
      error.statusCode = 409;
      throw error;
    }

    // CHANGED: Create the social impact with multiple themes and subthemes
    // ✅ FIXED: Use create with array syntax
    const newImpact = await SocialImpact.create([{
      project: projectId,
      projectSite: projectSiteId || null,
      stage: stageId,
      stakeholderGroup: stakeholderGroupId,
      themes: themeIds,
      subThemes: subThemeIds,
      outcome,
      notes,
      creator: req.user._id,
      lastUpdatedBy: req.user._id
    }], { session });

    // Update stage status
    if (stage.status !== 'completed') {
      stage.status = 'in_progress';
      if (stage.progress === 0) {
        stage.progress = 1;
      }
      stage.lastUpdatedBy = req.user._id;
      await stage.save({ session });
    }

    // ✅ FIXED: Commit and end session BEFORE calling helpers
    await session.commitTransaction();
    session.endSession();

    // ✅ FIXED: Call calculateStageProgress AFTER transaction
    try {
      await calculateStageProgress(stageId);
    } catch (progressError) {
      console.error('Error calculating stage progress:', progressError);
    }

    // ✅ FIXED: Populate AFTER session is ended
    const populatedImpact = await SocialImpact.findById(newImpact[0]._id)
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')
      .populate('subThemes', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Social impact outcome created successfully',
      data: populatedImpact
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Delete a social impact
 * @route DELETE /api/v1/socialImpacts/:impactId
 * @access Private
 */
export const deleteImpact = async (
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

    const { impactId } = req.params;

    // ✅ FIXED: Add .session(session) to query
    const impact = await SocialImpact.findById(impactId).session(session);
    if (!impact) {
      const error = new Error('Social impact not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Store stageId before committing
    const stageId = impact.stage.toString();

    // Soft delete
    impact.archived = true;
    impact.archivedAt = new Date();
    impact.lastUpdatedBy = req.user._id;
    await impact.save({ session });

    // ✅ FIXED: Commit and end session BEFORE calling helpers
    await session.commitTransaction();
    session.endSession();

    // ✅ FIXED: Update stage progress AFTER transaction
    try {
      await calculateStageProgress(stageId);
    } catch (progressError) {
      console.error('Error calculating stage progress:', progressError);
    }
    res.status(200).json({
      success: true,
      message: 'Social impact deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all social impacts for a specific stakeholder group within a stage
 * @route GET /api/v1/socialImpacts/stage/:stageId/stakeholder/:stakeholderId
 * @access Private
 */
export const getImpactsByStakeholder = async (
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

    // Get all impacts for this stage and stakeholder
    const impacts = await SocialImpact.find({ 
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
    impacts.forEach(impact => {
      (impact.themes as any[]).forEach(theme => {
        const themeId = theme._id.toString();
        if (!themeGroups.has(themeId)) {
          themeGroups.set(themeId, {
            theme: theme,
            impacts: []
          });
        }
        themeGroups.get(themeId).impacts.push(impact);
      });
    });

    const impactsByTheme = Array.from(themeGroups.values());

    // Calculate summary statistics
    const totalRisksCount = impacts.reduce((total, impact) => total + impact.risks.length, 0);
    
    // Get unique tags
    const allSdgTags = new Set<string>();
    const allResilienceTags = new Set<string>();
    
    impacts.forEach(impact => {
      impact.sdgTags.forEach(tag => allSdgTags.add(tag));
      impact.resilienceTags.forEach(tag => allResilienceTags.add(tag));
    });

    res.status(200).json({
      success: true,
      count: impacts.length,
      data: {
        impacts,
        impactsByTheme,
        summary: {
          impactCount: impacts.length,
          totalRisksCount,
          uniqueSdgTags: Array.from(allSdgTags),
          uniqueResilienceTags: Array.from(allResilienceTags)
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
 * Get a single social impact by ID
 * @route GET /api/v1/socialImpacts/:impactId
 * @access Private
 */
export const getImpactById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { impactId } = req.params;

    const impact = await SocialImpact.findById(impactId)
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')
      .populate('subThemes', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name');

    if (!impact || impact.archived) {
      const error = new Error('Social impact not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: impact
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid impact ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get all RiskRegister entries linked to a social impact outcome
 * @route GET /api/v1/toc/impacts/:impactId/risks
 * @access Private
 */
export const getImpactRisks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { impactId } = req.params;

    const impact = await SocialImpact.findById(impactId);
    if (!impact || impact.archived) {
      const error = new Error('Social impact not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const risks = await RiskRegister.find({
      riskSource: 'toc_stage2',
      sourceReference: impactId,
      archived: { $ne: true }
    })
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: risks.length,
      data: risks
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid impact ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get all social impacts for a specific Theory of Change stage
 * @route GET /api/v1/socialImpacts/stage/:stageId
 * @access Private
 */
export const getImpactsByStage = async (
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

    // Verify it's stage 2
    if (stage.stageNumber !== 2) {
      const error = new Error('Social impacts are only available in Stage 2') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // CHANGED: Get all impacts with multiple themes and subthemes populated
    const impacts = await SocialImpact.find({ 
      stage: stageId,
      archived: { $ne: true }
    })
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')           // CHANGED: Populate multiple themes
      .populate('subThemes', 'name')        // CHANGED: Populate multiple subthemes
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name')
      .sort({ 'stakeholderGroup': 1, createdAt: 1 });

    // Group impacts by stakeholder
    const stakeholderGroups = Array.from(
      new Set(impacts.map(impact => impact.stakeholderGroup._id.toString()))
    );

    const impactsByStakeholder = stakeholderGroups.map(groupId => {
      const stakeholderImpacts = impacts.filter(
        impact => impact.stakeholderGroup._id.toString() === groupId
      );

      return {
        stakeholderGroup: stakeholderImpacts[0].stakeholderGroup,
        impacts: stakeholderImpacts
      };
    });

    // Calculate summary statistics
    const impactCount = impacts.length;
    const withRisksCount = impacts.filter(impact => impact.risks.length > 0).length;
    const totalRisksCount = impacts.reduce((total, impact) => total + impact.risks.length, 0);

    // CHANGED: Aggregate unique themes and subthemes across all impacts
    const allThemes = new Set<string>();
    const allSubThemes = new Set<string>();
    const allSdgTags = new Set<string>();
    const allResilienceTags = new Set<string>();

    impacts.forEach(impact => {
      impact.themes.forEach((theme: any) => allThemes.add(theme.name));
      impact.subThemes.forEach((subTheme: any) => allSubThemes.add(subTheme.name));
      impact.sdgTags.forEach(tag => allSdgTags.add(tag));
      impact.resilienceTags.forEach(tag => allResilienceTags.add(tag));
    });

    res.status(200).json({
      success: true,
      count: impacts.length,
      data: {
        impacts,
        impactsByStakeholder,
        summary: {
          impactCount,
          withRisksCount,
          totalRisksCount,
          uniqueThemes: Array.from(allThemes),
          uniqueSubThemes: Array.from(allSubThemes),
          uniqueSdgTags: Array.from(allSdgTags),
          uniqueResilienceTags: Array.from(allResilienceTags)
        }
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
 * Get available subthemes based on selected themes for social impacts
 * @route POST /api/v1/socialImpacts/available-subthemes
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
      theoryOfChangeStage: { $in: ['Stage 2 - Outcome', 'Both'] },
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
        // ADD THESE LINES:
        indicatorTags: subTheme.indicatorTags,
        sdgTags: (subTheme as any).sdgTags || [],
        resilienceTags: (subTheme as any).resilienceTags || [],
        esgTags: subTheme.esgTags,
        standardTags: subTheme.standardTags
      });
      return acc;
    }, {});

    // Get aggregated SDG and resilience tags from all selected subthemes
    const aggregatedSdgTags = new Set<string>();
    const aggregatedResilienceTags = new Set<string>();

    availableSubThemes.forEach(subTheme => {
      if ((subTheme as any).sdgTags) {
        (subTheme as any).sdgTags.forEach((tag: string) => aggregatedSdgTags.add(tag));
      }
      if ((subTheme as any).resilienceTags) {
        (subTheme as any).resilienceTags.forEach((tag: string) => aggregatedResilienceTags.add(tag));
      }
    });

    res.status(200).json({
      success: true,
      data: {
        availableSubThemes,
        subThemesByTheme: Object.values(subThemesByTheme),
        aggregatedTags: {
          sdgTags: Array.from(aggregatedSdgTags),
          resilienceTags: Array.from(aggregatedResilienceTags)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing social impact
 * @route PUT /api/v1/socialImpacts/:impactId
 * @access Private
 */
export const updateImpact = async (
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

    const { impactId } = req.params;
    const { 
      themeIds, 
      subThemeIds, 
      outcome, 
      notes 
    } = req.body;

    const existingImpact = await SocialImpact.findById(impactId);
    if (!existingImpact) {
      const error = new Error('Social impact not found') as CustomError;
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
        existingImpact.stakeholderGroup.toString(), 
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
        t.theoryOfChangeStage !== 'Stage 2 - Outcome' && t.theoryOfChangeStage !== 'Both'
      );
      if (invalidStageThemes.length > 0) {
        const error = new Error(
          `Themes [${invalidStageThemes.map(t => t.name).join(', ')}] are not scoped to Stage 2.`
        ) as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // Validate subtheme stage compatibility
      const invalidStageSubThemes = subThemes.filter(st => 
        (st as any).theoryOfChangeStage !== 'Stage 2 - Outcome'
      );
      if (invalidStageSubThemes.length > 0) {
        const error = new Error(
          `SubThemes [${invalidStageSubThemes.map(st => st.name).join(', ')}] are not scoped to Stage 2.`
        ) as CustomError;
        error.statusCode = 400;
        throw error;
      }

      existingImpact.themes = themeIds;
      existingImpact.subThemes = subThemeIds;
    }

    // Update other fields
    if (outcome !== undefined) existingImpact.outcome = outcome;
    if (notes !== undefined) existingImpact.notes = notes;
    
    existingImpact.lastUpdatedBy = req.user._id;

    await existingImpact.save({ session });
    await session.commitTransaction();
    session.endSession();

    const populatedImpact = await SocialImpact.findById(impactId)
      .populate('stakeholderGroup', 'name')
      .populate('themes', 'name')
      .populate('subThemes', 'name')
      .populate('creator', 'name')
      .populate('lastUpdatedBy', 'name');

    res.status(200).json({
      success: true,
      message: 'Social impact updated successfully',
      data: populatedImpact
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};