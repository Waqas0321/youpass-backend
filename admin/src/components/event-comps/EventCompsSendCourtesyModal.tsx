import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { IconChevronDown, IconPlus, IconSend, IconShield, IconTrash } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { FrequentClient } from '../event-invitations/eventFrequentClientsDemo';
import { DEMO_COMP_PRODUCTS } from './eventCompsFormConstants';

type SelectedProduct = {
  name: string;
  quantity: number;
};

type Props = {
  open: boolean;
  client: FrequentClient | null;
  batchRecipientCount?: number;
  products: ReadonlyArray<{ id: string; name: string; emoji: string; maxQuantity: number; accent: string }>;
  sending: boolean;
  onClose: () => void;
  onConfirm: (products: SelectedProduct[]) => void;
};

export function EventCompsSendCourtesyModal({
  open,
  client,
  batchRecipientCount,
  products,
  sending,
  onClose,
  onConfirm,
}: Props) {
  const isBatch = batchRecipientCount !== undefined;
  const { t } = useI18n();
  const [productId, setProductId] = useState<string>(products[0]?.id ?? DEMO_COMP_PRODUCTS[0].id);
  const [quantity, setQuantity] = useState(2);
  const [selected, setSelected] = useState<SelectedProduct[]>([]);

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? products[0] ?? DEMO_COMP_PRODUCTS[0],
    [productId, products],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const defaultProduct = products[0] ?? DEMO_COMP_PRODUCTS[0];
    setProductId(defaultProduct.id);
    setQuantity(2);
    setSelected([{ name: defaultProduct.name, quantity: 2 }]);
  }, [open, client?.id, batchRecipientCount, products]);

  if (!client && !isBatch) {
    return null;
  }

  function clampQuantity(value: number) {
    return Math.max(1, Math.min(product.maxQuantity, value));
  }

  function addProduct() {
    setSelected((current) => {
      const existing = current.find((item) => item.name === product.name);
      if (existing) {
        return current.map((item) =>
          item.name === product.name
            ? { ...item, quantity: clampQuantity(item.quantity + quantity) }
            : item,
        );
      }
      return [...current, { name: product.name, quantity: clampQuantity(quantity) }];
    });
  }

  function updateSelectedQuantity(name: string, nextQuantity: number) {
    const productMeta = products.find((item) => item.name === name);
    if (!productMeta) {
      return;
    }
    setSelected((current) =>
      current.map((item) =>
        item.name === name
          ? { ...item, quantity: Math.max(1, Math.min(productMeta.maxQuantity, nextQuantity)) }
          : item,
      ),
    );
  }

  function removeSelected(name: string) {
    setSelected((current) => current.filter((item) => item.name !== name));
  }

  const canConfirm = selected.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventComps.sendCourtesyModal.title')}
      titleIcon={<IconSend />}
      closeLabel={t('eventComps.sendCourtesyModal.close')}
      contentClassName="modal__panel event-comps-send-courtesy-modal"
      backdropClassName="modal__backdrop event-comps-send-courtesy-modal__backdrop"
    >
      <div className="event-comps-send-courtesy">
        <p className="event-comps-send-courtesy__intro">
          {isBatch ? (
            <>
              {t('eventComps.sendCourtesyModal.introBatchBefore')}{' '}
              <strong>{batchRecipientCount}</strong>{' '}
              {t('eventComps.sendCourtesyModal.introBatchAfter')}
            </>
          ) : (
            <>
              {t('eventComps.sendCourtesyModal.introBefore')}{' '}
              <strong>{client?.name}</strong>
              {t('eventComps.sendCourtesyModal.introAfter')}
            </>
          )}
        </p>

        <label className="event-comps-send-courtesy__field">
          <span>{t('eventComps.sendCourtesyModal.productLabel')}</span>
          <span className="event-comps-send-courtesy__product-select">
            <span
              className="event-comps-send-courtesy__product-thumb"
              style={{ backgroundColor: `${product.accent}33` }}
              aria-hidden="true"
            >
              {product.emoji}
            </span>
            <span className="event-comps-send-courtesy__product-name">{product.name}</span>
            <select
              className="event-comps-send-courtesy__product-native-select"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              aria-label={t('eventComps.sendCourtesyModal.productLabel')}
            >
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <IconChevronDown className="event-comps-send-courtesy__chevron" />
          </span>
        </label>

        <div className="event-comps-send-courtesy__field">
          <span>{t('eventComps.sendCourtesyModal.quantityLabel')}</span>
          <div className="event-comps-send-courtesy__stepper">
            <button type="button" onClick={() => setQuantity((current) => clampQuantity(current - 1))}>
              −
            </button>
            <strong>{quantity}</strong>
            <button type="button" onClick={() => setQuantity((current) => clampQuantity(current + 1))}>
              +
            </button>
          </div>
          <span className="event-comps-send-courtesy__max">
            {t('eventComps.sendCourtesyModal.maxAvailable', { count: product.maxQuantity })}
          </span>
        </div>

        <div className="event-comps-send-courtesy__selected-head">
          <strong>{t('eventComps.sendCourtesyModal.selectedTitle', { count: selected.length })}</strong>
          <button type="button" className="event-comps-send-courtesy__add-btn" onClick={addProduct}>
            <IconPlus />
          </button>
        </div>

        {selected.length > 0 ? (
          <ul className="event-comps-send-courtesy__selected-list">
            {selected.map((item) => {
              const meta = products.find((productItem) => productItem.name === item.name);
              if (!meta) {
                return null;
              }
              return (
                <li key={item.name} className="event-comps-send-courtesy__selected-item">
                  <div className="event-comps-send-courtesy__selected-product">
                    <span
                      className="event-comps-send-courtesy__product-thumb"
                      style={{ backgroundColor: `${meta.accent}33` }}
                      aria-hidden="true"
                    >
                      {meta.emoji}
                    </span>
                    <span>{meta.name}</span>
                  </div>
                  <div className="event-comps-send-courtesy__stepper event-comps-send-courtesy__stepper--compact">
                    <button type="button" onClick={() => updateSelectedQuantity(item.name, item.quantity - 1)}>
                      −
                    </button>
                    <strong>{item.quantity}</strong>
                    <button type="button" onClick={() => updateSelectedQuantity(item.name, item.quantity + 1)}>
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="event-comps-send-courtesy__remove"
                    aria-label={t('eventComps.sendCourtesyModal.removeProduct')}
                    onClick={() => removeSelected(item.name)}
                  >
                    <IconTrash />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <button
          type="button"
          className="primary-btn event-comps-send-courtesy__confirm"
          disabled={!canConfirm || sending}
          onClick={() => onConfirm(selected)}
        >
          <IconSend />
          {sending
            ? t('eventComps.sendCourtesyModal.sending')
            : isBatch
              ? t('eventComps.sendCourtesyModal.confirmBatch')
              : t('eventComps.sendCourtesyModal.confirm')}
        </button>

        <p className="event-comps-send-courtesy__note">
          <IconShield />
          <span>
            {isBatch ? t('eventComps.sendCourtesyModal.noteBatch') : t('eventComps.sendCourtesyModal.note')}
          </span>
        </p>
      </div>
    </Modal>
  );
}
