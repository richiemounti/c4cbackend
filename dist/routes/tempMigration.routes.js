"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/tempMigration.routes.ts (or add to existing routes)
const express_1 = require("express");
const tempMigration_controller_1 = require("../controllers/tempMigration.controller");
const tempMigrationRouter = (0, express_1.Router)();
// Temporary route to fix stakeholder tags
tempMigrationRouter.get('/fix-stakeholder-tags', tempMigration_controller_1.fixStakeholderTags);
exports.default = tempMigrationRouter;
//# sourceMappingURL=tempMigration.routes.js.map