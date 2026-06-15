import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { FAQ_CATEGORIES, FAQ_ITEMS } from './support.data.js';
import type { BusinessHoursConfig } from './support-business-hours.js';

export type SupportConfigValues = {
  whatsappNumber: string;
  supportEmail: string;
  whatsappTemplateEs: string;
  whatsappTemplateEn: string;
  emailSubjectEs: string;
  emailSubjectEn: string;
  emailBodyTemplateEs: string;
  emailBodyTemplateEn: string;
  businessHours: BusinessHoursConfig;
  outsideHoursAutoReplyEs: string;
  outsideHoursAutoReplyEn: string;
  outsideHoursReplyWithinHours: number;
};

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: 'America/Santiago',
  weekdays: { from: '09:00', to: '18:00' },
  saturday: { from: '10:00', to: '14:00' },
  sunday: null,
};

const DEFAULT_CONFIG: SupportConfigValues = {
  whatsappNumber: env.SUPPORT_WHATSAPP_NUMBER,
  supportEmail: env.SUPPORT_EMAIL,
  whatsappTemplateEs:
    'Hola, necesito ayuda con YouPass.\n\nNombre: {{name}}\nTeléfono: {{phone}}\nID: {{userId}}{{contextLine}}',
  whatsappTemplateEn:
    'Hi, I need help with YouPass.\n\nName: {{name}}\nPhone: {{phone}}\nID: {{userId}}{{contextLine}}',
  emailSubjectEs: 'Consulta YouPass{{contextSubject}}',
  emailSubjectEn: 'YouPass support request{{contextSubject}}',
  emailBodyTemplateEs:
    'Nombre: {{name}}\nTeléfono: {{phone}}\nID: {{userId}}\n\nConsulta:\n',
  emailBodyTemplateEn:
    'Name: {{name}}\nPhone: {{phone}}\nID: {{userId}}\n\nQuestion:\n',
  businessHours: DEFAULT_BUSINESS_HOURS,
  outsideHoursAutoReplyEs:
    'Recibimos tu mensaje. Te responderemos en un plazo de {{hours}} horas.',
  outsideHoursAutoReplyEn:
    'We received your message. We will reply within {{hours}} hours.',
  outsideHoursReplyWithinHours: 24,
};

function parseBusinessHours(value: Prisma.JsonValue): BusinessHoursConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_BUSINESS_HOURS;
  }

  const record = value as Record<string, unknown>;
  const slot = (input: unknown): BusinessHoursConfig['weekdays'] => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null;
    }
    const from = typeof (input as Record<string, unknown>).from === 'string'
      ? (input as Record<string, string>).from
      : null;
    const to = typeof (input as Record<string, unknown>).to === 'string'
      ? (input as Record<string, string>).to
      : null;
    if (!from || !to) {
      return null;
    }
    return { from, to };
  };

  return {
    timezone:
      typeof record.timezone === 'string' && record.timezone.length > 0
        ? record.timezone
        : DEFAULT_BUSINESS_HOURS.timezone,
    weekdays: slot(record.weekdays) ?? DEFAULT_BUSINESS_HOURS.weekdays,
    saturday: slot(record.saturday),
    sunday: slot(record.sunday),
  };
}

function mapConfigRecord(record: {
  whatsappNumber: string;
  supportEmail: string;
  whatsappTemplateEs: string;
  whatsappTemplateEn: string;
  emailSubjectEs: string;
  emailSubjectEn: string;
  emailBodyTemplateEs: string;
  emailBodyTemplateEn: string;
  businessHours: Prisma.JsonValue;
  outsideHoursAutoReplyEs: string;
  outsideHoursAutoReplyEn: string;
  outsideHoursReplyWithinHours: number;
}): SupportConfigValues {
  return {
    whatsappNumber: record.whatsappNumber,
    supportEmail: record.supportEmail,
    whatsappTemplateEs: record.whatsappTemplateEs,
    whatsappTemplateEn: record.whatsappTemplateEn,
    emailSubjectEs: record.emailSubjectEs,
    emailSubjectEn: record.emailSubjectEn,
    emailBodyTemplateEs: record.emailBodyTemplateEs,
    emailBodyTemplateEn: record.emailBodyTemplateEn,
    businessHours: parseBusinessHours(record.businessHours),
    outsideHoursAutoReplyEs: record.outsideHoursAutoReplyEs,
    outsideHoursAutoReplyEn: record.outsideHoursAutoReplyEn,
    outsideHoursReplyWithinHours: record.outsideHoursReplyWithinHours,
  };
}

