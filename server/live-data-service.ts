interface DarkPoolPrint {
  ticker: string;
  price: number;
  size: number;
  value: number;
  timestamp: string;
  venue: string;
  percentOfAdv: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface OptionsSweep {
  ticker: string;
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  premium: number;
  contracts: number;
  delta: number;
  timestamp: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

interface TickerContext {
  ticker: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  float?: number;
  shortInterest?: number;
  analystTarget?: number;
  support?: number;
  resistance?: number;
}

export async function fetchUnusualWhalesData(): Promise<{ darkPool: DarkPoolPrint[], options: OptionsSweep[] }> {
  const apiKey = process.env.UNUSUAL_WHALES_API_KEY;
  if (!apiKey) {
    console.log("No Unusual Whales API key, using generated data");
    return { darkPool: [], options: [] };
  }

  try {
    const [darkPoolRes, optionsRes] = await Promise.all([
      fetch("https://api.unusualwhales.com/api/darkpool/recent", {
        headers: { 
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        }
      }),
      fetch("https://api.unusualwhales.com/api/option-trades/flow", {
        headers: { 
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json"
        }
      })
    ]);

    console.log("Dark Pool API status:", darkPoolRes.status);
    console.log("Options API status:", optionsRes.status);
    
    const darkPoolRaw = darkPoolRes.ok ? await darkPoolRes.json() : { data: [] };
    const optionsRaw = optionsRes.ok ? await optionsRes.json() : { data: [] };
    
    // Handle different response structures (array directly vs { data: [...] })
    const darkPoolData = Array.isArray(darkPoolRaw) ? darkPoolRaw : (darkPoolRaw.data || darkPoolRaw.result || []);
    const optionsData = Array.isArray(optionsRaw) ? optionsRaw : (optionsRaw.data || optionsRaw.result || optionsRaw.trades || []);
    
    console.log("Dark pool records:", darkPoolData.length);
    console.log("Options records:", optionsData.length);
    
    // Log sample of raw response to debug field names
    if (darkPoolData.length > 0) {
      console.log("Dark pool sample record:", JSON.stringify(darkPoolData[0]).slice(0, 500));
    }

    const darkPool: DarkPoolPrint[] = darkPoolData.slice(0, 10).map((d: any) => {
      // Try multiple field name variations for size/volume
      const rawSize = d.size || d.volume || d.shares || d.trade_size || d.qty || d.quantity || 0;
      const size = typeof rawSize === 'string' ? parseInt(rawSize.replace(/,/g, '')) : parseInt(rawSize) || 0;
      
      // Try multiple field name variations for value/premium
      const rawValue = d.notional || d.value || d.premium || d.trade_value || d.dollar_value || 0;
      const value = typeof rawValue === 'string' ? parseFloat(rawValue.replace(/[$,]/g, '')) : parseFloat(rawValue) || 0;
      
      // Try multiple field name variations for price
      const rawPrice = d.price || d.avg_price || d.execution_price || d.fill_price || 0;
      const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[$,]/g, '')) : parseFloat(rawPrice) || 0;

      return {
        ticker: d.ticker || d.symbol || d.underlying || "UNKNOWN",
        price,
        size: size > 0 ? size : (value > 0 && price > 0 ? Math.round(value / price) : 0),
        value: value > 0 ? value : (size > 0 && price > 0 ? size * price : 0),
        timestamp: d.timestamp || d.executed_at || d.date || d.trade_date || new Date().toISOString(),
        venue: d.venue || d.exchange || d.market || "DARK",
        percentOfAdv: parseFloat(d.percent_of_adv || d.adv_percent || d.pct_adv) || 0,
        sentiment: inferSentiment(d)
      };
    });

    // Log sample of raw response to debug field names
    if (optionsData.length > 0) {
      console.log("Options sample record:", JSON.stringify(optionsData[0]).slice(0, 500));
    }

    const options: OptionsSweep[] = optionsData.slice(0, 10).map((o: any) => {
      const rawPremium = o.premium || o.total_premium || o.cost || o.value || 0;
      const premium = typeof rawPremium === 'string' ? parseFloat(rawPremium.replace(/[$,]/g, '')) : parseFloat(rawPremium) || 0;
      
      const rawContracts = o.size || o.contracts || o.volume || o.qty || 0;
      const contracts = typeof rawContracts === 'string' ? parseInt(rawContracts.replace(/,/g, '')) : parseInt(rawContracts) || 0;
      
      return {
        ticker: o.ticker || o.symbol || o.underlying || "UNKNOWN",
        strike: parseFloat(o.strike || o.strike_price) || 0,
        expiry: o.expiry || o.expiration || o.exp_date || o.expiration_date || "",
        type: (o.type || o.option_type || o.put_call || "call").toLowerCase() as 'call' | 'put',
        premium,
        contracts,
        delta: parseFloat(o.delta) || 0,
        timestamp: o.timestamp || o.executed_at || o.date || new Date().toISOString(),
        sentiment: (o.type || o.option_type || o.put_call || '').toLowerCase() === 'call' ? 'bullish' : 'bearish'
      };
    });

    return { darkPool, options };
  } catch (error) {
    console.error("Error fetching Unusual Whales data:", error);
    return { darkPool: [], options: [] };
  }
}

