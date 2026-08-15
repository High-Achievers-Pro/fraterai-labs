import { defineField, FieldType, OnDeleteAction, RelationType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';
import { PROSPECT_OBJECT_ID, PROSPECT_COMPANY_FIELD_ID, COMPANY_PROSPECTS_FIELD_ID } from '../constants/universal-identifiers';

export default defineField({
  universalIdentifier: PROSPECT_COMPANY_FIELD_ID,
  objectUniversalIdentifier: PROSPECT_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'company',
  label: 'Company',
  icon: 'IconBuildingSkyscraper',
  relationTargetObjectMetadataUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier: COMPANY_PROSPECTS_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'companyId',
  },
});
