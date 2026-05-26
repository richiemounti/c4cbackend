// controllers/pulseSurvey.controller.ts
import { Request, Response } from 'express';
import PulseSurvey from '../models/pulseSurvey.model';
import PulseSurveyResponse from '../models/pulseSurveyResponse.model';
import mongoose from 'mongoose';

export const pulseSurveyController = {
  // ============ PULSE SURVEY TEMPLATE MANAGEMENT ============
  
  /**
   * Create or update a pulse survey template for a specific module
   * POST /api/pulse-surveys
   */
  async createOrUpdatePulseSurvey(req: Request, res: Response) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { moduleType, title, description, questions, isActive, showToAllUsers } = req.body;
      const userId = req.user?._id as mongoose.Types.ObjectId;

      // Validate required fields
      if (!moduleType || !title || !questions || !Array.isArray(questions)) {
        await session.abortTransaction();
        return res.status(400).json({ 
          message: 'Module type, title, and questions array are required' 
        });
      }

      // Check if pulse survey already exists for this module
      const existingSurvey = await PulseSurvey.findOne({ moduleType }).session(session);

      let pulseSurvey;
      if (existingSurvey) {
        // Update existing survey
        existingSurvey.title = title;
        existingSurvey.description = description;
        existingSurvey.questions.splice(0, existingSurvey.questions.length);
            questions.forEach((q: any) => existingSurvey.questions.push(q));
        existingSurvey.isActive = isActive !== undefined ? isActive : existingSurvey.isActive;
        existingSurvey.showToAllUsers = showToAllUsers !== undefined ? showToAllUsers : existingSurvey.showToAllUsers;
        existingSurvey.lastUpdatedBy = userId;
        
        pulseSurvey = await existingSurvey.save({ session });
      } else {
        // Create new survey
        pulseSurvey = await PulseSurvey.create([{
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

      await session.commitTransaction();

      res.status(existingSurvey ? 200 : 201).json({
        message: `Pulse survey ${existingSurvey ? 'updated' : 'created'} successfully`,
        pulseSurvey
      });
    } catch (error: any) {
      await session.abortTransaction();
      console.error('Error creating/updating pulse survey:', error);
      res.status(500).json({ 
        message: 'Error creating/updating pulse survey',
        error: error.message 
      });
    } finally {
      session.endSession();
    }
  },

  /**
   * Get pulse survey template for a specific module
   * GET /api/pulse-surveys/:moduleType
   */
  async getPulseSurveyByModule(req: Request, res: Response) {
    try {
      const { moduleType } = req.params;

      const pulseSurvey = await PulseSurvey.findOne({ 
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
    } catch (error: any) {
      console.error('Error fetching pulse survey:', error);
      res.status(500).json({ 
        message: 'Error fetching pulse survey',
        error: error.message 
      });
    }
  },

  /**
   * Get all pulse survey templates
   * GET /api/pulse-surveys
   */
  async getAllPulseSurveys(req: Request, res: Response) {
    try {
      const { includeArchived } = req.query;

      const query: any = {};
      if (includeArchived !== 'true') {
        query.archived = false;
      }

      const pulseSurveys = await PulseSurvey.find(query)
        .populate('creator', 'firstName lastName email')
        .populate('lastUpdatedBy', 'firstName lastName email')
        .sort({ moduleType: 1 });

      res.status(200).json({ 
        pulseSurveys,
        count: pulseSurveys.length 
      });
    } catch (error: any) {
      console.error('Error fetching pulse surveys:', error);
      res.status(500).json({ 
        message: 'Error fetching pulse surveys',
        error: error.message 
      });
    }
  },

  /**
   * Archive a pulse survey template
   * DELETE /api/pulse-surveys/:id
   */
  async archivePulseSurvey(req: Request, res: Response) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { id } = req.params;
      const userId = req.user?._id as mongoose.Types.ObjectId;

      const pulseSurvey = await PulseSurvey.findById(id).session(session);
      
      if (!pulseSurvey) {
        await session.abortTransaction();
        return res.status(404).json({ message: 'Pulse survey not found' });
      }

      pulseSurvey.archived = true;
      pulseSurvey.archivedAt = new Date();
      pulseSurvey.lastUpdatedBy = userId;
      
      await pulseSurvey.save({ session });
      await session.commitTransaction();

      res.status(200).json({ 
        message: 'Pulse survey archived successfully',
        pulseSurvey 
      });
    } catch (error: any) {
      await session.abortTransaction();
      console.error('Error archiving pulse survey:', error);
      res.status(500).json({ 
        message: 'Error archiving pulse survey',
        error: error.message 
      });
    } finally {
      session.endSession();
    }
  },

  // ============ PULSE SURVEY RESPONSES ============

  /**
   * Submit a pulse survey response
   * POST /api/pulse-surveys/responses
   */
  async submitPulseSurveyResponse(req: Request, res: Response) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const {
        pulseSurveyId,
        moduleType,
        moduleReference,
        moduleReferenceModel,
        organizationId,
        projectId,
        projectSiteId,
        responses,
        additionalComments,
        timeToComplete,
        metadata
      } = req.body;
      
      const userId = req.user?._id;

      // Validate required fields
      if (!pulseSurveyId || !moduleType || !moduleReference || !moduleReferenceModel || 
          !organizationId || !projectId || !responses) {
        await session.abortTransaction();
        return res.status(400).json({ 
          message: 'Missing required fields for pulse survey response' 
        });
      }

      // Check if response already exists (prevent duplicates)
      const existingResponse = await PulseSurveyResponse.findOne({
        moduleReference,
        respondent: userId
      }).session(session);

      if (existingResponse) {
        await session.abortTransaction();
        return res.status(409).json({ 
          message: 'You have already submitted feedback for this module',
          existingResponse 
        });
      }

      // Verify pulse survey exists
      const pulseSurvey = await PulseSurvey.findById(pulseSurveyId).session(session);
      if (!pulseSurvey) {
        await session.abortTransaction();
        return res.status(404).json({ message: 'Pulse survey not found' });
      }

      // Create the response
      const pulseSurveyResponse = await PulseSurveyResponse.create([{
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

      await session.commitTransaction();

      res.status(201).json({
        message: 'Pulse survey response submitted successfully',
        response: pulseSurveyResponse[0]
      });
    } catch (error: any) {
      await session.abortTransaction();
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
    } finally {
      session.endSession();
    }
  },

  /**
   * Get pulse survey responses with filters
   * GET /api/pulse-surveys/responses
   */
  async getPulseSurveyResponses(req: Request, res: Response) {
    try {
      const { 
        organizationId, 
        projectId, 
        projectSiteId, 
        moduleType,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      // Build query
      const query: any = {};
      
      if (organizationId) query.organization = organizationId;
      if (projectId) query.project = projectId;
      if (projectSiteId) query.projectSite = projectSiteId;
      if (moduleType) query.moduleType = moduleType;
      
      if (startDate || endDate) {
        query.completedAt = {};
        if (startDate) query.completedAt.$gte = new Date(startDate as string);
        if (endDate) query.completedAt.$lte = new Date(endDate as string);
      }

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Get responses
      const responses = await PulseSurveyResponse.find(query)
        .populate('pulseSurvey', 'title moduleType')
        .populate('respondent', 'firstName lastName email')
        .populate('organization', 'name')
        .populate('project', 'name')
        .populate('projectSite', 'name')
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const totalCount = await PulseSurveyResponse.countDocuments(query);

      res.status(200).json({
        responses,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / Number(limit)),
          totalCount,
          limit: Number(limit)
        }
      });
    } catch (error: any) {
      console.error('Error fetching pulse survey responses:', error);
      res.status(500).json({ 
        message: 'Error fetching pulse survey responses',
        error: error.message 
      });
    }
  },

  /**
   * Get analytics for pulse surveys
   * GET /api/pulse-surveys/analytics
   */
  async getPulseSurveyAnalytics(req: Request, res: Response) {
    try {
      const { 
        organizationId, 
        projectId, 
        projectSiteId, 
        moduleType,
        startDate,
        endDate
      } = req.query;

      // Build match query
      const matchQuery: any = {};
      
      if (organizationId) matchQuery.organization = new mongoose.Types.ObjectId(organizationId as string);
      if (projectId) matchQuery.project = new mongoose.Types.ObjectId(projectId as string);
      if (projectSiteId) matchQuery.projectSite = new mongoose.Types.ObjectId(projectSiteId as string);
      if (moduleType) matchQuery.moduleType = moduleType;
      
      if (startDate || endDate) {
        matchQuery.completedAt = {};
        if (startDate) matchQuery.completedAt.$gte = new Date(startDate as string);
        if (endDate) matchQuery.completedAt.$lte = new Date(endDate as string);
      }

      // Get overall statistics
      const overallStats = await PulseSurveyResponse.aggregate([
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
      const statsByModule = await PulseSurveyResponse.aggregate([
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
      const ratingDistribution = await PulseSurveyResponse.aggregate([
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
      const responsesTrend = await PulseSurveyResponse.aggregate([
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
    } catch (error: any) {
      console.error('Error fetching pulse survey analytics:', error);
      res.status(500).json({ 
        message: 'Error fetching pulse survey analytics',
        error: error.message 
      });
    }
  },

  /**
   * Check if user needs to complete pulse survey for a module
   * GET /api/pulse-surveys/check-required/:moduleType/:moduleReference
   */
  async checkPulseSurveyRequired(req: Request, res: Response) {
    try {
      const { moduleType, moduleReference } = req.params;
      const userId = req.user?._id;

      // Check if pulse survey exists and is active for this module
      const pulseSurvey = await PulseSurvey.findOne({ 
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
      const existingResponse = await PulseSurveyResponse.findOne({
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
    } catch (error: any) {
      console.error('Error checking pulse survey requirement:', error);
      res.status(500).json({ 
        message: 'Error checking pulse survey requirement',
        error: error.message 
      });
    }
  }
};