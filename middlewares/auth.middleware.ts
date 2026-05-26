import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from "jsonwebtoken";
import User from '../models/user.model';
import { CustomError } from './error.middleware';

// Use type assertion to help TypeScript understand this is a string
const JWT_SECRET = process.env.JWT_SECRET as string || 'your_fallback_secret';


// Define an interface for our JWT payload
interface CustomJwtPayload extends JwtPayload {
  userId: string;
}


const authorize = async (
    req: Request, 
    res: Response,
    next: NextFunction
) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            const error = new Error('Not authorized to access this route') as CustomError;
            error.statusCode = 401;
            throw error;
        }

        // Cast the decoded token to our custom payload type
        const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload;

        const user = await User.findById(decoded.userId);
        

        if (!user) {
            const error = new Error('Not authorized to access this route') as CustomError;
            error.statusCode = 401;
            throw error;
        }

        // Now TypeScript knows req.user exists
        // Cast the user object to the Express.User interface
        req.user = user as any;

        next();
        
    } catch (error: unknown) {
        // Forward to the error middleware
        if (error instanceof Error) {
            const customError = error as CustomError;
            if (!customError.statusCode) {
                customError.statusCode = 401;
            }
            next(customError);
        } else {
            const customError = new Error('Authentication failed') as CustomError;
            customError.statusCode = 401;
            next(customError);
        }
    }
};

export default authorize;