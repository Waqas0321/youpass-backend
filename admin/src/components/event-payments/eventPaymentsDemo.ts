export type PaymentKpiTone = 'purple' | 'gold' | 'green' | 'red' | 'blue';

export type PaymentKpiId = 'gross' | 'commission' | 'net' | 'refunds' | 'pendingSettlement';

export type PaymentKpiDeltaTone = 'good' | 'bad' | 'neutral';

export type PaymentKpi = {
  id: PaymentKpiId;
  tone: PaymentKpiTone;
  value: number;
  deltaPct: number;
  deltaTone: PaymentKpiDeltaTone;
};

export type PaymentChartPoint = {
  label: string;
  value: number;
};

export type PaymentCategorySlice = {
  label: string;
  value: number;
};

export type PaymentTransactionStatus = 'approved' | 'pending' | 'refunded';

export type PaymentTransaction = {
  id: string;
  user: string;
  product: string;
  method: string;
  methodTone: 'webpay' | 'visa' | 'mastercard' | 'amex' | 'transfer';
  status: PaymentTransactionStatus;
  amount: number;
  date: string;
};

export type PaymentMethodSummary = {
  method: string;
  methodTone: PaymentTransaction['methodTone'];
  count: number;
  sharePct: number;
  amount: number;
};

export type PaymentSettlementStatus = 'transferred' | 'scheduled';

export type PaymentSettlement = {
  id: string;
  date: string;
  status: PaymentSettlementStatus;
  amount: number;
  accountMask: string;
};

export const PAYMENT_KPIS: PaymentKpi[] = [
  { id: 'gross', tone: 'purple', value: 98_450_000, deltaPct: 23.8, deltaTone: 'good' },
  { id: 'commission', tone: 'gold', value: 9_845_000, deltaPct: 12.4, deltaTone: 'good' },
  { id: 'net', tone: 'green', value: 88_605_000, deltaPct: 24.1, deltaTone: 'good' },
  { id: 'refunds', tone: 'red', value: 2_450_000, deltaPct: 8.3, deltaTone: 'bad' },
  { id: 'pendingSettlement', tone: 'blue', value: 18_600_000, deltaPct: 0, deltaTone: 'neutral' },
];

export const DAILY_SALES_POINTS: PaymentChartPoint[] = [
  { label: '25 ene', value: 11_200_000 },
  { label: '26 ene', value: 13_800_000 },
  { label: '27 ene', value: 12_400_000 },
  { label: '28 ene', value: 15_600_000 },
  { label: '29 ene', value: 19_200_000 },
  { label: '30 ene', value: 21_800_000 },
  { label: '31 ene', value: 17_450_000 },
];

export const REFUND_POINTS: PaymentChartPoint[] = [
  { label: '25 ene', value: 180_000 },
  { label: '26 ene', value: 120_000 },
  { label: '27 ene', value: 290_000 },
  { label: '28 ene', value: 210_000 },
  { label: '29 ene', value: 380_000 },
  { label: '30 ene', value: 320_000 },
  { label: '31 ene', value: 250_000 },
];

export const REVENUE_BY_CATEGORY: PaymentCategorySlice[] = [
  { label: 'generalTickets', value: 44_302_500 },
  { label: 'vipTables', value: 24_612_500 },
  { label: 'drinks', value: 14_767_500 },
  { label: 'food', value: 9_845_000 },
  { label: 'other', value: 4_922_500 },
];

export const PAYMENT_METHOD_SLICES: PaymentCategorySlice[] = [
  { label: 'webpay', value: 54_147_500 },
  { label: 'visa', value: 14_767_500 },
  { label: 'mastercard', value: 9_845_000 },
  { label: 'amex', value: 11_814_000 },
  { label: 'transfer', value: 7_876_000 },
];

export const PAYMENT_TRANSACTIONS: PaymentTransaction[] = [
  {
    id: 'TXN-20260401-001',
    user: 'Camila Méndez',
    product: 'Mesa VIP Premium',
    method: 'Webpay',
    methodTone: 'webpay',
    status: 'approved',
    amount: 850_000,
    date: '01/04/2026 08:23',
  },
  {
    id: 'TXN-20260401-002',
    user: 'Rodrigo Valdés',
    product: 'Entrada General',
    method: 'Visa',
    methodTone: 'visa',
    status: 'approved',
    amount: 45_000,
    date: '01/04/2026 09:12',
  },
  {
    id: 'TXN-20260401-003',
    user: 'Valentina Soto',
    product: 'Pack Bebidas x5',
    method: 'Mastercard',
    methodTone: 'mastercard',
    status: 'pending',
    amount: 32_500,
    date: '01/04/2026 10:45',
  },
  {
    id: 'TXN-20260331-018',
    user: 'Matías Rojas',
    product: 'Mesa VIP Gold',
    method: 'Amex',
    methodTone: 'amex',
    status: 'approved',
    amount: 1_200_000,
    date: '31/03/2026 22:18',
  },
  {
    id: 'TXN-20260331-017',
    user: 'Isabella Torres',
    product: 'Entrada VIP',
    method: 'Webpay',
    methodTone: 'webpay',
    status: 'refunded',
    amount: 85_000,
    date: '31/03/2026 21:04',
  },
  {
    id: 'TXN-20260331-016',
    user: 'Diego Fernández',
    product: 'Combo Barra',
    method: 'Visa',
    methodTone: 'visa',
    status: 'approved',
    amount: 28_000,
    date: '31/03/2026 20:33',
  },
  {
    id: 'TXN-20260331-015',
    user: 'Sofía Herrera',
    product: 'Entrada Early Bird',
    method: 'Transferencia',
    methodTone: 'transfer',
    status: 'approved',
    amount: 35_000,
    date: '31/03/2026 19:50',
  },
  {
    id: 'TXN-20260331-014',
    user: 'Tomás Aguilera',
    product: 'Mesa VIP Silver',
    method: 'Webpay',
    methodTone: 'webpay',
    status: 'pending',
    amount: 650_000,
    date: '31/03/2026 18:22',
  },
];

export const PAYMENT_METHOD_SUMMARY: PaymentMethodSummary[] = [
  { method: 'Webpay', methodTone: 'webpay', count: 1245, sharePct: 38.5, amount: 37_893_250 },
  { method: 'Visa', methodTone: 'visa', count: 892, sharePct: 27.5, amount: 27_120_000 },
  { method: 'Mastercard', methodTone: 'mastercard', count: 604, sharePct: 18.7, amount: 18_450_000 },
  { method: 'Amex', methodTone: 'amex', count: 312, sharePct: 9.4, amount: 9_280_000 },
  { method: 'Transferencia', methodTone: 'transfer', count: 198, sharePct: 5.9, amount: 5_706_750 },
];

export const PAYMENT_SETTLEMENTS: PaymentSettlement[] = [
  {
    id: 'set-1',
    date: '28/03/2026',
    status: 'transferred',
    amount: 82_350_000,
    accountMask: '****4521',
  },
  {
    id: 'set-2',
    date: '14/03/2026',
    status: 'transferred',
    amount: 79_120_000,
    accountMask: '****4521',
  },
  {
    id: 'set-3',
    date: '31/03/2026',
    status: 'scheduled',
    amount: 18_600_000,
    accountMask: '****4521',
  },
];

export function formatPaymentClp(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function filterPaymentTransactions(transactions: PaymentTransaction[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return transactions;
  }

  return transactions.filter((txn) =>
    [txn.id, txn.user, txn.product, txn.method, txn.status, txn.date]
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  );
}
