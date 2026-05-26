// middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

// Define an interface for the error object to help TypeScript understand its structure
interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  errors?: { [key: string]: { message: string } };
  data?: any;
}

const errorMiddleware = (
  err: Error | CustomError, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    let error = { ...err } as CustomError;
    error.message = err.message;

    console.error('Error caught in middleware:', err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
      const message = 'Resource not found';
      error = new Error(message) as CustomError;
      error.statusCode = 404;
    }

    // Mongoose duplicate key
    if ('code' in err && err.code === 11000) {
      const message = 'Duplicate field value entered';
      error = new Error(message) as CustomError;
      error.statusCode = 400;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError' && 'errors' in err) {
      const messages = Object.values(err.errors || {}).map((val: any) => val.message);
      error = new Error(messages.join(', ')) as CustomError;
      error.statusCode = 400;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      const message = 'Invalid token';
      error = new Error(message) as CustomError;
      error.statusCode = 401;
    }

    if (err.name === 'TokenExpiredError') {
      const message = 'Token expired';
      error = new Error(message) as CustomError;
      error.statusCode = 401;
    }

    // ✅ FIXED: Handle Axios errors (Stream Chat timeouts, etc)
    if (err.name === 'AxiosError' || (err as any).code === 'ECONNABORTED') {
      const message = 'External service temporarily unavailable';
      error = new Error(message) as CustomError;
      error.statusCode = 503;
    }

    // Build response object (safe serialization)
    const response: any = {
      success: false,
      error: error.message || 'Server Error',
      statusCode: error.statusCode || 500,
    };

    // Include validation errors if they exist
    if (error.data && Array.isArray(error.data)) {
      response.validationErrors = error.data;
    }

    // Include error details in development (but safely)
    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
      // ✅ FIXED: Only include serializable error details
      if (error.statusCode) {
        response.details = {
          name: err.name,
          message: err.message,
          statusCode: error.statusCode,
        };
      }
    }

    // ✅ FIXED: Safely send response without circular references
    res.status(error.statusCode || 500).json(response);
  } catch (catchError) {
    // Fallback error response
    console.error('Error middleware failed:', catchError);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export { errorMiddleware as default, CustomError };