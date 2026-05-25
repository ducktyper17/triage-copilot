# Submission Fields Draft

Paste-ready draft aligned with the Devpost rules page. Edit the placeholder fields before submitting.

---

## App listing

```text
https://developers.reddit.com/apps/triage-copilot
```

## Category

```text
Best New Mod Tool
```

## Public testing link

The rules say judges should be given access to a working public Reddit post running the app in a public subreddit with fewer than 200 members.

```text
Add the Reddit post URL here after you create a public demo/testing post in your playtest subreddit.
Example format: https://www.reddit.com/r/<your_test_sub>/comments/<post_id>/<slug>/
```

## Reddit usernames

```text
u/not_ur_beeeacchh
```

If there were additional teammates, add all of their Reddit usernames here before submitting.

## Tool Overview

```text
Triage Copilot is a Devvit moderation app that brings real-time coordination and AI-assisted triage directly into Reddit's native post and comment moderation surfaces.

When a moderator opens "Triage with Copilot" on any post or comment, the app first attempts to claim that item for them for 5 minutes. This prevents duplicate work: if another moderator opens the same item, they immediately see that it is already claimed, who claimed it, and a hint pointing them to the next queue item instead. Even outside of the claim lock, the app also shows live presence so moderators can see who else is currently viewing the same item.

The moderation modal then pulls together the context a moderator would normally have to gather manually across multiple tabs. This includes user intel such as account age, karma, prior bans in the subreddit, mod notes, recent moderator actions, and a 30-day subreddit activity sparkline. It also adds report-count awareness, AutoModerator context, brigade-watch signals based on configured watchlist subreddits, and similar-removal memory so moderators can quickly spot repeated spam or repeated rule-breaking patterns.

On top of the context layer, Triage Copilot includes an AI copilot layer. The app can call Groq, OpenAI, or Anthropic to generate a structured verdict consisting of a TL;DR, suggested action, rule hint, and confidence score. For high-confidence removals, the app can prefill the recommended actions. It can also draft a user-facing removal reply and a ban-related modmail message, while still keeping the moderator fully in control of what gets sent.

The app is designed to reduce moderation friction after the decision is made, too. From one submit flow, a moderator can remove the item, ban the user for N days, post a distinguished removal reply, lock the thread, and send modmail. The app also supports per-item mod chat, claim handoff to another moderator, a live Triage Activity view for the subreddit, and a scheduled weekly digest post summarizing triaged items and prevented collisions.

Moderators are the intended primary users. They use the app from moderator-only menu items on posts, comments, and the subreddit itself. End users are indirectly affected through clearer, faster moderation decisions, more consistent removal reasons, and better ban communication when moderators choose to send AI-assisted but human-reviewed explanations.
```

## Demo video

The rules say the demo video should be under 1 minute and publicly visible.

```text
Add your public YouTube/Vimeo/Facebook Video/Youku link here after upload.
```

## Project Impact

```text
1. r/AskHistorians
This community has strict rule enforcement, nuanced context-heavy decisions, and multiple moderators handling a heavy queue. Triage Copilot helps by preventing multiple moderators from working the same report at once, bundling user context into one view, and making high-friction moderation actions faster and more consistent.

2. r/personalfinance
This kind of community sees repetitive scam, spam, and low-quality promotional content at scale. Triage Copilot would help moderators detect repeated patterns, compare posts against recently removed content, and process obvious removals much faster while still keeping humans in control. The coordination and workload-balancing features are especially useful for large volunteer mod teams.

3. r/AmITheAsshole
This is a high-volume, context-heavy moderation environment where moderators often need to read the item, check the author's history, and coordinate with other moderators on borderline calls. Triage Copilot reduces time spent tab-hopping, surfaces the most relevant context directly in the modal, and helps moderators avoid collisions on hot or controversial reports.

Overall, the project is meant to save moderators time, reduce duplicate labor, improve consistency, and lower the coordination cost of volunteer moderation. The biggest impact is not just AI suggestions, but the realtime collaboration layer that Reddit moderation tools usually lack.
```

## Optional public repository

```text
https://github.com/ducktyper17/triage-copilot
```

## [For Ported Projects] Original Bot username

```text
N/A — this is not a ported project.
```

## [For Ported Projects] Port Completion

```text
N/A — this app was built as a new Devvit moderation tool rather than a port of an existing Reddit bot.
```

## [Optional] Developer Platform feedback

```text
Complete the developer satisfaction survey separately if you want to be considered for the Best Feedback prize.
```

## [Optional] Helper Nomination

```text
Add a nomination here only if someone from r/Devvit or the Reddit Devs Discord directly helped with troubleshooting, support, playtesting, or resource sharing during the hackathon.
```

## Submission checklist from the rules

- Include the app listing link.
- Include all participant Reddit usernames.
- Select the correct category: `Best New Mod Tool`.
- Include a text description explaining the app's features and functionality.
- Include 1-3 communities and expected impact.
- Add a public testing link to a Reddit post running the app in a public subreddit with fewer than 200 members.
- Add a public demo video link if you record one; keep it under 1 minute.
- Add the public repo link if you want to include source.
- Leave ported-app fields as `N/A` because this is not a port.
