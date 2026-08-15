// Universal identifiers for the Frater CRM application.
//
// These are written into Twenty's metadata on first deploy and become the
// permanent identity of every object, field and relation this app owns.
// NEVER change one after it has been deployed: Twenty would treat the new
// value as a different entity, drop the old one, and take its data with it.

// Application
export const APPLICATION_UNIVERSAL_IDENTIFIER = '4ae2fcd0-2099-47d9-908b-0f013c4724cb';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = '8957fec4-3821-4059-880b-78da6ca90dc2';

// Prospect object + its own fields
export const PROSPECT_OBJECT_ID = '6a244543-8150-4ff4-bf9f-6db13e51fd3c';
export const PROSPECT_QUEUE_ID_FIELD_ID = '20e426a8-d708-459a-bd5c-c50aa291e30a';
export const PROSPECT_STAGE_FIELD_ID = '5b519dc9-c629-4b0e-95b8-968b4f94cfef';
export const PROSPECT_LEAD_SOURCE_FIELD_ID = '22a138d8-60b9-479e-91eb-9159caec732e';
export const PROSPECT_QUALIFICATION_STATUS_FIELD_ID = '3599e637-3350-4a5c-84bd-653f058321ed';
export const PROSPECT_RECOMMENDED_AI_WORKFLOW_FIELD_ID = 'ac0d5df0-209a-44ce-a8af-241dd317e724';
export const PROSPECT_DISQUALIFICATION_REASON_FIELD_ID = '3e435da1-767e-4399-b890-04ffd4b18c58';
export const PROSPECT_IMPORT_NOTES_FIELD_ID = 'b56f79a7-5c62-4582-ae90-64744a97c6fd';

// Outreach object + its own fields
export const OUTREACH_OBJECT_ID = 'db1b83be-b6d6-4c49-86c2-a51720c002df';
export const OUTREACH_TITLE_FIELD_ID = '38d191eb-3ae3-4a00-9b71-828ec77da9f2';
export const OUTREACH_CHANNEL_FIELD_ID = '394ccfd5-c838-4da6-a450-8815675d1f34';
export const OUTREACH_SUBJECT_FIELD_ID = '820d712a-cfef-470d-9feb-6302cad7a9b2';
export const OUTREACH_BODY_FIELD_ID = 'a616aad8-db16-4473-9c56-b0abf3069941';
export const OUTREACH_CHARACTER_COUNT_FIELD_ID = '861f183d-e9fb-40aa-bb97-1129466656c5';
export const OUTREACH_STATUS_FIELD_ID = '70d867f8-5e0c-4a4d-8a0d-d2569c6f3337';
export const OUTREACH_SENT_AT_FIELD_ID = '971f067c-9f26-4fe4-a721-80e37857d637';
export const OUTREACH_GENERATED_BY_FIELD_ID = 'eb46fb34-5504-47c3-a32d-9f84db272035';
export const OUTREACH_MODEL_FIELD_ID = '740bbe87-e13e-4f4f-bc7d-2c0aa616e6a9';

// Relations — each needs an identifier on BOTH sides
export const PROSPECT_COMPANY_FIELD_ID = '412aa171-db47-455b-9729-f4e76e5361f9';
export const COMPANY_PROSPECTS_FIELD_ID = 'a786bdc1-68e0-492d-9491-7cc3346a454e';
export const PROSPECT_PERSON_FIELD_ID = '24b2ef48-bb15-4878-841e-c5547c26cf3b';
export const PERSON_PROSPECTS_FIELD_ID = '06acd9f4-7fdd-43bd-80ac-a0e53a6a2a2b';
export const OUTREACH_PROSPECT_FIELD_ID = 'f310257d-788f-4195-b14a-ec35065fe624';
export const PROSPECT_OUTREACHES_FIELD_ID = 'a5077943-0290-4d25-8623-cbc3bd1ab904';

// Fields added to the standard Company object
export const COMPANY_SEGMENT_FIELD_ID = 'b290eb0d-6be0-498b-8b93-aefc30f0b7e4';
export const COMPANY_REGION_FIELD_ID = '3059f11b-3833-47b9-b4c7-f56ed99f93d0';
export const COMPANY_COUNTRY_FIELD_ID = 'bdb614ec-eb2d-4c30-bc37-082055e268db';
export const COMPANY_HEADCOUNT_STATUS_FIELD_ID = '546f0abf-ecb7-4548-b4b3-3affda7ee7b0';
export const COMPANY_RESEARCH_LINKS_FIELD_ID = 'e6cfe7b2-b9de-4d32-bac7-5b1c69ae41fe';
export const COMPANY_IS_SUPPRESSED_FIELD_ID = '98238a21-040f-4bd8-8112-84e6ae2111ad';
export const COMPANY_SUPPRESSION_REASON_FIELD_ID = 'e1ec74e4-bd6e-4733-8c6b-1fa733d98ac3';

// Fields added to the standard Person object
export const PERSON_SCHOOL_FIELD_ID = 'e60f1dd0-6d5a-465f-930a-a92803f22a9c';
export const PERSON_ALUMNI_PATH_FIELD_ID = '06a6b76f-0b57-4db8-81cc-ea6f365710bc';
export const PERSON_TARGET_ROLE_FIELD_ID = '515a15bd-b709-4e74-a1f5-37a18fd4fc69';
export const PERSON_EVIDENCE_URL_FIELD_ID = '868f6e10-ef18-4584-aaf8-e74a119b0a67';
export const PERSON_EVIDENCE_SUMMARY_FIELD_ID = '1f08af3b-296d-483c-ae56-0373f6602766';
export const PERSON_DIRECT_EMAIL_STATUS_FIELD_ID = '9ec7be20-d77d-4ca7-b044-1fc97e55cae9';
export const PERSON_RESEARCH_LINKS_FIELD_ID = '39dbcdc8-4686-4a5c-ba54-9d6785eca4d8';

// Prospect owner — relation to the standard workspaceMember object
export const PROSPECT_OWNER_FIELD_ID = 'ef255fb2-c22f-4862-995d-74197a6029eb';
export const WORKSPACE_MEMBER_PROSPECTS_FIELD_ID = 'dac63d09-2f31-4747-82fa-76dd3812906b';
