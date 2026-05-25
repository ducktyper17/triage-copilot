# Triage Copilot

Triage Copilot is a Devvit app for Reddit moderators that adds real-time coordination, AI-assisted triage, and one-submit moderation workflows directly on posts and comments.

The core idea is simple: when a moderator opens Triage on an item, the app claims that item for them, shows who else is viewing it, pulls together the context they usually have to gather manually, and lets them execute the most common moderation actions from one form.

## What We Built

### Core coordination features

- **Claim and release**: the first moderator to open an item gets a 5-minute claim.
- **Live presence**: shows other moderators currently viewing the same item.
- **Claim handoff**: transfer the current claim to another moderator.
- **Per-item mod chat**: leave notes for teammates on the exact item being reviewed.
- **Next queue hint**: suggests the next mod-queue item when a moderator is blocked by someone else's claim.
- **Load balancing hint**: shows daily triage counts and nudges overloaded mods to hand work off.

### Copilot and context features

- **User intel**: account age, karma, prior bans, mod notes, and recent moderator actions.
- **30-day activity sparkline**: compact view of how active the author has been in the subreddit.
- **Report awareness**: surfaces user report counts when the item has been reported.
- **Brigade watch**: flags authors recently active in configured watchlist subreddits.
- **AutoModerator context**: warns when AutoMod already touched the item or the author.
- **Similar removal memory**: compares the current item to recently removed content in the subreddit.
- **Removal templates**: pulls subreddit removal reasons and recent moderation patterns into a dropdown.

### AI features

- **AI verdict**: structured TL;DR, suggested action, rule hint, and confidence score.
- **Trust AI prefill**: if the verdict is a high-confidence remove, the form pre-fills the common actions.
- **AI removal reply**: drafts a user-facing distinguished removal explanation.
- **AI modmail draft**: drafts ban-related modmail.
- **Multi-provider support**: Groq, OpenAI, Anthropic, or no AI.

### Action and reporting features

- **One-submit action chain**: remove, ban, reply, lock, and send modmail from one submit.
- **Triage Activity view**: shows current claims, viewers, collisions prevented, and daily mod counts.
- **Weekly digest job**: scheduled post with aggregate moderation stats.
- **Mod-only enforcement**: menu items are moderator-only and re-checked at runtime.

## How It Works

When a moderator clicks `Triage with Copilot` on a post or comment:

1. The app checks moderator permissions.
2. It attempts to claim the item in Redis.
3. It records that the moderator is viewing the item.
4. It fetches moderation context in parallel:
   - user intel
   - report count
   - AutoMod context
   - brigade-watch matches
   - subreddit activity sparkline
   - removal templates
   - similar removed content
5. It calls the configured LLM provider for a structured verdict.
6. It optionally generates a user-facing removal reply and a modmail draft.
7. It opens a Devvit form with the full summary and action controls.
8. On submit, it runs the selected moderation actions and releases or transfers the claim.

## How We Built It

### Platform

- **Devvit** via `@devvit/public-api`
- **TypeScript** with strict builds
- **Reddit API** for moderation actions and data gathering
- **Redis** for realtime coordination and short-lived shared state
- **HTTP** for LLM calls
- **Scheduler jobs** for the weekly digest
- **Triggers** for app install and AutoModerator events

### Architecture

The app is split into focused modules:

- `src/main.ts`
  Registers settings, menu items, forms, scheduler jobs, and triggers.
- `src/presence.ts`
  Handles claims, viewers, blocked-count tracking, and subreddit activity.
- `src/chat.ts`
  Stores and formats per-item mod chat messages.
- `src/queue.ts`
  Reads mod queue and suggests the next item to review.
- `src/intel.ts`
  Gathers user intel, report context, brigade matches, sparkline data, removal templates, and similar removals.
- `src/automod.ts`
  Stores and reads AutoModerator touches on items and authors.
- `src/similar.ts`
  Builds lightweight text fingerprints and matches against recent removals.
- `src/llm.ts`
  Calls Groq, OpenAI, or Anthropic and parses structured moderation output.
- `src/copilot.ts`
  Formats the copilot summary and runs the action chain.
- `src/stats.ts`
  Tracks daily triage counts and digest stats.
- `src/digest.ts`
  Schedules and posts the weekly digest.
- `src/types.ts`
  Shared types across the app.

### Shared state design

We use Redis as the coordination layer:

- `triage:claim:<targetId>` stores the active claimant for an item
- `triage:viewing:<targetId>` stores current viewers
- `triage:chat:<targetId>` stores item-level mod notes
- `triage:active:<subreddit>` stores recently active queue items
- `triage:blocked:<subreddit>` tracks prevented collisions
- `triage:actions:<subreddit>:<day>` tracks daily workload per moderator
- `triage:removed:<subreddit>` stores recent removals for similarity matching
- `triage:automod:*` stores recent AutoMod signals

This lets multiple moderators see the same shared state without needing a separate backend.

### AI design

The AI layer is deliberately constrained:

- verdicts are requested as structured JSON
- the model gets subreddit rules and moderation context
- if the provider is missing or fails, the app still works
- removal replies and modmail drafts are optional helpers, not auto-actions

Groq with `llama-3.3-70b-versatile` is the default path, but the app can switch providers from settings.

## Setup

### Prerequisites

- Node.js
- npm
- a Reddit account with Devvit access
- a moderator-owned test subreddit

### Install

```bash
npm install
```

### Log in to Devvit

```bash
npm run login
```

### Configure the app secret

Set the LLM API key once at app scope:

```bash
npx devvit settings set llm-api-key
```

### Optional installation settings

In the subreddit app settings you can configure:

- `llm-provider`
- `llm-model`
- `sub-rules-text`
- `brigade-watch-subs`

## Local Development

### Type-check

```bash
npm run type-check
```

### Run tests

```bash
npm test
```

### Run full verification

```bash
npm run check
```

### Start playtest

```bash
npm run dev
```

This installs the app to your playtest subreddit, redeploys on save, and streams logs.

## Deploy

Upload to the App Directory:

```bash
npm run deploy
```

Publish:

```bash
npm run launch
```

## Demo Tips

To show the full feature set quickly:

1. create 3 similar spammy posts
2. report them so they appear in mod queue
3. remove 2 with Triage
4. open the 3rd to show similar-removal matching
5. use a second moderator session to show claim collision, presence, and handoff

## Testing

The repo includes focused Vitest coverage for helper modules such as:

- presence and claim logic
- queue helpers
- text fingerprinting
- similar-removal matching
- AutoMod helpers
- stats and digest helpers
- chat helpers
- intel and LLM helpers

There are currently 10 test files under `src/`.

## Why This Exists

Reddit moderation tools are good at acting on content, but weak at coordinating moderators in real time. Triage Copilot is built to solve that gap:

- stop duplicate work
- keep moderators aware of each other
- bundle decision context into one place
- reduce multi-tab moderation workflows
- keep the moderator in control while using AI as a suggestion layer

## Stack

- Devvit
- TypeScript
- Reddit API
- Redis
- Groq / OpenAI / Anthropic
- Vitest

## Links

- App listing: [developers.reddit.com/apps/triage-copilot](https://developers.reddit.com/apps/triage-copilot)
- GitHub: [github.com/ducktyper17/triage-copilot](https://github.com/ducktyper17/triage-copilot)
