-- Payment audit: cheque, DD, structured JSON per payment line
ALTER TABLE `bills` MODIFY `payment_mode` ENUM('CASH', 'CARD', 'UPI', 'CHEQUE', 'DD', 'SPLIT', 'CREDIT') NULL;
ALTER TABLE `bill_payments` MODIFY `mode` ENUM('CASH', 'CARD', 'UPI', 'CHEQUE', 'DD', 'SPLIT', 'CREDIT') NOT NULL;
ALTER TABLE `bill_payments` ADD COLUMN `audit_json` JSON NULL;
ALTER TABLE `sales_returns` MODIFY `refund_mode` ENUM('CASH', 'CARD', 'UPI', 'CHEQUE', 'DD', 'SPLIT', 'CREDIT') NULL;
