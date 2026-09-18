// controllers/sniExport.controller.ts
// Default export is 3 tables (ego/alter/tie), alter_id-only — no real names,
// per brief §9/§11. Excel format uses one workbook, 3 sheets (exceljs
// supports this natively; the existing platform's own export never exercises
// it since it's always a single flat table — this is genuinely new use of
// the same dependency, not a copy of an existing pattern). CSV format
// exports one table at a time via ?table=.
import { Request, Response, NextFunction } from "express";
import ExcelJS from "exceljs";
import { CustomError } from "../middlewares/error.middleware";
import SniSurvey from "../models/sniSurvey.model";
import { userHasProjectAccess } from "../lib/authHelpers";
import { buildSniExportTables } from "../services/sni/sniExport.service";

function rowsToCsv(rows: Record<string, any>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escape = (cell: any) => {
        const str = String(cell ?? '');
        return /[,\n\r"]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [headers.map(escape).join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => escape(row[h])).join(','));
    }
    return lines.join('\n');
}

function addSheet(workbook: ExcelJS.Workbook, name: string, rows: Record<string, any>[]) {
    const sheet = workbook.addWorksheet(name);
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(headers.map((h) => row[h]));
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => { column.width = 20; });
}

export const exportSniSurveyData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { surveyId } = req.params;
        const format = req.query.format === 'excel' ? 'excel' : 'csv';
        const table = (req.query.table as string) || 'ego';
        const includeTestResponses = req.query.includeTestResponses === 'true';

        const survey = await SniSurvey.findById(surveyId);
        if (!survey) {
            const error = new Error('Survey not found') as CustomError;
            error.statusCode = 404;
            throw error;
        }
        if (survey.isTemplate || !survey.project) {
            const error = new Error('Cannot export a template survey') as CustomError;
            error.statusCode = 400;
            throw error;
        }

        const hasAccess = userHasProjectAccess(req, survey.project.toString());
        if (!hasAccess && !req.user?.isConnectGoStaff) {
            const error = new Error('Not authorized to export this survey') as CustomError;
            error.statusCode = 403;
            throw error;
        }

        const { egoRows, alterRows, tieRows } = await buildSniExportTables(surveyId, { includeTestResponses });

        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            addSheet(workbook, 'Ego', egoRows);
            addSheet(workbook, 'Alter', alterRows);
            addSheet(workbook, 'Tie', tieRows);

            const buffer = await workbook.xlsx.writeBuffer();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sni_export_${surveyId}.xlsx`);
            res.status(200).send(Buffer.from(buffer));
            return;
        }

        const tableRows = table === 'alter' ? alterRows : table === 'tie' ? tieRows : egoRows;
        const csv = rowsToCsv(tableRows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=sni_export_${table}_${surveyId}.csv`);
        res.status(200).send(csv);
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid survey ID format') as CustomError;
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
};
