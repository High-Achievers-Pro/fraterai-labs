import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PERSON_EVIDENCE_URL_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_EVIDENCE_URL_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.LINKS,
  name: 'evidenceUrl',
  label: 'Evidence URL',
  description: 'The URL proving the alumni claim',
  icon: 'IconLink',
  isNullable: true,
});
