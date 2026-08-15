import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import {
  PROSPECT_OBJECT_ID, PROSPECT_OWNER_FIELD_ID, WORKSPACE_MEMBER_PROSPECTS_FIELD_ID,
} from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PROSPECT_OWNER_FIELD_ID,
  objectUniversalIdentifier: PROSPECT_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'owner',
  label: 'Owner',
  description: 'The Frater team member responsible for this prospect',
  icon: 'IconUserCircle',
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: WORKSPACE_MEMBER_PROSPECTS_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'ownerId',
  },
});
