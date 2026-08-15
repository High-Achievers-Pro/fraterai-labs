import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import {
  PROSPECTS_NAVIGATION_MENU_ITEM_ID,
  PROSPECT_PIPELINE_VIEW_ID,
} from '../constants/universal-identifiers';

// Points directly at the Pipeline view — a view with no navigation item is
// invisible in the sidebar, so this is what actually surfaces Task 7's work.
export default defineNavigationMenuItem({
  universalIdentifier: PROSPECTS_NAVIGATION_MENU_ITEM_ID,
  type: NavigationMenuItemType.VIEW,
  name: 'Prospects',
  icon: 'IconTargetArrow',
  position: 0,
  viewUniversalIdentifier: PROSPECT_PIPELINE_VIEW_ID,
});
