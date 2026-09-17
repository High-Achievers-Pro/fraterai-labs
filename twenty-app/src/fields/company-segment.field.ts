import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { COMPANY_SEGMENT_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMPANY_SEGMENT_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'segment',
  label: 'Segment',
  description: 'Industry segment from prospect research',
  icon: 'IconCategory',
});