export async function fetchPolygonQuote(ticker: string): Promise<TickerContext | null> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return null;

  try {
    const [quoteRes, detailsRes] = await Promise.all([
      fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`),
      fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`)
    ]);

    if (!quoteRes.ok) return null;
    
    const quoteData = await quoteRes.json();
    const detailsData = detailsRes.ok ? await detailsRes.json() : { results: {} };
    
    const quote = quoteData.results?.[0];
    const details = detailsData.results || {};

    if (!quote) return null;

    return {
      ticker,
      companyName: details.name || ticker,
      price: quote.c || 0,
      change: (quote.c - quote.o) || 0,
      changePercent: quote.o ? ((quote.c - quote.o) / quote.o * 100) : 0,
      volume: quote.v || 0,
      avgVolume: 0,
      marketCap: details.market_cap || 0,
      float: details.share_class_shares_outstanding || undefined,
      support: quote.l || undefined,
      resistance: quote.h || undefined
    };
  } catch (error) {
    console.error("Error fetching Polygon data:", error);
    return null;
  }
}

export async function fetchFMPData(ticker: string): Promise<Partial<TickerContext>> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return {};

  try {
    const response = await fetch(`https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${apiKey}`);
    if (!response.ok) return {};
    
    const data = await response.json();
    const quote = data[0];
    
    if (!quote) return {};

    return {
      ticker,
      companyName: quote.name || ticker,
      price: quote.price || 0,
      change: quote.change || 0,
      changePercent: quote.changesPercentage || 0,
      volume: quote.volume || 0,
      avgVolume: quote.avgVolume || 0,
      marketCap: quote.marketCap || 0
    };
  } catch (error) {
    console.error("Error fetching FMP data:", error);
    return {};
  }
}

export async function fetchAlphaVantageIntraday(ticker: string): Promise<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${ticker}&interval=15min&apikey=${apiKey}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const timeSeries = data["Time Series (15min)"];
    
    if (!timeSeries) return [];

    return Object.entries(timeSeries).slice(0, 50).map(([timestamp, values]: [string, any]) => ({
      timestamp,
      open: parseFloat(values["1. open"]) || 0,
      high: parseFloat(values["2. high"]) || 0,
      low: parseFloat(values["3. low"]) || 0,
      close: parseFloat(values["4. close"]) || 0,
      volume: parseInt(values["5. volume"]) || 0
    }));
  } catch (error) {
    console.error("Error fetching Alpha Vantage data:", error);
    return [];
  }
}

function inferSentiment(data: any): 'bullish' | 'bearish' | 'neutral' {
  if (data.side === 'buy' || data.sentiment === 'bullish') return 'bullish';
  if (data.side === 'sell' || data.sentiment === 'bearish') return 'bearish';
  return 'neutral';
}

export async function getEnrichedTickerData(ticker: string): Promise<TickerContext | null> {
  const [polygonData, fmpData] = await Promise.all([
    fetchPolygonQuote(ticker),
    fetchFMPData(ticker)
  ]);

  if (!polygonData && !fmpData.price) {
    return null;
  }

  return {
    ticker,
    companyName: polygonData?.companyName || fmpData.companyName || ticker,
    price: polygonData?.price || fmpData.price || 0,
    change: polygonData?.change || fmpData.change || 0,
    changePercent: polygonData?.changePercent || fmpData.changePercent || 0,
    volume: polygonData?.volume || fmpData.volume || 0,
    avgVolume: fmpData.avgVolume || polygonData?.avgVolume || 0,
    marketCap: polygonData?.marketCap || fmpData.marketCap || 0,
    float: polygonData?.float,
    shortInterest: undefined,
    analystTarget: undefined,
    support: polygonData?.support,
    resistance: polygonData?.resistance
  };
}

export function generateMockDarkPoolPrint(): DarkPoolPrint {
  const tickers = ['AAPL', 'NVDA', 'TSLA', 'META', 'GOOGL', 'MSFT', 'AMD', 'AMZN', 'SPY', 'QQQ'];
  const venues = ['DARK', 'FINRA', 'NASDAQ', 'NYSE', 'BATS'];
  const ticker = tickers[Math.floor(Math.random() * tickers.length)];
  const price = 100 + Math.random() * 400;
  const size = Math.floor(10000 + Math.random() * 990000);
  
  return {
    ticker,
    price: Math.round(price * 100) / 100,
    size,
    value: Math.round(price * size),
    timestamp: new Date().toISOString(),
    venue: venues[Math.floor(Math.random() * venues.length)],
    percentOfAdv: Math.round(Math.random() * 15 * 10) / 10,
    sentiment: Math.random() > 0.5 ? 'bullish' : Math.random() > 0.5 ? 'bearish' : 'neutral'
  };
}

export function generateMockOptionsSweep(): OptionsSweep {
  const tickers = ['AAPL', 'NVDA', 'TSLA', 'META', 'GOOGL', 'MSFT', 'AMD', 'AMZN', 'SPY', 'QQQ'];
  const ticker = tickers[Math.floor(Math.random() * tickers.length)];
  const isCall = Math.random() > 0.4;
  const strike = Math.round((150 + Math.random() * 300) / 5) * 5;
  const contracts = Math.floor(100 + Math.random() * 4900);
  const premium = Math.round((contracts * (2 + Math.random() * 18)) * 100);
  
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + Math.floor(7 + Math.random() * 60));
  
  return {
    ticker,
    strike,
    expiry: expiry.toISOString().split('T')[0],
    type: isCall ? 'call' : 'put',
    premium,
    contracts,
    delta: Math.round((isCall ? 0.3 + Math.random() * 0.5 : -0.3 - Math.random() * 0.5) * 100) / 100,
    timestamp: new Date().toISOString(),
    sentiment: isCall ? 'bullish' : 'bearish'
  };
}
