# Flutter — Multi-Country LATAM API Integration

**Base URL:** `https://youpass-backend.vercel.app/api/v1`  
**Deployed:** production (June 2026)

This doc lists **what to change in the Flutter app** after the LATAM backend update. Auth, VIP venue, and guest tickets use the **same endpoints** unless noted below.

---

## Summary — change or not?

| Area | Change required? |
|------|------------------|
| Auth OTP (`send-code`, `login`, `register`) | **No** — same APIs |
| VIP venue (lock, tables, checkout mock) | **No** — same APIs |
| Guest ticket assign / resend | **No** |
| Country picker / config | **Yes** — parse new fields |
| Home browse chips | **Yes** — use `/config/categories` |
| Currency display | **Yes** — from API, not hardcoded CLP |
| Payment gateway (Klap vs Stripe) | **Yes** — read from API; UI only when mock off |
| Event dates | **Recommended** — use `timezone` + display fields |
| Profile language | **Optional** — `preferred_language` |
| Portuguese UI (Brazil) | **Yes** — when `defaultLanguage` / `pt` |

---

## 1. New / updated endpoints

Add these to `lib/core/network/api_endpoints.dart`:

```dart
class ApiEndpoints {
  static const config = '/config';
  static const configCountries = '/config/countries';
  static const configCategories = '/config/categories';

  static const homeInitialFeed = '/home/initial-feed';
  static const events = '/events';
  static String eventDetail(String id) => '/events/$id';
  static String eventCheckout(String eventId) => '/events/$eventId/checkout';
  static String eventCheckoutConfirm(String eventId) =>
      '/events/$eventId/checkout/confirm';
}
```

### New endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/config` | — | Default country + all countries + languages |
| GET | `/config/categories` | — | Home browse chips (replace hardcoded Chile) |
| POST | `/events/:eventId/checkout/confirm` | Bearer | After Klap/Stripe payment (when mock off) |

### Updated responses (same path, richer body)

| Method | Path | What's new |
|--------|------|------------|
| GET | `/config/countries` | `phoneHint`, `defaultLanguage`, `defaultCurrency`, `timezone`, `paymentGateway` |
| GET | `/home/initial-feed` | `categories`, `country_code`; defaults to user country if logged in |
| GET | `/events/:id` | `timezone`, `purchase.payment_gateway`, `purchase.country_code` |
| GET | `/events/:id/ticket-types` | `currency` per offering (already present — use it) |
| POST | `/events/:id/checkout` | `gateway`, `currency`; may return `payment_pending` |
| GET | `/users/me` | `preferred_language` |
| POST | `/auth/register` | optional body field `preferred_language` |
| PATCH | `/users/me/profile` | optional `preferred_language` |

---

## 2. Country model — update parser

**File:** `lib/core/network/models/config_country_model.dart`

Backend returns **both** camelCase and snake_case. Pick one style in Dart (snake_case recommended to match other APIs):

```dart
class ConfigCountryModel {
  final String code;
  final String name;
  final String dialCode;
  final String flagEmoji;
  final String? phoneHint;
  final String defaultLanguage;
  final String defaultCurrency;
  final String timezone;
  final String paymentGateway; // "klap" | "stripe"
  final int currencyDecimals;
  final String currencySymbol;

  factory ConfigCountryModel.fromJson(Map<String, dynamic> json) {
    return ConfigCountryModel(
      code: json['code'] as String,
      name: json['name'] as String,
      dialCode: (json['dial_code'] ?? json['dialCode'] ?? '').toString(),
      flagEmoji: (json['flag_emoji'] ?? json['flagEmoji'] ?? '') as String,
      phoneHint: (json['phone_hint'] ?? json['phoneHint']) as String?,
      defaultLanguage:
          (json['default_language'] ?? json['defaultLanguage'] ?? 'es') as String,
      defaultCurrency:
          (json['default_currency'] ?? json['defaultCurrency'] ?? 'CLP') as String,
      timezone: json['timezone'] as String? ?? 'UTC',
      paymentGateway:
          (json['payment_gateway'] ?? json['paymentGateway'] ?? 'stripe') as String,
      currencyDecimals:
          (json['currency_decimals'] ?? json['currencyDecimals'] ?? 0) as int,
      currencySymbol:
          (json['currency_symbol'] ?? json['currencySymbol'] ?? '\$') as String,
    );
  }
}
```

### Load countries (app start or login)

```dart
Future<List<ConfigCountryModel>> fetchCountries() async {
  final res = await dio.get('/config/countries');
  final list = res.data['data'] as List;
  return list.map((e) => ConfigCountryModel.fromJson(e)).toList();
}

// Or single call for bootstrap:
Future<AppConfigModel> fetchAppConfig() async {
  final res = await dio.get('/config');
  return AppConfigModel.fromJson(res.data['data']);
}
```

