import { ProducerPageActions } from '../../components/layout/ProducerPageActions';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  dateRangeLabel: string;
};

export function DashboardHeader({ dateRangeLabel }: Props) {
  const { t } = useI18n();

  return (
    <header className="prod-dash-header">
      <div className="prod-dash-header__intro">
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.subtitle')}</p>
      </div>
      <ProducerPageActions dateRangeLabel={dateRangeLabel} />
    </header>
  );
}
