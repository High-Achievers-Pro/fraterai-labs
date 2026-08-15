import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from './constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Frater CRM',
  description:
    'Frater AI Labs prospecting data model, agents and workflows: the Prospect and Outreach objects, the research fields added to Company and Person, and the automation built on top of them.',
  author: 'Frater AI Labs',
});
