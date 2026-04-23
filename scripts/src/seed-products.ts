import { getUncachableStripeClient } from "./stripeClient.js";

const CREDIT_PACKS = [
  { name: "Starter Pack", posts: 500, priceCents: 500, description: "500 additional posts for your research corpus" },
  { name: "Researcher Pack", posts: 2000, priceCents: 1500, description: "2,000 additional posts for your research corpus" },
  { name: "Pro Pack", posts: 5000, priceCents: 2500, description: "5,000 additional posts for your research corpus" },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  console.log("Creating MoralizeAI credit packs in Stripe...");

  for (const pack of CREDIT_PACKS) {
    const existing = await stripe.products.search({
      query: `name:'${pack.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`✓ "${pack.name}" already exists (${existing.data[0].id})`);
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
      if (prices.data.length > 0) {
        console.log(`  Price: $${prices.data[0].unit_amount! / 100} (${prices.data[0].id})`);
      }
      continue;
    }

    const product = await stripe.products.create({
      name: pack.name,
      description: pack.description,
      metadata: { postCount: String(pack.posts) },
    });
    console.log(`Created product: "${pack.name}" (${product.id})`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.priceCents,
      currency: "usd",
      metadata: { postCount: String(pack.posts) },
    });
    console.log(`  Price: $${pack.priceCents / 100} (${price.id})`);
  }

  console.log("\nDone! Credit packs are ready in Stripe.");
}

seedProducts().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
