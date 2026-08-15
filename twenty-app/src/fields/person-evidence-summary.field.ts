import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PERSON_EVIDENCE_SUMMARY_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_EVIDENCE_SUMMARY_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'evidenceSummary',
  label: 'Evidence summary',
  icon: 'IconNotes',
});
