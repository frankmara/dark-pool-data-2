# Dark Pool Data

## Overview
This repo generates X (Twitter) threads for unusual options flow and dark pool prints. Generation now writes provenance artifacts to `runs/<runId>` and uses a single publish gate to ensure nothing publishes when data is missing or mocked.

## Quick start

### 1) Install
```bash
npm install
```

### 2) Configure environment
Copy the example env file and fill in credentials.
```bash
cp .env.example .env
```

### 3) Generate a run (writes `runs/<runId>/report.json`)
```bash
npm run generate -- --symbol AAPL
```

### 4) Validate
Validation happens automatically on generation. Inspect:
```bash
cat runs/<runId>/report.json
```

### 5) Dry-run publish (no network calls)
```bash
npm run publish:dry -- --runId <runId>
```

### 6) Live publish to X
```bash
npm run publish:live -- --runId <runId>
```

## Run artifacts
Every run writes:
- `runs/<runId>/inputs.json`
- `runs/<runId>/artifacts/run.json`
- `runs/<runId>/artifacts/thread.json`
- `runs/<runId>/report.json` (Data Quality Report)
- `runs/<runId>/raw/*.json` (raw payload snapshots)

The publish gate reads `artifacts/run.json` and blocks if any fallback/mock data was used or if required upstream data is missing.

## X (Twitter) credentials
User-context credentials are required for posting threads:
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_SECRET`

## Scripts
- `npm run generate -- --symbol AAPL [--postType options|dark_pool] [--runId <id>]`
- `npm run publish:dry -- --runId <runId>`
- `npm run publish:live -- --runId <runId>`
- `npm run test`
- `npm run check`

## Notes
- The publish gate is the only path to posting threads.
- If `report.json` shows `isPublishable=false`, live publishing is blocked.
