import { defineObject, FieldType } from 'twenty-sdk/define';
import {
  PROSPECT_OBJECT_ID,
  PROSPECT_QUEUE_ID_FIELD_ID,
  PROSPECT_STAGE_FIELD_ID,
  PROSPECT_LEAD_SOURCE_FIELD_ID,
  PROSPECT_QUALIFICATION_STATUS_FIELD_ID,
  PROSPECT_RECOMMENDED_AI_WORKFLOW_FIELD_ID,
  PROSPECT_DISQUALIFICATION_REASON_FIELD_ID,
  PROSPECT_IMPORT_NOTES_FIELD_ID,
} from '../constants/universal-identifiers';

export enum ProspectStage {
  SOURCED = 'SOURCED',
  EVIDENCE_VERIFIED = 'EVIDENCE_VERIFIED',
  ICP_QUALIFIED = 'ICP_QUALIFIED',
  ENRICHED = 'ENRICHED',
  OUTREACH_DRAFTED = 'OUTREACH_DRAFTED',
  CONTACTED = 'CONTACTED',
  ENGAGED = 'ENGAGED',
  CONVERTED = 'CONVERTED',
  DISQUALIFIED = 'DISQUALIFIED',
}

export enum ProspectLeadSource {
  ALUMNI_EVIDENCE = 'ALUMNI_EVIDENCE',
  CMU_STARTUP = 'CMU_STARTUP',
  INBOUND_WEBSITE = 'INBOUND_WEBSITE',
}

// NOTE — undeclared `name` TEXT field on this object (live-verified 2026-08-14):
// Twenty auto-creates a `name` TEXT field (isSystem: false, label "Name") on every
// custom object. This is unconditional server-side behavior in Twenty's object-
// creation pipeline (`buildNameFlatFieldMetadataForCustomObject`, called from
// `from-create-object-input-to-flat-object-metadata-...util.ts:93-96`), gated only
// by a `createObjectInput.skipNameField === true` flag. That flag is NOT exposed
// on `ObjectManifest` in twenty-sdk 2.31.0 (see `ObjectManifest` in
// `node_modules/twenty-sdk/dist/define/index.d.ts`), so there is no way to
// suppress or remove this field from an app manifest — it cannot be prevented
// here, and it is not a mistake in this file.
// It is unused: `queueId` (PROSPECT_QUEUE_ID_FIELD_ID) is the label identifier
// for this object, so `name` is always blank and has no meaning. Do not populate
// it, and exclude it from any view's visible fields (see Task 7 in the plan doc,
// `docs/superpowers/plans/2026-08-12-crm-a-foundation.md`) so it doesn't surface
// as a meaningless blank "Name" input on Prospect record forms.
export default defineObject({
  universalIdentifier: PROSPECT_OBJECT_ID,
  nameSingular: 'prospect',
  namePlural: 'prospects',
  labelSingular: 'Prospect',
  labelPlural: 'Prospects',
  description: 'A researched lead moving through the Frater pre-sale pipeline',
  icon: 'IconTargetArrow',
  labelIdentifierFieldMetadataUniversalIdentifier: PROSPECT_QUEUE_ID_FIELD_ID,
  fields: [
    {
      universalIdentifier: PROSPECT_QUEUE_ID_FIELD_ID,
      type: FieldType.TEXT,
      name: 'queueId',
      label: 'Queue ID',
      description: 'Stable identifier from the source research sheet, e.g. EV-001',
      icon: 'IconHash',
    },
    {
      universalIdentifier: PROSPECT_STAGE_FIELD_ID,
      type: FieldType.SELECT,
      name: 'stage',
      label: 'Stage',
      icon: 'IconProgressCheck',
      defaultValue: `'${ProspectStage.SOURCED}'`,
      options: [
        { id: '9cbfa671-4c71-472a-8557-5e4eb4b238ed', value: ProspectStage.SOURCED, label: 'Sourced', position: 0, color: 'gray' },
        { id: '0ed5acab-f721-46e8-a24d-8427f311e7f5', value: ProspectStage.EVIDENCE_VERIFIED, label: 'Evidence verified', position: 1, color: 'blue' },
        { id: 'b04abd23-6dc7-4efb-bd4b-fda3cf0f6c2f', value: ProspectStage.ICP_QUALIFIED, label: 'ICP qualified', position: 2, color: 'turquoise' },
        { id: 'c99cead3-78ce-4df4-92ea-108c35db81ea', value: ProspectStage.ENRICHED, label: 'Enriched', position: 3, color: 'purple' },
        { id: '1d462026-bf9c-47a3-9955-f164b2ad0bb0', value: ProspectStage.OUTREACH_DRAFTED, label: 'Outreach drafted', position: 4, color: 'yellow' },
        { id: '23d02468-b9cc-4719-9e78-8352fbcfb891', value: ProspectStage.CONTACTED, label: 'Contacted', position: 5, color: 'orange' },
        { id: 'ccfc5a13-9dd3-4519-85eb-2f665b4cc4ff', value: ProspectStage.ENGAGED, label: 'Engaged', position: 6, color: 'green' },
        { id: '86ff45e9-60c7-4fb5-ae4a-96569b13b74b', value: ProspectStage.CONVERTED, label: 'Converted', position: 7, color: 'green' },
        { id: 'b5118e55-3001-402f-9058-2bc59dfe0408', value: ProspectStage.DISQUALIFIED, label: 'Disqualified', position: 8, color: 'red' },
      ],
    },
    {
      universalIdentifier: PROSPECT_LEAD_SOURCE_FIELD_ID,
      type: FieldType.SELECT,
      name: 'leadSource',
      label: 'Lead source',
      icon: 'IconRoute',
      isNullable: true,
      options: [
        { id: '8bea2303-2cab-4f5f-9829-40b26fe649f7', value: ProspectLeadSource.ALUMNI_EVIDENCE, label: 'Alumni evidence', position: 0, color: 'blue' },
        { id: '40a4251c-9077-48fc-a4fe-57d78f90a40e', value: ProspectLeadSource.CMU_STARTUP, label: 'CMU startup', position: 1, color: 'purple' },
        { id: '26126d08-89a0-46a4-b46a-fcfe9674d90c', value: ProspectLeadSource.INBOUND_WEBSITE, label: 'Inbound website', position: 2, color: 'green' },
      ],
    },
    {
      universalIdentifier: PROSPECT_QUALIFICATION_STATUS_FIELD_ID,
      type: FieldType.TEXT,
      name: 'qualificationStatus',
      label: 'Qualification status',
      icon: 'IconCheckbox',
    },
    {
      universalIdentifier: PROSPECT_RECOMMENDED_AI_WORKFLOW_FIELD_ID,
      type: FieldType.TEXT,
      name: 'recommendedAiWorkflow',
      label: 'Recommended AI workflow',
      description: 'The automation opportunity identified for this account',
      icon: 'IconRobot',
    },
    {
      universalIdentifier: PROSPECT_DISQUALIFICATION_REASON_FIELD_ID,
      type: FieldType.TEXT,
      name: 'disqualificationReason',
      label: 'Disqualification reason',
      icon: 'IconBan',
    },
    {
      universalIdentifier: PROSPECT_IMPORT_NOTES_FIELD_ID,
      type: FieldType.TEXT,
      name: 'importNotes',
      label: 'Import notes',
      description: 'Original sheet notes and any values normalized during import',
      icon: 'IconNotes',
    },
  ],
});
