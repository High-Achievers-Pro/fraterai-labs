import { describe, expect, it } from 'vitest';
import { buildOwnerLookup, resolveOwners } from '../resolve-owners';
import type { WorkspaceMember } from '../resolve-owners';

const member = (over: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  id: 'wm-1', name: { firstName: 'Seth', lastName: 'Surname' }, ...over,
});

describe('buildOwnerLookup', () => {
  it('keys on both first name and full name, case-insensitively', () => {
    const lookup = buildOwnerLookup([member()]);
    expect(lookup.get('seth')).toBe('wm-1');
    expect(lookup.get('seth surname')).toBe('wm-1');
    expect(lookup.get('SETH')).toBeUndefined(); // lookup keys are pre-normalized, not the input
  });

  it('normalizes a trailing space in a real member firstName', () => {
    // The live workspace's sole member is recorded as firstName "Miguel  "
    // (trailing space) — the exact case this importer must not choke on.
    const lookup = buildOwnerLookup([
      { id: 'wm-2', name: { firstName: 'Miguel  ', lastName: 'Twahirwa' } },
    ]);
    expect(lookup.get('miguel')).toBe('wm-2');
    expect(lookup.get('miguel twahirwa')).toBe('wm-2');
  });
});

describe('resolveOwners', () => {
  it('matches an informal first name against a member with a surname', () => {
    const result = resolveOwners(['Seth', ' Seth ', 'Seth'], [member()]);
    expect(result.ownerIdByOwnerText.get('Seth')).toBe('wm-1');
    // Repeats and surrounding whitespace collapse to one distinct owner text.
    expect(result.ownerIdByOwnerText.size).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it('treats differently-cased owner text as distinct strings but resolves both', () => {
    const result = resolveOwners(['Seth', 'SETH'], [member()]);
    expect(result.ownerIdByOwnerText.get('Seth')).toBe('wm-1');
    expect(result.ownerIdByOwnerText.get('SETH')).toBe('wm-1');
    expect(result.lines).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it('matches a full name directly', () => {
    const result = resolveOwners(['Seth Surname'], [member()]);
    expect(result.ownerIdByOwnerText.get('Seth Surname')).toBe('wm-1');
  });

  it('falls back to the sole workspace member when there is no name match', () => {
    const result = resolveOwners(['Seth'], [
      { id: 'wm-solo', name: { firstName: 'Miguel  ', lastName: 'Twahirwa' } },
    ]);
    expect(result.ownerIdByOwnerText.get('Seth')).toBe('wm-solo');
    expect(result.warnings).toEqual([]);
    expect(result.lines[0]).toContain('fell back to the sole workspace member');
  });

  it('warns and leaves the owner unresolved when there are multiple members and no match', () => {
    const result = resolveOwners(['Ghost'], [
      { id: 'wm-a', name: { firstName: 'Alice', lastName: 'A' } },
      { id: 'wm-b', name: { firstName: 'Bob', lastName: 'B' } },
    ]);
    expect(result.ownerIdByOwnerText.get('Ghost')).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Ghost');
  });

  it('does not fall back when there are zero workspace members', () => {
    const result = resolveOwners(['Seth'], []);
    expect(result.ownerIdByOwnerText.get('Seth')).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
  });

  it('ignores blank owner strings', () => {
    const result = resolveOwners(['', '   ', 'Seth'], [member()]);
    expect(result.ownerIdByOwnerText.size).toBe(1);
    expect(result.ownerIdByOwnerText.has('')).toBe(false);
  });

  it('prefers a direct match over the single-member fallback', () => {
    // With exactly one member who *does* match by name, resolution should
    // go through the direct-match branch, not the fallback branch — this
    // pins the branch order so a refactor cannot quietly swap them.
    const result = resolveOwners(['Seth'], [member()]);
    expect(result.lines[0]).toContain('matched workspace member');
    expect(result.lines[0]).not.toContain('fell back');
  });
});
