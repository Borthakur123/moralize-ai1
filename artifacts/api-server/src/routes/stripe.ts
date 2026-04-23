import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, codersTable, purchasesTable } from "@workspace/db";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";
import type { AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const CREDIT_PACKS = [
  { name: "Starter Pack", posts: 500, price: 500, description: "500 additional posts" },
  { name: "Researcher Pack", posts: 2000, price: 1500, description: "2,000 additional posts" },
  { name: "Pro Pack", posts: 5000, price: 2500, description: "5,000 additional posts" },
];

router.get("/stripe/packs", async (_req, res): Promise<void> => {
  try {
    const stripe = await getUncachableStripeClient();
    const publishableKey = await getStripePublishableKey();

    const products = await stripe.products.list({ active: true, limit: 20 });
    const packs = [];
    for (const product of products.data) {
      const prices = await stripe.prices.list({ product: product.id, active: true });
      for (const price of prices.data) {
        packs.push({
          product_id: product.id,
          name: product.name,
          description: product.description ?? "",
          metadata: product.metadata,
          price_id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
        });
      }
    }
    packs.sort((a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0));

    res.json({ packs, publishableKey });
  } catch (err: any) {
    const publishableKey = await getStripePublishableKey().catch(() => "");
    res.json({ packs: [], publishableKey, error: err?.message });
  }
});

router.get("/stripe/credits", async (req: AuthRequest, res): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [coder] = await db
    .select({ postCredits: codersTable.postCredits })
    .from(codersTable)
    .where(eq(codersTable.userId, req.userId))
    .limit(1);

  res.json({ postCredits: coder?.postCredits ?? 0 });
});

router.post("/stripe/checkout", async (req: AuthRequest, res): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { priceId, postCount } = req.body as { priceId: string; postCount: number };
  if (!priceId || !postCount) {
    res.status(400).json({ error: "priceId and postCount are required" });
    return;
  }

  const stripe = await getUncachableStripeClient();

  let [coder] = await db
    .select({ stripeCustomerId: codersTable.stripeCustomerId, email: codersTable.email })
    .from(codersTable)
    .where(eq(codersTable.userId, req.userId))
    .limit(1);

  let customerId = coder?.stripeCustomerId ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: coder?.email ?? undefined,
      metadata: { userId: req.userId },
    });
    customerId = customer.id;
    await db
      .update(codersTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(codersTable.userId, req.userId));
  }

  const baseUrl = req.headers.origin ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "payment",
    success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/billing`,
    metadata: { userId: req.userId, postCount: String(postCount) },
  });

  res.json({ url: session.url });
});

router.post("/stripe/verify-purchase", async (req: AuthRequest, res): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) { res.status(400).json({ error: "sessionId required" }); return; }

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    res.status(400).json({ error: "Payment not completed" });
    return;
  }

  if (session.metadata?.userId !== req.userId) {
    res.status(403).json({ error: "Session does not belong to this user" });
    return;
  }

  const postCount = parseInt(session.metadata?.postCount ?? "0", 10);
  if (!postCount || postCount <= 0) {
    res.status(400).json({ error: "Invalid post count in session metadata" });
    return;
  }

  const existing = await db
    .select({ id: purchasesTable.id })
    .from(purchasesTable)
    .where(eq(purchasesTable.stripeSessionId, sessionId))
    .limit(1);

  if (existing.length > 0) {
    const [coder] = await db
      .select({ postCredits: codersTable.postCredits })
      .from(codersTable)
      .where(eq(codersTable.userId, req.userId))
      .limit(1);
    res.json({ alreadyProcessed: true, postCredits: coder?.postCredits ?? 0, postCount });
    return;
  }

  await db.insert(purchasesTable).values({
    userId: req.userId,
    stripeSessionId: sessionId,
    postCount,
    amountCents: session.amount_total ?? 0,
  });

  const [updated] = await db
    .update(codersTable)
    .set({ postCredits: sql`${codersTable.postCredits} + ${postCount}` })
    .where(eq(codersTable.userId, req.userId))
    .returning({ postCredits: codersTable.postCredits });

  res.json({ success: true, postCredits: updated?.postCredits ?? postCount, postCount });
});

export default router;
