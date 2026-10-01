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

## Architecture rules
- Staff operations (scheduling, member management, Google Calendar) run in `src/lib/*.functions.ts` server functions that verify the caller's role server-side before using the admin client — the browser is never trusted for roles.
- Each admin/mentor connects their own Google account via the `google_calendar` App User Connector; connection keys live encrypted in `app_user_connections` — meetings must be created by the person whose calendar sends the invite.
- Meeting visibility (all / cohort / selected attendees) is enforced by RLS on `meetings`; mentor confidential notes use `notes.visibility = mentor_private` — mentees can never read them.
