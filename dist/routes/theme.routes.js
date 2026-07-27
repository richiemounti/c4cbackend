"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/theme.routes.ts
const express_1 = require("express");
const theme_controller_1 = require("../controllers/theme.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const themeRouter = (0, express_1.Router)();
// Public routes
themeRouter.get('/', theme_controller_1.getThemes);
themeRouter.get('/:id', theme_controller_1.getTheme);
themeRouter.get('/:id/subthemes', theme_controller_1.getThemeSubThemes);
// ConnectGo staff only routes
themeRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), theme_controller_1.createTheme);
themeRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), theme_controller_1.updateTheme);
themeRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), theme_controller_1.archiveTheme);
themeRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), theme_controller_1.restoreTheme);
themeRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), theme_controller_1.deleteTheme);
exports.default = themeRouter;
//# sourceMappingURL=theme.routes.js.map