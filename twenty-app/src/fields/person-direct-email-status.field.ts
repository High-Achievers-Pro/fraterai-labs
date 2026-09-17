import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PERSON_DIRECT_EMAIL_STATUS_FIELD_ID } from '../constants/universal-identifiers';

export enum DirectEmailStatus {
  ENRICHMENT_REQUIRED = 'ENRICHMENT_REQUIRED',
  FOUND = 'FOUND',
  NOT_FOUND = 'NOT_FOUND',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
}

export default defineField({
  universalIdentifier: PERSON_DIRECT_EMAIL_STATUS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'directEmailStatus',
  label: 'Direct email status',
  icon: 'IconMail',
  defaultValue: `'${DirectEmailStatus.ENRICHMENT_REQUIRED}'`,
  options: [
    { id: '8967e4b6-845e-4b33-936b-61f91e26b905', value: DirectEmailStatus.ENRICHMENT_REQUIRED, label: 'Enrichment required', position: 0, color: 'gray' },
    { id: '68dc7687-60e5-4f00-8f61-ce309a6dbcbf', value: DirectEmailStatus.FOUND, label: 'Found', position: 1, color: 'green' },
    { id: 'a8cdf4f7-a859-444e-9cf4-e5250ed9ece0', value: DirectEmailStatus.NOT_FOUND, label: 'Not found', position: 2, color: 'orange' },
    { id: 'da60fc99-6f88-438d-851a-0465a66d0ab5', value: DirectEmailStatus.LOW_CONFIDENCE, label: 'Low confidence', position: 3, color: 'yellow' },
  ],
});
