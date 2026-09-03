// services/theoryOfChange.service.ts
import mongoose from "mongoose";
import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
import StakeholderAction from "../models/stakeholderAction.model";
import SocialImpact from "../models/socialImpact.model";
import StakeholderGroup from "../models/stakeholderGroup.model";
import Theme from "../models/theme.model";
import SubTheme from "../models/subtheme.model";

/**
 * UPDATED: Validate if multiple stakeholder-theme relationships are valid
 * This function checks if the stakeholder and themes can be used together
 */
export const validateStakeholderThemeRelationship = async (
  stakeholderGroupId: string, 
  themeId: string
): Promise<boolean> => {
  try {
    // This function might need additional validation logic specific to your application
    // For now, we'll do a basic check that both exist
    const stakeholder = await StakeholderGroup.findById(stakeholderGroupId);
    const theme = await Theme.findById(themeId);
    
    return !!(stakeholder && theme);
  } catch (error) {
    console.error('Error validating stakeholder-theme relationship:', error);
    return false;
  }
};

/**
 * UPDATED: Validate multiple stakeholder-theme relationships
 * Now validates that all selected themes are allowed by every stakeholder group
 * in the list, since actions/impacts can belong to multiple stakeholder groups.
 * A group with an empty themes array imposes no restriction.
 */
