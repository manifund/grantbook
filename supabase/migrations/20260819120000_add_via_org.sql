-- Funding-side intermediary: the vehicle a grant flowed through (Manifund,
-- SFF, EA Funds), distinct from the ultimate funder (Jaan Tallinn, an
-- individual Manifund donor) and from the recipient-side fiscal sponsor.
-- Lets the UI filter by vehicle and by ultimate source independently.

ALTER TABLE grants ADD COLUMN IF NOT EXISTS via_org_id uuid REFERENCES orgs(id);
CREATE INDEX IF NOT EXISTS grants_via_idx ON grants (via_org_id);
