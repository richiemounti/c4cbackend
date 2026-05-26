// routes/subtheme.routes.ts
import { Router } from "express";
import {
  createSubTheme,
  getSubThemes,
  getSubTheme,
  updateSubTheme,
  archiveSubTheme,
  restoreSubTheme,
  deleteSubTheme,
  getSubThemeQuestions,
  getAvailableTags  // Add this import
} from "../controllers/subtheme.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const subThemeRouter = Router();

// Public routes
subThemeRouter.get('/', getSubThemes);
subThemeRouter.get('/available-tags', getAvailableTags); // Add this line
subThemeRouter.get('/:id', getSubTheme);
subThemeRouter.get('/:id/questions', getSubThemeQuestions);

// ConnectGo staff only routes
subThemeRouter.post('/', authorize, isConnectGoStaff(), createSubTheme);
subThemeRouter.put('/:id', authorize, isConnectGoStaff(), updateSubTheme);
subThemeRouter.delete('/:id', authorize, isConnectGoStaff(), archiveSubTheme);
subThemeRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreSubTheme);
subThemeRouter.delete('/:id/permanent', authorize, isConnectGoStaff(), deleteSubTheme);

export default subThemeRouter;