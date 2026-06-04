# Flutter — YouPass API Implementation Guide

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`  
**Last updated:** June 2026

This guide is for the **Flutter mobile app** integrating YouPass authentication (Twilio WhatsApp OTP, 6 digits), profile, and profile photo upload (Cloudinary).

---

## Quick reference — all endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/send-code` | — | Send OTP |
| POST | `/auth/resend-code` | — | Resend OTP |
| POST | `/auth/verify-code` | — | Verify OTP only |
| POST | `/auth/login` | — | Login → `access_token` |
| POST | `/auth/register` | — | Register → `access_token` |
| POST | `/auth/logout` | Bearer | Logout |
| GET | `/users/me` | Bearer | Get profile |
| GET | `/users/me/profile` | Bearer | Get profile (alias) |
| PATCH | `/users/me/profile` | Bearer | Update profile fields |
| POST | `/users/me/profile-photo` | Bearer | Upload photo (multipart `photo`) |
| GET | `/users/me/profile-completeness` | Bearer | Profile completion % |
| GET | `/users/me/welcome-data` | Bearer | Welcome screen data |
| GET | `/config/countries` | — | Country list (includes PK) |
| GET | `/health` | — | API health check |
| GET | `/events/types` | — | Event type filters |
| GET | `/events/featured` | Optional | Featured carousel + list |
| GET | `/events` | Optional | Event list (paginated) |
| GET | `/events/:id` | Optional | Event detail |
| POST | `/events` | Bearer | Create event |
| PATCH | `/events/:id` | Bearer | Update event |
| DELETE | `/events/:id` | Bearer | Delete event |
| GET | `/home/initial-feed` | Optional | Home screen bundle |
| GET | `/users/me/favorites/events` | Bearer | Favorite events |
| POST | `/users/me/favorites/events/:eventId` | Bearer | Add favorite |
| DELETE | `/users/me/favorites/events/:eventId` | Bearer | Remove favorite |
| GET | `/invitations` | Bearer | My invitations list |
| GET | `/invitations/:id` | Bearer | Invitation detail |
| POST | `/invitations/:id/confirm` | Bearer | Confirm invitation |
| POST | `/invitations/:id/reject` | Bearer | Reject invitation |
| GET | `/invitations/:id/ticket` | Bearer | QR ticket |
| GET | `/users/me/tickets/upcoming` | Bearer | My Tickets — upcoming |
| GET | `/users/me/tickets/past` | Bearer | My Tickets — past |
| GET | `/users/me/tickets/yearly-summary` | Bearer | Past tab yearly summary |
| GET | `/users/me/tickets/:id` | Bearer | Ticket detail |
| GET | `/users/me/tickets/:id/qr` | Bearer | View QR (same as invitation ticket) |
| GET | `/users/me/invitations/summary` | Bearer | Drawer badge count |
| POST | `/users/me/payment-methods` | Bearer | Save payment method |

---

## Important — auth token rules

1. After login/register, save **`data.access_token`** (not `session_id`).
2. Send **`Authorization: Bearer <access_token>`** on every protected route.
3. Use the token from login **immediately** for the first profile/photo call (avoid stale storage race).
4. Multipart photo upload **still requires** the Bearer header.
5. On `SESSION_INVALID`, clear token and go to login.

> **Backend note:** A MongoDB session lookup bug caused false `SESSION_INVALID` errors — fixed in production. If issues persist, see [FLUTTER_SESSION_TOKEN_FIX.md](./FLUTTER_SESSION_TOKEN_FIX.md).

---

## Configuration

```dart
const String apiBaseUrl = 'https://youpass-backend.vercel.app/api/v1';
```

All requests: `Content-Type: application/json`

Success envelope:

```json
{ "success": true, "data": { ... } }
```

