// routes/sdg.routes.ts
import { Router } from "express";
import {
  createSDG,
  getSDGs,
  getSDG,
  updateSDG,
  archiveSDG,
  restoreSDG
} from "../controllers/sdg.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const sdgRouter = Router();

// Public routes
sdgRouter.get('/', getSDGs);
sdgRouter.get('/:id', getSDG);

// ConnectGo staff only routes
sdgRouter.post('/', authorize, isConnectGoStaff(), createSDG);
sdgRouter.put('/:id', authorize, isConnectGoStaff(), updateSDG);
sdgRouter.delete('/:id', authorize, isConnectGoStaff(), archiveSDG);
sdgRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreSDG);

export default sdgRouter;