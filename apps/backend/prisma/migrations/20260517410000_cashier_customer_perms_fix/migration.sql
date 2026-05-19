-- Grant cashiers customer search/create after RBAC tables exist.
-- Permissions rows are created by seed; this is a no-op until permissions exist.
-- Safe on fresh deploy (0 rows). Re-run seed if you skip seed and need these rows.
INSERT INTO `role_permissions` (`role_id`, `permission_code`, `created_at`)
SELECT 'role-cashier', p.code, NOW(3)
FROM `permissions` p
WHERE p.code IN ('master.customer.view', 'master.customer.create')
ON DUPLICATE KEY UPDATE `created_at` = VALUES(`created_at`);
