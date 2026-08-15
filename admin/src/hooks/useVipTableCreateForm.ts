import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { useI18n } from '../i18n/useI18n';
import {
  EMPTY_VIP_TABLE_FORM,
  mapVipTableFormToInput,
  type VipTableCreateFormState,
  type VipZoneOption,
} from '../components/event-vip-tables/eventVipTableForm';

export function useVipTableCreateForm(
  eventId: string,
  open: boolean,
  zones: VipZoneOption[],
  onSuccess: () => void,
  onClose: () => void,
) {
  const { t } = useI18n();
  const [form, setForm] = useState<VipTableCreateFormState>(EMPTY_VIP_TABLE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_VIP_TABLE_FORM);
      setSaving(false);
      setError('');
    }
  }, [open]);

  const updateForm = useCallback(<K extends keyof VipTableCreateFormState>(
    key: K,
    value: VipTableCreateFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const persistTable = useCallback(async () => {
    if (!form.number.trim() || !form.zoneId || !form.capacity.trim() || !form.price.trim()) {
      setError(t('eventVipTables.createModal.requiredFields'));
      return;
    }

    const number = Number(form.number);
    const capacity = Number(form.capacity);
    const price = Number(form.price);

    if (!Number.isFinite(number) || number <= 0) {
      setError(t('eventVipTables.createModal.invalidNumber'));
      return;
    }

    if (!Number.isFinite(capacity) || capacity <= 0) {
      setError(t('eventVipTables.createModal.invalidCapacity'));
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError(t('eventVipTables.createModal.invalidPrice'));
      return;
    }

    const zone = zones.find((item) => item.zoneId === form.zoneId);
    if (!zone) {
      setError(t('eventVipTables.createModal.zoneRequired'));
      return;
    }

    if (zones.length === 0) {
      setError(t('eventVipTables.createModal.layoutRequired'));
      return;
    }

    setSaving(true);
    setError('');

    const result = await adminApi.createVenueTable(
      eventId,
      zone.zoneId,
      mapVipTableFormToInput(form, zone),
    );

    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? t('eventVipTables.createModal.saveError'));
      return;
    }

    onSuccess();
    onClose();
  }, [eventId, form, onClose, onSuccess, t, zones]);

  return {
    form,
    updateForm,
    saving,
    error,
    setError,
    persistTable,
  };
}
