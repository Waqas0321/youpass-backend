# Flutter — Events & Favorites API

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`

APIs for **YouHome** — featured carousel, event list, filters (country + event type), and favorites (heart icon).

---

## Quick reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/events/types` | — | Filter chips (Parties, Concerts, Bar) |
| GET | `/events/featured` | Optional | Hero carousel + featured list |
| GET | `/events` | Optional | Paginated event list |
| GET | `/events/:id` | Optional | Event details |
| POST | `/events` | Bearer | Create event |
| PATCH | `/events/:id` | Bearer | Update event |
| DELETE | `/events/:id` | Bearer | Delete event |
| GET | `/home/initial-feed` | Optional | Home screen bundle |
| GET | `/users/me/favorites/events` | Bearer | User favorites list |
| POST | `/users/me/favorites/events/:eventId` | Bearer | Add favorite |
| DELETE | `/users/me/favorites/events/:eventId` | Bearer | Remove favorite |

Send **`Authorization: Bearer <access_token>`** when logged in so responses include **`is_favorite: true/false`**.

---

## Event types (filters)

**`GET /events/types`**

Used for filter chips: **Parties**, **Concerts**, **Bar**.

```json
{
  "success": true,
  "data": [
    { "id": "...", "slug": "parties", "name": "Parties", "icon": "🎉" },
    { "id": "...", "slug": "concerts", "name": "Concerts", "icon": "🎵" },
    { "id": "...", "slug": "bar", "name": "Bar", "icon": "🍸" }
  ]
}
```

Filter events with query param **`event_type=parties`** (use `slug`).

---

## Featured events (home screen)

**`GET /events/featured`**

Query params:

| Param | Example | Description |
|-------|---------|-------------|
| `country_code` | `CL` | Filter by country (Chile chip) |
| `event_type` | `concerts` | Filter by type slug |
| `limit` | `10` | Max events (default 10) |

```dart
final uri = Uri.parse('$apiBaseUrl/events/featured').replace(
  queryParameters: {
    'country_code': 'CL',
    if (selectedType != null) 'event_type': selectedType,
  },
);

final response = await http.get(uri, headers: authHeadersIfLoggedIn());
```

### Response

```json
{
  "success": true,
  "data": {
    "carousel": [
      {
        "id": "...",
        "title": "URBAN NIGHT LIVE",
        "date_time_display": "NOVEMBER 21, 2026 • 5:00 PM",
        "location_display": "BICENTENNIAL PARK, Santiago",
        "image_url": "https://...",
        "event_type": { "slug": "concerts", "name": "Concerts", "icon": "🎵" },
        "is_featured": true,
        "is_favorite": false
      }
    ],
    "events": [ "...same shape..." ]
  }
}
```

- **`carousel`** → top hero slider (use first items)
- **`events`** → "Featured events" list section

---

## List events

**`GET /events`**

| Param | Example | Description |
|-------|---------|-------------|
| `country_code` | `CL` | Country filter |
| `event_type` | `parties` | Type slug |
| `featured` | `true` | Featured only |
| `page` | `1` | Page number |
| `limit` | `20` | Page size |

```json
{
  "success": true,
  "data": {
    "events": [ { "id": "...", "title": "Caribe Night", "is_favorite": false } ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "total_pages": 1 }
  }
}
```

---

## Event object fields

| Field | Type | UI usage |
|-------|------|----------|
| `id` | string | Detail navigation |
| `title` | string | Event name |
| `description` | string? | Detail page |
| `starts_at` | ISO datetime | Sorting / logic |
| `starts_at_display` | string | "Saturday, January 31, 2026" |
| `starts_at_time` | string | "5:00 PM" |
| `date_time_display` | string | Carousel subtitle |
| `venue_name` | string | Venue |
| `city` | string | City |
| `country_code` | string | Country filter |
| `location_display` | string | "Club Océano, Viña del Mar" |
| `image_url` | string? | Card / carousel image |
| `event_type` | object | Filter chip type |
| `is_featured` | bool | Featured badge |
| `is_favorite` | bool | Heart icon state |
| `status` | string | `published`, `draft`, `cancelled` |

---

## See all events (non-featured + featured)

