import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { COMPANY_IS_SUPPRESSED_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMPANY_IS_SUPPRESSED_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.BOOLEAN,
  name: 'isSuppressed',
  label: 'Suppressed',
  defaultValue: false,
  icon: 'IconBan',
});
