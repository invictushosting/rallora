Rallora Global Auth Freeze Fix

Fixes Admin, Captain and Onboarding getting stuck on loading screens.

Symptoms:
- Checking admin session...
- Loading admin...
- Checking session...
- Loading captain area...
- Loading onboarding wizard...

Cause:
The Supabase auth/session check can hang or error without clearing the loading state.

Apply:
1. Extract into the project root.
2. Run:
   node .\scripts\apply-global-auth-freeze-fix.cjs
3. Build:
   npm run build
4. Commit and push:
   git add .
   git commit -m "Fix admin captain and onboarding auth loading"
   git push

After Vercel redeploys, hard refresh the live site.
