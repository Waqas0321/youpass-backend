import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { successResponse } from '../../common/utils/crypto.js';
import { ticketOrdersService } from '../ticket-orders/ticket-orders.service.js';
import {
  chargeKushkiCardToken,
  createKushkiSubscription,
  isKushkiConfigured,
} from './kushki.client.js';
import { env } from '../../config/env.js';

const chargeOrderSchema = z.object({
  order_id: z.string().min(1),
  session_id: z.string().optional(),
  token: z.string().min(1),
});

const completeTokenizeSchema = z.object({
  token: z.string().min(1),
  brand: z.string().min(2).max(30),
  last_four: z.string().regex(/^\d{4}$/),
  cardholder_name: z.string().min(2).max(200),
  expiration_month: z.coerce.number().int().min(1).max(12).optional(),
  expiration_year: z.coerce.number().int().min(2000).max(2100).optional(),
  currency: z.string().length(3).optional(),
});

export const kushkiPaymentsController = {
  /** Called by the hosted Kushki checkout page after client-side tokenization. */
  chargeOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = chargeOrderSchema.parse(req.body);
      const order = await prisma.ticketOrder.findUnique({
        where: { id: body.order_id },
        include: {
          buyer: { select: { email: true, fullName: true } },
        },
      });

      if (!order || order.status !== 'pending_payment') {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Pending order not found');
      }

      let paymentReference: string;
      if (isKushkiConfigured() && !body.token.startsWith('kushki_tok_')) {
        const charge = await chargeKushkiCardToken({
          token: body.token,
          amount: order.totalAmount,
          currency: order.currency,
          orderId: order.id,
          email: order.buyer.email ?? undefined,
          fullName: order.buyer.fullName ?? undefined,
        });
        paymentReference = charge.ticketNumber;
      } else {
        paymentReference = `kushki_mock_${body.order_id.slice(-8)}`;
      }

      await prisma.ticketOrder.update({
        where: { id: order.id },
        data: { paymentReference },
      });
      await ticketOrdersService.fulfillPendingOrder(order.id);

      res.json(
        successResponse({
          order_id: order.id,
          status: 'paid',
          payment_reference: paymentReference,
          gateway: 'kushki',
        }),
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Optional authenticated helper: convert a subscription token into a Kushki
   * subscription id before saving the wallet card.
   */
  completeTokenize: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = completeTokenizeSchema.parse(req.body);
      const userId = req.user!.id;
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true, fullName: true, countryCode: true },
      });

      let paymentMethodId = body.token;
      if (isKushkiConfigured() && !body.token.startsWith('kushki_tok_')) {
        const subscription = await createKushkiSubscription({
          token: body.token,
          currency: (body.currency ?? 'CLP').toUpperCase(),
          email: user.email ?? undefined,
          fullName: user.fullName ?? undefined,
        });
        paymentMethodId = subscription.subscriptionId;
      }

      res.json(
        successResponse({
          payment_method_id: paymentMethodId,
          gateway: 'kushki',
          brand: body.brand,
          last_four: body.last_four,
          cardholder_name: body.cardholder_name,
          expiration_month: body.expiration_month,
          expiration_year: body.expiration_year,
          environment: env.KUSHKI_USE_UAT ? 'uat' : 'live',
        }),
      );
    } catch (err) {
      next(err);
    }
  },
};
