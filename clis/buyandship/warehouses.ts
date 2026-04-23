import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  openNewShipmentPage,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'warehouses',
  description: 'List overseas warehouses available in the Buyandship shipment wizard',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.UI,
  navigateBefore: false,
  args: [],
  columns: ['value', 'label', 'recent'],
  func: async (page) => {
    const snapshot = await openNewShipmentPage(page);
    return snapshot.warehouses.map((warehouse) => ({
      value: warehouse.value,
      label: warehouse.label,
      recent: warehouse.recent ? 'yes' : 'no',
    }));
  },
});
