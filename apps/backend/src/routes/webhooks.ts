import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tradieProfilesTable, stripeWebhookEventsTable } from "@workspace/db";
import { checkAndUpdateLiveStatus } from "./tradies";
import Stripe from "stripe";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/webhooks/stripe", async (req, res): Promise<void> => {
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (stripe && webhookSecret) {
    const sig = req.headers["stripe-signature"] as string;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      req.log.warn({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  } else {
    event = req.body as Stripe.Event;
  }

  // Idempotency check
  const [existing] = await db.select().from(stripeWebhookEventsTable).where(eq(stripeWebhookEventsTable.id, event.id));
  if (existing) {
    res.json({ message: "Already processed" });
    return;
  }

  await db.insert(stripeWebhookEventsTable).values({
    id: event.id,
    type: event.type,
    payload: JSON.stringify(event),
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tradieId = session.metadata?.tradieId;
        if (tradieId) {
          await db.update(tradieProfilesTable).set({
            paymentConfirmed: true,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: "active",
            updatedAt: new Date(),
          }).where(eq(tradieProfilesTable.id, tradieId));
          await checkAndUpdateLiveStatus(tradieId);
        }
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        const [profile] = await db.select().from(tradieProfilesTable)
          .where(eq(tradieProfilesTable.stripeSubscriptionId, sub.id));
        if (profile) {
          await db.update(tradieProfilesTable).set({
            isLive: false,
            subscriptionStatus: sub.status,
            updatedAt: new Date(),
          }).where(eq(tradieProfilesTable.id, profile.id));
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const [profile] = await db.select().from(tradieProfilesTable)
          .where(eq(tradieProfilesTable.stripeSubscriptionId, sub.id));
        if (profile) {
          await db.update(tradieProfilesTable).set({
            subscriptionStatus: sub.status,
            updatedAt: new Date(),
          }).where(eq(tradieProfilesTable.id, profile.id));
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = (invoice as any).customer as string;
        const [profile] = await db.select().from(tradieProfilesTable)
          .where(eq(tradieProfilesTable.stripeCustomerId, customerId));
        if (profile) {
          await db.update(tradieProfilesTable).set({
            subscriptionStatus: "past_due",
            updatedAt: new Date(),
          }).where(eq(tradieProfilesTable.id, profile.id));
          // TODO: send payment failed email
          req.log.info({ tradieId: profile.id }, "Payment failed for tradie");
        }
        break;
      }
    }
  } catch (err) {
    req.log.error({ err, eventType: event.type }, "Error processing Stripe webhook");
  }

  res.json({ message: "OK" });
});

export default router;
