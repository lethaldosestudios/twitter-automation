#!/usr/bin/env node
/**
 * Twitter Engagement Automation
 * Auto-likes, retweets, and replies to relevant content
 * Uses existing authenticated Chromium session via CDP
 * 
 * Usage:
 *   node engagement.js              # Run engagement loop
 *   node engagement.js --dry-run   # Show actions without executing
 *   node engagement.js --config    # Show current config
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  cdpUrl: 'http://localhost:9222',
  logPath: path.join(__dirname, '../logs/engagement.log'),
  dryRun: false,
  
  // Engagement targets
  targets: {
    hashtags: ['#AgenticAI', '#AIautomation', '#NoCode', '#Solopreneur', '#N8n'],
    keywords: ['AI agent', 'automation', 'n8n', 'zapier', 'no-code', 'build in public', 'AI tools', 'AI workflow'],
    accounts: ['@n8n_io', '@Zapier', '@marc_lake', '@shaushing', '@sarah_ocker', '@thealexholtz'],
    excludeWords: ['scam', 'hack', 'buy followers', 'get rich quick'],
  },
  
  // Timing
  checkIntervalMs: 5 * 60 * 1000,     // Check every 5 minutes
  maxActionsPerCycle: 10,              // Max likes/retweets per cycle
  delayBetweenActions: 2000,           // Delay between actions (ms)
  
  // Reply configuration
  enableReplies: true,
  replyTemplates: [
    "Great point! {add_value}",
    "This. I've been using {tool} for {use_case} and it's a game changer.",
    "Agreed. The key insight is {insight}.",
    "Solid take. Worth bookmarking.",
    "Exactly why I built {mention_your_tool}.",
  ],
  
  // Account targeting
  minFollowers: 500,
  maxFollowers: 100000,
  preferVerified: false,
};

// Reply template bank - add personalized responses here
const REPLY_BANK = {
  'automation': [
    "Exactly this. I automated the same thing with n8n — saved 10hrs/week.",
    "The automation stack is the moat. Anyone can use prompts.",
  ],
  'AI agent': [
    "Agentic AI is the shift. Prompts are table stakes now.",
    "Been running AI agents 24/7 for 6 months. Changed everything.",
  ],
  'tool': [
    "Have you tried {tool_name}? It handles this natively.",
    "Check out {tool_name} — solved this exact problem for me.",
  ],
  'default': [
    "Solid insight. Sharing this with my audience.",
    "This is why I post about {topic}. Bookmarking.",
  ],
};

let logStream;

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${type}] ${message}`;
  console.log(entry);
  fs.appendFileSync(CONFIG.logPath, entry + '\n');
}

/**
 * Connect to existing Chromium session via CDP
 */
