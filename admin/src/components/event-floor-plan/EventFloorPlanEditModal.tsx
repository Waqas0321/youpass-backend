import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { adminApi, VENUE_LAYOUT_UPLOAD_FOLDER } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { IconUpload } from '../ui/Icons';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Props = {
  open: boolean;
  eventId: string;
  onClose: () => void;
  onSaved: (url: string) => void;
};

function isAcceptedFile(file: File) {
  return ACCEPTED_TYPES.includes(file.type);
}

export function EventFloorPlanEditModal({ open, eventId, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setDragActive(false);
      setUploading(false);
      setError('');
    }
  }, [open]);

  function validateFile(file: File) {
    if (!isAcceptedFile(file)) {
      setError(t('eventFloorPlan.editModal.invalidType'));
      return false;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(t('eventFloorPlan.editModal.tooLarge'));
      return false;
    }
    setError('');
    setSelectedFile(file);
    return true;
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      validateFile(file);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    setDragActive(false);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      validateFile(file);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError(t('eventFloorPlan.editModal.noFile'));
      return;
    }

    setUploading(true);
    setError('');

    const upload = await adminApi.uploadImage(selectedFile, VENUE_LAYOUT_UPLOAD_FOLDER);
    if (!upload.ok || !upload.data?.url) {
      setUploading(false);
      setError(upload.error ?? t('eventFloorPlan.editModal.uploadError'));
      return;
    }

    const save = await adminApi.updateEvent(eventId, {
      floor_plan_image_url: upload.data.url,
    });
    setUploading(false);

    if (!save.ok) {
      setError(save.error ?? t('eventFloorPlan.saveError'));
      return;
    }

    onSaved(upload.data.url);
    onClose();
  }

  const footer = (
    <>
      <button type="button" className="event-floor-plan-modal__cancel" onClick={onClose}>
        {t('eventFloorPlan.editModal.cancel')}
      </button>
      <button
        type="button"
        className="event-floor-plan-modal__submit"
        disabled={!selectedFile || uploading}
        onClick={() => void handleUpload()}
      >
        {uploading ? t('eventFloorPlan.editModal.uploading') : t('eventFloorPlan.editModal.upload')}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventFloorPlan.editModal.title')}
      closeLabel={t('eventFloorPlan.editModal.close')}
      titleId="event-floor-plan-modal-title"
      contentClassName="event-floor-plan-modal"
      backdropClassName="event-floor-plan-modal__backdrop"
      error={error}
      footer={footer}
    >
      <p className="event-floor-plan-modal__description">{t('eventFloorPlan.editModal.description')}</p>

      <label
        className={`event-floor-plan-modal__dropzone${dragActive ? ' event-floor-plan-modal__dropzone--active' : ''}${selectedFile ? ' event-floor-plan-modal__dropzone--selected' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="event-floor-plan-modal__dropzone-icon" aria-hidden>
          <IconUpload />
        </span>
        <strong>{t('eventFloorPlan.editModal.dropTitle')}</strong>
        {selectedFile ? (
          <span className="event-floor-plan-modal__file-name">{selectedFile.name}</span>
        ) : (
          <span>{t('eventFloorPlan.editModal.dropHint')}</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          hidden
          onChange={handleInputChange}
        />
      </label>

      <p className="event-floor-plan-modal__formats">{t('eventFloorPlan.editModal.formats')}</p>
    </Modal>
  );
}
