-- Allows `billing` user to run `prisma migrate dev` (shadow database creation).
-- Runs only on first MySQL container init. Existing volumes: use SHADOW_DATABASE_URL with root, or `prisma migrate deploy`.
GRANT CREATE ON *.* TO 'billing'@'%';
FLUSH PRIVILEGES;
