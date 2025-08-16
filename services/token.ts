// server/token.ts
import express from "express";
import fetch from "node-fetch";

// 31f131d7cd0db8e744031ae99d18d89e
// b869eb6eb7b56f5c83fd274cecd86b1f
// f1GKkqrG_SsW6SaY7Vx0geVKIWVfBg4q_7IvPucUUn8
const CYBRID_CLIENT_ID = '31f131d7cd0db8e744031ae99d18d89e';
const CYBRID_CLIENT_SECRET = 'f1GKkqrG_SsW6SaY7Vx0geVKIWVfBg4q_7IvPucUUn8';
const CYBRID_IDP = "https://id.production.cybrid.app/oauth/token"; // use sandbox or prod

const app = express();
app.get("/token/bank", async (_req, res) => {
  const body = {
    grant_type: "client_credentials",
    client_id: CYBRID_CLIENT_ID,
    client_secret: CYBRID_CLIENT_SECRET,
    scope:
      "banks:read banks:write accounts:read accounts:execute " +
      "customers:read customers:write customers:execute " +
      "prices:read quotes:read quotes:execute trades:read trades:execute " +
      "transfers:read transfers:execute identity_verifications:execute identity_verifications:read " +
      "external_wallets:read workflows:read"
  };

  const r = await fetch(CYBRID_IDP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await r.json();
  if (!r.ok) return res.status(500).json(json);
  res.json({ access_token: json.access_token, expires_in: json.expires_in });
});

app.listen(process.env.PORT || 8787);