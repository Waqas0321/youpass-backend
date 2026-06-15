import { formatPhoneDisplay } from '../../common/utils/phone.js';
import { isWithinBusinessHours } from './support-business-hours.js';
import { supportConfigService } from './support-config.service.js';
import { renderSupportTemplate } from './support-template.util.js';

function buildContextLine(context?: string) {
  return context ? `\nPantalla: ${context}` : '';
}

function buildContextSubject(context?: string) {
  return context ? ` — ${context}` : '';
}

function buildWhatsAppUrl(number: string, message: string) {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const supportService = {
  async getContactInfo() {
    const config = await supportConfigService.getConfig();
    const withinBusinessHours = isWithinBusinessHours(config.businessHours);

    return {
      ...supportConfigService.formatConfig(config),
      is_within_business_hours: withinBusinessHours,
    };
  },

  async listFaqs(query?: string) {
    return supportConfigService.listFaqs(query);
  },

  async recordFaqFeedback(faqId: string, helpful: boolean) {
    return supportConfigService.recordFaqFeedback(faqId, helpful);
  },

  async buildWhatsAppTemplate(input: {
    userName: string;
    phoneDisplay: string;
    userId: string;
    context?: string;
    preferredLanguage?: string;
  }) {
    const config = await supportConfigService.getConfig();
    const isSpanish = input.preferredLanguage?.toLowerCase().startsWith('es');
    const template = isSpanish
      ? config.whatsappTemplateEs
      : config.whatsappTemplateEn;

    const message = renderSupportTemplate(template, {
      name: input.userName,
      phone: input.phoneDisplay,
      userId: input.userId,
      contextLine: buildContextLine(input.context),
      context: input.context ?? '',
    });

    const withinBusinessHours = isWithinBusinessHours(config.businessHours);
    const outsideHoursMessage = renderSupportTemplate(
      isSpanish
        ? config.outsideHoursAutoReplyEs
        : config.outsideHoursAutoReplyEn,
      {
        hours: String(config.outsideHoursReplyWithinHours),
      },
    );

    return {
      whatsapp_number: config.whatsappNumber,
      message,
      whatsapp_url: buildWhatsAppUrl(config.whatsappNumber, message),
      is_within_business_hours: withinBusinessHours,
      outside_hours_auto_reply: withinBusinessHours ? null : outsideHoursMessage,
    };
  },

  async buildEmailTemplate(input: {
    userName: string;
    phoneDisplay: string;
    userId: string;
    context?: string;
    preferredLanguage?: string;
  }) {
    const config = await supportConfigService.getConfig();
    const isSpanish = input.preferredLanguage?.toLowerCase().startsWith('es');

    const subjectTemplate = isSpanish
      ? config.emailSubjectEs
      : config.emailSubjectEn;
    const bodyTemplate = isSpanish
      ? config.emailBodyTemplateEs
      : config.emailBodyTemplateEn;

    const subject = renderSupportTemplate(subjectTemplate, {
      name: input.userName,
      phone: input.phoneDisplay,
      userId: input.userId,
      contextSubject: buildContextSubject(input.context),
      context: input.context ?? '',
    });

    const body = renderSupportTemplate(bodyTemplate, {
      name: input.userName,
      phone: input.phoneDisplay,
      userId: input.userId,
      context: input.context ?? '',
    });

    return {
      email: config.supportEmail,
      subject,
      body,
      mailto_url: `mailto:${config.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    };
  },

  formatUserPhone(phone: string, countryCode: string) {
    return formatPhoneDisplay(phone, countryCode);
  },
};
