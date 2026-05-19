-- Spatie-style activity log fields (immutable audit trail)

ALTER TABLE `audit_logs`
  ADD COLUMN `username` VARCHAR(191) NULL,
  ADD COLUMN `role_key` VARCHAR(191) NULL,
  ADD COLUMN `counter_id` VARCHAR(191) NULL,
  ADD COLUMN `session_id` VARCHAR(191) NULL,
  ADD COLUMN `module` VARCHAR(191) NOT NULL DEFAULT 'system',
  ADD COLUMN `severity` ENUM('INFO', 'WARNING', 'CRITICAL', 'SECURITY_ALERT') NOT NULL DEFAULT 'INFO',
  ADD COLUMN `source` ENUM('MANUAL', 'SYSTEM', 'SCHEDULED', 'API') NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `success` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `reference_type` VARCHAR(191) NULL,
  ADD COLUMN `reference_id` VARCHAR(191) NULL,
  ADD COLUMN `before_data` JSON NULL,
  ADD COLUMN `after_data` JSON NULL,
  ADD COLUMN `properties` JSON NULL,
  ADD COLUMN `reason` TEXT NULL,
  ADD COLUMN `user_agent` VARCHAR(512) NULL,
  ADD COLUMN `request_source` VARCHAR(191) NULL,
  ADD COLUMN `batch_uuid` VARCHAR(191) NULL;

UPDATE `audit_logs` SET `module` = LOWER(`entity`) WHERE `module` = 'system';

UPDATE `audit_logs` SET `properties` = `metadata` WHERE `properties` IS NULL AND `metadata` IS NOT NULL;

CREATE INDEX `audit_logs_module_idx` ON `audit_logs`(`module`);
CREATE INDEX `audit_logs_action_idx` ON `audit_logs`(`action`);
CREATE INDEX `audit_logs_severity_idx` ON `audit_logs`(`severity`);
CREATE INDEX `audit_logs_reference_type_reference_id_idx` ON `audit_logs`(`reference_type`, `reference_id`);
CREATE INDEX `audit_logs_counter_id_idx` ON `audit_logs`(`counter_id`);
