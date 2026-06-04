Rallora Rules-Driven Standings Update

This update is SQL-only. It replaces the standings recalculation function so the league table uses each season's saved club rules:
- win_points
- draw_points
- loss_points
- forfeit_win_points
- forfeit_loss_points
- double_forfeit_points

How to apply:
1. Open supabase/rallora-rules-driven-standings.sql
2. Copy everything into Supabase SQL Editor
3. Click Run and enable RLS if Supabase warns you
4. Go to Admin -> Rules and confirm points are set
5. Go to Admin -> Recalculate
6. Check public Tables page

No app build is required for this SQL-only update.
