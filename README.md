# Twitter Automation System

Automated Twitter posting and engagement using existing authenticated Chromium session.

## Quick Start

### Prerequisites
- VPS Chromium running at `https://twitter-vnc-porterlaforce.zocomputer.io` (authenticated session)
- CDP connected at `localhost:9222`
- Node.js with Playwright installed

### Installation

```bash
cd /home/workspace/twitter-automation
npm init -y
npm install playwright
```

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/scheduler.js` | Automated posting at optimal times |
| `scripts/engagement.js` | Auto-like, retweet, reply |

### Usage

**Post a test tweet:**
```bash
node scripts/scheduler.js --test
```

**Run the scheduler (posts automatically at scheduled times):**
```bash
node scripts/scheduler.js
```

**Run engagement bot:**
```bash
node scripts/engagement.js
```

**Dry run (shows what would happen without acting):**
```bash
node scripts/engagement.js --dry-run
```

**View posting calendar:**
```bash
node scripts/scheduler.js --calendar
```

## Configuration

### Posting Schedule

Edit `scripts/scheduler.js` `POSTING_SCHEDULE` object:

```javascript
const POSTING_SCHEDULE = {
  monday:    [{ hour: 8, min: 0, pillar: 'Automation' }],
  tuesday:   [{ hour: 8, min: 0 }, { hour: 12, min: 0 }],
  // ...
};
```

Times are in Eastern (ET). Adjust to your timezone.

### Engagement Targets

Edit `scripts/engagement.js` `CONFIG.targets`:

```javascript
targets: {
  hashtags: ['#AgenticAI', '#AIautomation', ...],
  keywords: ['AI agent', 'automation', 'n8n', ...],
},
```

## Content Calendar

See `project-docs/content-calendar.md` for 30-day posting plan.

## Logs

- `logs/scheduler.log` — posting activity
- `logs/engagement.log` — engagement activity

## Archives

All drafts and posted content are archived for reference.

**Folder structure:**
```
archives/
├── drafts/
│   ├── pending-drafts_YYYY-MM-DD.json  — drafts not posted
│   └── pending-approval_YYYY-MM-DD.json — drafts awaiting human review
└── posted/
    └── (posted tweets archived by date or pillar)
```

**Archiving rules:**
- **Old drafts** (rejected, superseded, or replaced by revised versions) → `archives/drafts/` with date stamp
- **Posted content** → `archives/posted/` after successful publish, tagged with pillar and date
- **Never delete** archived content — keep full history for reference and performance review

**Workflow:**
1. Draft generated → held in `pending-drafts.json` or `logs/pending-approval.json`
2. User approves → posted via browser automation
3. On successful post → move draft to `archives/posted/` with metadata (date, pillar, status)
4. On superseded/rejected draft → move to `archives/drafts/` with date stamp

## Bot Detection Prevention

1. **Random delays** between actions (2-5 seconds)
2. **Human typing speed** simulation (30ms delay per character)
3. **Action limits** per cycle (max 10 engagements)
4. **Random engagement selection** — not all matching tweets are targeted
5. **Value-add replies** only — no generic auto-replies
6. **No follows/unfollows** — these are highest detection risk

## Emergency Stop

**To kill the bot manually:**
```bash
pkill -f "scheduler.js"
```

Or find and kill by PID:
```bash
ps aux | grep scheduler
kill <PID>
```

## Troubleshooting

**CDP connection fails:**
- Verify Chromium is running with remote debugging port 9222
- Check `curl http://localhost:9222/json` returns session info

**Tweet fails to post:**
- Check authenticated session is still valid
- Verify no rate limiting (max 50 tweets/hour)
- Check browser hasn't navigated to error page

**Engagement not working:**
- Ensure hashtags/keywords match trending content
- Reduce `maxActionsPerCycle` if getting rate limited
