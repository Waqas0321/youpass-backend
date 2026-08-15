import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  adminApi,
  EVENT_IMAGE_UPLOAD_FOLDER,
  type AdminEvent,
  type AdminEventInput,
  type EventTypeOption,
} from '../api/client';
import { EventInfoAppPreviewModal } from '../components/event-info/EventInfoAppPreviewModal';
import { EventInfoField } from '../components/event-info/EventInfoField';
import {
  buildEventInfoPayload,
  createEventInfoId,
  DEFAULT_EVENT_SOCIAL_LINKS,
  DEFAULT_EVENT_SPONSORS,
  DESCRIPTION_MAX,
  EMPTY_EVENT_FORM,
  eventToFormState,
  mergeDateAndTime,
  socialPlatformClass,
  splitDatetimeLocal,
  type EventInfoSocialLink,
  type EventInfoSponsor,
} from '../components/event-info/eventInfoForm';
import { EventWorkspaceLayout } from '../components/event-workspace/EventWorkspaceLayout';
import { Alert } from '../components/ui/Alert';
import { Modal } from '../components/ui/Modal';
import {
  IconChevronDown,
  IconCalendar,
  IconClock,
  IconEdit,
  IconEye,
  IconMapPin,
  IconPause,
  IconPlayCircle,
  IconPlus,
  IconRefresh,
  IconUpload,
  IconX,
  IconZap,
} from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useSelectedEvent } from '../context/SelectedEventContext';
import { useI18n } from '../i18n/useI18n';

const CAROUSEL_GRADIENTS = [
  'linear-gradient(145deg, #ff7e5f, #feb47b)',
  'linear-gradient(145deg, #6a11cb, #2575fc)',
  'linear-gradient(145deg, #f12711, #f5af19)',
  'linear-gradient(145deg, #11998e, #38ef7d)',
  'linear-gradient(145deg, #8e2de2, #4a00e0)',
];

