import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PERSON_SCHOOL_FIELD_ID } from '../constants/universal-identifiers';

export enum School {
  CMU = 'CMU',
  EMORY = 'EMORY',
}

export default defineField({
  universalIdentifier: PERSON_SCHOOL_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'school',
  label: 'School',
  icon: 'IconSchool',
  isNullable: true,
  options: [
    { id: '7d8c1d02-ca18-4e6d-9bea-6670f1b77519', value: School.CMU, label: 'CMU', position: 0, color: 'blue' },
    { id: '65c50a03-231e-4ee8-883d-7e0de843a73a', value: School.EMORY, label: 'Emory', position: 1, color: 'purple' },
  ],
});
