-- Customer portal: OTP verification for forgot-password flow
CREATE TABLE `customer_otp_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `mobile` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `code_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_otp_challenges_customer_id_purpose_idx`(`customer_id`, `purpose`),
    INDEX `customer_otp_challenges_mobile_purpose_idx`(`mobile`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer_otp_challenges` ADD CONSTRAINT `customer_otp_challenges_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
