import * as fs from 'node:fs';
import * as path from 'node:path';

import { ArgumentError, AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import type { IPage } from '@jackwener/opencli/types';

export const BUYANDSHIP_DOMAIN = 'www.buyandship.today';

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  publish: 'Pending arrival',
  bns_in: 'Arrived at overseas warehouse',
  bns_warehouse: 'Ready to consolidate',
  bns_out: 'Handed to third-party courier',
  bns_complete: 'Consolidated / delivered',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  publish: 'Draft',
  bns_payment: 'Awaiting payment',
  bns_inspection: 'Inspecting',
  bns_in: 'Arrived at HK warehouse',
  bns_out: 'Ready for pickup/delivery',
  bns_complete: 'Picked up / delivered',
};

export function resolveStatusFilter(input: string, labels: Record<string, string>): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  if (labels[raw]) return raw;
  const needle = raw.toLowerCase();
  for (const [code, label] of Object.entries(labels)) {
    if (label.toLowerCase().includes(needle)) return code;
  }
  return raw;
}
export const BUYANDSHIP_EN_BASE = `https://${BUYANDSHIP_DOMAIN}/en/account/v2020`;
export const BUYANDSHIP_NEW_SHIPMENT_URL = `${BUYANDSHIP_EN_BASE}/shipments/new/`;
export const BUYANDSHIP_SHIPMENTS_URL = `https://${BUYANDSHIP_DOMAIN}/api/shipments`;
export const BUYANDSHIP_ORDERS_URL = `https://${BUYANDSHIP_DOMAIN}/api/orders`;
export const BUYANDSHIP_CATEGORY_SETTINGS_URL =
  `https://${BUYANDSHIP_DOMAIN}/api/settings?` +
  'k[]=shipment_categories&k[]=declaration_categories&k[]=shipment_types&k[]=shipment_overdue&k[]=shipment_consolidate_checkboxes&k[]=tw_payment_invoice';

export type BuyandshipMode = 'direct' | 'flexible';

export interface WarehouseOption {
  value: string;
  label: string;
  recent: boolean;
}

export interface RecentItem {
  name: string;
  category: string;
}

export interface BuyandshipShipmentContentItem {
  name?: string;
  quantity?: number | string;
  price?: string;
  category2?: string;
  category2_name?: string;
}

export interface BuyandshipShipment {
  id: number;
  shipment_type?: string;
  shipment_status?: string;
  warehouse_id?: string;
  courier?: string;
  courier_trackno?: string;
  content?: BuyandshipShipmentContentItem[];
  created?: number;
  updated?: number;
  declaration_extras?: Record<string, unknown>;
  remarks?: string;
  weight?: string;
  overdue_fee?: string;
  extra_fee?: string;
}

export interface BuyandshipOrderShipment {
  id?: number;
  trackno?: string;
  warehouse_id?: string;
  weight?: string;
  price_local?: string;
  shipment_status?: string;
}

export interface BuyandshipOrder {
  id: number;
  order_no?: string;
  order_status?: string;
  shipment_type?: string;
  address_type_name?: string;
  shipments?: BuyandshipOrderShipment[];
  weight?: string;
  chargeable_weight?: string;
  fee?: string;
  payment_method?: string;
  courier?: string;
  courier_trackno?: string;
  created?: number;
  updated?: number;
}

export interface BuyandshipCategoryRow {
  kind: 'shipment' | 'declaration';
  group_en: string;
  group_name: string;
  code: string;
  name: string;
  icon: string;
}

export interface BuyandshipWizardSnapshot {
  url: string;
  title: string;
  heading: string | null;
  warehouses: WarehouseOption[];
  recentItems: RecentItem[];
  errorMessage: string | null;
}

export interface BuyandshipDraftRecord {
  recordId?: string;
  warehouse: string;
  mode: BuyandshipMode;
  trackingNo: string;
  itemName: string;
  category: string;
  quantity: number;
  price: string;
  remarks: string;
  warranty: boolean;
}

