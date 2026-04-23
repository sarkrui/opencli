import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  fetchShipment,
  mapShipmentRow,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'shipment',
  description: 'Fetch a single Buyandship shipment by id',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  args: [
    { name: 'id', positional: true, required: true, help: 'Shipment id from buyandship shipments list' },
  ],
  columns: ['id', 'courier_trackno', 'warehouse_id', 'shipment_type', 'shipment_status', 'item_names', 'created_at'],
  func: async (page, kwargs) => {
    const shipment = await fetchShipment(page, kwargs.id);
    return [mapShipmentRow(shipment)];
  },
});