export const validateMultipleStakeholderThemeRelationships = async (
  stakeholderGroupIds: string[],
  themeIds: string[]
): Promise<boolean> => {
  try {
    // First ensure all requested themes exist
    const themes = await Theme.find({ _id: { $in: themeIds } });
    if (themes.length !== themeIds.length) {
      console.error('Some themes not found');
      return false;
    }

    const groups = await StakeholderGroup.find({ _id: { $in: stakeholderGroupIds } }).populate('themes');

    if (groups.length !== stakeholderGroupIds.length) {
      console.error('Some stakeholder groups not found');
      return false;
    }

    for (const group of groups) {
      const groupThemes = (group as any).themes as any[];

      // If stakeholder has no theme restrictions (empty themes array), allow all themes
      if (!groupThemes || groupThemes.length === 0) continue;

      // Get the theme IDs that this stakeholder group is associated with
      const associatedThemeIds = groupThemes.map((theme: any) => theme._id.toString());

      // Check if all requested themes are in this stakeholder's associated themes
      const invalidThemes = themeIds.filter(themeId => !associatedThemeIds.includes(themeId.toString()));

      if (invalidThemes.length > 0) {
        console.error(`Themes [${invalidThemes.join(', ')}] not associated with stakeholder group "${group.name}"`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating stakeholder-theme relationships:', error);
    return false;
  }
};

/**
 * Get SDGs for a subtheme
 * Now returns an array of ObjectIds rather than strings
 */
export const getSDGsForSubTheme = async (subThemeId: string): Promise<mongoose.Types.ObjectId[]> => {
  try {
    const subTheme = await SubTheme.findById(subThemeId);
    if (!subTheme || !subTheme.sdgTags) {
      return [];
    }
    
    // Return the array of ObjectIds
    return subTheme.sdgTags;
  } catch (error) {
    console.error('Error getting SDGs for subtheme:', error);
    return [];
  }
};

/**
 * NEW: Get SDG tags for multiple subthemes
 * Aggregate SDG tags from multiple subthemes
 */
export const getSDGsForMultipleSubThemes = async (subThemeIds: string[]): Promise<mongoose.Types.ObjectId[]> => {
  try {
    const subThemes = await SubTheme.find({ 
      _id: { $in: subThemeIds } 
    }).select('sdgTags');

    const allSdgTags = new Set<string>();
    
    subThemes.forEach(subTheme => {
      if (subTheme.sdgTags) {
        subTheme.sdgTags.forEach(tag => allSdgTags.add(tag.toString()));
      }
    });

    return Array.from(allSdgTags).map(id => new mongoose.Types.ObjectId(id));
  } catch (error) {
    console.error('Error getting SDGs for subthemes:', error);
    return [];
  }
};

/**
 * Get resilience tags for a subtheme
 * Now returns an array of ObjectIds rather than strings
 */
export const getResilienceTagsForSubTheme = async (subThemeId: string): Promise<mongoose.Types.ObjectId[]> => {
  try {
    const subTheme = await SubTheme.findById(subThemeId);
    if (!subTheme || !subTheme.resilienceTags) {
      return [];
    }
    
    // Return the array of ObjectIds
    return subTheme.resilienceTags;
  } catch (error) {
    console.error('Error getting resilience tags for subtheme:', error);
    return [];
  }
};

/**
 * NEW: Get resilience tags for multiple subthemes
 * Aggregate resilience tags from multiple subthemes
 */
export const getResilienceTagsForMultipleSubThemes = async (subThemeIds: string[]): Promise<mongoose.Types.ObjectId[]> => {
  try {
    const subThemes = await SubTheme.find({ 
      _id: { $in: subThemeIds } 
    }).select('resilienceTags');

    const allResilienceTags = new Set<string>();
    
    subThemes.forEach(subTheme => {
      if (subTheme.resilienceTags) {
        subTheme.resilienceTags.forEach(tag => allResilienceTags.add(tag.toString()));
      }
    });

    return Array.from(allResilienceTags).map(id => new mongoose.Types.ObjectId(id));
  } catch (error) {
    console.error('Error getting resilience tags for subthemes:', error);
    return [];
  }
};

/**
 * UPDATED: Calculate the progress of a Theory of Change stage
 * Now handles multiple themes and subthemes per action/impact
 */
export const calculateStageProgress = async (stageId: string) => {
  try {
    const stage = await TheoryOfChangeStage.findById(stageId);
    if (!stage) {
      throw new Error('Stage not found');
    }

    // Structure to hold progress data
    let progressData = {
      overallProgress: 0,
      stakeholderProgress: [] as Array<{ 
        stakeholder: any, 
        progress: number,
        themes: Array<{ theme: any, progress: number }>
      }>,
      themeProgress: [] as Array<{ 
        theme: any, 
        progress: number,
        stakeholders: Array<{ stakeholder: any, progress: number }>
      }>
    };

    if (stage.stageNumber === 1) {
      // UPDATED: For Stage 1, check stakeholder actions with multiple themes
      const actions = await StakeholderAction.find({
        stage: stageId,
        archived: { $ne: true }
      })
        .populate('stakeholderGroups', 'name') // CHANGED: Now populate multiple stakeholder groups
        .populate('themes', 'name')        // CHANGED: Now populate multiple themes
        .populate('subThemes', 'name');    // CHANGED: Now populate multiple subthemes

      if (actions.length === 0) {
        // No actions, so progress is 0
        return progressData;
      }

      // CHANGED: Build groupId -> { stakeholderGroup, actions[] } by unwinding each
      // action's stakeholderGroups array, since an action can belong to multiple groups
      // and should count toward the progress of each one.
      const groupMap = new Map<string, { stakeholderGroup: any; actions: any[] }>();
      actions.forEach(action => {
        (action.stakeholderGroups as any[]).forEach(group => {
          const id = group._id.toString();
          if (!groupMap.has(id)) groupMap.set(id, { stakeholderGroup: group, actions: [] });
          groupMap.get(id)!.actions.push(action);
        });
      });

      // CHANGED: Extract all unique themes from all actions (since each action can have multiple themes)
      const allThemes = new Set<string>();
      actions.forEach(action => {
        action.themes.forEach(theme => allThemes.add(theme._id.toString()));
      });
      const themes = Array.from(allThemes);

      // Calculate progress per stakeholder
      const stakeholderProgress = Array.from(groupMap.values()).map(({ stakeholderGroup, actions: stakeholderActions }) => {
        // CHANGED: Get all unique themes for this stakeholder across all their actions
        const stakeholderThemeIds = new Set<string>();
        stakeholderActions.forEach(action => {
          action.themes.forEach((theme: any) => stakeholderThemeIds.add(theme._id.toString()));
        });

        // Calculate theme progress for this stakeholder
        const themeProgress = Array.from(stakeholderThemeIds).map(themeId => {
          // Get theme object from any action that has this theme
          const themeObj = stakeholderActions
            .flatMap((action: any) => action.themes)
            .find((theme: any) => theme._id.toString() === themeId);

          return {
            theme: themeObj,
            progress: 100 // For now, just having actions is considered 100% progress
          };
        });

        return {
          stakeholder: stakeholderGroup,
          progress: 100, // For now, just having actions is considered 100% progress
          themes: themeProgress
        };
      });

      // CHANGED: Calculate progress per theme with multiple themes per action
      const themeProgress = themes.map(themeId => {
        // Find all actions that include this theme
        const themeActions = actions.filter(action =>
          action.themes.some(theme => theme._id.toString() === themeId)
        );

        // CHANGED: Get all unique stakeholders for this theme by unwinding stakeholderGroups
        const themeStakeholderIds = new Set<string>();
        themeActions.forEach(action => {
          (action.stakeholderGroups as any[]).forEach(group => themeStakeholderIds.add(group._id.toString()));
        });

        // Calculate stakeholder progress for this theme
        const stakeholderProgress = Array.from(themeStakeholderIds).map(groupId => ({
          stakeholder: groupMap.get(groupId)?.stakeholderGroup,
          progress: 100 // For now, just having actions is considered 100% progress
        }));

        // Get theme object
        const themeObj = actions
          .flatMap(action => action.themes)
          .find(theme => theme._id.toString() === themeId);

        return {
          theme: themeObj,
          progress: 100, // For now, just having actions is considered 100% progress
          stakeholders: stakeholderProgress
        };
      });

      // Calculate overall progress - simplified for now
      const overallProgress = 100; // If there are any actions, consider it 100% for now

      progressData = {
        overallProgress,
        stakeholderProgress,
        themeProgress
      };
      
    } else if (stage.stageNumber === 2) {
      // UPDATED: For Stage 2, check social impacts with multiple themes
      const impacts = await SocialImpact.find({
        stage: stageId,
        archived: { $ne: true }
      })
        .populate('stakeholderGroups', 'name') // CHANGED: Now populate multiple stakeholder groups
        .populate('themes', 'name')        // CHANGED: Now populate multiple themes
        .populate('subThemes', 'name');    // CHANGED: Now populate multiple subthemes

      if (impacts.length === 0) {
        // No impacts, so progress is 0
        return progressData;
      }

      // Calculate how many impacts have risks defined
      const impactsWithRisks = impacts.filter(impact => impact.risks.length > 0);
      const riskPercentage = (impactsWithRisks.length / impacts.length) * 100;

      // CHANGED: Build groupId -> { stakeholderGroup, impacts[] } by unwinding each
      // impact's stakeholderGroups array, since an impact can belong to multiple groups
      // and should count toward the progress of each one.
      const groupMap = new Map<string, { stakeholderGroup: any; impacts: any[] }>();
      impacts.forEach(impact => {
        (impact.stakeholderGroups as any[]).forEach(group => {
          const id = group._id.toString();
          if (!groupMap.has(id)) groupMap.set(id, { stakeholderGroup: group, impacts: [] });
          groupMap.get(id)!.impacts.push(impact);
        });
      });

      // CHANGED: Extract all unique themes from all impacts
      const allThemes = new Set<string>();
      impacts.forEach(impact => {
        impact.themes.forEach(theme => allThemes.add(theme._id.toString()));
      });
      const themes = Array.from(allThemes);

      // Calculate progress per stakeholder
      const stakeholderProgress = Array.from(groupMap.values()).map(({ stakeholderGroup, impacts: stakeholderImpacts }) => {
        const stakeholderImpactsWithRisks = stakeholderImpacts.filter(
          impact => impact.risks.length > 0
        );

        const stakeholderProgress = stakeholderImpactsWithRisks.length > 0 ?
          (stakeholderImpactsWithRisks.length / stakeholderImpacts.length) * 100 :
          50; // If impacts but no risks, consider it 50% progress

        // CHANGED: Get all unique themes for this stakeholder across all their impacts
        const stakeholderThemeIds = new Set<string>();
        stakeholderImpacts.forEach(impact => {
          impact.themes.forEach((theme: any) => stakeholderThemeIds.add(theme._id.toString()));
        });

        // Calculate theme progress for this stakeholder
        const themeProgress = Array.from(stakeholderThemeIds).map(themeId => {
          // Find impacts that include this theme
          const themeImpacts = stakeholderImpacts.filter(impact =>
            impact.themes.some((theme: any) => theme._id.toString() === themeId)
          );

          const themeImpactsWithRisks = themeImpacts.filter(
            impact => impact.risks.length > 0
          );

          // Get theme object
          const themeObj = stakeholderImpacts
            .flatMap((impact: any) => impact.themes)
            .find((theme: any) => theme._id.toString() === themeId);

          return {
            theme: themeObj,
            progress: themeImpactsWithRisks.length > 0 ?
              (themeImpactsWithRisks.length / themeImpacts.length) * 100 :
              50 // If impacts but no risks, consider it 50% progress
          };
        });

        return {
          stakeholder: stakeholderGroup,
          progress: stakeholderProgress,
          themes: themeProgress
        };
      });

      // CHANGED: Calculate progress per theme with multiple themes per impact
      const themeProgress = themes.map(themeId => {
        // Find all impacts that include this theme
        const themeImpacts = impacts.filter(impact =>
          impact.themes.some(theme => theme._id.toString() === themeId)
        );

        const themeImpactsWithRisks = themeImpacts.filter(
          impact => impact.risks.length > 0
        );

        const themeProgressValue = themeImpactsWithRisks.length > 0 ?
          (themeImpactsWithRisks.length / themeImpacts.length) * 100 :
          50; // If impacts but no risks, consider it 50% progress

        // CHANGED: Get all unique stakeholders for this theme by unwinding stakeholderGroups
        const themeStakeholderIds = new Set<string>();
        themeImpacts.forEach(impact => {
          (impact.stakeholderGroups as any[]).forEach(group => themeStakeholderIds.add(group._id.toString()));
        });

        // Calculate stakeholder progress for this theme
        const stakeholderProgress = Array.from(themeStakeholderIds).map(groupId => {
          const groupImpacts = themeImpacts.filter(
            impact => (impact.stakeholderGroups as any[]).some(group => group._id.toString() === groupId)
          );

          const groupImpactsWithRisks = groupImpacts.filter(
            impact => impact.risks.length > 0
          );

          return {
            stakeholder: groupMap.get(groupId)?.stakeholderGroup,
            progress: groupImpactsWithRisks.length > 0 ?
              (groupImpactsWithRisks.length / groupImpacts.length) * 100 :
              50 // If impacts but no risks, consider it 50% progress
          };
        });

        // Get theme object
        const themeObj = impacts
          .flatMap(impact => impact.themes)
          .find(theme => theme._id.toString() === themeId);

        return {
          theme: themeObj,
          progress: themeProgressValue,
          stakeholders: stakeholderProgress
        };
      });

      // Calculate overall progress
      const overallProgress = riskPercentage;

      progressData = {
        overallProgress,
        stakeholderProgress,
        themeProgress
      };
    }

    // Update the stage progress
    stage.progress = Math.round(progressData.overallProgress);
    if (stage.progress > 0 && stage.progress < 100) {
      stage.status = 'in_progress';
    } else if (stage.progress === 100) {
      stage.status = 'completed';
      if (!stage.completedAt) {
        stage.completedAt = new Date();
      }
    } else {
      stage.status = 'not_started';
    }
    
    await stage.save();

    return progressData;
  } catch (error) {
    console.error('Error calculating stage progress:', error);
    throw error;
  }
};

/**
 * UPDATED: Generate a workplan from Stage 1 data
 * Now handles multiple themes and subthemes per action
 */
export const generateWorkplan = async (stageId: string) => {
  try {
    // Check if stage exists and is stage 1
    const stage = await TheoryOfChangeStage.findById(stageId);
    if (!stage) {
      throw new Error('Stage not found');
    }

    if (stage.stageNumber !== 1) {
      throw new Error('Workplan can only be generated for Stage 1');
    }

    // CHANGED: Get all actions with multiple themes and subthemes
    const actions = await StakeholderAction.find({
      stage: stageId,
      archived: { $ne: true }
    })
      .populate('stakeholderGroups', 'name') // CHANGED: Now populate multiple stakeholder groups
      .populate('themes', 'name')        // CHANGED: Multiple themes
      .populate('subThemes', 'name')     // CHANGED: Multiple subthemes
      .sort({ createdAt: 1 }); // CHANGED: Can no longer sort by a plural stakeholderGroups field

    if (actions.length === 0) {
      return {
        status: 'empty',
        message: 'No actions found for this stage',
        workplan: []
      };
    }

    // CHANGED: Build groupId -> { stakeholderGroup, actions[] } by unwinding each
    // action's stakeholderGroups array, since an action can belong to multiple groups
    // and appears in each of their workplan sections.
    const groupMap = new Map<string, { stakeholderGroup: any; actions: any[] }>();
    actions.forEach(action => {
      (action.stakeholderGroups as any[]).forEach(group => {
        const id = group._id.toString();
        if (!groupMap.has(id)) groupMap.set(id, { stakeholderGroup: group, actions: [] });
        groupMap.get(id)!.actions.push(action);
      });
    });

    const workplanByStakeholder = Array.from(groupMap.values()).map(({ stakeholderGroup, actions: stakeholderActions }) => {
      // CHANGED: Since actions can have multiple themes, we'll group differently
      // Get all unique themes for this stakeholder
      const stakeholderThemeIds = new Set<string>();
      stakeholderActions.forEach((action: any) => {
        action.themes.forEach((theme: any) => stakeholderThemeIds.add(theme._id.toString()));
      });

      const themeGroups = Array.from(stakeholderThemeIds).map(themeId => {
        // Find actions that include this theme
        const themeActions = stakeholderActions.filter((action: any) =>
          action.themes.some((theme: any) => theme._id.toString() === themeId)
        );

        // Get theme object
        const themeObj = stakeholderActions
          .flatMap((action: any) => action.themes)
          .find((theme: any) => theme._id.toString() === themeId);

        return {
          theme: themeObj,
          actions: themeActions.map((action: any) => ({
            ...action.toObject(),
            themes: (action.themes as any[]).map((t: any) => t.name),      // Convert to names for workplan
            subThemes: (action.subThemes as any[]).map((st: any) => st.name) // Convert to names for workplan
          }))
        };
      });

      return {
        stakeholder: stakeholderGroup,
        themes: themeGroups
      };
    });

    // CHANGED: Calculate summary with multiple themes/subthemes
    const uniqueThemes = new Set<string>();
    const uniqueSubThemes = new Set<string>();
    
    actions.forEach(action => {
      (action.themes as any[]).forEach((theme: any) => uniqueThemes.add(theme.name));
      (action.subThemes as any[]).forEach((subTheme: any) => uniqueSubThemes.add(subTheme.name));
    });

    // Format workplan data
    const workplan = {
      title: `Workplan for ${stage.project}`,
      description: `Generated workplan based on stakeholder actions`,
      stakeholders: workplanByStakeholder,
      lastUpdated: new Date(),
      actionCount: actions.length,
      summary: {
        totalStakeholders: groupMap.size,
        totalThemes: uniqueThemes.size,
        totalSubThemes: uniqueSubThemes.size,
        actionsWithTimeframes: actions.filter(a => a.timeframe?.startDate || a.timeframe?.endDate).length,
        actionsWithResponsibility: actions.filter(a => a.responsibility?.name).length
      }
    };

    return {
      status: 'success',
      message: 'Workplan generated successfully',
      workplan
    };
  } catch (error) {
    console.error('Error generating workplan:', error);
    throw error;
  }
};

/**
 * UPDATED: Generate a logic model from Stage 2 data
 * Now handles multiple themes and subthemes per impact
 */
export const generateLogicModel = async (stageId: string) => {
  try {
    // Check if stage exists and is stage 2
    const stage = await TheoryOfChangeStage.findById(stageId);
    if (!stage) {
      throw new Error('Stage not found');
    }

    if (stage.stageNumber !== 2) {
      throw new Error('Logic model can only be generated for Stage 2');
    }

    // CHANGED: Get all impacts with multiple themes and subthemes
    const impacts = await SocialImpact.find({
      stage: stageId,
      archived: { $ne: true }
    })
      .populate('stakeholderGroups', 'name') // CHANGED: Now populate multiple stakeholder groups
      .populate('themes', 'name')          // CHANGED: Multiple themes
      .populate('subThemes', 'name')       // CHANGED: Multiple subthemes
      .populate('sdgTags', 'code name')    // Updated to populate the ObjectId references
      .populate('resilienceTags', 'code name') // Updated to populate the ObjectId references
      .sort({ createdAt: 1 }); // CHANGED: Can no longer sort by a plural stakeholderGroups field

    if (impacts.length === 0) {
      return {
        status: 'empty',
        message: 'No impacts found for this stage',
        logicModel: []
      };
    }

    // CHANGED: Build groupId -> { stakeholderGroup, impacts[] } by unwinding each
    // impact's stakeholderGroups array, since an impact can belong to multiple groups
    // and appears in each of their logic model sections.
    const groupMap = new Map<string, { stakeholderGroup: any; impacts: any[] }>();
    impacts.forEach(impact => {
      (impact.stakeholderGroups as any[]).forEach(group => {
        const id = group._id.toString();
        if (!groupMap.has(id)) groupMap.set(id, { stakeholderGroup: group, impacts: [] });
        groupMap.get(id)!.impacts.push(impact);
      });
    });

    const logicModelByStakeholder = Array.from(groupMap.values()).map(({ stakeholderGroup, impacts: stakeholderImpacts }) => {
      // CHANGED: Since impacts can have multiple themes, we'll group differently
      // Get all unique themes for this stakeholder
      const stakeholderThemeIds = new Set<string>();
      stakeholderImpacts.forEach((impact: any) => {
        impact.themes.forEach((theme: any) => stakeholderThemeIds.add(theme._id.toString()));
      });

      const themeGroups = Array.from(stakeholderThemeIds).map(themeId => {
        // Find impacts that include this theme
        const themeImpacts = stakeholderImpacts.filter((impact: any) =>
          impact.themes.some((theme: any) => theme._id.toString() === themeId)
        );

        // Get theme object
        const themeObj = stakeholderImpacts
          .flatMap((impact: any) => impact.themes)
          .find((theme: any) => theme._id.toString() === themeId);

        return {
          theme: themeObj,
          impacts: themeImpacts.map((impact: any) => ({
            ...impact.toObject(),
            themes: (impact.themes as any[]).map((t: any) => t.name),        // Convert to names for logic model
            subThemes: (impact.subThemes as any[]).map((st: any) => st.name)  // Convert to names for logic model
          }))
        };
      });

      return {
        stakeholder: stakeholderGroup,
        themes: themeGroups
      };
    });

    // CHANGED: Get all unique SDG and resilience tags from multiple themes/subthemes
    const allSdgTags = new Set<string>();
    const allResilienceTags = new Set<string>();
    const uniqueThemes = new Set<string>();
    const uniqueSubThemes = new Set<string>();
    
    impacts.forEach(impact => {
      // Handle themes and subthemes
      (impact.themes as any[]).forEach((theme: any) => uniqueThemes.add(theme.name));
      (impact.subThemes as any[]).forEach((subTheme: any) => uniqueSubThemes.add(subTheme.name));
      
      // Handle SDG tags
      impact.sdgTags.forEach(tag => {
        // Handle both string tags and populated ObjectId references
        if (typeof tag === 'string') {
          allSdgTags.add(tag);
        } else if (tag && typeof tag === 'object') {
          // TypeScript type guard
          const tagObject = tag as any; // Type assertion
          if ('code' in tagObject && typeof tagObject.code === 'string') {
            allSdgTags.add(tagObject.code);
          } else if ('_id' in tagObject) {
            // If it's just the MongoDB document with _id
            allSdgTags.add(tagObject._id.toString());
          }
        }
      });
      
      // Handle resilience tags
      impact.resilienceTags.forEach(tag => {
        // Handle both string tags and populated ObjectId references
        if (typeof tag === 'string') {
          allResilienceTags.add(tag);
        } else if (tag && typeof tag === 'object') {
          // TypeScript type guard
          const tagObject = tag as any; // Type assertion
          if ('code' in tagObject && typeof tagObject.code === 'string') {
            allResilienceTags.add(tagObject.code);
          } else if ('_id' in tagObject) {
            // If it's just the MongoDB document with _id
            allResilienceTags.add(tagObject._id.toString());
          }
        }
      });
    });

    // CHANGED: Enhanced summary with multiple themes/subthemes
    const summary = {
      totalStakeholders: groupMap.size,
      totalThemes: uniqueThemes.size,
      totalSubThemes: uniqueSubThemes.size,
      totalRisks: impacts.reduce((total, impact) => total + impact.risks.length, 0),
      impactsWithRisks: impacts.filter(i => i.risks.length > 0).length
    };

    // Format logic model data
    const logicModel = {
      title: `Logic Model for ${stage.project}`,
      description: `Generated logic model based on social impacts`,
      stakeholders: logicModelByStakeholder,
      sdgTags: Array.from(allSdgTags),
      resilienceTags: Array.from(allResilienceTags),
      lastUpdated: new Date(),
      impactCount: impacts.length,
      summary
    };

    return {
      status: 'success',
      message: 'Logic model generated successfully',
      logicModel
    };
  } catch (error) {
    console.error('Error generating logic model:', error);
    throw error;
  }
};

export default {
  validateStakeholderThemeRelationship,
  validateMultipleStakeholderThemeRelationships, // NEW
  getSDGsForSubTheme,
  getSDGsForMultipleSubThemes,                   // NEW
  getResilienceTagsForSubTheme,
  getResilienceTagsForMultipleSubThemes,         // NEW
  calculateStageProgress,
  generateWorkplan,
  generateLogicModel
};