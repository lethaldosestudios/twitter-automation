# Twitter Automation Memory

## Project: Twitter/X Auto-Posting System

**Created:** 2026-03-25
**Status:** ACTIVE — Guardrails approved 2026-07-14 by Porter

---

## What We Built

- VPS-based automation using Chromium + Playwright on Zo Computer
- Authenticated session via noVNC web interface (https://twitter-vnc-porterlaforce.zocomputer.io)
- CDP connection at localhost:9222
- Auto-poster script at `file twitter-automation/auto-poster.js`

## Services Running

| Service | Status | Details |
| --- | --- | --- |
| Xvfb (:99) | Running | Virtual display |
| x11vnc (5999) | Running | VNC server |
| websockify (6080) | Running | noVNC proxy |
| Chromium (9222) | Running | Authenticated session |
| noVNC | Running | https://twitter-vnc-porterlaforce.zocomputer.io |

## Account Status

- **Account:** @porterlaforce
- **Session:** Authenticated and active
- **Test tweets posted:** 3 (all deleted by user)

---

## Guardrails (IN PROGRESS)

### Required Before Any Post

- [ ] User approval for new content (at minimum, a preview)

- [ ] No posting during "reflection period" (user defines times)

- [ ] Content must match approved topics/themes

### Prohibited Content

- [x] Political content

- [x] Religious content

- [x] Personal attacks / negative content about specific people/companies

- [x] Anything that could damage reputation

- [x] Automated engagement (likes/retweets follows) without explicit approval

### Posting Limits

- [ ] Max posts per day: TBD

- [ ] Cooldown between posts: TBD

- [ ] No posting during defined "quiet hours"

---

## Topics & Voice (APPROVED)

- [x] AI & Automation (primary)

- [x] Zo Computer & its capabilities

- [x] Build in Public (personal projects)

- [x] Tech/Entrepreneurship

- [x] Vinyl/E-commerce (SLABS project)

## Voice Guidelines

- [x] Authentic, not corporate

- [x] Share real wins AND failures

- [x] Give credit to tools/platforms (especially Zo!)

- [x] No spam behavior

---

## Posted Content Log

| Date | Content | Status |
| --- | --- | --- |
| 2026-03-25 | Test tweet about Zo Computer | DELETED |

---

## Pending Decisions

- [ ] Max daily posts?

- [ ] Approval workflow (preview + confirm vs full autonomy)?

- [ ] Reflection/quiet hours?

- [ ] Which topics get priority?

- [ ] How to handle "Build in Public" content - what projects are shareable?