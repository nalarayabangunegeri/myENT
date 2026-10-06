-- Satu pinjam aktif per barang (tak bisa dipinjam 2 orang bersamaan).
CREATE UNIQUE INDEX "loans_one_active_per_item"
  ON "loans" ("item_id")
  WHERE "status" IN ('ACTIVE', 'OVERDUE');
