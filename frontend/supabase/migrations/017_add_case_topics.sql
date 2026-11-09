-- Topics of the portfolio ("кейсы") forum group the creative bot posts
-- finished creatives into. Telegram's Bot API can't list a group's topics,
-- so each one is registered once by sending /topic inside it (or created by
-- the bot itself from the delivery flow).
create table case_topics (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  thread_id int not null,
  name text not null,
  created_at timestamptz default now() not null,
  unique (chat_id, thread_id)
);

-- Only touched by the service-role webhook — RLS with no policies, same as
-- telegram_bot_state.
alter table case_topics enable row level security;

-- The topic this client's creatives went to last time — offered first on
-- the next delivery. Not a hard binding: a client can span several niches.
alter table clients add column last_case_topic_id uuid references case_topics(id) on delete set null;
