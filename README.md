# Triage Copilot

Reddit mod-queue copilot built on [Devvit](https://developers.reddit.com/) for the [Mod Tools Hackathon](https://mod-tools-migration.devpost.com/).

**Claim/Release** stops mods from colliding on the same queue item. Bundled with live presence, AI verdicts (Groq Llama 3.3), user intel, similar-removal memory, mod chat, and one-submit action chains.

## Quick start

```bash
cd devvit-app
npm install
npm run check          # type-check + 61 tests
npm run login          # devvit login
npm run deploy         # upload to Reddit
```

**App listing:** https://developers.reddit.com/apps/triage-copilot

## Docs

| File | Description |
|------|-------------|
| [devvit-app/SUBMISSION.md](devvit-app/SUBMISSION.md) | Devpost submission copy |
| [devvit-app/TEST_PLAN.md](devvit-app/TEST_PLAN.md) | Automated + manual test plan |
| [devvit-app/PLAYTEST_RUNBOOK.md](devvit-app/PLAYTEST_RUNBOOK.md) | TC-01–TC-04 playtest steps |
| [devvit-app/DEMO_SCRIPT.md](devvit-app/DEMO_SCRIPT.md) | 60-second demo video script |

## License

BSD-3-Clause (see devvit-app/package.json)
