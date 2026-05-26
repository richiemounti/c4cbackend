// controllers/questionLibrary.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import QuestionLibrary from "../models/questionLibrary.model";
import Question from "../models/question.model";
import { CustomError } from "../middlewares/error.middleware";

/**
 * Create a new question library
 * @route POST /api/v1/question-libraries
 * @access Private (ConnectGo staff only)
 */
export const createQuestionLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can create question libraries') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { name, description, questions } = req.body;
    
    // Add creator from authenticated user
    const creator = req.user._id;
    
    // Validate questions if provided
    if (questions && questions.length > 0) {
      // Check if all questions exist
      const questionCount = await Question.countDocuments({
        _id: { $in: questions },
        archived: { $ne: true }
      });
      
      if (questionCount !== questions.length) {
        const error = new Error('One or more questions not found or are archived') as CustomError;
        error.statusCode = 404;
        throw error;
      }
    }
    
    // Create the new library
    const newLibrary = new QuestionLibrary({
      name,
      description,
      questions: questions || [],
      creator,
      status: req.body.status || 'draft'
    });

    await newLibrary.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Question library created successfully',
      data: newLibrary
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Get all question libraries
 * @route GET /api/v1/question-libraries
 * @access Private
 */
export const getQuestionLibraries = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Initialize query
    let query = QuestionLibrary.find({ archived: { $ne: true } });

    // Filter by status if provided
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Copy req.query to avoid modifying the original
    const reqQuery = { ...req.query };

    // Fields to exclude from filtering
    const removeFields = ['select', 'sort', 'page', 'limit', 'populate', 'status'];
    removeFields.forEach(param => delete reqQuery[param]);

    // Create filtering based on query parameters
    let queryStr = JSON.stringify(reqQuery);
    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    
    // Apply filtering
    query = query.find(JSON.parse(queryStr));

    // Select specific fields
    if (req.query.select) {
      const fields = (req.query.select as string).split(',').join(' ');
      query = query.select(fields);
    }

    // Sort results
    if (req.query.sort) {
      const sortBy = (req.query.sort as string).split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt'); // Default sort by newest
    }

    // Handle population of related fields
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query = query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }
      
      if (populateFields.includes('questions')) {
        query = query.populate({
          path: 'questions',
          select: 'text type categories theme subThemes targetAudience'
        });
      }
    }

    // Pagination
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await QuestionLibrary.countDocuments({ archived: { $ne: true } });

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const libraries = await query;

    // Pagination result
    const pagination: {
      next?: { page: number; limit: number };
      prev?: { page: number; limit: number };
    } = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: libraries.length,
      pagination,
      total,
      data: libraries
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a question library by ID
 * @route GET /api/v1/question-libraries/:id
 * @access Private
 */
