# Manual Playtest Runbook — TC-01 through TC-04

**App:** Triage Copilot v0.0.4+  
**Playtest sub:** Your installed sub (see [developer portal](https://developers.reddit.com/apps/triage-copilot))  
**Logged in as:** u/not_ur_beeeacchh

## Before you start

1. Upload latest build:
   ```bash
   cd devvit-app && npm run check && npm run deploy
   ```
2. Install on a test subreddit you mod (or use the default playtest sub).
3. Use **two moderator accounts** in two browser windows (normal + incognito).
4. Create or find a **reported post/comment** both mods can open.

---

## TC-01 — First mod claims item

| Step | Actor | Action | Expected |
|------|-------|--------|----------|
| 1 | Mod A | Open a queue item → **Triage with Copilot** | Green banner: `YOU CLAIMED THIS ITEM` |
| 2 | Mod B | Open **same item** → Triage | Red banner: `CLAIMED BY ANOTHER MOD` + u/ModA |
| 3 | Mod B | Click Apply (no Override) | Toast: blocked; item unchanged |

**Pass criteria:** Mod B cannot act without Override.

---

## TC-02 — Collision counter

| Step | Actor | Action | Expected |
|------|-------|--------|----------|
| 1 | Mod B | Repeat TC-01 step 3 (blocked apply) | Block toast appears |
| 2 | Either mod | Subreddit menu → **Triage Activity** | `Collisions prevented` count increased |

**Pass criteria:** Counter increments on each blocked apply.

---

## TC-03 — Override path

| Step | Actor | Action | Expected |
|------|-------|--------|----------|
| 1 | Mod B | Open claimed item → check **Override** → Apply | Actions execute; success toast |
| 2 | Either mod | Verify post/comment state | Remove/lock/reply applied as selected |

**Pass criteria:** Override bypasses claim lock intentionally.

---

## TC-04 — Claim releases after action

| Step | Actor | Action | Expected |
|------|-------|--------|----------|
| 1 | Mod A | Claim item → Apply actions OR Cancel | Claim cleared |
| 2 | Mod B | Open same item → Triage | Mod B gets `YOU CLAIMED` (not blocked) |

**Pass criteria:** No stale claim after Mod A finishes.

---

## Bonus checks (quick)

- **Handoff:** Mod A selects another mod in "Hand off claim" → toast confirms transfer.
- **Mod chat:** Type a note in "Add mod chat note" → visible in intel on reopen.
- **Next item hint:** Blocked toast includes next queue URL.
- **Similar removals:** Remove spam → triage similar spam → see `SIMILAR TO RECENTLY REMOVED`.

---

## Demo video shot list (record after TC-01–04 pass)

1. Split screen: two mods open same item (collision)
2. Mod B blocked banner + moves to next item
3. Mod A one-click Apply (Remove + Ban + Reply)
4. Title card: "Triage — Claim/Release for Reddit mods"

Upload unlisted to YouTube → paste link in Devpost.