export function EventInfoPage() {
  const { eventId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, dateLocale } = useI18n();
  const { setSelectedEventId } = useSelectedEvent();
  const isNew = location.pathname.endsWith('/events/new/info');

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const sponsorLogoInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [form, setForm] = useState<AdminEventInput>(EMPTY_EVENT_FORM);
  const [addressLine, setAddressLine] = useState('');
  const [endTime, setEndTime] = useState('05:00');
  const [sponsors, setSponsors] = useState<EventInfoSponsor[]>([]);
  const [socialLinks, setSocialLinks] = useState<EventInfoSocialLink[]>([]);
  const [categories, setCategories] = useState<EventTypeOption[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const [socialDraft, setSocialDraft] = useState<{ platform: EventInfoSocialLink['platform']; handle: string }>({
    platform: 'instagram',
    handle: '',
  });
  const [sponsorDraft, setSponsorDraft] = useState<{ label: string; tone: string; logo_url?: string }>({
    label: '',
    tone: '#1e3264',
  });

  const { date: startDate, time: startTime } = useMemo(
    () => splitDatetimeLocal(form.starts_at),
    [form.starts_at],
  );
  const descriptionCount = form.description?.length ?? 0;
  const carouselImages = form.carousel_images ?? [];

  const draftPreview = useMemo(
    () => ({
      title: form.title,
      image_url: form.image_url,
      starts_at: form.starts_at,
      venue_name: form.venue_name,
      city: form.city,
    }),
    [form.title, form.image_url, form.starts_at, form.venue_name, form.city],
  );

  const previewDateLabel = form.starts_at
    ? new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(form.starts_at),
      )
    : '';
  const previewTimeLabel = startTime
    ? new Intl.DateTimeFormat(dateLocale, { hour: 'numeric', minute: '2-digit' }).format(new Date(form.starts_at))
    : '';

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const typesResult = await adminApi.eventTypes();
      if (cancelled) return;
      setCategories(typesResult.ok ? (typesResult.data ?? []) : []);

      if (isNew) {
        setForm({ ...EMPTY_EVENT_FORM });
        setAddressLine('');
        setEndTime('05:00');
        setSponsors(DEFAULT_EVENT_SPONSORS);
        setSocialLinks(DEFAULT_EVENT_SOCIAL_LINKS);
        setLoading(false);
        return;
      }

      const eventsResult = await adminApi.events();
      if (cancelled) return;

      if (!eventsResult.ok) {
        setLoading(false);
        setError(eventsResult.error ?? t('eventInfo.loadError'));
        return;
      }

      const matched = eventsResult.data?.events.find((item) => item.id === eventId) ?? null;
      if (!matched) {
        setLoading(false);
        setError(t('eventInfo.notFound'));
        return;
      }

      const state = eventToFormState(matched);
      setEvent(matched);
      setSelectedEventId(matched.id);
      setForm(state.form);
      setAddressLine(state.addressLine);
      setEndTime(state.endTime);
      setSponsors(state.sponsors);
      setSocialLinks(state.socialLinks);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, isNew, setSelectedEventId, t]);

  function updateForm<K extends keyof AdminEventInput>(key: K, value: AdminEventInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function swapColors() {
    const nextPrimary = form.secondary_color ?? '#7B5FF2';
    const nextSecondary = form.primary_color ?? '#F2B705';
    updateForm('primary_color', nextPrimary);
    updateForm('secondary_color', nextSecondary);
  }

  async function uploadImage(file: File, target: 'banner' | 'carousel' | 'logo' | 'sponsor') {
    setUploading(target);
    setError('');
    const result = await adminApi.uploadImage(file, EVENT_IMAGE_UPLOAD_FOLDER);
    setUploading(null);

    if (!result.ok || !result.data?.url) {
      setError(result.error ?? t('eventInfo.uploadError'));
      return null;
    }

    return result.data.url;
  }

  async function uploadVideo(file: File) {
    setUploading('video');
    setError('');
    const result = await adminApi.uploadVideo(file, EVENT_IMAGE_UPLOAD_FOLDER);
    setUploading(null);

    if (!result.ok || !result.data?.url) {
      setError(result.error ?? t('eventInfo.uploadError'));
      return null;
    }

    return result.data.url;
  }

  async function handleBannerFile(file: File) {
    const url = await uploadImage(file, 'banner');
    if (url) updateForm('image_url', url);
  }

  async function handleCarouselFile(file: File) {
    const url = await uploadImage(file, 'carousel');
    if (url) updateForm('carousel_images', [...carouselImages, url]);
  }

  async function handleLogoFile(file: File) {
    const url = await uploadImage(file, 'logo');
    if (url) updateForm('logo_url', url);
  }

  async function handleVideoFile(file: File) {
    const url = await uploadVideo(file);
    if (url) updateForm('teaser_video_url', url);
  }

  async function persistEvent(nextStatus?: AdminEventInput['status']) {
    const payload = buildEventInfoPayload({
      form: nextStatus ? { ...form, status: nextStatus } : form,
      addressLine,
      endTime,
      sponsors,
      socialLinks,
    });

    if (!payload) {
      setError(t('eventInfo.requiredFields'));
      return null;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const result = isNew
      ? await adminApi.createEvent(payload)
      : await adminApi.updateEvent(eventId, payload);

    setSaving(false);

    if (!result.ok || !result.data) {
      setError(result.error ?? t('eventInfo.saveError'));
      return null;
    }

    const saved = result.data;
    const state = eventToFormState(saved);
    setEvent(saved);
    setForm(state.form);
    setAddressLine(state.addressLine);
    setEndTime(state.endTime);
    setSponsors(state.sponsors);
    setSocialLinks(state.socialLinks);
    setSelectedEventId(saved.id);

    if (nextStatus === 'published') {
      setMessage(t('eventInfo.publishSuccess'));
    } else if (nextStatus === 'draft') {
      setMessage(t('eventInfo.unpublishSuccess'));
    } else {
      setMessage(t('eventInfo.saveSuccess'));
    }

    if (isNew) {
      navigate(`/events/${saved.id}/info`, { replace: true });
    }

    return saved;
  }

  async function onSave(submitEvent?: FormEvent) {
    submitEvent?.preventDefault();
    await persistEvent();
  }

  function onCancel() {
    navigate('/events');
  }

  function removeCarouselImage(index: number) {
    updateForm(
      'carousel_images',
      carouselImages.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function removeSocialLink(id: string) {
    setSocialLinks((current) => current.filter((item) => item.id !== id));
  }

  function removeSponsor(id: string) {
    setSponsors((current) => current.filter((item) => item.id !== id));
  }

  function addSocialLink() {
    const handle = socialDraft.handle.trim();
    if (!handle) {
      setError(t('eventInfo.socialHandleRequired'));
      return;
    }
    setSocialLinks((current) => [
      ...current,
      { id: createEventInfoId('social'), platform: socialDraft.platform, handle },
    ]);
    setSocialDraft({ platform: 'instagram', handle: '' });
    setSocialModalOpen(false);
    setError('');
  }

  function addSponsor() {
    const label = sponsorDraft.label.trim();
    if (!label) {
      setError(t('eventInfo.sponsorNameRequired'));
      return;
    }
    setSponsors((current) => [
      ...current,
      {
        id: createEventInfoId('sponsor'),
        label,
        tone: sponsorDraft.tone,
        logo_url: sponsorDraft.logo_url,
      },
    ]);
    setSponsorDraft({ label: '', tone: '#1e3264' });
    setSponsorModalOpen(false);
    setError('');
  }

  const isPublished = form.status === 'published';
  const headerActions = (
    <div className="event-info__toolbar-actions">
      <button type="button" className="event-info__action event-info__action--ghost" onClick={onCancel}>
        {t('eventInfo.cancel')}
      </button>
      <button
        type="button"
        className="event-info__action event-info__action--outline"
        disabled={saving || Boolean(uploading)}
        onClick={() => void onSave()}
      >
        <IconEdit />
        {saving ? t('eventInfo.saving') : t('eventInfo.saveChanges')}
      </button>
      {isPublished ? (
        <button
          type="button"
          className="event-info__action event-info__action--outline"
          disabled={saving || Boolean(uploading)}
          onClick={() => void persistEvent('draft')}
        >
          <IconPause />
          {t('eventInfo.unpublishEvent')}
        </button>
      ) : (
        <button
          type="button"
          className="event-info__action event-info__action--primary"
          disabled={saving || Boolean(uploading)}
          onClick={() => void persistEvent('published')}
        >
          <IconZap />
          {t('eventInfo.publishEvent')}
        </button>
      )}
    </div>
  );

  const layoutProps = {
    event,
    isNewEvent: isNew,
    draftPreview,
    pageTitle: t('eventInfo.title'),
    pageSubtitle: t('eventInfo.subtitle'),
    headerActions,
  };

  const formContent = (
    <form className="event-info__layout" onSubmit={onSave}>
      <section className="event-info__column event-info__column--main">
        <article className="event-info__card">
          <h2 className="event-info__card-title">{t('eventInfo.basicInfo')}</h2>

          <EventInfoField label={t('eventInfo.eventName')} required className="event-info-field--full">
            <input
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
              placeholder={t('eventInfo.eventNamePlaceholder')}
              required
            />
          </EventInfoField>

          <EventInfoField label={t('eventInfo.category')} required className="event-info-field--full">
            <select
              value={form.event_type}
              onChange={(e) => updateForm('event_type', e.target.value)}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </EventInfoField>

          <EventInfoField
            label={t('eventInfo.description')}
            required
            className="event-info-field--full event-info-field--textarea"
          >
            <textarea
              rows={5}
              maxLength={DESCRIPTION_MAX}
              value={form.description ?? ''}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder={t('eventInfo.descriptionPlaceholder')}
            />
            <span className="event-info-field__counter">
              {t('eventInfo.descriptionCount', {
                count: String(descriptionCount),
                max: String(DESCRIPTION_MAX),
              })}
            </span>
          </EventInfoField>

          <div className="event-info__row event-info__row--3">
            <EventInfoField label={t('eventInfo.date')} required icon={<IconCalendar />}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => updateForm('starts_at', mergeDateAndTime(e.target.value, startTime))}
                required
              />
            </EventInfoField>
            <EventInfoField label={t('eventInfo.startTime')} required icon={<IconClock />}>
              <input
                type="time"
                value={startTime}
                onChange={(e) => updateForm('starts_at', mergeDateAndTime(startDate, e.target.value))}
                required
              />
            </EventInfoField>
            <EventInfoField label={t('eventInfo.endTime')} required icon={<IconClock />}>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </EventInfoField>
          </div>

          <div className="event-info__row event-info__row--2">
            <EventInfoField label={t('eventInfo.venue')} required>
              <input
                value={form.venue_name ?? ''}
                onChange={(e) => updateForm('venue_name', e.target.value)}
                placeholder={t('eventInfo.venuePlaceholder')}
              />
            </EventInfoField>
            <EventInfoField label={t('eventInfo.address')} required icon={<IconMapPin />}>
              <input
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder={t('eventInfo.addressPlaceholder')}
              />
            </EventInfoField>
          </div>

          <div className="event-info__row event-info__row--2">
            <EventInfoField label={t('eventInfo.minAge')} required hint={t('eventInfo.minAgeHint')}>
              <select
                value={String(form.min_age ?? 18)}
                onChange={(e) => updateForm('min_age', Number(e.target.value))}
              >
                <option value="18">{t('eventInfo.minAge18')}</option>
                <option value="21">{t('eventInfo.minAge21')}</option>
                <option value="0">{t('eventInfo.minAgeAll')}</option>
              </select>
            </EventInfoField>
            <EventInfoField label={t('eventInfo.dressCode')} hint={t('eventInfo.dressCodeHint')}>
              <select
                value={form.dress_code ?? 'casual'}
                onChange={(e) => updateForm('dress_code', e.target.value)}
              >
                <option value="casual">{t('eventInfo.dressCasual')}</option>
                <option value="formal">{t('eventInfo.dressFormal')}</option>
                <option value="theme">{t('eventInfo.dressTheme')}</option>
              </select>
            </EventInfoField>
          </div>
        </article>
      </section>

      <section className="event-info__column event-info__column--side">
        <article className="event-info__card">
          <header className="event-info__card-head event-info__card-head--stacked">
            <div>
              <h2 className="event-info__card-title">{t('eventInfo.multimedia')}</h2>
              <p className="event-info__card-subtitle">{t('eventInfo.multimediaSubtitle')}</p>
            </div>
            <button type="button" className="event-info__preview-link" onClick={() => setPreviewOpen(true)}>
              <IconEye />
              {t('eventInfo.appPreview')}
            </button>
          </header>

          <div className="event-info__media-block">
            <h3>{t('eventInfo.mainBanner')}</h3>
            <div className="event-info__upload-row">
              <div className="event-info__banner-preview">
                {form.image_url ? (
                  <img src={form.image_url} alt="" />
                ) : (
                  <div className="event-info__banner-fallback">
                    <span>YOUFEST</span>
                    <small>CARIBE NIGHT</small>
                  </div>
                )}
              </div>
              <div className="event-info__upload-drop">
                <IconUpload />
                <strong>{uploading === 'banner' ? t('eventInfo.uploading') : t('eventInfo.uploadBanner')}</strong>
                <span>{t('eventInfo.bannerSizeHint')}</span>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void handleBannerFile(file);
                  }}
                />
                <button type="button" onClick={() => bannerInputRef.current?.click()}>
                  {t('eventInfo.chooseFile')}
                </button>
              </div>
            </div>
          </div>

          <div className="event-info__media-block">
            <h3>{t('eventInfo.imageCarousel')}</h3>
            <div className="event-info__carousel">
              {carouselImages.length === 0
                ? CAROUSEL_GRADIENTS.map((gradient) => (
                    <div key={gradient} className="event-info__carousel-thumb" style={{ background: gradient }} aria-hidden />
                  ))
                : null}
              {carouselImages.map((imageUrl, index) => (
                <div key={`${imageUrl}-${index}`} className="event-info__carousel-thumb event-info__carousel-thumb--image">
                  <img src={imageUrl} alt="" />
                  <button type="button" className="event-info__carousel-remove" onClick={() => removeCarouselImage(index)}>
                    <IconX />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="event-info__add-tile"
                disabled={uploading === 'carousel'}
                onClick={() => carouselInputRef.current?.click()}
              >
                <IconPlus />
                <span>{uploading === 'carousel' ? t('eventInfo.uploading') : t('eventInfo.add')}</span>
              </button>
              <input
                ref={carouselInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handleCarouselFile(file);
                }}
              />
            </div>
          </div>

          <div className="event-info__media-block event-info__media-block--split">
            <div>
              <h3>{t('eventInfo.teaserVideo')}</h3>
              <div className="event-info__upload-row event-info__upload-row--compact">
                <div className={`event-info__video-thumb ${form.teaser_video_url ? 'event-info__video-thumb--active' : 'event-info__video-thumb--demo'}`}>
                  {form.teaser_video_url ? (
                    <video src={form.teaser_video_url} controls muted playsInline />
                  ) : (
                    <IconPlayCircle />
                  )}
                </div>
                <div className="event-info__upload-drop event-info__upload-drop--compact">
                  <IconUpload />
                  <strong>{uploading === 'video' ? t('eventInfo.uploading') : t('eventInfo.uploadVideo')}</strong>
                  <span>{t('eventInfo.videoUploadHint')}</span>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void handleVideoFile(file);
                    }}
                  />
                  <button type="button" onClick={() => videoInputRef.current?.click()}>
                    {t('eventInfo.chooseFile')}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <h3>{t('eventInfo.eventLogo')}</h3>
              <div className="event-info__upload-row event-info__upload-row--compact">
                <div className="event-info__logo-thumb event-info__logo-thumb--active">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="" />
                  ) : (
                    <div className="event-info__logo-fallback">
                      <span>YOUFEST</span>
                      <small>CARIBE NIGHT</small>
                    </div>
                  )}
                </div>
                <div className="event-info__upload-drop event-info__upload-drop--compact">
                  <IconUpload />
                  <strong>{uploading === 'logo' ? t('eventInfo.uploading') : t('eventInfo.uploadLogo')}</strong>
                  <span>{t('eventInfo.logoUploadHint')}</span>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void handleLogoFile(file);
                    }}
                  />
                  <button type="button" onClick={() => logoInputRef.current?.click()}>
                    {t('eventInfo.chooseFile')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="event-info__card">
          <header className="event-info__card-head event-info__card-head--stacked">
            <div>
              <h2 className="event-info__card-title">{t('eventInfo.branding')}</h2>
              <p className="event-info__card-subtitle">{t('eventInfo.brandingSubtitle')}</p>
            </div>
          </header>

          <div className="event-info__media-block">
            <h3>{t('eventInfo.sponsors')}</h3>
            <div className="event-info__sponsors">
              {sponsors.map((brand) => (
                <div key={brand.id} className="event-info__sponsor-logo" style={{ background: brand.tone }}>
                  {brand.logo_url ? <img src={brand.logo_url} alt="" /> : <span>{brand.label}</span>}
                  <button type="button" className="event-info__sponsor-remove" onClick={() => removeSponsor(brand.id)}>
                    <IconX />
                  </button>
                </div>
              ))}
              <button type="button" className="event-info__add-tile event-info__add-tile--square" onClick={() => setSponsorModalOpen(true)}>
                <IconPlus />
                <span>{t('eventInfo.add')}</span>
              </button>
            </div>
          </div>

          <div className="event-info__media-block">
            <h3>{t('eventInfo.socialLinks')}</h3>
            <div className="event-info__social-row">
              <ul className="event-info__social-list">
                {socialLinks.map((item) => (
                  <li key={item.id}>
                    <span className={`event-info__social-icon ${socialPlatformClass(item.platform)}`} aria-hidden />
                    <strong>{item.handle}</strong>
                    <button type="button" className="event-info__social-remove" onClick={() => removeSocialLink(item.id)} aria-label={t('eventInfo.removeItem')}>
                      <IconX />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="event-info__add-tile event-info__add-tile--tall" onClick={() => setSocialModalOpen(true)}>
                <IconPlus />
                <span>{t('eventInfo.add')}</span>
              </button>
            </div>
          </div>

          <div className="event-info__media-block">
            <h3>{t('eventInfo.colors')}</h3>
            <div className="event-info__colors">
              <label className="event-info__color-picker">
                <span>{t('eventInfo.primaryColor')}</span>
                <span className="event-info__color-control">
                  <label className="event-info__color-swatch-btn" style={{ background: form.primary_color ?? '#F2B705' }}>
                    <input
                      type="color"
                      value={form.primary_color ?? '#F2B705'}
                      onChange={(e) => updateForm('primary_color', e.target.value)}
                    />
                  </label>
                  <code>{(form.primary_color ?? '#F2B705').toUpperCase()}</code>
                  <IconChevronDown className="event-info__color-chevron" />
                </span>
              </label>
              <button type="button" className="event-info__color-swap" onClick={swapColors} aria-label={t('eventInfo.swapColors')}>
                <IconRefresh />
              </button>
              <label className="event-info__color-picker">
                <span>{t('eventInfo.secondaryColor')}</span>
                <span className="event-info__color-control">
                  <label className="event-info__color-swatch-btn" style={{ background: form.secondary_color ?? '#7B5FF2' }}>
                    <input
                      type="color"
                      value={form.secondary_color ?? '#7B5FF2'}
                      onChange={(e) => updateForm('secondary_color', e.target.value)}
                    />
                  </label>
                  <code>{(form.secondary_color ?? '#7B5FF2').toUpperCase()}</code>
                  <IconChevronDown className="event-info__color-chevron" />
                </span>
              </label>
            </div>
          </div>
        </article>
      </section>
    </form>
  );

  if (loading) {
    return (
      <EventWorkspaceLayout {...layoutProps}>
        <LoadingBlock label={t('eventInfo.loading')} />
      </EventWorkspaceLayout>
    );
  }

  if (!isNew && error && !event) {
    return (
      <EventWorkspaceLayout {...layoutProps}>
        <Alert tone="error">{error}</Alert>
      </EventWorkspaceLayout>
    );
  }

  return (
    <EventWorkspaceLayout {...layoutProps}>
      <div className="event-info">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        {formContent}
      </div>

      <EventInfoAppPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={form.title}
        bannerUrl={form.image_url}
        logoUrl={form.logo_url}
        dateLabel={previewDateLabel}
        timeLabel={previewTimeLabel}
        locationLabel={addressLine || buildLocation(form.venue_name, form.city)}
        primaryColor={form.primary_color ?? '#F2B705'}
      />

      <Modal
        open={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        title={t('eventInfo.addSocialLink')}
        closeLabel={t('common.close')}
        footer={
          <button type="button" className="event-info__action event-info__action--primary" onClick={addSocialLink}>
            {t('eventInfo.add')}
          </button>
        }
      >
        <EventInfoField label={t('eventInfo.socialPlatform')} className="event-info-field--full">
          <select
            value={socialDraft.platform}
            onChange={(e) =>
              setSocialDraft((current) => ({
                ...current,
                platform: e.target.value as EventInfoSocialLink['platform'],
              }))
            }
          >
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="other">{t('eventInfo.socialOther')}</option>
          </select>
        </EventInfoField>
        <EventInfoField label={t('eventInfo.socialHandle')} required className="event-info-field--full">
          <input
            value={socialDraft.handle}
            onChange={(e) => setSocialDraft((current) => ({ ...current, handle: e.target.value }))}
            placeholder="@youfest.oficial"
          />
        </EventInfoField>
      </Modal>

      <Modal
        open={sponsorModalOpen}
        onClose={() => setSponsorModalOpen(false)}
        title={t('eventInfo.addSponsor')}
        closeLabel={t('common.close')}
        footer={
          <button type="button" className="event-info__action event-info__action--primary" onClick={addSponsor}>
            {t('eventInfo.add')}
          </button>
        }
      >
        <EventInfoField label={t('eventInfo.sponsorName')} required className="event-info-field--full">
          <input
            value={sponsorDraft.label}
            onChange={(e) => setSponsorDraft((current) => ({ ...current, label: e.target.value }))}
            placeholder="Red Bull"
          />
        </EventInfoField>
        <EventInfoField label={t('eventInfo.sponsorColor')} className="event-info-field--full">
          <input
            type="color"
            value={sponsorDraft.tone}
            onChange={(e) => setSponsorDraft((current) => ({ ...current, tone: e.target.value }))}
          />
        </EventInfoField>
        <EventInfoField label={t('eventInfo.sponsorLogoOptional')} className="event-info-field--full">
          <input
            ref={sponsorLogoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              void (async () => {
                const url = await uploadImage(file, 'sponsor');
                if (url) setSponsorDraft((current) => ({ ...current, logo_url: url }));
              })();
            }}
          />
        </EventInfoField>
      </Modal>
    </EventWorkspaceLayout>
  );
}

function buildLocation(venue?: string, city?: string) {
  return [venue, city].filter(Boolean).join(', ');
}
