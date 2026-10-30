-- P2-06: renk başına düşük stok eşiği (null = varsayılan 500 g)
alter table material_colors
  add column if not exists low_stock_grams integer;

comment on column material_colors.low_stock_grams is
  'Düşük stok uyarı eşiği (gram). NULL ise uygulama varsayılan 500 g kullanır.';
