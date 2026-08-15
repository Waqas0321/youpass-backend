/** API base URLs for admin requests. */
export const productionApiV1Url =
  'https://youpass-backend-two.vercel.app/api/v1';

export const localApiV1Url = 'http://localhost:3003/api/v1';

export const devTunnelApiV1Url = productionApiV1Url;

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  productionApiV1Url
).replace(/\/$/, '');

export function tunnelRequestHeaders(): Record<string, string> {
  return API_BASE_URL.includes('ngrok')
    ? { 'ngrok-skip-browser-warning': 'true' }
    : {};
}
