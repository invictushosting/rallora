Rallora Onboarding Demo Setup Update

Adds a 'Create demo setup' option to the onboarding wizard.

When enabled, onboarding will create:
- demo teams in every league
- player names and captain emails
- fixture rounds / packs
- two rounds of confirmed results
- live standings
- demo sponsors
- cup qualification rules

Apply:
1. Extract this zip into the project root.
2. Run:
   node .\scripts\apply-onboarding-demo-setup.cjs
3. Run the SQL:
   supabase\rallora-onboarding-demo-setup.sql
4. Build and push:
   npm run build
   git add .
   git commit -m "Add onboarding demo setup option"
   git push
