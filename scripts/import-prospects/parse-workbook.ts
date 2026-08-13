import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { normalizeWorkbookBuffer } from './normalize-workbook-xml';
import type { ParsedRow } from './types';

export const MASTER_SHEET = 'All Evidence Leads';
export const SUPPRESSION_SHEET = 'Prior 50 Exclusion';

const HEADER_TO_KEY: Record<string, keyof ParsedRow> = {
  'Queue ID': 'queueId',
  'Lead Status': 'leadStatus',
  'Country': 'country',
  'Region': 'region',
  'Segment': 'segment',
  'Company': 'company',
  'Website': 'website',
  'CMU/Emory Lead Person': 'leadPerson',
  'Lead Title': 'leadTitle',
  'School': 'school',
  'Alumni Path': 'alumniPath',
  'Evidence URL': 'evidenceUrl',
  'Evidence Summary': 'evidenceSummary',
  'Headcount': 'headcount',
  'Headcount Status': 'headcountStatus',
  'Qualification Status': 'qualificationStatus',
  'Direct Email': 'directEmail',
  'Direct Email Status': 'directEmailStatus',
  'Company LinkedIn / Lookup': 'companyLinkedInLookup',
  'Alumni Evidence Search': 'alumniEvidenceSearch',
  'Target Person Search': 'targetPersonSearch',
  'Target Role': 'targetRole',
  'Recommended AI Workflow': 'recommendedAiWorkflow',
  'LinkedIn Connection Note': 'linkedInConnectionNote',
  'Connection Note Characters': 'connectionNoteCharacters',
  'LinkedIn Follow-up': 'linkedInFollowUp',
  'Cold Email Subject': 'coldEmailSubject',
  'Cold Email': 'coldEmail',
  'Owner': 'owner',
  'Status': 'status',
  'Notes': 'notes',
};

const cellText = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value) return String(value.result ?? '').trim();
  if (typeof value === 'object' && 'richText' in value) {
    return (value.richText as { text: string }[]).map((part) => part.text).join('').trim();
  }
  return String(value).trim();
};

const readSheet = async (filePath: string, sheetName: string) => {
  const workbook = new ExcelJS.Workbook();
  const raw = await readFile(filePath);
  const normalized = await normalizeWorkbookBuffer(raw);
  await workbook.xlsx.load(normalized);
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found in ${filePath}`);
  return sheet;
};

export const parseWorkbook = async (filePath: string): Promise<ParsedRow[]> => {
  const sheet = await readSheet(filePath, MASTER_SHEET);
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).map(cellText);

  const rows: ParsedRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as ExcelJS.CellValue[];
    const parsed = {} as ParsedRow;

    for (const key of Object.values(HEADER_TO_KEY)) parsed[key] = '';

    headers.forEach((header, index) => {
      const key = HEADER_TO_KEY[header];
      if (key) parsed[key] = cellText(values[index]);
    });

    if (parsed.queueId) rows.push(parsed);
  });

  return rows;
};

export const parseSuppressionList = async (
  filePath: string,
): Promise<{ name: string; reason: string }[]> => {
  const sheet = await readSheet(filePath, SUPPRESSION_SHEET);
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).map(cellText);
  const nameIndex = headers.indexOf('Company');
  const ruleIndex = headers.indexOf('Rule');

  const suppressed: { name: string; reason: string }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as ExcelJS.CellValue[];
    const name = cellText(values[nameIndex]);
    if (name) suppressed.push({ name, reason: cellText(values[ruleIndex]) });
  });

  return suppressed;
};
