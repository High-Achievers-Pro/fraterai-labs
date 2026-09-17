import { defineView, ViewType } from 'twenty-sdk/define';
import {
  PROSPECT_OBJECT_ID,
  PROSPECT_QUEUE_ID_FIELD_ID,
  PROSPECT_COMPANY_FIELD_ID,
  PROSPECT_PERSON_FIELD_ID,
  PROSPECT_STAGE_FIELD_ID,
  PROSPECT_LEAD_SOURCE_FIELD_ID,
  PROSPECT_OWNER_FIELD_ID,
  PROSPECT_RECOMMENDED_AI_WORKFLOW_FIELD_ID,
  PROSPECT_PIPELINE_VIEW_ID,
  PROSPECT_PIPELINE_VIEW_FIELD_QUEUE_ID_ID,
  PROSPECT_PIPELINE_VIEW_FIELD_COMPANY_ID,
  PROSPECT_PIPELINE_VIEW_FIELD_PERSON_ID,
  PROSPECT_PIPELINE_VIEW_FIELD_STAGE_ID,
  PROSPECT_PIPELINE_VIEW_FIELD_LEAD_SOURCE_ID,
  PROSPECT_PIPELINE_VIEW_FIELD_OWNER_ID,
  PROSPECT_PIPELINE_VIEW_FIELD_RECOMMENDED_AI_WORKFLOW_ID,
  PROSPECT_PIPELINE_GROUP_SOURCED_ID,
  PROSPECT_PIPELINE_GROUP_EVIDENCE_VERIFIED_ID,
  PROSPECT_PIPELINE_GROUP_ICP_QUALIFIED_ID,
  PROSPECT_PIPELINE_GROUP_ENRICHED_ID,
  PROSPECT_PIPELINE_GROUP_OUTREACH_DRAFTED_ID,
  PROSPECT_PIPELINE_GROUP_CONTACTED_ID,
  PROSPECT_PIPELINE_GROUP_ENGAGED_ID,
  PROSPECT_PIPELINE_GROUP_CONVERTED_ID,
  PROSPECT_PIPELINE_GROUP_DISQUALIFIED_ID,
} from '../constants/universal-identifiers';
import { ProspectStage } from '../objects/prospect.object';

// Kanban view over Prospect, grouped by stage. `queueId` is the visible
// label identifier — `name` is deliberately excluded (see the comment block
// in `prospect.object.ts`: Twenty auto-creates an unused `name` TEXT field
// on every custom object and it cannot be suppressed from the manifest).
export default defineView({
  universalIdentifier: PROSPECT_PIPELINE_VIEW_ID,
  name: 'Pipeline',
  objectUniversalIdentifier: PROSPECT_OBJECT_ID,
  type: ViewType.KANBAN,
  icon: 'IconLayoutKanban',
  position: 0,
  mainGroupByFieldMetadataUniversalIdentifier: PROSPECT_STAGE_FIELD_ID,
  fields: [
    { universalIdentifier: PROSPECT_PIPELINE_VIEW_FIELD_QUEUE_ID_ID, fieldMetadataUniversalIdentifier: PROSPECT_QUEUE_ID_FIELD_ID, position: 0, isVisible: true, size: 150 },
    { universalIdentifier: PROSPECT_PIPELINE_VIEW_FIELD_COMPANY_ID, fieldMetadataUniversalIdentifier: PROSPECT_COMPANY_FIELD_ID, position: 1, isVisible: true, size: 180 },
    { universalIdentifier: PROSPECT_PIPELINE_VIEW_FIELD_PERSON_ID, fieldMetadataUniversalIdentifier: PROSPECT_PERSON_FIELD_ID, position: 2, isVisible: true, size: 180 },
    { universalIdentifier: PROSPECT_PIPELINE_VIEW_FIELD_STAGE_ID, fieldMetadataUniversalIdentifier: PROSPECT_STAGE_FIELD_ID, position: 3, isVisible: true, size: 150 },
    { universalIdentifier: PROSPECT_PIPELINE_VIEW_FIELD_LEAD_SOURCE_ID, fieldMetadataUniversalIdentifier: PROSPECT_LEAD_SOURCE_FIELD_ID, position: 4, isVisible: true, size: 150 },
    { universalIdentifier: PROSPECT_PIPELINE_VIEW_FIELD_OWNER_ID, fieldMetadataUniversalIdentifier: PROSPECT_OWNER_FIELD_ID, position: 5, isVisible: true, size: 150 },
    { universalIdentifier: PROSPECT_PIPELINE_VIEW_FIELD_RECOMMENDED_AI_WORKFLOW_ID, fieldMetadataUniversalIdentifier: PROSPECT_RECOMMENDED_AI_WORKFLOW_FIELD_ID, position: 6, isVisible: true, size: 200 },
  ],
  groups: [
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_SOURCED_ID, fieldValue: ProspectStage.SOURCED, position: 0, isVisible: true },
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_EVIDENCE_VERIFIED_ID, fieldValue: ProspectStage.EVIDENCE_VERIFIED, position: 1, isVisible: true },
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_ICP_QUALIFIED_ID, fieldValue: ProspectStage.ICP_QUALIFIED, position: 2, isVisible: true },
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_ENRICHED_ID, fieldValue: ProspectStage.ENRICHED, position: 3, isVisible: true },
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_OUTREACH_DRAFTED_ID, fieldValue: ProspectStage.OUTREACH_DRAFTED, position: 4, isVisible: true },
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_CONTACTED_ID, fieldValue: ProspectStage.CONTACTED, position: 5, isVisible: true },
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_ENGAGED_ID, fieldValue: ProspectStage.ENGAGED, position: 6, isVisible: true },
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_CONVERTED_ID, fieldValue: ProspectStage.CONVERTED, position: 7, isVisible: true },
    { universalIdentifier: PROSPECT_PIPELINE_GROUP_DISQUALIFIED_ID, fieldValue: ProspectStage.DISQUALIFIED, position: 8, isVisible: true },
  ],
});
