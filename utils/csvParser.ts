// utils/csvParser.ts
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface CSVSetupTask {
  fieldName: string;
  isRequired: boolean;
  dataType: string;
  description: string;
  userFacingCopy: string;
  fieldLabel: string;
  helperText: string;
  hoverText: string;
}

/**
 * Parse CSV file and extract setup tasks (legacy helper — kept for compatibility).
 */
export const parseCSVFile = (filePath: string): CSVSetupTask[] => {
  const fileContent = fs.readFileSync(path.resolve(filePath), { encoding: 'utf-8' });
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
  return records.map((record: any) => ({
    fieldName:      record['Field Name'],
    isRequired:     /^required/i.test((record['Suggested validation'] || record['Compulsory?'] || '').trim()),
    dataType:       mapDataType(record['Data Type']),
    description:    record['Description'] || '',
    userFacingCopy: record['User-facing copy'] || '',
    fieldLabel:     record['Question'] || record['Field Label'] || '',
    helperText:     record['Helper text'] || record['Helper Text'] || '',
    hoverText:      record['Hover Text'] || record['Hover Text:'] || '',
  }));
};

/**
 * Map raw CSV data-type strings to the model enum values.
 *
 * Handles both the old sheet ("string", "boolean", "array"…) and the new
 * Youth Impact sheet ("Short text", "Single select (enum)", "Yes / No"…).
 */
const mapDataType = (csvDataType: string): string => {
  const type = (csvDataType || '').toLowerCase().trim();

  // string variants
  if (
    type === 'string' || type === 'text' || type === 'varchar' ||
    type === 'short text' || type === 'long text' ||
    type.startsWith('short text') ||       // "Short text (string)", "Short text (max 300…)"
    type.startsWith('long text') ||        // "long text, max 600–900 chars"
    type.startsWith('string (') ||
    type.startsWith('single select') ||    // "Single select (enum)", "Single select (country list)", "Single select or taggable select"
    type.startsWith('structured short text') // "Structured short text. three separate short fields…"
  ) return 'string';

  // number variants
  if (
    type === 'number' || type === 'integer' || type === 'float' || type === 'decimal'
  ) return 'number';

  // boolean variants
  if (
    type === 'boolean' || type === 'bool' ||
    type === 'yes / no' || type === 'yes/no' ||
    type.startsWith('boolean (yes')        // "Boolean (Yes / No)"
  ) return 'boolean';

  // date
  if (type === 'date') return 'date';

  // array / multi-select variants
  if (
    type === 'array' || type === 'list' || type === 'enum' ||
    type.startsWith('multi-select') ||     // "Multi-select (enum)", "Multi-select (same enum as…)"
    type.startsWith('multi select') ||     // "Multi select (enum), with a taggable…"
    type.startsWith('array[')
  ) return 'array';

  // object / json variants
  if (
    type === 'object' || type === 'json' ||
    type.startsWith('json') ||
    type.startsWith('string or object') ||
    type.startsWith('structured object')   // "Structured object (map barrier → Low / Medium / High)"
  ) return 'object';

  // file variants
  if (type === 'file' || type === 'image' || type === 'document') return 'file';

  return 'string';
};

/**
 * Parse the options from the "Response options" cell.
 *
 * Handles two formats found in the new CSV:
 *   • Newline-separated list (multi-select fields)
 *   • Pipe-separated single line  (e.g. "Low | Medium | High")
 *
 * Strips meta-notes such as "(reuse project …)" and "Add new (add tag)".
 */
const parseOptions = (rawOptions: string): string[] | undefined => {
  if (!rawOptions || !rawOptions.trim()) return undefined;

  const text = rawOptions.trim();

  // Pipe-separated on a single line → split by pipe
  if (text.includes('|') && !text.includes('\n')) {
    const opts = text.split('|').map(s => s.trim()).filter(Boolean);
    if (opts.length > 1) return opts;
  }

  // Newline-separated list
  const lines = text.split(/\r?\n|\r/);
  const filtered = lines
    .map(l => l.trim())
    .filter(l =>
      l.length > 0 &&
      !l.startsWith('(reuse') &&
      !l.startsWith('Response options:') &&
      !/^add new/i.test(l)    // "Add new (add tag)", "Add new <Taggable select>"
    );

  return filtered.length > 0 ? filtered : undefined;
};