Error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable English message",
    "details": { }
  }
}
```

---

## OTP rules

| Rule | Value |
|------|-------|
| Code length | **6 digits** (numeric only) |
| Expiry | 3 minutes |
| Delivery | **WhatsApp** by default (`channel: "whatsapp"`) |
| Resend cooldown | 60 seconds |
| Max resends / hour | 5 |

Show a **6-digit PIN input** in Flutter. Validate: `RegExp(r'^\d{6}$')`.

---

## Auth flow overview

```
┌─────────────┐     send-code      ┌─────────────┐
│ Phone entry │ ─────────────────► │  OTP screen │
└─────────────┘                    └──────┬──────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
            purpose=register                            purpose=login
            account_exists=false                        account_exists=true
                    │                                           │
                    ▼                                           ▼
            Register screen                              Login (OTP only)
            + OTP + profile fields                              │
                    │                                           │
                    ▼                                           ▼
            POST /auth/register                          POST /auth/login
                    │                                           │
                    └─────────────────────┬─────────────────────┘
                                          ▼
                                   Save access_token
```

---

## 1. Send OTP

**`POST /auth/send-code`**

### Request

```dart
final body = {
  'phone': '3216548001',       // national number, no country prefix
  'country_code': 'PK',        // ISO code
  'purpose': 'register',       // register | login (use auth endpoints for change_phone / delete_account)
};
```

### Success response (register)

```json
{
  "success": true,
  "data": {
    "message": "Code sent via WhatsApp",
    "phone": "+923216548001",
    "purpose": "register",
    "channel": "whatsapp",
    "expires_in_seconds": 180,
    "resend_available_in_seconds": 60,
    "phone_display": "+92 321 6548001"
  }
}
```

### Success response (login → new user, auto-routed)

When user chooses **login** but has no account:

```json
{
  "success": true,
  "data": {
    "message": "Code sent via WhatsApp. Create your account to continue.",
    "phone": "+923216548001",
    "purpose": "register",
    "account_exists": false,
    "channel": "whatsapp",
    "expires_in_seconds": 180,
    "resend_available_in_seconds": 60,
    "phone_display": "+92 321 6548001"
  }
}
```

### Flutter handling

```dart
class SendCodeResult {
  final String phone;
  final String purpose;
  final String channel;
  final bool? accountExists;
  final int expiresInSeconds;
  final int resendAvailableInSeconds;

  factory SendCodeResult.fromJson(Map<String, dynamic> json) {
    return SendCodeResult(
      phone: json['phone'] as String,
      purpose: json['purpose'] as String,
      channel: json['channel'] as String,
      accountExists: json['account_exists'] as bool?,
      expiresInSeconds: json['expires_in_seconds'] as int,
      resendAvailableInSeconds: json['resend_available_in_seconds'] as int,
    );
  }
}

