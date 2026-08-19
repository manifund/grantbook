-- Grantbook initial schema: a database of AI safety grants aggregated from
-- public sources (EA Funds, SFF, Manifund, Vipul Naik's donations list, ...).
--
-- Design notes:
-- * Raw source rows are preserved verbatim in source_records (jsonb) and
--   canonical grants are derived from them, linked via grant_sources. This is
--   the provenance and idempotency backbone: re-ingesting is always safe, and
--   cross-source duplicates merge without losing either source's record.
-- * One orgs table covers funders, grantees, fiscal sponsors, and individuals;
--   roles are derived from which side of a grant an org appears on (BERI is
--   both a donor and a donee). Renames (Open Philanthropy -> Coefficient
--   Giving, LTFF -> TAIF, ...) are date-ranged rows in org_names.
-- * grants.status anticipates v2 community submissions: ingested grants are
--   'approved'; merge losers become 'superseded'; retracted source rows
--   'rejected'. Public reads only see 'approved'.
-- * Unlike manifund, RLS policies are checked in here so prod is reproducible.

CREATE TABLE IF NOT EXISTS orgs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  org_type      text NOT NULL DEFAULT 'organization'
                CHECK (org_type IN ('organization', 'fund', 'foundation', 'individual', 'government', 'project')),
  website       text,
  description   text,
  needs_review  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_names (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  normalized  text NOT NULL,
  kind        text NOT NULL DEFAULT 'alias'
              CHECK (kind IN ('canonical', 'former_name', 'alias', 'abbreviation')),
  valid_from  date,
  valid_to    date,
  note        text,
  UNIQUE (org_id, normalized)
);
CREATE INDEX IF NOT EXISTS org_names_normalized_idx ON org_names (normalized);

CREATE TABLE IF NOT EXISTS sources (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  url               text,
  license           text,
  tier              int NOT NULL DEFAULT 1,
  last_ingested_at  timestamptz,
  notes             text
);

CREATE TABLE IF NOT EXISTS source_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id          text NOT NULL REFERENCES sources(id),
  source_record_key  text NOT NULL,
  raw                jsonb NOT NULL,
  content_hash       text NOT NULL,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  removed_at         timestamptz,
  UNIQUE (source_id, source_record_key)
);
CREATE INDEX IF NOT EXISTS source_records_source_idx ON source_records (source_id);

CREATE TABLE IF NOT EXISTS cause_areas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug      text NOT NULL UNIQUE,
  name      text NOT NULL,
  parent_id uuid REFERENCES cause_areas(id)
);

CREATE TABLE IF NOT EXISTS grants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_org_id         uuid NOT NULL REFERENCES orgs(id),
  recipient_org_id      uuid NOT NULL REFERENCES orgs(id),
  -- SFF-style fiscal sponsorship: recipient is who the money is for
  -- ("Organization"); sponsor is who legally receives it ("Receiving
  -- Charity") when the two differ.
  fiscal_sponsor_org_id uuid REFERENCES orgs(id),
  amount                numeric(14, 2),
  currency              text NOT NULL DEFAULT 'USD',
  amount_usd            numeric(14, 2),
  grant_date            date,
  date_precision        text CHECK (date_precision IN ('day', 'month', 'year')),
  description           text,
  round                 text,
  url                   text,
  status                text NOT NULL DEFAULT 'approved'
                        CHECK (status IN ('approved', 'pending', 'rejected', 'superseded')),
  superseded_by         uuid REFERENCES grants(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grants_funder_idx ON grants (funder_org_id);
CREATE INDEX IF NOT EXISTS grants_recipient_idx ON grants (recipient_org_id);
CREATE INDEX IF NOT EXISTS grants_date_idx ON grants (grant_date DESC);
CREATE INDEX IF NOT EXISTS grants_status_idx ON grants (status);
CREATE INDEX IF NOT EXISTS grants_amount_idx ON grants (amount_usd DESC);

CREATE TABLE IF NOT EXISTS grant_cause_areas (
  grant_id      uuid NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  cause_area_id uuid NOT NULL REFERENCES cause_areas(id),
  PRIMARY KEY (grant_id, cause_area_id)
);

CREATE TABLE IF NOT EXISTS grant_sources (
  grant_id         uuid NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  source_record_id uuid NOT NULL REFERENCES source_records(id),
  -- Exactly one primary per grant; the primary record's source wins field
  -- conflicts on merge.
  is_primary       boolean NOT NULL DEFAULT false,
  PRIMARY KEY (grant_id, source_record_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS grant_sources_record_uniq ON grant_sources (source_record_id);

CREATE TABLE IF NOT EXISTS dedup_candidates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id_a  uuid NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  grant_id_b  uuid NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  score       numeric,
  reason      text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'distinct')),
  resolved_at timestamptz,
  UNIQUE (grant_id_a, grant_id_b)
);

-- RLS: everything publicly readable (this is a public dataset); grants only
-- when approved. All writes go through the service role in scripts.
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cause_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_cause_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE dedup_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON orgs FOR SELECT USING (true);
CREATE POLICY "public read" ON org_names FOR SELECT USING (true);
CREATE POLICY "public read" ON sources FOR SELECT USING (true);
CREATE POLICY "public read" ON source_records FOR SELECT USING (true);
CREATE POLICY "public read" ON cause_areas FOR SELECT USING (true);
CREATE POLICY "public read approved" ON grants FOR SELECT USING (status = 'approved');
CREATE POLICY "public read" ON grant_cause_areas FOR SELECT USING (true);
CREATE POLICY "public read" ON grant_sources FOR SELECT USING (true);
CREATE POLICY "public read" ON dedup_candidates FOR SELECT USING (true);
