import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  fetchShipments,
  planConsolidationGroups,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'consolidate-plan',
  description: 'Plan cross-warehouse consolidation groups for ready-to-consolidate shipments to minimize wasted billed pounds',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  args: [
    { name: 'warehouse', help: 'Optional warehouse_id filter (restrict the candidate pool)' },
    { name: 'max-items', type: 'int', default: 10, help: 'Maximum shipments per consolidated package (cap is 10)' },
    { name: 'max-weight', type: 'float', default: 22, help: 'Maximum total weight (lb) per consolidated package' },
    { name: 'min-fractional', type: 'float', default: 0.8, help: 'Minimum acceptable fractional pound for an "efficient" group (e.g. 0.8 means 1.8 lb is efficient)' },
  ],
  columns: ['group', 'warehouses', 'item_count', 'total_weight', 'rounded_lb', 'fractional', 'efficient', 'tracknos', 'ids'],
  func: async (page, kwargs) => {
    const all = await fetchShipments(page);
    const warehouse = String(kwargs.warehouse ?? '').trim();
    const ready = all.filter((shipment) => shipment.shipment_status === 'bns_warehouse');
    const filtered = warehouse ? ready.filter((shipment) => shipment.warehouse_id === warehouse) : ready;

    const rawMaxItems = Number(kwargs['max-items'] ?? 10);
    const maxItems = Math.min(10, Number.isFinite(rawMaxItems) && rawMaxItems > 0 ? Math.floor(rawMaxItems) : 10);
    const rawMaxWeight = Number(kwargs['max-weight'] ?? 22);
    const maxWeight = Number.isFinite(rawMaxWeight) && rawMaxWeight > 0 ? rawMaxWeight : 22;
    const rawMinFractional = Number(kwargs['min-fractional'] ?? 0.8);
    const minFractional = Number.isFinite(rawMinFractional) && rawMinFractional > 0 && rawMinFractional < 1
      ? rawMinFractional
      : 0.8;

    const groups = planConsolidationGroups(filtered, { maxItems, maxWeight, minFractional });

    return groups.map((group, index) => ({
      group: index + 1,
      warehouses: group.warehouses.join('; '),
      item_count: group.items.length,
      total_weight: group.total_weight,
      rounded_lb: group.rounded_lb,
      fractional: group.fractional,
      efficient: group.efficient ? 'yes' : 'no',
      tracknos: group.items.map((item) => item.trackno).filter(Boolean).join('; '),
      ids: group.items.map((item) => item.id).join('; '),
    }));
  },
});
