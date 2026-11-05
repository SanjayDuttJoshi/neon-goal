/**
 * The page at /neon-goal/: pick a version. Every version lives in its own
 * folder (v1/, v2/, ...) and stays online forever. Old V1 invite links
 * (/neon-goal/?room=CODE) are forwarded to v1, where those rooms live.
 */

const VERSION_NOTES: Record<string, { title: string; text: string }> = {
  v1: { title: "Classic", text: "Original neon-trail soccer. Simple aur fast." },
  v2: { title: "Red Ball + Arena Events", text: "🔥 Red ball (body se chhua toh OUT) · 🌑 Blackout · 🧱 Moving walls · 🧊 Ice floor · ⭐ Golden time" },
};

const card = (version: string, newest: boolean): string => {
  const note = VERSION_NOTES[version] ?? { title: "Neon Goal", text: "" };
  return `<a class="card${newest ? " new" : ""}" href="./${version}/">
      <span class="tag">${version.toUpperCase()}${newest ? " · NEW" : ""}</span>
      <strong>${note.title}</strong>
      <span class="text">${note.text}</span>
      <span class="go">Khelo →</span>
    </a>`;
};

export const landingHtml = (versions: string[]): string => {
  const sorted = [...versions].sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Neon Goal</title>
<meta name="description" content="Neon-trail multiplayer soccer in the browser. Free, no login.">
<script>
  // Old V1 invite links pointed here; their rooms live in v1.
  if (new URLSearchParams(location.search).has("room")) location.replace("./v1/" + location.search);
</script>
<style>
  :root { color-scheme: dark; --cyan: #22d3ee; --pink: #f472b6; --amber: #fbbf24; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px;
    background: radial-gradient(ellipse at top, #2e1065 0%, #050816 55%) #050816; color: #e2e8f0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 560px; text-align: center; }
  h1 { margin: 0; font-size: clamp(44px, 12vw, 72px); font-style: italic; letter-spacing: .1em; color: #a5f3fc;
    text-shadow: 0 0 18px var(--cyan), 0 0 48px #0891b2; }
  h1 span { color: #f9a8d4; text-shadow: 0 0 18px var(--pink), 0 0 48px #db2777; }
  .sub { margin: 10px 0 32px; letter-spacing: .4em; text-transform: uppercase; font-size: 13px; color: #94a3b8; }
  .card { display: grid; gap: 6px; text-align: left; margin-bottom: 14px; padding: 18px 20px; border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, .25); background: rgba(15, 23, 42, .7); color: inherit; text-decoration: none;
    transition: transform .15s, border-color .15s; }
  .card:hover, .card:focus-visible { transform: translateY(-2px); border-color: var(--cyan); outline: none; }
  .card.new { border-color: var(--amber); box-shadow: 0 0 28px rgba(251, 191, 36, .25); }
  .tag { font-size: 12px; font-weight: 800; letter-spacing: .3em; color: var(--cyan); }
  .card.new .tag { color: var(--amber); }
  strong { font-size: 20px; letter-spacing: .04em; }
  .text { font-size: 14px; color: #cbd5e1; line-height: 1.5; }
  .go { justify-self: end; font-weight: 800; letter-spacing: .2em; font-size: 13px; color: var(--pink); }
  footer { margin-top: 20px; font-size: 13px; color: #64748b; }
</style>
</head>
<body>
<main>
  <h1>NEON<span>GOAL</span></h1>
  <p class="sub">Trail se maaro · Goal karo</p>
  ${sorted.map((v, i) => card(v, i === 0)).join("\n  ")}
  <footer>100% free · No login · Dosto ko code bhejo</footer>
</main>
</body>
</html>
`;
};
