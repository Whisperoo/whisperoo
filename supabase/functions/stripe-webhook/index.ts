// File: supabase/functions/stripe-webhook/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.11.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-11-17.clover",
});

// Use SERVICE ROLE key for admin database access
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", // CRITICAL: Use service role key
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // 1. Get the signature from the Stripe header
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response("No stripe signature", { status: 400 });
    }

    // 2. Get the raw body for verification
    const rawBody = await req.text();

    // 3. Verify webhook signature using the secret
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_PROD");
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`Processing event type: ${event.type}`);

    // 4. Handle the event
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent ${paymentIntent.id} succeeded`);

        // Update purchase record
        const { error: updateError } = await supabaseAdmin
          .from("purchases")
          .update({
            status: "succeeded",
            payment_method: paymentIntent.payment_method_types?.[0] || "card",
            metadata: {
              ...paymentIntent.metadata,
              stripe_customer: paymentIntent.customer,
              payment_method_details: paymentIntent.payment_method_types,
            },
          })
          .eq("payment_intent_id", paymentIntent.id);

        if (updateError) {
          console.error("Failed to update purchase:", updateError);
          throw updateError;
        }

        // Grant user access to the product
        const userId = paymentIntent.metadata.user_id;
        const productId = paymentIntent.metadata.product_id;

        if (userId && productId) {
          // Insert into user_products or similar table
          const { error: accessError } = await supabaseAdmin
            .from("user_products") // Adjust to your table name
            .upsert({
              user_id: userId,
              product_id: productId,
              purchased_at: new Date().toISOString(),
              purchase_id: paymentIntent.id,
            });

          if (accessError) {
            console.error("Failed to grant product access:", accessError);
          }
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent ${paymentIntent.id} failed`);

        await supabaseAdmin
          .from("purchases")
          .update({
            status: "failed",
            failure_reason: paymentIntent.last_payment_error?.message,
          })
          .eq("payment_intent_id", paymentIntent.id);

        break;
      }

      // Add more event types as needed
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // 5. Return success response
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