export interface BuyandshipDeclarationPayload {
  shipment_type: string;
  warehouse_id: string;
  courier_trackno: string;
  content: Array<{
    name: string;
    price: number;
    quantity: number;
    url: string;
    category2: string;
  }>;
  insurance: 'no';
  share: 'yes' | 'no';
  value_added_services?: {
    vas_warranty: 'yes';
  };
  remarks?: string;
}

export interface BuyandshipSubmitResult {
  status: number;
  payload: unknown;
  rawText: string;
  ok: boolean;
  errorMessage?: string;
}

interface BuyandshipCategoryGroupRaw extends Array<unknown> {
  0: string;
  1: string;
  2: Array<[string, string, string]>;
}

function normalizeLooseText(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim();
}

export function normalizeModeInput(value: unknown): BuyandshipMode {
  const raw = normalizeLooseText(typeof value === 'string' ? value : '');
  if (!raw || raw === 'flexible' || raw === 'self' || raw === 'consolidate' || raw === 'shipment-type-consolidate') {
    return 'flexible';
  }
  if (raw === 'direct' || raw === 'single' || raw === 'shipment-type-single') return 'direct';
  throw new ArgumentError(
    `Unsupported buyandship mode "${String(value ?? '')}"`,
    'Use one of: direct, flexible',
  );
}

export function modeToShipmentType(mode: BuyandshipMode): string {
  return mode === 'direct' ? 'shipment-type-single' : 'shipment-type-consolidate';
}

export function modeToLabel(mode: BuyandshipMode): string {
  return mode === 'direct' ? 'Direct' : 'Flexible';
}

export function flattenCategoryGroups(
  kind: 'shipment' | 'declaration',
  groups: unknown,
): BuyandshipCategoryRow[] {
  const groupList = Array.isArray(groups)
    ? groups
    : groups && typeof groups === 'object'
      ? Object.values(groups as Record<string, unknown>)
      : [];

  const rows: BuyandshipCategoryRow[] = [];
  for (const group of groupList) {
    if (!Array.isArray(group) || group.length < 3 || !Array.isArray(group[2])) continue;
    const typed = group as BuyandshipCategoryGroupRaw;
    for (const item of typed[2]) {
      if (!Array.isArray(item) || item.length < 3) continue;
      const [code, name, icon] = item;
      rows.push({
        kind,
        group_en: String(typed[0] ?? ''),
        group_name: String(typed[1] ?? ''),
        code: String(code ?? ''),
        name: String(name ?? ''),
        icon: String(icon ?? ''),
      });
    }
  }
  return rows;
}

export function resolveWarehouseOption(
  warehouses: WarehouseOption[],
  input: string,
): WarehouseOption {
  const needle = normalizeLooseText(input);
  const exact = warehouses.find((warehouse) => warehouse.value === input || normalizeLooseText(warehouse.label) === needle);
  if (exact) return exact;

  const fuzzy = warehouses.find((warehouse) =>
    warehouse.value.includes(input)
    || normalizeLooseText(warehouse.label).includes(needle),
  );
  if (fuzzy) return fuzzy;

  throw new ArgumentError(
    `Unknown warehouse "${input}"`,
    `Use one of: ${warehouses.map((warehouse) => warehouse.label).join(', ')}`,
  );
}

function getShipmentRecordKey(record: Record<string, unknown>): string {
  const candidates = [
    record.id,
    record.record_id,
    record.recordId,
    record.shipment_id,
    record.shipmentId,
    record.tracking_no,
    record.trackingNo,
  ];
  return String(candidates.find((value) => value !== undefined && value !== null && value !== '') ?? '').trim();
}

