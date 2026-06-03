# Flutter — Fix `SESSION_INVALID` (Token / Auth Guide)

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`

> **Backend fix (June 2026):** A MongoDB/Prisma bug caused valid sessions to fail auth (`revokedAt: null` query). This is fixed in production. If you still see `SESSION_INVALID` after redeploy, follow the Flutter checks below.

This guide explains how to fix **`SESSION_INVALID`** and **`401 Unauthorized`** errors on protected APIs such as:

- `GET /users/me`
- `PATCH /users/me/profile`
- `POST /users/me/profile-photo`
- `POST /auth/logout`

---

## What the error means

| Error | Meaning |
|-------|---------|
| `UNAUTHORIZED` | No `Authorization` header, or missing `Bearer` token |
| `SESSION_INVALID` — *Invalid or expired session* | Token is malformed or JWT signature failed |
| `SESSION_INVALID` — *Session is no longer valid* | JWT is valid, but the token does **not** match an active session in the database |

The most common Flutter issue is the third case: the app sends an **old, wrong, or badly saved** token after login.

**This is a frontend fix** — login/register already return a valid `access_token` from the backend.

---

## Golden rules

1. Save **`data.access_token`** from login/register — **not** `session_id`
2. **Trim** the token before saving and before sending
3. Store token **without** the `"Bearer "` prefix
4. After login, use the **new token immediately** — do not read stale storage first
5. Every protected request must send: `Authorization: Bearer <access_token>`
6. Multipart uploads (profile photo) **still require** the Bearer header
7. On `SESSION_INVALID`, clear storage and send the user to login

---

## Step 1 — Save token after login/register

```dart
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const secureStorage = FlutterSecureStorage();
const apiBaseUrl = 'https://youpass-backend.vercel.app/api/v1';

Future<String> saveSessionFromResponse(Map<String, dynamic> json) async {
  if (json['success'] != true) {
    throw ApiException.fromJson(json['error'] as Map<String, dynamic>);
  }

  final data = json['data'] as Map<String, dynamic>;
  final token = (data['access_token'] as String).trim();

  if (token.isEmpty) {
    throw Exception('access_token missing in login/register response');
  }

  await secureStorage.write(key: 'access_token', value: token);
  return token;
}
```

### Login example

```dart
Future<String> login({
  required String phone,
  required String countryCode,
  required String code,
}) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'phone': phone,
      'country_code': countryCode,
      'code': code,
    }),
  );

  final json = jsonDecode(response.body) as Map<String, dynamic>;
  return saveSessionFromResponse(json); // returns token for immediate use
}
```

### Register example

```dart
Future<String> register(/* ...fields... */) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/auth/register'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({/* register body */}),
  );

  final json = jsonDecode(response.body) as Map<String, dynamic>;
  return saveSessionFromResponse(json);
}
```

---

## Step 2 — Auth headers helper

Use one helper everywhere. Do not duplicate header logic across screens.

```dart
Map<String, String> authHeaders(String token) {
  final clean = token.trim();
  return {
    'Authorization': 'Bearer $clean',
    'Content-Type': 'application/json',
  };
}
```

**Wrong:**

```dart
// Stored "Bearer eyJ..." and sent again → "Bearer Bearer eyJ..."
await storage.write(key: 'access_token', value: 'Bearer $token');

// Used session_id instead of access_token
final token = data['session_id'];
```

**Correct:**

```dart
await storage.write(key: 'access_token', value: token.trim());
// Header: Authorization: Bearer eyJ...
```

---

## Step 3 — Central API client (recommended)

```dart
class ApiClient {
  Future<String?> getToken() async {
    final token = await secureStorage.read(key: 'access_token');
    return token?.trim();
  }

  Future<Map<String, dynamic>> decodeResponse(http.Response response) async {
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    if (json['success'] != true) {
      final error = ApiException.fromJson(json['error'] as Map<String, dynamic>);
      if (error.code == 'SESSION_INVALID' || error.code == 'UNAUTHORIZED') {
        await secureStorage.delete(key: 'access_token');
      }
      throw error;
    }
    return json;
  }

  Future<http.Response> get(
    String path, {
    String? tokenOverride,
  }) async {
    final token = tokenOverride ?? await getToken();
    if (token == null || token.isEmpty) throw SessionExpiredException();

    return http.get(
      Uri.parse('$apiBaseUrl$path'),
      headers: authHeaders(token),
    );
  }

  Future<http.Response> patchJson(
    String path,
    Map<String, dynamic> body, {
    String? tokenOverride,
  }) async {
    final token = tokenOverride ?? await getToken();
    if (token == null || token.isEmpty) throw SessionExpiredException();

    return http.patch(
      Uri.parse('$apiBaseUrl$path'),
      headers: authHeaders(token),
      body: jsonEncode(body),
    );
  }
}
```

---

## Step 4 — Get profile

```dart
Future<UserProfile> getProfile({String? tokenOverride}) async {
  final client = ApiClient();
  final response = await client.get('/users/me', tokenOverride: tokenOverride);
  final json = await client.decodeResponse(response);
  return UserProfile.fromJson(json['data'] as Map<String, dynamic>);
}
```

### Call right after login

```dart
final token = await login(phone: phone, countryCode: 'PK', code: otp);

