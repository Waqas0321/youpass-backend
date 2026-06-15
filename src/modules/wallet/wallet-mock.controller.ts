import type { Request, Response } from 'express';

/** Dev-only Klap tokenization mock page. Real Klap replaces this hosted form. */
export function renderKlapMockTokenizePage(req: Request, res: Response): void {
  const session = String(req.query.session ?? '');
  const user = String(req.query.user ?? '');

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Klap Secure Card</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f5; margin:0; padding:24px; }
    .card { background:#fff; border-radius:16px; padding:20px; max-width:420px; margin:0 auto; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    h1 { font-size:18px; margin:0 0 8px; color:#212121; }
    p { font-size:13px; color:#757575; margin:0 0 16px; }
    label { display:block; font-size:12px; color:#757575; margin:12px 0 4px; }
    input { width:100%; box-sizing:border-box; padding:12px; border:1px solid #e0e0e0; border-radius:10px; font-size:16px; }
    button { margin-top:20px; width:100%; padding:14px; border:none; border-radius:28px; background:#E69D17; color:#fff; font-weight:700; font-size:15px; }
    .row { display:flex; gap:12px; }
    .row > div { flex:1; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Klap secure form (mock)</h1>
    <p>Card data is tokenised by Klap. CVV is never stored.</p>
    <form id="form">
      <label>Card number</label>
      <input id="card" inputmode="numeric" placeholder="4242 4242 4242 4242" maxlength="19" />
      <div class="row">
        <div>
          <label>Expiry</label>
          <input id="expiry" placeholder="MM/YY" maxlength="5" />
        </div>
        <div>
          <label>CVV</label>
          <input id="cvv" inputmode="numeric" placeholder="123" maxlength="4" />
        </div>
      </div>
      <label>Cardholder name</label>
      <input id="name" placeholder="Alejandro Ruiz" />
      <button type="submit">Save card securely</button>
    </form>
  </div>
  <script>
    const session = ${JSON.stringify(session)};
    const user = ${JSON.stringify(user)};
    document.getElementById('form').addEventListener('submit', function (e) {
      e.preventDefault();
      const digits = document.getElementById('card').value.replace(/\\D/g, '');
      const lastFour = digits.slice(-4) || '4242';
      const brand = digits.startsWith('5') ? 'mastercard' : digits.startsWith('3') ? 'amex' : 'visa';
      const expiry = document.getElementById('expiry').value.split('/');
      const expMonth = expiry[0] || '12';
      const expYear = expiry[1] ? ('20' + expiry[1]) : '2030';
      const token = 'klap_tok_' + Math.random().toString(36).slice(2, 12);
      const name = encodeURIComponent(document.getElementById('name').value || 'Cardholder');
      const url = 'youpass://wallet/tokenized'
        + '?payment_method_id=' + encodeURIComponent(token)
        + '&gateway=klap'
        + '&brand=' + encodeURIComponent(brand)
        + '&last_four=' + encodeURIComponent(lastFour)
        + '&expiration_month=' + encodeURIComponent(expMonth)
        + '&expiration_year=' + encodeURIComponent(expYear)
        + '&cardholder_name=' + name
        + '&session=' + encodeURIComponent(session);
      window.location.href = url;
    });
  </script>
</body>
</html>`);
}
