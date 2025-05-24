# Map Data Ingest Directory

Place CSV files containing retail account location data in this directory to be processed and added to the map.

## File Format Requirements

CSV files should contain the following columns:
- `Retail Accounts` - Name of the retail establishment
- `Address` - Street address
- `City` - City name
- `State` - State abbreviation (e.g., NY)
- `Zip Code` - Postal code
- `Market Types` - Optional. Type of establishment (e.g., RESTAURANT, BAR, SUPERMARKET)

Example format:
```
Retail Accounts,Address,City,Account #,State,Zip Code,Phone,Market Types
MACGREGORS #03,300 JEFFERSON RD,ROCHESTER,J5530,NY,14623,5854278410,RESTAURANT/BAR
WEGMAN'S #67 TITUS,525 TITUS AVENUE,ROCHESTER,W2597,NY,14617,5852664090,SUPERMARKET
```

## Supported Market Types

The system recognizes and uses appropriate icons for the following market types:

- **SUPERMARKET, GROCERY-GENERAL** → Grocery icon
- **RESTAURANT, RESTAURANT/BAR, ITALIAN** → Restaurant icon
- **BAR, COLLEGE BAR, SPORTS BAR, BAR/TAVERN, COCKTAIL LOUNGE** → Bar icon
- **CONVENIENCE-GEN, GAS & CONVENIEN** → Convenience store icon
- **MARINA/LAKE, BOWLING ALLEY, DRIVE-THRU, DELI** → Recreation icon
- **GOLF-PUBLIC, CTRY/GOLF CLUB** → Golf icon
- All other types → Generic retail icon

If the `Market Types` column is not provided, all locations will use the generic retail icon.

## Processing

The system will automatically process all CSV files in this directory once per day. Files are processed as-is and are not removed after processing.

To force immediate processing, you can manually trigger the "Update Map" workflow in GitHub Actions. 