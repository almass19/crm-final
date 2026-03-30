-- Add PAUSED status to client_status enum
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'PAUSED';

-- Migrate existing LAUNCHED clients to IN_WORK
UPDATE clients SET status = 'IN_WORK' WHERE status = 'LAUNCHED';
