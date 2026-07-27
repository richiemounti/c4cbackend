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
const arcjet_1 = require("../config/arcjet");
const arcjetMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get the Arcjet instance
        const aj = yield (0, arcjet_1.initArcjet)();
        // Use the instance to protect the request
        const decision = yield aj.protect(req, { requested: 5 });
        if (decision.isDenied()) {
            if (decision.reason.isRateLimit())
                return res.status(429).json({ error: 'Rate limit exceeded' });
            if (decision.reason.isBot())
                return res.status(403).json({ error: 'Bot detected' });
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    }
    catch (error) {
        console.log(` Arcjet Middleware Error: ${error} `);
        next(error);
    }
});
exports.default = arcjetMiddleware;
//# sourceMappingURL=arcjet.middleware.js.map