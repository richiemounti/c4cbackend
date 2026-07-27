"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/oauth.routes.ts
const express_1 = require("express");
const oauth_middleware_1 = __importDefault(require("../middlewares/oauth.middleware"));
const oauth_controller_1 = require("../controllers/oauth.controller");
const oauthRouter = (0, express_1.Router)();
// Google OAuth routes
oauthRouter.get('/google', (req, res, next) => {
    oauth_middleware_1.default.authenticate('google', {
        scope: ['profile', 'email'],
        state: req.query.state ? req.query.state.toString() : undefined
    })(req, res, next);
});
oauthRouter.get('/google/callback', oauth_middleware_1.default.authenticate('google', { session: false, failureRedirect: '/login?error=Google+authentication+failed' }), oauth_controller_1.googleCallback);
// Microsoft OAuth routes
oauthRouter.get('/microsoft', (req, res, next) => {
    oauth_middleware_1.default.authenticate('microsoft', {
        scope: ['user.read'],
        state: req.query.state ? req.query.state.toString() : undefined
    })(req, res, next);
});
oauthRouter.get('/microsoft/callback', oauth_middleware_1.default.authenticate('microsoft', { session: false, failureRedirect: '/login?error=Microsoft+authentication+failed' }), oauth_controller_1.microsoftCallback);
exports.default = oauthRouter;
//# sourceMappingURL=oauth.routes.js.map