export const getQuestionLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const libraryId = req.params.id;

    const query = QuestionLibrary.findById(libraryId);
    
    // Populate related fields if requested
    if (req.query.populate) {
      const populateFields = (req.query.populate as string).split(',');
      
      if (populateFields.includes('creator')) {
        query.populate({
          path: 'creator',
          select: 'name email userName'
        });
      }
      
      if (populateFields.includes('questions')) {
        query.populate({
          path: 'questions',
          select: 'text description type options validation targetAudience category theme subTheme'
        });
      }
    }

    const library = await query;

    if (!library) {
      const error = new Error('Question library not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if library is archived
    if (library.archived) {
      const error = new Error('This question library has been archived') as CustomError;
      error.statusCode = 410; // Gone
      throw error;
    }

    res.status(200).json({
      success: true,
      data: library
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid library ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Update a question library
 * @route PUT /api/v1/question-libraries/:id
 * @access Private (ConnectGo staff only)
 */
export const updateQuestionLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can update question libraries') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const libraryId = req.params.id;
    const { name, description, questions, status } = req.body;

    // Find the library first to check if it exists and is not archived
    const library = await QuestionLibrary.findById(libraryId);

    if (!library) {
      const error = new Error('Question library not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (library.archived) {
      const error = new Error('Cannot update an archived question library') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Validate questions if provided
    if (questions && questions.length > 0) {
      // Check if all questions exist
      const questionCount = await Question.countDocuments({
        _id: { $in: questions },
        archived: { $ne: true }
      });
      
      if (questionCount !== questions.length) {
        const error = new Error('One or more questions not found or are archived') as CustomError;
        error.statusCode = 404;
        throw error;
      }
    }

    // Update the library
    const updatedLibrary = await QuestionLibrary.findByIdAndUpdate(
      libraryId,
      { name, description, questions, status },
      { new: true, runValidators: true, session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Question library updated successfully',
      data: updatedLibrary
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid library ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Add questions to a library
 * @route POST /api/v1/question-libraries/:id/questions
 * @access Private (ConnectGo staff only)
 */
export const addQuestionsToLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can modify question libraries') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const libraryId = req.params.id;
    const { questions } = req.body;

    // Validate input
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      const error = new Error('Questions array is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Find the library
    const library = await QuestionLibrary.findById(libraryId);
    if (!library) {
      const error = new Error('Question library not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (library.archived) {
      const error = new Error('Cannot modify an archived question library') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if all questions exist
    const questionCount = await Question.countDocuments({
      _id: { $in: questions },
      archived: { $ne: true }
    });
    
    if (questionCount !== questions.length) {
      const error = new Error('One or more questions not found or are archived') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Create a Set of existing question IDs to avoid duplicates
    const existingIds = new Set(library.questions.map(q => q.toString()));
    
    // Add the new questions, avoiding duplicates
    questions.forEach(questionId => {
      if (!existingIds.has(questionId.toString())) {
        library.questions.push(questionId);
      }
    });

    await library.save({ session });

    // Populate the updated library
    const updatedLibrary = await QuestionLibrary.findById(libraryId)
      .populate({
        path: 'questions',
        select: 'text type targetAudience'
      });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Questions added to library successfully',
      data: updatedLibrary
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
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
 * Remove questions from a library
 * @route DELETE /api/v1/question-libraries/:id/questions
 * @access Private (ConnectGo staff only)
 */
export const removeQuestionsFromLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can modify question libraries') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const libraryId = req.params.id;
    const { questions } = req.body;

    // Validate input
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      const error = new Error('Questions array is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Find the library
    const library = await QuestionLibrary.findById(libraryId);
    if (!library) {
      const error = new Error('Question library not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (library.archived) {
      const error = new Error('Cannot modify an archived question library') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Create a Set of question IDs to remove
    const removeIds = new Set(questions.map(q => q.toString()));
    
    // Filter out the questions to remove
    library.questions = library.questions.filter(
      questionId => !removeIds.has(questionId.toString())
    );

    await library.save({ session });

    // Populate the updated library
    const updatedLibrary = await QuestionLibrary.findById(libraryId)
      .populate({
        path: 'questions',
        select: 'text type targetAudience'
      });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Questions removed from library successfully',
      data: updatedLibrary
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
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
 * Archive a question library
 * @route DELETE /api/v1/question-libraries/:id
 * @access Private (ConnectGo staff only)
 */
export const archiveQuestionLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can archive question libraries') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const libraryId = req.params.id;

    // Find the library
    const library = await QuestionLibrary.findById(libraryId);
    if (!library) {
      const error = new Error('Question library not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (library.archived) {
      const error = new Error('Library is already archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Archive the library
    const archivedLibrary = await QuestionLibrary.findByIdAndUpdate(
      libraryId,
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Question library archived successfully',
      data: archivedLibrary
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid library ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Restore an archived question library
 * @route POST /api/v1/question-libraries/:id/restore
 * @access Private (ConnectGo staff only)
 */
export const restoreQuestionLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can restore question libraries') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const libraryId = req.params.id;

    // Find the library
    const library = await QuestionLibrary.findById(libraryId);
    if (!library) {
      const error = new Error('Question library not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!library.archived) {
      const error = new Error('Library is not archived') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Restore the library
    const restoredLibrary = await QuestionLibrary.findByIdAndUpdate(
      libraryId,
      { archived: false, archivedAt: null },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Question library restored successfully',
      data: restoredLibrary
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid library ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Permanently delete a question library
 * @route DELETE /api/v1/question-libraries/:id/permanent
 * @access Private (ConnectGo staff only)
 */
export const deleteQuestionLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verify user is authenticated and is ConnectGo staff
    if (!req.user?.isConnectGoStaff) {
      const error = new Error('Only ConnectGo staff can permanently delete question libraries') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const libraryId = req.params.id;

    // Find the library
    const library = await QuestionLibrary.findById(libraryId);
    if (!library) {
      const error = new Error('Question library not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Permanently delete the library
    await QuestionLibrary.findByIdAndDelete(libraryId);

    res.status(200).json({
      success: true,
      message: 'Question library permanently deleted',
      data: null
    });
  } catch (error) {
    // Handle invalid MongoDB ID format
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid library ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};