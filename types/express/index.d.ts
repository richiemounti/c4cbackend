// types/express/index.d.ts
import mongoose from 'mongoose';
import { IUserDocument } from '../../models/user.model';

// src/types/express/index.d.ts
// Augments Express's Request interface so req.user is typed as IUserDocument
// across every controller in the project — no casting needed.


declare global {
  namespace Express {
    interface User extends IUserDocument {}

    interface Request {
      user?: IUserDocument;
    }
  }
}