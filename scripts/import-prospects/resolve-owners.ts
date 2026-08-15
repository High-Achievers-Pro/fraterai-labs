// Pure owner-name resolution: no network calls in this file. import.ts fetches
// workspace members over the wire and hands the plain records here.
//
// The sheet's `Owner` column is free text ("Seth") written by a human, not a
// foreign key. The live schema's `prospect.owner` is a real relation to
// `workspaceMember`, so every row's owner text has to resolve to a member id
// before the row is applied. Getting this wrong either leaves 252 prospects
// unowned (recoverable — a human can bulk-assign later) or, worse, silently
// assigns the wrong person, which is not something a re-run of the importer
// can detect or fix.

export type WorkspaceMember = {
  id: string;
  name: { firstName: string; lastName: string };
};

export type OwnerResolution = {
  // Keyed on the owner text exactly as trimmed from the sheet (case
  // preserved), so callers can look it up with `row.owner.trim()`.
  ownerIdByOwnerText: Map<string, string | undefined>;
  // Human-readable lines describing how each distinct owner string mapped,
  // in the order first encountered. Meant to be printed verbatim.
  lines: string[];
  // One entry per owner string that could not be resolved to a member and
  // had no fallback available. Non-empty means some prospects will import
  // with no owner set.
  warnings: string[];
};

// Collapses whitespace and case so "Seth", " seth ", and "SETH" all hit the
// same lookup key, and so a workspace member's real name ("Miguel  Twahirwa",
// with the trailing space Twenty stores in firstName) still matches cleanly.
const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

// Keyed on both first name alone and full name, so the sheet's informal
// "Seth" can match a member recorded with a surname ("Seth Surname") without
// requiring the sheet to ever spell out full names.
export const buildOwnerLookup = (members: WorkspaceMember[]): Map<string, string> => {
  const lookup = new Map<string, string>();
  for (const member of members) {
    const first = normalize(member.name.firstName);
    const full = normalize(`${member.name.firstName} ${member.name.lastName}`);
    if (first && !lookup.has(first)) lookup.set(first, member.id);
    if (full && !lookup.has(full)) lookup.set(full, member.id);
  }
  return lookup;
};

export const resolveOwners = (
  ownerTexts: string[],
  members: WorkspaceMember[],
): OwnerResolution => {
  const lookup = buildOwnerLookup(members);
  const distinct = [...new Set(ownerTexts.map((text) => text.trim()).filter(Boolean))];

  const ownerIdByOwnerText = new Map<string, string | undefined>();
  const lines: string[] = [];
  const warnings: string[] = [];

  for (const text of distinct) {
    const direct = lookup.get(normalize(text));
    if (direct) {
      ownerIdByOwnerText.set(text, direct);
      lines.push(`  "${text}" -> matched workspace member ${direct}`);
      continue;
    }

    // Exactly one member in the workspace: every unresolved owner string
    // must mean the same person by informal name, not a genuinely different,
    // unknown owner. A failed 252-row import is worse than one unassigned
    // prospect, so this falls back rather than leaving every row unowned.
    if (members.length === 1) {
      const fallbackId = members[0].id;
      ownerIdByOwnerText.set(text, fallbackId);
      lines.push(
        `  "${text}" -> no name match; fell back to the sole workspace member ${fallbackId}`,
      );
      continue;
    }

    ownerIdByOwnerText.set(text, undefined);
    lines.push(`  "${text}" -> UNMATCHED (no workspace member found; row will import without an owner)`);
    warnings.push(`Owner "${text}" did not match any workspace member — imported without an owner`);
  }

  return { ownerIdByOwnerText, lines, warnings };
};
