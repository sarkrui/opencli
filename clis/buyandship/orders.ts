import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  fetchOrders,
  mapOrderRow,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'orders',
  description: 'List Buyandship consolidation orders from the authenticated member API',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Maximum number of orders to return' },
    { name: 'status', help: 'Optional order_status filter such as bns_complete' },
  ],
  columns: ['order_no', 'order_status', 'shipment_count', 'courier_trackno', 'chargeable_weight', 'fee', 'created_at'],
  func: async (page, kwargs) => {
    const orders = await fetchOrders(page);
    const status = String(kwargs.status ?? '').trim();
    const rawLimit = Number(kwargs.limit ?? 20);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;

    return orders
      .filter((order) => !status || order.order_status === status)
      .slice(0, limit)
      .map(mapOrderRow);
  },
});
