import * as migration_20251107_043628_import_beers_from_csv from './20251107_043628_import_beers_from_csv';
import * as migration_20251108_213620_fix_draft_price from './20251108_213620_fix_draft_price';
import * as migration_20251108_215500_seed_locations from './20251108_215500_seed_locations';
import * as migration_20251108_220000_import_menus_from_csv from './20251108_220000_import_menus_from_csv';

export const migrations = [
  {
    up: migration_20251107_043628_import_beers_from_csv.up,
    down: migration_20251107_043628_import_beers_from_csv.down,
    name: '20251107_043628_import_beers_from_csv',
  },
  {
    up: migration_20251108_213620_fix_draft_price.up,
    down: migration_20251108_213620_fix_draft_price.down,
    name: '20251108_213620_fix_draft_price'
  },
  {
    up: migration_20251108_215500_seed_locations.up,
    down: migration_20251108_215500_seed_locations.down,
    name: '20251108_215500_seed_locations'
  },
  {
    up: migration_20251108_220000_import_menus_from_csv.up,
    down: migration_20251108_220000_import_menus_from_csv.down,
    name: '20251108_220000_import_menus_from_csv'
  },
];
