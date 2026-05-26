// routes/resilienceDimension.routes.ts
import { Router } from "express";
import {
  createResilienceDimension,
  getResilienceDimensions,
  getResilienceDimension,
  updateResilienceDimension,
  getResilienceCategories,
  archiveResilienceDimension,
  restoreResilienceDimension
} from "../controllers/resilienceDimension.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const resilienceDimensionRouter = Router();

// Public routes
resilienceDimensionRouter.get('/', getResilienceDimensions);
resilienceDimensionRouter.get('/categories', getResilienceCategories); // New route for categories
resilienceDimensionRouter.get('/:id', getResilienceDimension);

// ConnectGo staff only routes
resilienceDimensionRouter.post('/', authorize, isConnectGoStaff(), createResilienceDimension);
resilienceDimensionRouter.put('/:id', authorize, isConnectGoStaff(), updateResilienceDimension);
resilienceDimensionRouter.delete('/:id', authorize, isConnectGoStaff(), archiveResilienceDimension);
resilienceDimensionRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreResilienceDimension);

export default resilienceDimensionRouter;