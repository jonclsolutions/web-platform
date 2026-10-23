-- =============================================================================
-- @file 2026_10_23_shop_orders_vat_contact_retention.sql
-- @path database/migrations/2026_10_23_shop_orders_vat_contact_retention.sql
-- @project RPSW Web
-- @author RPSW
-- @created 2026-10-23
-- @description Shop order data required by EU / CZ law (open findings #21, #22, #23):
--   1. shop_order_items.vat_rate  - the VAT rate of every line is stored at the time of the
--      sale. Before, the rate was dropped (no column) and every recalculation / invoice used
--      21 %, so orders with reduced-rate products (12 %, 0 %) showed a wrong VAT.
--   2. shop_orders.customer_*     - contact of the buyer as given for THIS order (snapshot).
--      The order is an accounting document: it must keep the buyer's name even when the
--      customer master record is later changed or anonymised (GDPR erasure), and checkout no
--      longer overwrites the master data of an existing customer.
--   3. fk_shop_orders_customer    - ON DELETE RESTRICT instead of CASCADE: permanently
--      deleting a customer deleted all his orders / invoices, which must be kept for the
--      accounting retention period (CZ: 10 years). The API refuses such a delete (409) and
--      offers the anonymisation instead.
-- @note Run once on MariaDB / MySQL (InnoDB). Idempotent parts are guarded where MariaDB
--   allows it (ADD COLUMN IF NOT EXISTS, DROP FOREIGN KEY IF EXISTS). Back up the database
--   before running it. The backfills use the CURRENT catalogue / customer data - the best
--   available value for orders created before this migration. No START TRANSACTION: every
--   ALTER TABLE commits implicitly in MySQL / MariaDB, a transaction would only pretend.
-- =============================================================================

-- 1. VAT rate of every order line -------------------------------------------------------
ALTER TABLE `shop_order_items`
  ADD COLUMN IF NOT EXISTS `vat_rate` decimal(5,2) NOT NULL DEFAULT 21.00
    COMMENT 'VAT rate in % at the time of the sale' AFTER `total_price`;

-- Backfill: variant price row first, else the product price row (variant_id NULL).
UPDATE `shop_order_items` i
  LEFT JOIN `shop_product_prices` vp ON vp.`variant_id` = i.`product_variant_id`
  LEFT JOIN `shop_product_prices` pp ON pp.`product_id` = i.`product_id` AND pp.`variant_id` IS NULL
SET i.`vat_rate` = COALESCE(vp.`vat_rate`, pp.`vat_rate`, 21.00);

-- Orders created before: recompute tax_amount with the real rates (same formula as the API:
-- line total × (1 - discount share) × rate / (100 + rate)).
UPDATE `shop_orders` o
  JOIN (
    SELECT i.`order_id`,
           SUM(i.`total_price` * i.`vat_rate` / (100 + i.`vat_rate`)) AS gross_tax,
           SUM(i.`total_price`) AS items_total
    FROM `shop_order_items` i
    GROUP BY i.`order_id`
  ) t ON t.`order_id` = o.`id`
SET o.`tax_amount` = ROUND(
  CASE WHEN t.items_total > 0
       THEN t.gross_tax * (t.items_total - o.`discount_amount`) / t.items_total
       ELSE 0 END, 2);

-- 2. Buyer contact snapshot on the order ------------------------------------------------
ALTER TABLE `shop_orders`
  ADD COLUMN IF NOT EXISTS `customer_first_name` varchar(100) DEFAULT NULL COMMENT 'Buyer as given for this order' AFTER `customer_id`,
  ADD COLUMN IF NOT EXISTS `customer_last_name`  varchar(100) DEFAULT NULL AFTER `customer_first_name`,
  ADD COLUMN IF NOT EXISTS `customer_email`      varchar(150) DEFAULT NULL AFTER `customer_last_name`,
  ADD COLUMN IF NOT EXISTS `customer_phone`      varchar(20)  DEFAULT NULL AFTER `customer_email`,
  ADD COLUMN IF NOT EXISTS `customer_company`    varchar(150) DEFAULT NULL AFTER `customer_phone`;

UPDATE `shop_orders` o
  JOIN `shop_customers` c ON c.`id` = o.`customer_id`
SET o.`customer_first_name` = c.`first_name`,
    o.`customer_last_name`  = c.`last_name`,
    o.`customer_email`      = c.`email`,
    o.`customer_phone`      = c.`phone`,
    o.`customer_company`    = c.`company`
WHERE o.`customer_first_name` IS NULL;

-- 3. Orders must survive the customer (accounting retention) ---------------------------
ALTER TABLE `shop_orders` DROP FOREIGN KEY IF EXISTS `fk_shop_orders_customer`;
ALTER TABLE `shop_orders`
  ADD CONSTRAINT `fk_shop_orders_customer` FOREIGN KEY (`customer_id`)
  REFERENCES `shop_customers` (`id`) ON DELETE RESTRICT;
