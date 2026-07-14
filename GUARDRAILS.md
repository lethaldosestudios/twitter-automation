# Twitter Automation Guardrails

## Overview

This document defines the rules, safety checks, and operational boundaries for the Twitter/X automation system running on Zo Computer.

---

## Core Rules

### 1. Human-in-the-Loop (HITL)

- [x] **ALL posts require human approval** before publishing

- [x]  Script outputs draft text, human confirms and edits

- [x]  No fully autonomous posting without explicit user approval

### 2. Content Boundaries

#### NEVER POST:

- [x]  Anything that could be interpreted as political, controversial, or divisive

- [x]  Personal information (yours or others')

- [x]  Direct messages or private conversations

- [x]  Content that could damage brand/reputation

- [x]  Spam, engagement bait, or repetitive content

- [x]  Links to unverified sources

- [x]  Hoaxes, misinformation, or unconfirmed news

#### ALWAYS INCLUDE:

- [x]  Attribution when sharing others' content

- [x]  Factual basis for claims/statistics

- [x]  Authentic personality (not generic bot-speak)

- [x]  Proofread for typos before posting

### 3. Account Protection

#### Rate Limits (Twitter/X):

- [x]  Max 50 tweets per day (safety: 30)

- [x]  Max 100 follows per day

- [x]  Max 400 mentions per day

- [x]  Wait 1-2 minutes between posts

#### Security:

- [x]  Never expose API keys or credentials

- [x]  Session data stored securely

- [x]  Regular session validation before posting

- [x]  Automatic cooldown if errors detected

### 4. Quality Gates

#### Before Any Post:

- [x]  Review draft text for tone/accuracy

- [x]  Verify hashtag relevance

- [x]  Check for @mentions (correct handles?)

- [x]  Confirm media (if any) is appropriate

- [x]  Review character count

- [x]  Test link shortened URLs

#### Error Handling:

- [x]  If posting fails: retry once after 30s, then alert user

- [x]  If account shows unusual activity: pause and alert

- [x]  If rate limit approached: pause posting queue

---

## Operational Protocols

### Pre-Posting Checklist

```markdown
□ Draft generated
□ Human reviewed
□ Content approved
□ Tweet posted
□ Confirmation received
□ Log updated
```

### Daily Limits (Safety Cap)

| Action | Max per Day | Safety Limit |
| --- | --- | --- |
| Tweets | 50 | 30 |
| Replies | 100 | 50 |
| Retweets | 100 | 50 |
| Follows | 100 | 30 |
| Unfollows | 50 | 20 |

### Alert Thresholds

- [x]  80% of daily limit reached → log warning

- [x]  90% of daily limit reached → pause and alert user

- [x]  Error rate &gt; 10% → pause all operations

---

## Session Management

### Session Requirements

- [x]  Browser session validated before posting

- [x]  Twitter session cookie still valid

- [x]  No "suspicious login" alerts pending

- [x]  Account in good standing

### If Session Expires:

1. Alert user immediately
2. Do not attempt auto-relogin
3. Wait for user to re-authenticate
4. Resume only after user confirmation

---

## Content Personality Guidelines

### Voice:

- [x]  Authentic, not corporate

- [x]  Technical but accessible

- [x]  Show the work (Build in Public)

- [x]  Credit @zocomputer for infrastructure

- [x]  Share real results, real failures

### Tone:

- [x]  Confident but not arrogant

- [x]  Helpful, not preachy

- [x]  Direct, not vague

- [x]  Occasional humor is fine

- [x]  Admit mistakes openly

### Topics (Approved):

- AI/automation tools and workflows
- Entrepreneurship and indie hacking
- E-commerce operations
- Tech stack decisions
- Build in public updates
- Industry news and opinions

### Topics (Banned):

- Politics or religion
- Hot-button social issues
- Personal finances (yours or others')
- Medical/health claims
- Legal advice

---

## Emergency Procedures

### If Bot Goes Rogue:

1. **IMMEDIATELY** kill the automation
2. Manually delete any inappropriate posts
3. Assess damage
4. Investigate root cause
5. Do not resume until guardrails reviewed

### If Account Locked:

1. Stop all automation
2. Do NOT attempt to unlock programmatically
3. User manually unlocks via Twitter
4. Investigate cause (rate limit? content? suspicious activity?)
5. Adjust limits before resuming

### If Posting Wrong Content:

1. Delete immediately
2. Post correction/apology if appropriate
3. Log incident
4. Review what content filters failed
5. Update guardrails

---

## Logging Requirements

### Log Everything:

- Timestamp of all actions
- What was posted (full text)
- Success/failure status
- Any errors encountered
- Human approval (yes/no and any edits)

### Log Location:

`/home/workspace/twitter-automation/logs/`

### Log Format:

```json
{
  "timestamp": "ISO8601",
  "action": "post|delete|edit|review",
  "content": "tweet text or description",
  "status": "success|failure|pending_approval",
  "human_approved": true|false,
  "edits": "any changes made",
  "error": "error message if any"
}
```

### Archiving:

- **Drafts not posted** (superseded, rejected) → `archives/drafts/pending-drafts_YYYY-MM-DD.json`
- **Drafts awaiting review** (never approved) → `archives/drafts/pending-approval_YYYY-MM-DD.json`
- **Posted content** → `archives/posted/` after successful publish, tagged with pillar and date
- **Never delete** archived content — retain full history

---

## Review Schedule

### Daily:

- [x]  Review previous day's posts

- [x]  Check for any issues or errors

- [x]  Verify log integrity

### Weekly:

- [x]  Review content performance (engagement)

- [x]  Assess if guardrails need updating

- [x]  Check for Twitter policy changes

### Monthly:

- [x]  Full audit of all posts

- [x]  Update approved topics if needed

- [x]  Review and update rate limits

- [x]  Assess automation value

---

## Approval Workflow

```markdown
1. Script generates draft
        ↓
2. Display draft to user (Zo chat/SMS)
        ↓
3. User approves/edits/declines
        ↓
4. If approved → post
        ↓
5. Confirm post and log
```

### Delivery Options:

- Show in Zo chat
- Send SMS to user
- Email notification
- (User chooses preferred method)

---

## Implementation Status

- [x]  Guardrails documented
- [x]  Human approval workflow implemented
- [x]  Rate limiting enforced
- [x]  Logging system active
- [x]  Alert system configured
- [ ]  Emergency stop procedure tested
- [x]  Session monitoring active

*Last Updated: 2026-03-27*