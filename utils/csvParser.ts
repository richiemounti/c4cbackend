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
 * Parse CSV file and extract setup tasks
 * @param filePath Path to the CSV file
 * @returns Array of parsed tasks
 */
export const parseCSVFile = (filePath: string): CSVSetupTask[] => {
  try {
    // Read the CSV file
    const fileContent = fs.readFileSync(path.resolve(filePath), { encoding: 'utf-8' });
    
    // Parse the CSV content
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Transform the records to our expected format
    return records.map((record: any) => ({
      fieldName:    record['Field Name'],
      isRequired:   (record['Compulsory?'] || '').trim().toLowerCase() === 'yes',
      dataType:     mapDataType(record['Data Type']),
      description:  record['Description'],
      userFacingCopy: record['User-facing copy'],
      fieldLabel:   record['Field Label'],
      helperText:   record['Helper Text'],
      hoverText:    record['Hover Text']
    }));
  } catch (error) {
    console.error('Error parsing CSV file:', error);
    throw error;
  }
};

/**
 * Map CSV data types to our standard data types.
 * Handles both simple types (string, number, boolean…) and the more
 * descriptive variants that come out of the Excel planning sheet
 * (e.g. "Multi-select string", "Integer", "JSON or structured object").
 * @param csvDataType Data type from CSV
 * @returns Standardized data type matching the model enum
 */
const mapDataType = (csvDataType: string): string => {
  const type = (csvDataType || '').toLowerCase().trim();

  // string variants
  if (
    type === 'string' || type === 'text' || type === 'varchar' ||
    type.startsWith('string (')   // e.g. "String (taggable)", "String (enum or taggable)"
  ) return 'string';

  // number variants
  if (
    type === 'number' || type === 'integer' || type === 'float' || type === 'decimal'
  ) return 'number';

  // boolean
  if (type === 'boolean' || type === 'bool') return 'boolean';

  // date
  if (type === 'date') return 'date';

  // array / multi-select variants
  if (
    type === 'array' || type === 'list' || type === 'enum' ||
    type.startsWith('multi-select') ||          // e.g. "Multi-select string", "Multi-select (taggable)"
    type.startsWith('array[')                   // e.g. "Array[String] (taggable)"
  ) return 'array';

  // object / json variants
  if (
    type === 'object' || type === 'json' ||
    type.startsWith('json') ||                  // e.g. "JSON or structured object"
    type.startsWith('string or object')         // e.g. "String or object (Lat/Long)"
  ) return 'object';

  // file variants
  if (type === 'file' || type === 'image' || type === 'document') return 'file';

  return 'string'; // safe default
};

/**
 * Load default project setup tasks from CSV
 * @returns Array of project setup tasks
 */
export const loadProjectSetupTasks = (): CSVSetupTask[] => {
  const filePath = path.join(__dirname, '../data/Set_Up_Your_Project.csv');
  return parseCSVFile(filePath);
};

/**
 * Load default project site setup tasks from CSV
 * @returns Array of project site setup tasks
 */
export const loadProjectSiteSetupTasks = (): CSVSetupTask[] => {
  const filePath = path.join(__dirname, '../data/Set_up_your_sites.csv');
  return parseCSVFile(filePath);
};

/**
 * Map CSV task to database schema
 * @param tasks Array of CSV tasks
 * @param step Step number (1 for project, 2 for site)
 * @returns Mapped tasks ready for database insertion
 */
export const mapCSVTasksToSchema = (
  tasks: CSVSetupTask[],
  step: number
): any[] => {
  return tasks.map((task, index) => {
    const mappedTask: any = {
      fieldName: task.fieldName,
      dataType: task.dataType,
      description: task.description,
      userFacingCopy: task.userFacingCopy,
      fieldLabel: task.fieldLabel,
      helperText: task.helperText,
      hoverText: task.hoverText,
      isRequired: true, // Adjust if needed
      sortOrder: index + 1,
      step,
      isCompleted: false
    };

    // Only include options if they exist
    if ((task as any).options && Array.isArray((task as any).options)) {
      mappedTask.options = (task as any).options;
    }

    return mappedTask;
  });
};



/**
 * Convert raw CSV data to setup tasks.
 *
 * Expected CSV column order (updated):
 *   0  Field Name
 *   1  Compulsory?        ← new column; drives isRequired
 *   2  Data Type
 *   3  Description
 *   4  User-facing copy
 *   5  Field Label
 *   6  Helper Text
 *   7  Hover Text
 *
 * @param csvData Raw CSV data as array of rows (including header row)
 * @param isProjectSite Whether this is for project sites (step 2) or projects (step 1)
 * @returns Parsed setup tasks ready for database insertion
 */
export const convertCSVDataToSetupTasks = (
  csvData: string[][],
  isProjectSite = false
): any[] => {
  // Skip header row
  const dataRows = csvData.slice(1);

  return dataRows.map((row, index) => {
    const fieldName     = row[0] || '';
    const compulsory    = (row[1] || '').trim().toLowerCase();
    const dataType      = mapDataType(row[2]);
    const description   = row[3] || '';
    const userFacingCopy = row[4] || '';
    const fieldLabel    = row[5] || '';
    const helperText    = row[6] || '';
    const hoverText     = row[7] || '';

    // "Yes" → required; anything else (No, empty, unknown) → optional
    const isRequired = compulsory === 'yes';

    let options: string[] | undefined = undefined;

    // For array fields, parse options from description (newline-separated list items)
    if (dataType === 'array' && description) {
      const splitDescription = description.split(/\r?\n|\r/);

      const parsedOptions = splitDescription.filter(line => {
        const trimmed = line.trim();
        return (
          trimmed.length > 0 &&
          /^[A-Z0-9"'\-–]/.test(trimmed) // starts with capital letter, number, dash, en-dash, or quote
        );
      });

      if (parsedOptions.length > 1) {
        options = parsedOptions.map(option => option.trim().replace(/^["']|["']$/g, ''));
      }
    }

    return {
      fieldName,
      dataType,
      description,
      userFacingCopy,
      fieldLabel,
      helperText,
      hoverText,
      isRequired,
      sortOrder: index + 1,
      step: isProjectSite ? 2 : 1,
      isCompleted: false,
      ...(options ? { options } : {})
    };
  });
};
