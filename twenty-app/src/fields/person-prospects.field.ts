import { defineField, FieldType, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PROSPECT_OBJECT_ID, PROSPECT_PERSON_FIELD_ID, PERSON_PROSPECTS_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PERSON_PROSPECTS_FIELD_ID,
  objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'prospects',
  label: 'Prospects',
  icon: 'IconTargetArrow',
  relationTargetObjectMetadataUniversalIdentifier: PROSPECT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROSPECT_PERSON_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
