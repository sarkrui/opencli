import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  ORDER_STATUS_LABELS,
  fetchOrders,
  mapOrderRow,
  resolveStatusFilter,
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
    { name: 'status', help: 'Filter by order_status code (publish, bns_payment, bns_inspection, bns_in, bns_out, bns_complete) or label substring (e.g. "ready for pickup")' },
  ],
  columns: ['order_no', 'order_status', 'status_label', 'shipment_count', 'courier_trackno', 'shipment_tracknos', 'chargeable_weight', 'fee', 'created_at'],
  func: async (page, kwargs) => {
    const orders = await fetchOrders(page);
    const statusInput = String(kwargs.status ?? '').trim();
    const wantedCode = statusInput ? resolveStatusFilter(statusInput, ORDER_STATUS_LABELS) : '';
    const rawLimit = Number(kwargs.limit ?? 20);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;

    return orders
      .filter((order) => !wantedCode || order.order_status === wantedCode)
      .slice(0, limit)
      .map(mapOrderRow);
  },
});
