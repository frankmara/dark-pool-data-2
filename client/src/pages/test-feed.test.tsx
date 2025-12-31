/**
 * TweetCard rendering tests
 * Run with: npx tsx client/src/pages/test-feed.test.tsx
 */

import React from "react";
import ReactDOMServer from "react-dom/server";
import { TweetCard } from "./test-feed";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.log(`  ✗ ${message}`);
    failCount++;
  }
}

function testGroup(name: string, fn: () => void) {
  console.log(`\n${name}`);
  console.log('='.repeat(name.length));
  fn();
}

testGroup('TweetCard rendering', () => {
  const basePost: any = {
    id: '1',
    ticker: 'AAPL',
    eventType: 'options_sweep',
    conviction: 'high',
    generatedAt: new Date().toISOString(),
    sentiment: 'bullish',
    engagement: {}
  };

  const missingThreadHtml = ReactDOMServer.renderToString(
    <TweetCard post={{ ...basePost, thread: undefined }} />
  );

  assert(missingThreadHtml.length > 0, 'renders safely when thread is undefined');

  const emptyThreadHtml = ReactDOMServer.renderToString(
    <TweetCard post={{ ...basePost, thread: [] }} />
  );
  assert(emptyThreadHtml.includes('Thread content unavailable'), 'renders placeholder when thread is empty');

  const blockedPost = {
    ...basePost,
    thread: [],
    validation: {
      isPublishable: false,
      summary: 'Validation FAILED',
      errors: [{ code: 'EXPIRY_DATA_MISSING', message: 'No volatility smile for expiry' }],
      warnings: [{ code: 'MOCK_DATA_USED', message: 'Mock data used' }]
    }
  };

  const blockedHtml = ReactDOMServer.renderToString(<TweetCard post={blockedPost} />);

  assert(blockedHtml.includes('Blocked'), 'renders blocked badge when validation fails');
  assert(blockedHtml.includes('EXPIRY_DATA_MISSING'), 'renders validation error codes');
  assert(blockedHtml.includes('Mock data used'), 'renders validation warnings');
});

console.log(`\nPass: ${passCount}, Fail: ${failCount}`);
if (failCount > 0) {
  process.exit(1);
}
