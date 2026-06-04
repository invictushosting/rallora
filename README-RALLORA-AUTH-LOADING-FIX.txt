Rallora Admin/Captain Loading Hardening Fix

This patch prevents Admin and Captain pages from getting stuck on:
- Checking admin session...
- Loading admin...
- Checking session...
- Loading captain area...

It wraps the Supabase auth check in try/catch/finally so the loading state always clears and the login form appears if there is no valid session or if Supabase returns an auth error.

How to apply:
1. Extract this zip into the Rallora project root.
2. Run:
   node .\scripts\apply-auth-loading-hardening.cjs
   npm run build
3. If build passes:
   git add .
   git commit -m "Fix admin and captain loading state"
   git push
