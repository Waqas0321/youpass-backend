import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { isKushkiPublicConfigured } from './kushki.client.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function requestOrigin(req: Request): string {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol)
    .split(',')[0]
    .trim();
  const host = req.get('host') ?? 'youpass-backend-two.vercel.app';
  return `${proto}://${host}`;
}

/** Helmet defaults to script-src 'self', which blocks Kushki.js and this page's inline script. */
function applyKushkiPageHeaders(res: Response): void {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "font-src 'self' https: data:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.kushkipagos.com https://js.kushkipagos.com",
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api-uat.kushkipagos.com https://api.kushkipagos.com https://cdn.kushkipagos.com https://*.kushkipagos.com",
      "frame-src 'self' https://cdn.kushkipagos.com https://*.kushkipagos.com",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  );
}

const sharedStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f5; margin:0; padding:24px; }
  .card { background:#fff; border-radius:16px; padding:20px; max-width:420px; margin:0 auto; box-shadow:0 2px 12px rgba(0,0,0,.08); }
  h1 { font-size:18px; margin:0 0 8px; color:#212121; }
  p { font-size:13px; color:#757575; margin:0 0 16px; }
  label { display:block; font-size:12px; color:#757575; margin:12px 0 4px; }
  input { width:100%; box-sizing:border-box; padding:12px; border:1px solid #e0e0e0; border-radius:10px; font-size:16px; }
  button { margin-top:20px; width:100%; padding:14px; border:none; border-radius:28px; background:#FFB800; color:#111; font-weight:700; font-size:15px; }
  button:disabled { opacity:.6; }
  .row { display:flex; gap:12px; }
  .row > div { flex:1; }
  .err { color:#c62828; font-size:13px; margin-top:12px; display:none; }
  .hint { font-size:12px; color:#9e9e9e; margin-top:12px; }
  .badge { display:inline-block; font-size:11px; font-weight:700; color:#8a6d00; background:#FFF4CC; padding:4px 8px; border-radius:999px; margin-bottom:12px; }
`;

const inputAttrs =
  'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"';

/** Wallet tokenization page — Kushki.js when configured, otherwise local mock. */
export function renderKushkiTokenizePage(req: Request, res: Response): void {
  applyKushkiPageHeaders(res);
  const session = String(req.query.session ?? '');
  const user = String(req.query.user ?? '');
  const currency = String(req.query.currency ?? 'CLP').toUpperCase();
  const publicId = env.KUSHKI_PUBLIC_MERCHANT_ID;
  const useLive = isKushkiPublicConfigured();
  const inTest = env.KUSHKI_USE_UAT;

  res.type('html').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>YouPass · Kushki</title>
  <style>${sharedStyles}</style>
  ${useLive ? '<script src="https://cdn.kushkipagos.com/kushki.min.js"></script>' : ''}
</head>
<body>
  <div class="card">
    <div class="badge">${useLive ? (inTest ? 'Kushki UAT' : 'Kushki Live') : 'Kushki mock'}</div>
    <h1>Guardar tarjeta</h1>
    <p>Los datos se tokenizan de forma segura. El CVV nunca se almacena en YouPass.</p>
    <form id="form" autocomplete="off">
      <label>Número de tarjeta</label>
      <input id="card" name="yp-card" inputmode="numeric" placeholder="5451 9515 7492 5480" maxlength="19" ${inputAttrs} required />
      <div class="row">
        <div>
          <label>Vencimiento</label>
          <input id="expiry" name="yp-exp" placeholder="MM/YY" maxlength="5" ${inputAttrs} required />
        </div>
        <div>
          <label>CVV</label>
          <input id="cvv" name="yp-cvc" inputmode="numeric" placeholder="123" maxlength="4" ${inputAttrs} required />
        </div>
      </div>
      <label>Nombre en la tarjeta</label>
      <input id="name" name="yp-name" placeholder="Alejandro Ruiz" ${inputAttrs} required />
      <div id="err" class="err"></div>
      <button id="submit" type="submit">Guardar tarjeta</button>
      <p class="hint">Si iOS pide guardar la tarjeta en Wallet, elige Not Now y vuelve a pulsar el botón.</p>
    </form>
  </div>
  <script>
    const session = ${JSON.stringify(session)};
    const user = ${JSON.stringify(user)};
    const currency = ${JSON.stringify(currency)};
    const useLive = ${useLive ? 'true' : 'false'};
    const publicId = ${JSON.stringify(publicId)};
    const inTest = ${inTest ? 'true' : 'false'};
    const errEl = document.getElementById('err');
    const btn = document.getElementById('submit');

    function showError(msg) {
      errEl.style.display = 'block';
      errEl.textContent = msg;
      btn.disabled = false;
      btn.textContent = 'Guardar tarjeta';
    }

    function finish(token, brand, lastFour, expMonth, expYear, name) {
      const url = 'youpass://wallet/tokenized'
        + '?payment_method_id=' + encodeURIComponent(token)
        + '&gateway=kushki'
        + '&brand=' + encodeURIComponent(brand)
        + '&last_four=' + encodeURIComponent(lastFour)
        + '&expiration_month=' + encodeURIComponent(expMonth)
        + '&expiration_year=' + encodeURIComponent(expYear)
        + '&cardholder_name=' + encodeURIComponent(name)
        + '&session=' + encodeURIComponent(session)
        + '&user=' + encodeURIComponent(user);
      window.location.href = url;
    }

    function parseCard() {
      const digits = document.getElementById('card').value.replace(/\\D/g, '');
      const lastFour = digits.slice(-4) || '0000';
      const brand = digits.startsWith('5') ? 'mastercard' : digits.startsWith('3') ? 'amex' : 'visa';
      const expiry = document.getElementById('expiry').value.split('/');
      const expMonth = (expiry[0] || '12').padStart(2, '0');
      const expYearShort = expiry[1] || '30';
      const expYear = expYearShort.length === 2 ? ('20' + expYearShort) : expYearShort;
      const name = document.getElementById('name').value.trim() || 'Cardholder';
      const cvv = document.getElementById('cvv').value.trim();
      return { digits, lastFour, brand, expMonth, expYear, expYearShort, name, cvv };
    }

    document.getElementById('form').addEventListener('submit', function (e) {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Procesando...';
      errEl.style.display = 'none';
      const parsed = parseCard();

      if (!useLive) {
        const token = 'kushki_tok_' + Math.random().toString(36).slice(2, 14);
        finish(token, parsed.brand, parsed.lastFour, parsed.expMonth, parsed.expYear, parsed.name);
        return;
      }

      if (typeof Kushki !== 'function') {
        showError('No se pudo cargar Kushki. Recarga la página.');
        return;
      }

      try {
        const kushki = new Kushki({
          merchantId: publicId,
          inTestEnvironment: inTest,
          currency: currency
        });
        let settled = false;
        const timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          showError('Kushki no respondió. Revisa los datos e intenta de nuevo.');
        }, 20000);
        kushki.requestSubscriptionToken({
          card: {
            name: parsed.name,
            number: parsed.digits,
            expiryMonth: parsed.expMonth,
            expiryYear: parsed.expYearShort,
            cvv: parsed.cvv,
            cvc: parsed.cvv
          },
          currency: currency
        }, function (response) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (response && !response.code && (response.token || response)) {
            const token = response.token || response;
            finish(String(token), parsed.brand, parsed.lastFour, parsed.expMonth, parsed.expYear, parsed.name);
            return;
          }
          showError((response && (response.message || response.code)) || 'No se pudo tokenizar la tarjeta');
        });
      } catch (err) {
        showError(err && err.message ? err.message : 'Error al inicializar Kushki');
      }
    });
  </script>
</body>
</html>`);
}

/** Checkout page for pending ticket orders. */
export async function renderKushkiCheckoutPage(req: Request, res: Response): Promise<void> {
  applyKushkiPageHeaders(res);
  const orderId = String(req.params.orderId ?? '');
  const session = String(req.query.session ?? '');
  let amount = String(req.query.amount ?? '').trim();
  let currency = String(req.query.currency ?? 'CLP').toUpperCase();
  const apiPrefix = env.API_PREFIX;
  const chargeUrl = `${requestOrigin(req)}${apiPrefix}/payments/kushki/charge-order`;
  const publicId = env.KUSHKI_PUBLIC_MERCHANT_ID;
  const useLive = isKushkiPublicConfigured();
  const inTest = env.KUSHKI_USE_UAT;

  try {
    const order = await prisma.ticketOrder.findUnique({
      where: { id: orderId },
      select: { totalAmount: true, currency: true, status: true },
    });
    if (order) {
      amount = String(Math.round(Number(order.totalAmount) || 0));
      currency = (order.currency || currency).toUpperCase();
    }
  } catch {
    // Keep query-string amount if the order lookup fails.
  }
  if (!amount) amount = '0';

  res.type('html').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>YouPass · Pagar con Kushki</title>
  <style>${sharedStyles}</style>
  ${useLive ? '<script src="https://cdn.kushkipagos.com/kushki.min.js"></script>' : ''}
</head>
<body>
  <div class="card">
    <div class="badge">${useLive ? (inTest ? 'Kushki UAT' : 'Kushki Live') : 'Kushki mock'}</div>
    <h1>Pagar ${escapeHtml(amount)} ${escapeHtml(currency)}</h1>
    <p>Pago seguro con tarjeta vía Kushki. Pedido ${escapeHtml(orderId)}.</p>
    <form id="form" autocomplete="off">
      <label>Número de tarjeta</label>
      <input id="card" name="yp-card" inputmode="numeric" placeholder="5451 9515 7492 5480" maxlength="19" ${inputAttrs} required />
      <div class="row">
        <div>
          <label>Vencimiento</label>
          <input id="expiry" name="yp-exp" placeholder="MM/YY" maxlength="5" ${inputAttrs} required />
        </div>
        <div>
          <label>CVV</label>
          <input id="cvv" name="yp-cvc" inputmode="numeric" placeholder="123" maxlength="4" ${inputAttrs} required />
        </div>
      </div>
      <label>Nombre en la tarjeta</label>
      <input id="name" name="yp-name" placeholder="Alejandro Ruiz" ${inputAttrs} required />
      <div id="err" class="err"></div>
      <button id="submit" type="submit">Pagar ahora</button>
      <p class="hint">Tarjeta de prueba: 5451951574925480 · MM/YY futuro · CVV 123. Si iOS pide guardar en Wallet, elige Not Now y pulsa Pagar ahora otra vez.</p>
    </form>
  </div>
  <script>
    const orderId = ${JSON.stringify(orderId)};
    const session = ${JSON.stringify(session)};
    const amount = ${JSON.stringify(amount)};
    const currency = ${JSON.stringify(currency)};
    const chargeUrl = ${JSON.stringify(chargeUrl)};
    const useLive = ${useLive ? 'true' : 'false'};
    const publicId = ${JSON.stringify(publicId)};
    const inTest = ${inTest ? 'true' : 'false'};
    const errEl = document.getElementById('err');
    const btn = document.getElementById('submit');

    function showError(msg) {
      errEl.style.display = 'block';
      errEl.textContent = msg;
      btn.disabled = false;
      btn.textContent = 'Pagar ahora';
    }

    function parseCard() {
      const digits = document.getElementById('card').value.replace(/\\D/g, '');
      const expiry = document.getElementById('expiry').value.split('/');
      const expMonth = (expiry[0] || '12').padStart(2, '0');
      const expYearShort = expiry[1] || '30';
      const name = document.getElementById('name').value.trim() || 'Cardholder';
      const cvv = document.getElementById('cvv').value.trim();
      return { digits, expMonth, expYearShort, name, cvv };
    }

    async function charge(token) {
      const res = await fetch(chargeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          session_id: session,
          token: token
        })
      });
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || !json.success) {
        throw new Error((json && json.error && json.error.message) || 'Pago rechazado');
      }
      const deep = 'youpass://payments/success?order_id=' + encodeURIComponent(orderId)
        + '&gateway=kushki'
        + '&session=' + encodeURIComponent(session);
      window.location.href = deep;
    }

    document.getElementById('form').addEventListener('submit', function (e) {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Procesando...';
      errEl.style.display = 'none';
      const parsed = parseCard();

      if (!useLive) {
        charge('kushki_tok_' + Math.random().toString(36).slice(2, 14)).catch(function (err) {
          showError(err.message || 'Error de pago');
        });
        return;
      }

      if (typeof Kushki !== 'function') {
        showError('No se pudo cargar Kushki. Recarga la página.');
        return;
      }

      try {
        const kushki = new Kushki({
          merchantId: publicId,
          inTestEnvironment: inTest,
          currency: currency
        });
        let settled = false;
        const timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          showError('Kushki no respondió. Revisa los datos e intenta de nuevo.');
        }, 20000);
        kushki.requestToken({
          amount: String(amount),
          currency: currency,
          card: {
            name: parsed.name,
            number: parsed.digits,
            expiryMonth: parsed.expMonth,
            expiryYear: parsed.expYearShort,
            cvv: parsed.cvv,
            cvc: parsed.cvv
          }
        }, function (response) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (response && !response.code && (response.token || response)) {
            charge(String(response.token || response)).catch(function (err) {
              showError(err.message || 'Error de pago');
            });
            return;
          }
          showError((response && (response.message || response.code)) || 'No se pudo tokenizar la tarjeta');
        });
      } catch (err) {
        showError(err && err.message ? err.message : 'Error al inicializar Kushki');
      }
    });
  </script>
</body>
</html>`);
}
