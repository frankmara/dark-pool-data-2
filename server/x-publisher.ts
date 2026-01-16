import crypto from 'crypto';

interface PublishResult {
  tweetIds: string[];
}

interface PublishOptions {
  runId: string;
  maxRetries?: number;
  baseDelayMs?: number;
}

interface OAuthCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

function getCredentials(): OAuthCredentials {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('Missing X/Twitter user-context credentials. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET.');
  }

  return { apiKey, apiSecret, accessToken, accessSecret };
}

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27');
}

function buildOAuthHeader(method: string, url: string, credentials: OAuthCredentials): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: '1.0',
  };

  const parameterString = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key])}`)
    .join('&');

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(parameterString)].join('&');
  const signingKey = `${percentEncode(credentials.apiSecret)}&${percentEncode(credentials.accessSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams.oauth_signature = signature;

  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParams}`;
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const anyError = error as { status?: number; response?: { status?: number } };
  return anyError.status || anyError.response?.status;
}

function isRetryableStatus(status?: number) {
  return status === 429 || (status !== undefined && status >= 500 && status < 600);
}

async function withRetries<T>(
  operation: () => Promise<T>,
  { maxRetries = 3, baseDelayMs = 1000 }: Required<Pick<PublishOptions, 'maxRetries' | 'baseDelayMs'>>
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      const status = getStatusCode(error);
      if (attempt > maxRetries || !isRetryableStatus(status)) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function postTweet(text: string, replyToId?: string) {
  const credentials = getCredentials();
  const url = 'https://api.twitter.com/2/tweets';
  const body = replyToId ? { text, reply: { in_reply_to_tweet_id: replyToId } } : { text };
  const authHeader = buildOAuthHeader('POST', url, credentials);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`X API error ${response.status}`);
    (error as { status?: number; details?: string }).status = response.status;
    (error as { details?: string }).details = errorText.slice(0, 500);
    throw error;
  }

  const data = await response.json() as { data?: { id?: string } };
  const tweetId = data.data?.id;
  if (!tweetId) {
    throw new Error('X API did not return tweet ID');
  }

  return tweetId;
}

export async function postThread(parts: string[], options: PublishOptions): Promise<PublishResult> {
  const tweetIds: string[] = [];
  let replyToId: string | undefined;

  for (const part of parts) {
    const tweetId = await withRetries(
      () => postTweet(part, replyToId),
      {
        maxRetries: options.maxRetries ?? 3,
        baseDelayMs: options.baseDelayMs ?? 1000,
      }
    );

    tweetIds.push(tweetId);
    replyToId = tweetId;
  }

  return { tweetIds };
}
