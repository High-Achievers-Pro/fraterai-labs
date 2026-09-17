import { describe, expect, it } from 'vitest';
import { applyLimit, parseLimitArg } from '../import';

describe('parseLimitArg', () => {
  it('returns undefined when --limit is absent', () => {
    expect(parseLimitArg(['node', 'import.ts'])).toBeUndefined();
    expect(parseLimitArg(['node', 'import.ts', '--apply'])).toBeUndefined();
  });

  it('parses a positive integer given as a separate argument', () => {
    expect(parseLimitArg(['node', 'import.ts', '--limit', '12'])).toBe(12);
  });

  it('parses a positive integer given as --limit=N', () => {
    expect(parseLimitArg(['node', 'import.ts', '--limit=12'])).toBe(12);
  });

  it('works alongside other flags in either order', () => {
    expect(parseLimitArg(['node', 'import.ts', '--apply', '--limit', '5'])).toBe(5);
    expect(parseLimitArg(['node', 'import.ts', '--limit', '5', '--suppress'])).toBe(5);
  });

  // Silently falling through to a full run on a bad --limit is the worst
  // failure mode this flag could have on an --apply run, so every malformed
  // shape must throw rather than coerce to some default.
  it('throws on --limit 0', () => {
    expect(() => parseLimitArg(['node', 'import.ts', '--limit', '0'])).toThrow(/positive whole number/);
  });

  it('throws on a negative value', () => {
    expect(() => parseLimitArg(['node', 'import.ts', '--limit', '-5'])).toThrow(/positive whole number/);
  });

  it('throws on a non-numeric value', () => {
    expect(() => parseLimitArg(['node', 'import.ts', '--limit', 'twelve'])).toThrow(/positive whole number/);
  });

  it('throws on a non-integer value', () => {
    expect(() => parseLimitArg(['node', 'import.ts', '--limit', '3.5'])).toThrow(/positive whole number/);
  });

  it('throws when --limit is the last argument with no value', () => {
    expect(() => parseLimitArg(['node', 'import.ts', '--limit'])).toThrow(/positive whole number/);
  });

  it('throws on an empty string via --limit=', () => {
    expect(() => parseLimitArg(['node', 'import.ts', '--limit='])).toThrow(/positive whole number/);
  });

  it('throws on whitespace-only value', () => {
    expect(() => parseLimitArg(['node', 'import.ts', '--limit', '  '])).toThrow(/positive whole number/);
  });
});

describe('applyLimit', () => {
  const rows = [1, 2, 3, 4, 5];

  it('returns all rows unchanged when limit is undefined', () => {
    expect(applyLimit(rows, undefined)).toEqual(rows);
  });

  it('truncates to the first N rows', () => {
    expect(applyLimit(rows, 3)).toEqual([1, 2, 3]);
  });

  it('returns all rows when the limit exceeds the row count', () => {
    expect(applyLimit(rows, 100)).toEqual(rows);
  });

  it('does not mutate the input array', () => {
    const copy = [...rows];
    applyLimit(rows, 2);
    expect(rows).toEqual(copy);
  });
});
