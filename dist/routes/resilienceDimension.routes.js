"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/resilienceDimension.routes.ts
const express_1 = require("express");
const resilienceDimension_controller_1 = require("../controllers/resilienceDimension.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const resilienceDimensionRouter = (0, express_1.Router)();
// Public routes
resilienceDimensionRouter.get('/', resilienceDimension_controller_1.getResilienceDimensions);
resilienceDimensionRouter.get('/categories', resilienceDimension_controller_1.getResilienceCategories); // New route for categories
resilienceDimensionRouter.get('/:id', resilienceDimension_controller_1.getResilienceDimension);
// ConnectGo staff only routes
resilienceDimensionRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), resilienceDimension_controller_1.createResilienceDimension);
resilienceDimensionRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), resilienceDimension_controller_1.updateResilienceDimension);
resilienceDimensionRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), resilienceDimension_controller_1.archiveResilienceDimension);
resilienceDimensionRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), resilienceDimension_controller_1.restoreResilienceDimension);
exports.default = resilienceDimensionRouter;
//# sourceMappingURL=resilienceDimension.routes.js.map