void onSendCodeSuccess(SendCodeResult result) {
  // Store for next steps
  authState.phone = result.phone;
  authState.purpose = result.purpose;
  authState.channel = result.channel;

  final isNewUser = result.accountExists == false || result.purpose == 'register';

  if (isNewUser) {
    navigator.push(RegisterOtpScreen()); // OTP + registration form
  } else {
    navigator.push(LoginOtpScreen());    // OTP only → /auth/login
  }

  // UI message from API
  showSnackBar(result.channel == 'whatsapp'
      ? 'Code sent to your WhatsApp'
      : 'Code sent via SMS');
}
```

---

## 2. Resend OTP

**`POST /auth/resend-code`**

Same body as send-code. Respect `resend_available_in_seconds` — disable resend button until cooldown ends.

Error `RESEND_COOLDOWN` (429):

```json
{
  "success": false,
  "error": {
    "code": "RESEND_COOLDOWN",
    "message": "Resend code in 45 second(s)",
    "details": { "retry_after_seconds": 45 }
  }
}
```

---

## 3. Register (new user)

**`POST /auth/register`**

Call after send-code when `purpose == "register"`.

### Request

```dart
final body = {
  'phone': '3216548001',
  'country_code': 'PK',
  'code': '123456',              // 6-digit OTP from WhatsApp
  'full_name': 'Waqas Akhtar',
  'rut_or_passport': '12345678-9',
  'email': 'user@email.com',
  'birthdate': '1995-06-15',     // YYYY-MM-DD
  'gender': 'male',              // male | female | other | prefer_not_to_say
  'instagram_username': 'handle', // optional
  'accept_terms': true,          // must be true
};
```

### Success

```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "phone": "+923216548001", ... },
    "access_token": "eyJ...",
    "session_id": "...",
    "expires_at": "...",
    "is_new_user": true,
    "welcome": {
      "title": "Welcome to YouPass, Waqas!",
      "subtitle": "Your access to the best events starts here",
      "duration_seconds": 2
    }
  }
}
```

Save `access_token` securely (e.g. `flutter_secure_storage`).

---

## 4. Login (existing user)

**`POST /auth/login`**

Call after send-code when `purpose == "login"` and `account_exists != false`.

### Request

```dart
final body = {
  'phone': '3216548001',
  'country_code': 'PK',
  'code': '123456',
};
```

### Success

Same shape as register but `is_new_user: false`, no `welcome` block required.

---

## 5. Verify OTP only (optional)

**`POST /auth/verify-code`**

Use only if you have a standalone verify step. **Do not** call this before login/register — the code is single-use.

```dart
final body = {
  'phone': '3216548001',
  'country_code': 'PK',
  'code': '123456',
  'purpose': 'register',  // must match send-code purpose
};
```

---

## 6. Authenticated requests

Header for protected routes:

```dart
headers: {
  'Authorization': 'Bearer $accessToken',
  'Content-Type': 'application/json',
}
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/logout` | Revoke current session |
| POST | `/users/me/logout` | Revoke current session (alias) |
| POST | `/auth/delete-account/request` | Send OTP to confirm account deletion |
| POST | `/auth/delete-account/verify` | Verify OTP and delete account |
| POST | `/users/me/delete-account/request` | Same as auth delete request |
| POST | `/users/me/delete-account/verify` | Same as auth delete verify |
| GET | `/users/me` | Current user profile |
| GET | `/users/me/profile` | Current user profile (alias) |
| PATCH | `/users/me/profile` | Update profile fields (JSON) |
| POST | `/users/me/profile-photo` | Upload profile photo (multipart `photo`) |
| GET | `/users/me/welcome-data` | Welcome screen data |
| GET | `/config/countries` | Supported countries (includes PK) |

---

## 7. Get current user profile

**`GET /users/me`** or **`GET /users/me/profile`**

Call after login/register when the app needs the logged-in user's data (settings screen, profile tab, etc.).

### Request

```dart
final response = await http.get(
  Uri.parse('$apiBaseUrl/users/me'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
);
```

### Success response

```json
{
  "success": true,
  "data": {
    "id": "665f1a2b3c4d5e6f7890abcd",
    "phone": "+923216548001",
    "phone_display": "+92 321 6548001",
    "country_code": "PK",
    "full_name": "Waqas Akhtar",
    "email": "user@email.com",
    "birthdate": "1995-06-15",
    "gender": "male",
    "rut_or_passport": "12345678-9",
    "instagram_username": null,
    "profile_photo_url": null,
    "category": "bronze",
    "account_status": "active",
    "created_at": "2026-06-01T12:00:00.000Z",
    "profile_completeness": {
      "has_photo": false,
      "has_instagram": false,
      "completion_percentage": 70,
      "missing_fields": ["profile_photo", "instagram_username"]
    }
  }
}
```

### Dart model

```dart
class UserProfile {
  final String id;
  final String phone;
  final String phoneDisplay;
  final String countryCode;
  final String fullName;
  final String email;
  final String birthdate;
  final String gender;
  final String rutOrPassport;
  final String? instagramUsername;
  final String? profilePhotoUrl;
  final String category;
  final String accountStatus;
  final DateTime createdAt;
  final ProfileCompleteness profileCompleteness;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String,
      phone: json['phone'] as String,
      phoneDisplay: json['phone_display'] as String,
      countryCode: json['country_code'] as String,
      fullName: json['full_name'] as String,
      email: json['email'] as String,
      birthdate: json['birthdate'] as String,
      gender: json['gender'] as String,
      rutOrPassport: json['rut_or_passport'] as String,
      instagramUsername: json['instagram_username'] as String?,
      profilePhotoUrl: json['profile_photo_url'] as String?,
      category: json['category'] as String,
      accountStatus: json['account_status'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      profileCompleteness: ProfileCompleteness.fromJson(
        json['profile_completeness'] as Map<String, dynamic>,
      ),
    );
  }
}

class ProfileCompleteness {
  final bool hasPhoto;
  final bool hasInstagram;
  final int completionPercentage;
  final List<String> missingFields;

