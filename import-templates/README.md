# Import templates

Fill these in Excel (or any spreadsheet), save as `.xlsx` or `.csv`, then run from the project folder:

```
npm run import -- suppliers  import-templates/suppliers.csv
npm run import -- products   import-templates/products.csv
npm run import -- pos        import-templates/purchase-orders.csv
```

Add `--dry-run` to check a file without saving anything. Import suppliers and products before purchase orders.

- **Suppliers** are matched by `name` and updated if they already exist. `code` (2–4 letters) is the PO number prefix.
- **Products** are matched by `sku`. New brands are created automatically.
- **Purchase orders**: one row per line item. Rows with the same `po_number` form one PO. Leave `po_number` empty to have one generated; rows with an empty `po_number` are grouped by supplier + brand + order date. `status` is DRAFT, SENT or CONFIRMED. `paid_amount` (on any row of the PO) is recorded as already paid against the payment schedule. Unknown SKUs are created as products.
- Dates are `YYYY-MM-DD`.
