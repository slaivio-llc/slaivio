import { expect, it } from 'vitest';
import { warehouseFieldLabel } from './warehouse-labels';

it('translates technical field names without changing the submitted keys',()=>{
  expect(warehouseFieldLabel('capacity_packages')).toBe('Capacité en colis');
  expect(warehouseFieldLabel('assigned_name')).toBe('Responsable');
  expect(warehouseFieldLabel('aisle')).toBe('Allée');
});
it('does not expose unknown implementation identifiers as labels',()=>{
  expect(warehouseFieldLabel('internal_unknown_field')).toBe('Information complémentaire');
});
