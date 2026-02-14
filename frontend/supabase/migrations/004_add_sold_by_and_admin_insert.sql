-- Add sold_by_id column to clients
ALTER TABLE clients ADD COLUMN sold_by_id uuid REFERENCES profiles(id);

-- Index for sold_by_id
CREATE INDEX idx_clients_sold_by ON clients(sold_by_id);

-- Drop old insert policy and create new one allowing ADMIN and SALES_MANAGER
DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SALES_MANAGER', 'ADMIN'))
  );
