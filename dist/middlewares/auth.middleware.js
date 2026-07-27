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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
// Use type assertion to help TypeScript understand this is a string
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';
const authorize = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            const error = new Error('Not authorized to access this route');
            error.statusCode = 401;
            throw error;
        }
        // Cast the decoded token to our custom payload type
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = yield user_model_1.default.findById(decoded.userId);
        if (!user) {
            const error = new Error('Not authorized to access this route');
            error.statusCode = 401;
            throw error;
        }
        // Now TypeScript knows req.user exists
        // Cast the user object to the Express.User interface
        req.user = user;
        next();
    }
    catch (error) {
        // Forward to the error middleware
        if (error instanceof Error) {
            const customError = error;
            if (!customError.statusCode) {
                customError.statusCode = 401;
            }
            next(customError);
        }
        else {
            const customError = new Error('Authentication failed');
            customError.statusCode = 401;
            next(customError);
        }
    }
});
exports.default = authorize;
//# sourceMappingURL=auth.middleware.js.map