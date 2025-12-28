interface ChartData {
  ticker: string;
  timeframe: '15m' | '1h' | '4h' | '1D';
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[];
  darkPoolPrint?: { time: number; price: number; size: number };
  levels: {
    vwap?: number;
    ema20?: number;
    ema50?: number;
    ema200?: number;
    support?: number;
    resistance?: number;
    poc?: number;
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

  svg += `<text x="${padding.left}" y="25" fill="#ffffff" font-size="16" font-weight="bold" font-family="sans-serif">${data.ticker}</text>`;
  svg += `<text x="${padding.left + 80}" y="25" fill="#6b7280" font-size="12" font-family="monospace">${data.timeframe}</text>`;
  
  const lastCandle = data.candles[data.candles.length - 1];
  if (lastCandle) {
    const priceColor = lastCandle.close >= lastCandle.open ? '#10B981' : '#EF4444';
    svg += `<text x="${width - padding.right}" y="25" text-anchor="end" fill="${priceColor}" font-size="14" font-weight="bold" font-family="monospace">$${lastCandle.close.toFixed(2)}</text>`;
  }

  svg += `<text x="${width/2}" y="${height - 10}" text-anchor="middle" fill="#374151" font-size="9" font-family="sans-serif">DARK POOL DATA</text>`;

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
