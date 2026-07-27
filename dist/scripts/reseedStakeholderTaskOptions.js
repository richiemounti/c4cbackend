"use strict";
// scripts/reseedStakeholderTaskOptions.ts
// Re-seeds StakeholderTaskOption labels from the constants file.
// Run after any label changes to stakeholderMapping.constants.ts to propagate updates to the DB.
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
const category_model_1 = __importDefault(require("../models/category.model"));
const stakeholderTaskOption_model_1 = __importDefault(require("../models/stakeholderTaskOption.model"));
const stakeholderMapping_constants_1 = require("../constants/stakeholderMapping.constants");
dotenv_1.default.config();
const reseedStakeholderTaskOptions = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, mongodb_1.connectToDatabase)();
        let totalUpdated = 0;
        let totalNotFound = 0;
        for (const [categoryName, taskOptions] of Object.entries(stakeholderMapping_constants_1.CATEGORY_OPTIONS_MAP)) {
            const category = yield category_model_1.default.findOne({ name: categoryName });
            if (!category) {
                console.log(`Category not found in DB: "${categoryName}" — skipping`);
                totalNotFound++;
                continue;
            }
            console.log(`Processing: "${categoryName}" (${category._id})`);
            for (const [taskType, options] of Object.entries(taskOptions)) {
                for (const option of options) {
                    const result = yield stakeholderTaskOption_model_1.default.findOneAndUpdate({ category: category._id, taskType, optionId: option.optionId }, { label: option.label }, { new: true });
                    if (result) {
                        totalUpdated++;
                    }
                    else {
                        console.log(`  No existing record for [${taskType}] "${option.optionId}" — skipping`);
                    }
                }
            }
        }
        console.log(`\nDone. Updated ${totalUpdated} option label(s). Categories not in DB: ${totalNotFound}.`);
        process.exit(0);
    }
    catch (error) {
        console.error('Failed to reseed stakeholder task options:', error);
        process.exit(1);
    }
});
reseedStakeholderTaskOptions();
//# sourceMappingURL=reseedStakeholderTaskOptions.js.map