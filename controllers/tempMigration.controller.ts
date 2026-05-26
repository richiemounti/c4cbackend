// controllers/tempMigration.controller.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';

export const fixStakeholderTags = async (req: Request, res: Response) => {
  try {
    console.log('Starting tags fix via API route...');
    
    // Check if database connection exists
    if (!mongoose.connection.db) {
      return res.status(500).json({
        success: false,
        error: 'Database connection not available'
      });
    }
    
    const db = mongoose.connection.db;
    
    // First, let's check current state
    const totalTasksResult = await db.collection('stakeholdergroups').aggregate([
      { $unwind: "$tasks" },
      { $count: "total" }
    ]).toArray();
    
    const tasksWithTagsResult = await db.collection('stakeholdergroups').aggregate([
      { $unwind: "$tasks" },
      { $match: { "tasks.tags": { $exists: true } } },
      { $count: "withTags" }
    ]).toArray();
    
    const totalTasks = totalTasksResult[0]?.total || 0;
    const tasksWithTags = tasksWithTagsResult[0]?.withTags || 0;
    
    console.log(`Before fix: ${tasksWithTags}/${totalTasks} tasks have tags`);
    
    // Apply the fix
    const result = await db.collection('stakeholdergroups').updateMany(
      {},
      [
        {
          $set: {
            tasks: {
              $map: {
                input: "$tasks",
                as: "task",
                in: {
                  $mergeObjects: [
                    "$$task",
                    {
                      tags: {
                        $ifNull: ["$$task.tags", []]
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    );
    
    // Check state after fix
    const tasksWithTagsAfterResult = await db.collection('stakeholdergroups').aggregate([
      { $unwind: "$tasks" },
      { $match: { "tasks.tags": { $exists: true } } },
      { $count: "withTags" }
    ]).toArray();
    
    const tasksWithTagsAfter = tasksWithTagsAfterResult[0]?.withTags || 0;
    
    console.log(`After fix: ${tasksWithTagsAfter}/${totalTasks} tasks have tags`);
    
    res.json({ 
      success: true,
      message: 'Tags fix completed successfully',
      details: {
        totalTasks,
        tasksWithTagsBefore: tasksWithTags,
        tasksWithTagsAfter: tasksWithTagsAfter,
        documentsMatched: result.matchedCount,
        documentsModified: result.modifiedCount
      }
    });
    
  } catch (error) {
    console.error('Tags fix failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
  }
};