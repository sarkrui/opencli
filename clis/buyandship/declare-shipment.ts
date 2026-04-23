import { CommandExecutionError } from '@jackwener/opencli/errors';
import { cli, Strategy } from '@jackwener/opencli/registry';
import {
  BUYANDSHIP_DOMAIN,
  buildDeclarationPayload,
  checkTrackNumberAvailability,
  fetchCategoryRows,
  fetchShipments,
  loadDraftRecordFromFile,
  mergeDraftRecord,
  openNewShipmentPage,
  resolveCategoryRow,
  resolveWarehouseOption,
  shouldSubmitDeclaration,
  submitDeclarationPayload,
} from './shared.js';

cli({
  site: 'buyandship',
  name: 'declare-shipment',
  description: 'Declare a Buyandship shipment from local data or direct flags',
  domain: BUYANDSHIP_DOMAIN,
  strategy: Strategy.UI,
  navigateBefore: false,
  args: [
    { name: 'record-id', positional: true, help: 'Record id inside the JSON data file' },
    { name: 'data-file', help: 'Path to a local JSON file synced from your Google Sheet/database' },
    { name: 'warehouse', help: 'Warehouse label or warehouse_id' },
    { name: 'mode', choices: ['flexible', 'direct'], default: 'flexible', help: 'Shipment type to validate' },
    { name: 'tracking-no', help: 'Courier tracking number' },
    { name: 'item-name', help: 'Declared item name' },
    { name: 'category', help: 'Category code or category name' },
    { name: 'quantity', type: 'int', default: 1, help: 'Item quantity' },
    { name: 'price', help: 'Declared item price' },
    { name: 'warranty', type: 'bool', default: false, help: 'Whether to request the warranty value-added service in the payload model' },
    { name: 'remarks', help: 'Optional declaration remarks' },
    { name: 'dry-run', type: 'bool', default: false, help: 'Validate the declaration payload and stop before submitting it' },
    { name: 'execute', type: 'bool', default: true, help: 'Submit to Buyandship (default: true). Pass --execute false for compatibility with older dry-run usage' },
  ],
  columns: ['record_id', 'warehouse', 'mode', 'tracking_no', 'item_name', 'category_code', 'category_name', 'quantity', 'price', 'insurance', 'warranty', 'status', 'message'],
  func: async (page, kwargs) => {
    const filePath = String(kwargs['data-file'] ?? '').trim();
    const source = filePath
      ? await loadDraftRecordFromFile(filePath, String(kwargs['record-id'] ?? '').trim() || undefined)
      : null;

    const record = mergeDraftRecord(source, kwargs);
    const snapshot = await openNewShipmentPage(page);
    const warehouse = resolveWarehouseOption(snapshot.warehouses, record.warehouse);
    const categoryRows = await fetchCategoryRows(page, 'declaration');
    const category = resolveCategoryRow(categoryRows, record.category);

    const payload = buildDeclarationPayload(record, warehouse, category);
    const shouldSubmit = shouldSubmitDeclaration(kwargs);

    if (shouldSubmit) {
      const trackCheck = await checkTrackNumberAvailability(page, record.trackingNo);
      if (!trackCheck?.success) {
        throw new CommandExecutionError(
          `Buyandship rejected tracking number ${record.trackingNo}`,
          trackCheck?.message || 'Use a different tracking number or verify the shipment has not already been declared.',
        );
      }

      const before = await fetchShipments(page);
      const submit = await submitDeclarationPayload(page, payload);
      const after = await fetchShipments(page);
      const created = after.find((shipment) => !before.some((item) => item.id === shipment.id))
        ?? after.find((shipment) => shipment.courier_trackno === record.trackingNo)
        ?? null;

      if (!submit.ok) {
        throw new CommandExecutionError(
          `Buyandship create shipment failed with HTTP ${submit.status}`,
          submit.errorMessage || submit.rawText || 'Unknown Buyandship API error',
        );
      }

      return [{
        record_id: record.recordId ?? '',
        warehouse: warehouse.label,
        mode: record.mode,
        tracking_no: record.trackingNo,
        item_name: record.itemName,
        category_code: category.code,
        category_name: category.name,
        quantity: record.quantity,
        price: record.price,
        insurance: 'no',
        warranty: record.warranty ? 'yes' : 'no',
        status: 'submitted',
        message: created
          ? `Shipment submitted successfully with id ${created.id}.`
          : 'Shipment submitted successfully, but the new record was not immediately visible in the shipment list.',
      }];
    }

    return [{
      record_id: record.recordId ?? '',
      warehouse: warehouse.label,
      mode: record.mode,
      tracking_no: record.trackingNo,
      item_name: record.itemName,
      category_code: category.code,
      category_name: category.name,
      quantity: record.quantity,
      price: record.price,
      insurance: 'no',
      warranty: record.warranty ? 'yes' : 'no',
      status: 'dry-run',
      message: `Dry run only. Payload validated against live Buyandship warehouse/category data: ${JSON.stringify(payload)}`,
    }];
  },
});
