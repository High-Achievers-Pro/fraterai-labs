import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PROSPECT_OBJECT_ID, PROSPECT_PERSON_FIELD_ID, PERSON_PROSPECTS_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PROSPECT_PERSON_FIELD_ID,
  objectUniversalIdentifier: PROSPECT_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'person',
  label: 'Person',
  icon: 'IconUser',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: PERSON_PROSPECTS_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'personId',
  },
});
