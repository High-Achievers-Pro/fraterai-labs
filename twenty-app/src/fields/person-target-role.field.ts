import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PERSON_TARGET_ROLE_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_TARGET_ROLE_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'targetRole',
  label: 'Target role',
  icon: 'IconBriefcase',
});
