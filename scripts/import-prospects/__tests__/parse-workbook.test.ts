import { describe, expect, it } from 'vitest';
import { parseWorkbook, parseSuppressionList } from '../parse-workbook';

const FIXTURE = 'scripts/import-prospects/__tests__/fixtures/mini.xlsx';

describe('parseWorkbook', () => {
  it('reads only the master sheet', async () => {
    const rows = await parseWorkbook(FIXTURE);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.queueId)).toEqual(['EV-001', 'CMU-001']);
  });

  it('maps every column by header name, not position', async () => {
    const [first] = await parseWorkbook(FIXTURE);
    expect(first.company).toBe('Acme Co');
    expect(first.leadPerson).toBe('Ada Lovelace');
    expect(first.school).toBe('Emory');
    expect(first.coldEmailSubject).toBe('Workflow idea for Acme');
    expect(first.owner).toBe('Seth');
  });

  it('returns empty strings rather than undefined for blank cells', async () => {
    const [first] = await parseWorkbook(FIXTURE);
    expect(first.directEmail).toBe('');
    expect(first.headcount).toBe('');
  });

  it('reads the suppression list separately', async () => {
    const suppressed = await parseSuppressionList(FIXTURE);
    expect(suppressed).toEqual([{ name: 'Excluded Corp', reason: 'Exclude from additional list' }]);
  });

  it('throws if the master sheet is missing', async () => {
    await expect(parseWorkbook('scripts/import-prospects/__tests__/fixtures/does-not-exist.xlsx'))
      .rejects.toThrow();
  });
});
