#!/usr/bin/env node
/**
 * Twitter Auto-Poster Scheduler - GUARDRAILS COMPLIANT
 * Human-in-the-loop approval before any post
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  cdpUrl: 'http://localhost:9222',
  logPath: path.join(__dirname, '../logs/scheduler.json.log'),
  draftsPath: path.join(__dirname, '../logs/pending-drafts.json'),
  statePath: path.join(__dirname, '../logs/state.json'),
  maxRetries: 3,
  retryDelay: 5000,
  typingDelay: 30,
  dailyTweetLimit: 30,
  alertThreshold80: 0.8,
  alertThreshold90: 0.9,
};

const CONTENT_PILLARS = {
  'Automation': [
    "Still trying to automate my Shopify inventory for SLABS. 3 weeks in and everything breaks at 2am. Some nights it works. Some nights I wake up to 400 errors. Here's what I don't understand:",
    "CSV imports were eating my records and I didn't realize for 3 days. Found 200 missing products the hard way. Still don't know why it happened. Just check twice now.",
    "Image upload breaks every other night. Can't figure out why. Sometimes it works, sometimes not. Set up an alert so I know when to restart it. That's not a fix, that's a bandaid.",
    "Listed a $9 record at $900 and didn't catch it for 2 days because I wasn't checking. Built a validator because I realized I can't trust myself to not be an idiot.",
  ],
  'AI in Wild': [
    "Tried 5 AI inventory systems. 4 thought I was dropshipping. None understood wholesale vinyl. Back to copy-pasting. The 'AI revolution' isn't here yet.",
    "Used Claude to write 847 descriptions. Saved 2 weeks. Had to redo 50 because the AI thought 'LP' meant 'long playing' literally. 'This record takes a long time.' Not kidding.",
    "Spent 3 days on Playwright just trying to wait for a page load. Tried 47 things. Nothing worked. Then it randomly worked. Don't know why.",
  ],
  'Hot Take': [
    "Half the AI content on here is from people who ran one tutorial. Where's the 'debugging at 2am' content? The 'I broke everything' posts? The ugly stuff matters.",
    "Everyone talks branding. I'm just trying to make sure my inventory isn't lying to me. The boring stuff is what breaks everything.",
    "Best Shopify stores I know aren't fancy. They're Python scripts, cron jobs, and prayers. The official tools either don't work or want $200/month.",
  ],
  'Founder Diary': [
    "This week: 47 new records, zero duplicates. Last week: 12 duplicates. Week before: 8 duplicates. Been trying to fix this since January. No pattern, no clue why.",
    "3 hours last night on image uploads. 2am realization: filename had an em-dash. Computers are stupid. I'm stupider. Fixed in 5 seconds, felt like an idiot.",
    "Saturday ritual: wake up, check logs, find something I don't understand broke overnight, Google for an hour, copy a StackOverflow fix from 2019, hope it works.",
  ],
  'Build in Public': [
    "Shipping got 47% faster this month. Not smarter. Just stopped tinkering and let the automation run. Took 3 tries. Still don't fully understand why it works now.",
    "Current stack: Python scripts I half-understand, n8n workflows I found somewhere, and a Chrome tab I can't close. It's embarrassing but it works. Mostly.",
    "Wiped entire draft inventory last month with one bad WHERE clause. No backup. Learned that lesson publicly. Sharing it so someone else doesn't have to.",
  ],
  'Tool Find': [
    "Was paying $50/month for image optimization. Turns out imagemagick + a 10-line bash script does the same thing for free. Took a day to understand it. Saved thousands.",
    "Waiting for someone to build inventory software that understands physical products. Until then I'm just duct-taping open source tools and hoping they hold.",
  ],
};

const POSTING_SCHEDULE = {
  monday:    [{ hour: 9, min: 0, pillar: 'Automation' }, { hour: 12, min: 0, pillar: 'AI in Wild' }, { hour: 18, min: 0, pillar: 'Hot Take' }],
  tuesday:   [{ hour: 9, min: 0, pillar: 'AI in Wild' }, { hour: 12, min: 0, pillar: 'Hot Take' }, { hour: 18, min: 0, pillar: 'Build in Public' }],
  wednesday: [{ hour: 9, min: 0, pillar: 'Hot Take' }, { hour: 12, min: 0, pillar: 'Automation' }, { hour: 18, min: 0, pillar: 'Founder Diary' }],
  thursday:  [{ hour: 9, min: 0, pillar: 'Automation' }, { hour: 12, min: 0, pillar: 'Tool Find' }, { hour: 18, min: 0, pillar: 'AI in Wild' }],
  friday:    [{ hour: 9, min: 0, pillar: 'Founder Diary' }, { hour: 12, min: 0, pillar: 'Build in Public' }, { hour: 18, min: 0, pillar: 'Hot Take' }],
  saturday:  [{ hour: 9, min: 0, pillar: 'Tool Find' }, { hour: 12, min: 0, pillar: 'Automation' }, { hour: 18, min: 0, pillar: 'AI in Wild' }],
  sunday:    [{ hour: 12, min: 0, pillar: 'Build in Public' }, { hour: 18, min: 0, pillar: 'Hot Take' }],
};

function logJson(entry) {
  const logEntry = { timestamp: new Date().toISOString(), ...entry };
  fs.appendFileSync(CONFIG.logPath, JSON.stringify(logEntry) + '\n');
}

function log(message, type = 'INFO') {
  console.log(`[${new Date().toISOString()}] [${type}] ${message}`);
  logJson({ level: type, message });
}

function loadState() {
  try {
    if (fs.existsSync(CONFIG.statePath)) {
      const data = fs.readFileSync(CONFIG.statePath, 'utf8');
      const state = JSON.parse(data);
      const today = new Date().toISOString().split('T')[0];
      if (state.date !== today) {
        return { date: today, dailyTweetCount: 0, sessionStart: new Date().toISOString() };
      }
      return state;
    }
  } catch (e) { log('State load error: ' + e.message, 'WARN'); }
  return { date: new Date().toISOString().split('T')[0], dailyTweetCount: 0, sessionStart: new Date().toISOString() };
}

function saveState(state) {
  try { fs.writeFileSync(CONFIG.statePath, JSON.stringify(state, null, 2)); }
  catch (e) { log('State save error: ' + e.message, 'ERROR'); }
}

function checkRateLimit() {
  const state = loadState();
  const limit = CONFIG.dailyTweetLimit;
  const count = state.dailyTweetCount || 0;
  if (count >= limit) {
    log('RATE LIMIT REACHED: ' + count + '/' + limit + ' tweets today.', 'WARN');
    return { allowed: false, count, limit, reason: 'Daily limit reached' };
  }
  const pct = count / limit;
  if (pct >= CONFIG.alertThreshold90) {
    log('ALERT: 90%+ rate limit (' + count + '/' + limit + ')', 'WARN');
    sendAlert('90% Rate Limit Alert: ' + count + '/' + limit + ' tweets used today');
  } else if (pct >= CONFIG.alertThreshold80) {
    log('ALERT: 80%+ rate limit (' + count + '/' + limit + ')', 'WARN');
    sendAlert('80% Rate Limit: ' + count + '/' + limit + ' tweets used today');
  }
  return { allowed: true, count, limit, remaining: limit - count };
}

function sendAlert(message) {
  const alertPath = path.join(__dirname, '../logs/alerts.json.log');
  const alert = { type: 'RATE_LIMIT_ALERT', message, timestamp: new Date().toISOString(), priority: 'HIGH' };
  fs.appendFileSync(alertPath, JSON.stringify(alert) + '\n');
  console.log('ALERT: ' + message);
}

async function validateSession(page) {
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    const isLoginRedirect = /\/login|\/signin|\/i\/flow\/login/i.test(finalUrl);
    const hasCompose = await page.locator('[data-testid="tweetTextarea_0"]').count();
    if (isLoginRedirect) {
      log('SESSION INVALID: redirected to login (' + finalUrl + ')', 'ERROR');
      sendAlert('Twitter session expired - manual re-auth required');
      return false;
    }
    if (hasCompose === 0) {
      log('SESSION INVALID: compose box not present at ' + finalUrl, 'ERROR');
      sendAlert('Twitter session expired - manual re-auth required');
      return false;
    }
    log('Session validated at ' + finalUrl);
    return true;
  } catch (e) { log('Session validation failed: ' + e.message, 'ERROR'); return false; }
}

function generateDraft(pillar) {
  const tweets = CONTENT_PILLARS[pillar] || CONTENT_PILLARS['Hot Take'];
  const tweet = tweets[Math.floor(Math.random() * tweets.length)];
  return { id: 'draft_' + Date.now(), pillar, content: tweet, createdAt: new Date().toISOString(), status: 'PENDING_APPROVAL' };
}

function saveDraft(draft) {
  const drafts = loadDrafts();
  drafts[draft.id] = draft;
  fs.writeFileSync(CONFIG.draftsPath, JSON.stringify(drafts, null, 2));
  return draft;
}

function loadDrafts() {
  try { if (fs.existsSync(CONFIG.draftsPath)) return JSON.parse(fs.readFileSync(CONFIG.draftsPath, 'utf8')); }
  catch (e) {}
  return {};
}

function getDraft(draftId) { const drafts = loadDrafts(); return drafts[draftId] || null; }

function markDraftApproved(draftId, editedContent) {
  const drafts = loadDrafts();
  if (drafts[draftId]) {
    drafts[draftId].status = 'APPROVED';
    drafts[draftId].approvedAt = new Date().toISOString();
    if (editedContent) { drafts[draftId].content = editedContent; drafts[draftId].edited = true; }
    fs.writeFileSync(CONFIG.draftsPath, JSON.stringify(drafts, null, 2));
    return drafts[draftId];
  }
  return null;
}

function markDraftDeclined(draftId) {
  const drafts = loadDrafts();
  if (drafts[draftId]) { drafts[draftId].status = 'DECLINED'; drafts[draftId].declinedAt = new Date().toISOString(); fs.writeFileSync(CONFIG.draftsPath, JSON.stringify(drafts, null, 2)); }
}

function markDraftPosted(draftId) {
  const drafts = loadDrafts();
  if (drafts[draftId]) {
    drafts[draftId].status = 'POSTED';
    drafts[draftId].postedAt = new Date().toISOString();
    fs.writeFileSync(CONFIG.draftsPath, JSON.stringify(drafts, null, 2));
    logJson({ level: 'INFO', type: 'TWEET_POSTED', draftId, pillar: drafts[draftId].pillar, content: drafts[draftId].content, humanApproved: true });
  }
}

async function requestHumanApproval(draft) {
  log('DRAFT GENERATED: ' + draft.id, 'INFO');
  console.log('\n========================================');
  console.log('HUMAN APPROVAL REQUIRED');
  console.log('========================================');
  console.log('Draft ID: ' + draft.id);
  console.log('Pillar: ' + draft.pillar);
  console.log('Content: ' + draft.content);
  console.log('========================================');
  console.log('To approve:  node scheduler.js --approve ' + draft.id);
  console.log('To edit+approve: node scheduler.js --approve ' + draft.id + ' --edit "new content"');
  console.log('To decline: node scheduler.js --decline ' + draft.id);
  console.log('========================================\n');
  fs.writeFileSync(path.join(__dirname, '../logs/pending-approval.json'), JSON.stringify({ draftId: draft.id, content: draft.content, pillar: draft.pillar, requestedAt: new Date().toISOString(), status: 'AWAITING_APPROVAL' }, null, 2));
  return draft;
}

async function connectBrowser() {
  log('Connecting to Chromium via CDP...');
  try {
    const browser = await chromium.connectOverCDP(CONFIG.cdpUrl);
    const ctx = browser.contexts()[0];
    const page = ctx.pages()[0];
    if (!page) throw new Error('No pages found in CDP session');
    log('Connected to existing Chromium session');
    return { browser, page };
  } catch (error) { log('CDP connection failed: ' + error.message, 'ERROR'); throw error; }
}

async function postTweet(page, message) {
  log('Posting: "' + message.substring(0, 50) + '..."');
  try {
    await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.keyboard.type(message, { delay: CONFIG.typingDelay });
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(3000);
    log('Tweet posted successfully');
    return true;
  } catch (error) { log('Post failed: ' + error.message, 'ERROR'); return false; }
}

async function postTweetWithRetry(page, message) {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    log('Post attempt ' + attempt + '/' + CONFIG.maxRetries);
    const success = await postTweet(page, message);
    if (success) return true;
    if (attempt < CONFIG.maxRetries) { log('Retrying in ' + CONFIG.retryDelay / 1000 + 's...'); await new Promise(r => setTimeout(r, CONFIG.retryDelay)); }
  }
  log('All post attempts failed', 'ERROR');
  return false;
}

function shouldPostNow() {
  const now = new Date();
  const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const schedule = POSTING_SCHEDULE[dayName];
  if (!schedule || schedule.length === 0) return { shouldPost: false, reason: dayName + ' - no scheduled posts' };
  for (const slot of schedule) {
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    if (currentHour === slot.hour && Math.abs(currentMin - slot.min) <= 5) {
      return { shouldPost: true, pillar: slot.pillar, scheduledTime: slot.hour + ':' + slot.min.toString().padStart(2, '0'), day: dayName };
    }
  }
  return { shouldPost: false, reason: dayName + ' ' + now.getHours() + ':' + now.getMinutes() + ' - not a scheduled slot' };
}

function getNextPostTime() {
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() + i);
    const dayName = days[checkDate.getDay()];
    const schedule = POSTING_SCHEDULE[dayName];
    if (schedule && schedule.length > 0) {
      const { hour, min, pillar } = schedule[0];
      const postTime = new Date(checkDate);
      postTime.setHours(hour, min, 0, 0);
      if (postTime > now) return { time: postTime, pillar, day: dayName };
    }
  }
  return null;
}

function showCalendar() {
  console.log('=== Upcoming Posts ===');
  for (const [day, schedule] of Object.entries(POSTING_SCHEDULE)) {
    if (schedule.length > 0) {
      console.log('\n' + day.charAt(0).toUpperCase() + day.slice(1) + ':');
      for (const slot of schedule) console.log('  - ' + slot.hour + ':' + slot.min.toString().padStart(2, '0') + ' ET: ' + slot.pillar);
    }
  }
  const next = getNextPostTime();
  if (next) console.log('\nNext post: ' + next.day + ' at ' + next.time.toISOString() + ' ET - ' + next.pillar);
}

async function runScheduler() {
  log('=== Twitter Scheduler Started (Guardrails Compliant) ===');
  const logsDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const { browser, page } = await connectBrowser();
  const sessionValid = await validateSession(page);
  if (!sessionValid) { log('Session invalid. Stopping scheduler.', 'ERROR'); return; }
  log('Next post: ' + JSON.stringify(getNextPostTime()));
  while (true) {
    const { shouldPost, pillar, reason } = shouldPostNow();
    if (shouldPost) {
      const rateCheck = checkRateLimit();
      if (!rateCheck.allowed) { await new Promise(r => setTimeout(r, 5 * 60 * 1000)); continue; }
      log('Time to post! Pillar: ' + pillar);
      const draft = generateDraft(pillar);
      saveDraft(draft);
      await requestHumanApproval(draft);
      await new Promise(r => setTimeout(r, 5 * 60 * 1000));
    } else {
      if (reason.includes('not a scheduled slot')) process.stdout.write('.');
    }
    await new Promise(r => setTimeout(r, 60 * 1000));
  }
}

async function handleApproval(draftId, editedContent) {
  const draft = getDraft(draftId);
  if (!draft) { console.log('Draft ' + draftId + ' not found.'); return; }
  if (draft.status !== 'PENDING_APPROVAL') { console.log('Draft ' + draftId + ' already processed (status: ' + draft.status + ').'); return; }
  markDraftApproved(draftId, editedContent);
  log('Draft ' + draftId + ' approved by human');
  const { browser, page } = await connectBrowser();
  const sessionValid = await validateSession(page);
  if (!sessionValid) { log('Session invalid. Cannot post.', 'ERROR'); return; }
  const content = editedContent || draft.content;
  const success = await postTweetWithRetry(page, content);
  if (success) {
    markDraftPosted(draftId);
    const state = loadState();
    state.dailyTweetCount++;
    saveState(state);
    log('Tweet posted. Daily count: ' + state.dailyTweetCount + '/' + CONFIG.dailyTweetLimit);
  }
  await browser.close();
}

const args = process.argv.slice(2);
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

if (args.includes('--test')) {
  const draft = generateDraft('Automation');
  saveDraft(draft);
  requestHumanApproval(draft);
} else if (args.includes('--approve')) {
  const approveIdx = args.indexOf('--approve');
  const draftId = args[approveIdx + 1];
  let editedContent = null;
  if (args.includes('--edit')) {
    const editIdx = args.indexOf('--edit');
    editedContent = args.slice(editIdx + 1).join(' ');
  }
  handleApproval(draftId, editedContent);
} else if (args.includes('--decline')) {
  const declineIdx = args.indexOf('--decline');
  const draftId = args[declineIdx + 1];
  markDraftDeclined(draftId);
  log('Draft ' + draftId + ' declined by human');
} else if (args.includes('--calendar')) {
  showCalendar();
} else if (args.includes('--status')) {
  const state = loadState();
  console.log('=== Twitter Scheduler Status ===');
  console.log('Daily tweets: ' + state.dailyTweetCount + '/' + CONFIG.dailyTweetLimit);
  const drafts = loadDrafts();
  const pending = Object.values(drafts).filter(d => d.status === 'PENDING_APPROVAL');
  console.log('Pending drafts: ' + pending.length);
  if (pending.length > 0) {
    pending.forEach(d => console.log('  - ' + d.id + ': ' + d.content.substring(0, 50) + '...'));
  }
} else {
  runScheduler();
}
