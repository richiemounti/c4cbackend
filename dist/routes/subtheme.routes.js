"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/subtheme.routes.ts
const express_1 = require("express");
const subtheme_controller_1 = require("../controllers/subtheme.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const subThemeRouter = (0, express_1.Router)();
// Public routes
subThemeRouter.get('/', subtheme_controller_1.getSubThemes);
subThemeRouter.get('/available-tags', subtheme_controller_1.getAvailableTags); // Add this line
subThemeRouter.get('/:id', subtheme_controller_1.getSubTheme);
subThemeRouter.get('/:id/questions', subtheme_controller_1.getSubThemeQuestions);
// ConnectGo staff only routes
subThemeRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), subtheme_controller_1.createSubTheme);
subThemeRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), subtheme_controller_1.updateSubTheme);
subThemeRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), subtheme_controller_1.archiveSubTheme);
subThemeRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), subtheme_controller_1.restoreSubTheme);
subThemeRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), subtheme_controller_1.deleteSubTheme);
exports.default = subThemeRouter;
//# sourceMappingURL=subtheme.routes.js.map