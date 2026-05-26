// routes/questionLibrary.routes.ts
import { Router } from "express";
import {
  createQuestionLibrary,
  getQuestionLibraries,
  getQuestionLibrary,
  updateQuestionLibrary,
  addQuestionsToLibrary,
  removeQuestionsFromLibrary,
  archiveQuestionLibrary,
  restoreQuestionLibrary,
  deleteQuestionLibrary
} from "../controllers/questionLibrary.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const questionLibraryRouter = Router();

// Public/protected routes
questionLibraryRouter.get('/', getQuestionLibraries);
questionLibraryRouter.get('/:id', getQuestionLibrary);

// ConnectGo staff only routes
questionLibraryRouter.post('/', authorize, isConnectGoStaff(), createQuestionLibrary);
questionLibraryRouter.put('/:id', authorize, isConnectGoStaff(), updateQuestionLibrary);
questionLibraryRouter.post('/:id/questions', authorize, isConnectGoStaff(), addQuestionsToLibrary);
questionLibraryRouter.delete('/:id/questions', authorize, isConnectGoStaff(), removeQuestionsFromLibrary);
questionLibraryRouter.delete('/:id', authorize, isConnectGoStaff(), archiveQuestionLibrary);
questionLibraryRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreQuestionLibrary);
questionLibraryRouter.delete('/:id/permanent', authorize, isConnectGoStaff(), deleteQuestionLibrary);

export default questionLibraryRouter;