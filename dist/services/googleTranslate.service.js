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
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateBatch = exports.translateText = void 0;
// services/googleTranslate.service.ts
const v2_1 = require("@google-cloud/translate/build/src/v2");
const translate = new v2_1.Translate({
    key: process.env.GOOGLE_TRANSLATE_API_KEY
});
const translateText = (text_1, targetLanguage_1, ...args_1) => __awaiter(void 0, [text_1, targetLanguage_1, ...args_1], void 0, function* (text, targetLanguage, sourceLanguage = 'en') {
    if (!(text === null || text === void 0 ? void 0 : text.trim()))
        return text;
    try {
        const [translation] = yield translate.translate(text, {
            from: sourceLanguage,
            to: targetLanguage
        });
        return translation;
    }
    catch (error) {
        console.error(`Translation failed for text: "${text.substring(0, 50)}..."`, error);
        throw new Error(`Google Translate failed: ${error.message}`);
    }
});
exports.translateText = translateText;
const translateBatch = (texts_1, targetLanguage_1, ...args_1) => __awaiter(void 0, [texts_1, targetLanguage_1, ...args_1], void 0, function* (texts, targetLanguage, sourceLanguage = 'en') {
    if (!texts.length)
        return [];
    // Google Translate supports batch requests - filter out empty strings
    const nonEmpty = texts.map((t, i) => ({ text: t, index: i })).filter(t => { var _a; return (_a = t.text) === null || _a === void 0 ? void 0 : _a.trim(); });
    if (!nonEmpty.length)
        return texts;
    const [translations] = yield translate.translate(nonEmpty.map(t => t.text), { from: sourceLanguage, to: targetLanguage });
    // Map back to original positions
    const result = [...texts];
    nonEmpty.forEach((item, i) => {
        result[item.index] = Array.isArray(translations) ? translations[i] : translations;
    });
    return result;
});
exports.translateBatch = translateBatch;
//# sourceMappingURL=googleTranslate.service.js.map