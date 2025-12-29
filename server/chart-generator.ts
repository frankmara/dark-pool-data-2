// TRUTH GATE HELPERS: Export these to ensure thread text matches chart labels exactly
export interface ChartMetadata {
  flowLabel: 'Bullish positioning dominant' | 'Bearish OI elevated' | 'Mixed sentiment across strikes';
  modeledGammaLabel: 'long gamma - expect mean reversion' | 'short gamma - amplified moves likely';
  modeledGammaPosition: 'long' | 'short';
  skewLabel: string;
}

// Calculate OI label using same logic as chart-generator (uses OI not "flow" since this is structural data)
export function calculateOILabel(bullishCells: number, bearishCells: number): ChartMetadata['flowLabel'] {
  if (bullishCells > bearishCells * 1.5) return 'Bullish positioning dominant';
  if (bearishCells > bullishCells * 1.5) return 'Bearish OI elevated';
  return 'Mixed sentiment across strikes';
}

// Calculate modeled gamma label (15-min delayed structural data from Polygon)
export function calculateModeledGammaLabel(totalNetGamma: number): { label: ChartMetadata['modeledGammaLabel']; position: ChartMetadata['modeledGammaPosition'] } {
  if (totalNetGamma > 0) {
    return { label: 'long gamma - expect mean reversion', position: 'long' };
  }
  return { label: 'short gamma - amplified moves likely', position: 'short' };
}

// Legacy aliases for backward compatibility
export const calculateDealerGammaLabel = calculateModeledGammaLabel;
export const calculateFlowLabel = calculateOILabel;

// Calculate skew label using same logic as volatility smile chart (line 464)
export function calculateSkewLabel(putIV: number, callIV: number): string {
  const putSkew = putIV - callIV;
  if (putSkew > 5) return 'Put skew elevated - hedging demand';
  if (putSkew < -5) return 'Call skew - bullish positioning';
  return 'Balanced smile - neutral market';
}

// Time synchronization context for consistent timestamps across all charts
export interface SessionContext {
  asOfTime: Date;
  sessionStart: Date;
  sessionEnd: Date;
  timezone: string;
  marketStatus: 'pre' | 'open' | 'post' | 'closed';
}

export function createSessionContext(referenceTime?: Date): SessionContext {
  const now = referenceTime || new Date();
  const hour = now.getUTCHours() - 5; // Convert to ET
  
  // Determine market status
  let marketStatus: 'pre' | 'open' | 'post' | 'closed' = 'closed';
  const dayOfWeek = now.getUTCDay();
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    if (hour >= 4 && hour < 9.5) marketStatus = 'pre';
    else if (hour >= 9.5 && hour < 16) marketStatus = 'open';
    else if (hour >= 16 && hour < 20) marketStatus = 'post';
  }
  
  // Create session bounds for today
  const sessionStart = new Date(now);
  sessionStart.setUTCHours(14, 30, 0, 0); // 9:30 AM ET
  const sessionEnd = new Date(now);
  sessionEnd.setUTCHours(21, 0, 0, 0); // 4:00 PM ET
  
  return {
    asOfTime: now,
    sessionStart,
    sessionEnd,
    timezone: 'ET',
    marketStatus
  };
}

export function formatSessionTimestamp(date: Date, format: 'full' | 'short' | 'time' = 'full'): string {
  const options: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York' };
  
  if (format === 'time') {
    return date.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit' });
  } else if (format === 'short') {
    return date.toLocaleDateString('en-US', { ...options, month: 'short', day: 'numeric' }) + 
           ' ' + date.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit' });
  }
  
  return date.toLocaleDateString('en-US', { ...options, month: 'short', day: 'numeric', year: 'numeric' }) +
         ' ' + date.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit' }) + ' ET';
}

// Generate coherent candle timestamps based on session context
export function generateSessionCandles(basePrice: number, count: number, session: SessionContext, timeframe: '15m' | '1h' | '4h' | '1D' = '15m'): ChartData['candles'] {
  const intervals: Record<string, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000
  };
  
  const interval = intervals[timeframe];
  const endTime = session.asOfTime.getTime();
  const candles: ChartData['candles'] = [];
  
  let price = basePrice * (1 - 0.02 + Math.random() * 0.01);
  
  for (let i = count - 1; i >= 0; i--) {
    const time = endTime - (i * interval);
    const volatility = 0.003 + Math.random() * 0.005;
    const trend = (Math.random() - 0.48) * volatility;
    
    const open = price;
    const close = open * (1 + trend);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.floor(100000 + Math.random() * 500000);
    
    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  
  return candles;
}

interface ChartData {
  ticker: string;
  timeframe: '15m' | '1h' | '4h' | '1D';
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[];
  darkPoolPrint?: { time: number; price: number; size: number };
  session?: SessionContext;
  levels: {
    vwap?: number;
    ema20?: number;
    ema50?: number;
    ema200?: number;
    support?: number;
    resistance?: number;
    poc?: number;
  };
  annotations?: {
    title?: string;
    explanation?: string;
  };
}

interface FlowSummaryData {
  ticker: string;
  timestamp: string;
  eventType: 'dark_pool' | 'options_sweep';
  size: number;
  sizeUsd: number;
  price?: number;
  strike?: number;
  expiry?: string;
  optionType?: 'call' | 'put';
  premium?: number;
  delta?: number;
  gamma?: number;
  breakeven?: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  conviction: 'high' | 'medium' | 'low';
  venue?: string;
}

export function generateChartSvg(data: ChartData): string {
  const width = 800;
  const height = 450;
  const padding = { top: 40, right: 60, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (!data.candles || data.candles.length === 0) {
    return generatePlaceholderChart(data.ticker, width, height);
  }

  const prices = data.candles.flatMap(c => [c.high, c.low]);
  const minPrice = Math.min(...prices) * 0.998;
  const maxPrice = Math.max(...prices) * 1.002;
  const priceRange = maxPrice - minPrice;

  const minTime = Math.min(...data.candles.map(c => c.time));
  const maxTime = Math.max(...data.candles.map(c => c.time));
  const timeRange = maxTime - minTime || 1;

  const candleWidth = Math.max(4, (chartWidth / data.candles.length) * 0.7);

  const scaleX = (time: number) => padding.left + ((time - minTime) / timeRange) * chartWidth;
  const scaleY = (price: number) => padding.top + (1 - (price - minPrice) / priceRange) * chartHeight;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  svg += `<defs>
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#10B981;stop-opacity:0.8"/>
      <stop offset="100%" style="stop-color:#047857;stop-opacity:0.6"/>
    </linearGradient>
    <linearGradient id="redGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#EF4444;stop-opacity:0.8"/>
      <stop offset="100%" style="stop-color:#B91C1C;stop-opacity:0.6"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (i / gridLines) * chartHeight;
    const price = maxPrice - (i / gridLines) * priceRange;
    svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1a1a2e" stroke-width="1"/>`;
    svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="#6b7280" font-size="11" font-family="monospace">$${price.toFixed(2)}</text>`;
  }

  data.candles.forEach((candle, i) => {
    const x = scaleX(candle.time);
    const isGreen = candle.close >= candle.open;
    const color = isGreen ? 'url(#greenGrad)' : 'url(#redGrad)';
    const strokeColor = isGreen ? '#10B981' : '#EF4444';
    
    const top = scaleY(Math.max(candle.open, candle.close));
    const bottom = scaleY(Math.min(candle.open, candle.close));
    const bodyHeight = Math.max(1, bottom - top);
    
    svg += `<line x1="${x}" y1="${scaleY(candle.high)}" x2="${x}" y2="${scaleY(candle.low)}" stroke="${strokeColor}" stroke-width="1"/>`;
    svg += `<rect x="${x - candleWidth/2}" y="${top}" width="${candleWidth}" height="${bodyHeight}" fill="${color}" stroke="${strokeColor}" stroke-width="0.5" rx="1"/>`;
  });

  if (data.levels.ema20) {
    svg += generateEmaLine(data.candles, 20, '#3B82F6', scaleX, scaleY);
  }
  if (data.levels.ema50) {
    svg += generateEmaLine(data.candles, 50, '#F59E0B', scaleX, scaleY);
  }

  if (data.levels.vwap) {
    const y = scaleY(data.levels.vwap);
    svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#8B5CF6" stroke-width="1.5" stroke-dasharray="6,3"/>`;
    svg += `<text x="${width - padding.right + 5}" y="${y + 4}" fill="#8B5CF6" font-size="10" font-family="monospace">VWAP</text>`;
  }

  if (data.darkPoolPrint) {
    const x = scaleX(data.darkPoolPrint.time);
    const y = scaleY(data.darkPoolPrint.price);
    svg += `<circle cx="${x}" cy="${y}" r="8" fill="#3B82F6" filter="url(#glow)" opacity="0.9"/>`;
    svg += `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="#3B82F6" stroke-width="2" opacity="0.5"/>`;
    svg += `<text x="${x}" y="${y - 18}" text-anchor="middle" fill="#3B82F6" font-size="11" font-weight="bold" font-family="monospace">$${formatLargeNumber(data.darkPoolPrint.size)}</text>`;
  }

  // Header with ticker and timeframe
  svg += `<text x="${padding.left}" y="25" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker}</text>`;
  svg += `<text x="${padding.left + 80}" y="25" fill="#6b7280" font-size="12" font-family="monospace">${data.timeframe}</text>`;
  
  const lastCandle = data.candles[data.candles.length - 1];
  if (lastCandle) {
    const priceColor = lastCandle.close >= lastCandle.open ? '#10B981' : '#EF4444';
    svg += `<text x="${width - padding.right}" y="25" text-anchor="end" fill="${priceColor}" font-size="14" font-weight="bold" font-family="monospace">$${lastCandle.close.toFixed(2)}</text>`;
  }
  
  // Add "As of" timestamp
  const asOfTime = data.session ? formatSessionTimestamp(data.session.asOfTime, 'short') : new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  svg += `<text x="${width - padding.right}" y="${height - 30}" text-anchor="end" fill="#6b7280" font-size="10" font-family="monospace">As of: ${asOfTime} ET</text>`;
  
  // Add time axis labels
  if (data.candles.length >= 2) {
    const firstTime = new Date(data.candles[0].time);
    const lastTime = new Date(data.candles[data.candles.length - 1].time);
    const midIdx = Math.floor(data.candles.length / 2);
    const midTime = new Date(data.candles[midIdx].time);
    
    const formatAxisTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
    
    svg += `<text x="${padding.left}" y="${height - padding.bottom + 25}" text-anchor="start" fill="#6b7280" font-size="9" font-family="monospace">${formatAxisTime(firstTime)}</text>`;
    svg += `<text x="${width/2}" y="${height - padding.bottom + 25}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">${formatAxisTime(midTime)}</text>`;
    svg += `<text x="${width - padding.right}" y="${height - padding.bottom + 25}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">${formatAxisTime(lastTime)}</text>`;
  }
  
  // Dark pool print annotation callout
  if (data.darkPoolPrint && data.annotations?.explanation) {
    svg += `<rect x="${width - 260}" y="45" width="240" height="40" rx="6" fill="#1a1a2e" stroke="#3B82F6" stroke-width="1"/>`;
    svg += `<text x="${width - 250}" y="60" fill="#3B82F6" font-size="9" font-weight="bold" font-family="sans-serif">SIGNAL INTERPRETATION</text>`;
    svg += `<text x="${width - 250}" y="76" fill="#9ca3af" font-size="9" font-family="sans-serif">${data.annotations.explanation}</text>`;
  }

  svg += `<text x="${width/2}" y="${height - 10}" text-anchor="middle" fill="#374151" font-size="9" font-family="sans-serif">DARK POOL DATA | Source: Consolidated Dark Pool Feeds</text>`;

  svg += '</svg>';
  return svg;
}