  factory ProfileCompleteness.fromJson(Map<String, dynamic> json) {
    return ProfileCompleteness(
      hasPhoto: json['has_photo'] as bool,
      hasInstagram: json['has_instagram'] as bool,
      completionPercentage: json['completion_percentage'] as int,
      missingFields: (json['missing_fields'] as List).cast<String>(),
    );
  }
}
```

### Flutter service method

```dart
Future<UserProfile> getCurrentUserProfile() async {
  final token = await secureStorage.read(key: 'access_token');
  if (token == null) throw SessionExpiredException();

  final response = await http.get(
    Uri.parse('$apiBaseUrl/users/me'),
    headers: authHeaders(token),
  );
  final json = jsonDecode(response.body) as Map<String, dynamic>;
  if (json['success'] != true) {
    throw ApiException.fromJson(json['error'] as Map<String, dynamic>);
  }
  return UserProfile.fromJson(json['data'] as Map<String, dynamic>);
}
```

On `401` / `SESSION_INVALID`, clear stored token and navigate to login.

---

## 7.1 Upload profile photo

**`POST /users/me/profile-photo`**

Upload or replace the logged-in user's profile photo. The backend stores the image on **Cloudinary** and saves the CDN URL on the user record.

### Flutter packages

```yaml
dependencies:
  image_picker: ^1.1.2
  http: ^1.2.2
  http_parser: ^4.0.2
```

### Pick image (gallery or camera)

```dart
import 'dart:io';
import 'package:image_picker/image_picker.dart';

Future<File?> pickProfilePhoto(ImageSource source) async {
  final picker = ImagePicker();
  final picked = await picker.pickImage(
    source: source,
    maxWidth: 1200,
    maxHeight: 1200,
    imageQuality: 85,
  );
  if (picked == null) return null;
  return File(picked.path);
}
```

### Upload (multipart)

**Do not** set `Content-Type: application/json` for this request. Use `multipart/form-data` with field name **`photo`**.

```dart
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

Future<UserProfile> uploadProfilePhoto(File imageFile) async {
  final token = await secureStorage.read(key: 'access_token');
  if (token == null) throw SessionExpiredException();

  final request = http.MultipartRequest(
    'POST',
    Uri.parse('$apiBaseUrl/users/me/profile-photo'),
  );
  request.headers['Authorization'] = 'Bearer $token';

  final mime = _mimeFromPath(imageFile.path); // image/jpeg, image/png, etc.
  request.files.add(
    await http.MultipartFile.fromPath(
      'photo',
      imageFile.path,
      contentType: MediaType.parse(mime),
    ),
  );

  final streamed = await request.send();
  final response = await http.Response.fromStream(streamed);
  final json = jsonDecode(response.body) as Map<String, dynamic>;

  if (json['success'] != true) {
    throw ApiException.fromJson(json['error'] as Map<String, dynamic>);
  }

  return UserProfile.fromJson(json['data'] as Map<String, dynamic>);
}

String _mimeFromPath(String path) {
  final lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}
```

### Success response

Same shape as **`GET /users/me`**, with updated `profile_photo_url` and `profile_completeness`:

```json
{
  "success": true,
  "data": {
    "profile_photo_url": "https://res.cloudinary.com/your-cloud/image/upload/.../youpass/profile-photos/userId.jpg",
    "profile_completeness": {
      "has_photo": true,
      "completion_percentage": 85,
      "missing_fields": ["instagram_username"]
    }
  }
}
```

### Limits and errors

| Rule | Value |
|------|-------|
| Field name | `photo` |
| Max size | 5 MB |
| Formats | JPEG, PNG, WebP, HEIC |

| Code | When |
|------|------|
| `FILE_REQUIRED` | No file in request |
| `INVALID_FILE_TYPE` | Unsupported image type |
| `FILE_TOO_LARGE` | Over 5 MB |
| `CLOUDINARY_NOT_CONFIGURED` | Backend missing Cloudinary env vars |
| `UPLOAD_FAILED` | Cloudinary upload error |

### iOS / Android permissions

**iOS** — add to `ios/Runner/Info.plist`:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to choose your profile photo.</string>
<key>NSCameraUsageDescription</key>
<string>We need camera access to take your profile photo.</string>
```

