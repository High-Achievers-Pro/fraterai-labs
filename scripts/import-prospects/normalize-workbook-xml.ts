import JSZip from 'jszip';

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
 * exact acceptance numbers (see Step 6 in the task-9 brief).
 */
export const normalizeWorkbookBuffer = async (buffer: Buffer): Promise<Buffer> => {
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
