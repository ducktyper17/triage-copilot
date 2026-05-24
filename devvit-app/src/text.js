/** Normalize body text for similarity fingerprints. */
export function contentFingerprint(text) {
    const norm = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 50)
        .join(" ");
    return norm.slice(0, 240);
}
/** Jaccard similarity on word sets (0..1). */
export function similarityScore(a, b) {
    if (!a.length || !b.length)
        return 0;
    const wa = new Set(a.split(" ").filter(Boolean));
    const wb = new Set(b.split(" ").filter(Boolean));
    if (wa.size === 0 || wb.size === 0)
        return 0;
    let inter = 0;
    for (const w of wa) {
        if (wb.has(w))
            inter++;
    }
    const union = wa.size + wb.size - inter;
    return union === 0 ? 0 : inter / union;
}
/** 30-day ASCII sparkline from per-day counts. */
export function buildSparkline(dayCounts) {
    const chars = "▁▂▃▄▅▆▇█";
    const max = Math.max(1, ...dayCounts);
    const total = dayCounts.reduce((s, n) => s + n, 0);
    const sparkline = dayCounts
        .map((n) => {
        if (n === 0)
            return chars[0];
        const idx = Math.min(chars.length - 1, Math.ceil((n / max) * (chars.length - 1)));
        return chars[idx];
    })
        .join("");
    return { sparkline, total };
}
