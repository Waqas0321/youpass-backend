/** API base URLs for admin requests. */
export const productionApiV1Url =
  'https://youpass-backend-two.vercel.app/api/v1';

export const localApiV1Url = 'http://localhost:3002/api/v1';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  (import.meta.env.PROD ? productionApiV1Url : localApiV1Url)
).replace(/\/$/, '');
