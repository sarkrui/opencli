import { describe, expect, it } from 'vitest';

import {
  __test__,
  type BuyandshipShipment,
} from './shared.js';

describe('buyandship helpers', () => {
  it('normalizes mode aliases to flexible/direct', () => {
    expect(__test__.normalizeModeInput('self')).toBe('flexible');
    expect(__test__.normalizeModeInput('shipment-type-consolidate')).toBe('flexible');
    expect(__test__.normalizeModeInput('direct')).toBe('direct');
  });

  it('flattens nested category groups', () => {
    expect(__test__.flattenCategoryGroups('declaration', [
      ['Fashion', '潮流服飾', [['100100', '女裝', 'fashion']]],
    ])).toEqual([
      {
        kind: 'declaration',
        group_en: 'Fashion',
        group_name: '潮流服飾',
        code: '100100',
        name: '女裝',
        icon: 'fashion',
      },
    ]);
  });

  it('resolves warehouse labels fuzzily', () => {
    const warehouse = __test__.resolveWarehouseOption([
      { value: 'warehouse-bnsuk-ashford', label: 'Ashford, U.K.', recent: true },
      { value: 'warehouse-4px-uspdx', label: 'Portland, U.S. (Tax-free)', recent: false },
    ], 'ashford');

    expect(warehouse.value).toBe('warehouse-bnsuk-ashford');
  });

  it('finds the newly created shipment by id diff', () => {
    const before: BuyandshipShipment[] = [
      { id: 1, courier_trackno: 'OLD-1' },
      { id: 2, courier_trackno: 'OLD-2' },
    ];
    const after: BuyandshipShipment[] = [
      { id: 3, courier_trackno: 'NEW-3' },
      { id: 1, courier_trackno: 'OLD-1' },
      { id: 2, courier_trackno: 'OLD-2' },
    ];

    expect(__test__.pickNewShipment(before, after)?.id).toBe(3);
  });

  it('finds a draft record in list-shaped datasets', () => {
    const dataset = {
      shipments: [
        { record_id: 'row-1', warehouse: 'Ashford, U.K.' },
        { id: 'row-2', warehouse: 'Portland, U.S. (Tax-free)' },
      ],
    };

    expect(__test__.findDraftRecord(dataset, 'row-2')).toEqual({ id: 'row-2', warehouse: 'Portland, U.S. (Tax-free)' });
  });

  it('submits declarations by default unless dry-run is requested', () => {
    expect(__test__.shouldSubmitDeclaration({})).toBe(true);
    expect(__test__.shouldSubmitDeclaration({ execute: true })).toBe(true);
    expect(__test__.shouldSubmitDeclaration({ execute: false })).toBe(false);
    expect(__test__.shouldSubmitDeclaration({ 'dry-run': true })).toBe(false);
  });
});
