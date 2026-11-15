<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Subscription rules (dates, costs, sorting, search, reminders) live as pure functions in `src/lib/planner-core.ts` using hand-written structures in `src/lib/ds.ts`; keep them pure so they stay unit-testable.
- All user data is per account: tables key on `profile_id = auth.uid()` with RLS, and server functions use `requireSupabaseAuth` + `context.supabase` (never the admin client) — so users can only reach their own rows.
- The service catalogue is a static module (`src/lib/catalogue.ts`), not a DB table, so seed prices never duplicate or drift.
- Image scanning calls the AI gateway only inside `scanSubscription` (server); catalogue matching is deterministic code, and nothing is saved until the user confirms in the add dialog.
