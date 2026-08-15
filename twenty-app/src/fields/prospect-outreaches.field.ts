import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import {
  OUTREACH_OBJECT_ID,
  OUTREACH_PROSPECT_FIELD_ID,
  PROSPECT_OBJECT_ID,
  PROSPECT_OUTREACHES_FIELD_ID,
} from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PROSPECT_OUTREACHES_FIELD_ID,
  objectUniversalIdentifier: PROSPECT_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'outreaches',
  label: 'Outreaches',
  icon: 'IconSend',
  relationTargetObjectMetadataUniversalIdentifier: OUTREACH_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: OUTREACH_PROSPECT_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
