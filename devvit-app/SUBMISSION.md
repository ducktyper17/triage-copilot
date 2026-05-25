# Devpost Submission — Field-by-Field

Paste these into the Devpost submission form. Edit any field as you like.

---

## Title (max 60 chars)
```
Triage — the first Reddit mod tool with Claim/Release
```

## Short tagline (max 200 chars)
```
First Reddit mod tool with real-time Claim/Release: only one mod can act on a queue item at a time. Bundled with free Llama 3.3 verdicts and one-submit action chains.
```

## Inspiration (paragraph)

Pal et al. (2025) interviewed 100+ Reddit moderators. **74.5%** said they regularly collide with another mod doing the exact same work on the exact same report — wasted effort no tool can prevent today. Cornell's 2025 study found mods spend 20+ hours a week unpaid on the queue. Tabassum (2024) cited "lack of tools to prevent abuse and coordinate response" as the top systemic gap.

Reddit's native UI shows you nothing about who else is looking at an item. Moderator Toolbox is a stateless browser extension — it physically can't show real-time presence between mods. PRAW bots can read reports but don't share state across the team.

So we built the missing piece: a Devvit app with a Redis-backed realtime presence layer, plus the supporting AI and context tooling mods already wished they had.

## What it does (bullet list)

When a moderator opens **Triage with Copilot** on any post or comment:

- 🔒 **Claim & Release** — *the genuinely new feature.* The first mod to open Triage on an item gets an exclusive 5-minute claim. Other mods who open the same item see a clear "claimed by u/X" banner and are pointed at the next queue item. The action chain refuses to execute for non-claimers unless they explicitly check Override. This is the first Reddit mod tool with real-time claim/release — no other tool can prevent the 74.5% collision pain that academic research has documented.
- 👁 **Live presence** — even outside the claim, the modal lists everyone else currently viewing the same item so the mod team has full awareness of who is where.
- 🤝 **Claim handoff** — transfer your claim to another mod on the team without losing context.
- 💬 **Per-item mod chat** — leave notes for teammates directly on the queue item (synced via Redis + realtime).
- ⏭ **Next queue hint** — when blocked, Triage suggests the next mod-queue item URL so you never stall.
- ⚖️ **Load balancer** — shows today's triage counts per mod; nudges overloaded mods to hand off.
- 📊 **User intel** — account age, total karma, prior bans in this sub, mod notes, recent moderator actions, 30-day activity sparkline — gathered in parallel from the Reddit API.
- 🚨 **Brigade watch** — flags authors active in configured rival subs (installation setting).
- ⚠️ **AutoMod context** — warns when AutoModerator already touched the item or author recently.
- 🔁 **Similar removal memory** — compares content to recently removed items in your sub for consistent enforcement.
- 🤖 **AI verdict** — I **Trust AI** pre-fill — Groq Llama 3.3 70B suggests action; high-confidence removes pre-check boxes and draft a removal reply.
- 📝 **Removal templates** — pulls sub removal reasons + recent mod-log patterns into a dropdown.
- ⚡ **Action chain** — Remove / Ban / Reply / Lock / Modmail in one submit.
- 📈 **Triage Activity dashboard** — live claims, viewers, collisions prevented, daily mod counts.
- 📬 **Weekly digest** — scheduled job posts collision + triage stats to mod team.
- 🔐 **Mod-only by design** — every menu item enforces `forUserType: "moderator"` plus runtime permission checks.

## How we built it