**Android** — for Android 13+, `image_picker` handles photo permissions; for older versions you may need `READ_EXTERNAL_STORAGE` in `AndroidManifest.xml`.

---

## 7.2 Update profile fields

**`PATCH /users/me/profile`**

Update one or more profile fields. Send only the fields you want to change. Phone number uses a separate OTP flow (`/auth/change-phone/*`).

### Editable fields

| Field | Type | Notes |
|-------|------|-------|
| `full_name` | string | 2–200 chars |
| `email` | string | Valid email |
| `rut_or_passport` | string | 3–50 chars |
| `birthdate` | string | `YYYY-MM-DD`, user must be 18+ |
| `gender` | string | `male`, `female`, `other`, `prefer_not_to_say` |
| `instagram_username` | string \| null | Strips leading `@`; send `""` or `null` to remove |

### Request

```dart
Future<UserProfile> updateProfile({
  String? fullName,
  String? email,
  String? rutOrPassport,
  String? birthdate,
  String? gender,
  String? instagramUsername,
}) async {
  final token = await secureStorage.read(key: 'access_token');
  if (token == null) throw SessionExpiredException();

  final body = <String, dynamic>{};
  if (fullName != null) body['full_name'] = fullName;
  if (email != null) body['email'] = email;
  if (rutOrPassport != null) body['rut_or_passport'] = rutOrPassport;
  if (birthdate != null) body['birthdate'] = birthdate;
  if (gender != null) body['gender'] = gender;
  if (instagramUsername != null) body['instagram_username'] = instagramUsername;

  final response = await http.patch(
    Uri.parse('$apiBaseUrl/users/me/profile'),
    headers: authHeaders(token),
    body: jsonEncode(body),
  );

  final json = jsonDecode(response.body) as Map<String, dynamic>;
  if (json['success'] != true) {
    throw ApiException.fromJson(json['error'] as Map<String, dynamic>);
  }

  return UserProfile.fromJson(json['data'] as Map<String, dynamic>);
}
```

### Example — update name and Instagram

```json
PATCH /users/me/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "full_name": "Waqas Akhtar",
  "instagram_username": "waqas.dev"
}
```

### Success response

Same shape as **`GET /users/me`** (full updated profile).

### Errors

| Code | When |
|------|------|
| `VALIDATION_ERROR` | Invalid or empty body |
| `INVALID_BIRTHDATE` | Bad date format |
| `UNDERAGE` | User under 18 |
| `UNAUTHORIZED` | Missing token |
| `SESSION_INVALID` | Expired session |

### Profile update summary

| Action | Endpoint | Content-Type |
|--------|----------|--------------|
| Read profile | `GET /users/me` | — |
| Update text fields | `PATCH /users/me/profile` | `application/json` |
| Update photo | `POST /users/me/profile-photo` | `multipart/form-data` (`photo`) |

---

## 8. Logout

**`POST /auth/logout`** or **`POST /users/me/logout`**

Revokes the current session. Always clear local token after success (even if the request fails with network error, clear locally if user tapped logout).

### Request

```dart
Future<void> logout() async {
  final token = await secureStorage.read(key: 'access_token');
  if (token != null) {
    await http.post(
      Uri.parse('$apiBaseUrl/auth/logout'),
      headers: authHeaders(token),
    );
  }
  await secureStorage.delete(key: 'access_token');
  // Navigate to phone/login screen
}
```

### Success response

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## 9. Delete account

Two-step flow (OTP confirmation). **Do not** use `POST /auth/send-code` with `purpose: delete_account` — use the authenticated endpoints below.

```
Settings → Delete account
       │
       ▼
POST /auth/delete-account/request   (Bearer token)
       │
       ▼
User enters 6-digit OTP from WhatsApp/SMS
       │
       ▼
POST /auth/delete-account/verify    (Bearer token + code)
       │
       ▼
Clear token → navigate to welcome/login
```

### Step 1 — Request deletion OTP

**`POST /auth/delete-account/request`**

```dart
Future<void> requestAccountDeletion() async {
  final token = await secureStorage.read(key: 'access_token');
  final response = await http.post(
    Uri.parse('$apiBaseUrl/auth/delete-account/request'),
    headers: authHeaders(token!),
  );
  final json = jsonDecode(response.body) as Map<String, dynamic>;
  if (json['success'] != true) {
    throw ApiException.fromJson(json['error'] as Map<String, dynamic>);
  }
  // Show OTP input screen; message in json['data']['message']
}
```

