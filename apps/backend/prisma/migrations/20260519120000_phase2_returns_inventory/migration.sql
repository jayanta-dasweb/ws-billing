-- Phase 2: Sales returns, stock adjustments, immutable stock movements

-- CreateTable
CREATE TABLE `return_sequences` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `prefix` VARCHAR(191) NOT NULL DEFAULT 'RET',
    `last_no` INTEGER NOT NULL DEFAULT 0,
    `year` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_returns` (
    `id` VARCHAR(191) NOT NULL,
    `return_no` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `return_type` ENUM('FULL', 'PARTIAL') NOT NULL,
    `bill_id` VARCHAR(191) NOT NULL,
    `counter_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `refund_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `refund_mode` ENUM('CASH', 'CARD', 'UPI', 'SPLIT', 'CREDIT') NULL,
    `refund_note` TEXT NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_returns_return_no_key`(`return_no`),
    INDEX `sales_returns_bill_id_idx`(`bill_id`),
    INDEX `sales_returns_status_idx`(`status`),
    INDEX `sales_returns_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_return_items` (
    `id` VARCHAR(191) NOT NULL,
    `return_id` VARCHAR(191) NOT NULL,
    `bill_item_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `batch_number` VARCHAR(191) NULL,
    `qty` DECIMAL(12, 3) NOT NULL,
    `rate` DECIMAL(12, 2) NOT NULL,
    `line_total` DECIMAL(12, 2) NOT NULL,
    `reason` TEXT NULL,

    INDEX `sales_return_items_return_id_idx`(`return_id`),
    INDEX `sales_return_items_bill_item_id_idx`(`bill_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `adj_no` VARCHAR(191) NULL,
    `batch_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `qty_delta` DECIMAL(12, 3) NOT NULL,
    `reason` ENUM('PHYSICAL_COUNT', 'DAMAGE', 'EXPIRED', 'THEFT', 'CORRECTION', 'OTHER') NOT NULL,
    `notes` TEXT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_adjustments_adj_no_key`(`adj_no`),
    INDEX `stock_adjustments_batch_id_idx`(`batch_id`),
    INDEX `stock_adjustments_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `movement_type` ENUM('SALE_COMMIT', 'SALE_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'OPENING') NOT NULL,
    `qty_delta` DECIMAL(12, 3) NOT NULL,
    `qty_before` DECIMAL(12, 3) NOT NULL,
    `qty_after` DECIMAL(12, 3) NOT NULL,
    `reference_type` VARCHAR(191) NOT NULL,
    `reference_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_batch_id_created_at_idx`(`batch_id`, `created_at`),
    INDEX `stock_movements_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    INDEX `stock_movements_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_counter_id_fkey` FOREIGN KEY (`counter_id`) REFERENCES `counters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_return_id_fkey` FOREIGN KEY (`return_id`) REFERENCES `sales_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_bill_item_id_fkey` FOREIGN KEY (`bill_item_id`) REFERENCES `bill_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `batch_stock`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `batch_stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `batch_stock`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `return_sequences` (`id`, `prefix`, `last_no`, `year`) VALUES ('default', 'RET', 0, YEAR(CURDATE()));
