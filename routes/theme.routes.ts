// routes/theme.routes.ts
import { Router } from "express";
import {
  createTheme,
  getThemes,
  getTheme,
  updateTheme,
  archiveTheme,
  restoreTheme,
  deleteTheme,
  getThemeSubThemes
} from "../controllers/theme.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const themeRouter = Router();

// Public routes
themeRouter.get('/', getThemes);
themeRouter.get('/:id', getTheme);
themeRouter.get('/:id/subthemes', getThemeSubThemes);

// ConnectGo staff only routes
themeRouter.post('/', authorize, isConnectGoStaff(), createTheme);
themeRouter.put('/:id', authorize, isConnectGoStaff(), updateTheme);
themeRouter.delete('/:id', authorize, isConnectGoStaff(), archiveTheme);
themeRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreTheme);
themeRouter.delete('/:id/permanent', authorize, isConnectGoStaff(), deleteTheme);

export default themeRouter;
