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

interface OptionsFlowHeatmapData {
  ticker: string;
  strikes: number[];
  expiries: string[];
  cells: { strike: number; expiry: string; premium: number; sentiment: 'bullish' | 'bearish' | 'neutral'; contracts: number; tags?: string[] }[];
  spotPrice: number;
  asOfTimestamp?: string;
}

export function generateOptionsFlowHeatmapSvg(data: OptionsFlowHeatmapData): string {
  const width = 800;
  const height = 500;
  const padding = { top: 60, right: 30, bottom: 80, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const cellWidth = chartWidth / data.expiries.length;
  const cellHeight = chartHeight / data.strikes.length;
  const maxPremium = Math.max(...data.cells.map(c => c.premium));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background: #0a0a0f;">`;

  svg += `<text x="${padding.left}" y="30" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker} Options Flow Heatmap</text>`;
  svg += `<text x="${padding.left}" y="48" fill="#6b7280" font-size="11" font-family="sans-serif">Premium Volume by Strike/Expiry | Spot: $${data.spotPrice.toFixed(2)}</text>`;

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
  putCallRatio: number;
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
  const isExtreme = data.putCallRatio > 3 || data.putCallRatio < 0.33;
  const gaugeColor = isExtreme ? '#EF4444' : '#6b7280';
  
  // P/C Ratio gauge with interpretation
  svg += `<rect x="${gaugeX - 35}" y="${gaugeY - 25}" width="70" height="95" fill="#1a1a2e" rx="8" stroke="${gaugeColor}" stroke-width="${isExtreme ? 2 : 1}"/>`;
  svg += `<text x="${gaugeX}" y="${gaugeY}" text-anchor="middle" fill="#6b7280" font-size="9" font-family="sans-serif">P/C RATIO</text>`;
  svg += `<text x="${gaugeX}" y="${gaugeY + 25}" text-anchor="middle" fill="#ffffff" font-size="18" font-weight="bold" font-family="monospace">${data.putCallRatio.toFixed(2)}</text>`;
  
  const ratioInterpretation = data.putCallRatio > 1.5 ? 'BEARISH' : data.putCallRatio < 0.7 ? 'BULLISH' : 'NEUTRAL';
  const ratioColor = data.putCallRatio > 1.5 ? '#EF4444' : data.putCallRatio < 0.7 ? '#10B981' : '#6b7280';
  svg += `<text x="${gaugeX}" y="${gaugeY + 45}" text-anchor="middle" fill="${ratioColor}" font-size="8" font-weight="bold" font-family="sans-serif">${ratioInterpretation}</text>`;
  
  if (isExtreme) {
    svg += `<text x="${gaugeX}" y="${gaugeY + 58}" text-anchor="middle" fill="#F59E0B" font-size="7" font-weight="bold" font-family="sans-serif">EXTREME</text>`;
  }
  
  // Interpretation annotation
  const oiInterpretation = data.putCallRatio > 1.5 ? 'Elevated put activity - hedging or bearish positioning' : data.putCallRatio < 0.7 ? 'Call-heavy flow - bullish sentiment' : 'Balanced OI distribution';
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

export function generateMockOptionsFlowData(ticker: string, spotPrice: number): OptionsFlowHeatmapData {
  const baseStrike = Math.round(spotPrice / 5) * 5;
  const strikes = Array.from({ length: 10 }, (_, i) => baseStrike - 25 + i * 5);
  const expiries = ['Jan 10', 'Jan 17', 'Jan 24', 'Feb 21', 'Mar 21'];
  
  const cells: OptionsFlowHeatmapData['cells'] = [];
  strikes.forEach(strike => {
    expiries.forEach(expiry => {
      if (Math.random() > 0.3) {
        const sentiments: ('bullish' | 'bearish' | 'neutral')[] = ['bullish', 'bearish', 'neutral'];
        cells.push({
          strike,
          expiry,
          premium: Math.floor(Math.random() * 5000000) + 100000,
          sentiment: sentiments[Math.floor(Math.random() * 3)],
          contracts: Math.floor(Math.random() * 5000) + 100,
          tags: Math.random() > 0.7 ? ['SWEEP', 'UNUSUAL'] : undefined
        });
      }
    });
  });

  return { ticker, strikes, expiries, cells, spotPrice };
}

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
