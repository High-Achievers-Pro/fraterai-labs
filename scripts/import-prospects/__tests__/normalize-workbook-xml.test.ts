import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { normalizeWorkbookBuffer } from '../normalize-workbook-xml';

const buildZip = async (files: Record<string, string>): Promise<Buffer> => {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
};

const readEntry = async (buffer: Buffer, name: string): Promise<string> => {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(name);
  if (!entry) throw new Error(`Entry "${name}" not found in normalized zip`);
  return entry.async('string');
};

describe('normalizeWorkbookBuffer', () => {
  it('strips the x: namespace prefix from opening and closing tags', async () => {
    // Mirrors the real prospects.xlsx export style: every element prefixed with x:.
    const xml =
      '<?xml version="1.0" encoding="utf-8"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheets><x:sheet name="All Evidence Leads" sheetId="2" r:id="R1" /></x:sheets></x:workbook>';
    const buffer = await buildZip({ 'xl/workbook.xml': xml });

    const normalized = await readEntry(await normalizeWorkbookBuffer(buffer), 'xl/workbook.xml');

    expect(normalized).not.toContain('x:');
    expect(normalized).toContain(
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    );
    expect(normalized).toContain('<sheets>');
    expect(normalized).toContain('<sheet name="All Evidence Leads" sheetId="2" r:id="R1" />');
    expect(normalized).toContain('</sheets>');
    expect(normalized).toContain('</workbook>');
  });

  it('removes a <tableParts> block entirely, including its children, leaving row data intact', async () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1"><x:v>1</x:v></x:c></x:row></x:sheetData><x:tableParts count="1"><x:tablePart r:id="R6cb69a0389cf4105" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" /></x:tableParts></x:worksheet>';
    const buffer = await buildZip({ 'xl/worksheets/sheet2.xml': xml });

    const normalized = await readEntry(
      await normalizeWorkbookBuffer(buffer),
      'xl/worksheets/sheet2.xml',
    );

    expect(normalized).not.toContain('tableParts');
    expect(normalized).not.toContain('tablePart');
    expect(normalized).toContain('<sheetData>');
    expect(normalized).toContain('<row r="1">');
    expect(normalized).toContain('<v>1</v>');
    expect(normalized).toContain('</worksheet>');
  });

  it('leaves well-formed, unprefixed XML with no <tableParts> unchanged (no-op path)', async () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>';
    const buffer = await buildZip({ 'xl/worksheets/sheet1.xml': xml });

    const normalized = await readEntry(
      await normalizeWorkbookBuffer(buffer),
      'xl/worksheets/sheet1.xml',
    );

    expect(normalized).toBe(xml);
  });
});
