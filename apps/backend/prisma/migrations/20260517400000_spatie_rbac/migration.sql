-- Roles table
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `roles` (`id`, `key`, `name`, `description`, `is_system`, `is_active`, `updated_at`) VALUES
('role-super-admin', 'super_admin', 'Super Admin', 'Full system access', true, true, NOW(3)),
('role-admin', 'admin', 'Admin', 'Manage masters and security', true, true, NOW(3)),
('role-cashier', 'cashier', 'Cashier', 'Billing counter only', true, true, NOW(3));

ALTER TABLE `users` ADD COLUMN `role_id` VARCHAR(191) NULL;

UPDATE `users` SET `role_id` = 'role-super-admin' WHERE `role` = 'SUPER_ADMIN';
UPDATE `users` SET `role_id` = 'role-admin' WHERE `role` = 'ADMIN';
UPDATE `users` SET `role_id` = 'role-cashier' WHERE `role` = 'CASHIER';

-- Permissions: rebuild with Spatie columns
CREATE TABLE `permissions_new` (
    `code` VARCHAR(191) NOT NULL,
    `group_key` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `permissions_new_group_key_resource_idx`(`group_key`, `resource`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `user_permissions`;
DROP TABLE `permissions`;

ALTER TABLE `permissions_new` RENAME TO `permissions`;

CREATE TABLE `role_permissions` (
    `role_id` VARCHAR(191) NOT NULL,
    `permission_code` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`role_id`, `permission_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_permissions` (
    `user_id` VARCHAR(191) NOT NULL,
    `permission_code` VARCHAR(191) NOT NULL,
    `granted` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`user_id`, `permission_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_code_fkey` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_permission_code_fkey` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;
