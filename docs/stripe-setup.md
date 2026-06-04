# Stripe setup (paywall)

One-off €14.90 payment to unlock a report's full analysis + PDF. The price is a
config/env value (`REPORT_PRICE_EUR`, default in `config/brand.ts`).

## 1. Keys (test mode first)
1. Create a Stripe account → dashboard in **Test mode**.
2. **Developers → API keys** → copy the **Secret key** (`sk_test_…`).
3. Put it in `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   ```
   (We create the price inline at checkout, so `STRIPE_PRICE_ID` is optional.)

## 2. Webhook (this is what unlocks the report after payment)
The webhook marks the order paid → the buyer's report unlocks.

**Local testing** with the Stripe CLI (recommended):
1. Install: `brew install stripe/stripe-cli/stripe` → `stripe login`.
2. Forward events to the local webhook:
   ```
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
3. It prints a signing secret `whsec_…` — put it in `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Restart the dev server.

**Production** (later): in the Stripe dashboard, **Developers → Webhooks → Add
endpoint** → URL `https://YOUR_DOMAIN/api/stripe/webhook`, event
`checkout.session.completed` → copy its signing secret into the deployment env.

## 3. How the flow works
- Buyer submits a flat → free **preview** (premium sections locked).
- Operator reviews, runs the AI narrative, and **publishes** the report.
- On a published report, the preview shows **Unlock for €14.90** → Stripe
  Checkout → on success the webhook records a **paid order** → the report is
  fully viewable at its URL, and the buyer is emailed the link (email is a stub
  for now — wire Resend later).

## 4. Test cards
Use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.

## Notes / not yet done
- Email delivery is a stub (`lib/email.ts` logs the link). Wire Resend/SMTP for
  real delivery.
- There's a brief moment after payment where the webhook may not have landed; if
  the report still shows the preview on return, a refresh resolves it.
- No spam/rate-limit on the public form yet.
