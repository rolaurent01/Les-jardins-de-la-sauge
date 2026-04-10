-- Colonne pour tracker la dernière consultation d'un ticket par l'utilisateur
ALTER TABLE support_tickets ADD COLUMN user_last_seen_at TIMESTAMPTZ;

-- Permettre à l'utilisateur de mettre à jour ce champ sur ses propres tickets
CREATE POLICY "support_tickets_update_own_last_seen"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
