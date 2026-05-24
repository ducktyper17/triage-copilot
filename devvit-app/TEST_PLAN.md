# Triage Copilot — Test Plan (Hackathon)

Maps automated + manual tests to [Reddit Mod Tools Hackathon](https://mod-tools-migration.devpost.com/) judging criteria.

**Deadline:** May 27, 2026 @ 6:00pm PDT  
**Category:** Best New Mod Tool ($10,000 grand prize)

Run automated tests:

```bash
cd devvit-app && npm run check
```

Manual playtest: see `PLAYTEST_RUNBOOK.md` (TC-01–TC-04).

---

## Judging criteria → what to prove

| Criterion | How Triage wins | Test coverage |
|-----------|-----------------|---------------|
| **Community Impact** | Claim/Release prevents ~74.5% mod collision rate (Pal et al. 2025) | Manual TC-01–TC-04, Activity dashboard TC-10 |
| **Polish** | Launch-ready app, well tested, Devvit compliant | `npm test`, `npm run type-check`, TC-01–TC-12 |
| **Reliable UX** | Mod-only, clear banners, one-form action chain | TC-05–TC-09 |
| **Ecosystem Impact** | First Reddit mod tool with real-time claim/release | Demo video + TC-01 |

---

## Automated unit tests (`npm run check`)

| Suite | File | Covers |
|-------|------|--------|
| Presence & claims | `src/presence.test.ts` | Claim exclusivity, TTL expiry, viewer warnings, activity formatting |
| LLM parsing | `src/llm.test.ts` | JSON parse, confidence clamp, provider defaults, disabled/fallback paths |
| Copilot actions | `src/copilot.test.ts` | Intel summary, removal reason resolution, action chain order |
| User intel | `src/intel.test.ts` | Missing user fallback, ban/note aggregation, report counts |
| Text / similarity | `src/text.test.ts`, `src/similar.test.ts` | Fingerprints, Jaccard scoring, similar removal memory |
| AutoMod | `src/automod.test.ts` | Redis-backed automod flags, warning formatting |
| Mod chat | `src/chat.test.ts` | Append/read chat, formatting |
| Load stats | `src/stats.test.ts` | Daily triage counts, load balancer hints |
| Queue hints | `src/queue.test.ts` | Next-item hint formatting |

---

## Manual playtest checklist (`npm run dev`)

Use **two moderator accounts** on a test subreddit.

### TC-01 — First mod claims item (core differentiator)
1. Mod A opens **Triage with Copilot** on a reported post.
2. **Expected:** Banner shows `YOU CLAIMED THIS ITEM` with countdown.
3. Mod B opens Triage on the **same** post within 5 minutes.
4. **Expected:** Banner shows `CLAIMED BY ANOTHER MOD` with u/ModA; Apply is blocked unless Override is checked.

### TC-02 — Collision counter increments
1. Repeat TC-01 step 4; Mod B clicks Apply without Override.
2. Open **Triage Activity** on the subreddit.
3. **Expected:** Toast says blocked; Activity shows `Collisions prevented` incremented.

### TC-03 — Override path works
1. Mod B checks **Override another mod's claim** and Apply.
2. **Expected:** Action chain runs; toast confirms actions.

### TC-04 — Claim releases after action or cancel
1. Mod A applies actions or cancels form.
2. Mod B opens Triage on same item.
3. **Expected:** Mod B can claim (no stale lock from Mod A).

### TC-05 — Live presence (non-claim awareness)
1. Mod A and Mod B open Triage on same item (before either applies).
2. **Expected:** Each sees `Also viewing this item: u/...` for the other mod.

### TC-06 — Mod-only gate
1. Non-mod user views post overflow / mod shield.
2. **Expected:** Triage menu not visible OR toast `Triage is mod-only.`

### TC-07 — User intel loads
1. Open Triage on post from user with mod notes / prior bans.
2. **Expected:** Account age, karma, ban history, mod notes visible in intel block.

### TC-08 — AI verdict (Groq)
1. Configure `llm-provider=groq` and valid API key.
2. Open Triage on borderline content.
3. **Expected:** `REMOVE` / `APPROVE` / `REVIEW` line with confidence % and TL;DR.

### TC-09 — Action chain
1. Check Remove + Reply with reason + Lock; set ban days > 0.
2. Apply once.
3. **Expected:** Single toast lists all actions; post removed/locked; distinguished reply visible; user banned.

### TC-10 — Activity dashboard
1. With 2+ mods triaging different items, open **Triage Activity**.
2. **Expected:** Active items listed as Post/Comment IDs, claim holder, viewers, mod count.

### TC-11 — Comment target
1. Run TC-01 on a **comment** instead of post.
2. **Expected:** Same claim/presence behavior on comments.

### TC-12 — LLM disabled graceful degradation
1. Set provider to `none` or remove API key.
2. Open Triage.
3. **Expected:** Form opens; intel shows `LLM disabled`; no crash.

---

## Submission checklist (Devpost)

- [ ] App listing: https://developers.reddit.com/apps/triage-copilot
- [ ] Tool overview (use `SUBMISSION.md`)
- [ ] Project impact: r/AskHistorians, r/personalfinance, r/AmITheAsshole
- [ ] Demo video (follow `DEMO_SCRIPT.md`) — **show TC-01 live**
- [ ] Reddit usernames for all teammates
- [ ] Optional: Developer satisfaction survey ($200 feedback prize)
- [ ] Optional: Helper nomination ($500)

---

## Winning strategy summary

1. **Lead with Claim/Release** — it is genuinely novel; no other Reddit mod tool has Redis-backed cross-mod coordination.
2. **Cite research** — Pal et al. 74.5% collision stat gives judges a measurable problem + solution.
3. **Polish = tests + demo** — run `npm test` before submit; record a crisp 60s demo of two mods colliding then Triage blocking it.
4. **Free AI default** — Groq Llama 3.3 removes friction for mods installing your app.
5. **Target Moderator's Choice** — emphasize time saved and collision prevention; mods on the judge panel will feel this pain directly.
6. **Do not enter Port category** unless you own a pre-March 2026 Data API bot with 500+ WAU communities.
