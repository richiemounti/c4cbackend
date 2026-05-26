// routes/indicator.routes.ts
import { Router } from "express";
import { 
    createIndicator,
    getIndicators,
    getIndicator,
    updateIndicator,
    archiveIndicator,
    restoreIndicator,
    deleteIndicator
} from "../controllers/indicator.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const indicatorRouter = Router();

// Public routes
indicatorRouter.get('/', getIndicators);
indicatorRouter.get('/:id', getIndicator);

// ConnectGo staff only routes
indicatorRouter.post('/', authorize, isConnectGoStaff(), createIndicator);
indicatorRouter.put('/:id', authorize, isConnectGoStaff(), updateIndicator);
indicatorRouter.delete('/:id', authorize, isConnectGoStaff(), archiveIndicator);
indicatorRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreIndicator);
indicatorRouter.delete('/:id/permanent', authorize, isConnectGoStaff(), deleteIndicator);

export default indicatorRouter;