async function seedDefaultsIfEmpty() {
  const [configCount, faqCount] = await Promise.all([
    prisma.supportConfig.count(),
    prisma.supportFaqItem.count(),
  ]);

  if (configCount === 0) {
    await prisma.supportConfig.create({
      data: {
        configKey: 'default',
        ...DEFAULT_CONFIG,
        businessHours: DEFAULT_CONFIG.businessHours as Prisma.InputJsonValue,
      },
    });
  }

  if (faqCount === 0) {
    await prisma.supportFaqItem.createMany({
      data: FAQ_ITEMS.map((item, index) => ({
        faqKey: item.id,
        category: item.category,
        questionEs: item.question_es,
        questionEn: item.question_en,
        answerEs: item.answer_es,
        answerEn: item.answer_en,
        keywords: item.keywords,
        displayOrder: index,
        isActive: true,
      })),
    });
  }
}

export const supportConfigService = {
  async ensureSeeded() {
    await seedDefaultsIfEmpty();
  },

  async getConfig(): Promise<SupportConfigValues> {
    await seedDefaultsIfEmpty();

    const record = await prisma.supportConfig.findUnique({
      where: { configKey: 'default' },
    });

    if (!record) {
      return DEFAULT_CONFIG;
    }

    return mapConfigRecord(record);
  },

  async updateConfig(input: Partial<SupportConfigValues>) {
    const current = await this.getConfig();
    const next: SupportConfigValues = {
      whatsappNumber: input.whatsappNumber ?? current.whatsappNumber,
      supportEmail: input.supportEmail ?? current.supportEmail,
      whatsappTemplateEs: input.whatsappTemplateEs ?? current.whatsappTemplateEs,
      whatsappTemplateEn: input.whatsappTemplateEn ?? current.whatsappTemplateEn,
      emailSubjectEs: input.emailSubjectEs ?? current.emailSubjectEs,
      emailSubjectEn: input.emailSubjectEn ?? current.emailSubjectEn,
      emailBodyTemplateEs: input.emailBodyTemplateEs ?? current.emailBodyTemplateEs,
      emailBodyTemplateEn: input.emailBodyTemplateEn ?? current.emailBodyTemplateEn,
      businessHours: input.businessHours ?? current.businessHours,
      outsideHoursAutoReplyEs:
        input.outsideHoursAutoReplyEs ?? current.outsideHoursAutoReplyEs,
      outsideHoursAutoReplyEn:
        input.outsideHoursAutoReplyEn ?? current.outsideHoursAutoReplyEn,
      outsideHoursReplyWithinHours:
        input.outsideHoursReplyWithinHours ?? current.outsideHoursReplyWithinHours,
    };

    const record = await prisma.supportConfig.upsert({
      where: { configKey: 'default' },
      create: {
        configKey: 'default',
        ...next,
        businessHours: next.businessHours as Prisma.InputJsonValue,
      },
      update: {
        ...next,
        businessHours: next.businessHours as Prisma.InputJsonValue,
      },
    });

    return {
      ...this.formatConfig(mapConfigRecord(record)),
      updated_at: record.updatedAt.toISOString(),
    };
  },

  formatConfig(config: SupportConfigValues) {
    return {
      whatsapp_number: config.whatsappNumber,
      email: config.supportEmail,
      whatsapp_template_es: config.whatsappTemplateEs,
      whatsapp_template_en: config.whatsappTemplateEn,
      email_subject_es: config.emailSubjectEs,
      email_subject_en: config.emailSubjectEn,
      email_body_template_es: config.emailBodyTemplateEs,
      email_body_template_en: config.emailBodyTemplateEn,
      business_hours: config.businessHours,
      outside_hours_auto_reply_es: config.outsideHoursAutoReplyEs,
      outside_hours_auto_reply_en: config.outsideHoursAutoReplyEn,
      outside_hours_reply_within_hours: config.outsideHoursReplyWithinHours,
    };
  },

  async listFaqs(query?: string) {
    await seedDefaultsIfEmpty();

    const normalized = query?.trim().toLowerCase();
    const records = await prisma.supportFaqItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    });

    const items = normalized
      ? records.filter(
          (item) =>
            item.questionEs.toLowerCase().includes(normalized) ||
            item.questionEn.toLowerCase().includes(normalized) ||
            item.answerEs.toLowerCase().includes(normalized) ||
            item.answerEn.toLowerCase().includes(normalized) ||
            item.keywords.some((keyword) => keyword.toLowerCase().includes(normalized)),
        )
      : records;

    const grouped = FAQ_CATEGORIES.map((category) => ({
      category: category.id,
      label_es: category.label_es,
      label_en: category.label_en,
      items: items
        .filter((item) => item.category === category.id)
        .map((item) => ({
          id: item.faqKey,
          question_es: item.questionEs,
          question_en: item.questionEn,
          answer_es: item.answerEs,
          answer_en: item.answerEn,
        })),
    })).filter((group) => group.items.length > 0);

    return { categories: grouped, total: items.length };
  },

  async listAllFaqsForAdmin() {
    await seedDefaultsIfEmpty();
    const records = await prisma.supportFaqItem.findMany({
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    });

    return records.map((item) => ({
      id: item.faqKey,
      category: item.category,
      question_es: item.questionEs,
      question_en: item.questionEn,
      answer_es: item.answerEs,
      answer_en: item.answerEn,
      keywords: item.keywords,
      display_order: item.displayOrder,
      is_active: item.isActive,
      updated_at: item.updatedAt.toISOString(),
    }));
  },

  async createFaq(input: {
    id: string;
    category: string;
    questionEs: string;
    questionEn: string;
    answerEs: string;
    answerEn: string;
    keywords?: string[];
    displayOrder?: number;
    isActive?: boolean;
  }) {
    const exists = await prisma.supportFaqItem.findUnique({
      where: { faqKey: input.id },
    });
    if (exists) {
      throw new AppError(409, 'FAQ_EXISTS', 'FAQ id already exists');
    }

    const record = await prisma.supportFaqItem.create({
      data: {
        faqKey: input.id,
        category: input.category,
        questionEs: input.questionEs,
        questionEn: input.questionEn,
        answerEs: input.answerEs,
        answerEn: input.answerEn,
        keywords: input.keywords ?? [],
        displayOrder: input.displayOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });

    return {
      id: record.faqKey,
      category: record.category,
      question_es: record.questionEs,
      question_en: record.questionEn,
      answer_es: record.answerEs,
      answer_en: record.answerEn,
      keywords: record.keywords,
      display_order: record.displayOrder,
      is_active: record.isActive,
      updated_at: record.updatedAt.toISOString(),
    };
  },

  async updateFaq(
    faqKey: string,
    input: Partial<{
      category: string;
      questionEs: string;
      questionEn: string;
      answerEs: string;
      answerEn: string;
      keywords: string[];
      displayOrder: number;
      isActive: boolean;
    }>,
  ) {
    const existing = await prisma.supportFaqItem.findUnique({ where: { faqKey } });
    if (!existing) {
      throw new AppError(404, 'FAQ_NOT_FOUND', 'FAQ not found');
    }

    const record = await prisma.supportFaqItem.update({
      where: { faqKey },
      data: {
        category: input.category,
        questionEs: input.questionEs,
        questionEn: input.questionEn,
        answerEs: input.answerEs,
        answerEn: input.answerEn,
        keywords: input.keywords,
        displayOrder: input.displayOrder,
        isActive: input.isActive,
      },
    });

    return {
      id: record.faqKey,
      category: record.category,
      question_es: record.questionEs,
      question_en: record.questionEn,
      answer_es: record.answerEs,
      answer_en: record.answerEn,
      keywords: record.keywords,
      display_order: record.displayOrder,
      is_active: record.isActive,
      updated_at: record.updatedAt.toISOString(),
    };
  },

  async deleteFaq(faqKey: string) {
    const existing = await prisma.supportFaqItem.findUnique({ where: { faqKey } });
    if (!existing) {
      throw new AppError(404, 'FAQ_NOT_FOUND', 'FAQ not found');
    }

    await prisma.supportFaqItem.delete({ where: { faqKey } });
    return { deleted: true, id: faqKey };
  },

  async recordFaqFeedback(faqKey: string, helpful: boolean) {
    const exists = await prisma.supportFaqItem.findFirst({
      where: { faqKey, isActive: true },
    });
    if (!exists) {
      return { recorded: false };
    }

    await prisma.supportFaqFeedback.create({
      data: { faqKey, helpful },
    });

    return { recorded: true, faq_id: faqKey, helpful };
  },
};
