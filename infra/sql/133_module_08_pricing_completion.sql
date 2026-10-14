begin;

alter table pricing_grids
  add column if not exists weight_volume_switch_kg_per_cbm numeric(14,4);

alter table pricing_tiers
  add column if not exists calculation_method text not null default 'PER_UNIT';

alter table pricing_tiers
  drop constraint if exists pricing_tiers_calculation_method_check;

alter table pricing_tiers
  add constraint pricing_tiers_calculation_method_check
  check (calculation_method in ('PER_KG','PER_CBM','PER_PACKAGE','PER_UNIT','PERCENT_VALUE','FIXED'));

alter table pricing_tiers
  drop constraint if exists pricing_tiers_quantity_range_check;

alter table pricing_tiers
  add constraint pricing_tiers_quantity_range_check
  check (max_quantity is null or max_quantity > min_quantity);

alter table pricing_tiers
  drop constraint if exists pricing_tiers_grid_id_basis_min_quantity_key;

create unique index if not exists pricing_tiers_base_range_unique
  on pricing_tiers(grid_id, basis, min_quantity) where rule_id is null;

create unique index if not exists pricing_tiers_rule_range_unique
  on pricing_tiers(grid_id, rule_id, basis, min_quantity) where rule_id is not null;

alter table pricing_grids
  drop constraint if exists pricing_grids_weight_volume_switch_check;

alter table pricing_grids
  add constraint pricing_grids_weight_volume_switch_check
  check (weight_volume_switch_kg_per_cbm is null or weight_volume_switch_kg_per_cbm > 0);

commit;
