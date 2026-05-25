# Triage Copilot Privacy Policy

Last updated: May 25, 2026

This Privacy Policy explains how Triage Copilot handles data when used as a Reddit moderation app.

## 1. Data processed by the app

Triage Copilot may process limited Reddit data needed to support moderation workflows, including:

- post and comment IDs
- subreddit names
- Reddit usernames
- moderator-entered notes on items
- claim and presence state for moderators viewing the same item
- moderation context such as reports, mod notes, and recent actions available through Reddit's platform APIs

## 2. Shared state and storage

The app uses Reddit/Devvit platform storage, including Redis-backed app state, to support features such as:

- claim and release coordination
- live presence
- per-item moderator chat
- collision counters
- recent removal similarity matching
- aggregate moderation statistics

This state is used only to operate the app's features.

## 3. AI providers

If AI features are enabled, relevant moderation context may be sent to the configured AI provider to generate suggestions, summaries, removal replies, or modmail drafts.

Supported providers may include:

- Groq
- OpenAI
- Anthropic

AI usage is optional. If no provider is configured, the app still works without AI features.

## 4. What the app does not do

Triage Copilot is not intended to sell personal data, run advertising profiles, or collect unrelated personal information outside the moderation workflow.

## 5. Data retention

Some operational state is temporary and expires automatically. Retention windows may vary by feature, such as short-lived presence data and longer-lived aggregate moderation statistics.

## 6. Security

The app relies on Reddit's Devvit platform and configured provider services for infrastructure and secret handling. No method of storage or transmission is guaranteed to be completely secure.

## 7. Changes to this policy

This Privacy Policy may be updated from time to time. Continued use of the app after changes are posted constitutes acceptance of the updated policy.

## 8. Contact

Project repository:

https://github.com/ducktyper17/triage-copilot
