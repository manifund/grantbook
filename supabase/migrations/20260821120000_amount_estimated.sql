-- Estimated amounts: flagged per grant, with a note explaining how the
-- figure was derived. Estimates count toward totals; the UI and exports
-- mark them.
alter table grants add column if not exists amount_estimated boolean not null default false;
alter table grants add column if not exists estimate_note text;
