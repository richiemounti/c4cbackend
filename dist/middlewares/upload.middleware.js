"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
// middlewares/upload.middleware.ts
const multer_1 = __importDefault(require("multer"));
// Set up in-memory storage
const storage = multer_1.default.memoryStorage();
// Configure file filter to restrict file types if needed
const fileFilter = (req, file, cb) => {
    // Accept all files for now
    // You can add restrictions based on mime types
    cb(null, true);
};
// Create upload middleware
exports.upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: fileFilter,
});
//# sourceMappingURL=upload.middleware.js.map