export function findDraftRecord(
  dataset: unknown,
  recordId: string | null | undefined,
): Record<string, unknown> | null {
  if (recordId == null || recordId.trim() === '') return null;

  const list = Array.isArray(dataset)
    ? dataset
    : Array.isArray((dataset as { shipments?: unknown[] } | null)?.shipments)
      ? (dataset as { shipments: unknown[] }).shipments
      : Array.isArray((dataset as { rows?: unknown[] } | null)?.rows)
        ? (dataset as { rows: unknown[] }).rows
        : [];

  const needle = recordId.trim();
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (getShipmentRecordKey(record) === needle) return record;
  }
  return null;
}

function toNonEmptyString(value: unknown): string {
  return String(value ?? '').trim();
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new ArgumentError(`Expected a positive number, got "${String(value)}"`);
  }
  return Math.floor(num);
}

function normalizePrice(value: unknown): string {
  const raw = toNonEmptyString(value);
  if (!raw) return '';
  const num = Number(raw);
  if (Number.isFinite(num) && num >= 0) return String(num);
  return raw;
}

function toPriceNumber(value: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new ArgumentError(`Expected a numeric non-negative price, got "${value}"`);
  }
  return num;
}

function toBooleanFlag(value: unknown, fallback = false): boolean {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const raw = normalizeLooseText(String(value));
  if (['yes', 'true', '1', 'y', 'on'].includes(raw)) return true;
  if (['no', 'false', '0', 'n', 'off'].includes(raw)) return false;
  throw new ArgumentError(`Expected a boolean-like value, got "${String(value)}"`);
}

export function mergeDraftRecord(
  source: Record<string, unknown> | null,
  kwargs: Record<string, unknown>,
): BuyandshipDraftRecord {
  const recordId = toNonEmptyString(kwargs['record-id'] ?? source?.record_id ?? source?.recordId ?? source?.id) || undefined;
  const warehouse = toNonEmptyString(kwargs.warehouse ?? source?.warehouse ?? source?.warehouse_id ?? source?.warehouseId);
  const mode = normalizeModeInput(kwargs.mode ?? source?.mode ?? source?.shipment_type);
  const trackingNo = toNonEmptyString(kwargs['tracking-no'] ?? source?.tracking_no ?? source?.trackingNo ?? source?.courier_trackno);
  const itemName = toNonEmptyString(kwargs['item-name'] ?? source?.item_name ?? source?.itemName ?? source?.name);
  const category = toNonEmptyString(kwargs.category ?? source?.category ?? source?.category2 ?? source?.category2_name);
  const quantity = toPositiveInteger(kwargs.quantity ?? source?.quantity, 1);
  const price = normalizePrice(kwargs.price ?? source?.price);
  const remarks = toNonEmptyString(kwargs.remarks ?? source?.remarks);
  const warranty = toBooleanFlag(kwargs.warranty ?? source?.warranty, false);

  if (!warehouse) throw new ArgumentError('warehouse is required', 'Pass a warehouse label/value or provide it in the data file');
  if (!trackingNo) throw new ArgumentError('tracking number is required', 'Pass --tracking-no <value> or provide it in the data file');
  if (!itemName) throw new ArgumentError('item name is required', 'Pass --item-name <value> or provide it in the data file');
  if (!category) throw new ArgumentError('category is required', 'Pass --category <code-or-name> or provide it in the data file');
  if (!price) throw new ArgumentError('price is required', 'Pass --price <amount> or provide it in the data file');

  return {
    recordId,
    warehouse,
    mode,
    trackingNo,
    itemName,
    category,
    quantity,
    price,
    remarks,
    warranty,
  };
}

export function buildDeclarationPayload(
  record: BuyandshipDraftRecord,
  warehouse: WarehouseOption,
  category: BuyandshipCategoryRow,
): BuyandshipDeclarationPayload {
  const payload: BuyandshipDeclarationPayload = {
    shipment_type: modeToShipmentType(record.mode),
    warehouse_id: warehouse.value,
    courier_trackno: record.trackingNo,
    content: [{
      name: record.itemName,
      price: toPriceNumber(record.price),
      quantity: record.quantity,
      url: '',
      category2: category.code,
    }],
    insurance: 'no',
    share: 'no',
  };

  if (record.warranty) {
    payload.value_added_services = {
      vas_warranty: 'yes',
    };
  }

  if (record.remarks) payload.remarks = record.remarks;
  return payload;
}

