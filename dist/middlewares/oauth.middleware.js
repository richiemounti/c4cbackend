"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// middlewares/oauth.middleware.ts
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_microsoft_1 = require("passport-microsoft");
const env_1 = require("../config/env");
const user_model_1 = __importDefault(require("../models/user.model"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Helper function to create a new user from OAuth profile
const createUserFromOAuth = (profile, email) => __awaiter(void 0, void 0, void 0, function* () {
    // Generate a random password for OAuth users
    const salt = yield bcryptjs_1.default.genSalt(10);
    const hashedPassword = yield bcryptjs_1.default.hash(Math.random().toString(36).slice(-8), salt);
    // Create username from display name
    const userName = profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
    // Create new user with manager role by default for OAuth users
    const newUser = new user_model_1.default({
        userName,
        name: profile.displayName,
        email,
        password: hashedPassword,
        // Set manager as default role for OAuth users
        primaryRole: 'manager',
        roles: [{ role: 'manager' }]
    });
    yield newUser.save();
    return newUser;
});
// Configure Google Strategy with proper TypeScript types
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: env_1.env.GOOGLE_CLIENT_ID,
    clientSecret: env_1.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${env_1.env.API_BASE_URL}/auth/google/callback`,
    passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get email from profile
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        if (!email) {
            return done(new Error('No email found in Google profile'));
        }
        // Check if user exists
        let user = yield user_model_1.default.findOne({ email });
        if (user) {
            // User exists, return user
            return done(null, user);
        }
        else {
            // Create new user with manager role
            const newUser = yield createUserFromOAuth(profile, email);
            return done(null, newUser);
        }
    }
    catch (error) {
        return done(error);
    }
})));
// Configure Microsoft Strategy with proper TypeScript types
passport_1.default.use(new passport_microsoft_1.Strategy({
    clientID: env_1.env.MICROSOFT_CLIENT_ID,
    clientSecret: env_1.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: `${env_1.env.API_BASE_URL}/auth/microsoft/callback`,
    scope: ['user.read'],
    tenant: 'common',
    passReqToCallback: true
}, (req, accessToken, refreshToken, profile, // Use our custom interface
done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get email from profile
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        if (!email) {
            return done(new Error('No email found in Microsoft profile'));
        }
        // Check if user exists
        let user = yield user_model_1.default.findOne({ email });
        if (user) {
            // User exists, return user
            return done(null, user);
        }
        else {
            // Create new user with manager role
            const newUser = yield createUserFromOAuth(profile, email);
            return done(null, newUser);
        }
    }
    catch (error) {
        return done(error);
    }
})));
// Serialize and Deserialize User with proper TypeScript types
passport_1.default.serializeUser((user, done) => {
    done(null, user._id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield user_model_1.default.findById(id);
        if (!user) {
            return done(new Error('User not found'));
        }
        done(null, user);
    }
    catch (error) {
        done(error, null);
    }
}));
exports.default = passport_1.default;
//# sourceMappingURL=oauth.middleware.js.map