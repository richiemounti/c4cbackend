// routes/tempMigration.routes.ts (or add to existing routes)
import { Router } from "express";
import { fixStakeholderTags } from "../controllers/tempMigration.controller";
import authorize from "../middlewares/auth.middleware"; // Optional: remove if you want to test without auth

const tempMigrationRouter = Router();

// Temporary route to fix stakeholder tags
tempMigrationRouter.get('/fix-stakeholder-tags', fixStakeholderTags);

export default tempMigrationRouter;