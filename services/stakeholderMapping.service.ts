// services/stakeholderMapping.service.ts
import mongoose from "mongoose";
import StakeholderGroup from "../models/stakeholderGroup.model";
import StakeholderTaskOption from "../models/stakeholderTaskOption.model";
import TaskPrompt from "../models/taskPrompt.model";
import { CustomError } from "../middlewares/error.middleware";
import { TASK_PROMPTS, CATEGORY_OPTIONS_MAP } from "../constants/stakeholderMapping.constants";

/**
 * Initializes the default task prompts if they don't exist
 */
export const initializeTaskPrompts = async (creatorId: string): Promise<void> => {
  // Build the prompts array from the shared constants so this stays in sync
  const defaultPrompts = Object.entries(TASK_PROMPTS).map(([taskType, config]) => ({
    taskType,
    promptText: config.promptText,
    tooltipText: config.tooltipText,
    ratingPrompt: config.ratingPrompt,
    ratingMin: config.ratingMin,
    ratingMax: config.ratingMax,
    ratingMinLabel: config.ratingMinLabel,
    ratingMaxLabel: config.ratingMaxLabel
  }));

  for (const prompt of defaultPrompts) {
    await TaskPrompt.findOneAndUpdate(
      { taskType: prompt.taskType },
      { ...prompt, creator: creatorId },
      { upsert: true, new: true }
    );
  }
};

/**
 * Initializes the task options for a specific category
 */
export const initializeCategoryTaskOptions = async (
  categoryId: string,
  categoryName: string,
  creatorId: string
): Promise<void> => {
  // Use the shared CATEGORY_OPTIONS_MAP from constants — single source of truth
  const categoryOptions = CATEGORY_OPTIONS_MAP[categoryName];
  if (!categoryOptions) {
    throw new Error(`No predefined options found for category: ${categoryName}`);
  }
  
  // Create options for each task type
  for (const [taskType, options] of Object.entries(categoryOptions)) {
    let order = 0;
    for (const option of options) {
      await StakeholderTaskOption.findOneAndUpdate(
        { 
          category: categoryId,
          taskType,
          optionId: option.optionId
        },
        {
          ...option,
          category: categoryId,
          taskType,
          order: order++,
          creator: creatorId
        },
        { upsert: true, new: true }
      );
    }
  }
};

/**
 * Get all task options for a specific category and task type
 */
export const getTaskOptionsForCategory = async (
  categoryId: string,
  taskType: string
): Promise<any[]> => {
  const options = await StakeholderTaskOption.find({
    category: categoryId,
    taskType,
    archived: { $ne: true }
  }).sort('order');
  
  return options;
};

/**
 * Get the task prompt for a specific task type
 */
export const getTaskPrompt = async (taskType: string): Promise<any> => {
  const prompt = await TaskPrompt.findOne({ taskType });
  if (!prompt) {
    throw new Error(`No prompt found for task type: ${taskType}`);
  }
  
  return prompt;
};

/**
 * Create a new stakeholder group
 */
export const createStakeholderGroup = async (
  data: {
    project: string;
    projectSite?: string;
    category: string;
    name: string;
    description?: string;
    estimatedPopulation?: number; // NEW: Add this field
    creator: string;
  }
): Promise<any> => {
  try {
    const stakeholderGroup = new StakeholderGroup({
      ...data,
      tasks: [],
      completionStatus: 'not_started',
      lastUpdatedBy: data.creator
    });
    
    await stakeholderGroup.save();
    return stakeholderGroup;
  } catch (error) {
    // Handle unique index violation
    if (error instanceof Error && error.name === 'MongoError' && (error as any).code === 11000) {
      const customError = new Error('A stakeholder group with this name already exists for this category in this project/site') as CustomError;
      customError.statusCode = 400;
      throw customError;
    }
    throw error;
  }
};

/**
 * Add or update a task for a stakeholder group
 */
export const updateStakeholderTask = async (
    stakeholderGroupId: string,
    taskType: string,
    taskData: {
      responses: Array<{ 
        optionId: string; 
        description: string;
        isKeyInsight?: boolean;  // Add this
      }>;
      rating: number;
      tags?: string[];
    },
    userId: string
  ): Promise<any> => {
    try {
      // Find the stakeholder group
      const stakeholderGroup = await StakeholderGroup.findById(stakeholderGroupId);
      if (!stakeholderGroup) {
        const customError = new Error('Stakeholder group not found') as CustomError;
        customError.statusCode = 404;
        throw customError;
      }
      
      // Find the existing task or create a new one
      const taskIndex = stakeholderGroup.tasks.findIndex(t => t.taskType === taskType);
      
      if (taskIndex !== -1) {
        // Update existing task - use set to handle Mongoose document arrays properly
        stakeholderGroup.tasks[taskIndex].set('responses', taskData.responses);
        stakeholderGroup.tasks[taskIndex].set('rating', taskData.rating);
        if (taskData.tags !== undefined) {
          stakeholderGroup.tasks[taskIndex].set('tags', taskData.tags);
        }
        stakeholderGroup.tasks[taskIndex].set('updatedAt', new Date());
      } else {
        // Add new task
        stakeholderGroup.tasks.push({
          taskType,
          responses: taskData.responses,
          rating: taskData.rating,
          tags: taskData.tags || [],
          updatedAt: new Date()
        } as any);
      }
      
      // Update last updated by
      stakeholderGroup.lastUpdatedBy = new mongoose.Types.ObjectId(userId);
      
      // Save the stakeholder group
      await stakeholderGroup.save();
      
      return stakeholderGroup;
    } catch (error) {
      throw error;
    }
};

/**
 * Get stakeholder completion statistics for a project
 */
export const getStakeholderCompletionStats = async (
  projectId: string,
  projectSiteId?: string
): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionPercentage: number;
  byCategoryStats: Record<string, {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    completionPercentage: number;
  }>;
}> => {
  try {
    // Build the query
    const query: any = { project: projectId };
    if (projectSiteId) {
      query.projectSite = projectSiteId;
    }
    
    // Get all stakeholder groups for this project/site
    const stakeholderGroups = await StakeholderGroup.find(query)
      .populate('category', 'name');
    
    // Calculate totals
    const total = stakeholderGroups.length;
    const completed = stakeholderGroups.filter(sg => sg.completionStatus === 'completed').length;
    const inProgress = stakeholderGroups.filter(sg => sg.completionStatus === 'in_progress').length;
    const notStarted = stakeholderGroups.filter(sg => sg.completionStatus === 'not_started').length;
    
    // Group by category
    const byCategoryMap = new Map();
    
    stakeholderGroups.forEach(sg => {
      const categoryName = (sg.category as any).name;
      
      if (!byCategoryMap.has(categoryName)) {
        byCategoryMap.set(categoryName, {
          total: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0
        });
      }
      
      const categoryStats = byCategoryMap.get(categoryName);
      categoryStats.total++;
      
      if (sg.completionStatus === 'completed') {
        categoryStats.completed++;
      } else if (sg.completionStatus === 'in_progress') {
        categoryStats.inProgress++;
      } else {
        categoryStats.notStarted++;
      }
    });
    
    // Convert map to object and calculate percentages
    const byCategoryStats: Record<string, any> = {};
    byCategoryMap.forEach((stats, category) => {
      byCategoryStats[category] = {
        ...stats,
        completionPercentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
      };
    });
    
    return {
      total,
      completed,
      inProgress,
      notStarted,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      byCategoryStats
    };
  } catch (error) {
    throw error;
  }
};