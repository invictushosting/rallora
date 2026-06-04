Rallora Auth Failsafe + Onboarding Review Fix

This patch adds a failsafe so Admin, Captain and Onboarding cannot remain stuck forever on:
- Checking admin session...
- Loading admin...
- Checking session...
- Loading captain area...
- Loading onboarding wizard...

It does not change your data or Supabase tables.

Apply:
1. Extract this zip into the Rallora project root.
2. Run:
   node .\scripts\apply-auth-failsafe.cjs
3. Build:
   npm run build
4. Commit and push:
   git add .
   git commit -m "Add auth loading failsafe"
   git push

After Vercel redeploys:
- hard refresh the live site
- test /admin, #captain and /onboarding

Onboarding design review notes:
- The current wizard is functional but should be brought visually closer to the main Rallora admin design.
- Recommended next design polish:
  1. Rallora branded hero panel
  2. Cleaner step cards
  3. Stronger form spacing and field grouping
  4. Sticky progress/sidebar on desktop
  5. Better mobile step layout
  6. Final review screen with clearer Create Club / Create Demo Setup actions
