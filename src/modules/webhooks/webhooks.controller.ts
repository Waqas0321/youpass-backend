import type { Request, Response, NextFunction } from 'express';
import { ticketOrdersService } from '../ticket-orders/ticket-orders.service.js';
import {
  handleMetaWhatsAppWebhookPayload,
  isValidMetaWhatsAppSignature,
  verifyMetaWhatsAppWebhook,
} from './meta-whatsapp-webhook.service.js';

export const webhooksController = {
  /** Meta Cloud API — webhook verification handshake */
  whatsappVerify: (req: Request, res: Response) => {
    const result = verifyMetaWhatsAppWebhook({
      'hub.mode': typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : undefined,
      'hub.verify_token':
        typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : undefined,
      'hub.challenge':
        typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : undefined,
    });

    if (!result.ok) {
      res.status(result.status).type('text/plain').send(result.error);
      return;
    }

    res.status(200).type('text/plain').send(result.challenge);
  },

  /** Meta Cloud API — message / status callbacks */
  whatsapp: (req: Request, res: Response) => {
    const signature = req.header('x-hub-signature-256') ?? undefined;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? JSON.stringify(req.body ?? {});

    if (!isValidMetaWhatsAppSignature(rawBody, signature)) {
      res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      return;
    }

    try {
      handleMetaWhatsAppWebhookPayload(req.body);
    } catch (err) {
      console.error('[Meta WhatsApp webhook] handler error:', err);
    }

    // Always 200 quickly so Meta does not retry aggressively
    res.status(200).json({ success: true });
  },

  klap: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = String(req.body?.order_id ?? req.body?.reference ?? '');
      if (orderId && req.body?.status === 'paid') {
        await ticketOrdersService.fulfillPendingOrder(orderId);
      }
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },

  stripe: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = req.body;
      const intent = event?.data?.object;
      const orderId = intent?.metadata?.order_id;
      if (event?.type === 'payment_intent.succeeded' && orderId) {
        await ticketOrdersService.fulfillPendingOrder(String(orderId));
      }
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },

  kushki: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body ?? {};
      const orderId = String(
        body.order_id ??
          body.metadata?.order_id ??
          body.transaction?.metadata?.order_id ??
          '',
      );
      const status = String(
        body.status ?? body.transactionStatus ?? body.transaction_status ?? '',
      ).toLowerCase();
      const approved =
        status === 'paid' ||
        status === 'approved' ||
        status === 'success' ||
        body.approved === true;

      if (orderId && approved) {
        await ticketOrdersService.fulfillPendingOrder(orderId);
      }
      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  },
};
