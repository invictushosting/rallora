Rallora Admin Dashboard Structure Polish

This update applies a safer patch instead of overwriting your full app/page.tsx.

What it improves:
- Admin overview hero/control centre
- Quick stats cards
- Quick action cards
- Setup checklist
- Better mobile responsive admin dashboard spacing

Apply:
1) Extract this zip into the Rallora project root.
2) Run:
   node scripts/apply-admin-dashboard-polish.cjs
3) Build:
   npm run build
4) Push:
   git add .
   git commit -m "Polish admin dashboard structure"
   git push


Fixed script syntax issue caused by nested template literal.
