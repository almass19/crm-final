-- Rename SPECIALIST role to TARGETOLOGIST
ALTER TYPE user_role RENAME VALUE 'SPECIALIST' TO 'TARGETOLOGIST';

-- Add new client workflow statuses for targeted advertising
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'ONBOARDING';
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'SETUP';
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'LAUNCHED';
