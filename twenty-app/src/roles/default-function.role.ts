import { defineApplicationRole } from 'twenty-sdk/define';

import { DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from '../constants/universal-identifiers';

// The role every Frater CRM logic function and agent runs as.
//
// `defineApplicationRole` (rather than `defineRole`) marks this as the
// application's default role; passing `defaultRoleUniversalIdentifier` to
// `defineApplication` is deprecated in twenty-sdk 2.31.
//
// Read and update are granted because enrichment, qualification and outreach
// drafting all write back to records. Delete is deliberately withheld: nothing
// this app does should ever remove a prospect, and an agent that cannot delete
// cannot be talked into deleting.
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Frater CRM Functions',
  description: 'Role used by Frater CRM logic functions and agents',
  icon: 'IconRobot',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToAgents: true,
  canBeAssignedToApiKeys: true,
  canBeAssignedToUsers: false,
});
