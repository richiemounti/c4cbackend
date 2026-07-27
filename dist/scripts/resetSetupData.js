"use strict";
// scripts/resetSetupData.ts
// Deletes all ProjectSetup and ProjectSiteSetup documents so they get
// re-initialized from the TaskTemplate on next GET request.
// Run AFTER seedSetupTasks.ts to pick up the correct questions from CSV.
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
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("../database/mongodb");
const projectSetupTask_model_1 = __importDefault(require("../models/projectSetupTask.model"));
const projectSiteSetupTask_model_1 = __importDefault(require("../models/projectSiteSetupTask.model"));
dotenv_1.default.config();
const resetSetupData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, mongodb_1.connectToDatabase)();
        const projectResult = yield projectSetupTask_model_1.default.deleteMany({});
        console.log(`Deleted ${projectResult.deletedCount} ProjectSetup document(s)`);
        const siteResult = yield projectSiteSetupTask_model_1.default.deleteMany({});
        console.log(`Deleted ${siteResult.deletedCount} ProjectSiteSetup document(s)`);
        console.log('Done. Setup documents will be re-initialized from the TaskTemplate on next load.');
        process.exit(0);
    }
    catch (error) {
        console.error('Failed to reset setup data:', error);
        process.exit(1);
    }
});
resetSetupData();
//# sourceMappingURL=resetSetupData.js.map