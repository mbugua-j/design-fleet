---
name: fleet-dashboard
description: "Open the local design-fleet observability dashboard. Use when the user says 'open the fleet dashboard', 'show fleet health', 'which fleet models are working?', 'show design-fleet activity', or asks to view handoffs, inspect credits, run an agent, manage GitHub accounts, rename a crew, or change a station model from the dashboard."
---

# Fleet Dashboard

Run the dashboard bundled with this installed plugin.

## Steps

1. Resolve the plugin root from this skill directory by moving up two levels.
2. Run:

   ```bash
   python3 "<plugin-root>/bin/fleet.py" dashboard
   ```

3. Start it as a detached background server when the shell tool supports that.
4. Verify `http://127.0.0.1:8100/api/health` responds when called with the
   `X-Design-Fleet-Dashboard: 1` request header.
5. Report the local URL.

The dashboard delegates sign-in to the official `gh auth login --web` flow.
Never print, request, or inspect GitHub tokens.
