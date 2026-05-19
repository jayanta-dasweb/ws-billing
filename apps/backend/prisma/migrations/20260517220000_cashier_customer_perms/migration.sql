-- Allow cashiers to search/create customers from billing (permission-gated, no ADMIN role required)
INSERT INTO `role_permissions` (`role_id`, `permission_code`, `created_at`) VALUES
('role-cashier', 'master.customer.view', NOW(3)),
('role-cashier', 'master.customer.create', NOW(3))
ON DUPLICATE KEY UPDATE `created_at` = `created_at`;