// Use token from login directly — avoids race with secure storage
final profile = await getProfile(tokenOverride: token);

// Then navigate to home
```

---

## Step 5 — Upload profile photo (multipart)

Profile photo upload **must** include the Bearer token.  
**Do not** set `Content-Type: application/json` on multipart requests.

```dart
import 'dart:io';
import 'package:http/http.dart' as http;

Future<UserProfile> uploadProfilePhoto(
  File file, {
  String? tokenOverride,
}) async {
  final token = tokenOverride ?? await ApiClient().getToken();
  if (token == null || token.isEmpty) throw SessionExpiredException();

  final request = http.MultipartRequest(
    'POST',
    Uri.parse('$apiBaseUrl/users/me/profile-photo'),
  );

  request.headers['Authorization'] = 'Bearer ${token.trim()}';

  request.files.add(
    await http.MultipartFile.fromPath('photo', file.path),
  );

  final streamed = await request.send();
  final response = await http.Response.fromStream(streamed);
  final json = jsonDecode(response.body) as Map<String, dynamic>;

  if (json['success'] != true) {
    final error = ApiException.fromJson(json['error'] as Map<String, dynamic>);
    if (error.code == 'SESSION_INVALID' || error.code == 'UNAUTHORIZED') {
      await secureStorage.delete(key: 'access_token');
    }
    throw error;
  }

  return UserProfile.fromJson(json['data'] as Map<String, dynamic>);
}
```

---

## Step 6 — Correct login → profile → photo flow

```
User enters OTP
       ↓
POST /auth/login  or  POST /auth/register
       ↓
Read data.access_token (trim)
       ↓
Save to flutter_secure_storage
       ↓
Use same token variable for next calls
       ↓
GET /users/me  OR  POST /users/me/profile-photo
       ↓
Navigate to home / profile screen
```

### Wrong flows (cause SESSION_INVALID)

```
Login success → read old token from storage → API call ❌
Login success → call profile before saving token ❌
Save session_id instead of access_token ❌
Hot restart → use cached token without fresh login ❌
```

---

## Step 7 — Logout (always clear locally)

Even if the API returns `401` or `500`, clear the token on the device.

```dart
Future<void> logout() async {
  try {
    final token = await secureStorage.read(key: 'access_token');
    if (token != null && token.trim().isNotEmpty) {
      await http.post(
        Uri.parse('$apiBaseUrl/auth/logout'),
        headers: authHeaders(token.trim()),
      );
    }
  } catch (_) {
    // Ignore network/server errors
  } finally {
    await secureStorage.delete(key: 'access_token');
    // Navigate to login screen
  }
}
```

---

## Step 8 — Handle session errors globally

```dart
class ApiException implements Exception {
  final String code;
  final String message;

  ApiException({required this.code, required this.message});

  factory ApiException.fromJson(Map<String, dynamic> json) {
    return ApiException(
      code: json['code'] as String,
      message: json['message'] as String,
    );
  }
}

class SessionExpiredException implements Exception {}

void handleAuthError(ApiException error, VoidCallback goToLogin) {
  if (error.code == 'SESSION_INVALID' || error.code == 'UNAUTHORIZED') {
    secureStorage.delete(key: 'access_token');
    goToLogin();
  }
}
```

---

## Step 9 — Debug checklist

Add temporary logs after login and before profile request:

```dart
debugPrint('Login token prefix: ${token.substring(0, 20)}...');
debugPrint('Request token prefix: ${token.substring(0, 20)}...');
```

Both prefixes **must match** on the same session.

| Check | Expected |
|-------|----------|
| Field saved | `data['access_token']` |
| Not saved | `data['session_id']` |
| Storage value | Raw JWT only, no `Bearer ` prefix |
| Header | `Authorization: Bearer <token>` |
| After login | Use returned token before re-reading storage |
| Multipart | `Authorization` header still set |
| On SESSION_INVALID | Clear token + go to login |

---

## Packages

```yaml
dependencies:
  http: ^1.2.2
  flutter_secure_storage: ^9.2.2
  image_picker: ^1.1.2
  http_parser: ^4.0.2
```

---

## Flutter team checklist

- [ ] Save `access_token` after login/register with `.trim()`
- [ ] Never use `session_id` as Bearer token
- [ ] Single `authHeaders()` helper used by all API calls
- [ ] Pass fresh login token to first profile/photo call via `tokenOverride`
- [ ] Multipart photo upload includes `Authorization` header
- [ ] Clear token on `SESSION_INVALID` / `UNAUTHORIZED`
- [ ] Logout clears local token even if API fails
- [ ] Debug: login token prefix matches request token prefix

---

## Related docs

- [FLUTTER_IMPLEMENTATION.md](./FLUTTER_IMPLEMENTATION.md) — Full auth, profile, photo, logout APIs
- [CLOUDINARY_PROFILE_PHOTO.md](./CLOUDINARY_PROFILE_PHOTO.md) — Backend Cloudinary setup
