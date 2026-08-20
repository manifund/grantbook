-- A grant can flow through more than one vehicle (e.g. Anton Makiievskyi →
-- grantmaking.ai → Manifund → project), so the single via_org_id column
-- becomes a join table.

CREATE TABLE IF NOT EXISTS grant_vias (
  grant_id   uuid NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  via_org_id uuid NOT NULL REFERENCES orgs(id),
  PRIMARY KEY (grant_id, via_org_id)
);
CREATE INDEX IF NOT EXISTS grant_vias_org_idx ON grant_vias (via_org_id);

ALTER TABLE grant_vias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON grant_vias FOR SELECT USING (true);

INSERT INTO grant_vias (grant_id, via_org_id)
  SELECT id, via_org_id FROM grants WHERE via_org_id IS NOT NULL
  ON CONFLICT DO NOTHING;

ALTER TABLE grants DROP COLUMN IF EXISTS via_org_id;
