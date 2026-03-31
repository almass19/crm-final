-- Fix payments_select policy: add TARGETOLOGIST and LEAD_DESIGNER
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('ADMIN', 'SALES_MANAGER', 'TARGETOLOGIST', 'LEAD_DESIGNER')
  )
);
