// // services/questionTag.service.ts
// import mongoose from "mongoose";
// import Question from "../models/question.model";
// import SubTheme from "../models/subtheme.model";

// /**
//  * Get derived tags from a subtheme
//  * @param subThemeId The ID of the subtheme
//  * @returns Object containing all tag arrays
//  */
// export const getDerivedTagsFromSubTheme = async (subThemeId: string) => {
//   try {
//     const subTheme = await SubTheme.findById(subThemeId)
//       .populate('sdgTags')
//       .populate('resilienceTags')
//       .populate('esgTags')
//       .populate('standardTags');

//     if (!subTheme) {
//       return {
//         sdgTags: [],
//         resilienceTags: [],
//         esgTags: [],
//         standardTags: []
//       };
//     }

//     return {
//       sdgTags: subTheme.sdgTags || [],
//       resilienceTags: subTheme.resilienceTags || [],
//       esgTags: subTheme.esgTags || [],
//       standardTags: subTheme.standardTags || []
//     };
//   } catch (error) {
//     console.error('Error getting derived tags from subtheme:', error);
//     return {
//       sdgTags: [],
//       resilienceTags: [],
//       esgTags: [],
//       standardTags: []
//     };
//   }
// };

// /**
//  * Update derived tags for a specific question
//  * @param questionId The ID of the question to update
//  * @returns Updated question or null if not found
//  */
// export const updateQuestionDerivedTags = async (questionId: string) => {
//   try {
//     const question = await Question.findById(questionId);
    
//     if (!question) {
//       return null;
//     }

//     if (question.subTheme) {
//       const derivedTags = await getDerivedTagsFromSubTheme(question.subTheme.toString());
      
//       question.sdgTags = derivedTags.sdgTags.map((tag: any) => tag._id);
//       question.resilienceTags = derivedTags.resilienceTags.map((tag: any) => tag._id);
//       question.esgTags = derivedTags.esgTags.map((tag: any) => tag._id);
//       question.standardTags = derivedTags.standardTags.map((tag: any) => tag._id);
      
//       await question.save();
//     } else {
//       // Clear all derived tags if no subtheme
//       question.sdgTags = [];
//       question.resilienceTags = [];
//       question.esgTags = [];
//       question.standardTags = [];
      
//       await question.save();
//     }

//     return question;
//   } catch (error) {
//     console.error('Error updating question derived tags:', error);
//     throw error;
//   }
// };

// /**
//  * Update derived tags for all questions associated with a specific subtheme
//  * @param subThemeId The ID of the subtheme
//  * @returns Object with success and error counts
//  */
// export const updateQuestionsForSubTheme = async (subThemeId: string) => {
//   try {
//     const questions = await Question.find({ 
//       subTheme: subThemeId,
//       archived: { $ne: true }
//     });

//     const derivedTags = await getDerivedTagsFromSubTheme(subThemeId);
    
//     let successCount = 0;
//     let errorCount = 0;

//     // Process questions in batches
//     const batchSize = 10;
//     for (let i = 0; i < questions.length; i += batchSize) {
//       const batch = questions.slice(i, i + batchSize);
      
//       const results = await Promise.allSettled(
//         batch.map(async (question) => {
//           question.sdgTags = derivedTags.sdgTags.map((tag: any) => tag._id);
//           question.resilienceTags = derivedTags.resilienceTags.map((tag: any) => tag._id);
//           question.esgTags = derivedTags.esgTags.map((tag: any) => tag._id);
//           question.standardTags = derivedTags.standardTags.map((tag: any) => tag._id);
          
//           return question.save();
//         })
//       );

//       results.forEach((result) => {
//         if (result.status === 'fulfilled') {
//           successCount++;
//         } else {
//           errorCount++;
//           console.error('Error updating question tags:', result.reason);
//         }
//       });
//     }

//     return {
//       totalProcessed: questions.length,
//       successCount,
//       errorCount
//     };
//   } catch (error) {
//     console.error('Error updating questions for subtheme:', error);
//     throw error;
//   }
// };

// /**
//  * Get aggregated tag statistics for questions
//  * @param filters Optional filters to apply
//  * @returns Tag statistics
//  */
// export const getQuestionTagStatistics = async (filters: any = {}) => {
//   try {
//     const matchStage = { 
//       archived: { $ne: true },
//       ...filters 
//     };

