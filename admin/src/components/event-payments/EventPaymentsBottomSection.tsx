import { useI18n } from '../../i18n/useI18n';
import {
  formatPaymentClp,
  type PaymentMethodSummary,
  type PaymentSettlement,
  type PaymentTransaction,
} from './eventPaymentsDemo';

type Props = {
  transactions: PaymentTransaction[];
  hasActiveSearch: boolean;
  methodSummary: PaymentMethodSummary[];
  settlements: PaymentSettlement[];
};

function PaymentMethodBadge({ method, tone }: { method: string; tone: PaymentTransaction['methodTone'] }) {
  return <span className={`event-payments-method event-payments-method--${tone}`}>{method}</span>;
}

export function EventPaymentsBottomSection({
  transactions,
  hasActiveSearch,
  methodSummary,
  settlements,
}: Props) {
  const { t, numberLocale } = useI18n();

  const transactionsEmptyLabel = hasActiveSearch
    ? t('eventPayments.transactions.empty')
    : t('eventPayments.transactions.emptyNoData');

  return (
    <section className="event-payments-bottom">
      <article className="event-payments-panel event-payments-panel--transactions">
        <header className="event-payments-panel__header">
          <h3>{t('eventPayments.transactions.title')}</h3>
        </header>
        <div className="event-payments-panel__table-wrap">
          <table className="event-payments-table">
            <thead>
              <tr>
                <th>{t('eventPayments.transactions.columns.id')}</th>
                <th>{t('eventPayments.transactions.columns.user')}</th>
                <th>{t('eventPayments.transactions.columns.product')}</th>
                <th>{t('eventPayments.transactions.columns.method')}</th>
                <th>{t('eventPayments.transactions.columns.status')}</th>
                <th>{t('eventPayments.transactions.columns.amount')}</th>
                <th>{t('eventPayments.transactions.columns.date')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="event-payments-table__empty">
                    {transactionsEmptyLabel}
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td>
                      <code className="event-payments-table__code">{txn.id}</code>
                    </td>
                    <td>{txn.user}</td>
                    <td>{txn.product}</td>
                    <td>
                      <PaymentMethodBadge method={txn.method} tone={txn.methodTone} />
                    </td>
                    <td>
                      <span className={`event-payments-status event-payments-status--${txn.status}`}>
                        {t(`eventPayments.transactions.statuses.${txn.status}`)}
                      </span>
                    </td>
                    <td>{formatPaymentClp(txn.amount, numberLocale)}</td>
                    <td>{txn.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <div className="event-payments-bottom__side">
        <article className="event-payments-panel">
          <header className="event-payments-panel__header">
            <h3>{t('eventPayments.methods.title')}</h3>
          </header>
          <div className="event-payments-panel__table-wrap">
            <table className="event-payments-table event-payments-table--compact">
              <thead>
                <tr>
                  <th>{t('eventPayments.methods.columns.method')}</th>
                  <th>{t('eventPayments.methods.columns.count')}</th>
                  <th>{t('eventPayments.methods.columns.share')}</th>
                  <th>{t('eventPayments.methods.columns.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {methodSummary.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="event-payments-table__empty">
                      {t('eventPayments.methods.empty')}
                    </td>
                  </tr>
                ) : (
                  methodSummary.map((row) => (
                    <tr key={row.method}>
                      <td>
                        <PaymentMethodBadge method={row.method} tone={row.methodTone} />
                      </td>
                      <td>{new Intl.NumberFormat(numberLocale).format(row.count)}</td>
                      <td>{row.sharePct.toFixed(1)}%</td>
                      <td>{formatPaymentClp(row.amount, numberLocale)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="event-payments-panel">
          <header className="event-payments-panel__header">
            <h3>{t('eventPayments.settlements.title')}</h3>
          </header>
          <div className="event-payments-panel__table-wrap">
            <table className="event-payments-table event-payments-table--compact">
              <thead>
                <tr>
                  <th>{t('eventPayments.settlements.columns.date')}</th>
                  <th>{t('eventPayments.settlements.columns.status')}</th>
                  <th>{t('eventPayments.settlements.columns.amount')}</th>
                  <th>{t('eventPayments.settlements.columns.account')}</th>
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="event-payments-table__empty">
                      {t('eventPayments.settlements.empty')}
                    </td>
                  </tr>
                ) : (
                  settlements.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>
                        <span className={`event-payments-settlement event-payments-settlement--${row.status}`}>
                          {t(`eventPayments.settlements.statuses.${row.status}`)}
                        </span>
                      </td>
                      <td>{formatPaymentClp(row.amount, numberLocale)}</td>
                      <td>
                        <code className="event-payments-table__code">{row.accountMask}</code>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
