"use strict";
// scripts/migrate3_indicators.ts
//
// Step 3 of 3 — Two phases:
//   Phase A: Insert the ~66 indicators missing from the DB
//   Phase B: Re-run indicator → subtheme linking ($addToSet, safe to re-run)
//
// Reads from _all.csv so no rows are filtered out.
// Idempotent — skips indicators that already exist by name.
// Run AFTER migrate2_subthemes.ts so all subthemes are present.
//
// Usage:
//   npx ts-node scripts/migrate3_indicators.ts                        → dry run
//   npx ts-node scripts/migrate3_indicators.ts --apply                → write
//   npx ts-node scripts/migrate3_indicators.ts --apply --only=add     → only insert
//   npx ts-node scripts/migrate3_indicators.ts --apply --only=link    → only re-link
//   npx ts-node scripts/migrate3_indicators.ts --only=verify
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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const indicator_model_1 = __importDefault(require("../models/indicator.model"));
const subtheme_model_1 = __importDefault(require("../models/subtheme.model"));
const theme_model_1 = __importDefault(require("../models/theme.model"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
const CREATOR_ID = new mongoose_1.default.Types.ObjectId('69de4f3869452296f6d0ac98');
const INDICATORS_CSV = path_1.default.join(__dirname, '../data/knowledgebase/Private & Shared/Indicator Development (SMART Log) 30a60bfb014e806f8e3adb04271bfcdf_all.csv');
// ─── helpers ─────────────────────────────────────────────────────────────────
function extractName(raw) {
    return raw.replace(/\s*\(https?:\/\/[^)]+\)/g, '').trim();
}
function parseEvidence(raw) {
    if (!(raw === null || raw === void 0 ? void 0 : raw.trim()))
        return null;
    const externalUrls = [];
    const sourceNames = [];
    const entries = raw.split(/,\s*(?=[A-Z\u00C0-\u024F])/);
    for (const entry of entries) {
        const urlMatch = entry.match(/\((https?:\/\/[^)]+)\)/);
        if (urlMatch) {
            const url = urlMatch[1].trim();
            if (!url.includes('notion.so'))
                externalUrls.push(url);
        }
        const name = entry.replace(/\s*\(https?:\/\/[^)]+\)/g, '').trim();
        if (name)
            sourceNames.push(name);
    }
    const source = sourceNames.join('; ');
    if (!source && externalUrls.length === 0)
        return null;
    return { source: source.substring(0, 1000), url: externalUrls };
}
function readCsv(filePath) {
    let content = fs_1.default.readFileSync(filePath, 'utf-8');
    if (content.charCodeAt(0) === 0xfeff)
        content = content.slice(1);
    const rows = (0, sync_1.parse)(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
    });
    console.log(`  CSV loaded: ${rows.length} rows`);
    return rows;
}
// ─── Phase A: insert missing indicators ──────────────────────────────────────
function addMissingIndicators(dryRun, csvRows) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        console.log('\n' + '═'.repeat(60));
        console.log('PHASE A — Add Missing Indicators');
        console.log('═'.repeat(60));
        const indicatorMap = new Map();
        // Pre-populate map with everything already in DB
        const existing = yield indicator_model_1.default.find({}).lean();
        for (const ind of existing)
            indicatorMap.set(ind.name, ind._id);
        console.log(`  Found ${existing.length} existing indicators in DB`);
        let inserted = 0, skipped = 0, errors = 0;
        for (const row of csvRows) {
            const name = (_a = row['Indicator statement']) === null || _a === void 0 ? void 0 : _a.trim();
            if (!name)
                continue;
            if (indicatorMap.has(name)) {
                skipped++;
                continue;
            }
            const description = ((_b = row['Indicator descriptor']) === null || _b === void 0 ? void 0 : _b.trim()) || undefined;
            const evidence = parseEvidence((_c = row['Indicator sources']) !== null && _c !== void 0 ? _c : '');
            const label = name.length > 80 ? name.substring(0, 77) + '...' : name;
            try {
                if (dryRun) {
                    console.log(`  🔍  Would insert: "${label}"`);
                    indicatorMap.set(name, new mongoose_1.default.Types.ObjectId());
                    inserted++;
                }
                else {
                    const ind = yield indicator_model_1.default.create({
                        name, description, evidence: evidence !== null && evidence !== void 0 ? evidence : null,
                        creator: CREATOR_ID, status: 'active', archived: false,
                    });
                    indicatorMap.set(name, ind._id);
                    console.log(`  ✅  Inserted: "${label}"`);
                    inserted++;
                }
            }
            catch (err) {
                console.error(`  ❌  Error on "${label}": ${err.message}`);
                errors++;
            }
        }
        console.log(`\n  Summary: ${inserted} ${dryRun ? 'would be inserted' : 'inserted'}, ${skipped} already existed, ${errors} errors`);
        return indicatorMap;
    });
}
// ─── Phase B: link indicators → subthemes ────────────────────────────────────
function linkIndicators(dryRun, csvRows, indicatorMap) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        console.log('\n' + '═'.repeat(60));
        console.log('PHASE B — Link Indicators → Subthemes');
        console.log('═'.repeat(60));
        // Build subThemeName → Set<indicatorId>
        const subThemeToIndicators = new Map();
        for (const row of csvRows) {
            const indicatorName = (_a = row['Indicator statement']) === null || _a === void 0 ? void 0 : _a.trim();
            if (!indicatorName)
                continue;
            const indicatorId = indicatorMap.get(indicatorName);
            if (!indicatorId)
                continue;
            const rawCell = (_b = row['Sub-themes']) === null || _b === void 0 ? void 0 : _b.trim();
            if (!rawCell)
                continue;
            const subThemeName = extractName(rawCell);
            if (!subThemeName)
                continue;
            if (!subThemeToIndicators.has(subThemeName))
                subThemeToIndicators.set(subThemeName, new Set());
            subThemeToIndicators.get(subThemeName).add(indicatorId.toString());
        }
        let linked = 0, missing = 0;
        for (const [subThemeName, idSet] of subThemeToIndicators.entries()) {
            const subTheme = yield subtheme_model_1.default.findOne({ name: subThemeName });
            if (!subTheme) {
                console.warn(`  ⚠️   SubTheme not found: "${subThemeName}"`);
                missing++;
                continue;
            }
            const ids = Array.from(idSet).map(id => new mongoose_1.default.Types.ObjectId(id));
            if (dryRun) {
                console.log(`  🔍  Would link ${ids.length} indicator(s) → "${subThemeName}"`);
            }
            else {
                yield subtheme_model_1.default.updateOne({ _id: subTheme._id }, { $addToSet: { indicatorTags: { $each: ids } } });
                console.log(`  ✅  Linked ${ids.length} indicator(s) → "${subThemeName}"`);
            }
            linked++;
        }
        console.log(`\n  Summary: ${linked} subthemes ${dryRun ? 'would be updated' : 'updated'}, ${missing} subthemes not found`);
    });
}
// ─── Phase C: verify ─────────────────────────────────────────────────────────
function verify() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n' + '═'.repeat(60));
        console.log('VERIFY');
        console.log('═'.repeat(60));
        const themes = yield theme_model_1.default.countDocuments({ creator: CREATOR_ID });
        const subthemes = yield subtheme_model_1.default.countDocuments({ creator: CREATOR_ID });
        const orphans = yield subtheme_model_1.default.countDocuments({ $or: [{ theme: null }, { theme: { $exists: false } }] });
        const indicators = yield indicator_model_1.default.countDocuments({ creator: CREATOR_ID });
        const linked = yield subtheme_model_1.default.countDocuments({ creator: CREATOR_ID, indicatorTags: { $exists: true, $not: { $size: 0 } } });
        console.log(`  Themes              : ${themes}`);
        console.log(`  Subthemes           : ${subthemes} (${orphans} orphaned)`);
        console.log(`  Indicators          : ${indicators}`);
        console.log(`  Subthemes w/ links  : ${linked}`);
    });
}
// ─── main ─────────────────────────────────────────────────────────────────────
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const args = process.argv.slice(2);
        const dryRun = !args.includes('--apply');
        const only = (_a = args.find(a => a.startsWith('--only='))) === null || _a === void 0 ? void 0 : _a.split('=')[1];
        console.log('═'.repeat(60));
        console.log('MIGRATE 3 — Missing Indicators + Re-link');
        console.log('═'.repeat(60));
        console.log(`Mode : ${dryRun ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}`);
        console.log(`Scope: ${only !== null && only !== void 0 ? only : 'both phases (A add + B link)'}\n`);
        yield (0, mongodb_1.connectToDatabase)();
        const csvRows = readCsv(INDICATORS_CSV);
        let indicatorMap = new Map();
        if (!only || only === 'add') {
            indicatorMap = yield addMissingIndicators(dryRun, csvRows);
        }
        if (!only || only === 'link') {
            if (only === 'link') {
                // Running link in isolation — reload from DB
                const all = yield indicator_model_1.default.find({}).lean();
                for (const i of all)
                    indicatorMap.set(i.name, i._id);
                console.log(`  Loaded ${indicatorMap.size} indicators from DB for linking`);
            }
            yield linkIndicators(dryRun, csvRows, indicatorMap);
        }
        if (only === 'verify' || (!dryRun && !only)) {
            yield verify();
        }
        yield (0, mongodb_1.disconnectFromDatabase)();
        console.log(dryRun ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
    });
}
run().catch(err => { console.error('Fatal:', err); process.exit(1); });
//# sourceMappingURL=migrate3_indicators.js.map