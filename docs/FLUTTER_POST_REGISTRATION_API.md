# Flutter — Post-Registration & YouHome Flow

**Base URL:** `https://youpass-backend.vercel.app/api/v1`

This doc defines the **inviolable rule** after registration: **CREATE ACCOUNT → Welcome (2s) → YouHome directly**. No hamburger menu, no My Profile, no onboarding, no permission prompts.

**Related:** `FLUTTER_AUTH_REGISTRATION_API.md`, `FLUTTER_PRODUCT_API.md`, `FLUTTER_LATAM_API.md`

---

## 1. The rule (non-negotiable)

```
User taps CREATE ACCOUNT
  → POST /auth/register
  → Store token + show Welcome screen (2 seconds)
  → GET /home/initial-feed?context=post_register
  → YouHome (events, greeting, Party Mode banner OFF)
```

### What NEVER happens after register

| Forbidden | Flutter must NOT |
|-----------|-------------------|
| Open hamburger menu | Auto-open drawer |
| Navigate to My Profile | Route to `/profile` |
| Onboarding carousel | Show tutorial screens |
| Permission prompts | Request camera/notifications yet |
| Profile photo / Instagram | Collect optional fields now |

Optional profile data is handled **later** via the “Complete your Profile” banner in My Profile (when the user opens it themselves).

Load rules on startup from **`GET /config/auth`** → `post_registration` block.

---

## 2. Bootstrap — post-registration policy

```dart
final config = await dio.get('/config/auth');
final postReg = config.data['data']['post_registration'];
```

```json
{
  "navigate_to": "you_home",
  "show_welcome_screen": true,
  "welcome_duration_seconds": 2,
  "open_hamburger_menu": false,
  "open_profile": false,
  "show_onboarding": false,
  "request_permissions": false,
  "show_party_mode_banner": false,
  "profile_completion_later": true,
  "preload_endpoint": "/home/initial-feed",
  "analytics_endpoint": "/analytics/event/registration-completed"
}
```

Use these flags — do not hardcode navigation behavior.

---

## 3. Step 1 — Register

```http
POST /auth/register
X-Device-Id: <stable-uuid>
Authorization: (none)

{
  "phone": "912345678",
  "country_code": "CL",
  "code": "123456",
  "full_name": "Jane Doe",
  "rut_or_passport": "12345678-9",
  "email": "jane@example.com",
  "birthdate": "1990-05-15",
  "gender": "female",
  "accept_terms": true
}
```

### Success response (navigation-critical fields)

```json
{
  "access_token": "eyJ...",
  "session_id": "...",
  "expires_at": null,
  "session_indefinite": true,
  "is_new_user": true,
  "user": {
    "id": "...",
    "fullName": "Jane Doe",
    "category": "bronze"
  },
  "linked_invitations": 0,
  "welcome": {
    "title": "Welcome to YouPass, Jane!",
    "subtitle": "Your access to the best events starts here",
    "duration_seconds": 2,
    "user_name": "Jane"
  },
  "navigation": {
    "flow": "welcome_then_home",
    "navigate_to": "you_home",
    "show_welcome_screen": true,
    "welcome_duration_seconds": 2,
    "open_hamburger_menu": false,
    "open_profile": false,
    "show_onboarding": false,
    "request_permissions": false,
    "show_party_mode_banner": false,
    "forbidden_routes": ["profile", "hamburger_menu", "onboarding", "permissions_prompt"],
    "highlight_pending_invitation": false,
    "linked_invitations_count": 0,
    "preload_endpoint": "/home/initial-feed"
  }
}
```

**Backend side effects on register:**
- Creates user in DB
- Sets `category: "bronze"`
- Sets `preferred_language` from country if omitted
- Creates JWT session (indefinite until logout)
- Links pending guest invitations by phone (`linked_invitations` count)

### Flutter immediately after success

1. Save `access_token` to secure storage
2. Set `Authorization: Bearer` on Dio
3. **Preload** home feed in parallel (see step 3)
4. Show **Welcome** screen using `welcome.title` / `welcome.subtitle` for **exactly** `welcome.duration_seconds` (2s)
5. Navigate to **YouHome** — not Profile, not drawer

---

## 4. Step 2 — Welcome screen (2 seconds)

Optional dedicated endpoint if you need to refresh copy:

```http
GET /users/me/welcome-data
Authorization: Bearer <token>
```

Returns same shape as `welcome` in register response.

**UI:** Fade in/out overlay. Example copy from API:
- Title: `Welcome to YouPass, Jane!`
- Subtitle: `Your access to the best events starts here`

While showing Welcome, **preload** home data so YouHome appears in <3s total.

---

## 5. Step 3 — YouHome initial feed

```http
GET /home/initial-feed?context=post_register
Authorization: Bearer <token>
```

`country_code` query is optional — defaults to the user's `country_code` from JWT profile.

### Response

```json
{
  "country_code": "CL",
  "event_types": [...],
  "categories": [...],
  "carousel": [...],
  "featured_events": [...],
  "greeting": {
    "first_name": "Jane",
    "full_name": "Jane Doe",
    "message": "Hi, Jane!",
    "category": "bronze"
  },
  "party_mode": {
    "enabled": false,
    "banner_visible": false
  },
  "post_registration": true,
  "invitations": {
    "highlight": false,
    "pending_count": 0,
    "featured": null
  }
}
```

