import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { COMPANY_COUNTRY_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMPANY_COUNTRY_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'country',
  label: 'Country',
  description: 'Country from prospect research',
  icon: 'IconFlag',
});