**Remove** hardcoded country → currency / language maps in Flutter. Use API values.

---

## 3. Home screen — categories & country filter

**Replace** hardcoded “Chile” chip with API categories.

```dart
Future<HomeInitialFeed> fetchHomeFeed({String? countryCode}) async {
  final res = await dio.get(
    '/home/initial-feed',
    queryParameters: {
      if (countryCode != null) 'country_code': countryCode,
      // also accepts: 'country': countryCode
    },
    options: Options(headers: authHeadersIfLoggedIn()),
  );
  return HomeInitialFeed.fromJson(res.data['data']);
}
```

Response shape:

```json
{
  "country_code": "CL",
  "categories": [
    { "id": "all", "label": "All" },
    { "id": "country:MX", "label": "México", "countryCode": "MX" },
    { "id": "parties", "label": "Parties", "eventTypeSlug": "parties" }
  ],
  "event_types": [ "..." ],
  "carousel": [ "..." ],
  "featured_events": [ "..." ]
}
```

**Chip tap logic:**

```dart
void onCategoryTap(CategoryModel cat) {
  if (cat.id == 'all') {
    loadEvents(countryCode: null);
  } else if (cat.id.startsWith('country:')) {
    loadEvents(countryCode: cat.countryCode);
  } else {
    loadEvents(eventType: cat.eventTypeSlug);
  }
}
```

**Tip:** If user is logged in, you can omit `country_code` — backend uses `users.country_code` automatically.

---

## 4. Event detail — currency & gateway

**File:** `lib/features/events/data/models/event_detail_model.dart`

Parse new fields:

```dart
class EventPurchaseMeta {
  final double serviceFeeRate;
  final String currency;
  final String paymentGateway; // "klap" | "stripe"
  final String countryCode;
  final bool hasTicketOfferings;
  final bool hasVenueLayout;

  factory EventPurchaseMeta.fromJson(Map<String, dynamic> json) {
    return EventPurchaseMeta(
      serviceFeeRate: (json['service_fee_rate'] as num?)?.toDouble() ?? 0.05,
      currency: json['currency'] as String? ?? 'CLP',
      paymentGateway: json['payment_gateway'] as String? ?? 'klap',
      countryCode: json['country_code'] as String? ?? 'CL',
      hasTicketOfferings: json['has_ticket_offerings'] as bool? ?? false,
      hasVenueLayout: json['has_venue_layout'] as bool? ?? false,
    );
  }
}
```

Event object now includes:

```json
{
  "country_code": "MX",
  "timezone": "America/Mexico_City",
  "starts_at": "2026-06-05T02:00:00.000Z",
  "starts_at_display": "4 de junio de 2026",
  "starts_at_time": "10:00 p.m.",
  "date_time_display": "4 jun 2026 · 10:00 p.m.",
  "purchase": {
    "currency": "MXN",
    "payment_gateway": "stripe",
    "country_code": "MX",
    "service_fee_rate": 0.05
  }
}
```

**Do not** hardcode CLP or Klap in UI — read from `purchase`.

---

## 5. Currency formatting

**Files:** `vip_venue_models.dart`, `event_checkout_models.dart`, price widgets

```dart
String formatMoney(int amountMinorUnits, ConfigCountryModel country) {
  final major = country.currencyDecimals == 0
      ? amountMinorUnits
      : amountMinorUnits / 100;
  final formatted = NumberFormat.currency(
    locale: _localeFor(country.defaultLanguage),
    symbol: country.currencySymbol,
    decimalDigits: country.currencyDecimals,
  ).format(major);
  return formatted;
}

String _localeFor(String lang) {
  switch (lang) {
    case 'pt': return 'pt_BR';
    case 'en': return 'en_US';
    default: return 'es_CL';
  }
}
```

Amounts from API are **integers in minor units** (CLP/COP/PYG: no decimals; MXN/BRL/ARS: treat as centavos if backend sends ×100 — match your existing parser with VIP doc).

---

## 6. Checkout — mock vs real payments

### Today (mock on — no Flutter payment UI needed)

Same call as before:

```dart
await dio.post(
  '/events/$eventId/checkout',
  data: {
    'offering_id': 'general',
    'quantity': 2,
    // payment_method_id NOT required when backend CHECKOUT_MOCK_PAYMENT=true
  },
);
```

Response includes **`gateway`** and **`currency`** (new fields):

```json
{
  "order_id": "...",
  "status": "paid",
  "gateway": "klap",
  "currency": "CLP",
  "total_amount": 73500,
  "ticket_id": "...",
  "qr_unlock_at": "...",
  "available_to_assign": 1
}
```

