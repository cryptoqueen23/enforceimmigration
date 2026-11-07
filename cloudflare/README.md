# Cloudflare setup

The Vercel site is separate from this Cloudflare Worker and D1 database. Signatures are NOT enabled until configured.

1. In Cloudflare, create D1 database named `enforceimmigration-signatures`. Put its database ID into `wrangler.toml`.
2. Run `npx wrangler d1 execute enforceimmigration-signatures --remote --file=cloudflare/schema.sql` from the repository root.
3. Deploy with `npx wrangler deploy --config cloudflare/wrangler.toml`.
4. Set Worker secrets using `npx wrangler secret put NAME --config cloudflare/wrangler.toml`: `TURNSTILE_SECRET`, `RESEND_API_KEY`, `HASH_SECRET` (long random value).
5. Configure Worker variables `FRONTEND_ORIGIN` (exact Vercel/custom domain origin), `API_ORIGIN` (Worker HTTPS URL), `FROM_EMAIL` (verified Resend sending domain), `ORGANIZER_NAME` (actual legal organizer identity), and `MARKETING_CONSENT_TEXT` (exact approved marketing opt-in language). Do not use placeholder identities in production.
6. Create a Cloudflare Turnstile widget for the live domain. Put its public site key into `index.html` in the `data-sitekey` field. Turnstile's secret belongs ONLY in Cloudflare.
7. Set `API_BASE` in `index.html` to your Worker HTTPS URL. Publish a real privacy policy identifying the organizer and describing petition and marketing uses before enabling the form.
8. For production: implement authenticated export, opt-out and deletion handling, rate limiting, privacy retention, operational monitoring, and consider verified double opt-in for marketing. Do not publicly expose signers' records.

Verified count counts only email-confirmed signatures, not verified citizenship or eligibility. Petition data is sensitive and should not be disclosed in full to officials without clear disclosure and a secure transfer process.