- **Devvit** (`@devvit/public-api` 0.12.23) — Reddit's official platform. Apps run on Reddit's servers, no separate deploy.
- **TypeScript** throughout. Strict mode. Zero `any`.
- **Two menu items** (`location: "post"` + `location: "comment"`, `forUserType: "moderator"`) wired to one Devvit form.
- **Reddit API** — `getUserByUsername`, `getModNotes`, `getPostById`/`getCommentById`, `submitComment` (distinguished), `banUser`, `remove`, `lock`. Plus mod-log writes.
- **Redis (Devvit plugin)** — hash per target item, fields keyed by mod username, 90-second TTL. The presence read filters expired entries on every fetch.
- **HTTP (Devvit plugin)** — outbound calls to `api.groq.com` for the LLM. Provider field also supports `api.anthropic.com` and `api.openai.com` for ops flexibility.
- **App-scope secret** — the LLM API key is stored encrypted, settable only by the app developer via `devvit settings set`.

Total: 15+ source modules, ~1,800 lines of TypeScript, **60+ automated tests** (`npm run check`).

## Challenges we ran into

- **Devvit menu surfaces.** The new Reddit web UI doesn't always show Devvit menu items in the standard "..." overflow — they appear in the mod-action shield panel instead. Verified across mobile + new Reddit + old Reddit before submitting.
- **Reddit's user-reports API only returns reason strings, not reporter usernames.** That broke our planned brigade-detection feature. We pivoted to report-count signals only and noted the limitation as future work via Reddit's GraphQL endpoint.
- **`Blocks` is deprecated** in favor of Devvit Web. Verified all our UI lives in non-deprecated surfaces (menu items + forms), and the read-only dashboard concept was dropped in favor of a per-item modal to avoid Blocks entirely.
- **Setting scope rules.** Secret settings must be `scope: "app"` (set by developer), not `scope: "installation"` (set by mod). Discovered during the first upload; refactored cleanly.

## Accomplishments

- A working app, **deployed and installed** on a real subreddit during the hackathon period.
- The **first known Reddit mod tool with live cross-mod presence** — solving the most-cited mod pain point in peer-reviewed research.
- **Free-AI-by-default** via Groq's Llama 3.3 70B — no credit card required for mods to install and use the full feature set.
- Total cost to develop: **$0 in inference**, thanks to Groq's free tier.

## What we learned

- Real moderator pain doesn't show up by guessing — it shows up in academic papers. Pal et al. (2025) and Tabassum (2024) handed us our feature set on a plate.
- AutoModerator's limitations aren't a bug — they're an opportunity for tools that read meaning instead of keywords.
- The mod's mental model is "I am about to decide on this one item" — that's the surface a mod tool should attach to, not a parallel dashboard.

## What's next

- **Brigade detection** via Reddit's GraphQL reports endpoint (richer reporter metadata).
- **Sub-specific learning** — fine-tune the AI prompt on each sub's past mod actions for tighter suggestions.
- **Audit dashboard custom post** — expand weekly digest into a pinned mod stats post.

## Built with

`Devvit` · `TypeScript` · `Reddit API` · `Redis` · `Groq` · `Llama 3.3 70B`

## App listing
https://developers.reddit.com/apps/triage-copilot

## Demo video
https://youtu.be/hV3pdYj7Pus

## GitHub
https://github.com/ducktyper17/triage-copilot

## Communities that would benefit

1. **r/AskHistorians** (1.8M members) — strict citation rules, heavy queue, multiple mods online simultaneously. Collision avoidance prevents teammates undoing each other.
2. **r/personalfinance** (18M members) — high spam pressure, identical scam patterns, mods desperate for AI triage that doesn't auto-remove.
3. **r/AmITheAsshole** (10M members) — context-heavy decisions (each report needs reading the post + comments + author history). Triage's bundled context view directly targets this workflow.

## Research citations

- Pal et al. (2025). *In the Queue: Understanding How Reddit Moderators Use the Modqueue*. arXiv:2509.07314.
- Towards a Better Modqueue: Designing for Diversity Across Moderator Objectives and Workflows. arXiv:2409.16840 (2024).
- Cornell Chronicle (2025). *AI-generated content a triple threat for Reddit moderators.*
- Tabassum et al. (2024). *Investigating Moderation Challenges to Combating Hate and Harassment.* USENIX Security 2024.
