/**
 * Developer docs content. Lives in the repo, not Firestore, on purpose: the
 * docs describe the code, so they change in the same pull request as the code
 * and go through the same review. Edit here; the /docs page renders it.
 *
 * Each topic: id (URL anchor), title, category, summary (one line), what,
 * why, where (files in our repos), optional code sample, and pitfalls.
 */

export const DOC_CATEGORIES = [
  { id: 'concepts', label: 'Core concepts' },
  { id: 'database', label: 'Database' },
  { id: 'backend', label: 'Backend' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'security', label: 'Security' },
  { id: 'quality', label: 'Quality & delivery' },
]

export const DOC_TOPICS = [
  /* ───────────────────────────── Core concepts ───────────────────────────── */
  {
    id: 'idempotency',
    title: 'Idempotency',
    category: 'concepts',
    summary: 'Doing the same request twice has the same effect as doing it once.',
    what:
      'An operation is idempotent when repeating it does not change the result after the first time. GET, PUT and DELETE are idempotent by definition; POST is not — two POSTs normally create two rows. We make selected POSTs idempotent with an idempotency key: the client sends a unique X-Idempotency-Key header, the server stores the first response under that key, and any retry with the same key gets the stored response instead of running the action again. Our records are unique per user + endpoint + key, expire, and store a hash of the request body — reusing a key with a different body is refused as a conflict. Concurrent retries are serialized with select_for_update().',
    why:
      'Networks fail in the middle. A user clicks "Submit receipt", the request reaches the server, but the response is lost; the browser (or the user) retries. Without idempotency we would record two payments, create two subscriptions or send two emails. With it, the retry is harmless.',
    where: [
      'market_neurons_backend/core/idempotency.py — IdempotencyMixin used by write views',
      'market_neurons_backend/core/models/idempotency.py — stored keys and responses',
      'Market-Neurons-frontend/src/lib/plans.ts — submitPaymentReceipt sends X-Idempotency-Key (crypto.randomUUID)',
      'Market-Neurons-frontend/src/components/BankTransferModal.tsx — keeps one key per attempt, clears it on success',
    ],
    code: `// Frontend: one key per logical attempt, reused on retries
const key = crypto.randomUUID()
await fetch('/api/me/payment-receipts/submit/', {
  method: 'POST',
  headers: { 'X-Idempotency-Key': key },
  body: form,
})`,
    pitfalls: [
      'Generate the key once per user action, not per HTTP attempt — a new key on each retry defeats the purpose.',
      'Keys are scoped to the user and endpoint, so one user cannot replay another user\'s key.',
      'Keys expire (expires_at); a retry after expiry runs the action again.',
    ],
  },
  {
    id: 'debouncing',
    title: 'Debouncing',
    category: 'concepts',
    summary: 'Wait until the input stops changing before doing the expensive work.',
    what:
      'A debounced value only updates after it has been stable for a delay (we use 250 ms). While the user keeps typing, the timer keeps resetting; the work runs once, after they pause. Keep the input itself bound to the live value so typing stays instant — only the filtering or fetching reads the debounced value.',
    why:
      'Filtering 40+ products or calling the API on every keystroke wastes CPU and requests, makes the list flicker, and can return results out of order (a slow response for "ab" arriving after the fast one for "abc").',
    where: [
      'Market-Neurons-frontend/src/hooks/useDebouncedValue.ts — the hook',
      'Market-Neurons-frontend/src/app/sectors/[slug]/SectorTerminal.tsx — product search uses it',
    ],
    code: `export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer) // typing again cancels the pending update
  }, [value, delay])
  return debounced
}`,
    pitfalls: [
      'Debounce the consumer, not the input: a debounced <input value> feels laggy.',
      'Debounce is not throttle: debounce waits for silence, throttle runs at most once per interval.',
      'For API calls, also cancel or ignore stale responses (AbortController) — debouncing reduces races, it does not remove them.',
    ],
  },
  {
    id: 'throttling',
    title: 'Throttling & rate limiting',
    category: 'concepts',
    summary: 'Cap how often something may happen per client per time window.',
    what:
      'Server-side, rate limiting rejects requests beyond a quota with HTTP 429. We use DRF throttles: strict scoped limits on brute-forceable endpoints (login and signup 10/hour, password reset 5/hour) and a general ceiling on everything else (anonymous 300/min, signed-in 1200/min, configurable with DJANGO_THROTTLE_ANON / DJANGO_THROTTLE_USER). Client-side, throttling a handler means it runs at most once per interval (scroll, resize).',
    why:
      'Stops password guessing, protects the database from bulk scraping of sector data, and keeps one noisy client from degrading the site for everyone.',
    where: [
      'market_neurons_backend/market_neurons_backend/settings.py — DEFAULT_THROTTLE_CLASSES and DEFAULT_THROTTLE_RATES',
      'accounts/auth_views.py — throttle_scope = "login" / "signup"',
      'core/tests/test_throttling.py — proves the 429',
    ],
    pitfalls: [
      'Throttle counters live in the cache. Local-memory cache is per process, so with several gunicorn workers the real limit is higher; use a shared cache (Redis) if limits must be exact.',
      'Behind a proxy, make sure the client IP is the real one (X-Forwarded-For), or every user shares one bucket.',
      'Tests hit the same counters — clear the cache in setUp for throttled endpoints.',
    ],
  },
  {
    id: 'pagination',
    title: 'Pagination',
    category: 'concepts',
    summary: 'Return large lists in pages instead of all at once.',
    what:
      'Page-number pagination returns { count, next, previous, results } for ?page=N. Our API pages only when the caller asks with ?page_size= (max 200) — every existing list still returns a plain array, so callers can move over one at a time.',
    why:
      'Unbounded lists grow with the data: slower queries, bigger responses, more memory, and an easy way to scrape everything in one request.',
    where: [
      'market_neurons_backend/core/pagination.py — OptionalPageNumberPagination',
      'settings.py — DEFAULT_PAGINATION_CLASS',
    ],
    pitfalls: [
      'Paginated querysets need a stable order_by, or rows repeat or vanish between pages. Aggregate queries (annotate + Count) drop Meta.ordering — order explicitly.',
      'Offset pagination gets slow on very large tables; switch to cursor pagination there.',
    ],
  },
  {
    id: 'race-conditions',
    title: 'Race conditions & single-flight',
    category: 'concepts',
    summary: 'When two things happen at once, make sure only one does the work.',
    what:
      'A race happens when the result depends on timing. Classic example in our frontend: after a reload several components need a token at once; if each one refreshes, the second refresh uses a token the first already rotated and fails. Single-flight means the first caller starts the work and every other caller awaits the same promise.',
    why:
      'Races cause bugs that only appear "sometimes" — the hardest kind to reproduce and the most likely to reach production.',
    where: [
      'Market-Neurons-frontend/src/lib/auth.ts — refreshToken() shares refreshInFlight',
      'Market-Neurons-frontend/src/lib/auth.ts — fetchUserProfile() de-duplicates profile reads',
    ],
    code: `let inFlight = null
export function refreshToken() {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => { inFlight = null })
  }
  return inFlight // every concurrent caller gets the same promise
}`,
    pitfalls: [
      'Always clear the shared promise in finally, or one failure blocks all future refreshes.',
      'In the database, use transactions or select_for_update() when two requests may update the same row.',
    ],
  },
  {
    id: 'caching',
    title: 'Caching',
    category: 'concepts',
    summary: 'Keep a copy of a result so the next read is cheap — and know when it is stale.',
    what:
      'We cache in a few deliberate places: the user profile is cached in memory with a 30 s freshness window and in localStorage for first paint; DRF throttles use Django\'s cache; the browser caches static assets from the Next build. Receipt images send Cache-Control: private, no-store because they must never be cached by shared proxies.',
    why:
      'Fewer requests and faster pages. The cost is staleness, so every cache needs a rule for when it is invalidated.',
    where: [
      'Market-Neurons-frontend/src/lib/auth.ts — PROFILE_TTL_MS and { force: true } after mutations',
      'market_neurons_backend/accounts/views.py — PaymentReceiptImageView sets no-store',
    ],
    pitfalls: [
      'Never cache anything per-user in a shared cache without the user in the key.',
      'After a write, refresh or bust the cached read (fetchUserProfile({ force: true })).',
    ],
  },

  /* ───────────────────────────── Database ───────────────────────────── */
  {
    id: 'migrations',
    title: 'Migrations',
    category: 'database',
    summary: 'Every model change ships with a migration; CI fails without one.',
    what:
      'A Django migration is a versioned, ordered script that changes the database schema (AddField, AlterField…) or data (RunPython). makemigrations writes it from your model changes; migrate applies it. Our deploy runs migrate automatically.',
    why:
      'The schema must be reproducible on every machine — your laptop, CI, production — and every change must be reviewable. Hand-edited databases drift and break deploys.',
    where: [
      'market_neurons_backend/*/migrations/',
      'Example with data: accounts/migrations/0014_paymentreceipt_private_storage.py moves files and can move them back',
      'CI: python manage.py makemigrations --check --dry-run',
    ],
    code: `python manage.py makemigrations sectors -n productcategory_usage
python manage.py migrate
python manage.py makemigrations --check --dry-run   # what CI runs`,
    pitfalls: [
      'Give data migrations a reverse function so a rollback works.',
      'Adding a NOT NULL column to a big table needs a default, or the migration fails on existing rows.',
      'Never edit a migration that has already been deployed; add a new one.',
      'Two branches that both add migrations to the same app conflict; rebase and renumber (or merge migration) before merging.',
    ],
  },
  {
    id: 'constraints',
    title: 'Constraints & data integrity',
    category: 'database',
    summary: 'Let the database refuse bad data, not just the code.',
    what:
      'UniqueConstraint and CheckConstraint live in the table itself. Product categories use them: sibling names are unique, two roots cannot share a name (NULL parents are special in SQL, so a conditional constraint closes that hole), slugs are unique per sector, and a row can never be its own parent.',
    why:
      'Validation in code can be bypassed — a script, a shell session, a race between two requests. A constraint cannot.',
    where: [
      'market_neurons_backend/sectors/models/product_category.py — Meta.constraints',
      'sectors/models/tree.py — clean() for rules SQL cannot express (depth, cycles)',
    ],
    pitfalls: [
      'Turn constraint errors into 400s with a clear message (full_clean in serializers), not 500s.',
      'Constraints are added by migrations; existing bad rows make the migration fail — clean data first.',
    ],
  },
  {
    id: 'indexes',
    title: 'Indexes',
    category: 'database',
    summary: 'Make the queries you run often fast.',
    what:
      'An index is a sorted lookup structure on one or more columns. Foreign keys and unique constraints get one automatically in PostgreSQL via Django. In Firestore, any query that filters or sorts on more than one field needs a composite index declared in firestore.indexes.json.',
    why:
      'Without the right index a query scans the whole table — fine with 50 rows, painful with 500,000.',
    where: [
      'market-neurons-tasks/firestore.indexes.json — composite indexes for the task app queries',
      'Django: Meta.indexes on a model when you filter or order by a non-key column often',
    ],
    pitfalls: [
      'Indexes speed reads and slow writes; add them for real query patterns, not "just in case".',
      'Firestore tells you the missing index in the error message with a link — add it to firestore.indexes.json so it is deployed, do not only click the link.',
    ],
  },
  {
    id: 'n-plus-one',
    title: 'The N+1 query problem',
    category: 'database',
    summary: 'One query for a list, then one more per row — fix with select_related / prefetch_related.',
    what:
      'Looping over 50 demand links and reading link.company.name runs 1 query for the links plus 50 for the companies. select_related joins single-valued relations (ForeignKey) into the first query; prefetch_related loads many-valued ones (children, M2M) in one extra query.',
    why:
      'N+1 is the most common reason a Django page gets slow as data grows. It is invisible in development with small data.',
    where: [
      'sectors/views.py — ProductCategoryViewSet: select_related("sector", "parent") and prefetch_related("children__children") for the 3-level tree',
      'sectors/views.py — overview(): Prefetch with its own queryset for nested drivers',
    ],
    code: `# Bad: 1 + N queries
for link in DemandLink.objects.all():
    print(link.company.name)

# Good: 1 query
for link in DemandLink.objects.select_related("company"):
    print(link.company.name)`,
    pitfalls: [
      'Serializers that nest relations cause N+1 too — fix it in get_queryset, where the serializer\'s data comes from.',
      'Check with django.db.connection.queries or assertNumQueries in tests.',
    ],
  },
  {
    id: 'transactions',
    title: 'Transactions & atomicity',
    category: 'database',
    summary: 'Several writes that must all succeed or all fail.',
    what:
      'transaction.atomic() wraps writes so an error rolls all of them back. Approving a payment receipt changes the receipt, creates a subscription and an invoice — half of that must never be saved.',
    why:
      'Partial writes leave the data inconsistent: a paid invoice without a subscription, a subscription without an invoice.',
    where: [
      'accounts/admin_views.py — AdminReceiptApproveView wraps the receipt, subscription and invoice writes in transaction.atomic()',
      'core/idempotency.py — select_for_update() inside a transaction to serialize concurrent retries',
    ],
    code: `from django.db import transaction

with transaction.atomic():
    receipt.approve(by=request.user)
    subscription = Subscription.objects.create(...)
    Invoice.objects.create(subscription=subscription, ...)`,
    pitfalls: [
      'Do not send emails or call external APIs inside the transaction; use transaction.on_commit() so they run only if it commits.',
      'Keep transactions short — they hold locks.',
    ],
  },
  {
    id: 'aggregation',
    title: 'Aggregation pitfalls',
    category: 'database',
    summary: 'Counting across joins multiplies rows unless you use distinct.',
    what:
      'Annotating a sector with Count("demand_drivers") and Count("trackers") in one query joins both tables; each driver row repeats for every tracker, so both counts are wrong. Count(..., distinct=True) fixes it. Aggregate queries also drop the model\'s Meta.ordering — add order_by().',
    why:
      'These bugs return plausible-looking numbers, so nobody notices until a customer does.',
    where: ['sectors/views.py — SectorViewSet.get_queryset uses distinct=True and an explicit order_by'],
    pitfalls: ['Write a test with two related rows on each side; a single row hides the multiplication.'],
  },
  {
    id: 'trees',
    title: 'Trees in a relational database',
    category: 'database',
    summary: 'Product categories and demand drivers are self-referencing trees with a depth limit.',
    what:
      'Each row points to its parent (adjacency list). level is derived on save, never accepted from the client. Depth is capped in clean(): 3 levels for product categories, 2 for demand drivers. The API can return the tree nested (?tree=1) in one request.',
    why:
      'Adjacency lists are simple to edit (move a subtree by changing one parent). The cost is reading deep trees, which we solve with bounded depth and prefetching.',
    where: [
      'sectors/models/tree.py — SectorTreeNode base: depth, cycles, same-sector parent',
      'docs/sector-relations.ar.md — the sector data model explained in Arabic',
    ],
    pitfalls: ['A parent from another sector or a cycle must be rejected — the base class does both.'],
  },
  {
    id: 'firestore',
    title: 'Firestore in the tasks app',
    category: 'database',
    summary: 'A document database with realtime listeners and security rules instead of an API.',
    what:
      'The tasks app has no backend of its own: the browser talks to Firestore directly. Pages subscribe with onSnapshot and re-render when data changes. Access control is enforced by firestore.rules on Google\'s side, and multi-field queries need composite indexes.',
    why:
      'No server to run for an internal tool, and realtime updates for free. The trade-off: the rules are the only thing standing between users and the data, so they must be as strict as an API would be.',
    where: [
      'market-neurons-tasks/lib/firebase.js, lib/db.js, lib/tasks.js — data layer',
      'market-neurons-tasks/firestore.rules and firestore.indexes.json',
    ],
    pitfalls: [
      'Every new collection or query needs matching rules and indexes in the same change.',
      'Unsubscribe listeners in the useEffect cleanup, or they leak and keep billing reads.',
      'Denormalize carefully: duplicated fields must be updated everywhere they live.',
    ],
  },

  /* ───────────────────────────── Backend ───────────────────────────── */
  {
    id: 'api-design',
    title: 'API design & the contract',
    category: 'backend',
    summary: 'One response shape, predictable URLs, and the frontend changes in the same task.',
    what:
      'Every response goes through StandardizedJSONRenderer: { status_code, data, errors }. URLs are mounted under /api/ and the /api/core/ alias. Status codes mean what they say: 400 bad input, 401 not signed in, 403 not allowed, 404 not found or not yours, 429 too many requests.',
    why:
      'A stable contract lets the frontend handle every response the same way. Changing a field name silently breaks a page nobody tested.',
    where: [
      'market_neurons_backend/core/renderers.py',
      'market_neurons_backend/market_neurons_backend/urls.py',
      'Rule in AGENTS.md: change an endpoint → update its frontend caller and the Postman/Apidog collections',
    ],
    pitfalls: [
      'Keep old fields during a transition (like refresh in the auth body) and remove them in a later release.',
      'Return 404 instead of 403 when revealing existence would leak information (signed receipt links do this).',
    ],
  },
  {
    id: 'permissions',
    title: 'Permissions & least privilege',
    category: 'backend',
    summary: 'Reads are open; writes need an editor, staff, or the admin token.',
    what:
      'ReadOnlyOrTrustedWriter is the default permission for every view: GET/HEAD/OPTIONS for anyone; writes only for staff, users whose profile can_manage_content, or the X-Admin-Token header (compared in constant time). With no token configured, writes are allowed only while DEBUG is on.',
    why:
      'Secure by default: a new view is read-only for the public until someone deliberately grants more.',
    where: ['market_neurons_backend/core/permissions.py', 'accounts/permissions.py — verified-user checks'],
    pitfalls: [
      'Do not bypass the default per view without a reason written in a comment.',
      'Object-level checks (is this receipt yours?) belong in get_queryset, so other users\' rows are simply not found.',
    ],
  },
  {
    id: 'config',
    title: 'Configuration & fail-closed settings',
    category: 'backend',
    summary: 'All config comes from environment variables; unsafe defaults refuse to start.',
    what:
      'Settings read os.environ with a safe local default. DJANGO_DEBUG defaults to off, and the app refuses to start without DJANGO_SECRET_KEY unless DEBUG is on. Local development sets DJANGO_DEBUG=true in .env.',
    why:
      'If the production env file fails to load, the site must not come up in debug mode with a publicly known secret key. Failing loudly at deploy is far better than running insecurely.',
    where: ['market_neurons_backend/market_neurons_backend/settings.py', 'scripts/deploy.sh — refuses to migrate without an env file'],
    pitfalls: [
      'Never commit .env files or print their values.',
      'Payment details and keys default to empty, never to demo values that could look real.',
    ],
  },
  {
    id: 'observability',
    title: 'Logging & error tracking',
    category: 'backend',
    summary: 'Know when production breaks before a user tells you.',
    what:
      'Logs go to stderr, which systemd keeps in the journal; unhandled request errors are logged by django.request. The SystemLog table records auditable events. Sentry is wired and turns on when SENTRY_DSN is set, with send_default_pii off.',
    why:
      'A swallowed exception is a bug you will only hear about from an angry customer.',
    where: ['settings.py — LOGGING and SENTRY_DSN', 'core/logging.py, core/middleware.py — SystemLog'],
    pitfalls: ['Never log passwords, tokens or full request bodies — core/logging.py redacts sensitive keys.', 'Prefer logging and re-raising over except Exception: pass.'],
  },

  /* ───────────────────────────── Frontend ───────────────────────────── */
  {
    id: 'next-app-router',
    title: 'Next.js App Router, server & client components',
    category: 'frontend',
    summary: 'Pages live in src/app; "use client" marks components that run in the browser.',
    what:
      'Files under src/app are routes. Server components render on the server and cannot use state or browser APIs; anything with useState, useEffect or event handlers needs "use client". Page-specific parts sit next to their page (sectors/[slug]/sectorData.ts, SectorWidgets.tsx); shared UI goes in src/components; API calls in src/lib.',
    why:
      'Server components send less JavaScript; client components give interactivity. Knowing which is which avoids hydration errors and bloated bundles.',
    where: ['Market-Neurons-frontend/src/app', 'Market-Neurons-frontend/README.md — layout table'],
    pitfalls: [
      'Reading localStorage during render causes hydration mismatches — read it after mount (see useUserProfile).',
      'Keep components small: a 2000-line component is hard to review and re-renders too much.',
    ],
  },
  {
    id: 'react-effects',
    title: 'useEffect, memoization & re-renders',
    category: 'frontend',
    summary: 'Effects sync with the outside world; derived data belongs in useMemo, not state.',
    what:
      'useEffect runs after render to subscribe, fetch or talk to the DOM, and its cleanup undoes that. Data you can compute from props or state should be computed (useMemo), not copied into state with an effect. The React Compiler lint rules (react-hooks/*) flag the risky patterns.',
    why:
      'Effect-driven state causes extra renders, flicker and loops that are hard to trace.',
    where: ['SectorTerminal.tsx — productGroups, visibleProducts are useMemo values', 'eslint.config.mjs — react-hooks rules'],
    pitfalls: [
      'Every value used inside an effect belongs in its dependency array.',
      'Return a cleanup for subscriptions, timers and listeners.',
      'Guard async effects against updating after unmount (an alive flag or AbortController).',
    ],
  },
  {
    id: 'api-client',
    title: 'Talking to the API from the frontend',
    category: 'frontend',
    summary: 'Go through src/lib helpers; get tokens with await ensureAccessToken().',
    what:
      'Each domain has a small client in src/lib (sectors.ts, plans.ts, supportApi.ts…). Authenticated calls await ensureAccessToken(), which returns the in-memory token or mints one from the refresh cookie. On a 401 the helpers refresh once and retry.',
    why:
      'One place for auth, error parsing and retries. Hand-rolled fetch calls each get these slightly wrong.',
    where: ['Market-Neurons-frontend/src/lib/auth.ts', 'src/lib/sectors.ts — authedFetch with refresh-and-retry'],
    pitfalls: ['Never read or write tokens in localStorage.', 'Unwrap the standard response shape with unwrapApiResponse.'],
  },
  {
    id: 'styling',
    title: 'Styling with CSS variables',
    category: 'frontend',
    summary: 'Vanilla CSS and design variables — no Tailwind, no UI library.',
    what:
      'Colours, radii and shadows are CSS custom properties (--accent, --surface, --border…). Pages have their own stylesheet next to them. Dark mode swaps the variables, not the components.',
    why:
      'One design language, small CSS, and theming for free.',
    where: ['Market-Neurons-frontend/src/app/globals.css', 'src/app/sectors/[slug]/sector.css', 'market-neurons-tasks/app/globals.css'],
    pitfalls: ['Use the variables, not hard-coded hex colours, or dark mode breaks.', 'Respect prefers-reduced-motion for animations.'],
  },
  {
    id: 'accessibility',
    title: 'Accessibility',
    category: 'frontend',
    summary: 'Everyone can use it with a keyboard and a screen reader.',
    what:
      'Use real buttons for actions, labels for inputs, role/aria-* only where HTML has no native element (tabs, comboboxes), and visible focus styles. The jsx-a11y lint rules catch many mistakes.',
    why:
      'It is required for many customers, and it makes the UI better for everyone (keyboard power users, tests that select by label).',
    where: ['builderForm.tsx Picker — combobox with aria-controls and aria-expanded', 'e2e tests select inputs by label (getByLabel)'],
    pitfalls: ['A clickable <div> is not a button: no keyboard, no focus, no role.'],
  },
  {
    id: 'content-protection',
    title: 'Copy & screenshot protection (and its limits)',
    category: 'frontend',
    summary: 'Deterrence, not DRM: block the casual paths, protect the data at the API.',
    what:
      'ProtectedContent blocks text selection, copy, right-click, drag, save/print shortcuts and printing, and blurs the data when the window loses focus. A browser cannot truly stop screenshots — the OS, phone cameras and DevTools sit outside the page.',
    why:
      'Raises the effort for casual copying. The real protection is the API sending only what the viewer is entitled to, plus rate limits.',
    where: ['Market-Neurons-frontend/src/components/shared/ProtectedContent.tsx'],
    pitfalls: ['Keep inputs selectable, or filters become unusable.', 'Anything the API returns can still be read from the Network tab.'],
  },

  /* ───────────────────────────── Security ───────────────────────────── */
  {
    id: 'jwt-cookies',
    title: 'Authentication: JWT, refresh cookie & in-memory access token',
    category: 'security',
    summary: 'Short access token in memory, long refresh token in an httpOnly cookie.',
    what:
      'Signing in returns a 15-minute access token (JWT) in the body and sets the 30-day refresh token as the mn_refresh cookie: httpOnly (scripts cannot read it), Secure in production, SameSite=Lax, path /api/auth/. The access token lives only in memory; after a reload the cookie mints a new one. Refresh tokens rotate on every use and are blacklisted on logout.',
    why:
      'A token in localStorage can be stolen by any script-injection bug and used for a month. An httpOnly cookie cannot be read by scripts, and a stolen 15-minute access token expires quickly.',
    where: [
      'market_neurons_backend/accounts/auth_cookies.py and auth_views.py',
      'Market-Neurons-frontend/src/lib/auth.ts — ensureAccessToken, refreshToken (single-flight)',
      'e2e/auth.spec.ts — proves no JWT is in storage and the session survives reloads',
    ],
    pitfalls: [
      'Auth calls go to the site\'s own /api/auth/ so the cookie is first-party (dev proxies it via next.config.ts).',
      'Production must be HTTPS or the Secure cookie is never stored.',
    ],
  },
  {
    id: 'csrf-cors',
    title: 'CSRF, SameSite & CORS',
    category: 'security',
    summary: 'Stop other sites from acting as the user, and control who may read responses.',
    what:
      'CSRF: a malicious site makes the victim\'s browser send a request that carries their cookies. SameSite=Lax stops cookies riding on cross-site POSTs, and cookie-based refresh also requires the X-MN-Refresh header, which a cross-site form cannot set. CORS decides which origins may read our responses; production allows only the configured origins.',
    why:
      'Cookies are sent automatically — that is what makes them convenient and what makes CSRF possible.',
    where: ['accounts/auth_cookies.py — header check', 'settings.py — CORS_ALLOWED_ORIGINS, CORS_ALLOW_HEADERS'],
    pitfalls: ['Never use CORS_ALLOW_ALL_ORIGINS with credentials in production (we only do it while DEBUG).'],
  },
  {
    id: 'csp-headers',
    title: 'Content Security Policy & security headers',
    category: 'security',
    summary: 'Tell the browser exactly where scripts, styles and data may come from.',
    what:
      'The CSP header lists allowed sources per resource type; anything else is blocked. We also send nosniff, X-Frame-Options DENY (no framing, prevents clickjacking), Referrer-Policy, Permissions-Policy (no camera/mic/location/payment) and HSTS in production.',
    why:
      'If an attacker manages to inject a script tag, the CSP stops it from loading code or sending data to their server.',
    where: [
      'Market-Neurons-frontend/next.config.ts — contentSecurityPolicy() and securityHeaders',
      'market_neurons_backend/settings.py — SECURE_CSP (Django 6 built-in)',
      'e2e/security-headers.spec.ts — pages load with no CSP violations',
    ],
    pitfalls: [
      'A new third-party script, font or API origin must be added to the CSP or the browser blocks it.',
      'script-src still has \'unsafe-inline\' for Next hydration; nonces are the next step.',
    ],
  },
  {
    id: 'signed-urls',
    title: 'Signed URLs for private files',
    category: 'security',
    summary: 'Payment receipts are served only through short-lived signed links.',
    what:
      'Receipt images live in PRIVATE_MEDIA_ROOT, which nginx does not serve. The owner\'s and admin\'s receipt listings mint a link signed with Django\'s TimestampSigner that expires in 15 minutes. A forged, expired or wrong-receipt token returns 404.',
    why:
      'Receipts contain bank details. Public media URLs are guessable (receipts/2026/09/…) and work forever.',
    where: ['market_neurons_backend/accounts/receipt_files.py', 'accounts/views.py — PaymentReceiptImageView', 'accounts/tests/test_receipt_images.py'],
    pitfalls: ['Any new sensitive upload must use private storage the same way.', 'Signed links in an <img> tag are why this is not a normal authenticated endpoint — <img> cannot send the JWT.'],
  },
  {
    id: 'secrets',
    title: 'Secrets management',
    category: 'security',
    summary: 'Secrets live in environment files on the server, never in git.',
    what:
      'Database passwords, Django secret key, OAuth client secrets, SMTP passwords and payment details are read from the environment (/etc/market-neurons-backend.env in production, .env locally). Frontend NEXT_PUBLIC_* values are public by definition — never put a secret there.',
    why:
      'A secret in git history is leaked forever, even after deletion.',
    where: ['AGENTS.md — secrets rule', '.gitignore — .env, private_media/'],
    pitfalls: ['If a secret is committed, rotate it; removing the commit is not enough.'],
  },
  {
    id: 'dependencies',
    title: 'Dependency security',
    category: 'security',
    summary: 'Pin versions, audit them in CI, patch quickly.',
    what:
      'pip-audit (backend) and pnpm audit (frontend) fail CI when a dependency has a published vulnerability. Versions are pinned (requirements.txt, package.json without "latest", lockfile). Vulnerable transitive packages are patched with pnpm overrides until their parent ships a fix.',
    why:
      'Most real-world breaches use known vulnerabilities in outdated packages. Upgrading Django 6.0.1 → 6.0.8 fixed 49 advisories.',
    where: ['requirements.txt, requirements-dev.txt', 'Market-Neurons-frontend/pnpm-workspace.yaml — overrides', 'both deploy.yml workflows'],
    pitfalls: ['Prefer patch releases; read the changelog before a minor or major upgrade and run the full test suite.'],
  },

  /* ───────────────────────────── Quality & delivery ───────────────────────────── */
  {
    id: 'git-workflow',
    title: 'Git workflow & commits',
    category: 'quality',
    summary: 'Feature branches, Conventional Commits, and dev/main deploy automatically.',
    what:
      'Work on feature/* branches. Commit messages follow Conventional Commits: feat(scope): …, fix(scope): …, refactor, test, docs, chore. A change spanning backend and frontend is two commits in two repos. Pushing to dev or main deploys to production.',
    why:
      'Readable history, easy reverts, and nobody ships by accident.',
    where: ['AGENTS.md', 'each repo\'s .github/workflows/deploy.yml'],
    code: `git switch -c feature/product-usage
git commit -m "feat(sectors): add usage field to product categories"`,
    pitfalls: ['Never push to dev/main unless you mean to deploy.', 'Other agents may be editing the same repo: re-read a file before editing and never revert changes you did not make.'],
  },
  {
    id: 'ci-pipeline',
    title: 'The CI pipeline',
    category: 'quality',
    summary: 'Every push is checked before anything reaches the server.',
    what:
      'Backend CI: ruff → mypy → pip-audit → Django check → missing-migration check → tests on PostgreSQL 16. Frontend CI: pnpm audit → typecheck → lint → unit tests → build. Deploy jobs run only after the checks pass, and only for dev and main.',
    why:
      'A broken commit stops in CI instead of taking the live site down.',
    where: ['market_neurons_backend/.github/workflows/deploy.yml', 'Market-Neurons-frontend/.github/workflows/deploy.yml', 'market-neurons-tasks: pnpm build verified on every push'],
    pitfalls: ['Run the same commands locally before pushing — CI is the safety net, not the first check.'],
  },
  {
    id: 'testing',
    title: 'Testing: unit, API and end-to-end',
    category: 'quality',
    summary: 'Many fast tests, a few slow ones that click through the real app.',
    what:
      'Backend: Django TestCase API tests per app (300+). Frontend unit tests: Vitest for pure helpers (sectorData.test.ts). End-to-end: Playwright drives a real browser through the sector page, sign-in and security headers (pnpm e2e).',
    why:
      'Tests are what let us refactor and upgrade without fear. The e2e tests catch what unit tests cannot: the pieces working together.',
    where: ['<app>/tests/test_*.py', 'Market-Neurons-frontend/src/**/*.test.ts', 'Market-Neurons-frontend/e2e/'],
    code: `python manage.py test sectors      # backend, one app
pnpm test                          # frontend unit
E2E_USERNAME=… E2E_PASSWORD=… pnpm e2e`,
    pitfalls: ['Name tests as sentences describing behaviour.', 'Test the edge: empty lists, two related rows, expired tokens, another user\'s data.'],
  },
  {
    id: 'static-analysis',
    title: 'Linting & type checking',
    category: 'quality',
    summary: 'Machines catch whole classes of bugs before review.',
    what:
      'Backend: ruff (unused imports, undefined names, shadowing) and mypy with the Django and DRF plugins, gradual — annotated functions are checked in depth. Frontend: TypeScript strict mode (tsc --noEmit) and ESLint with Next, React Hooks and a11y rules.',
    why:
      'Typos, wrong field names and misuse of hooks are found in seconds instead of in production.',
    where: ['market_neurons_backend/pyproject.toml', 'Market-Neurons-frontend/eslint.config.mjs, tsconfig.json'],
    pitfalls: ['Avoid any and as unknown as — each one switches the checker off for that value.', 'type: ignore needs a comment saying why.'],
  },
  {
    id: 'deploy',
    title: 'Deploying & rolling back',
    category: 'quality',
    summary: 'Push to dev/main → CI → server pulls, installs, migrates, restarts.',
    what:
      'Backend: deploy.sh resets to the branch, installs requirements, migrates, collects static files and restarts the systemd service, checking it came up. Frontend: the server installs with the frozen lockfile, builds and restarts pm2. Tasks app: static export to out/.',
    why:
      'Repeatable deploys with no manual steps to forget.',
    where: ['market_neurons_backend/scripts/deploy.sh', 'market-neurons-tasks/DEPLOY.md'],
    pitfalls: [
      'Deploy the backend before a frontend that depends on its new behaviour.',
      'Before a deploy that needs new env vars, set them on the server first.',
      'To roll back, revert the commit and push; data migrations need their reverse functions for this to work.',
    ],
  },
]
