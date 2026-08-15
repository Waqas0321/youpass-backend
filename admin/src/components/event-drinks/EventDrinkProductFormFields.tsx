import { ChangeEvent, useRef, useState } from 'react';
import { adminApi, DRINK_PRODUCT_UPLOAD_FOLDER, type EventDrinkCategory } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import {
  drinkPriceInputStep,
  drinkPricePlaceholder,
} from '../../utils/drinkPriceInput';
import { EventInfoField } from '../event-info/EventInfoField';
import { IconStar, IconUpload } from '../ui/Icons';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import {
  DRINK_PRODUCT_DESCRIPTION_MAX,
  DRINK_PRODUCT_IMAGE_MAX_BYTES,
  type DrinkProductFormState,
} from './eventDrinkProductForm';

type Props = {
  form: DrinkProductFormState;
  categories: EventDrinkCategory[];
  currency: string;
  onChange: <K extends keyof DrinkProductFormState>(key: K, value: DrinkProductFormState[K]) => void;
  onError: (message: string) => void;
};

export function EventDrinkProductFormFields({ form, categories, currency, onChange, onError }: Props) {
  const { t } = useI18n();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (file.size > DRINK_PRODUCT_IMAGE_MAX_BYTES) {
      onError(t('drinkMenu.productModal.imageTooLarge'));
      return;
    }

    setUploadingImage(true);
    const result = await adminApi.uploadImage(file, DRINK_PRODUCT_UPLOAD_FOLDER);
    setUploadingImage(false);

    if (!result.ok || !result.data?.url) {
      onError(result.error ?? t('drinkMenu.productModal.uploadError'));
      return;
    }

    onChange('imageUrl', result.data.url);
  }

  const previewImage = form.imageUrl || null;

  return (
    <>
      <div className="event-drink-product-modal__top">
        <div className="event-drink-product-modal__upload">
          <span className="event-info-field__label">{t('drinkMenu.productModal.image')}</span>
          <button
            type="button"
            className={`event-drink-product-modal__upload-drop${previewImage ? ' has-image' : ''}`}
            disabled={uploadingImage}
            onClick={() => imageInputRef.current?.click()}
          >
            {previewImage ? (
              <img src={previewImage} alt="" className="event-drink-product-modal__upload-preview" />
            ) : (
              <>
                <IconUpload />
                <strong>
                  {uploadingImage
                    ? t('drinkMenu.productModal.uploading')
                    : t('drinkMenu.productModal.uploadImage')}
                </strong>
                <span>{t('drinkMenu.productModal.imageHint')}</span>
              </>
            )}
          </button>
          <p className="event-drink-product-modal__upload-meta">{t('drinkMenu.productModal.imageFormats')}</p>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => void handleImageChange(event)}
          />
        </div>

        <div className="event-drink-product-modal__primary-fields">
          <EventInfoField
            label={t('drinkMenu.productModal.name')}
            required
            className="event-drink-product-modal__field"
          >
            <input
              value={form.name}
              onChange={(event) => onChange('name', event.target.value)}
              placeholder={t('drinkMenu.productModal.namePlaceholder')}
              required
            />
          </EventInfoField>

          <EventInfoField
            label={t('drinkMenu.productModal.salePrice')}
            required
            hint={
              currency === 'USD'
                ? t('drinkMenu.productModal.salePriceHintUsd')
                : t('drinkMenu.productModal.salePriceHintClp')
            }
            className="event-drink-product-modal__field"
          >
            <span className="event-drink-product-modal__price-input">
              <span className="event-drink-product-modal__price-prefix">$</span>
              <input
                type="number"
                min={0}
                step={drinkPriceInputStep(currency)}
                value={form.price}
                onChange={(event) => onChange('price', event.target.value)}
                placeholder={drinkPricePlaceholder(currency)}
                required
              />
              <span className="event-drink-product-modal__price-suffix">{currency}</span>
            </span>
          </EventInfoField>

          <EventInfoField
            label={t('drinkMenu.productModal.costPrice')}
            hint={t('drinkMenu.productModal.costPriceHint')}
            className="event-drink-product-modal__field"
          >
            <span className="event-drink-product-modal__price-input">
              <span className="event-drink-product-modal__price-prefix">$</span>
              <input
                type="number"
                min={0}
                step={drinkPriceInputStep(currency)}
                value={form.costPrice}
                onChange={(event) => onChange('costPrice', event.target.value)}
                placeholder={drinkPricePlaceholder(currency)}
              />
              <span className="event-drink-product-modal__price-suffix">{currency}</span>
            </span>
          </EventInfoField>

          <EventInfoField
            label={t('drinkMenu.productModal.stock')}
            required
            hint={t('drinkMenu.productModal.stockHint')}
            className="event-drink-product-modal__field"
          >
            <input
              type="number"
              min={0}
              value={form.stock}
              onChange={(event) => onChange('stock', event.target.value)}
              placeholder={t('drinkMenu.productModal.stockPlaceholder')}
              required
            />
          </EventInfoField>
        </div>
      </div>

      <section className="event-drink-product-modal__featured">
        <span className="event-drink-product-modal__featured-icon" aria-hidden>
          <IconStar />
        </span>
        <div className="event-drink-product-modal__featured-copy">
          <strong>{t('drinkMenu.productModal.featuredTitle')}</strong>
          <ToggleSwitch
            className="event-drink-product-modal__featured-toggle"
            label={t('drinkMenu.productModal.featuredLabel')}
            hint={t('drinkMenu.productModal.featuredHint')}
            checked={form.isRecommended}
            onChange={(checked) => onChange('isRecommended', checked)}
          />
        </div>
      </section>

      <div className="event-drink-product-modal__bottom">
        <div className="event-drink-product-modal__category-row">
          <EventInfoField
            label={t('drinkMenu.productModal.category')}
            required
            className="event-drink-product-modal__field event-drink-product-modal__field--category"
          >
            <select
              value={form.categoryId}
              onChange={(event) => onChange('categoryId', event.target.value)}
              required
            >
              <option value="">{t('drinkMenu.productModal.categoryPlaceholder')}</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.icon ? `${category.icon} ` : ''}
                  {category.name}
                </option>
              ))}
            </select>
          </EventInfoField>

          <div className="event-drink-product-modal__preview">
            <span className="event-info-field__label">{t('drinkMenu.productModal.preview')}</span>
            <div className="event-drink-product-modal__preview-thumb">
              {previewImage ? (
                <img src={previewImage} alt="" />
              ) : (
                <span>{t('drinkMenu.productModal.previewEmpty')}</span>
              )}
            </div>
          </div>
        </div>

        <EventInfoField
          label={t('drinkMenu.productModal.description')}
          className="event-drink-product-modal__field event-info-field--textarea event-drink-product-modal__field--description"
        >
          <textarea
            rows={4}
            maxLength={DRINK_PRODUCT_DESCRIPTION_MAX}
            value={form.description}
            onChange={(event) => onChange('description', event.target.value)}
            placeholder={t('drinkMenu.productModal.descriptionPlaceholder')}
          />
          <span className="event-info-field__counter">
            {t('drinkMenu.productModal.descriptionCount', {
              count: String(form.description.length),
              max: String(DRINK_PRODUCT_DESCRIPTION_MAX),
            })}
          </span>
        </EventInfoField>
      </div>
    </>
  );
}