/**
 * Strip parenthetical annotations that appear in field names on the new sheet.
 * e.g. "site_access_differs_from_project (Yes/No)" → "site_access_differs_from_project"
 */
const cleanFieldName = (raw: string): string =>
  raw
    .replace(/\s*\(Yes\/No\)/gi, '')
    .replace(/\s*\(editable;[^)]*\)/gi, '')
    .replace(/\s*\(optional\)/gi, '')
    .replace(/\s*\(short text\)/gi, '')
    .trim();

/**
 * Returns true for rows that are structural headers / explanatory text, not field rows.
 * These should be skipped (or used to update step context) but never turned into tasks.
 */
const isNonFieldRow = (fieldName: string): boolean => {
  if (!fieldName) return true;
  if (fieldName === 'Field Name') return true;           // header row
  if (/^[A-D]\.\s+/.test(fieldName)) return true;       // "A. Access", "B. Safeguarding" subsections
  if (/^If\s+(Yes|No):/i.test(fieldName)) return true;  // "If Yes:"
  if (/^\d+\.\s+/.test(fieldName)) return true;         // "1. Core Principle" explanatory rows
  return false;
};

/**
 * Attempts to parse a Step or Section header row.
 * Returns { stepNumber, stepLabel } if matched, null otherwise.
 *
 * Matches:
 *   "Step 3 — Clarify the challenge"
 *   "Section 2 — Access and Safeguarding Delta"
 *   "Golden Circle synthesis"  (treated as a named sub-section within the current step)
 */
const parseStepHeader = (
  fieldName: string,
  currentStepNumber: number
): { stepNumber: number; stepLabel: string } | null => {
  // "Step N — Label"
  const stepMatch = fieldName.match(/^Step\s+(\d+)\s*[—–-]+\s*(.+)/i);
  if (stepMatch) {
    return { stepNumber: parseInt(stepMatch[1], 10), stepLabel: stepMatch[2].trim() };
  }

  // "Section N — Label"
  const sectionMatch = fieldName.match(/^Section\s+(\d+)\s*[—–-]+\s*(.+)/i);
  if (sectionMatch) {
    return { stepNumber: parseInt(sectionMatch[1], 10), stepLabel: sectionMatch[2].trim() };
  }

  // "Golden Circle synthesis" — keep the current step number, update label only
  if (/^Golden Circle/i.test(fieldName)) {
    return { stepNumber: currentStepNumber, stepLabel: 'Golden Circle synthesis' };
  }

  return null;
};

/**
 * Convert raw CSV data (string[][]) to an array of task objects ready for DB insertion.
 *
 * New column layout (Youth Impact sheets):
 *   0  Field Name
 *   1  Suggested validation   → drives isRequired ("Required" substring match)
 *   2  Data Type
 *   3  Question               → fieldLabel
 *   4  Response options       → options
 *   5  Helper text
 *   6  Hover Text
 *   7  Conditional On         → conditionalOn.fieldName  (site CSV only, optional)
 *
 * Special behaviour:
 *   • Step / Section header rows update the running step context and are skipped.
 *   • "Golden Circle synthesis" keeps the current stepNumber but updates stepLabel.
 *   • "top_learning_questions" is expanded into three separate tasks:
 *     learning_question_1, learning_question_2, learning_question_3.
 *
 * @param csvData   Raw CSV parsed as string[][]  (including header row at index 0)
 * @param isProjectSite  true → step = 2 (site form); false → step = 1 (project form)
 */