//     const pipeline = [
//       { $match: matchStage },
//       {
//         $group: {
//           _id: null,
//           totalQuestions: { $sum: 1 },
//           questionsWithSDGs: {
//             $sum: {
//               $cond: [{ $gt: [{ $size: "$sdgTags" }, 0] }, 1, 0]
//             }
//           },
//           questionsWithResilience: {
//             $sum: {
//               $cond: [{ $gt: [{ $size: "$resilienceTags" }, 0] }, 1, 0]
//             }
//           },
//           questionsWithESG: {
//             $sum: {
//               $cond: [{ $gt: [{ $size: "$esgTags" }, 0] }, 1, 0]
//             }
//           },
//           questionsWithStandards: {
//             $sum: {
//               $cond: [{ $gt: [{ $size: "$standardTags" }, 0] }, 1, 0]
//             }
//           },
//           avgSDGsPerQuestion: { $avg: { $size: "$sdgTags" } },
//           avgResiliencePerQuestion: { $avg: { $size: "$resilienceTags" } },
//           avgESGPerQuestion: { $avg: { $size: "$esgTags" } },
//           avgStandardsPerQuestion: { $avg: { $size: "$standardTags" } }
//         }
//       }
//     ];

//     const result = await Question.aggregate(pipeline);
    
//     return result[0] || {
//       totalQuestions: 0,
//       questionsWithSDGs: 0,
//       questionsWithResilience: 0,
//       questionsWithESG: 0,
//       questionsWithStandards: 0,
//       avgSDGsPerQuestion: 0,
//       avgResiliencePerQuestion: 0,
//       avgESGPerQuestion: 0,
//       avgStandardsPerQuestion: 0
//     };
//   } catch (error) {
//     console.error('Error getting question tag statistics:', error);
//     throw error;
//   }
// };

// /**
//  * Get most popular tags across all questions
//  * @param tagType Type of tag to analyze ('sdg', 'resilience', 'esg', 'standard')
//  * @param limit Number of top tags to return
//  * @returns Array of popular tags with counts
//  */
// export const getPopularTags = async (tagType: 'sdg' | 'resilience' | 'esg' | 'standard', limit: number = 10) => {
//   try {
//     const tagFieldMap = {
//       sdg: 'sdgTags',
//       resilience: 'resilienceTags',
//       esg: 'esgTags',
//       standard: 'standardTags'
//     };

//     const refModelMap = {
//       sdg: 'SDG',
//       resilience: 'ResilienceDimension',
//       esg: 'ESGCategory',
//       standard: 'Standard'
//     };

//     const tagField = tagFieldMap[tagType];
//     const refModel = refModelMap[tagType];

//     const pipeline = [
//       { $match: { archived: { $ne: true } } },
//       { $unwind: `$${tagField}` },
//       {
//         $group: {
//           _id: `$${tagField}`,
//           count: { $sum: 1 }
//         }
//       },
//       { $sort: { count: -1 } },
//       { $limit: limit },
//       {
//         $lookup: {
//           from: refModel.toLowerCase() + 's', // MongoDB collection names are typically lowercase and pluralized
//           localField: '_id',
//           foreignField: '_id',
//           as: 'tagDetails'
//         }
//       },
//       {
//         $project: {
//           _id: 1,
//           count: 1,
//           tagDetails: { $arrayElemAt: ['$tagDetails', 0] }
//         }
//       }
//     ];

//     const results = await Question.aggregate(pipeline);
//     return results;
//   } catch (error) {
//     console.error(`Error getting popular ${tagType} tags:`, error);
//     throw error;
//   }
// };

// /**
//  * Find questions missing derived tags (questions with subthemes but no tags)
//  * @returns Array of question IDs that need tag updates
//  */
// export const findQuestionsWithMissingTags = async () => {
//   try {
//     const questions = await Question.find({
//       archived: { $ne: true },
//       subTheme: { $exists: true, $ne: null },
//       $or: [
//         { sdgTags: { $size: 0 } },
//         { resilienceTags: { $size: 0 } },
//         { esgTags: { $size: 0 } },
//         { standardTags: { $size: 0 } },
//         { sdgTags: { $exists: false } },
//         { resilienceTags: { $exists: false } },
//         { esgTags: { $exists: false } },
//         { standardTags: { $exists: false } }
//       ]
//     }).select('_id text subTheme');

//     return questions;
//   } catch (error) {
//     console.error('Error finding questions with missing tags:', error);
//     throw error;
//   }
// };

// export default {
//   getDerivedTagsFromSubTheme,
//   updateQuestionDerivedTags,
//   updateQuestionsForSubTheme,
//   getQuestionTagStatistics,
//   getPopularTags,
//   findQuestionsWithMissingTags
// };