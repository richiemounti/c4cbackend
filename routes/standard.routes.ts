// routes/standard.routes.ts
import { Router } from "express";
import {
  createStandard,
  getStandards,
  getStandard,
  updateStandard,
  archiveStandard,
  restoreStandard
} from "../controllers/standard.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const standardRouter = Router();

// Public routes
standardRouter.get('/', getStandards);
standardRouter.get('/:id', getStandard);

// ConnectGo staff only routes
standardRouter.post('/', authorize, isConnectGoStaff(), createStandard);
standardRouter.put('/:id', authorize, isConnectGoStaff(), updateStandard);
standardRouter.delete('/:id', authorize, isConnectGoStaff(), archiveStandard);
standardRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreStandard);

export default standardRouter;