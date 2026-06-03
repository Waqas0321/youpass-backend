# Cloudinary — Profile Photo Upload

Backend endpoint: **`POST /api/v1/users/me/profile-photo`**

Requires Bearer token. Accepts `multipart/form-data` with field **`photo`**.

---

## 1. Create a Cloudinary account

1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up (free tier is enough for development)
3. Open the **Dashboard**

You will see:

| Dashboard field | Env variable |
|-----------------|--------------|
| Cloud name | `CLOUDINARY_CLOUD_NAME` |
| API Key | `CLOUDINARY_API_KEY` |
| API Secret | `CLOUDINARY_API_SECRET` |

---

## 2. Local development (`.env`)

Add to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_PROFILE_FOLDER=youpass/profile-photos
PROFILE_PHOTO_MAX_BYTES=5242880
```

Restart the dev server after saving.

---

## 3. Vercel production

In **Vercel → Project → Settings → Environment Variables**, add:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_PROFILE_FOLDER` (optional, default `youpass/profile-photos`)
- `PROFILE_PHOTO_MAX_BYTES` (optional, default `5242880`)

Redeploy after adding variables.

---

## 4. Test with curl

```bash
# Replace TOKEN and path/to/photo.jpg
curl -X POST https://youpass-backend.vercel.app/api/v1/users/me/profile-photo \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "photo=@/path/to/photo.jpg"
```

---

## 5. How uploads are stored

- Folder: `youpass/profile-photos` (configurable)
- Public ID: MongoDB user ID (overwrites previous photo for same user)
- Transformation: 800×800 face crop, auto quality/format
- URL saved to `users.profile_photo_url`
- Profile completion updated (`has_photo: true`, +15%)

---

## 6. Flutter integration

See **[FLUTTER_IMPLEMENTATION.md](./FLUTTER_IMPLEMENTATION.md)** section **7.1 Upload profile photo**.

---

## 7. Update profile fields

**`PATCH /api/v1/users/me/profile`** — JSON body, Bearer token required.

Editable: `full_name`, `email`, `rut_or_passport`, `birthdate`, `gender`, `instagram_username`.

See **[FLUTTER_IMPLEMENTATION.md](./FLUTTER_IMPLEMENTATION.md)** section **7.2 Update profile fields**.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `CLOUDINARY_NOT_CONFIGURED` | Add all three Cloudinary env vars and redeploy |
| `UPLOAD_FAILED` | Check API secret, Cloudinary dashboard for upload errors |
| `FILE_TOO_LARGE` | Compress image on mobile before upload (max 5 MB) |
| `INVALID_FILE_TYPE` | Send JPEG, PNG, WebP, or HEIC only |
