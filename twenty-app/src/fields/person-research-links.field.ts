import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PERSON_RESEARCH_LINKS_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_RESEARCH_LINKS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.LINKS,
  name: 'researchLinks',
  label: 'Research links',
  description:
    'Google search URLs from the research sheet — not verified profile URLs',
  icon: 'IconSearch',
  isNullable: true,
});
