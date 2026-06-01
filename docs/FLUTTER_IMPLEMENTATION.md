# Flutter — YouPass API Implementation Guide

**Production base URL:** `https://youpass-backend.vercel.app/api/v1`

This guide is for the **Flutter mobile app** integrating YouPass authentication (Twilio WhatsApp OTP, 6 digits).

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
  'purpose': 'register',       // register | login | change_phone | delete_account
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
| POST | `/auth/logout` | Revoke session |
| GET | `/users/me/profile` | User profile |
| GET | `/users/me/welcome-data` | Welcome screen data |
| GET | `/config/countries` | Supported countries (includes PK) |

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
- [ ] Store `access_token` after login/register
- [ ] Send `Authorization: Bearer` on protected routes
- [ ] Display English `error.message` from API

---

## Related docs

- [TWILIO_OTP_IMPLEMENTATION.md](./TWILIO_OTP_IMPLEMENTATION.md) — Backend Twilio setup, env vars, deployment
