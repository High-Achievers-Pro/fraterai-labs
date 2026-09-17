import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { COMPANY_HEADCOUNT_STATUS_FIELD_ID } from '../constants/universal-identifiers';

export enum HeadcountStatus {
  NEEDS_VERIFICATION = 'NEEDS_VERIFICATION',
  LIKELY_STARTUP = 'LIKELY_STARTUP',
  VERIFIED_IN_ICP = 'VERIFIED_IN_ICP',
  VERIFIED_OUTSIDE_ICP = 'VERIFIED_OUTSIDE_ICP',
}

export default defineField({
  universalIdentifier: COMPANY_HEADCOUNT_STATUS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  type: FieldType.SELECT,
  name: 'headcountStatus',
  label: 'Headcount status',
  description: 'ICP is 50-500 employees',
  icon: 'IconUsers',
  defaultValue: `'${HeadcountStatus.NEEDS_VERIFICATION}'`,
  options: [
    { id: '6a0bc14c-00a9-459e-bce0-b94e1c40a364', value: HeadcountStatus.NEEDS_VERIFICATION, label: 'Needs verification', position: 0, color: 'gray' },
    { id: '216d008d-c609-406e-90aa-2a13933118a3', value: HeadcountStatus.LIKELY_STARTUP, label: 'Likely startup', position: 1, color: 'yellow' },
    { id: '8c842960-8da1-417a-980d-f407b1b99629', value: HeadcountStatus.VERIFIED_IN_ICP, label: 'Verified in ICP', position: 2, color: 'green' },
    { id: '284e83ae-e199-4666-9f7b-6efc363f7902', value: HeadcountStatus.VERIFIED_OUTSIDE_ICP, label: 'Verified outside ICP', position: 3, color: 'red' },
  ],
});