export function shouldSubmitDeclaration(kwargs: Record<string, unknown>): boolean {
  if (kwargs['dry-run'] === true) return false;
  if (kwargs.execute === false) return false;
  return true;
}

export function pickNewShipment(
  before: BuyandshipShipment[],
  after: BuyandshipShipment[],
): BuyandshipShipment | null {
  const knownIds = new Set(before.map((shipment) => shipment.id));
  return after.find((shipment) => !knownIds.has(shipment.id)) ?? null;
}

export function formatUnixSeconds(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return '';
  return new Date(value * 1000).toISOString();
}

export function summarizeShipmentContent(content: BuyandshipShipmentContentItem[] | undefined): string {
  if (!Array.isArray(content) || content.length === 0) return '';
  return content
    .map((item) => String(item.name ?? '').trim())
    .filter(Boolean)
    .join('; ');
}

export async function browserFetchJson<T>(page: IPage, url: string): Promise<T> {
  return await page.evaluate(`
    (async () => {
      const res = await fetch(${JSON.stringify(url)}, { credentials: 'include' });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + ${JSON.stringify(url)});
      return await res.json();
    })()
  `) as T;
}

export async function ensureApiContext(page: IPage, url: string = BUYANDSHIP_NEW_SHIPMENT_URL): Promise<void> {
  const currentUrl = typeof page.getCurrentUrl === 'function'
    ? await page.getCurrentUrl()
    : await page.evaluate('window.location.href') as string;

  if (!String(currentUrl ?? '').startsWith(`https://${BUYANDSHIP_DOMAIN}/`)) {
    await page.goto(url, { waitUntil: 'load' });
    await page.wait(1.5);
  }

  await ensureLoggedIn(page);
  await dismissMemberCentreModal(page);
}

function unwrapList<T>(payload: unknown, key: string): T[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>)[key])) {
    return (data as Record<string, unknown>)[key] as T[];
  }
  if (Array.isArray((payload as Record<string, unknown>)[key])) {
    return (payload as Record<string, unknown>)[key] as T[];
  }
  return [];
}

export async function fetchShipments(page: IPage): Promise<BuyandshipShipment[]> {
  await ensureApiContext(page, `${BUYANDSHIP_EN_BASE}/shipments/status/all`);
  const payload = await browserFetchJson<unknown>(page, BUYANDSHIP_SHIPMENTS_URL);
  return unwrapList<BuyandshipShipment>(payload, 'shipments');
}

export async function fetchShipment(page: IPage, id: number | string): Promise<BuyandshipShipment> {
  await ensureApiContext(page, `${BUYANDSHIP_EN_BASE}/shipments/status/all`);
  const payload = await browserFetchJson<{ data?: BuyandshipShipment }>(page, `${BUYANDSHIP_SHIPMENTS_URL}/${id}`);
  if (!payload?.data) throw new CommandExecutionError(`buyandship shipment ${id} was not found`);
  return payload.data;
}

export async function fetchOrders(page: IPage): Promise<BuyandshipOrder[]> {
  await ensureApiContext(page, `${BUYANDSHIP_EN_BASE}/orders`);
  const payload = await browserFetchJson<unknown>(page, BUYANDSHIP_ORDERS_URL);
  return unwrapList<BuyandshipOrder>(payload, 'orders');
}

