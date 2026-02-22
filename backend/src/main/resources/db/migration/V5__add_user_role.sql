-- Add role column to app_users table
ALTER TABLE app_users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER';
