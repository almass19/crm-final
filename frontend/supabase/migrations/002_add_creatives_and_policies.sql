-- Migration 2: Create creatives table and update policies
-- Run AFTER 001_add_lead_designer_enum.sql has been committed.

-- 1. Create creatives table
CREATE TABLE creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  designer_id uuid NOT NULL REFERENCES profiles(id),
  count integer NOT NULL CHECK (count > 0),
  month text NOT NULL,  -- format: 'YYYY-MM'
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_creatives_client ON creatives(client_id);

-- 2. Enable RLS on creatives
ALTER TABLE creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creatives_select" ON creatives FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'DESIGNER', 'LEAD_DESIGNER'))
);
CREATE POLICY "creatives_insert" ON creatives FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('DESIGNER', 'LEAD_DESIGNER'))
);

-- 3. Update clients SELECT policy to include LEAD_DESIGNER
DROP POLICY "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
      p.role IN ('ADMIN', 'SALES_MANAGER', 'LEAD_DESIGNER')
      OR (p.role = 'SPECIALIST' AND clients.assigned_to_id = auth.uid())
      OR (p.role = 'DESIGNER' AND clients.designer_id = auth.uid())
    )
  )
);
