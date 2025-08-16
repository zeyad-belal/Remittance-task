// src/services/cybrid.ts

const TOKEN_URL = "http://192.168.1.23:3000/token"; // set in app.config

let _token: { value: string; expAt: number } | null = null;
async function getBearer(): Promise<string> {
  const now = Date.now() / 1000;
  if (_token && now < _token.expAt - 60) return _token.value;

  const r = await fetch(TOKEN_URL);
  const j = await r.json();
  _token = { value: j.access_token, expAt: (now + (j.expires_in || 900)) };
  return _token.value;
}

export const Cybrid = {
  // --- Minimal REST wrappers (SDK-free) ---
  price: {
    async listPrices(params: { symbol?: string; page?: number; perPage?: number }) {
      const token = await getBearer();
      const url = new URL("https://bank.production.cybrid.app/api/prices");
      if (params?.symbol) url.searchParams.set("symbol", params.symbol);
      if (typeof params?.page === "number") url.searchParams.set("page", String(params.page));
      if (typeof params?.perPage === "number") url.searchParams.set("per_page", String(params.perPage));
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`prices: ${res.status} ${await res.text()}`);
      return res.json();
    },
  },
  quote: {
    async createQuote(body: any) {
      const token = await getBearer();
      const res = await fetch("https://bank.production.cybrid.app/api/quotes", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`quote: ${res.status} ${await res.text()}`);
      return res.json();
    },
  },
  trade: {
    async createTrade(body: any) {
      const token = await getBearer();
      const res = await fetch("https://bank.production.cybrid.app/api/trades", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`trade: ${res.status} ${await res.text()}`);
      return res.json();
    },
  },
  kyc: {
    async createIdentityVerification(body: any) {
      const token = await getBearer();
      const res = await fetch("https://bank.production.cybrid.app/api/identity_verifications", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`identity_verifications: ${res.status} ${await res.text()}`);
      return res.json();
    },
  },
};

// Helpers you’ll use in screens:
export async function getUsdToAsset(symbol = "USD-SLL") {
  const res: any = await (Cybrid.price as any).listPrices({ symbol, page: 0, perPage: 1 });
  const obj = res?.objects?.[0] || res?.data?.[0] || res?.[0];
  if (!obj) throw new Error("No price returned from Cybrid");
  return Number(obj.buy_price ?? obj.sell_price ?? obj.price);
}

export async function createAndExecuteTrade(params: {
  customerGuid: string;
  symbol: string;
  side: "buy" | "sell";
  amount: string;
}) {
  // 1) Create quote
  const quote: any = await (Cybrid.quote as any).createQuote({
    product_type: "trading",
    customer_guid: params.customerGuid,
    symbol: params.symbol,
    side: params.side,
    deliver_amount: params.amount,
  });

  // 2) Execute trade
  const trade: any = await (Cybrid.trade as any).createTrade({
    quote_guid: quote.guid,
    customer_guid: params.customerGuid,
  });
  return trade;
}

// KYC helper
export async function startKyc(customerGuid: string) {
  const iv: any = await (Cybrid.kyc as any).createIdentityVerification({
    customer_guid: customerGuid,
    type: "kyc",
  });
  return iv;
}