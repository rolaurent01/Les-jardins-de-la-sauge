-- ============================================================
-- Migration 043 : Module Assistance (changelog + support tickets)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Types ENUM
-- ────────────────────────────────────────────────────────────

CREATE TYPE changelog_entry_type AS ENUM ('feature', 'improvement', 'fix');

CREATE TYPE support_ticket_type AS ENUM ('bug', 'suggestion', 'question');
CREATE TYPE support_ticket_priority AS ENUM ('low', 'normal', 'urgent');
CREATE TYPE support_ticket_status AS ENUM ('new', 'in_progress', 'resolved', 'closed');


-- ────────────────────────────────────────────────────────────
-- 2. changelog_entries — Entrées changelog (global plateforme)
-- ────────────────────────────────────────────────────────────

CREATE TABLE changelog_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL CHECK (char_length(title) <= 300),
  description TEXT NOT NULL CHECK (char_length(description) <= 5000),
  type        changelog_entry_type NOT NULL DEFAULT 'feature',
  published   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE changelog_entries IS 'Entrées du changelog — publiées par les platform admins, visibles par tous les utilisateurs authentifiés.';

-- Index pour le tri par date (desc)
CREATE INDEX idx_changelog_entries_published ON changelog_entries (published, created_at DESC);

-- Trigger updated_at
CREATE TRIGGER trg_changelog_entries_updated_at
  BEFORE UPDATE ON changelog_entries
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ────────────────────────────────────────────────────────────
-- 3. changelog_reads — Suivi de lecture par utilisateur
-- ────────────────────────────────────────────────────────────

CREATE TABLE changelog_reads (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id  UUID NOT NULL REFERENCES changelog_entries(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (entry_id, user_id)
);

COMMENT ON TABLE changelog_reads IS 'Suivi de lecture des entrées changelog par utilisateur.';

CREATE INDEX idx_changelog_reads_user ON changelog_reads (user_id);


-- ────────────────────────────────────────────────────────────
-- 4. support_tickets — Tickets de support (scopés par org)
-- ────────────────────────────────────────────────────────────

CREATE TABLE support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         VARCHAR(300) NOT NULL,
  description     TEXT NOT NULL CHECK (char_length(description) <= 5000),
  type            support_ticket_type NOT NULL DEFAULT 'bug',
  priority        support_ticket_priority NOT NULL DEFAULT 'normal',
  status          support_ticket_status NOT NULL DEFAULT 'new',
  page_url        TEXT,
  screenshot_url  TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  assigned_to     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE support_tickets IS 'Tickets de support — créés par les utilisateurs, gérés par les platform admins.';

CREATE INDEX idx_support_tickets_org ON support_tickets (organization_id, created_at DESC);
CREATE INDEX idx_support_tickets_status ON support_tickets (status);
CREATE INDEX idx_support_tickets_created_by ON support_tickets (created_by);

-- Trigger updated_at
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ────────────────────────────────────────────────────────────
-- 5. support_ticket_messages — Fil de discussion
-- ────────────────────────────────────────────────────────────

CREATE TABLE support_ticket_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES auth.users(id),
  content        TEXT NOT NULL CHECK (char_length(content) <= 5000),
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE support_ticket_messages IS 'Messages dans le fil de discussion d''un ticket de support.';

CREATE INDEX idx_ticket_messages_ticket ON support_ticket_messages (ticket_id, created_at ASC);


-- ────────────────────────────────────────────────────────────
-- 6. Storage bucket pour les captures d'écran
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-screenshots',
  'support-screenshots',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 7. RLS — changelog_entries
-- ────────────────────────────────────────────────────────────

ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifié peut lire les entrées publiées
CREATE POLICY "changelog_entries_select_published"
  ON changelog_entries FOR SELECT
  TO authenticated
  USING (published = true);

-- Les platform admins voient tout (y compris brouillons)
CREATE POLICY "changelog_entries_select_admin"
  ON changelog_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );

-- Seuls les platform admins peuvent insérer/modifier/supprimer
CREATE POLICY "changelog_entries_insert_admin"
  ON changelog_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "changelog_entries_update_admin"
  ON changelog_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "changelog_entries_delete_admin"
  ON changelog_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 8. RLS — changelog_reads
-- ────────────────────────────────────────────────────────────

ALTER TABLE changelog_reads ENABLE ROW LEVEL SECURITY;

-- Un utilisateur ne voit/gère que ses propres lectures
CREATE POLICY "changelog_reads_select_own"
  ON changelog_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "changelog_reads_insert_own"
  ON changelog_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Les platform admins voient toutes les lectures (stats)
CREATE POLICY "changelog_reads_select_admin"
  ON changelog_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 9. RLS — support_tickets
-- ────────────────────────────────────────────────────────────

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Un utilisateur voit ses propres tickets
CREATE POLICY "support_tickets_select_own"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Les platform admins voient tous les tickets
CREATE POLICY "support_tickets_select_admin"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );

-- Un utilisateur authentifié peut créer un ticket
CREATE POLICY "support_tickets_insert_auth"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Seuls les platform admins peuvent modifier un ticket (statut, assignation)
CREATE POLICY "support_tickets_update_admin"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );

-- Seuls les platform admins peuvent supprimer un ticket
CREATE POLICY "support_tickets_delete_admin"
  ON support_tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 10. RLS — support_ticket_messages
-- ────────────────────────────────────────────────────────────

ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Un utilisateur voit les messages de ses propres tickets
CREATE POLICY "ticket_messages_select_own"
  ON support_ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_ticket_messages.ticket_id
        AND support_tickets.created_by = auth.uid()
    )
  );

-- Les platform admins voient tous les messages
CREATE POLICY "ticket_messages_select_admin"
  ON support_ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );

-- Un utilisateur peut ajouter un message sur son propre ticket
CREATE POLICY "ticket_messages_insert_own"
  ON support_ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_ticket_messages.ticket_id
        AND support_tickets.created_by = auth.uid()
    )
  );

-- Les platform admins peuvent ajouter un message sur n'importe quel ticket
CREATE POLICY "ticket_messages_insert_admin"
  ON support_ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 11. RLS — Storage support-screenshots
-- ────────────────────────────────────────────────────────────

-- Lecture publique (les screenshots sont affichés dans les tickets)
CREATE POLICY "support_screenshots_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'support-screenshots');

-- Upload par les utilisateurs authentifiés
CREATE POLICY "support_screenshots_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'support-screenshots');

-- Suppression par les platform admins uniquement
CREATE POLICY "support_screenshots_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'support-screenshots'
    AND EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );
