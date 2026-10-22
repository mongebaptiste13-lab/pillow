-- ============================================================
-- PILLOW — Déclencheur de notifications via Supabase (alternative à Netlify)
-- Utilise pg_cron + pg_net pour appeler ton site chaque minute.
-- À lancer UNE fois dans SQL Editor, après avoir remplacé les 2 valeurs ci-dessous.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Remplace par l'adresse de ton site et ton CRON_SECRET
select cron.schedule(
  'pillow-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://TON-SITE.netlify.app/api/cron/dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer TON_CRON_SECRET', 'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Pour arrêter :  select cron.unschedule('pillow-dispatch');
-- Pour vérifier : select * from cron.job_run_details order by start_time desc limit 10;
