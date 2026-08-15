import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { IconCalendar, IconChevronDown } from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { CalendarEvent } from './calendarDemo';
import {
  formatEventLongDate,
  formatEventOptionLabel,
  parseIsoDate,
} from './formatCalendarDates';
import { MiniMonthPicker } from './MiniMonthPicker';

type Props = {
  open: boolean;
  events: CalendarEvent[];
  onClose: () => void;
  onSave: (eventId: string, newDate: string) => void;
};

export function RescheduleEventModal({ open, events, onClose, onSave }: Props) {
  const { t, dateLocale } = useI18n();
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? '');
  const [pickerView, setPickerView] = useState({ year: 2026, month: 1 });
  const [selectedDate, setSelectedDate] = useState('2026-02-21');

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0],
    [events, selectedEventId],
  );

  useEffect(() => {
    if (!open || events.length === 0) {
      return;
    }

    const initial = events.find((event) => event.id === 'caribe-night') ?? events[0];
    setSelectedEventId(initial.id);

    const current = parseIsoDate(initial.date);
    const defaultNewDate = new Date(current.getFullYear(), current.getMonth() + 1, 21);
    const iso = `${defaultNewDate.getFullYear()}-${String(defaultNewDate.getMonth() + 1).padStart(2, '0')}-${String(defaultNewDate.getDate()).padStart(2, '0')}`;

    setSelectedDate(iso);
    setPickerView({ year: defaultNewDate.getFullYear(), month: defaultNewDate.getMonth() });
  }, [open, events]);

  if (!selectedEvent) {
    return null;
  }

  function handleEventChange(eventId: string) {
    const event = events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }

    setSelectedEventId(eventId);
    const current = parseIsoDate(event.date);
    const defaultNewDate = new Date(current.getFullYear(), current.getMonth() + 1, 21);
    const iso = `${defaultNewDate.getFullYear()}-${String(defaultNewDate.getMonth() + 1).padStart(2, '0')}-${String(defaultNewDate.getDate()).padStart(2, '0')}`;

    setSelectedDate(iso);
    setPickerView({ year: defaultNewDate.getFullYear(), month: defaultNewDate.getMonth() });
  }

  function handleSave() {
    onSave(selectedEvent.id, selectedDate);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('calendar.rescheduleModalTitle')}
      subtitle={t('calendar.rescheduleModalSubtitle')}
      closeLabel={t('calendar.closeModal')}
      panelClassName="producer-modal__panel--reschedule"
      footer={
        <div className="producer-modal__footer-actions">
          <button type="button" className="producer-modal__btn producer-modal__btn--ghost" onClick={onClose}>
            {t('calendar.cancel')}
          </button>
          <button type="button" className="producer-modal__btn producer-modal__btn--primary" onClick={handleSave}>
            {t('calendar.saveNewDate')}
          </button>
        </div>
      }
    >
      <div className="prod-reschedule-form">
        <label className="prod-reschedule-field">
          <span className="prod-reschedule-field__label">{t('calendar.eventLabel')}</span>
          <span className="prod-reschedule-field__select-wrap">
            <select value={selectedEventId} onChange={(event) => handleEventChange(event.target.value)}>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {formatEventOptionLabel(event.title, event.date, dateLocale)}
                </option>
              ))}
            </select>
            <IconChevronDown className="prod-reschedule-field__chevron" />
          </span>
        </label>

        <div className="prod-reschedule-field">
          <span className="prod-reschedule-field__label">{t('calendar.currentDateLabel')}</span>
          <div className="prod-reschedule-field__readonly" aria-readonly="true">
            <IconCalendar className="prod-reschedule-field__icon" />
            <span>{formatEventLongDate(selectedEvent.date, dateLocale)}</span>
          </div>
        </div>

        <div className="prod-reschedule-field">
          <span className="prod-reschedule-field__label">{t('calendar.newDateLabel')}</span>
          <MiniMonthPicker
            year={pickerView.year}
            month={pickerView.month}
            selectedIso={selectedDate}
            onMonthChange={(year, month) => setPickerView({ year, month })}
            onSelect={setSelectedDate}
          />
        </div>

        <div className="prod-reschedule-field">
          <span className="prod-reschedule-field__label">{t('calendar.selectedDateLabel')}</span>
          <div className="prod-reschedule-field__selected">
            <IconCalendar className="prod-reschedule-field__icon" />
            <span>{formatEventLongDate(selectedDate, dateLocale)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
