import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  fetchShipments,
  mapShipmentRow,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'shipments',
  description: 'List Buyandship shipments from the authenticated member API',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Maximum number of shipments to return' },
    { name: 'status', help: 'Optional shipment_status filter such as publish or bns_complete' },
    { name: 'warehouse', help: 'Optional warehouse_id filter such as warehouse-bnsuk-ashford' },
    { name: 'track', help: 'Optional substring filter for courier_trackno' },
  ],
  columns: ['id', 'courier_trackno', 'warehouse_id', 'shipment_type', 'shipment_status', 'item_count', 'created_at'],
  func: async (page, kwargs) => {
    const shipments = await fetchShipments(page);
    const status = String(kwargs.status ?? '').trim();
    const warehouse = String(kwargs.warehouse ?? '').trim();
    const track = String(kwargs.track ?? '').trim().toLowerCase();
    const rawLimit = Number(kwargs.limit ?? 20);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;

    return shipments
      .filter((shipment) => !status || shipment.shipment_status === status)
      .filter((shipment) => !warehouse || shipment.warehouse_id === warehouse)
      .filter((shipment) => !track || String(shipment.courier_trackno ?? '').toLowerCase().includes(track))
      .slice(0, limit)
      .map(mapShipmentRow);
  },
});
