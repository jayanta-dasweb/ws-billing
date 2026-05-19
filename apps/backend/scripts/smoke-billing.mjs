/**
 * Smoke test: login → bill → add line → complete cash payment.
 * Run: node apps/backend/scripts/smoke-billing.mjs
 */
const API = 'http://127.0.0.1:4000/api/v1';

async function req(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  if (json && typeof json === 'object' && json.success === true && 'data' in json) {
    return json.data;
  }
  return json;
}

async function main() {
  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error(`Health check failed: ${health.status}`);

  const login = await req('POST', '/auth/login', {
    username: 'cashier1',
    password: 'Cashier@123',
  });
  const token = login?.accessToken;
  if (!token) throw new Error(`No access token: ${JSON.stringify(login)}`);

  const catalog = await req('GET', '/billing/catalog/search?q=dolo', null, token);
  const product = catalog?.[0];
  if (!product?.id) throw new Error('No product in catalog');
  const batch = product.batches?.[0];
  if (!batch?.id) throw new Error('No batch for product');

  const bill = await req('POST', '/billing/bills', { counterId: 'seed-counter-1' }, token);
  const billId = bill.id;

  const withLine = await req(
    'POST',
    `/billing/bills/${billId}/lines`,
    { productId: product.id, batchId: batch.id, qty: 1 },
    token,
  );
  const total = Number(withLine.grandTotal);
  if (!(total > 0)) {
    throw new Error(`Expected grandTotal > 0, got ${withLine.grandTotal}`);
  }
  console.log('Bill total after add:', total);

  const bill2 = await req('POST', '/billing/bills', { counterId: 'seed-counter-1' }, token);
  const withLine2 = await req(
    'POST',
    `/billing/bills/${bill2.id}/lines`,
    { productId: product.id, batchId: batch.id, qty: 1 },
    token,
  );
  const total2 = Number(withLine2.grandTotal);

  const paid = await req(
    'POST',
    `/billing/bills/${bill2.id}/complete`,
    { paymentMode: 'CASH', cashReceived: total2 },
    token,
  );
  if (paid.status !== 'PENDING_COMMIT') throw new Error(`Cash (no audit) failed: ${paid.status}`);
  console.log('Cash pay (no audit) OK, total:', total2);

  console.log('OK — billing smoke test passed');
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