export async function fetchCategoryRows(page: IPage, kind: 'shipment' | 'declaration' | 'all' = 'all'): Promise<BuyandshipCategoryRow[]> {
  await ensureApiContext(page, BUYANDSHIP_NEW_SHIPMENT_URL);
  const payload = await browserFetchJson<{ data?: Record<string, unknown> }>(page, BUYANDSHIP_CATEGORY_SETTINGS_URL);
  const settings = payload?.data ?? {};
  const rows: BuyandshipCategoryRow[] = [];
  if (kind === 'shipment' || kind === 'all') rows.push(...flattenCategoryGroups('shipment', settings.shipment_categories));
  if (kind === 'declaration' || kind === 'all') rows.push(...flattenCategoryGroups('declaration', settings.declaration_categories));
  return rows;
}

export async function checkTrackNumberAvailability(page: IPage, trackno: string): Promise<{ success: boolean; key?: string; message?: string }> {
  await ensureApiContext(page, BUYANDSHIP_NEW_SHIPMENT_URL);
  return await page.evaluate(`
    (async () => {
      const apiUrl = String(window.BUYANDSHIP?.settings?.api_url || '');
      const endpoint = apiUrl ? apiUrl.replace(/\\/$/, '') + '/v2/shipments/trackno/check' : '/en/api/v2/shipments/trackno/check';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify({ trackno: ${JSON.stringify(trackno)} }),
      });
      return await res.json();
    })()
  `) as { success: boolean; key?: string; message?: string };
}

export async function submitDeclarationPayload(
  page: IPage,
  payload: BuyandshipDeclarationPayload,
): Promise<BuyandshipSubmitResult> {
  await ensureApiContext(page, BUYANDSHIP_NEW_SHIPMENT_URL);
  return await page.evaluate(`
    (async () => {
      const apiUrl = String(window.BUYANDSHIP?.settings?.api_url || '');
      const endpoint = apiUrl ? apiUrl.replace(/\\/$/, '') + '/shipments' : '/en/api/shipments';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify(${JSON.stringify(payload)}),
      });
      const rawText = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(rawText); } catch {}
      const errorMessage = parsed?.error?.message || parsed?.message || '';
      return {
        status: res.status,
        payload: parsed,
        rawText,
        ok: res.ok,
        errorMessage,
      };
    })()
  `) as BuyandshipSubmitResult;
}

export async function ensureLoggedIn(page: IPage): Promise<void> {
  const state = await page.evaluate(`
    (() => {
      const href = window.location.href;
      const text = (document.body?.innerText || '').toLowerCase();
      return { href, text };
    })()
  `) as { href?: string; text?: string };

  const href = String(state.href ?? '');
  if (href.includes('/login')) throw new AuthRequiredError(BUYANDSHIP_DOMAIN);
  if (!href.includes('/account/')) {
    throw new CommandExecutionError(
      'buyandship account page did not load as expected',
      'Open the member centre in Chrome first and confirm the session is still logged in.',
    );
  }
}

export async function dismissMemberCentreModal(page: IPage): Promise<void> {
  const clicked = await page.evaluate(`
    (() => {
      const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const tryNow = document.querySelector('#enableBuyandship2020MemberCenterBtn');
      if (visible(tryNow)) {
        tryNow.click();
        return true;
      }
      const close = document.querySelector('#enableBuyandship2020MemberCenter button[aria-label="Close"]');
      if (visible(close)) {
        close.click();
        return true;
      }
      return false;
    })()
  `) as boolean;

  if (clicked) await page.wait(1.5);
}

export async function openNewShipmentPage(page: IPage): Promise<BuyandshipWizardSnapshot> {
  await page.goto(BUYANDSHIP_NEW_SHIPMENT_URL, { waitUntil: 'load' });
  await page.wait(2);
  await ensureLoggedIn(page);
  await dismissMemberCentreModal(page);
  return await extractWizardSnapshot(page);
}

