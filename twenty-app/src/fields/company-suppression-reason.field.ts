import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { COMPANY_SUPPRESSION_REASON_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMPANY_SUPPRESSION_REASON_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'suppressionReason',
  label: 'Suppression reason',
  icon: 'IconBan',
});
