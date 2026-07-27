"use strict";
// scripts/migrate1_themes.ts
//
// Step 1 of 3 — Adds the 22 themes missing from the DB.
// Reads from the _all.csv (full export) so no rows are filtered out.
// Fully idempotent — skips themes that already exist by name.
//
// Usage:
//   npx ts-node scripts/migrate1_themes.ts           → dry run
//   npx ts-node scripts/migrate1_themes.ts --apply   → write to DB
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
const mongodb_1 = require("../database/mongodb");
dotenv_1.default.config();
const CREATOR_ID = new mongoose_1.default.Types.ObjectId('69de4f3869452296f6d0ac98');
const THEMES_CSV = path_1.default.join(__dirname, '../data/knowledgebase/Private & Shared 3/Themes 30a60bfb014e8041a28dd7477d55e4db_all.csv');
// ─── helpers (identical to seedKnowledgeBase pattern) ────────────────────────
function mapToCStageTheme(raw) {
    const s = raw.trim();
    if (s.startsWith('1:'))
        return 'Stage 1 - Output';
    if (s.startsWith('2:'))
        return 'Stage 2 - Outcome';
    if (s.toLowerCase().includes('both'))
        return 'Both';
    return null;
}
function mapThemeStatus(raw) {
    const s = raw.trim().toLowerCase();
    if (s.includes('published on platform'))
        return 'published';
    if (s.includes('in review'))
        return 'draft';
    return 'draft';
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
// ─── main ─────────────────────────────────────────────────────────────────────
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const args = process.argv.slice(2);
        const dryRun = !args.includes('--apply');
        console.log('═'.repeat(60));
        console.log('MIGRATE 1 — Missing Themes');
        console.log('═'.repeat(60));
        console.log(`Mode: ${dryRun ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}\n`);
        yield (0, mongodb_1.connectToDatabase)();
        const rows = readCsv(THEMES_CSV);
        let inserted = 0, skipped = 0, errors = 0;
        for (const row of rows) {
            const name = (_a = row['Theme Name']) === null || _a === void 0 ? void 0 : _a.trim();
            if (!name)
                continue;
            const description = ((_b = row['Descriptor']) === null || _b === void 0 ? void 0 : _b.trim()) || undefined;
            const tocStage = mapToCStageTheme((_c = row['ToC Stage']) !== null && _c !== void 0 ? _c : '');
            const status = mapThemeStatus((_d = row['Theme Status']) !== null && _d !== void 0 ? _d : '');
            try {
                const existing = yield theme_model_1.default.findOne({ name });
                if (existing) {
                    console.log(`  ⏭️   Already exists: "${name}"`);
                    skipped++;
                    continue;
                }
                if (dryRun) {
                    console.log(`  🔍  Would insert: "${name}" [toc=${tocStage !== null && tocStage !== void 0 ? tocStage : 'null'}, status=${status}]`);
                    inserted++;
                }
                else {
                    yield theme_model_1.default.create({ name, description, theoryOfChangeStage: tocStage, creator: CREATOR_ID, status, archived: false });
                    console.log(`  ✅  Inserted: "${name}"`);
                    inserted++;
                }
            }
            catch (err) {
                console.error(`  ❌  Error on "${name}": ${err.message}`);
                errors++;
            }
        }
        console.log(`\n  Summary: ${inserted} ${dryRun ? 'would be inserted' : 'inserted'}, ${skipped} already existed, ${errors} errors`);
        // Verification
        const total = yield theme_model_1.default.countDocuments({ creator: CREATOR_ID });
        const published = yield theme_model_1.default.countDocuments({ creator: CREATOR_ID, status: 'published' });
        console.log(`\n  DB state: ${total} themes total (${published} published)`);
        yield (0, mongodb_1.disconnectFromDatabase)();
        console.log(dryRun ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
    });
}
run().catch(err => { console.error('Fatal:', err); process.exit(1); });
//# sourceMappingURL=migrate1_themes.js.map