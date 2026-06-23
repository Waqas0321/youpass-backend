import { ChangeEvent, useRef, useState } from 'react';
import { adminApi } from '../../api/client';

type Props = {
  label?: string;
  value: string;
  folder?: string;
  onChange: (url: string) => void;
};

export function ImageUploadField({
  label = 'Product image',
  value,
  folder = 'youpass/drink-products',
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploading(true);
    setError('');
    const result = await adminApi.uploadImage(file, folder);
    setUploading(false);

    if (!result.ok || !result.data?.url) {
      setError(result.error ?? 'Upload failed');
      return;
    }

    onChange(result.data.url);
  }

  return (
    <div className="image-upload-field">
      <span className="field__label">{label}</span>

      <div className="image-upload-field__body">
        <div className="image-upload-field__preview">
          {value ? (
            <img src={value} alt="" />
          ) : (
            <span className="muted">No image yet</span>
          )}
        </div>

        <div className="image-upload-field__controls">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            hidden
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="outline-btn outline-btn--sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload image'}
          </button>
          {value ? (
            <button type="button" className="ghost-btn ghost-btn--sm" onClick={() => onChange('')}>
              Remove
            </button>
          ) : null}
          <label className="field image-upload-field__url">
            <span className="field__label">Or paste image URL</span>
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>
      </div>

      {error ? <p className="image-upload-field__error">{error}</p> : null}
    </div>
  );
}
