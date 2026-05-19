CREATE TABLE `user_counters` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `counter_id` VARCHAR(191) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_counters_counter_id_idx`(`counter_id`),
    UNIQUE INDEX `user_counters_user_id_counter_id_key`(`user_id`, `counter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `counter_ip_rules` (
    `id` VARCHAR(191) NOT NULL,
    `counter_id` VARCHAR(191) NOT NULL,
    `cidr` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `counter_ip_rules_counter_id_idx`(`counter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `role_permissions` (
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'CASHIER') NOT NULL,
    `permission_code` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`role`, `permission_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_permissions` (
    `user_id` VARCHAR(191) NOT NULL,
    `permission_code` VARCHAR(191) NOT NULL,
    `granted` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`user_id`, `permission_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `user_counters` (`id`, `user_id`, `counter_id`, `is_primary`)
SELECT CONCAT('uc-', `id`), `id`, `counter_id`, true
FROM `users`
WHERE `counter_id` IS NOT NULL;

ALTER TABLE `user_counters` ADD CONSTRAINT `user_counters_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_counters` ADD CONSTRAINT `user_counters_counter_id_fkey` FOREIGN KEY (`counter_id`) REFERENCES `counters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `counter_ip_rules` ADD CONSTRAINT `counter_ip_rules_counter_id_fkey` FOREIGN KEY (`counter_id`) REFERENCES `counters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_code_fkey` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_permission_code_fkey` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;