function generateEmaLine(candles: ChartData['candles'], period: number, color: string, scaleX: (t: number) => number, scaleY: (p: number) => number): string {
  if (candles.length < period) return '';
  
  const emaValues: { time: number; value: number }[] = [];
  const multiplier = 2 / (period + 1);
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let ema = sum / period;
  emaValues.push({ time: candles[period - 1].time, value: ema });
  
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * multiplier + ema;
    emaValues.push({ time: candles[i].time, value: ema });
  }

  if (emaValues.length < 2) return '';

  let path = `M ${scaleX(emaValues[0].time)} ${scaleY(emaValues[0].value)}`;
  for (let i = 1; i < emaValues.length; i++) {
    path += ` L ${scaleX(emaValues[i].time)} ${scaleY(emaValues[i].value)}`;
  }

  return `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8"/>`;
}

function generatePlaceholderChart(ticker: string, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#0a0a0f"/>
    <text x="${width/2}" y="${height/2 - 20}" text-anchor="middle" fill="#3B82F6" font-size="24" font-weight="bold" font-family="sans-serif">${ticker}</text>
    <text x="${width/2}" y="${height/2 + 10}" text-anchor="middle" fill="#6b7280" font-size="14" font-family="sans-serif">Chart data loading...</text>
    <text x="${width/2}" y="${height - 20}" text-anchor="middle" fill="#374151" font-size="10" font-family="sans-serif">DARK POOL DATA</text>
  </svg>`;
}

export function generateFlowSummarySvg(data: FlowSummaryData): string {
  const width = 500;
  const height = 300;
  
  const isBullish = data.sentiment === 'bullish';
  const accentColor = isBullish ? '#10B981' : '#EF4444';
  const bgGradient = isBullish ? 
    'linear-gradient(135deg, #064e3b 0%, #0a0a0f 50%, #0a0a0f 100%)' :
    'linear-gradient(135deg, #7f1d1d 0%, #0a0a0f 50%, #0a0a0f 100%)';

  const convictionColors: Record<string, string> = {
    high: '#10B981',
    medium: '#F59E0B', 
    low: '#6B7280'
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${isBullish ? '#064e3b' : '#7f1d1d'};stop-opacity:0.3"/>
        <stop offset="50%" style="stop-color:#0a0a0f;stop-opacity:1"/>
        <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1"/>
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:${accentColor};stop-opacity:1"/>
        <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0.5"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" rx="12"/>
    <rect x="0" y="0" width="4" height="${height}" fill="url(#accentGrad)" rx="2"/>`;

  svg += `<text x="24" y="40" fill="#ffffff" font-size="28" font-weight="bold" font-family="monospace">${data.ticker}</text>`;
  
  const eventLabel = data.eventType === 'dark_pool' ? 'DARK POOL PRINT' : 'OPTIONS SWEEP';
  svg += `<text x="24" y="62" fill="#6b7280" font-size="11" font-family="sans-serif" letter-spacing="1">${eventLabel}</text>`;

  const timestamp = new Date(data.timestamp).toLocaleString('en-US', { 
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
  svg += `<text x="${width - 24}" y="40" text-anchor="end" fill="#6b7280" font-size="12" font-family="monospace">${timestamp}</text>`;

  svg += `<text x="24" y="100" fill="#9ca3af" font-size="11" font-family="sans-serif">SIZE</text>`;
  svg += `<text x="24" y="125" fill="#ffffff" font-size="22" font-weight="bold" font-family="monospace">${formatLargeNumber(data.sizeUsd)}</text>`;
  svg += `<text x="24" y="145" fill="#6b7280" font-size="12" font-family="monospace">${data.size.toLocaleString()} ${data.eventType === 'dark_pool' ? 'shares' : 'contracts'}</text>`;

  if (data.eventType === 'options_sweep' && data.strike && data.expiry) {
    svg += `<text x="200" y="100" fill="#9ca3af" font-size="11" font-family="sans-serif">STRIKE / EXPIRY</text>`;
    svg += `<text x="200" y="125" fill="#ffffff" font-size="18" font-weight="bold" font-family="monospace">$${data.strike} ${data.optionType?.toUpperCase()}</text>`;
    svg += `<text x="200" y="145" fill="#6b7280" font-size="12" font-family="monospace">${data.expiry}</text>`;
    
    if (data.delta) {
      svg += `<text x="380" y="100" fill="#9ca3af" font-size="11" font-family="sans-serif">DELTA</text>`;
      svg += `<text x="380" y="125" fill="${accentColor}" font-size="18" font-weight="bold" font-family="monospace">${(data.delta * 100).toFixed(0)}%</text>`;
    }
  } else if (data.price) {
    svg += `<text x="200" y="100" fill="#9ca3af" font-size="11" font-family="sans-serif">PRICE</text>`;
    svg += `<text x="200" y="125" fill="#ffffff" font-size="18" font-weight="bold" font-family="monospace">$${data.price.toFixed(2)}</text>`;
    if (data.venue) {
      svg += `<text x="200" y="145" fill="#6b7280" font-size="12" font-family="monospace">${data.venue}</text>`;
    }
  }

  if (data.breakeven) {
    svg += `<text x="24" y="180" fill="#9ca3af" font-size="11" font-family="sans-serif">BREAKEVEN</text>`;
    svg += `<text x="24" y="202" fill="#ffffff" font-size="16" font-family="monospace">$${data.breakeven.toFixed(2)}</text>`;
  }

  const arrowY = 240;
  if (isBullish) {
    svg += `<polygon points="24,${arrowY + 20} 44,${arrowY} 64,${arrowY + 20}" fill="${accentColor}"/>`;
  } else {
    svg += `<polygon points="24,${arrowY} 44,${arrowY + 20} 64,${arrowY}" fill="${accentColor}"/>`;
  }
  svg += `<text x="80" y="${arrowY + 15}" fill="${accentColor}" font-size="16" font-weight="bold" font-family="sans-serif">${data.sentiment.toUpperCase()}</text>`;

  const convColor = convictionColors[data.conviction] || convictionColors.low;
  svg += `<rect x="${width - 120}" y="${arrowY - 5}" width="96" height="28" rx="14" fill="${convColor}" fill-opacity="0.2" stroke="${convColor}" stroke-width="1"/>`;
  svg += `<text x="${width - 72}" y="${arrowY + 14}" text-anchor="middle" fill="${convColor}" font-size="12" font-weight="bold" font-family="sans-serif">${data.conviction.toUpperCase()}</text>`;

  svg += `<text x="${width/2}" y="${height - 12}" text-anchor="middle" fill="#374151" font-size="9" font-family="sans-serif">DARK POOL DATA</text>`;

  svg += '</svg>';
  return svg;
}

function formatLargeNumber(num: number): string {
  if (num >= 1000000000) return `$${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

interface VolatilitySmileData {
  ticker: string;
  expiry: string;
  strikes: number[];
  currentIV: number[];
  priorIV?: number[];
  spotPrice: number;
  anomalyStrikes?: number[];
  asOfTimestamp?: string;
}

export function generateVolatilitySmileSvg(data: VolatilitySmileData): string {
  const width = 800;
  const height = 400;
  const padding = { top: 50, right: 60, bottom: 60, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const minStrike = Math.min(...data.strikes);
  const maxStrike = Math.max(...data.strikes);
  const allIVs = [...data.currentIV, ...(data.priorIV || [])];
  const minIV = Math.max(0, Math.min(...allIVs) - 5);
  const maxIV = Math.max(...allIVs) + 10;

  const scaleX = (strike: number) => padding.left + ((strike - minStrike) / (maxStrike - minStrike)) * chartWidth;
  const scaleY = (iv: number) => padding.top + (1 - (iv - minIV) / (maxIV - minIV)) * chartHeight;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">
    <defs>
      <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#06b6d4;stop-opacity:0.8"/>
        <stop offset="100%" style="stop-color:#22d3ee;stop-opacity:0.8"/>
      </linearGradient>
      <filter id="glowCyan"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;

  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (i / 5) * chartHeight;
    const iv = maxIV - (i / 5) * (maxIV - minIV);
    svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1a1a2e" stroke-width="1"/>`;
    svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="#6b7280" font-size="10" font-family="monospace">${iv.toFixed(0)}%</text>`;
  }

  const spotX = scaleX(data.spotPrice);
  svg += `<line x1="${spotX}" y1="${padding.top}" x2="${spotX}" y2="${height - padding.bottom}" stroke="#F59E0B" stroke-width="2" stroke-dasharray="5,5"/>`;
  svg += `<text x="${spotX}" y="${height - padding.bottom + 25}" text-anchor="middle" fill="#F59E0B" font-size="10" font-family="monospace">SPOT $${data.spotPrice.toFixed(0)}</text>`;

  if (data.priorIV && data.priorIV.length > 0) {
    let priorPath = `M ${scaleX(data.strikes[0])} ${scaleY(data.priorIV[0])}`;
    for (let i = 1; i < data.strikes.length; i++) {
      priorPath += ` L ${scaleX(data.strikes[i])} ${scaleY(data.priorIV[i])}`;
    }
    svg += `<path d="${priorPath}" fill="none" stroke="#4b5563" stroke-width="2" stroke-dasharray="4,4" opacity="0.5"/>`;
  }

  let currentPath = `M ${scaleX(data.strikes[0])} ${scaleY(data.currentIV[0])}`;
  for (let i = 1; i < data.strikes.length; i++) {
    currentPath += ` L ${scaleX(data.strikes[i])} ${scaleY(data.currentIV[i])}`;
  }
  svg += `<path d="${currentPath}" fill="none" stroke="#06b6d4" stroke-width="3" filter="url(#glowCyan)"/>`;

  data.strikes.forEach((strike, i) => {
    const isAnomaly = data.anomalyStrikes?.includes(strike);
    if (isAnomaly) {
      const x = scaleX(strike);
      const y = scaleY(data.currentIV[i]);
      svg += `<circle cx="${x}" cy="${y}" r="8" fill="#EF4444" filter="url(#glowCyan)"/>`;
      svg += `<text x="${x}" y="${y - 15}" text-anchor="middle" fill="#EF4444" font-size="9" font-weight="bold" font-family="sans-serif">95th %ile</text>`;
    }
  });

  svg += `<text x="${padding.left}" y="30" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Volatility Smile</text>`;
  svg += `<text x="${padding.left + 200}" y="30" fill="#6b7280" font-size="12" font-family="monospace">${data.expiry}</text>`;
  
  // Legend box
  svg += `<rect x="${width - 200}" y="10" width="185" height="30" fill="#0d0d12" rx="4" stroke="#1a1a2e" stroke-width="1"/>`;
  svg += `<rect x="${width - 190}" y="20" width="12" height="3" fill="#06b6d4"/>`;
  svg += `<text x="${width - 175}" y="24" fill="#06b6d4" font-size="9" font-family="sans-serif">Current IV</text>`;
  svg += `<rect x="${width - 120}" y="20" width="12" height="3" fill="#4b5563"/>`;
  svg += `<text x="${width - 105}" y="24" fill="#6b7280" font-size="9" font-family="sans-serif">Prior Session</text>`;
  
  // Interpretation annotation
  const putSkew = data.currentIV[0] - data.currentIV[data.currentIV.length - 1];
  const skewInterpretation = putSkew > 5 ? 'Put skew elevated - hedging demand' : putSkew < -5 ? 'Call skew - bullish positioning' : 'Balanced smile - neutral market';
  svg += `<rect x="${padding.left}" y="${height - 55}" width="300" height="22" fill="#1a1a2e" rx="4" stroke="#374151" stroke-width="1"/>`;
  svg += `<text x="${padding.left + 10}" y="${height - 40}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${skewInterpretation}</text>`;
  
  // As of timestamp
  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 40}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;

  svg += `<text x="${width/2}" y="${height - 20}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">Strike Price ($)</text>`;
  svg += `<text x="15" y="${height/2}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace" transform="rotate(-90, 15, ${height/2})">Implied Volatility (%)</text>`;
  svg += `<text x="${width/2}" y="${height - 5}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: Options Analytics</text>`;

  svg += '</svg>';
  return svg;
}

interface IVSurfaceMapData {
  ticker: string;
  strikes: number[];
  expiries: string[];
  cells: { strike: number; expiry: string; premium: number; sentiment: 'bullish' | 'bearish' | 'neutral'; contracts: number; tags?: string[] }[];
  spotPrice: number;
  asOfTimestamp?: string;
}

// Legacy type alias for backward compatibility
type OptionsFlowHeatmapData = IVSurfaceMapData;

export function generateIVSurfaceMapSvg(data: IVSurfaceMapData): string {
  const width = 800;
  const height = 500;
  const padding = { top: 60, right: 30, bottom: 80, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const cellWidth = chartWidth / data.expiries.length;
  const cellHeight = chartHeight / data.strikes.length;
  const maxPremium = Math.max(...data.cells.map(c => c.premium));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;

  svg += `<text x="${padding.left}" y="30" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} IV Surface Map</text>`;
  svg += `<text x="${padding.left}" y="48" fill="#6b7280" font-size="11" font-family="sans-serif">Positioning by Strike/Expiry (15-min delayed) | Spot: $${data.spotPrice.toFixed(2)}</text>`;

  data.expiries.forEach((expiry, i) => {
    const x = padding.left + i * cellWidth + cellWidth / 2;
    svg += `<text x="${x}" y="${height - padding.bottom + 20}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace" transform="rotate(-45, ${x}, ${height - padding.bottom + 20})">${expiry}</text>`;
  });

  data.strikes.forEach((strike, i) => {
    const y = padding.top + i * cellHeight + cellHeight / 2;
    const isNearSpot = Math.abs(strike - data.spotPrice) < data.spotPrice * 0.02;
    svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="${isNearSpot ? '#F59E0B' : '#6b7280'}" font-size="10" font-family="monospace" font-weight="${isNearSpot ? 'bold' : 'normal'}">$${strike}</text>`;
  });

  data.cells.forEach(cell => {
    const strikeIdx = data.strikes.indexOf(cell.strike);
    const expiryIdx = data.expiries.indexOf(cell.expiry);
    if (strikeIdx === -1 || expiryIdx === -1) return;

    const x = padding.left + expiryIdx * cellWidth;
    const y = padding.top + strikeIdx * cellHeight;
    const size = Math.max(8, (cell.premium / maxPremium) * Math.min(cellWidth, cellHeight) * 0.8);
    const centerX = x + cellWidth / 2;
    const centerY = y + cellHeight / 2;

    const colors = {
      bullish: '#10B981',
      bearish: '#EF4444',
      neutral: '#8B5CF6'
    };
    const color = colors[cell.sentiment];
    const opacity = 0.3 + (cell.premium / maxPremium) * 0.7;

    svg += `<rect x="${x + 2}" y="${y + 2}" width="${cellWidth - 4}" height="${cellHeight - 4}" fill="${color}" fill-opacity="${opacity * 0.3}" rx="4"/>`;
    svg += `<circle cx="${centerX}" cy="${centerY}" r="${size / 2}" fill="${color}" fill-opacity="${opacity}"/>`;

    const isOutlier = cell.premium > maxPremium * 0.7;
    if (isOutlier) {
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${size / 2 + 4}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="3,2"/>`;
      svg += `<text x="${centerX}" y="${centerY - size/2 - 8}" text-anchor="middle" fill="${color}" font-size="8" font-weight="bold" font-family="monospace">${formatLargeNumber(cell.premium)}</text>`;
    }
  });

  // Legend box
  svg += `<rect x="${width - 175}" y="12" width="165" height="38" fill="#0d0d12" rx="4" stroke="#1a1a2e" stroke-width="1"/>`;
  svg += `<rect x="${width - 165}" y="22" width="10" height="10" fill="#10B981" rx="2"/>`;
  svg += `<text x="${width - 152}" y="30" fill="#10B981" font-size="8" font-family="sans-serif">Bullish</text>`;
  svg += `<rect x="${width - 110}" y="22" width="10" height="10" fill="#EF4444" rx="2"/>`;
  svg += `<text x="${width - 97}" y="30" fill="#EF4444" font-size="8" font-family="sans-serif">Bearish</text>`;
  svg += `<rect x="${width - 55}" y="22" width="10" height="10" fill="#8B5CF6" rx="2"/>`;
  svg += `<text x="${width - 42}" y="30" fill="#8B5CF6" font-size="8" font-family="sans-serif">Mixed</text>`;
  svg += `<text x="${width - 165}" y="42" fill="#6b7280" font-size="7" font-family="sans-serif">Circle size = premium volume</text>`;
  
  // Calculate dominant flow for interpretation
  const bullishCount = data.cells.filter(c => c.sentiment === 'bullish').length;
  const bearishCount = data.cells.filter(c => c.sentiment === 'bearish').length;
  const dominantFlow = bullishCount > bearishCount * 1.5 ? 'Bullish positioning dominant' : bearishCount > bullishCount * 1.5 ? 'Bearish flow elevated' : 'Mixed sentiment across strikes';
  
  // Interpretation annotation
  svg += `<rect x="${padding.left}" y="${height - 45}" width="280" height="20" fill="#1a1a2e" rx="4" stroke="#374151" stroke-width="1"/>`;
  svg += `<text x="${padding.left + 10}" y="${height - 31}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${dominantFlow}</text>`;
  
  // As of timestamp
  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 31}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;

  svg += `<text x="${width/2}" y="${height - 8}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: Options Flow Analytics</text>`;
  svg += '</svg>';
  return svg;
}

