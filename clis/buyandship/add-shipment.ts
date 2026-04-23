import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  createShipmentDraft,
  mapShipmentRow,
  modeToLabel,
  normalizeModeInput,
  openNewShipmentPage,
  resolveWarehouseOption,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'add-shipment',
  description: 'Create a new Buyandship shipment shell from the member-centre wizard',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.UI,
  navigateBefore: false,
  args: [
    { name: 'warehouse', positional: true, required: true, help: 'Warehouse label or value, for example "Ashford, U.K."' },
    { name: 'mode', choices: ['flexible', 'direct'], default: 'flexible', help: 'Shipment type to request in the wizard' },
    { name: 'execute', type: 'bool', default: false, help: 'Actually click through the wizard and create the shipment shell' },
  ],
  columns: ['status', 'warehouse', 'mode', 'shipment_id', 'courier_trackno', 'shipment_type', 'shipment_status', 'message'],
  func: async (page, kwargs) => {
    const snapshot = await openNewShipmentPage(page);
    const warehouseArg = String(kwargs.warehouse ?? '').trim();
    if (!warehouseArg) throw new ArgumentError('warehouse is required');

    const warehouse = resolveWarehouseOption(snapshot.warehouses, warehouseArg);
    const mode = normalizeModeInput(kwargs.mode);

    if (kwargs.execute !== true) {
      return [{
        status: 'preview',
        warehouse: warehouse.label,
        mode,
        shipment_id: '',
        courier_trackno: '',
        shipment_type: '',
        shipment_status: '',
        message: `Validated warehouse selection. Re-run with --execute to create a ${modeToLabel(mode)} shipment shell.`,
      }];
    }

    const created = await createShipmentDraft(page, warehouse, mode);
    if (!created) {
      throw new CommandExecutionError(
        'buyandship did not expose a newly created shipment after the wizard step',
        'The member-centre flow may have changed, or the account may require an extra confirmation step.',
      );
    }

    const row = mapShipmentRow(created);
    return [{
      status: 'created',
      warehouse: warehouse.label,
      mode,
      shipment_id: row.id,
      courier_trackno: row.courier_trackno,
      shipment_type: row.shipment_type,
      shipment_status: row.shipment_status,
      message: 'Shipment shell created. Inspect it with `opencli buyandship shipment <id>`.',
    }];
  },
});