Update **`EventCheckoutResult`** model to parse `gateway` and `currency`.

### Later (mock off — add payment flow)

**Step 1** — checkout **without** `payment_method_id`:

```dart
final res = await dio.post('/events/$eventId/checkout', data: { ... });
final data = res.data['data'];

if (data['status'] == 'payment_pending') {
  final gateway = data['gateway'] as String;
  if (gateway == 'klap') {
    final url = data['payment_url'] as String;
    // open WebView → Klap
  } else {
    final secret = data['stripe']['client_secret'] as String;
    // Stripe SDK: presentPaymentSheet(clientSecret: secret)
  }
  return;
}
```

**Step 2** — after payment success, confirm (optional if webhooks handle it):

```dart
await dio.post(
  '/events/$eventId/checkout/confirm',
  data: {'order_id': data['order_id']},
);
```

**Rule:** Never choose Klap vs Stripe in Flutter — always use `data['gateway']` or `purchase.payment_gateway`.

---

## 7. Locale & language

### On country select (before login)

```dart
final country = countries.firstWhere((c) => c.code == selectedCode);
context.read<LocaleCubit>().setLocale(country.defaultLanguage);
// es → es, pt → pt, en → en
```

### After login

```dart
// GET /users/me
final preferredLanguage = profile['preferred_language'] ?? profile['country_code'];
// map country to language via cached ConfigCountryModel if preferred_language is null
```

### Register (optional)

```dart
await dio.post('/auth/register', data: {
  'phone': phone,
  'country_code': 'BR',
  'preferred_language': 'pt', // optional
  // ... rest unchanged
});
```

### Profile update (optional)

```dart
await dio.patch('/users/me/profile', data: {
  'preferred_language': 'pt',
});
```

---

## 8. Phone input

Use `phoneHint` from country config as placeholder:

```dart
TextField(
  decoration: InputDecoration(
    hintText: country.phoneHint ?? 'Phone number',
    prefixText: '+${country.dialCode} ',
  ),
);
```

Error codes from backend (handle in auth UI):

| Code | Meaning |
|------|---------|
| `PHONE_INVALID` | Bad format for country |
| `PHONE_UNSUPPORTED_COUNTRY` | Country not in `/config/countries` |

---

## 9. Auth — no endpoint changes

Keep existing integration:

| API | Body |
|-----|------|
| `POST /auth/send-code` | `phone`, `country_code`, `purpose` |
| `POST /auth/verify-code` | same + `code` |
| `POST /auth/login` | `phone`, `country_code`, `code` |
| `POST /auth/register` | same as today + optional `preferred_language` |

OTP language follows country (es/pt/en) — no client change needed.

---

## 10. VIP venue — no endpoint changes

Same as `docs/FLUTTER_VIP_VENUE_API.md`. Only update:

- Display prices using `currency` from ticket-types / table APIs
- Read `purchase.payment_gateway` on event detail before checkout

---

## 11. Migration checklist (Flutter team)

```
[ ] Add ApiEndpoints: /config, /config/categories, checkout/confirm
[ ] Update ConfigCountryModel with new fields
[ ] Remove hardcoded CLP / Chile-only maps
[ ] Home: load categories from API (or initial-feed)
[ ] Home: country filter via country_code query param
[ ] Event detail: parse purchase.payment_gateway + currency
[ ] Checkout model: add gateway, currency, payment_pending branch
[ ] Money formatter: use currencyDecimals + currencySymbol from country
[ ] Locale: es + pt (+ en) from defaultLanguage / preferred_language
[ ] Phone field: show phoneHint from config
[ ] (Later) Klap WebView + Stripe SDK when mock payments disabled
```

---

## 12. Quick test calls

```bash
# Countries
curl -s https://youpass-backend.vercel.app/api/v1/config/countries | jq '.data[0]'

# Categories
curl -s https://youpass-backend.vercel.app/api/v1/config/categories | jq

# Home (Mexico)
curl -s "https://youpass-backend.vercel.app/api/v1/home/initial-feed?country_code=MX" | jq '.data.country_code'

# Event detail purchase meta
curl -s https://youpass-backend.vercel.app/api/v1/events/EVENT_ID | jq '.data.purchase'
```

---

## Related docs

| Doc | Topic |
|-----|--------|
| `FLUTTER_EVENTS_API.md` | Events list, featured, favorites |
| `FLUTTER_VIP_VENUE_API.md` | VIP tables, lock, checkout |
| `FLUTTER_GUEST_TICKETS_API.md` | Assign / resend invitations |
| `LATAM_MULTI_COUNTRY_API.md` | Backend reference |

---

*Last updated: June 2026 — production `youpass-backend.vercel.app`*
