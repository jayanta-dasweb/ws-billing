-- Product & batch default discounts (% and per-unit ₹) applied when adding lines to a bill
ALTER TABLE `products`
  ADD COLUMN `discount_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0 AFTER `selling_price`,
  ADD COLUMN `discount_per_unit` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `discount_percent`;

ALTER TABLE `batch_stock`
  ADD COLUMN `discount_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0 AFTER `selling_price`,
  ADD COLUMN `discount_per_unit` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `discount_percent`;