export async function extractWizardSnapshot(page: IPage): Promise<BuyandshipWizardSnapshot> {
  return await page.evaluate(`
    (() => {
      const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const key = (value) => norm(value).toLowerCase();
      const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

      const headingNode = Array.from(document.querySelectorAll('h1, h2, h3, div, span'))
        .filter(visible)
        .find((el) => ['Declare your shipment', 'Confirm shipment declaration details', 'Add shipment'].includes(norm(el.textContent)));

      const recentTexts = new Set(['Recent Items', 'Fashion, Shoes & Accessories', 'Computer Parts']);
      const recentItems = [];
      for (const span of Array.from(document.querySelectorAll('span'))) {
        if (!visible(span)) continue;
        const name = norm(span.textContent);
        if (!name || recentTexts.has(name)) continue;
        const wrapper = span.parentElement?.parentElement;
        const categoryNode = wrapper ? Array.from(wrapper.querySelectorAll('div')).map((el) => norm(el.textContent)).find((text) => text && text !== name) : '';
        if (!categoryNode) continue;
        recentItems.push({ name, category: categoryNode });
        if (recentItems.length >= 20) break;
      }

      const select = Array.from(document.querySelectorAll('select'))
        .find((el) => Array.from(el.querySelectorAll('option')).length > 1) || null;
      const recentWarehouseSet = new Set();
      const recentlyUsed = Array.from(document.querySelectorAll('div, span'))
        .filter(visible)
        .map((el) => norm(el.textContent))
        .filter(Boolean);
      for (const label of recentlyUsed) {
        if (label === 'RECENTLY USED' || label === 'Ashford' || label === 'Portland') {
          if (label !== 'RECENTLY USED') recentWarehouseSet.add(key(label));
        }
      }

      const warehouses = select
        ? Array.from(select.querySelectorAll('option')).map((option) => ({
            value: option.value,
            label: norm(option.textContent),
            recent: Array.from(recentWarehouseSet).some((recent) => key(option.textContent).includes(recent)),
          }))
        : [];

      const pageText = norm(document.body?.innerText || '');
      const errorMessage = pageText.includes('Unable to add shipment')
        ? 'Unable to add shipment right now. Please try again later.'
        : null;

      return {
        url: window.location.href,
        title: document.title || '',
        heading: headingNode ? norm(headingNode.textContent) : null,
        warehouses,
        recentItems,
        errorMessage,
      };
    })()
  `) as BuyandshipWizardSnapshot;
}

export async function selectWarehouse(page: IPage, warehouseValue: string): Promise<void> {
  const ok = await page.evaluate(`
    ((warehouseValue) => {
      const select = Array.from(document.querySelectorAll('select'))
        .find((el) => Array.from(el.querySelectorAll('option')).length > 1);
      if (!select) return false;
      const option = Array.from(select.options).find((item) => item.value === warehouseValue);
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })(${JSON.stringify(warehouseValue)})
  `) as boolean;

  if (!ok) {
    throw new CommandExecutionError(
      `buyandship warehouse selector could not choose "${warehouseValue}"`,
      'The shipment wizard may have changed.',
    );
  }
  await page.wait(0.8);
}

export async function clickExactVisibleText(page: IPage, texts: string[]): Promise<boolean> {
  return await page.evaluate(`
    ((targets) => {
      const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], div, span'))
        .filter(visible)
        .map((el) => ({ el, text: norm(el.textContent) }))
        .filter((item) => targets.includes(item.text))
        .sort((a, b) => a.text.length - b.text.length);

      const match = nodes[0];
      if (!match) return false;
      const clickable = match.el.closest('button, a, [role="button"]') || match.el;
      clickable.click();
      return true;
    })(${JSON.stringify(texts)})
  `) as boolean;
}

export async function createShipmentDraft(
  page: IPage,
  warehouse: WarehouseOption,
  mode: BuyandshipMode,
): Promise<BuyandshipShipment | null> {
  const before = await fetchShipments(page);
  await openNewShipmentPage(page);
  await selectWarehouse(page, warehouse.value);

  const modeClicked = await clickExactVisibleText(page, [modeToLabel(mode)]);
  if (modeClicked) await page.wait(0.8);

  const nextClicked = await clickExactVisibleText(page, ['Next']);
  if (!nextClicked) {
    throw new CommandExecutionError(
      'buyandship shipment wizard did not expose a Next action',
      'The route may have changed, or the current account may be blocked from creating new shipments.',
    );
  }

  await page.wait(2);
  const after = await fetchShipments(page);
  const created = pickNewShipment(before, after);
  if (!created) return null;
  return created;
}

