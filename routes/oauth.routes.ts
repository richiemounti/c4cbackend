// routes/oauth.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import passport from "../middlewares/oauth.middleware";
import { googleCallback, microsoftCallback } from "../controllers/oauth.controller";

const oauthRouter = Router();

// Google OAuth routes
oauthRouter.get('/google', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: req.query.state ? req.query.state.toString() : undefined
  })(req, res, next);
});

oauthRouter.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=Google+authentication+failed' }),
  googleCallback
);

// Microsoft OAuth routes
oauthRouter.get('/microsoft', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('microsoft', {
    scope: ['user.read'],
    state: req.query.state ? req.query.state.toString() : undefined
  })(req, res, next);
});

oauthRouter.get('/microsoft/callback', 
  passport.authenticate('microsoft', { session: false, failureRedirect: '/login?error=Microsoft+authentication+failed' }),
  microsoftCallback
);

export default oauthRouter;