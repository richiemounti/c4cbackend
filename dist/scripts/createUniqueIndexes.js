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
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
function createIndexes() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, mongodb_1.connectToDatabase)();
        const db = mongoose_1.default.connection.db;
        if (!db) {
            console.error('❌ Database connection not established');
            process.exit(1);
        }
        console.log('Checking for duplicates first...');
        const projectDupes = yield db.collection('projectsetups').aggregate([
            { $group: { _id: '$project', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();
        const siteDupes = yield db.collection('projectsitesetups').aggregate([
            { $group: { _id: '$projectSite', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();
        if (projectDupes.length > 0) {
            console.error('❌ Duplicate projectsetups found — fix these before creating index:', projectDupes);
            yield (0, mongodb_1.disconnectFromDatabase)();
            process.exit(1);
        }
        if (siteDupes.length > 0) {
            console.error('❌ Duplicate projectsitesetups found — fix these before creating index:', siteDupes);
            yield (0, mongodb_1.disconnectFromDatabase)();
            process.exit(1);
        }
        console.log('✅ No duplicates found, safe to create indexes\n');
        console.log('Creating unique index on projectsetups...');
        yield db.collection('projectsetups').createIndex({ project: 1 }, { unique: true, name: 'project_1_unique' });
        console.log('✅ projectsetups index created');
        console.log('Creating unique index on projectsitesetups...');
        yield db.collection('projectsitesetups').createIndex({ projectSite: 1 }, { unique: true, name: 'projectSite_1_unique' });
        console.log('✅ projectsitesetups index created');
        console.log('\nVerifying...');
        const projectIndexes = yield db.collection('projectsetups').indexes();
        const siteIndexes = yield db.collection('projectsitesetups').indexes();
        const projectUnique = projectIndexes.find((i) => { var _a; return i.unique && ((_a = i.key) === null || _a === void 0 ? void 0 : _a.project); });
        const siteUnique = siteIndexes.find((i) => { var _a; return i.unique && ((_a = i.key) === null || _a === void 0 ? void 0 : _a.projectSite); });
        console.log(projectUnique ? '✅ projectsetups unique index confirmed' : '❌ projectsetups index not found');
        console.log(siteUnique ? '✅ projectsitesetups unique index confirmed' : '❌ projectsitesetups index not found');
        yield (0, mongodb_1.disconnectFromDatabase)();
    });
}
createIndexes().catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
});
//# sourceMappingURL=createUniqueIndexes.js.map