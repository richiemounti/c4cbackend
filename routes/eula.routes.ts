// routes/eula.routes.ts
import { Router } from "express";
import {
  checkEulaStatus,
  signEula,
  getEulaContent,
  getSignatureHistory,
  getAllSignatures,
  revokeSignature,
  getSignatureStatistics
} from "../controllers/eula.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const eulaRouter = Router();

// Public routes
eulaRouter.get('/content', getEulaContent);

// Protected routes (require authentication)
eulaRouter.get('/check', authorize, checkEulaStatus);
eulaRouter.post('/sign', authorize, signEula);
eulaRouter.get('/history', authorize, getSignatureHistory);

// Admin routes (require ConnectGo staff privileges)
eulaRouter.get('/admin/signatures', authorize, isConnectGoStaff(), getAllSignatures);
eulaRouter.put('/admin/signatures/:id/revoke', authorize, isConnectGoStaff(), revokeSignature);
eulaRouter.get('/admin/statistics', authorize, isConnectGoStaff(), getSignatureStatistics);

export default eulaRouter;