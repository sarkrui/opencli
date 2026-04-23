import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  openNewShipmentPage,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'recent-items',
  description: 'List recently declared Buyandship items from the shipment wizard sidebar',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.UI,
  navigateBefore: false,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Maximum number of recent items to return' },
  ],
  columns: ['name', 'category'],
  func: async (page, kwargs) => {
    const snapshot = await openNewShipmentPage(page);
    const rawLimit = Number(kwargs.limit ?? 20);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;
    return snapshot.recentItems.slice(0, limit);
  },
});
