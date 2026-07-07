# Supabase — HabitTracker schema in the shared WLC project

HabitTracker's tables live in the **whole-life-challenge** Supabase project (ref `lnnvwbqmpgusjoplvjjt`) rather than a dedicated project. Everything is prefixed `ht_` to stay clear of WLC's schema. Migrations in this directory are **applied manually — never automatically on deploy.**

## Applying a migration

1. Open the [WLC project SQL Editor](https://supabase.com/dashboard/project/lnnvwbqmpgusjoplvjjt/sql/new).
2. Paste the migration file contents (`migrations/20260708_ht_initial.sql`) and **Run**.
3. Run the verification queries below. "No rows returned" from the DDL itself proves nothing — always verify.

## Verification queries (run after every apply)

```sql
-- Expect 2 rows, rowsecurity = true on both
select tablename, rowsecurity from pg_tables where tablename like 'ht_%';

-- Expect exactly these policies:
--   ht_events: select + insert only (append-only — NO update/delete)
--   ht_habit_config: select, insert, update, delete
select polrelid::regclass as table, polname, polcmd
from pg_policy
where polrelid::regclass::text like 'ht_%'
order by 1, 2;
```

A quick negative test: an anon-key request with no session must be rejected by RLS on both tables.

## ⚠️ Shared-project cautions (this project also serves the WLC app)

1. **Auth email template is shared.** To support HabitTracker's typed-code sign-in, add `{{ .Token }}` to the magic-link template **alongside** the existing link markup — do not remove the link, or WLC's login emails break. Dashboard → Authentication → Emails → Magic Link.
2. **Email OTP** must be enabled in Auth settings (it usually is when the email provider is on; verify rather than assume).
3. **Same auth user pool.** giles@parnellsystems.com may already exist as a WLC auth user — reusing that `user_id` is expected and intended; RLS on the `ht_` tables is the isolation boundary.
4. **Redirect allowlist.** Add HabitTracker's Vercel production and preview URLs under Authentication → URL Configuration → Redirect URLs. Harmless to WLC.
5. **Never run destructive SQL here.** This database holds another app's production data. Migrations must be additive and idempotent; anything else needs explicit sign-off.
