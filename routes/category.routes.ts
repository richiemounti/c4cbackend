// routes/category.routes.ts
import { Router } from "express";
import {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  archiveCategory,
  restoreCategory,
  deleteCategory,
} from "../controllers/category.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const categoryRouter = Router();

// Public routes
categoryRouter.get('/', getCategories);
categoryRouter.get('/:id', getCategory);
// categoryRouter.get('/:id/themes', getCategoryThemes);

// ConnectGo staff only routes
categoryRouter.post('/', authorize, isConnectGoStaff(), createCategory);
categoryRouter.put('/:id', authorize, isConnectGoStaff(), updateCategory);
categoryRouter.delete('/:id', authorize, isConnectGoStaff(), archiveCategory);
categoryRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreCategory);
categoryRouter.delete('/:id/permanent', authorize, isConnectGoStaff(), deleteCategory);

export default categoryRouter;