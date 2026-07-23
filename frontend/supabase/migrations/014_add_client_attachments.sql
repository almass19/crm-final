-- Client attachments (contracts, etc. stored as PDF in Supabase Storage)

CREATE TABLE client_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by_id uuid NOT NULL REFERENCES profiles(id),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_client_attachments_client ON client_attachments(client_id);

ALTER TABLE client_attachments ENABLE ROW LEVEL SECURITY;

-- Same visibility rule as the clients table itself: admins/sales/lead designers
-- see everything, targetologists/designers only see their own assigned clients.
CREATE POLICY "client_attachments_select" ON client_attachments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clients c
    JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = client_attachments.client_id
    AND (
      p.role IN ('ADMIN', 'SALES_MANAGER', 'LEAD_DESIGNER')
      OR (p.role = 'TARGETOLOGIST' AND c.assigned_to_id = auth.uid())
      OR (p.role = 'DESIGNER' AND c.designer_id = auth.uid())
    )
  )
);

-- Inserts/deletes are performed server-side via the service role after the
-- API route has already checked access, so these policies are defense in
-- depth for any direct/browser access rather than the primary gate.
CREATE POLICY "client_attachments_insert" ON client_attachments FOR INSERT WITH CHECK (
  auth.uid() = uploaded_by_id
  AND EXISTS (
    SELECT 1 FROM clients c
    JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = client_attachments.client_id
    AND (
      p.role IN ('ADMIN', 'SALES_MANAGER', 'LEAD_DESIGNER')
      OR (p.role = 'TARGETOLOGIST' AND c.assigned_to_id = auth.uid())
      OR (p.role = 'DESIGNER' AND c.designer_id = auth.uid())
    )
  )
);

CREATE POLICY "client_attachments_delete" ON client_attachments FOR DELETE USING (
  auth.uid() = uploaded_by_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Private storage bucket for the actual PDF files. Objects are only ever
-- read/written via the service-role client in the API routes (which check
-- client access first), so no anon/authenticated storage.objects policies
-- are added here — the private bucket denies direct access by default.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-attachments', 'client-attachments', false, 15728640, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
