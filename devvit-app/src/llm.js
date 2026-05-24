const SYSTEM_PROMPT = `You are a moderation copilot for a Reddit moderator. \
Given a post or comment and context about its author and the subreddit's rules, \
return a tight verdict in JSON. Stay neutral, prioritize the moderator's autonomy, \
and never fabricate facts. If unsure, suggest "review". Output STRICT JSON only.`;
export function defaultModelFor(provider) {
    switch (provider) {
        case "anthropic":
            return "claude-haiku-4-5-20251001";
        case "openai":
            return "gpt-4o-mini";
        case "groq":
            return "llama-3.3-70b-versatile";
        default:
            return "";
    }
}
export async function loadLLMSettings(context) {
    const provider = ((await context.settings.get("llm-provider")) ??
        "none");
    const apiKey = (await context.settings.get("llm-api-key")) ?? "";
    const configuredModel = (await context.settings.get("llm-model")) ?? "";
    const model = configuredModel.length > 0
        ? configuredModel
        : defaultModelFor(provider);
    const subRules = (await context.settings.get("sub-rules-text")) ?? "";
    return { provider, apiKey, model, subRules };
}
export function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match)
            return null;
        try {
            return JSON.parse(match[0]);
        }
        catch {
            return null;
        }
    }
}
export function clampConfidence(v) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n))
        return 0;
    return Math.max(0, Math.min(1, n));
}
export function normalizeAction(v) {
    const s = String(v ?? "").toLowerCase();
    if (s === "approve" || s === "remove" || s === "review")
        return s;
    return "review";
}
function buildUserPrompt(intel) {
    const { input, user, report } = intel;
    const reportLine = report
        ? `User reports: ${report.reportCount}.`
        : "No user reports.";
    return [
        `Subreddit: r/${input.subredditName}`,
        `Target: ${input.targetKind}`,
        `Author: u/${user.username} (${user.accountAgeDays}d old, ${user.karmaInSub} total karma, ${user.priorBansInSub} prior bans in this sub)`,
        `Mod notes on author: ${user.modNotes.join(" | ") || "(none)"}`,
        `Recent prior mod actions on author: ${user.recentActionsAgainstUser.join(", ") || "(none)"}`,
        reportLine,
        `Body text:\n"""${input.bodyText.slice(0, 2000)}"""`,
        "",
        "Return JSON exactly matching this shape:",
        `{"tldr": "<one-sentence summary>", "suggestedAction": "approve|remove|review", "ruleHint": "<rule name or null>", "confidence": <0..1>}`,
    ].join("\n");
}
async function callAnthropic(settings, userPrompt) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": settings.apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: settings.model,
            max_tokens: 400,
            system: SYSTEM_PROMPT + "\n\nSub rules:\n" + settings.subRules,
            messages: [{ role: "user", content: userPrompt }],
        }),
    });
    if (!res.ok) {
        throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json());
    return body.content?.find((c) => c.type === "text")?.text ?? "";
}
async function callOpenAICompatible(endpoint, settings, userPrompt, providerLabel) {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
            model: settings.model,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT + "\n\nSub rules:\n" + settings.subRules,
                },
                { role: "user", content: userPrompt },
            ],
        }),
    });
    if (!res.ok) {
        throw new Error(`${providerLabel} ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json());
    return body.choices?.[0]?.message?.content ?? "";
}
function callOpenAI(settings, userPrompt) {
    return callOpenAICompatible("https://api.openai.com/v1/chat/completions", settings, userPrompt, "OpenAI");
}
function callGroq(settings, userPrompt) {
    return callOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", settings, userPrompt, "Groq");
}
async function callLLMText(settings, system, userPrompt) {
    if (settings.provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": settings.apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: settings.model,
                max_tokens: 350,
                system,
                messages: [{ role: "user", content: userPrompt }],
            }),
        });
        if (!res.ok)
            throw new Error(`Anthropic ${res.status}`);
        const body = (await res.json());
        return body.content?.find((c) => c.type === "text")?.text ?? "";
    }
    const endpoint = settings.provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: userPrompt },
            ],
        }),
    });
    if (!res.ok)
        throw new Error(`LLM ${res.status}`);
    const body = (await res.json());
    return body.choices?.[0]?.message?.content ?? "";
}
export async function generateCopilotExtras(intel, verdict, context) {
    const settings = await loadLLMSettings(context);
    if (settings.provider === "none" || settings.apiKey.length === 0) {
        return { userFacingReason: null, modmailDraft: null };
    }
    const rule = verdict.ruleHint ?? "community rules";
    const base = [
        `Subreddit: r/${intel.input.subredditName}`,
        `Verdict: ${verdict.suggestedAction}`,
        `Rule: ${rule}`,
        `Summary: ${verdict.tldr}`,
        `Content snippet: """${intel.input.bodyText.slice(0, 800)}"""`,
    ].join("\n");
    let userFacingReason = null;
    let modmailDraft = null;
    try {
        userFacingReason = (await callLLMText(settings, "Write a brief, respectful removal reply for the user (2-3 sentences). Cite the rule. No markdown headers.", `${base}\n\nWrite the distinguished mod reply text only.`)).trim().slice(0, 500);
    }
    catch (e) {
        console.warn("[triage] AI reason failed", e.message);
    }
    try {
        modmailDraft = (await callLLMText(settings, "Draft a private modmail to a banned user. Be clear, neutral, mention rule and appeal path.", `${base}\n\nBan context: temporary ban from r/${intel.input.subredditName}.\nWrite modmail body only (no subject line).`)).trim().slice(0, 800);
    }
    catch (e) {
        console.warn("[triage] modmail draft failed", e.message);
    }
    return { userFacingReason, modmailDraft };
}
export function buildTrustAiDefaults(verdict) {
    const highTrust = verdict.available &&
        verdict.confidence >= 0.9 &&
        verdict.suggestedAction === "remove";
    return {
        remove: highTrust,
        banDays: 0,
        replyWithReason: highTrust,
        lockThread: false,
        removalReason: highTrust ? verdict.tldr.slice(0, 280) : "",
        showTrustAiHint: highTrust,
    };
}
export async function runLLMVerdict(intel, context) {
    const settings = await loadLLMSettings(context);
    if (settings.provider === "none" || settings.apiKey.length === 0) {
        return {
            available: false,
            tldr: "LLM disabled (configure provider + API key in app settings).",
            suggestedAction: "review",
            ruleHint: null,
            confidence: 0,
        };
    }
    const userPrompt = buildUserPrompt(intel);
    try {
        let raw;
        if (settings.provider === "anthropic") {
            raw = await callAnthropic(settings, userPrompt);
        }
        else if (settings.provider === "groq") {
            raw = await callGroq(settings, userPrompt);
        }
        else {
            raw = await callOpenAI(settings, userPrompt);
        }
        const parsed = safeJsonParse(raw);
        if (!parsed) {
            return {
                available: false,
                tldr: "LLM returned non-JSON.",
                suggestedAction: "review",
                ruleHint: null,
                confidence: 0,
                rawError: raw.slice(0, 200),
            };
        }
        return {
            available: true,
            tldr: String(parsed.tldr ?? "").slice(0, 280),
            suggestedAction: normalizeAction(parsed.suggestedAction),
            ruleHint: typeof parsed.ruleHint === "string" && parsed.ruleHint.length > 0
                ? parsed.ruleHint
                : null,
            confidence: clampConfidence(parsed.confidence),
        };
    }
    catch (e) {
        const msg = e.message;
        console.warn("[triage] LLM call failed", msg);
        return {
            available: false,
            tldr: "LLM call failed.",
            suggestedAction: "review",
            ruleHint: null,
            confidence: 0,
            rawError: msg.slice(0, 200),
        };
    }
}
