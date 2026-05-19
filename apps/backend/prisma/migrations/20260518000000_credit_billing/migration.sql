-- AlterTable
ALTER TABLE `bills` ADD COLUMN `is_credit` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `credit_note` VARCHAR(191) NULL;

-- AlterEnum (MySQL: extend payment mode)
ALTER TABLE `bills` MODIFY `payment_mode` ENUM('CASH', 'CARD', 'UPI', 'SPLIT', 'CREDIT') NULL;
ALTER TABLE `bill_payments` MODIFY `mode` ENUM('CASH', 'CARD', 'UPI', 'SPLIT', 'CREDIT') NOT NULL;