export async function loadDraftRecordFromFile(
  filePath: string,
  recordId: string | undefined,
): Promise<Record<string, unknown> | null> {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new ArgumentError(`data file not found: ${abs}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.promises.readFile(abs, 'utf-8'));
  } catch (err) {
    throw new ArgumentError(
      `failed to parse data file ${abs}: ${err instanceof Error ? err.message : String(err)}`,
      'Use a JSON file containing either an array of records or { shipments: [...] }.',
    );
  }

  if (!recordId) {
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    throw new ArgumentError('record-id is required when the data file contains multiple rows');
  }

  const record = findDraftRecord(parsed, recordId);
  if (!record) {
    throw new ArgumentError(`record ${recordId} was not found in ${abs}`);
  }
  return record;
}

export function mapShipmentRow(shipment: BuyandshipShipment): Record<string, unknown> {
  const code = shipment.shipment_status ?? '';
  return {
    id: shipment.id,
    courier_trackno: shipment.courier_trackno ?? '',
    warehouse_id: shipment.warehouse_id ?? '',
    shipment_type: shipment.shipment_type ?? '',
    shipment_status: code,
    status_label: SHIPMENT_STATUS_LABELS[code] ?? code,
    item_count: Array.isArray(shipment.content) ? shipment.content.length : 0,
    item_names: summarizeShipmentContent(shipment.content),
    created_at: formatUnixSeconds(shipment.created),
    updated_at: formatUnixSeconds(shipment.updated),
    remarks: shipment.remarks ?? '',
  };
}

export function mapOrderRow(order: BuyandshipOrder): Record<string, unknown> {
  const code = order.order_status ?? '';
  const shipments = Array.isArray(order.shipments) ? order.shipments : [];
  const tracknos = shipments
    .map((s) => String(s?.trackno ?? ''))
    .filter(Boolean)
    .join('; ');
  return {
    id: order.id,
    order_no: order.order_no ?? '',
    order_status: code,
    status_label: ORDER_STATUS_LABELS[code] ?? code,
    shipment_type: order.shipment_type ?? '',
    shipment_count: shipments.length,
    courier_trackno: order.courier_trackno ?? '',
    shipment_tracknos: tracknos,
    chargeable_weight: order.chargeable_weight ?? '',
    fee: order.fee ?? '',
    address_type_name: order.address_type_name ?? '',
    created_at: formatUnixSeconds(order.created),
    updated_at: formatUnixSeconds(order.updated),
  };
}

export function resolveCategoryRow(
  rows: BuyandshipCategoryRow[],
  input: string,
): BuyandshipCategoryRow {
  const needle = normalizeLooseText(input);
  const exact = rows.find((row) => row.code === input || normalizeLooseText(row.name) === needle || normalizeLooseText(row.group_name) === needle);
  if (exact) return exact;

  const fuzzy = rows.find((row) =>
    row.code.includes(input)
    || normalizeLooseText(row.name).includes(needle)
    || normalizeLooseText(row.group_name).includes(needle),
  );
  if (fuzzy) return fuzzy;

  throw new ArgumentError(
    `Unknown buyandship category "${input}"`,
    'Run `opencli buyandship categories` to inspect the available category codes.',
  );
}

export const __test__ = {
  buildDeclarationPayload,
  flattenCategoryGroups,
  normalizeModeInput,
  pickNewShipment,
  resolveWarehouseOption,
  findDraftRecord,
  mergeDraftRecord,
  shouldSubmitDeclaration,
  mapShipmentRow,
  mapOrderRow,
  modeToShipmentType,
  modeToLabel,
  resolveStatusFilter,
  SHIPMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
};
