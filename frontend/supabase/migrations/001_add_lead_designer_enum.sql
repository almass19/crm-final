-- Migration 1: Add LEAD_DESIGNER to user_role enum
-- This MUST be committed in its own transaction before the value can be used.
ALTER TYPE user_role ADD VALUE 'LEAD_DESIGNER';
