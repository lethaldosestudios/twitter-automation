#!/usr/bin/env node
/**
 * Twitter Auto-Poster with Human Approval
 * 
 * This script generates draft tweets but REQUIRES human approval
 * before posting. It will:
 *   1. Generate draft content
 *   2. Display it for review
 *   3. WAIT for approval
 *   4. Only post after user confirms
 */

const { chromium } = require('playwright');

// Configuration
const CDP_URL = 'http://localhost:9222';
const DRAFT_FILE = '/home/workspace/twitter-automation/pending-drafts.json';
const LOG_FILE = '/home/workspace/twitter-automation/logs/post-log.jsonl';

// Rate limits (safety caps)
const LIMITS = {
  maxPostsPerDay: 30,
  minIntervalMs: 60000, // 1 minute between posts
  maxRetries: 2
};

// Load pending drafts
function loadDrafts() {
  const fs = require('fs');
  if (!fs.existsSync(DRAFT_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// Save pending drafts
function saveDrafts(drafts) {
  const fs = require('fs');
  fs.writeFileSync(DRAFT_FILE, JSON.stringify(drafts, null, 2));
}

// Log action
function logAction(action, data) {
  const fs = require('fs');
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...data
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

// Check if can post (rate limiting)
async function canPost() {
  const drafts = loadDrafts();
  const today = new Date().toISOString().split('T')[0];
  
  const todayPosts = drafts.filter(d => 
    d.posted && d.timestamp.startsWith(today)
  );
  
  if (todayPosts.length >= LIMITS.maxPostsPerDay) {
    return { can: false, reason: `Daily limit reached (${LIMITS.maxPostsPerDay})` };
  }
  
  // Check last post time
  const lastPost = drafts.filter(d => d.posted)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  
  if (lastPost) {
    const elapsed = Date.now() - new Date(lastPost.timestamp).getTime();
    if (elapsed < LIMITS.minIntervalMs) {
      return { 
        can: false, 
        reason: `Must wait ${Math.ceil((LIMITS.minIntervalMs - elapsed)/1000)}s between posts` 
      };
    }
  }
  
  return { can: true };
}

// Generate draft (placeholder - can be enhanced with AI)
function generateDraft(content) {
  return {
    id: `draft-${Date.now()}`,
    content: content || process.argv.slice(2).join(' '),
    timestamp: new Date().toISOString(),
    status: 'pending',
    approved: false
  };
}

// Main flow
async function main() {
  const action = process.argv[2];
  
  if (action === 'draft') {
    // Generate a draft
    const content = process.argv.slice(3).join(' ') || 'New tweet draft';
    const draft = generateDraft(content);
    
    const drafts = loadDrafts();
    drafts.push(draft);
    saveDrafts(drafts);
    
    console.log('📝 DRAFT CREATED:');
    console.log('   ID:', draft.id);
    console.log('   Content:', draft.content);
    console.log('');
    console.log('To approve: node auto-poster.js approve', draft.id);
    console.log('To reject:  node auto-poster.js reject', draft.id);
    
    return;
  }
  
  if (action === 'approve') {
    const draftId = process.argv[3];
    if (!draftId) {
      console.error('Usage: node auto-poster.js approve <draft-id>');
      process.exit(1);
    }
    
    const drafts = loadDrafts();
    const draft = drafts.find(d => d.id === draftId);
    
    if (!draft) {
      console.error('Draft not found:', draftId);
      process.exit(1);
    }
    
    if (draft.approved) {
      console.error('Draft already approved');
      process.exit(1);
    }
    
    // Check rate limits
    const check = await canPost();
    if (!check.can) {
      console.error('❌ Cannot post:', check.reason);
      process.exit(1);
    }
    
    // Post the tweet
    console.log('🔄 Posting tweet...');
    
    let browser;
    try {
      browser = await chromium.connectOverCDP(CDP_URL);
      const ctx = browser.contexts()[0];
      const pages = await ctx.pages();
      const page = pages[0];
      
      // Navigate to home
      await page.goto('https://x.com/home', { timeout: 20000 });
      await page.waitForTimeout(2000);
      
      // Click compose
      const composeBtn = await page.$('[aria-label="Post"]');
      if (composeBtn) {
        await composeBtn.click();
        await page.waitForTimeout(1000);
      }
      
      // Type tweet
      const textarea = await page.$('[data-testid="tweetTextarea"]');
      if (textarea) {
        await textarea.click();
        await textarea.fill(draft.content);
        await page.waitForTimeout(500);
      }
      
      // Post
      const postBtn = await page.$('[data-testid="tweetButton"]');
      if (postBtn) {
        await postBtn.click();
        await page.waitForTimeout(2000);
      }
      
      // Mark as approved and posted
      draft.approved = true;
      draft.status = 'posted';
      draft.posted = true;
      draft.postedAt = new Date().toISOString();
      saveDrafts(drafts);
      
      console.log('✅ Tweet posted successfully!');
      logAction('post', { draftId, content: draft.content, status: 'success' });
      
    } catch (err) {
      console.error('❌ Posting failed:', err.message);
      logAction('post', { draftId, content: draft.content, status: 'failed', error: err.message });
      draft.status = 'failed';
      draft.error = err.message;
      saveDrafts(drafts);
    } finally {
      if (browser) await browser.close();
    }
    
    return;
  }
  
  if (action === 'reject') {
    const draftId = process.argv[3];
    const reason = process.argv.slice(4).join(' ');
    
    const drafts = loadDrafts();
    const idx = drafts.findIndex(d => d.id === draftId);
    
    if (idx === -1) {
      console.error('Draft not found:', draftId);
      process.exit(1);
    }
    
    drafts[idx].status = 'rejected';
    drafts[idx].rejectedAt = new Date().toISOString();
    drafts[idx].rejectReason = reason;
    saveDrafts(drafts);
    
    console.log('❌ Draft rejected:', draftId);
    if (reason) console.log('   Reason:', reason);
    logAction('reject', { draftId, reason });
    
    return;
  }
  
  if (action === 'list') {
    const drafts = loadDrafts();
    console.log('📋 PENDING DRAFTS:\n');
    
    const pending = drafts.filter(d => d.status === 'pending');
    if (pending.length === 0) {
      console.log('No pending drafts');
      return;
    }
    
    pending.forEach(d => {
      console.log(`[${d.id}]`);
      console.log(`  ${d.content}`);
      console.log(`  Created: ${d.timestamp}`);
      console.log('');
    });
    
    console.log('Approve: node auto-poster.js approve <id>');
    console.log('Reject:  node auto-poster.js reject <id> [reason]');
    return;
  }
  
  if (action === 'status') {
    const drafts = loadDrafts();
    const today = new Date().toISOString().split('T')[0];
    
    const todayPosts = drafts.filter(d => d.posted && d.timestamp.startsWith(today));
    const pending = drafts.filter(d => d.status === 'pending');
    
    console.log('📊 POSTING STATUS:\n');
    console.log(`  Posts today: ${todayPosts.length} / ${LIMITS.maxPostsPerDay}`);
    console.log(`  Pending drafts: ${pending.length}`);
    console.log(`  Rate limit: ${LIMITS.maxPostsPerDay} posts/day`);
    console.log(`  Min interval: ${LIMITS.minIntervalMs/1000}s between posts`);
    
    if (todayPosts.length >= LIMITS.maxPostsPerDay * 0.9) {
      console.log('\n⚠️  Approaching daily limit!');
    }
    
    return;
  }
  
  // Default: show help
  console.log(`
Twitter Auto-Poster with Human Approval
=======================================

Usage:
  node auto-poster.js draft [content]     Create a draft
  node auto-poster.js list                List pending drafts
  node auto-poster.js approve <id>        Approve and post a draft
  node auto-poster.js reject <id> [reason] Reject a draft
  node auto-poster.js status              Check rate limits

Workflow:
  1. node auto-poster.js draft "Your tweet content here"
  2. Review the draft
  3. node auto-poster.js approve <draft-id>
  4. Tweet is posted

Safety Features:
  - All posts require human approval
  - Rate limiting (max ${LIMITS.maxPostsPerDay}/day)
  - Minimum ${LIMITS.minIntervalMs/1000}s between posts
  - Full activity logging
`);
}

main().catch(console.error);
