"use strict";
// scripts/migrate2_subthemes.ts
//
// Step 2 of 3 — Two phases:
//   Phase A: Fix orphaned subthemes (theme = null) by name-matching them to the CSV
//   Phase B: Insert subthemes missing from the DB entirely
//
// Reads from _all.csv so no rows are filtered out.
// Idempotent — skips subthemes that already exist and are correctly linked.
// Run AFTER migrate1_themes.ts so all 45 themes are present.
//
// Usage:
//   npx ts-node scripts/migrate2_subthemes.ts                    → dry run
//   npx ts-node scripts/migrate2_subthemes.ts --apply            → write
//   npx ts-node scripts/migrate2_subthemes.ts --apply --only=fix → only fix orphans
//   npx ts-node scripts/migrate2_subthemes.ts --apply --only=add → only add missing
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
const theme_model_1 = __importDefault(require("../models/theme.model"));
const subtheme_model_1 = __importDefault(require("../models/subtheme.model"));
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
const CREATOR_ID = new mongoose_1.default.Types.ObjectId('69de4f3869452296f6d0ac98');
const SUBTHEMES_CSV = path_1.default.join(__dirname, '../data/knowledgebase/Private & Shared 2/Sub-theme library 30a60bfb014e80fdbf3dca01d7f171b3_all.csv');
// ─── helpers ─────────────────────────────────────────────────────────────────
function mapToCStageSubTheme(raw) {
    const s = raw.trim();
    if (s.startsWith('1:'))
        return 'Stage 1 - Output';
    if (s.startsWith('2:'))
        return 'Stage 2 - Outcome';
    return null;
}
function mapSubThemeStatus(raw) {
    if (raw.trim().toLowerCase().includes('published to site'))
        return 'published';
    return 'draft';
}
function extractThemeName(raw) {
    const match = raw.match(/^(.+?)\s*\(https?:\/\//);
    if (match)
        return match[1].trim();
    return raw.trim();
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
// ─── Phase A: fix orphaned subthemes ─────────────────────────────────────────
function fixOrphans(dryRun, csvRows, themeMap) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        console.log('\n' + '═'.repeat(60));
        console.log('PHASE A — Fix Orphaned Subthemes (theme = null)');
        console.log('═'.repeat(60));
        // Find all subthemes in DB with no theme attached
        const orphans = yield subtheme_model_1.default.find({ $or: [{ theme: null }, { theme: { $exists: false } }] }).lean();
        console.log(`  Found ${orphans.length} orphaned subthemes in DB`);
        if (orphans.length === 0) {
            console.log('  Nothing to fix.');
            return;
        }
        // Build name → CSV row lookup
        const csvByName = new Map();
        for (const row of csvRows) {
            const name = (_a = row['Sub-theme name']) === null || _a === void 0 ? void 0 : _a.trim();
            if (name)
                csvByName.set(name, row);
        }
        let fixed = 0, notFound = 0, noTheme = 0;
        for (const orphan of orphans) {
            const csvRow = csvByName.get(orphan.name);
            if (!csvRow) {
                console.warn(`  ⚠️   No CSV row found for orphan: "${orphan.name}"`);
                notFound++;
                continue;
            }
            const rawThemeCell = (_c = (_b = csvRow['Theme database']) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
            const themeName = rawThemeCell ? extractThemeName(rawThemeCell) : '';
            const themeId = themeMap.get(themeName);
            if (!themeId) {
                console.warn(`  ⚠️   Theme not in DB for orphan "${orphan.name}" → theme: "${themeName}"`);
                noTheme++;
                continue;
            }
            if (dryRun) {
                console.log(`  🔍  Would fix: "${orphan.name}" → theme: "${themeName}"`);
            }
            else {
                yield subtheme_model_1.default.findByIdAndUpdate(orphan._id, { theme: themeId });
                console.log(`  ✅  Fixed: "${orphan.name}" → theme: "${themeName}"`);
            }
            fixed++;
        }
        console.log(`\n  Summary: ${fixed} ${dryRun ? 'would be fixed' : 'fixed'}, ${notFound} CSV row missing, ${noTheme} theme not found in DB`);
    });
}
// ─── Phase B: insert missing subthemes ───────────────────────────────────────
function addMissing(dryRun, csvRows, themeMap) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        console.log('\n' + '═'.repeat(60));
        console.log('PHASE B — Add Missing Subthemes');
        console.log('═'.repeat(60));
        let inserted = 0, skipped = 0, errors = 0, unmatched = 0;
        for (const row of csvRows) {
            const name = (_a = row['Sub-theme name']) === null || _a === void 0 ? void 0 : _a.trim();
            if (!name)
                continue;
            const rawThemeCell = (_c = (_b = row['Theme database']) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
            const themeName = rawThemeCell ? extractThemeName(rawThemeCell) : '';
            const themeId = themeMap.get(themeName);
            if (!themeId) {
                console.warn(`  ⚠️   "${name}" — theme not matched: "${themeName}"`);
                unmatched++;
                continue;
            }
            const rawToC = (_e = (_d = row['ToC Stage']) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : '';
            const tocStage = mapToCStageSubTheme(rawToC);
            if (!tocStage) {
                console.warn(`  ⚠️   "${name}" — unsupported ToC stage: "${rawToC}" (skipping)`);
                unmatched++;
                continue;
            }
            const description = ((_f = row['Descriptor']) === null || _f === void 0 ? void 0 : _f.trim()) || undefined;
            const status = mapSubThemeStatus((_g = row['Status']) !== null && _g !== void 0 ? _g : '');
            try {
                const existing = yield subtheme_model_1.default.findOne({ name });
                if (existing) {
                    console.log(`  ⏭️   Already exists: "${name}"`);
                    skipped++;
                    continue;
                }
                if (dryRun) {
                    console.log(`  🔍  Would insert: "${name}" → "${themeName}" [${tocStage}]`);
                    inserted++;
                }
                else {
                    yield subtheme_model_1.default.create({ name, description, theme: themeId, theoryOfChangeStage: tocStage, creator: CREATOR_ID, status, archived: false });
                    console.log(`  ✅  Inserted: "${name}" → "${themeName}"`);
                    inserted++;
                }
            }
            catch (err) {
                console.error(`  ❌  Error on "${name}": ${err.message}`);
                errors++;
            }
        }
        console.log(`\n  Summary: ${inserted} ${dryRun ? 'would be inserted' : 'inserted'}, ${skipped} already existed, ${errors} errors, ${unmatched} skipped (unmatched theme/stage)`);
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
        console.log('MIGRATE 2 — Orphan Fix + Missing Subthemes');
        console.log('═'.repeat(60));
        console.log(`Mode : ${dryRun ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}`);
        console.log(`Scope: ${only !== null && only !== void 0 ? only : 'both phases (A fix + B add)'}\n`);
        yield (0, mongodb_1.connectToDatabase)();
        // Load all themes from DB into a name → id map
        const themes = yield theme_model_1.default.find({}).lean();
        const themeMap = new Map();
        for (const t of themes)
            themeMap.set(t.name, t._id);
        console.log(`  Loaded ${themeMap.size} themes from DB`);
        const csvRows = readCsv(SUBTHEMES_CSV);
        if (!only || only === 'fix') {
            yield fixOrphans(dryRun, csvRows, themeMap);
        }
        if (!only || only === 'add') {
            yield addMissing(dryRun, csvRows, themeMap);
        }
        // Verification
        const total = yield subtheme_model_1.default.countDocuments({ creator: CREATOR_ID });
        const orphaned = yield subtheme_model_1.default.countDocuments({ $or: [{ theme: null }, { theme: { $exists: false } }] });
        console.log(`\n  DB state: ${total} subthemes total, ${orphaned} still orphaned`);
        yield (0, mongodb_1.disconnectFromDatabase)();
        console.log(dryRun ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
    });
}
run().catch(err => { console.error('Fatal:', err); process.exit(1); });
//# sourceMappingURL=migrate2_subthemes.js.map