/**
 * @deprecated Import from `@/lib/distributors/import-patch`. This file only
 * re-exports the address-diff helper. Customer type is not inferred.
 */
export {
  addressFieldsChanged,
  distributorImportPatch,
  formatFullAddress,
  indexDocsByName,
} from './import-patch'
export type {
  DistributorImportFields,
  DistributorImportPatch,
  DistributorRegion,
} from './import-patch'