### YouHome UI rules

| Element | Source | Rule |
|---------|--------|------|
| Personalized greeting | `greeting.message` | Show on Home header |
| Featured events | `featured_events` | Primary content — immediate value |
| Browse chips | `categories` | From API |
| Party Mode banner | `party_mode.banner_visible` | **OFF** after registration (`false`) |
| Hamburger | — | Closed by default |
| Profile tab | — | Do not auto-navigate |

---

## 6. Special cases

### From invitation (`linked_invitations > 0`)

Register response:

```json
{
  "linked_invitations": 2,
  "navigation": {
    "flow": "welcome_then_home_with_invitation",
    "highlight_pending_invitation": true,
    "linked_invitations_count": 2
  }
}
```

Home feed:

```json
{
  "invitations": {
    "highlight": true,
    "pending_count": 2,
    "featured": {
      "id": "...",
      "event_title": "...",
      "status": "pending"
    }
  }
}
```

Flutter: after Welcome → YouHome with a **highlighted pending invitation card** (not redirect to Profile).

### From shared event link

Flutter handles deep link locally:
1. Complete registration → Welcome → YouHome (1s flash)
2. Then navigate to the shared event detail

Pass context to analytics (below).

### Returning session (indefinite)

If valid token exists on app open → **straight to YouHome**, no re-login, no Welcome screen.

```dart
if (hasValidToken) {
  goToYouHome();
} else {
  goToWelcomeBack();
}
```

---

## 7. Analytics — registration completed

Fire **after** user lands on YouHome (or when Welcome ends), not before token is stored.

```http
POST /analytics/event/registration-completed
Authorization: Bearer <token>

{
  "source": "organic",
  "time_to_home_ms": 2400,
  "client_timestamp": "2026-06-03T12:00:00.000Z"
}
```

Optional fields:

| Field | When |
|-------|------|
| `source` | `"organic"` \| `"invitation"` \| `"shared_link"` |
| `invitation_id` | User registered from invitation flow |
| `shared_event_id` | User arrived via shared event link |
| `time_to_home_ms` | Tap CREATE ACCOUNT → Home visible (target **<3000**) |

---

## 8. WhatsApp OTP templates (backend)

OTP messages are sent via WhatsApp Business with **purpose-specific** copy (es / pt / en by country):

| Meta template | Purpose |
|---------------|---------|
| `AUTH_LOGIN` | Sign in |
| `AUTH_REGISTER` | Create account |
| `AUTH_PHONE_CHANGE` | Change phone |
| `AUTH_DELETE_ACCOUNT` | Delete account |

Template metadata is exposed at `GET /config/auth` → `whatsapp.templates`.  
Flutter does **not** send these messages — only displays OTP input UI.

---

## 9. Optional profile data (later)

| Field | When collected |
|-------|----------------|
| Profile photo | After register via `POST /users/me/profile-photo` when user opens Profile |
| Instagram | `PATCH /users/me` or registration optional field |

Show “Complete your Profile” banner only in **My Profile** when user navigates there voluntarily (`GET /users/me/profile-completeness`).

---

## 10. Flutter navigation pseudocode

```dart
Future<void> onCreateAccountSuccess(RegisterResponse res) async {
  await secureStorage.write(token: res.accessToken);
  dio.options.headers['Authorization'] = 'Bearer ${res.accessToken}';

  final homeFuture = dio.get(
    '/home/initial-feed',
    queryParameters: {'context': 'post_register'},
  );

  await showWelcomeScreen(
    title: res.welcome.title,
    subtitle: res.welcome.subtitle,
    duration: Duration(seconds: res.welcome.durationSeconds),
  );

  final home = await homeFuture;
  final nav = res.navigation;

  assert(nav.openProfile == false);
  assert(nav.openHamburgerMenu == false);

  if (nav.highlightPendingInvitation) {
    goToYouHome(home.data, highlightInvitation: true);
  } else {
    goToYouHome(home.data);
  }

  await dio.post('/analytics/event/registration-completed', data: {
    'source': deepLinkSource,
    'time_to_home_ms': stopwatch.elapsedMilliseconds,
  });
}
```

---

## 11. Metrics targets

| Metric | Target |
|--------|--------|
| CREATE ACCOUNT → Home visible | **< 3 seconds** |
| Drop-off after registration | **< 5%** |
| First-session purchase rate | Track via checkout analytics |
| Events clicked on first Home visit | Track in Flutter analytics |
| Time on Home before first action | Track in Flutter analytics |

---

## 12. Checklist

```
[ ] GET /config/auth — read post_registration policy
[ ] POST /auth/register — persist token + read navigation block
[ ] Welcome screen 2s using API welcome.* copy
[ ] Preload GET /home/initial-feed?context=post_register during Welcome
[ ] YouHome: greeting, featured_events, party_mode.banner_visible = false
[ ] Do NOT open drawer, Profile, onboarding, or permissions
[ ] linked_invitations > 0 → highlight invitation on Home
[ ] POST /analytics/event/registration-completed with time_to_home_ms
[ ] Returning users with valid token → Home directly (no Welcome)
[ ] Optional photo/Instagram only from Profile later
```

---

*Last updated: June 2026*