**`GET /events?country_code=CL`**

The home screen **"See all >"** link should call this endpoint. It returns **all published events** (featured and non-featured), paginated.

```dart
final uri = Uri.parse('$apiBaseUrl/events').replace(
  queryParameters: {
    'country_code': 'CL',
    'page': '1',
    'limit': '20',
    if (selectedType != null) 'event_type': selectedType,
  },
);
```

To show **only non-featured** events, filter client-side where `is_featured == false`, or omit featured items already shown on the home screen.

Optional: **`featured=false`** is not a query param — use full list and filter in UI, or show all events on the See all screen.

---

**`GET /events/:id`**

```dart
final response = await http.get(
  Uri.parse('$apiBaseUrl/events/$eventId'),
  headers: authHeadersIfLoggedIn(),
);
```

---

## Create / update / delete event

Protected — requires Bearer token (admin/producer use for now).

### Create — `POST /events`

```json
{
  "title": "Caribe Night",
  "description": "Caribbean party by the sea",
  "starts_at": "2026-07-31T21:00:00.000Z",
  "venue_name": "Club Océano",
  "city": "Viña del Mar",
  "country_code": "CL",
  "image_url": "https://example.com/image.jpg",
  "event_type": "parties",
  "is_featured": true,
  "featured_order": 2,
  "status": "published"
}
```

### Update — `PATCH /events/:id`

Send only fields to change.

### Delete — `DELETE /events/:id`

```json
{ "success": true, "data": { "message": "Event deleted successfully" } }
```

---

## Favorites (heart icon)

### List favorites

**`GET /users/me/favorites/events`**

```dart
final response = await http.get(
  Uri.parse('$apiBaseUrl/users/me/favorites/events'),
  headers: authHeaders(token),
);
```

Returns array of events with **`is_favorite: true`**.

### Add favorite

**`POST /users/me/favorites/events/:eventId`**

No request body. **Do not** send `Content-Type: application/json` with an empty body — use headers only:

```dart
await http.post(
  Uri.parse('$apiBaseUrl/users/me/favorites/events/$eventId'),
  headers: authHeaders(token), // Authorization only — no Content-Type if no body
);
```

Tap heart → call this when **`is_favorite` is false**.

### Remove favorite

**`DELETE /users/me/favorites/events/:eventId`**

```dart
await http.delete(
  Uri.parse('$apiBaseUrl/users/me/favorites/events/$eventId'),
  headers: authHeaders(token),
);
```

Tap heart again → call when **`is_favorite` is true**.

---

## Home initial feed (all-in-one)

**`GET /home/initial-feed?country_code=CL`**

Optional Bearer token.

```json
{
  "success": true,
  "data": {
    "event_types": [ { "slug": "parties", "name": "Parties", "icon": "🎉" } ],
    "carousel": [ "...featured events..." ],
    "featured_events": [ "...featured events..." ],
    "greeting": { "full_name": "Waqas Akhtar" }
  }
}
```

Use on app launch to populate filters + carousel + featured list in one call.

---

## Flutter UI mapping

| UI element | API |
|------------|-----|
| Chile location chip | `country_code=CL` on featured/list |
| Parties / Concerts chips | `event_type=parties` or `concerts` |
| Hero carousel | `GET /events/featured` → `carousel` |
| Featured events list | `GET /events/featured` → `events` |
| Heart icon | `POST` or `DELETE` favorites |
| BUY TICKETS | Navigate to `GET /events/:id` (tickets API later) |

---

## Error codes

| Code | When |
|------|------|
| `EVENT_NOT_FOUND` | Invalid event id |
| `FAVORITE_NOT_FOUND` | Remove favorite when not favorited |
| `INVALID_EVENT_TYPE` | Bad `event_type` slug |
| `INVALID_COUNTRY` | Bad `country_code` |
| `SESSION_INVALID` | Expired token on protected route |

---

## Related docs

- [FLUTTER_IMPLEMENTATION.md](./FLUTTER_IMPLEMENTATION.md) — Auth & profile
- [FLUTTER_SESSION_TOKEN_FIX.md](./FLUTTER_SESSION_TOKEN_FIX.md) — Token handling
