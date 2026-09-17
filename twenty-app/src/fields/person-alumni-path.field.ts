import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PERSON_ALUMNI_PATH_FIELD_ID } from '../constants/universal-identifiers';

// Deliberately only two options even though the source sheet holds 27 distinct
// variants. Task 10's normalizer collapses them by prefix — every variant
// begins with either "Decision-maker" (166 rows) or "Referral" (86 rows) — so
// this enum does not enumerate the observed strings.
export enum AlumniPath {
  DECISION_MAKER = 'DECISION_MAKER',
  REFERRAL = 'REFERRAL',
}

export default defineField({
  universalIdentifier: PERSON_ALUMNI_PATH_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'alumniPath',
  label: 'Alumni path',
  icon: 'IconRoute',
  isNullable: true,
  options: [
    { id: '1a6fdeba-9f55-406f-9966-4225a15e770d', value: AlumniPath.DECISION_MAKER, label: 'Decision-maker', position: 0, color: 'green' },
    { id: '71885ae4-4ea6-4653-9550-3fc54d62c4eb', value: AlumniPath.REFERRAL, label: 'Referral', position: 1, color: 'blue' },
  ],
});