async function connectBrowser() {
  log('Connecting to Chromium via CDP...');
  
  try {
    const browser = await chromium.connectOverCDP(CONFIG.cdpUrl);
    const ctx = browser.contexts()[0];
    const page = ctx.pages()[0];
    
    if (!page) {
      throw new Error('No pages found in CDP session');
    }
    
    log('Connected to existing Chromium session');
    return { browser, page };
  } catch (error) {
    log(`CDP connection failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Like a tweet
 */
async function likeTweet(page, tweetElement) {
  if (CONFIG.dryRun) {
    log('[DRY RUN] Would like tweet');
    return true;
  }
  
  try {
    const likeButton = await tweetElement.$('[data-testid="like"]');
    if (likeButton) {
      await likeButton.click();
      log('Liked tweet');
      return true;
    }
  } catch (error) {
    log(`Like failed: ${error.message}`, 'ERROR');
  }
  return false;
}

/**
 * Retweet with a quote/add-value
 */
async function retweet(page, tweetElement) {
  if (CONFIG.dryRun) {
    log('[DRY RUN] Would retweet');
    return true;
  }
  
  try {
    const retweetButton = await tweetElement.$('[data-testid="retweet"]');
    if (retweetButton) {
      await retweetButton.click();
      await page.waitForTimeout(500);
      
      // Click "Repost" to do a pure RT
      const repostOption = await page.$('div[role="menuitem"]:has-text("Repost")');
      if (repostOption) {
        await repostOption.click();
        log('Retweeted');
        return true;
      }
    }
  } catch (error) {
    log(`Retweet failed: ${error.message}`, 'ERROR');
  }
  return false;
}

/**
 * Generate a contextual reply
 */
function generateReply(tweetText) {
  const templates = CONFIG.replyTemplates;
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Find matching keyword
  let matchedKeyword = 'default';
  for (const keyword of CONFIG.targets.keywords) {
    if (tweetText.toLowerCase().includes(keyword.toLowerCase())) {
      matchedKeyword = keyword;
      break;
    }
  }
  
  let reply = template;
  
  // Replace placeholders
  const placeholders = {
    '{add_value}': 'The follow-through is what separates automated from automated WELL.',
    '{tool}': 'n8n',
    '{use_case}': 'content distribution',
    '{insight}': 'the system underneath matters more than the prompt on top',
    '{mention_your_tool}': 'my automation stack',
    '{topic}': 'AI systems',
    '{tool_name}': 'OpenClaw',
  };
  
  for (const [placeholder, value] of Object.entries(placeholders)) {
    reply = reply.replace(placeholder, value);
  }
  
  return reply;
}

/**
 * Reply to a tweet
 */
async function replyToTweet(page, tweetElement, tweetText) {
  if (CONFIG.dryRun) {
    log(`[DRY RUN] Would reply: "${generateReply(tweetText).substring(0, 50)}..."`);
    return true;
  }
  
  if (!CONFIG.enableReplies) {
    return false;
  }
  
  try {
    // Click reply button
    const replyButton = await tweetElement.$('[data-testid="reply"]');
    if (replyButton) {
      await replyButton.click();
      await page.waitForTimeout(1000);
      
      // Type reply
      const replyText = generateReply(tweetText);
      await page.keyboard.type(replyText, { delay: 30 });
      await page.waitForTimeout(500);
      
      // Submit
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(2000);
      
      log(`Replied: "${replyText.substring(0, 50)}..."`);
      return true;
    }
  } catch (error) {
    log(`Reply failed: ${error.message}`, 'ERROR');
  }
  return false;
}

/**
 * Check if tweet should be engaged with
 */
function shouldEngage(tweetText, engagementCount) {
  if (engagementCount >= CONFIG.maxActionsPerCycle) {
    return false;
  }
  
  // Check exclusions
  const textLower = tweetText.toLowerCase();
  for (const exclude of CONFIG.targets.excludeWords) {
    if (textLower.includes(exclude)) {
      return false;
    }
  }
  
  // Check inclusions
  const hasTarget = CONFIG.targets.keywords.some(kw => 
    textLower.includes(kw.toLowerCase())
  );
  
  const hasHashtag = CONFIG.targets.hashtags.some(h => 
    textLower.includes(h.toLowerCase())
  );
  
  return hasTarget || hasHashtag;
}

/**
 * Search for tweets and engage
 */
async function engagementCycle(page) {
  log('=== Starting Engagement Cycle ===');
  
  const hashtags = CONFIG.targets.hashtags;
  let totalEngaged = 0;
  
  for (const hashtag of hashtags) {
    if (totalEngaged >= CONFIG.maxActionsPerCycle) break;
    
    log(`Searching: ${hashtag}`);
    
    try {
      // Navigate to hashtag search
      const searchUrl = `https://x.com/search?q=${encodeURIComponent(hashtag)}&src=typed_query`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
      
      // Find tweets
      const tweets = await page.$$('[data-testid="tweet"]');
      log(`Found ${tweets.length} tweets for ${hashtag}`);
      
      let cycleEngaged = 0;
      
      for (const tweet of tweets) {
        if (totalEngaged >= CONFIG.maxActionsPerCycle) break;
        if (cycleEngaged >= 3) break; // Max 3 per hashtag
        
        try {
          // Get tweet text
          const tweetTextEl = await tweet.$('[lang="en"]');
          const tweetText = tweetTextEl ? await tweetTextEl.textContent() : '';
          
          if (!shouldEngage(tweetText, totalEngaged)) continue;
          
          // Random engagement decision
          const action = Math.random();
          
          if (action < 0.5) {
            // Like
            await likeTweet(page, tweet);
            totalEngaged++;
            cycleEngaged++;
          } else if (action < 0.8) {
            // Retweet
            await retweet(page, tweet);
            totalEngaged++;
            cycleEngaged++;
          } else if (CONFIG.enableReplies) {
            // Reply
            await replyToTweet(page, tweet, tweetText);
            totalEngaged++;
            cycleEngaged++;
          }
          
          await new Promise(r => setTimeout(r, CONFIG.delayBetweenActions));
          
        } catch (error) {
          log(`Engagement action failed: ${error.message}`, 'ERROR');
        }
      }
      
    } catch (error) {
      log(`Search failed for ${hashtag}: ${error.message}`, 'ERROR');
    }
    
    await new Promise(r => setTimeout(r, 5000)); // Delay between hashtags
  }
  
  log(`=== Engagement Cycle Complete: ${totalEngaged} actions ===`);
  return totalEngaged;
}

/**
 * Engage with timeline (home feed)
 */