Success:

```json
{
  "success": true,
  "data": {
    "message": "Account deletion code sent via WhatsApp",
    "phone": "+923216548001",
    "phone_display": "+92 321 6548001",
    "channel": "whatsapp",
    "expires_in_seconds": 180,
    "resend_available_in_seconds": 60
  }
}
```

### Step 2 — Confirm with OTP

**`POST /auth/delete-account/verify`**

```dart
Future<void> confirmAccountDeletion(String otpCode) async {
  final token = await secureStorage.read(key: 'access_token');
  final response = await http.post(
    Uri.parse('$apiBaseUrl/auth/delete-account/verify'),
    headers: authHeaders(token!),
    body: jsonEncode({'code': otpCode}),
  );
  final json = jsonDecode(response.body) as Map<String, dynamic>;
  if (json['success'] != true) {
    throw ApiException.fromJson(json['error'] as Map<String, dynamic>);
  }

  await secureStorage.delete(key: 'access_token');
  // Show success: json['data']['message']
  // Navigate to login / onboarding
}
```

Success:

```json
{
  "success": true,
  "data": {
    "message": "Your account has been deleted successfully",
    "deleted_at": "2026-06-02T05:30:00.000Z"
  }
}
```

After deletion, all sessions are invalid. The same phone can register again later as a new account.

---

## 10. Reusable API helper

```dart
Map<String, String> authHeaders(String token) => {
  'Authorization': 'Bearer $token',
  'Content-Type': 'application/json',
};

class ApiException implements Exception {
  final String code;
  final String message;
  final Map<String, dynamic>? details;

  ApiException({required this.code, required this.message, this.details});

  factory ApiException.fromJson(Map<String, dynamic> json) {
    return ApiException(
      code: json['code'] as String,
      message: json['message'] as String,
      details: json['details'] as Map<String, dynamic>?,
    );
  }
}

class SessionExpiredException implements Exception {}
```

Suggested `AuthRepository` methods:

| Method | Endpoint |
|--------|----------|
| `sendCode(...)` | `POST /auth/send-code` |
| `resendCode(...)` | `POST /auth/resend-code` |
| `register(...)` | `POST /auth/register` |
| `login(...)` | `POST /auth/login` |
| `getProfile()` | `GET /users/me` |
| `updateProfile(...)` | `PATCH /users/me/profile` |
| `uploadProfilePhoto(File)` | `POST /users/me/profile-photo` |
| `logout()` | `POST /auth/logout` |
| `requestDeleteAccount()` | `POST /auth/delete-account/request` |
| `confirmDeleteAccount(code)` | `POST /auth/delete-account/verify` |

---

## Error codes (show `error.message` in UI)

| Code | HTTP | When |
|------|------|------|
| `INVALID_CODE` | 400 | Wrong OTP or no active code |
| `CODE_EXPIRED` | 400 | OTP older than 3 min |
| `USER_EXISTS` | 409 | Register with existing phone |
| `USER_NOT_FOUND` | 404 | Login with unknown phone |
| `UNSUPPORTED_COUNTRY` | 400 | Country not in backend |
| `INVALID_PHONE` | 400 | Bad phone format |
| `RESEND_COOLDOWN` | 429 | Resend too soon |
| `BLOCKED` | 429 | Too many wrong attempts |
| `OTP_DELIVERY_FAILED` | 502 | Twilio failed (check backend config) |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Missing Bearer token |
| `SESSION_INVALID` | 401 | Expired or revoked token — logout locally |
| `FILE_REQUIRED` | 400 | Profile photo upload missing file |
| `INVALID_FILE_TYPE` | 400 | Not JPEG/PNG/WebP/HEIC |
| `FILE_TOO_LARGE` | 400 | Photo over 5 MB |
| `CLOUDINARY_NOT_CONFIGURED` | 503 | Set Cloudinary env on backend |
| `UPLOAD_FAILED` | 502 | Cloudinary upload failed |
| `INVALID_PURPOSE` | 400 | Used public send-code for delete/change-phone |

---

## Recommended Flutter auth state

