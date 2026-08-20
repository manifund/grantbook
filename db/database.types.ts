// Hand-written to match supabase/migrations/20260819000000_init.sql.
// Once the Supabase project exists, regenerate with `bun run gen-types`.

type OrgRow = {
  id: string
  slug: string
  name: string
  org_type: 'organization' | 'fund' | 'foundation' | 'individual' | 'government' | 'project'
  website: string | null
  description: string | null
  needs_review: boolean
  created_at: string
  updated_at: string
}

type OrgNameRow = {
  id: string
  org_id: string
  name: string
  normalized: string
  kind: 'canonical' | 'former_name' | 'alias' | 'abbreviation'
  valid_from: string | null
  valid_to: string | null
  note: string | null
}

type SourceRow = {
  id: string
  name: string
  url: string | null
  license: string | null
  tier: number
  last_ingested_at: string | null
  notes: string | null
}

type SourceRecordRow = {
  id: string
  source_id: string
  source_record_key: string
  raw: Json
  content_hash: string
  first_seen_at: string
  last_seen_at: string
  removed_at: string | null
}

type CauseAreaRow = {
  id: string
  slug: string
  name: string
  parent_id: string | null
}

type GrantRow = {
  id: string
  funder_org_id: string
  recipient_org_id: string
  fiscal_sponsor_org_id: string | null
  amount: number | null
  currency: string
  amount_usd: number | null
  grant_date: string | null
  date_precision: 'day' | 'month' | 'year' | null
  description: string | null
  round: string | null
  url: string | null
  status: 'approved' | 'pending' | 'rejected' | 'superseded'
  superseded_by: string | null
  created_at: string
  updated_at: string
}

type GrantCauseAreaRow = {
  grant_id: string
  cause_area_id: string
}

type GrantViaRow = {
  grant_id: string
  via_org_id: string
}

type GrantSourceRow = {
  grant_id: string
  source_record_id: string
  is_primary: boolean
}

type DedupCandidateRow = {
  id: string
  grant_id_a: string
  grant_id_b: string
  score: number | null
  reason: string | null
  status: 'pending' | 'merged' | 'distinct'
  resolved_at: string | null
}

type WithOptional<Row, K extends keyof Row> = Omit<Row, K> & Partial<Pick<Row, K>>

type Table<Row, InsertOptional extends keyof Row> = {
  Row: Row
  Insert: WithOptional<Row, InsertOptional>
  Update: Partial<Row>
  Relationships: []
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      orgs: Table<
        OrgRow,
        'id' | 'org_type' | 'website' | 'description' | 'needs_review' | 'created_at' | 'updated_at'
      >
      org_names: Table<OrgNameRow, 'id' | 'kind' | 'valid_from' | 'valid_to' | 'note'>
      sources: Table<SourceRow, 'url' | 'license' | 'tier' | 'last_ingested_at' | 'notes'>
      source_records: Table<SourceRecordRow, 'id' | 'first_seen_at' | 'last_seen_at' | 'removed_at'>
      cause_areas: Table<CauseAreaRow, 'id' | 'parent_id'>
      grants: Table<
        GrantRow,
        | 'id'
        | 'fiscal_sponsor_org_id'
        | 'amount'
        | 'currency'
        | 'amount_usd'
        | 'grant_date'
        | 'date_precision'
        | 'description'
        | 'round'
        | 'url'
        | 'status'
        | 'superseded_by'
        | 'created_at'
        | 'updated_at'
      >
      grant_cause_areas: Table<GrantCauseAreaRow, never>
      grant_sources: Table<GrantSourceRow, 'is_primary'>
      grant_vias: Table<GrantViaRow, never>
      dedup_candidates: Table<
        DedupCandidateRow,
        'id' | 'score' | 'reason' | 'status' | 'resolved_at'
      >
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
