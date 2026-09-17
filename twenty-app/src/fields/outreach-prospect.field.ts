import { defineField, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';
import {
  OUTREACH_OBJECT_ID,
  OUTREACH_PROSPECT_FIELD_ID,
  PROSPECT_OBJECT_ID,
  PROSPECT_OUTREACHES_FIELD_ID,
} from '../constants/universal-identifiers';

// NOTE — deviation from the task-5 brief's example code: the brief showed
// `export const outreachOnProspect = defineField({...}); export default
// outreachOnProspect;`. That two-step pattern is invisible to the CLI's
// manifest builder: `npx twenty plan` silently discovered zero standalone
// fields (verified via .twenty/output/manifest.json — top-level `fields: []`
// and no RELATION field on either object) with no error or warning. Once
// this file was changed to `export default defineField({...})` directly
// (matching how .object.ts files are written), both this field and its
// reverse (`prospect-outreaches.field.ts`) were picked up correctly and the
// plan diff grew from 51 to 56 items as expected. Keep standalone field
// files as a single `export default defineField(...)` statement.
export default defineField({
  universalIdentifier: OUTREACH_PROSPECT_FIELD_ID,
  objectUniversalIdentifier: OUTREACH_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'prospect',
  label: 'Prospect',
  icon: 'IconTargetArrow',
  relationTargetObjectMetadataUniversalIdentifier: PROSPECT_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PROSPECT_OUTREACHES_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'prospectId',
  },
});