async function engageWithTimeline(page) {
  if (CONFIG.dryRun) {
    log('[DRY RUN] Would engage with timeline');
    return;
  }
  
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const tweets = await page.$$('[data-testid="tweet"]');
    let engaged = 0;
    
    for (const tweet of tweets) {
      if (engaged >= 5) break; // Max 5 from timeline
      
      try {
        const tweetTextEl = await tweet.$('[lang="en"]');
        const tweetText = tweetTextEl ? await tweetTextEl.textContent() : '';
        
        if (shouldEngage(tweetText, engaged)) {
          const action = Math.random();
          if (action < 0.6) {
            await likeTweet(page, tweet);
            engaged++;
          }
        }
      } catch (e) {
        // Skip this tweet
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
    
    log(`Timeline engagement: ${engaged} likes`);
    
  } catch (error) {
    log(`Timeline engagement failed: ${error.message}`, 'ERROR');
  }
}

/**
 * Engage with target accounts
 */
async function engageWithTargetAccounts(page) {
  if (CONFIG.dryRun) {
    log('[DRY RUN] Would engage with target accounts');
    return 0;
  }
  
  const accounts = CONFIG.targets.accounts;
  let engaged = 0;
  
  for (const account of accounts) {
    if (engaged >= 5) break; // Max 5 per cycle
    
    try {
      const handle = account.replace('@', '');
      const profileUrl = `https://x.com/${handle}`;
      log(`Checking account: ${account}`);
      
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      // Get recent tweets from profile
      const tweets = await page.$$('[data-testid="tweet"]');
      log(`Found ${tweets.length} tweets from ${account}`);
      
      for (const tweet of tweets) {
        if (engaged >= 5) break;
        
        try {
          const tweetTextEl = await tweet.$('[lang="en"]');
          const tweetText = tweetTextEl ? await tweetTextEl.textContent() : '';
          
          // Check if we should engage (contains keywords or hashtags)
          if (!shouldEngage(tweetText, engaged)) continue;
          
          // Random engagement: like or retweet (no auto-reply to accounts to avoid spam)
          const action = Math.random();
          if (action < 0.6) {
            await likeTweet(page, tweet);
            engaged++;
          } else {
            await retweet(page, tweet);
            engaged++;
          }
          
          await new Promise(r => setTimeout(r, CONFIG.delayBetweenActions));
          
        } catch (error) {
          log(`Action failed for ${account}: ${error.message}`, 'ERROR');
        }
      }
      
    } catch (error) {
      log(`Failed to check account ${account}: ${error.message}`, 'ERROR');
    }
    
    await new Promise(r => setTimeout(r, 3000)); // Delay between accounts
  }
  
  log(`Target account engagement: ${engaged} actions`);
  return engaged;
}

/**
 * Main engagement loop
 */
async function runEngagementLoop() {
  log('=== Twitter Engagement Bot Started ===');
  log(`Configuration: ${JSON.stringify({ 
    dryRun: CONFIG.dryRun,
    maxActionsPerCycle: CONFIG.maxActionsPerCycle,
    checkIntervalSec: CONFIG.checkIntervalMs / 1000 
  })}`);
  log(`Keywords: ${CONFIG.targets.keywords.join(', ')}`);
  log(`Target accounts: ${CONFIG.targets.accounts.join(', ')}`);
  log(`Hashtags: ${CONFIG.targets.hashtags.join(', ')}`);
  
  const { browser, page } = await connectBrowser();
  
  // Run first cycle immediately
  await engagementCycle(page);
  await engageWithTargetAccounts(page);
  
  // Then loop
  while (true) {
    log(`Sleeping ${CONFIG.checkIntervalMs / 1000 / 60} minutes until next cycle...`);
    await new Promise(r => setTimeout(r, CONFIG.checkIntervalMs));
    
    try {
      await engagementCycle(page);
      await engageWithTargetAccounts(page);
    } catch (error) {
      log(`Cycle failed: ${error.message}`, 'ERROR');
    }
  }
}

/**
 * Show configuration
 */
function showConfig() {
  console.log('\n=== Engagement Configuration ===\n');
  console.log('Targets:');
  console.log('  Hashtags:', CONFIG.targets.hashtags.join(', '));
  console.log('  Keywords:', CONFIG.targets.keywords.join(', '));
  console.log('  Accounts:', CONFIG.targets.accounts.join(', '));
  console.log('\nTiming:');
  console.log('  Check interval:', CONFIG.checkIntervalMs / 1000 / 60, 'minutes');
  console.log('  Max actions/cycle:', CONFIG.maxActionsPerCycle);
  console.log('  Delay between actions:', CONFIG.delayBetweenActions, 'ms');
  console.log('\nReply templates:', CONFIG.replyTemplates.length);
  console.log('  Auto-replies enabled:', CONFIG.enableReplies);
}

// Main
const args = process.argv.slice(2);

if (args.includes('--dry-run')) {
  CONFIG.dryRun = true;
  log('DRY RUN MODE - No actions will be taken');
}

if (args.includes('--config')) {
  showConfig();
  process.exit(0);
}

if (args.includes('--once')) {
  // Run one cycle and exit
  runEngagementLoop().then(async ({ browser }) => {
    log('Single cycle complete');
    await browser.close();
    process.exit(0);
  }).catch(e => {
    log(`Fatal error: ${e.message}`, 'ERROR');
    process.exit(1);
  });
} else {
  runEngagementLoop().catch(e => {
    log(`Fatal error: ${e.message}`, 'ERROR');
    process.exit(1);
  });
}
