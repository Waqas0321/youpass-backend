import type { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../common/utils/crypto.js';
import { supportConfigService } from './support-config.service.js';
import { supportService } from './support.service.js';

export const supportController = {
  getContactInfo: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await supportService.getContactInfo();
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listFaqs: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const data = await supportService.listFaqs(q);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  recordFaqFeedback: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const helpful = req.body?.helpful === true;
      const data = await supportService.recordFaqFeedback(String(req.params.id), helpful);
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getWhatsAppTemplate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const context = typeof req.query.context === 'string' ? req.query.context : undefined;
      const data = await supportService.buildWhatsAppTemplate({
        userName: user.fullName,
        phoneDisplay: supportService.formatUserPhone(user.phone, user.countryCode),
        userId: user.id,
        context,
        preferredLanguage: user.preferredLanguage ?? undefined,
      });
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  getEmailTemplate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const context = typeof req.query.context === 'string' ? req.query.context : undefined;
      const data = await supportService.buildEmailTemplate({
        userName: user.fullName,
        phoneDisplay: supportService.formatUserPhone(user.phone, user.countryCode),
        userId: user.id,
        context,
        preferredLanguage: user.preferredLanguage ?? undefined,
      });
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};

export const supportAdminController = {
  getConfig: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await supportConfigService.getConfig();
      res.json(successResponse(supportConfigService.formatConfig(config)));
    } catch (err) {
      next(err);
    }
  },

  updateConfig: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await supportConfigService.updateConfig({
        whatsappNumber: req.body.whatsapp_number,
        supportEmail: req.body.email,
        whatsappTemplateEs: req.body.whatsapp_template_es,
        whatsappTemplateEn: req.body.whatsapp_template_en,
        emailSubjectEs: req.body.email_subject_es,
        emailSubjectEn: req.body.email_subject_en,
        emailBodyTemplateEs: req.body.email_body_template_es,
        emailBodyTemplateEn: req.body.email_body_template_en,
        businessHours: req.body.business_hours,
        outsideHoursAutoReplyEs: req.body.outside_hours_auto_reply_es,
        outsideHoursAutoReplyEn: req.body.outside_hours_auto_reply_en,
        outsideHoursReplyWithinHours: req.body.outside_hours_reply_within_hours,
      });
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  listFaqs: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await supportConfigService.listAllFaqsForAdmin();
      res.json(successResponse({ items: data }));
    } catch (err) {
      next(err);
    }
  },

  createFaq: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await supportConfigService.createFaq({
        id: req.body.id,
        category: req.body.category,
        questionEs: req.body.question_es,
        questionEn: req.body.question_en,
        answerEs: req.body.answer_es,
        answerEn: req.body.answer_en,
        keywords: req.body.keywords,
        displayOrder: req.body.display_order,
        isActive: req.body.is_active,
      });
      res.status(201).json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  updateFaq: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await supportConfigService.updateFaq(String(req.params.id), {
        category: req.body.category,
        questionEs: req.body.question_es,
        questionEn: req.body.question_en,
        answerEs: req.body.answer_es,
        answerEn: req.body.answer_en,
        keywords: req.body.keywords,
        displayOrder: req.body.display_order,
        isActive: req.body.is_active,
      });
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },

  deleteFaq: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await supportConfigService.deleteFaq(String(req.params.id));
      res.json(successResponse(data));
    } catch (err) {
      next(err);
    }
  },
};
