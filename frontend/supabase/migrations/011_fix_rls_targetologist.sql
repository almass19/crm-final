-- Fix clients_select policy: SPECIALIST was renamed to TARGETOLOGIST
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND (
      p.role IN ('ADMIN', 'SALES_MANAGER', 'LEAD_DESIGNER')
      OR (p.role = 'TARGETOLOGIST' AND clients.assigned_to_id = auth.uid())
      OR (p.role = 'DESIGNER' AND clients.designer_id = auth.uid())
    )
  )
);

-- Fix clients_update policy if it also uses old SPECIALIST role
DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid()
    AND (
      p.role IN ('ADMIN', 'SALES_MANAGER', 'LEAD_DESIGNER')
      OR (p.role = 'TARGETOLOGIST' AND clients.assigned_to_id = auth.uid())
      OR (p.role = 'DESIGNER' AND clients.designer_id = auth.uid())
    )
  )
);
