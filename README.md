this is readme for gerry the salmander

## Maps saved to your profile

`Save map` stores a named, private copy of the full map geometry, original voters,
drawn districts, active matchup, and election swing. `My maps` reopens or deletes
saved copies. There is a limit of 20 maps per account. Each save is a new copy;
opening one warns before replacing a current district plan. Saving is available
to every signed-in account, without a premium requirement. Guests can still play.

The existing account widget owns login. Its member menu links to
`https://gerry.shauryaswebsites.com/?maps=1`. The legacy singular domain redirects
to that canonical domain so browser cookies remain first-party.

Gerry's Worker verifies each API request through the `user-management` service
binding. It selects a separate SQLite Durable Object by the verified immutable
user ID. Client-provided user IDs never choose an owner. No changes to the
central authentication database are required. The Durable Object namespace is
provisioned by the `saved-maps-v1` migration in `wrangler.toml` during deployment.

Deploy the companion account-widget update (canonical Gerry trusted origin,
`shaurya:auth-open` event, and My Gerry maps link), then deploy this repository
using `npm ci && npm run deploy`. Existing Cloudflare Workers Builds deployments
can continue to use `npx wrangler deploy --assets=.`; Wrangler now picks up the
Worker, auth binding, and storage migration from the committed configuration.
`.assetsignore` excludes server sources, tests, dependency files, and development
configuration from static hosting.

Validation: `npm test` checks snapshot restoration, authorization, origin
checks, quotas, request sizes, and account isolation. `python3 scripts/test.py
saved-maps` runs the added browser integration tests; `python3 scripts/test.py`
runs the full browser suite. Cloudflare credentials are needed only for a real
deployment, not for tests or `npx wrangler deploy --dry-run`.