```dart
class AuthFlowState {
  String? phone;
  String countryCode = 'PK';
  String purpose = 'register';   // from send-code response
  String channel = 'whatsapp';   // from send-code response
  bool? accountExists;
}
```

---

## Complete register example (Dart)

```dart
Future<void> registerFlow() async {
  // Step 1: Send OTP
  final sendRes = await http.post(
    Uri.parse('$apiBaseUrl/auth/send-code'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'phone': phoneController.text,
      'country_code': selectedCountry.code,
      'purpose': 'register',
    }),
  );
  final sendJson = jsonDecode(sendRes.body);
  if (sendJson['success'] != true) {
    throw ApiException.fromJson(sendJson['error']);
  }

  final data = sendJson['data'] as Map<String, dynamic>;
  final purpose = data['purpose'] as String;

  // Step 2: User enters 6-digit OTP + profile → Register
  final regRes = await http.post(
    Uri.parse('$apiBaseUrl/auth/register'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'phone': phoneController.text,
      'country_code': selectedCountry.code,
      'code': otpController.text,  // exactly 6 digits
      'full_name': nameController.text,
      'rut_or_passport': idController.text,
      'email': emailController.text,
      'birthdate': birthdateFormatted,
      'gender': selectedGender,
      'accept_terms': true,
    }),
  );
  final regJson = jsonDecode(regRes.body);
  if (regJson['success'] != true) {
    throw ApiException.fromJson(regJson['error']);
  }

  final token = regJson['data']['access_token'] as String;
  await secureStorage.write(key: 'access_token', value: token);
}
```

---

## Checklist for Flutter team

- [ ] Base URL: `https://youpass-backend.vercel.app/api/v1`
- [ ] 6-digit OTP input only
- [ ] Read `purpose` and `account_exists` from send-code response
- [ ] Route to **register** or **login** based on `purpose`
- [ ] Show WhatsApp message when `channel == "whatsapp"`
- [ ] Load countries from `GET /config/countries` (PK supported)
- [ ] Store `access_token` in secure storage after login/register (`.trim()`)
- [ ] Send `Authorization: Bearer` on protected routes
- [ ] Use fresh login token for first API call after auth (`tokenOverride`)
- [ ] Load profile with `GET /users/me` on app start if token exists
- [ ] Update profile with `PATCH /users/me/profile` (JSON)
- [ ] Upload photo with `POST /users/me/profile-photo` (multipart field `photo`)
- [ ] Logout via `POST /auth/logout` and clear local token (even if API fails)
- [ ] Delete account: request OTP → verify → clear token
- [ ] Handle `SESSION_INVALID` by redirecting to login
- [ ] Display English `error.message` from API

---

## Profile integration summary

| Action | Method | Content-Type | Field / body |
|--------|--------|--------------|--------------|
| Read profile | `GET /users/me` | — | — |
| Update name, email, Instagram, etc. | `PATCH /users/me/profile` | `application/json` | See §7.2 |
| Upload / change photo | `POST /users/me/profile-photo` | `multipart/form-data` | `photo` = image file |

**Packages for profile photo:**

```yaml
dependencies:
  image_picker: ^1.1.2
  http: ^1.2.2
  http_parser: ^4.0.2
  flutter_secure_storage: ^9.2.2
```

---

## Related docs

- [FLUTTER_EVENTS_API.md](./FLUTTER_EVENTS_API.md) — Events, featured, favorites (YouHome)
- [FLUTTER_INVITATIONS_API.md](./FLUTTER_INVITATIONS_API.md) — Invitations, confirm, QR, payment methods
- [FLUTTER_TICKETS_API.md](./FLUTTER_TICKETS_API.md) — My Tickets (upcoming, past, QR, yearly summary)
- [FLUTTER_SESSION_TOKEN_FIX.md](./FLUTTER_SESSION_TOKEN_FIX.md) — Fix `SESSION_INVALID` / token handling
- [CLOUDINARY_PROFILE_PHOTO.md](./CLOUDINARY_PROFILE_PHOTO.md) — Backend Cloudinary setup
- [TWILIO_OTP_IMPLEMENTATION.md](./TWILIO_OTP_IMPLEMENTATION.md) — Backend Twilio setup, env vars, deployment