export const convertCSVDataToSetupTasks = (
  csvData: string[][],
  isProjectSite = false
): any[] => {
  const tasks: any[] = [];
  let currentStepNumber = 0;
  let currentStepLabel = '';
  let sortOrder = 0;

  // Skip the header row (index 0)
  const dataRows = csvData.slice(1);

  for (const row of dataRows) {
    const rawFieldName = (row[0] || '').trim();

    // Empty row — skip
    if (!rawFieldName) continue;

    // Check for step / section header rows first
    const stepHeader = parseStepHeader(rawFieldName, currentStepNumber);
    if (stepHeader) {
      currentStepNumber = stepHeader.stepNumber;
      currentStepLabel  = stepHeader.stepLabel;
      continue;
    }

    // Skip other non-field structural rows
    if (isNonFieldRow(rawFieldName)) continue;

    // --- Parse columns ---
    const fieldName        = cleanFieldName(rawFieldName);
    const validation       = (row[1] || '').trim();
    const dataType         = mapDataType(row[2] || '');
    const question         = (row[3] || '').trim();
    const responseOptions  = (row[4] || '').trim();
    const helperText       = (row[5] || '').trim();
    const hoverText        = (row[6] || '').trim();
    const conditionalOnRef = (row[7] || '').trim(); // site CSV only

    const isRequired = /^required/i.test(validation);
    const options    = parseOptions(responseOptions);

    const conditionalOn = conditionalOnRef
      ? { fieldName: conditionalOnRef, value: true }
      : undefined;

    // Special case: expand top_learning_questions into three separate tasks
    if (fieldName === 'top_learning_questions') {
      for (let i = 1; i <= 3; i++) {
        sortOrder++;
        const lqTask: any = {
          fieldName:   `learning_question_${i}`,
          dataType:    'string',
          fieldLabel:  `Learning question ${i}`,
          helperText:  helperText || 'List up to three priority learning questions for the next phase.',
          hoverText:   hoverText  || 'Clear learning questions guide analysis and ensure insights are decision-relevant.',
          isRequired:  false,
          sortOrder,
          step:        isProjectSite ? 2 : 1,
          stepNumber:  currentStepNumber,
          stepLabel:   currentStepLabel,
          isCompleted: false,
        };
        tasks.push(lqTask);
      }
      continue;
    }

    // Build standard task object
    sortOrder++;
    const task: any = {
      fieldName,
      dataType,
      fieldLabel:  question,
      helperText,
      hoverText,
      isRequired,
      sortOrder,
      step:        isProjectSite ? 2 : 1,
      stepNumber:  currentStepNumber,
      stepLabel:   currentStepLabel,
      isCompleted: false,
    };

    if (options && options.length > 0) task.options = options;
    if (conditionalOn) task.conditionalOn = conditionalOn;

    tasks.push(task);
  }

  return tasks;
};

// ---------------------------------------------------------------------------
// Legacy helpers (kept for any existing callers outside the seed script)
// ---------------------------------------------------------------------------

export const loadProjectSetupTasks = (): CSVSetupTask[] => {
  const filePath = path.join(__dirname, '../data/Set_Up_Your_Project_final.csv');
  return parseCSVFile(filePath);
};

export const loadProjectSiteSetupTasks = (): CSVSetupTask[] => {
  const filePath = path.join(__dirname, '../data/Set_Up_Your_Sites_final.csv');
  return parseCSVFile(filePath);
};

export const mapCSVTasksToSchema = (tasks: CSVSetupTask[], step: number): any[] =>
  tasks.map((task, index) => {
    const mapped: any = {
      fieldName:      task.fieldName,
      dataType:       task.dataType,
      description:    task.description,
      userFacingCopy: task.userFacingCopy,
      fieldLabel:     task.fieldLabel,
      helperText:     task.helperText,
      hoverText:      task.hoverText,
      isRequired:     true,
      sortOrder:      index + 1,
      step,
      isCompleted:    false,
    };
    if ((task as any).options?.length) mapped.options = (task as any).options;
    return mapped;
  });
