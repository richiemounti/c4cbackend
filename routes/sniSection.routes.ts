// routes/sniSection.routes.ts — mounted at /api/v1/sni/surveys/:surveyId/sections
import { Router } from "express";
import { createSniSection, getSniSections, updateSniSection, archiveSniSection } from "../controllers/sniSection.controller";
import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const sniSectionRouter = Router({ mergeParams: true });

sniSectionRouter.post('/', authorize, isConnectGoStaff(), createSniSection);
sniSectionRouter.get('/', authorize, isConnectGoStaff(), getSniSections);
sniSectionRouter.put('/:id', authorize, isConnectGoStaff(), updateSniSection);
sniSectionRouter.delete('/:id', authorize, isConnectGoStaff(), archiveSniSection);

export default sniSectionRouter;
