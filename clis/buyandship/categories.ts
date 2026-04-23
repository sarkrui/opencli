import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  fetchCategoryRows,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'categories',
  description: 'List Buyandship shipment/declaration categories from the authenticated settings API',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  args: [
    { name: 'kind', choices: ['shipment', 'declaration', 'all'], default: 'all', help: 'Category list to return' },
    { name: 'limit', type: 'int', default: 200, help: 'Maximum number of category rows to return' },
  ],
  columns: ['kind', 'group_name', 'code', 'name', 'icon'],
  func: async (page, kwargs) => {
    const kind = String(kwargs.kind ?? 'all') as 'shipment' | 'declaration' | 'all';
    const rawLimit = Number(kwargs.limit ?? 200);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 200;
    return (await fetchCategoryRows(page, kind)).slice(0, limit);
  },
});
