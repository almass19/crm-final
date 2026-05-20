-- Add client_type field to distinguish legal entities from individuals
alter table clients
  add column if not exists client_type text check (client_type in ('LEGAL', 'INDIVIDUAL'));
