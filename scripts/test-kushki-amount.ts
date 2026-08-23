import assert from 'node:assert/strict';
import { buildKushkiAmount } from '../src/modules/payments/kushki.client.js';

assert.deepEqual(buildKushkiAmount(15000, 'CLP'), {
  subtotalIva: 0,
  subtotalIva0: 15000,
  iva: 0,
  ice: 0,
  currency: 'CLP',
});

assert.deepEqual(buildKushkiAmount(99.5, 'USD'), {
  subtotalIva: 0,
  subtotalIva0: 99.5,
  iva: 0,
  ice: 0,
  currency: 'USD',
});

console.log('kushki.client amount helpers ok');