interface PutCallOIData {
  ticker: string;
  strikes: number[];
  callOI: number[];
  putOI: number[];
  callOIChange: number[];
  putOIChange: number[];
  spotPrice: number;
  putCallRatio: number | null;  // null when insufficient data
  asOfTimestamp?: string;
}

export function generatePutCallOILadderSvg(data: PutCallOIData): string {
  const width = 800;
  const height = 450;
  const padding = { top: 60, right: 100, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxChange = Math.max(...data.callOIChange.map(Math.abs), ...data.putOIChange.map(Math.abs));
  const barHeight = (chartHeight / data.strikes.length) * 0.8;

  const scaleX = (val: number) => (val / maxChange) * (chartWidth / 2);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;

  svg += `<text x="${padding.left}" y="30" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Put/Call OI Delta</text>`;
  svg += `<text x="${padding.left}" y="48" fill="#6b7280" font-size="11" font-family="sans-serif">Open Interest Changes by Strike</text>`;

  const centerX = padding.left + chartWidth / 2;
  svg += `<line x1="${centerX}" y1="${padding.top}" x2="${centerX}" y2="${height - padding.bottom}" stroke="#374151" stroke-width="2"/>`;

  svg += `<text x="${padding.left + chartWidth/4}" y="${padding.top - 10}" text-anchor="middle" fill="#EF4444" font-size="11" font-weight="bold" font-family="sans-serif">PUTS</text>`;
  svg += `<text x="${centerX + chartWidth/4}" y="${padding.top - 10}" text-anchor="middle" fill="#10B981" font-size="11" font-weight="bold" font-family="sans-serif">CALLS</text>`;

  data.strikes.forEach((strike, i) => {
    const y = padding.top + (i / data.strikes.length) * chartHeight + barHeight / 2;
    const isNearSpot = Math.abs(strike - data.spotPrice) < data.spotPrice * 0.02;

    svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="${isNearSpot ? '#F59E0B' : '#6b7280'}" font-size="10" font-family="monospace" font-weight="${isNearSpot ? 'bold' : 'normal'}">$${strike}</text>`;

    const putWidth = scaleX(Math.abs(data.putOIChange[i]));
    const callWidth = scaleX(Math.abs(data.callOIChange[i]));
    const putColor = data.putOIChange[i] > 0 ? '#EF4444' : '#7f1d1d';
    const callColor = data.callOIChange[i] > 0 ? '#10B981' : '#064e3b';

    svg += `<rect x="${centerX - putWidth}" y="${y - barHeight/2}" width="${putWidth}" height="${barHeight}" fill="${putColor}" rx="2"/>`;
    svg += `<rect x="${centerX}" y="${y - barHeight/2}" width="${callWidth}" height="${barHeight}" fill="${callColor}" rx="2"/>`;

    const isSpike = Math.abs(data.putOIChange[i]) > maxChange * 0.7 || Math.abs(data.callOIChange[i]) > maxChange * 0.7;
    if (isSpike) {
      svg += `<circle cx="${centerX}" cy="${y}" r="6" fill="#F59E0B"/>`;
    }
  });

  const gaugeX = width - 80;
  const gaugeY = padding.top + 40;
  
  // Handle null P/C ratio (insufficient data)
  const hasValidRatio = data.putCallRatio !== null && !isNaN(data.putCallRatio);
  const ratioValue = hasValidRatio ? data.putCallRatio! : 0;
  const isExtreme = hasValidRatio && (ratioValue > 3 || ratioValue < 0.33);
  const gaugeColor = !hasValidRatio ? '#6b7280' : isExtreme ? '#EF4444' : '#6b7280';
  
  // P/C Ratio gauge with interpretation
  svg += `<rect x="${gaugeX - 35}" y="${gaugeY - 25}" width="70" height="95" fill="#1a1a2e" rx="8" stroke="${gaugeColor}" stroke-width="${isExtreme ? 2 : 1}"/>`;
  svg += `<text x="${gaugeX}" y="${gaugeY}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="sans-serif">P/C RATIO</text>`;
  svg += `<text x="${gaugeX}" y="${gaugeY + 25}" text-anchor="middle" fill="#ffffff" font-size="18" font-weight="bold" font-family="monospace">${hasValidRatio ? ratioValue.toFixed(2) : 'N/A'}</text>`;
  
  const ratioInterpretation = !hasValidRatio ? 'INSUFFICIENT DATA' : ratioValue > 1.5 ? 'BEARISH' : ratioValue < 0.7 ? 'BULLISH' : 'NEUTRAL';
  const ratioColor = !hasValidRatio ? '#6b7280' : ratioValue > 1.5 ? '#EF4444' : ratioValue < 0.7 ? '#10B981' : '#6b7280';
  svg += `<text x="${gaugeX}" y="${gaugeY + 45}" text-anchor="middle" fill="${ratioColor}" font-size="8" font-weight="bold" font-family="sans-serif">${ratioInterpretation}</text>`;
  
  if (isExtreme) {
    svg += `<text x="${gaugeX}" y="${gaugeY + 58}" text-anchor="middle" fill="#F59E0B" font-size="7" font-weight="bold" font-family="sans-serif">EXTREME</text>`;
  }
  
  // Interpretation annotation (use "OI" not "flow" - this is open interest, not trade flow)
  const oiInterpretation = !hasValidRatio ? 'Insufficient put/call OI data' : ratioValue > 1.5 ? 'Elevated put OI - hedging or bearish positioning' : ratioValue < 0.7 ? 'Call-heavy OI - bullish sentiment' : 'Balanced OI distribution';
  svg += `<rect x="${padding.left}" y="${height - 50}" width="320" height="20" fill="#1a1a2e" rx="4" stroke="#374151" stroke-width="1"/>`;
  svg += `<text x="${padding.left + 10}" y="${height - 36}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${oiInterpretation}</text>`;
  
  // As of timestamp
  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right - 20}" y="${height - 36}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;

  svg += `<text x="${width/2}" y="${height - 10}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: Options OI Analytics</text>`;
  svg += '</svg>';
  return svg;
}

interface IVTermStructureData {
  ticker: string;
  expiries: string[];
  ivValues: number[];
  ivChanges24h: number[];
  ivPercentiles: number[];
  asOfTimestamp?: string;
}

export function generateIVTermStructureSvg(data: IVTermStructureData): string {
  const width = 800;
  const height = 400;
  const padding = { top: 50, right: 60, bottom: 80, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = (height - padding.top - padding.bottom) / 2;

  const barWidth = (chartWidth / data.expiries.length) * 0.7;
  const maxIV = Math.max(...data.ivValues);
  const maxChange = Math.max(...data.ivChanges24h.map(Math.abs));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;

  svg += `<text x="${padding.left}" y="30" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} IV Term Structure</text>`;

  data.expiries.forEach((expiry, i) => {
    const x = padding.left + (i / data.expiries.length) * chartWidth + barWidth / 2;
    const barHeight = (data.ivValues[i] / maxIV) * chartHeight * 0.9;
    const y = padding.top + chartHeight - barHeight;

    const isUnusual = data.ivPercentiles[i] >= 90;
    const color = isUnusual ? '#EF4444' : '#3B82F6';

    svg += `<rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" fill-opacity="0.7" rx="4"/>`;
    svg += `<text x="${x}" y="${y - 5}" text-anchor="middle" fill="#ffffff" font-size="9" font-family="monospace">${data.ivValues[i].toFixed(0)}%</text>`;

    if (isUnusual) {
      svg += `<text x="${x}" y="${y - 18}" text-anchor="middle" fill="#EF4444" font-size="8" font-weight="bold" font-family="sans-serif">${data.ivPercentiles[i]}th</text>`;
    }
  });

  // 24-Hour Change Panel Header
  const changeY = padding.top + chartHeight + 20;
  svg += `<rect x="${padding.left}" y="${changeY - 5}" width="${chartWidth}" height="${chartHeight + 15}" fill="#0d0d12" rx="4" stroke="#1a1a2e" stroke-width="1"/>`;
  svg += `<text x="${padding.left + 10}" y="${changeY + 12}" fill="#F59E0B" font-size="11" font-weight="bold" font-family="sans-serif">24-HOUR IV CHANGES</text>`;
  
  svg += `<line x1="${padding.left + 10}" y1="${changeY + chartHeight/2 + 10}" x2="${width - padding.right - 10}" y2="${changeY + chartHeight/2 + 10}" stroke="#374151" stroke-width="1" stroke-dasharray="4,2"/>`;
  svg += `<text x="${padding.left}" y="${changeY + chartHeight/2 + 14}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">0%</text>`;

  data.expiries.forEach((expiry, i) => {
    const x = padding.left + (i / data.expiries.length) * chartWidth + barWidth / 2;
    const changeBarHeight = (Math.abs(data.ivChanges24h[i]) / maxChange) * (chartHeight / 2 - 15);
    const isPositive = data.ivChanges24h[i] > 0;
    const changeColor = isPositive ? '#EF4444' : '#10B981';
    const barY = isPositive ? changeY + chartHeight/2 + 10 - changeBarHeight : changeY + chartHeight/2 + 10;

    svg += `<rect x="${x - barWidth/2}" y="${barY}" width="${barWidth}" height="${changeBarHeight}" fill="${changeColor}" fill-opacity="0.9" rx="2"/>`;
    
    // Show change value on bars
    const changeVal = data.ivChanges24h[i];
    if (Math.abs(changeVal) > 1) {
      svg += `<text x="${x}" y="${isPositive ? barY - 3 : barY + changeBarHeight + 10}" text-anchor="middle" fill="${changeColor}" font-size="8" font-weight="bold" font-family="monospace">${changeVal > 0 ? '+' : ''}${changeVal.toFixed(1)}%</text>`;
    }
    
    svg += `<text x="${x}" y="${height - padding.bottom + 15}" text-anchor="middle" fill="#6b7280" font-size="8" font-family="monospace" transform="rotate(-45, ${x}, ${height - padding.bottom + 15})">${expiry}</text>`;
  });

  // Legend for 24h changes and IV bars
  svg += `<rect x="${width - 170}" y="${padding.top - 5}" width="160" height="38" fill="#0d0d12" rx="4" stroke="#1a1a2e" stroke-width="1"/>`;
  svg += `<rect x="${width - 160}" y="${padding.top + 5}" width="10" height="10" fill="#3B82F6" rx="2"/>`;
  svg += `<text x="${width - 145}" y="${padding.top + 14}" fill="#6b7280" font-size="8" font-family="sans-serif">Normal IV</text>`;
  svg += `<rect x="${width - 90}" y="${padding.top + 5}" width="10" height="10" fill="#EF4444" rx="2"/>`;
  svg += `<text x="${width - 75}" y="${padding.top + 14}" fill="#6b7280" font-size="8" font-family="sans-serif">Elevated (90th+)</text>`;
  svg += `<text x="${width - 160}" y="${padding.top + 27}" fill="#6b7280" font-size="7" font-family="sans-serif">24h: Red=up, Green=down</text>`;
  
  // Interpretation
  const avgChange = data.ivChanges24h.reduce((a, b) => a + b, 0) / data.ivChanges24h.length;
  const ivTrend = avgChange > 2 ? 'IV expanding - volatility demand rising' : avgChange < -2 ? 'IV contracting - vol sellers active' : 'IV stable across term structure';
  svg += `<text x="${padding.left + 10}" y="${height - 15}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${ivTrend}</text>`;
  
  // As of timestamp
  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 15}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;

  svg += `<text x="${padding.left - 5}" y="${padding.top + chartHeight/2}" text-anchor="end" fill="#6b7280" font-size="9" font-family="sans-serif">IV %</text>`;
  svg += `<text x="${width/2}" y="${height - 2}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: IV Analytics</text>`;

  svg += '</svg>';
  return svg;
}

export function generateMockVolatilitySmileData(ticker: string, spotPrice: number): VolatilitySmileData {
  const strikes: number[] = [];
  const baseStrike = Math.round(spotPrice / 5) * 5;
  for (let i = -10; i <= 10; i++) {
    strikes.push(baseStrike + i * 5);
  }
  
  const currentIV: number[] = [];
  const priorIV: number[] = [];
  const anomalyStrikes: number[] = [];
  
  strikes.forEach((strike, i) => {
    const moneyness = (strike - spotPrice) / spotPrice;
    const baseIV = 25 + Math.abs(moneyness) * 100 + (moneyness < 0 ? 5 : 0);
    const noise = (Math.random() - 0.5) * 5;
    currentIV.push(baseIV + noise);
    priorIV.push(baseIV - 3 + (Math.random() - 0.5) * 3);
    
    if (Math.random() > 0.85) {
      anomalyStrikes.push(strike);
      currentIV[i] += 15;
    }
  });

  return {
    ticker,
    expiry: '2025-01-17',
    strikes,
    currentIV,
    priorIV,
    spotPrice,
    anomalyStrikes
  };
}

export function generateMockIVSurfaceData(ticker: string, spotPrice: number, sentimentBias?: 'bullish' | 'bearish' | 'neutral'): IVSurfaceMapData {
  const baseStrike = Math.round(spotPrice / 5) * 5;
  const strikes = Array.from({ length: 10 }, (_, i) => baseStrike - 25 + i * 5);
  const expiries = ['Jan 10', 'Jan 17', 'Jan 24', 'Feb 21', 'Mar 21'];
  
  const cells: IVSurfaceMapData['cells'] = [];
  strikes.forEach(strike => {
    expiries.forEach(expiry => {
      if (Math.random() > 0.3) {
        // Bias cell sentiment toward API-provided sentiment for truth gate consistency
        let sentiment: 'bullish' | 'bearish' | 'neutral';
        if (sentimentBias === 'bullish') {
          // 60% bullish, 25% neutral, 15% bearish
          const r = Math.random();
          sentiment = r < 0.60 ? 'bullish' : r < 0.85 ? 'neutral' : 'bearish';
        } else if (sentimentBias === 'bearish') {
          // 60% bearish, 25% neutral, 15% bullish  
          const r = Math.random();
          sentiment = r < 0.60 ? 'bearish' : r < 0.85 ? 'neutral' : 'bullish';
        } else {
          // Neutral: balanced distribution (33% each)
          const sentiments: ('bullish' | 'bearish' | 'neutral')[] = ['bullish', 'bearish', 'neutral'];
          sentiment = sentiments[Math.floor(Math.random() * 3)];
        }
        cells.push({
          strike,
          expiry,
          premium: Math.floor(Math.random() * 5000000) + 100000,
          sentiment,
          contracts: Math.floor(Math.random() * 5000) + 100,
          tags: Math.random() > 0.7 ? ['SWEEP', 'UNUSUAL'] : undefined
        });
      }
    });
  });

  return { ticker, strikes, expiries, cells, spotPrice };
}

// Legacy alias for backward compatibility
export const generateMockOptionsFlowData = generateMockIVSurfaceData;

// Legacy alias for backward compatibility
export const generateOptionsFlowHeatmapSvg = generateIVSurfaceMapSvg;

export function generateMockPutCallOIData(ticker: string, spotPrice: number): PutCallOIData {
  const baseStrike = Math.round(spotPrice / 5) * 5;
  const strikes = Array.from({ length: 15 }, (_, i) => baseStrike - 35 + i * 5);
  
  const callOI: number[] = [];
  const putOI: number[] = [];
  const callOIChange: number[] = [];
  const putOIChange: number[] = [];

  strikes.forEach(strike => {
    callOI.push(Math.floor(Math.random() * 50000) + 5000);
    putOI.push(Math.floor(Math.random() * 50000) + 5000);
    callOIChange.push((Math.random() - 0.4) * 20000);
    putOIChange.push((Math.random() - 0.6) * 20000);
  });

  const totalPutOI = putOI.reduce((a, b) => a + b, 0);
  const totalCallOI = callOI.reduce((a, b) => a + b, 0);

  return {
    ticker,
    strikes,
    callOI,
    putOI,
    callOIChange,
    putOIChange,
    spotPrice,
    putCallRatio: totalPutOI / totalCallOI
  };
}

export function generateMockIVTermStructureData(ticker: string): IVTermStructureData {
  const expiries = ['Jan 3', 'Jan 10', 'Jan 17', 'Jan 24', 'Feb 21', 'Mar 21', 'Jun 20', 'Dec 19'];
  const ivValues = expiries.map((_, i) => 20 + i * 2 + (Math.random() - 0.5) * 10);
  const ivChanges24h = expiries.map(() => (Math.random() - 0.5) * 8);
  const ivPercentiles = expiries.map(() => Math.floor(Math.random() * 100));

  return { ticker, expiries, ivValues, ivChanges24h, ivPercentiles };
}

export function generateMockCandles(basePrice: number, count: number = 50): ChartData['candles'] {
  const candles: ChartData['candles'] = [];
  let price = basePrice;
  const now = Date.now();
  const interval = 15 * 60 * 1000;

  for (let i = count; i > 0; i--) {
    const volatility = price * 0.015;
    const change = (Math.random() - 0.5) * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(100000 + Math.random() * 900000);

    candles.push({
      time: now - i * interval,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume
    });

    price = close;
  }

  return candles;
}

// ============================================================================
// NEW INSTITUTIONAL CHART TYPES
// ============================================================================

// 1. GAMMA EXPOSURE CHART
interface GammaExposureData {
  ticker: string;
  strikes: number[];
  netGamma: number[];
  spotPrice: number;
  totalGammaExposure: number;  // Modeled net gamma, not dealer-specific claim
  gammaFlips: { strike: number; percentile: number }[];
  asOfTimestamp?: string;
}

export function generateGammaExposureSvg(data: GammaExposureData): string {
  const width = 800;
  const height = 450;
  const padding = { top: 60, right: 120, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxGamma = Math.max(...data.netGamma.map(Math.abs)) * 1.1;
  const barWidth = chartWidth / data.strikes.length * 0.7;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  svg += `<text x="${padding.left}" y="30" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Modeled Gamma Exposure</text>`;
  svg += `<text x="${padding.left}" y="48" fill="#6b7280" font-size="11" font-family="sans-serif">Net Gamma by Strike (modeled, 15-min delayed)</text>`;

  // Zero line
  const zeroY = padding.top + chartHeight / 2;
  svg += `<line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="#374151" stroke-width="1"/>`;
  svg += `<text x="${padding.left - 8}" y="${zeroY + 4}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">0</text>`;

  // Gamma bars
  data.strikes.forEach((strike, i) => {
    const gamma = data.netGamma[i];
    const x = padding.left + (i / data.strikes.length) * chartWidth + barWidth / 4;
    const barHeight = Math.abs(gamma) / maxGamma * (chartHeight / 2);
    const isPositive = gamma >= 0;
    const color = isPositive ? '#10B981' : '#EF4444';
    const y = isPositive ? zeroY - barHeight : zeroY;
    
    // Check if this is a NaN - render as hatched
    if (isNaN(gamma)) {
      svg += `<rect x="${x}" y="${zeroY - 20}" width="${barWidth}" height="40" fill="url(#hatch)" stroke="#6b7280" stroke-width="1"/>`;
    } else {
      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" fill-opacity="0.8" rx="2"/>`;
    }
    
    // Strike labels
    if (i % 2 === 0) {
      svg += `<text x="${x + barWidth/2}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">$${strike}</text>`;
    }
    
    // Spot price marker
    if (Math.abs(strike - data.spotPrice) < 3) {
      svg += `<line x1="${x + barWidth/2}" y1="${padding.top}" x2="${x + barWidth/2}" y2="${height - padding.bottom}" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4,2"/>`;
      svg += `<text x="${x + barWidth/2 + 5}" y="${padding.top + 15}" fill="#F59E0B" font-size="9" font-family="sans-serif">SPOT</text>`;
    }
  });

  // Gamma flip arrows
  data.gammaFlips.forEach(flip => {
    const idx = data.strikes.indexOf(flip.strike);
    if (idx >= 0) {
      const x = padding.left + (idx / data.strikes.length) * chartWidth + barWidth / 2;
      svg += `<polygon points="${x},${padding.top + 25} ${x-6},${padding.top + 35} ${x+6},${padding.top + 35}" fill="#8B5CF6"/>`;
      svg += `<text x="${x}" y="${padding.top + 50}" text-anchor="middle" fill="#8B5CF6" font-size="8" font-weight="bold" font-family="sans-serif">PIN ${flip.percentile}th</text>`;
    }
  });

  // Modeled Exposure Gauge
  const gaugeX = width - padding.right + 20;
  const gaugeY = padding.top + 40;
  const exposureColor = data.totalGammaExposure > 0 ? '#10B981' : '#EF4444';
  svg += `<rect x="${gaugeX}" y="${gaugeY}" width="80" height="70" fill="#1a1a2e" rx="8" stroke="${exposureColor}" stroke-width="2"/>`;
  svg += `<text x="${gaugeX + 40}" y="${gaugeY + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="sans-serif">NET GAMMA</text>`;
  svg += `<text x="${gaugeX + 40}" y="${gaugeY + 42}" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold" font-family="monospace">${data.totalGammaExposure > 0 ? '+' : ''}${formatLargeNumber(data.totalGammaExposure)}</text>`;
  svg += `<text x="${gaugeX + 40}" y="${gaugeY + 58}" text-anchor="middle" fill="${exposureColor}" font-size="10" font-weight="bold" font-family="sans-serif">${data.totalGammaExposure > 0 ? 'LONG' : 'SHORT'}</text>`;

  // Legend
  svg += `<rect x="${padding.left}" y="${height - 50}" width="200" height="22" fill="#1a1a2e" rx="4" stroke="#374151" stroke-width="1"/>`;
  svg += `<rect x="${padding.left + 10}" y="${height - 43}" width="12" height="10" fill="#10B981" rx="2"/>`;
  svg += `<text x="${padding.left + 28}" y="${height - 35}" fill="#6b7280" font-size="9" font-family="sans-serif">Long Gamma</text>`;
  svg += `<rect x="${padding.left + 100}" y="${height - 43}" width="12" height="10" fill="#EF4444" rx="2"/>`;
  svg += `<text x="${padding.left + 118}" y="${height - 35}" fill="#6b7280" font-size="9" font-family="sans-serif">Short Gamma</text>`;

  // Interpretation
  const maxGammaStrike = data.strikes[data.netGamma.indexOf(Math.max(...data.netGamma))];
  const interpretation = data.totalGammaExposure > 0 
    ? `Long gamma near $${maxGammaStrike} - expect mean reversion` 
    : 'Short gamma environment - amplified moves likely';
  svg += `<text x="${padding.left + 220}" y="${height - 35}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${interpretation}</text>`;

  // Timestamp
  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 10}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;
  svg += `<text x="${width/2}" y="${height - 10}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: Gamma Analytics</text>`;

  // Hatch pattern for NaN
  svg += `<defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="4" height="4"><path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="#6b7280" stroke-width="0.5"/></pattern></defs>`;

  svg += '</svg>';
  return svg;
}

export function generateMockGammaExposureData(ticker: string, spotPrice: number, gammaBias?: 'long' | 'short'): GammaExposureData {
  const baseStrike = Math.round(spotPrice / 5) * 5;
  const strikes = Array.from({ length: 20 }, (_, i) => baseStrike - 45 + i * 5);
  
  // Bias gamma based on modeled position (for truth gate consistency)
  // Short gamma = negative total exposure, Long gamma = positive total exposure
  const biasFactor = gammaBias === 'long' ? 0.3 : gammaBias === 'short' ? -0.3 : 0;
  
  const netGamma = strikes.map(strike => {
    const distFromSpot = (strike - spotPrice) / spotPrice;
    // Apply bias: shift the random range toward positive (long) or negative (short)
    const baseGamma = (Math.random() - 0.5 + biasFactor) * 500000000;
    return baseGamma * Math.exp(-Math.abs(distFromSpot) * 3);
  });

  const gammaFlips: { strike: number; percentile: number }[] = [];
  for (let i = 1; i < netGamma.length - 1; i++) {
    if ((netGamma[i-1] < 0 && netGamma[i] > 0) || (netGamma[i-1] > 0 && netGamma[i] < 0)) {
      if (Math.random() > 0.5) {
        gammaFlips.push({ strike: strikes[i], percentile: 80 + Math.floor(Math.random() * 15) });
      }
    }
  }

  return {
    ticker,
    strikes,
    netGamma,
    spotPrice,
    totalGammaExposure: netGamma.reduce((a, b) => a + b, 0),
    gammaFlips
  };
}

// 2. HISTORICAL VS IMPLIED VOLATILITY CHART
interface HistoricalVsImpliedVolData {
  ticker: string;
  dates: string[];
  historicalVol: number[];
  impliedVol: number[];
  volPremiumAnomalies: { startIdx: number; endIdx: number }[];
  currentPercentile: number;
  asOfTimestamp?: string;
}

export function generateHistoricalVsImpliedVolSvg(data: HistoricalVsImpliedVolData): string {
  const width = 800;
  const height = 400;
  const padding = { top: 60, right: 100, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allVols = [...data.historicalVol, ...data.impliedVol].filter(v => !isNaN(v));
  const maxVol = Math.max(...allVols) * 1.1;
  const minVol = Math.min(...allVols) * 0.9;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  svg += `<text x="${padding.left}" y="28" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Historical vs Implied Volatility</text>`;
  svg += `<text x="${padding.left}" y="46" fill="#6b7280" font-size="11" font-family="sans-serif">90-Day Comparison: 30-Day HV (Blue) vs ATM IV (Cyan)</text>`;

  // Anomaly shading
  data.volPremiumAnomalies.forEach(anomaly => {
    const x1 = padding.left + (anomaly.startIdx / data.dates.length) * chartWidth;
    const x2 = padding.left + (anomaly.endIdx / data.dates.length) * chartWidth;
    svg += `<rect x="${x1}" y="${padding.top}" width="${x2 - x1}" height="${chartHeight}" fill="#EF4444" fill-opacity="0.15"/>`;
    svg += `<text x="${(x1 + x2) / 2}" y="${padding.top + 15}" text-anchor="middle" fill="#EF4444" font-size="8" font-weight="bold" font-family="sans-serif">VOL PREMIUM ANOMALY</text>`;
  });

  // Historical Vol line
  let hvPath = '';
  let hvStarted = false;
  data.historicalVol.forEach((vol, i) => {
    if (!isNaN(vol)) {
      const x = padding.left + (i / Math.max(data.dates.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - ((vol - minVol) / (maxVol - minVol)) * chartHeight;
      if (!hvStarted) {
        hvPath = `M${x.toFixed(1)},${y.toFixed(1)}`;
        hvStarted = true;
      } else {
        hvPath += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      }
    }
  });
  if (hvPath) {
    svg += `<path d="${hvPath}" fill="none" stroke="#3B82F6" stroke-width="2"/>`;
  }

  // Implied Vol line
  let ivPath = '';
  let ivStarted = false;
  data.impliedVol.forEach((vol, i) => {
    if (!isNaN(vol)) {
      const x = padding.left + (i / Math.max(data.dates.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - ((vol - minVol) / (maxVol - minVol)) * chartHeight;
      if (!ivStarted) {
        ivPath = `M${x.toFixed(1)},${y.toFixed(1)}`;
        ivStarted = true;
      } else {
        ivPath += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      }
    }
  });
  if (ivPath) {
    svg += `<path d="${ivPath}" fill="none" stroke="#06B6D4" stroke-width="2"/>`;
  }

  // Percentile inset
  svg += `<rect x="${width - padding.right + 10}" y="${padding.top}" width="80" height="60" fill="#1a1a2e" rx="6" stroke="#374151" stroke-width="1"/>`;
  svg += `<text x="${width - padding.right + 50}" y="${padding.top + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="sans-serif">IV PERCENTILE</text>`;
  const pctColor = data.currentPercentile > 80 ? '#EF4444' : data.currentPercentile < 20 ? '#10B981' : '#F59E0B';
  svg += `<text x="${width - padding.right + 50}" y="${padding.top + 45}" text-anchor="middle" fill="${pctColor}" font-size="20" font-weight="bold" font-family="monospace">${data.currentPercentile}th</text>`;

  // Legend
  svg += `<rect x="${width - padding.right + 10}" y="${padding.top + 70}" width="80" height="55" fill="#1a1a2e" rx="4" stroke="#374151" stroke-width="1"/>`;
  svg += `<line x1="${width - padding.right + 20}" y1="${padding.top + 88}" x2="${width - padding.right + 40}" y2="${padding.top + 88}" stroke="#3B82F6" stroke-width="2"/>`;
  svg += `<text x="${width - padding.right + 45}" y="${padding.top + 92}" fill="#6b7280" font-size="8" font-family="sans-serif">30d HV</text>`;
  svg += `<line x1="${width - padding.right + 20}" y1="${padding.top + 108}" x2="${width - padding.right + 40}" y2="${padding.top + 108}" stroke="#06B6D4" stroke-width="2"/>`;
  svg += `<text x="${width - padding.right + 45}" y="${padding.top + 112}" fill="#6b7280" font-size="8" font-family="sans-serif">ATM IV</text>`;

  // X-axis dates
  const labelInterval = Math.floor(data.dates.length / 6);
  data.dates.forEach((date, i) => {
    if (i % labelInterval === 0) {
      const x = padding.left + (i / data.dates.length) * chartWidth;
      svg += `<text x="${x}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">${date}</text>`;
    }
  });

  // Interpretation
  const avgSpread = data.impliedVol.reduce((a, v, i) => a + (v - data.historicalVol[i]), 0) / data.impliedVol.length;
  const interpretation = avgSpread > 5 ? 'IV premium elevated - potential overhedge or event anticipation' : avgSpread < -3 ? 'IV discount - realized vol exceeding expectations' : 'Vol spread normal - balanced market expectations';
  svg += `<text x="${padding.left}" y="${height - 15}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${interpretation}</text>`;

  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 15}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;
  svg += `<text x="${width/2}" y="${height - 3}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: Vol Analytics</text>`;

  svg += '</svg>';
  return svg;
}

export function generateMockHistoricalVsImpliedVolData(ticker: string): HistoricalVsImpliedVolData {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }

  const baseHV = 22 + Math.random() * 8;
  const historicalVol = dates.map(() => baseHV + (Math.random() - 0.5) * 10);
  const impliedVol = historicalVol.map(hv => hv + 3 + (Math.random() - 0.3) * 8);

  const volPremiumAnomalies: { startIdx: number; endIdx: number }[] = [];
  for (let i = 0; i < dates.length - 10; i++) {
    if (impliedVol[i] - historicalVol[i] > 10 && Math.random() > 0.9) {
      volPremiumAnomalies.push({ startIdx: i, endIdx: Math.min(i + 8, dates.length - 1) });
      i += 10;
    }
  }

  return {
    ticker,
    dates,
    historicalVol,
    impliedVol,
    volPremiumAnomalies,
    currentPercentile: Math.floor(Math.random() * 40) + 55
  };
}

// 3. GREEKS SURFACE PLOT
interface GreeksSurfaceData {
  ticker: string;
  strikes: number[];
  expiries: string[];
  values: number[][];
  greekType: 'delta' | 'vega';
  spotPrice: number;
  whaleImpactZones: { strike: number; expiry: string; tag: string }[];
  nanZones: { strike: number; expiry: string }[];
  asOfTimestamp?: string;
}

export function generateGreeksSurfaceSvg(data: GreeksSurfaceData): string {
  const width = 800;
  const height = 450;
  const padding = { top: 60, right: 80, bottom: 70, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const cellWidth = chartWidth / data.strikes.length;
  const cellHeight = chartHeight / data.expiries.length;

  const flatValues = data.values.flat().filter(v => !isNaN(v));
  const maxVal = Math.max(...flatValues);
  const minVal = Math.min(...flatValues);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  const greekLabel = data.greekType === 'delta' ? 'Delta' : 'Vega';
  svg += `<text x="${padding.left}" y="28" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} ${greekLabel} Surface</text>`;
  svg += `<text x="${padding.left}" y="46" fill="#6b7280" font-size="11" font-family="sans-serif">Strike x Expiry Contour (Hot=High ${greekLabel})</text>`;

  // Heatmap cells
  data.expiries.forEach((expiry, ei) => {
    data.strikes.forEach((strike, si) => {
      const val = data.values[ei][si];
      const x = padding.left + si * cellWidth;
      const y = padding.top + ei * cellHeight;

      // Check for NaN
      const isNan = data.nanZones.some(z => z.strike === strike && z.expiry === expiry);
      
      if (isNan || isNaN(val)) {
        svg += `<rect x="${x}" y="${y}" width="${cellWidth - 1}" height="${cellHeight - 1}" fill="#1a1a2e" stroke="#374151" stroke-width="0.5"/>`;
        svg += `<text x="${x + cellWidth/2}" y="${y + cellHeight/2 + 3}" text-anchor="middle" fill="#6b7280" font-size="7" font-family="sans-serif">NaN</text>`;
      } else {
        const normalized = (val - minVal) / (maxVal - minVal);
        const r = Math.floor(normalized * 239 + 16);
        const g = Math.floor((1 - normalized) * 100);
        const b = Math.floor((1 - normalized) * 50);
        svg += `<rect x="${x}" y="${y}" width="${cellWidth - 1}" height="${cellHeight - 1}" fill="rgb(${r},${g},${b})" fill-opacity="0.85"/>`;
      }

      // Whale impact circle
      const isWhale = data.whaleImpactZones.some(z => z.strike === strike && z.expiry === expiry);
      if (isWhale) {
        svg += `<circle cx="${x + cellWidth/2}" cy="${y + cellHeight/2}" r="${Math.min(cellWidth, cellHeight) / 3}" fill="none" stroke="#F59E0B" stroke-width="2"/>`;
        const whale = data.whaleImpactZones.find(z => z.strike === strike && z.expiry === expiry);
        if (whale) {
          svg += `<text x="${x + cellWidth/2}" y="${y + cellHeight - 3}" text-anchor="middle" fill="#F59E0B" font-size="6" font-weight="bold" font-family="sans-serif">${whale.tag}</text>`;
        }
      }
    });
  });

  // Axis labels
  data.strikes.forEach((strike, i) => {
    if (i % 3 === 0) {
      const x = padding.left + i * cellWidth + cellWidth / 2;
      svg += `<text x="${x}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">$${strike}</text>`;
    }
  });

  data.expiries.forEach((expiry, i) => {
    const y = padding.top + i * cellHeight + cellHeight / 2;
    svg += `<text x="${padding.left - 8}" y="${y + 3}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">${expiry}</text>`;
  });

  svg += `<text x="${width/2}" y="${height - padding.bottom + 38}" text-anchor="middle" fill="#6b7280" font-size="10" font-family="sans-serif">Strike Price</text>`;
  svg += `<text x="15" y="${height/2}" text-anchor="middle" fill="#6b7280" font-size="10" font-family="sans-serif" transform="rotate(-90, 15, ${height/2})">Expiry</text>`;

  // Color scale legend
  svg += `<defs><linearGradient id="greekScale" x1="0%" y1="100%" x2="0%" y2="0%">`;
  svg += `<stop offset="0%" style="stop-color:#101020"/>`;
  svg += `<stop offset="100%" style="stop-color:#EF4444"/>`;
  svg += `</linearGradient></defs>`;
  svg += `<rect x="${width - padding.right + 15}" y="${padding.top}" width="20" height="${chartHeight}" fill="url(#greekScale)" rx="3"/>`;
  svg += `<text x="${width - padding.right + 42}" y="${padding.top + 10}" fill="#6b7280" font-size="8" font-family="monospace">High</text>`;
  svg += `<text x="${width - padding.right + 42}" y="${padding.top + chartHeight}" fill="#6b7280" font-size="8" font-family="monospace">Low</text>`;

  // Interpretation
  const maxZone = data.values.flat().indexOf(Math.max(...flatValues));
  const interpretation = data.greekType === 'vega' 
    ? 'Vega concentration in front-month - vol sensitivity elevated'
    : 'Delta clustering near ATM - directional exposure focused';
  svg += `<text x="${padding.left}" y="${height - 8}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${interpretation}</text>`;

  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - 10}" y="${height - 8}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;

  svg += '</svg>';
  return svg;
}

export function generateMockGreeksSurfaceData(ticker: string, spotPrice: number, greekType: 'delta' | 'vega' = 'vega'): GreeksSurfaceData {
  const baseStrike = Math.round(spotPrice / 5) * 5;
  const strikes = Array.from({ length: 12 }, (_, i) => baseStrike - 25 + i * 5);
  const expiries = ['Jan 10', 'Jan 17', 'Jan 24', 'Feb 21', 'Mar 21', 'Jun 20'];

  const values: number[][] = expiries.map((_, ei) => 
    strikes.map((strike, si) => {
      const moneyness = Math.abs(strike - spotPrice) / spotPrice;
      const timeFactor = 1 / (ei + 1);
      if (greekType === 'vega') {
        return (1 - moneyness * 3) * timeFactor * 100 + Math.random() * 20;
      } else {
        return 0.5 + (strike > spotPrice ? -1 : 1) * moneyness * 2 + Math.random() * 0.2;
      }
    })
  );

  const whaleImpactZones: { strike: number; expiry: string; tag: string }[] = [];
  if (Math.random() > 0.5) {
    whaleImpactZones.push({ strike: strikes[5], expiry: expiries[1], tag: 'UW' });
  }
  if (Math.random() > 0.6) {
    whaleImpactZones.push({ strike: strikes[7], expiry: expiries[0], tag: 'SWEEP' });
  }

  const nanZones: { strike: number; expiry: string }[] = [];
  if (Math.random() > 0.7) {
    nanZones.push({ strike: strikes[10], expiry: expiries[4] });
  }

  return { ticker, strikes, expiries, values, greekType, spotPrice, whaleImpactZones, nanZones };
}

// 4. TRADE TAPE TIMELINE
interface TradeTapeTimelineData {
  ticker: string;
  times: string[];
  cumulativePremium: number[];
  sentiment: ('bullish' | 'bearish' | 'neutral')[];
  whaleEvents: { timeIdx: number; premium: number; detail: string }[];
  putCallRatio: number[];
  asOfTimestamp?: string;
}

export function generateTradeTapeTimelineSvg(data: TradeTapeTimelineData): string {
  const width = 800;
  const height = 420;
  const padding = { top: 60, right: 80, bottom: 60, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxPremium = Math.max(...data.cumulativePremium) * 1.1;
  const barWidth = chartWidth / data.times.length * 0.8;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  svg += `<text x="${padding.left}" y="28" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Options Flow Timeline</text>`;
  svg += `<text x="${padding.left}" y="46" fill="#6b7280" font-size="11" font-family="sans-serif">Intraday Cumulative Premium with Whale Events</text>`;

  // Premium bars
  data.times.forEach((time, i) => {
    const x = padding.left + (i / data.times.length) * chartWidth;
    const barHeight = (data.cumulativePremium[i] / maxPremium) * chartHeight;
    const y = padding.top + chartHeight - barHeight;
    
    const color = data.sentiment[i] === 'bullish' ? '#10B981' : data.sentiment[i] === 'bearish' ? '#EF4444' : '#8B5CF6';
    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" fill-opacity="0.8" rx="1"/>`;
  });

  // Whale event spikes
  data.whaleEvents.forEach(event => {
    const x = padding.left + (event.timeIdx / data.times.length) * chartWidth + barWidth / 2;
    const baseY = padding.top + chartHeight - (data.cumulativePremium[event.timeIdx] / maxPremium) * chartHeight;
    
    svg += `<line x1="${x}" y1="${baseY}" x2="${x}" y2="${padding.top + 10}" stroke="#F59E0B" stroke-width="2"/>`;
    svg += `<circle cx="${x}" cy="${padding.top + 10}" r="8" fill="#F59E0B"/>`;
    svg += `<text x="${x}" y="${padding.top + 14}" text-anchor="middle" fill="#000000" font-size="8" font-weight="bold" font-family="sans-serif">W</text>`;
    svg += `<text x="${x + 12}" y="${padding.top + 28}" fill="#F59E0B" font-size="8" font-family="sans-serif">${event.detail}</text>`;
  });

  // Put/Call ratio line (secondary axis)
  const maxRatio = Math.max(...data.putCallRatio) * 1.2;
  let ratioPath = 'M';
  data.putCallRatio.forEach((ratio, i) => {
    const x = padding.left + (i / data.times.length) * chartWidth + barWidth / 2;
    const y = padding.top + chartHeight - (ratio / maxRatio) * chartHeight;
    ratioPath += `${i === 0 ? 'M' : 'L'}${x},${y} `;
  });
  svg += `<path d="${ratioPath}" fill="none" stroke="#06B6D4" stroke-width="2" stroke-dasharray="4,2"/>`;

  // X-axis time labels
  const labelInterval = Math.floor(data.times.length / 8);
  data.times.forEach((time, i) => {
    if (i % labelInterval === 0) {
      const x = padding.left + (i / data.times.length) * chartWidth;
      svg += `<text x="${x}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">${time}</text>`;
    }
  });

  // Legend
  svg += `<rect x="${width - padding.right + 5}" y="${padding.top}" width="70" height="80" fill="#1a1a2e" rx="4" stroke="#374151" stroke-width="1"/>`;
  svg += `<rect x="${width - padding.right + 15}" y="${padding.top + 12}" width="10" height="10" fill="#10B981" rx="2"/>`;
  svg += `<text x="${width - padding.right + 30}" y="${padding.top + 20}" fill="#6b7280" font-size="8" font-family="sans-serif">Bull</text>`;
  svg += `<rect x="${width - padding.right + 15}" y="${padding.top + 28}" width="10" height="10" fill="#EF4444" rx="2"/>`;
  svg += `<text x="${width - padding.right + 30}" y="${padding.top + 36}" fill="#6b7280" font-size="8" font-family="sans-serif">Bear</text>`;
  svg += `<line x1="${width - padding.right + 15}" y1="${padding.top + 54}" x2="${width - padding.right + 35}" y2="${padding.top + 54}" stroke="#06B6D4" stroke-width="2" stroke-dasharray="4,2"/>`;
  svg += `<text x="${width - padding.right + 40}" y="${padding.top + 58}" fill="#6b7280" font-size="7" font-family="sans-serif">P/C</text>`;

  // Interpretation
  const bullishBars = data.sentiment.filter(s => s === 'bullish').length;
  const bearishBars = data.sentiment.filter(s => s === 'bearish').length;
  const interpretation = bullishBars > bearishBars * 1.5 ? 'Bullish flow dominant - positive premium accumulation' : bearishBars > bullishBars * 1.5 ? 'Bearish flow elevated - distribution pattern' : 'Mixed flow - consolidation likely';
  svg += `<text x="${padding.left}" y="${height - 15}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${interpretation}</text>`;

  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 15}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;
  svg += `<text x="${width/2}" y="${height - 3}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: Options Flow</text>`;

  svg += '</svg>';
  return svg;
}

export function generateMockTradeTapeTimelineData(ticker: string): TradeTapeTimelineData {
  const times: string[] = [];
  for (let h = 9; h <= 16; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 9 && m < 30) continue;
      if (h === 16 && m > 0) continue;
      times.push(`${h}:${m.toString().padStart(2, '0')}`);
    }
  }

  let cumPremium = 0;
  const cumulativePremium = times.map(() => {
    cumPremium += Math.random() * 5000000;
    return cumPremium;
  });

  const sentiment = times.map(() => {
    const r = Math.random();
    return r > 0.6 ? 'bullish' : r > 0.3 ? 'bearish' : 'neutral';
  }) as ('bullish' | 'bearish' | 'neutral')[];

  const whaleEvents: TradeTapeTimelineData['whaleEvents'] = [];
  if (Math.random() > 0.3) {
    whaleEvents.push({ timeIdx: Math.floor(times.length * 0.3), premium: 5000000, detail: '$5M Sweep' });
  }
  if (Math.random() > 0.5) {
    whaleEvents.push({ timeIdx: Math.floor(times.length * 0.7), premium: 3200000, detail: '$3.2M Block' });
  }

  const putCallRatio = times.map(() => 0.8 + Math.random() * 1.5);

  return { ticker, times, cumulativePremium, sentiment, whaleEvents, putCallRatio };
}

// 5. SECTOR CORRELATION HEATMAP
interface SectorCorrelationData {
  ticker: string;
  peers: string[];
  correlations: number[][];
  decouplings: { row: number; col: number; label: string }[];
  asOfTimestamp?: string;
}

export function generateSectorCorrelationSvg(data: SectorCorrelationData): string {
  const width = 600;
  const height = 500;
  const padding = { top: 80, right: 40, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const cellSize = Math.min(chartWidth / data.peers.length, chartHeight / data.peers.length);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  svg += `<text x="${padding.left}" y="28" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Sector Correlation Matrix</text>`;
  svg += `<text x="${padding.left}" y="46" fill="#6b7280" font-size="11" font-family="sans-serif">IV/Price Correlations to Sector Peers</text>`;

  // Heatmap cells
  data.peers.forEach((_, ri) => {
    data.peers.forEach((_, ci) => {
      const val = data.correlations[ri][ci];
      const x = padding.left + ci * cellSize;
      const y = padding.top + ri * cellSize;

      if (isNaN(val)) {
        svg += `<rect x="${x}" y="${y}" width="${cellSize - 2}" height="${cellSize - 2}" fill="#ffffff" fill-opacity="0.1"/>`;
        svg += `<text x="${x + cellSize/2}" y="${y + cellSize/2 + 3}" text-anchor="middle" fill="#6b7280" font-size="8" font-family="sans-serif">NaN</text>`;
      } else {
        // Color scale: -1 (blue) to +1 (red)
        const normalized = (val + 1) / 2;
        const r = Math.floor(normalized * 239);
        const b = Math.floor((1 - normalized) * 239);
        svg += `<rect x="${x}" y="${y}" width="${cellSize - 2}" height="${cellSize - 2}" fill="rgb(${r},50,${b})" rx="2"/>`;
        svg += `<text x="${x + cellSize/2}" y="${y + cellSize/2 + 4}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="bold" font-family="monospace">${val.toFixed(2)}</text>`;
      }

      // Decoupling border
      const isDecoupling = data.decouplings.some(d => d.row === ri && d.col === ci);
      if (isDecoupling) {
        svg += `<rect x="${x}" y="${y}" width="${cellSize - 2}" height="${cellSize - 2}" fill="none" stroke="#F59E0B" stroke-width="3" rx="2"/>`;
      }
    });
  });

  // Axis labels
  data.peers.forEach((peer, i) => {
    const x = padding.left + i * cellSize + cellSize / 2;
    const y = padding.top + i * cellSize + cellSize / 2;
    svg += `<text x="${x}" y="${padding.top - 8}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="sans-serif" transform="rotate(-45, ${x}, ${padding.top - 8})">${peer}</text>`;
    svg += `<text x="${padding.left - 8}" y="${y + 3}" text-anchor="end" fill="#6b7280" font-size="9" font-family="sans-serif">${peer}</text>`;
  });

  // Color scale legend
  svg += `<defs><linearGradient id="corrScale" x1="0%" y1="0%" x2="100%" y2="0%">`;
  svg += `<stop offset="0%" style="stop-color:#3B82F6"/>`;
  svg += `<stop offset="50%" style="stop-color:#374151"/>`;
  svg += `<stop offset="100%" style="stop-color:#EF4444"/>`;
  svg += `</linearGradient></defs>`;
  svg += `<rect x="${padding.left}" y="${height - 35}" width="150" height="12" fill="url(#corrScale)" rx="3"/>`;
  svg += `<text x="${padding.left}" y="${height - 40}" fill="#6b7280" font-size="8" font-family="monospace">-1</text>`;
  svg += `<text x="${padding.left + 75}" y="${height - 40}" text-anchor="middle" fill="#6b7280" font-size="8" font-family="monospace">0</text>`;
  svg += `<text x="${padding.left + 150}" y="${height - 40}" text-anchor="end" fill="#6b7280" font-size="8" font-family="monospace">+1</text>`;

  // Decoupling note
  if (data.decouplings.length > 0) {
    svg += `<text x="${padding.left + 180}" y="${height - 28}" fill="#F59E0B" font-size="9" font-family="sans-serif">Unusual Decoupling - Probe Catalyst</text>`;
  }

  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 10}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;
  svg += `<text x="${width/2}" y="${height - 10}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: Correlation Analytics</text>`;

  svg += '</svg>';
  return svg;
}

// Get sector peers based on ticker (real tickers instead of placeholders)
function getSectorPeers(ticker: string): string[] {
  const sectorMap: Record<string, string[]> = {
    // Precious metals
    'SLV': ['SLV', 'GLD', 'GDX', 'SIL', 'SIVR', 'PSLV'],
    'GLD': ['GLD', 'SLV', 'GDX', 'IAU', 'SGOL', 'PHYS'],
    'GDX': ['GDX', 'GLD', 'GDXJ', 'NEM', 'GOLD', 'AEM'],
    // Tech
    'SPY': ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO'],
    'QQQ': ['QQQ', 'SPY', 'XLK', 'VGT', 'SMH', 'ARKK'],
    'AAPL': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'],
    'NVDA': ['NVDA', 'AMD', 'INTC', 'SMH', 'AVGO', 'TSM'],
    'TSLA': ['TSLA', 'NIO', 'RIVN', 'LCID', 'F', 'GM'],
    // Financials
    'XLF': ['XLF', 'JPM', 'BAC', 'GS', 'MS', 'C'],
    // Energy
    'XLE': ['XLE', 'XOM', 'CVX', 'USO', 'OXY', 'COP'],
    // Bonds
    'TLT': ['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'TMF'],
  };
  
  // Find matching sector or use generic market peers
  for (const [key, peers] of Object.entries(sectorMap)) {
    if (ticker.toUpperCase() === key || peers.includes(ticker.toUpperCase())) {
      // Put the target ticker first, then other peers
      const result = [ticker];
      for (const p of peers) {
        if (p !== ticker && result.length < 6) result.push(p);
      }
      return result;
    }
  }
  
  // Default to market indices for unknown tickers (no VIX - not a correlation peer)
  return [ticker, 'SPY', 'QQQ', 'IWM', 'DIA', 'XLF'];
}

export function generateMockSectorCorrelationData(ticker: string): SectorCorrelationData {
  const peers = getSectorPeers(ticker);
  
  const correlations: number[][] = peers.map((_, ri) => 
    peers.map((_, ci) => {
      if (ri === ci) return 1.0;
      const base = 0.4 + Math.random() * 0.5;
      return Math.round((ri < ci ? base : base) * 100) / 100;
    })
  );

  const decouplings: SectorCorrelationData['decouplings'] = [];
  for (let i = 0; i < peers.length; i++) {
    for (let j = i + 1; j < peers.length; j++) {
      if (correlations[i][j] < -0.5 || correlations[i][j] > 0.95) {
        decouplings.push({ row: i, col: j, label: 'Unusual' });
      }
    }
  }

  return { ticker, peers, correlations, decouplings };
}

// 6. MAX PAIN CHART
interface MaxPainData {
  ticker: string;
  strikes: number[];
  callOI: number[];
  putOI: number[];
  maxPainStrike: number;
  spotPrice: number;
  unusualBuildup: number[];
  asOfTimestamp?: string;
}

export function generateMaxPainSvg(data: MaxPainData): string {
  const width = 800;
  const height = 400;
  const padding = { top: 60, right: 60, bottom: 60, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxOI = Math.max(...data.callOI, ...data.putOI) * 1.1;
  const barWidth = chartWidth / data.strikes.length * 0.4;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  svg += `<text x="${padding.left}" y="28" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Max Pain Analysis</text>`;
  svg += `<text x="${padding.left}" y="46" fill="#6b7280" font-size="11" font-family="sans-serif">Stacked Call/Put OI with Options Expiry Pin Level</text>`;

  // Stacked bars
  data.strikes.forEach((strike, i) => {
    const x = padding.left + (i / data.strikes.length) * chartWidth;
    
    // Put OI (bottom, red)
    const putHeight = (data.putOI[i] / maxOI) * chartHeight;
    const putY = padding.top + chartHeight - putHeight;
    svg += `<rect x="${x}" y="${putY}" width="${barWidth}" height="${putHeight}" fill="#EF4444" fill-opacity="0.7"/>`;
    
    // Call OI (stacked on top, green)
    const callHeight = (data.callOI[i] / maxOI) * chartHeight;
    const callY = putY - callHeight;
    svg += `<rect x="${x + barWidth + 2}" y="${callY}" width="${barWidth}" height="${callHeight}" fill="#10B981" fill-opacity="0.7"/>`;

    // Unusual buildup shading
    if (data.unusualBuildup[i] > 0.8) {
      svg += `<rect x="${x - 2}" y="${padding.top}" width="${barWidth * 2 + 6}" height="${chartHeight}" fill="#EF4444" fill-opacity="0.15" rx="2"/>`;
    }
    
    // Strike labels
    if (i % 2 === 0) {
      svg += `<text x="${x + barWidth}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">$${strike}</text>`;
    }
  });

  // Max pain vertical line
  const mpIdx = data.strikes.indexOf(data.maxPainStrike);
  if (mpIdx >= 0) {
    const mpX = padding.left + (mpIdx / data.strikes.length) * chartWidth + barWidth;
    svg += `<line x1="${mpX}" y1="${padding.top}" x2="${mpX}" y2="${height - padding.bottom}" stroke="#F59E0B" stroke-width="3"/>`;
    svg += `<rect x="${mpX - 50}" y="${padding.top + 5}" width="100" height="22" fill="#F59E0B" rx="4"/>`;
    svg += `<text x="${mpX}" y="${padding.top + 20}" text-anchor="middle" fill="#000000" font-size="9" font-weight="bold" font-family="sans-serif">MAX PAIN $${data.maxPainStrike}</text>`;
  }

  // Spot price marker
  const spotIdx = data.strikes.findIndex(s => Math.abs(s - data.spotPrice) < 3);
  if (spotIdx >= 0) {
    const spotX = padding.left + (spotIdx / data.strikes.length) * chartWidth + barWidth;
    svg += `<line x1="${spotX}" y1="${padding.top + 30}" x2="${spotX}" y2="${height - padding.bottom}" stroke="#3B82F6" stroke-width="2" stroke-dasharray="4,2"/>`;
    svg += `<text x="${spotX + 5}" y="${padding.top + 42}" fill="#3B82F6" font-size="8" font-family="sans-serif">SPOT</text>`;
  }

  // Legend
  svg += `<rect x="${width - padding.right - 100}" y="${padding.top}" width="90" height="50" fill="#1a1a2e" rx="4" stroke="#374151" stroke-width="1"/>`;
  svg += `<rect x="${width - padding.right - 90}" y="${padding.top + 12}" width="12" height="10" fill="#10B981" rx="2"/>`;
  svg += `<text x="${width - padding.right - 73}" y="${padding.top + 20}" fill="#6b7280" font-size="9" font-family="sans-serif">Call OI</text>`;
  svg += `<rect x="${width - padding.right - 90}" y="${padding.top + 28}" width="12" height="10" fill="#EF4444" rx="2"/>`;
  svg += `<text x="${width - padding.right - 73}" y="${padding.top + 36}" fill="#6b7280" font-size="9" font-family="sans-serif">Put OI</text>`;

  // Interpretation
  const distFromSpot = data.maxPainStrike - data.spotPrice;
  const interpretation = Math.abs(distFromSpot) < 3 ? 'Max pain near spot - balanced positioning' : distFromSpot > 0 ? `Max pain $${distFromSpot.toFixed(0)} above spot - upward magnet` : `Max pain $${Math.abs(distFromSpot).toFixed(0)} below spot - downward pressure`;
  svg += `<text x="${padding.left}" y="${height - 15}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${interpretation}</text>`;

  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 15}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;
  svg += `<text x="${width/2}" y="${height - 3}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: OI Analytics</text>`;

  svg += '</svg>';
  return svg;
}

export function generateMockMaxPainData(ticker: string, spotPrice: number): MaxPainData {
  const baseStrike = Math.round(spotPrice / 5) * 5;
  const strikes = Array.from({ length: 15 }, (_, i) => baseStrike - 35 + i * 5);
  
  const callOI = strikes.map(s => {
    const dist = s - spotPrice;
    return Math.max(1000, 50000 * Math.exp(-Math.abs(dist) / 20) + Math.random() * 10000);
  });
  
  const putOI = strikes.map(s => {
    const dist = spotPrice - s;
    return Math.max(1000, 45000 * Math.exp(-Math.abs(dist) / 20) + Math.random() * 10000);
  });

  // Find max pain (where total value lost is maximized for both sides)
  let maxPainIdx = 7;
  let maxPain = 0;
  strikes.forEach((strike, i) => {
    const totalPain = callOI.slice(0, i).reduce((a, b) => a + b, 0) + putOI.slice(i).reduce((a, b) => a + b, 0);
    if (totalPain > maxPain) {
      maxPain = totalPain;
      maxPainIdx = i;
    }
  });

  const unusualBuildup = strikes.map(() => Math.random());

  return {
    ticker,
    strikes,
    callOI,
    putOI,
    maxPainStrike: strikes[maxPainIdx],
    spotPrice,
    unusualBuildup
  };
}

// 7. IV RANK HISTOGRAM
interface IVRankHistogramData {
  ticker: string;
  bins: number[];
  frequencies: number[];
  currentIV: number;
  currentPercentile: number;
  asOfTimestamp?: string;
}

export function generateIVRankHistogramSvg(data: IVRankHistogramData): string {
  const width = 700;
  const height = 380;
  const padding = { top: 60, right: 60, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxFreq = Math.max(...data.frequencies) * 1.1;
  const barWidth = chartWidth / data.bins.length * 0.85;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  svg += `<text x="${padding.left}" y="28" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} IV Rank Distribution</text>`;
  svg += `<text x="${padding.left}" y="46" fill="#6b7280" font-size="11" font-family="sans-serif">1-Year Percentile Histogram</text>`;

  // Histogram bars
  data.bins.forEach((bin, i) => {
    const x = padding.left + (i / data.bins.length) * chartWidth;
    const barHeight = (data.frequencies[i] / maxFreq) * chartHeight;
    const y = padding.top + chartHeight - barHeight;
    
    // Color based on percentile range
    const color = bin < 20 ? '#10B981' : bin > 80 ? '#EF4444' : '#3B82F6';
    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" fill-opacity="0.7" rx="1"/>`;
    
    // Bin labels
    if (i % 2 === 0) {
      svg += `<text x="${x + barWidth/2}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">${bin}%</text>`;
    }
  });

  // Distribution curve overlay
  let curvePath = 'M';
  data.bins.forEach((_, i) => {
    const x = padding.left + (i / data.bins.length) * chartWidth + barWidth / 2;
    const y = padding.top + chartHeight - (data.frequencies[i] / maxFreq) * chartHeight;
    curvePath += `${i === 0 ? 'M' : 'L'}${x},${y} `;
  });
  svg += `<path d="${curvePath}" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.5"/>`;

  // Current IV vertical line
  const currentX = padding.left + (data.currentPercentile / 100) * chartWidth;
  svg += `<line x1="${currentX}" y1="${padding.top}" x2="${currentX}" y2="${height - padding.bottom}" stroke="#F59E0B" stroke-width="3"/>`;
  svg += `<rect x="${currentX - 60}" y="${padding.top + 5}" width="120" height="22" fill="#F59E0B" rx="4"/>`;
  svg += `<text x="${currentX}" y="${padding.top + 20}" text-anchor="middle" fill="#000000" font-size="9" font-weight="bold" font-family="sans-serif">Current: ${data.currentPercentile}th Percentile</text>`;

  // Current IV value
  svg += `<text x="${currentX}" y="${padding.top + 40}" text-anchor="middle" fill="#F59E0B" font-size="11" font-weight="bold" font-family="monospace">IV: ${data.currentIV.toFixed(1)}%</text>`;

  // Interpretation
  const interpretation = data.currentPercentile > 85 ? 'Elevated - vol crush risk if no catalyst' : data.currentPercentile < 15 ? 'Depressed - vol expansion opportunity' : 'Normal range - balanced expectations';
  const interpColor = data.currentPercentile > 85 ? '#EF4444' : data.currentPercentile < 15 ? '#10B981' : '#6b7280';
  svg += `<text x="${padding.left}" y="${height - 15}" fill="${interpColor}" font-size="9" font-weight="bold" font-family="sans-serif">INTERPRETATION: ${interpretation}</text>`;

  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 15}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;
  svg += `<text x="${width/2}" y="${height - 3}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: IV Analytics</text>`;

  svg += '</svg>';
  return svg;
}

export function generateMockIVRankHistogramData(ticker: string): IVRankHistogramData {
  const bins = Array.from({ length: 20 }, (_, i) => i * 5);
  
  // Normal-ish distribution centered around 40-50
  const frequencies = bins.map(bin => {
    const center = 45;
    const dist = Math.abs(bin - center);
    return Math.max(1, 30 * Math.exp(-dist * dist / 500) + Math.random() * 5);
  });

  return {
    ticker,
    bins,
    frequencies,
    currentIV: 28 + Math.random() * 15,
    currentPercentile: 75 + Math.floor(Math.random() * 20)
  };
}

// 8. OPTIONS VS STOCK VOLUME RATIO
interface OptionsStockVolumeData {
  ticker: string;
  dates: string[];
  optionsPremium: number[];
  volumeRatio: number[];
  spikeThresholds: { dateIdx: number; ratio: number }[];
  asOfTimestamp?: string;
}

export function generateOptionsStockVolumeSvg(data: OptionsStockVolumeData): string {
  const width = 800;
  const height = 380;
  const padding = { top: 60, right: 80, bottom: 60, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxPremium = Math.max(...data.optionsPremium) * 1.1;
  const maxRatio = Math.max(...data.volumeRatio) * 1.1;
  const barWidth = chartWidth / data.dates.length * 0.7;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;
  
  svg += `<text x="${padding.left}" y="28" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Options vs Stock Volume</text>`;
  svg += `<text x="${padding.left}" y="46" fill="#6b7280" font-size="11" font-family="sans-serif">30-Day Premium Volume with ADV Ratio</text>`;

  // Premium bars
  data.dates.forEach((_, i) => {
    const x = padding.left + (i / data.dates.length) * chartWidth;
    const barHeight = (data.optionsPremium[i] / maxPremium) * chartHeight;
    const y = padding.top + chartHeight - barHeight;
    
    // Check for spike threshold
    const isSpike = data.spikeThresholds.some(s => s.dateIdx === i);
    const color = isSpike ? '#F59E0B' : '#3B82F6';
    
    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" fill-opacity="0.7" rx="1"/>`;
    
    if (isSpike) {
      svg += `<text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" fill="#F59E0B" font-size="7" font-weight="bold" font-family="sans-serif">UNUSUAL</text>`;
    }
  });

  // Volume ratio line (right axis)
  let ratioPath = 'M';
  data.dates.forEach((_, i) => {
    const x = padding.left + (i / data.dates.length) * chartWidth + barWidth / 2;
    const y = padding.top + chartHeight - (data.volumeRatio[i] / maxRatio) * chartHeight;
    ratioPath += `${i === 0 ? 'M' : 'L'}${x},${y} `;
  });
  svg += `<path d="${ratioPath}" fill="none" stroke="#EF4444" stroke-width="2"/>`;

  // 200% threshold line
  const thresholdY = padding.top + chartHeight - (200 / maxRatio) * chartHeight;
  if (thresholdY > padding.top) {
    svg += `<line x1="${padding.left}" y1="${thresholdY}" x2="${width - padding.right}" y2="${thresholdY}" stroke="#F59E0B" stroke-width="1" stroke-dasharray="4,2"/>`;
    svg += `<text x="${width - padding.right + 5}" y="${thresholdY + 4}" fill="#F59E0B" font-size="8" font-family="sans-serif">200%</text>`;
  }

  // X-axis labels
  const labelInterval = Math.floor(data.dates.length / 6);
  data.dates.forEach((date, i) => {
    if (i % labelInterval === 0) {
      const x = padding.left + (i / data.dates.length) * chartWidth;
      svg += `<text x="${x}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="monospace">${date}</text>`;
    }
  });

  // Y-axis labels
  svg += `<text x="${padding.left - 10}" y="${padding.top + chartHeight/2}" text-anchor="end" fill="#3B82F6" font-size="9" font-family="sans-serif" transform="rotate(-90, ${padding.left - 10}, ${padding.top + chartHeight/2})">Premium ($)</text>`;
  svg += `<text x="${width - padding.right + 10}" y="${padding.top + chartHeight/2}" fill="#EF4444" font-size="9" font-family="sans-serif" transform="rotate(90, ${width - padding.right + 10}, ${padding.top + chartHeight/2})">Ratio to ADV</text>`;

  // Legend
  svg += `<rect x="${width - padding.right - 10}" y="${padding.top}" width="85" height="50" fill="#1a1a2e" rx="4" stroke="#374151" stroke-width="1"/>`;
  svg += `<rect x="${width - padding.right}" y="${padding.top + 12}" width="12" height="10" fill="#3B82F6" rx="2"/>`;
  svg += `<text x="${width - padding.right + 17}" y="${padding.top + 20}" fill="#6b7280" font-size="8" font-family="sans-serif">Premium</text>`;
  svg += `<line x1="${width - padding.right}" y1="${padding.top + 35}" x2="${width - padding.right + 15}" y2="${padding.top + 35}" stroke="#EF4444" stroke-width="2"/>`;
  svg += `<text x="${width - padding.right + 17}" y="${padding.top + 38}" fill="#6b7280" font-size="8" font-family="sans-serif">ADV Ratio</text>`;

  // Interpretation
  const avgRatio = data.volumeRatio.reduce((a, b) => a + b, 0) / data.volumeRatio.length;
  const interpretation = avgRatio > 180 ? 'Options activity elevated vs equity - unusual flow signal' : avgRatio < 80 ? 'Options activity subdued - low conviction' : 'Normal options/equity relationship';
  svg += `<text x="${padding.left}" y="${height - 15}" fill="#9ca3af" font-size="9" font-family="sans-serif">INTERPRETATION: ${interpretation}</text>`;

  const asOfTime = data.asOfTimestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  svg += `<text x="${width - padding.right}" y="${height - 15}" text-anchor="end" fill="#6b7280" font-size="9" font-family="monospace">As of: ${asOfTime} ET</text>`;
  svg += `<text x="${width/2}" y="${height - 3}" text-anchor="middle" fill="#374151" font-size="8" font-family="sans-serif">DARK POOL DATA | Source: Volume Analytics</text>`;

  svg += '</svg>';
  return svg;
}

export function generateMockOptionsStockVolumeData(ticker: string): OptionsStockVolumeData {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }

  const optionsPremium = dates.map(() => Math.random() * 50000000 + 5000000);
  const volumeRatio = dates.map(() => 80 + Math.random() * 150);

  const spikeThresholds: { dateIdx: number; ratio: number }[] = [];
  volumeRatio.forEach((ratio, i) => {
    if (ratio > 200) {
      spikeThresholds.push({ dateIdx: i, ratio });
    }
  });

  return { ticker, dates, optionsPremium, volumeRatio, spikeThresholds };
}
