import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
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

/**
 * The real prospects workbook (unlike ExcelJS-authored fixtures) is exported by a
 * tool that emits namespace-prefixed OOXML elements (`<x:workbook>`, `<x:sheet>`,
 * `<x:worksheet>`, ...) and defines Excel Table objects via `<tableParts>`.
 * ExcelJS's SAX-based reader only recognizes unprefixed element names: it silently
 * fails to build the sheet list (`model.sheets` stays undefined, crashing in
 * `xlsx.js`) and, once the prefix is stripped, throws again while reconciling
 * Table objects (`worksheet.js: tables[table.name] = t`) because it can't resolve
 * this file's `<tableParts>` relationships either. Neither issue touches cell
 * values, shared strings, or row data - both are purely structural/namespace
 * quirks in how the source tool serialized the file - so we normalize the zip's
 * XML parts before handing the buffer to ExcelJS: strip the `x:` element prefix
 * and drop `<tableParts>` (Excel Table UI metadata this importer doesn't use).
 * This is a no-op for well-formed ExcelJS-authored files (e.g. the test fixture),
 * which have neither pattern. Verified against the real workbook to reproduce the
 * exact acceptance numbers (see Step 6 in the task brief).
 */
const normalizeWorkbookBuffer = async (buffer: Buffer): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(buffer);
  const xmlEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && (entry.name.endsWith('.xml') || entry.name.endsWith('.rels')),
  );

  for (const entry of xmlEntries) {
    const original = await entry.async('string');
    const normalized = original
      .replace(/<x:/g, '<')
      .replace(/<\/x:/g, '</')
      .replace(/xmlns:x=/g, 'xmlns=')
      .replace(/<tableParts[^>]*>.*?<\/tableParts>/gs, '')
      .replace(/<tableParts[^>]*\/>/g, '');
    if (normalized !== original) zip.file(entry.name, normalized);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
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
