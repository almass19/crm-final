-- What exactly the targetologist wants in this particular request — the
-- per-client brief covers the client, this covers the one creative.
alter table creative_requests add column description text;
