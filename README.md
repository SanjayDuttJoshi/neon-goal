# ⚡ NEON GOAL

Neon soccer where **you are the wall**. You can't kick the ball: wherever you run you leave a glowing trail, and the ball bounces off trails. Draw ramps, walls and traps to score.

**Play:** https://sanjayduttjoshi.github.io/neon-goal/

- Modes: **Solo 1v1**, **Duo 2v2**, **Squad 4v4**, **Chaar Kone** (4 goals, last one standing)
- Rooms with a 5-letter code / invite link / WhatsApp share, spectators (bench), kick, rematch
- Bots fill empty slots (Aasaan / Normal / Khatarnak) and an offline **Practice** mode
- Goal explosions, slow-motion replay, power shots, screen shake, synthesized sound, phone vibration
- Desktop (WASD + Space), phone (joystick + tap to dash, field auto-rotates), gamepad
- Refresh mid-match and you land straight back in your own slot; latecomers watch from the bench
- Shots a defender deflects into their own net still count for the shooter

## 100% free, no server

| Piece | What it uses | Cost |
|---|---|---|
| Website | Static files (`out/` folder) | Free on Cloudflare Pages / GitHub Pages / Netlify |
| Finding friends | Public Nostr relays (via [Trystero](https://github.com/dmotz/trystero)) | Free, no account |
| Game traffic | Direct WebRTC between browsers (end-to-end encrypted) | Free |
| Fonts, sounds, art | Self-hosted fonts, Web Audio synthesis, canvas drawing | Free |

There is no database, no paid API, no login and no credit card anywhere. The room creator's browser runs the match; if the host leaves mid-match another player takes over automatically.

**Known limit:** a few strict networks (some office/college Wi-Fi, some carrier NATs) block direct browser-to-browser connections. Those players need a TURN relay. Cloudflare's TURN has a free tier, but it needs an account, so it isn't enabled by default. If someone can't connect, switching to mobile data or a hotspot usually works.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run preview    # production build served at http://localhost:4173
```

Testing multiplayer on one computer: open `http://localhost:3000/?net=local` in two tabs. That uses a same-browser channel instead of the internet.

## Tests

```bash
npm test           # engine, physics fuzzing, match pace per mode, protocol, lobby, multiplayer sessions over a simulated network
npm run test:e2e   # real browser: practice, invite links, host leaving, refresh-rejoin, spectators, kick, bad codes, rotation, mute
npm run playtest   # needs `npm run preview` running: an autopilot plays full matches in every mode (keyboard, touch, 2-player LAN),
                   # records video and frame grabs into playtest-out/ with a JSON report per scenario
```

`?debug=1` exposes a small screen-space probe (`window.__neonProbe`) that the playtest autopilot reads; it does nothing otherwise.

## Deploy (free, GitHub Pages)

```bash
npm run deploy     # type-check + unit tests, build for /neon-goal, push to the gh-pages branch
```

The site updates about a minute later. No GitHub Actions, no paid plan: GitHub Pages serves the `gh-pages` branch of a public repo for free.

Pushes from this folder always go out as the repo's own GitHub account, through the credential helper in `.git/config`. It doesn't matter which `gh` account is active.

Any other static host works too (Cloudflare Pages, Netlify): build with `npm run build` and upload `out/`.

## Code map

```
src/game/      pure simulation: physics, trails, scoring, bots (no DOM, fully tested)
src/net/       rooms, lobby rules, host/guest engines, prediction, wire protocol
src/render/    canvas renderer: neon field, trails, particles, replay
src/audio/     synthesized sound effects
src/input/     keyboard / joystick / gamepad
src/components rooms, lobby, HUD and menus (React + Tailwind)
src/types/     shared enums and types
```
