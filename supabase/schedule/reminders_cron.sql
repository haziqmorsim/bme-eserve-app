-- reminders_cron.sql
-- Schedule the two reminder Edge Functions to run automatically.
-- This file is NOT applied by `supabase db push`; run it once in the Supabase
-- SQL Editor (or via psql) AFTER deploying the functions. Replace the
-- placeholders below first.
--
-- Prerequisites (run once):
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- Replace:
--   <PROJECT_REF>      your Supabase project ref (e.g. abcd1234)
--   <REMINDER_SECRET>  the same value set as the REMINDER_SECRET function secret
--                      (omit the header below if you did not set REMINDER_SECRET)

-- Runs every hour, on the hour. Each function only sends when something is
-- actually overdue and not already reminded, so hourly is safe and cheap.

select cron.schedule(
    'remind-pending-requests-hourly', 
    '0 * * * *', 
    $$
    select net.http_post(
        url     := 'https://lhzruijwlrqrsihehroa.functions.supabase.co/remind-pending-requests', 
        headers := jsonb_build_object(
            'Content-Type', 'application/json', 
            'x-eserve-key', '70ca3529db7f08579f84a27e5674a7ad6e8dc5254a7de78432fbb8337bee45cf'
        ), 
        body    := '{}'::jsonb
    );
    $$
);

select cron.schedule(
    'remind-unreplied-enquiries-hourly', 
    '15 * * * *', 
    $$
    select net.http_post(
        url     := 'https://lhzruijwlrqrsihehroa.functions.supabase.co/remind-unreplied-enquiries', 
        headers := jsonb_build_object(
            'Content-Type', 'application/json', 
            'x-eserve-key', '70ca3529db7f08579f84a27e5674a7ad6e8dc5254a7de78432fbb8337bee45cf'
        ), 
        body    := '{}'::jsonb
    );
    $$
);

select cron.schedule(
    'remind-abandoned-carts-hourly', 
    '30 * * * *', 
    $$
    select net.http_post(
        url     := 'https://<PROJECT_REF>.functions.supabase.co/remind-abandoned-carts', 
        headers := jsonb_build_object(
            'Content-Type', 'application/json', 
            'x-eserve-key', '<REMINDER_SECRET>'
        ), 
        body    := '{}'::jsonb
    );
    $$
);

-- To inspect or remove:
--   select * from cron.job;
--   select cron.unschedule('remind-pending-requests-hourly');
--   select cron.unschedule('remind-unreplied-enquiries-hourly');
--   select cron.unschedule('remind-abandoned-carts-hourly');