-- Add REFUND status to client_status enum ("Возврат")
ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'REFUND';
