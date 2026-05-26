// routes/esgCategory.routes.ts
import { Router } from "express";
import {
  createESGCategory,
  getESGCategories,
  getESGCategory,
  updateESGCategory,
  archiveESGCategory,
  restoreESGCategory
} from "../controllers/esgCategory.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const esgCategoryRouter = Router();

// Public routes
esgCategoryRouter.get('/', getESGCategories);
esgCategoryRouter.get('/:id', getESGCategory);

// ConnectGo staff only routes
esgCategoryRouter.post('/', authorize, isConnectGoStaff(), createESGCategory);
esgCategoryRouter.put('/:id', authorize, isConnectGoStaff(), updateESGCategory);
esgCategoryRouter.delete('/:id', authorize, isConnectGoStaff(), archiveESGCategory);
esgCategoryRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreESGCategory);

export default esgCategoryRouter;