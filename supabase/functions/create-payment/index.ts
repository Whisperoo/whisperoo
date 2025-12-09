// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-11-17.clover',
})

interface CreatePaymentIntentRequest {
  product_id: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    const { product_id }: CreatePaymentIntentRequest = await req.json()

    if (!product_id) {
      return new Response(
        JSON.stringify({ error: 'product_id is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('id, expert_id, title, price, product_type')
      .eq('id', product_id)
      .eq('is_active', true)
      .single()

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found or inactive' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(product.price * 100),
      currency: 'usd',
      metadata: {
        product_id: product.id,
        user_id: user.id,
        expert_id: product.expert_id,
        product_type: product.product_type,
      },
      description: `Purchase: ${product.title}`,
    })

    const { data: purchase, error: purchaseError } = await supabaseClient
      .from('purchases')
      .insert({
        user_id: user.id,
        product_id: product.id,
        expert_id: product.expert_id,
        amount: product.price,
        currency: 'usd',
        payment_method: 'stripe',
        payment_intent_id: paymentIntent.id,
        status: 'pending',
        metadata: {
          product_type: product.product_type,
          product_title: product.title,
        }
      })
      .select()
      .single()

    if (purchaseError) {
      console.error('Error creating purchase:', purchaseError)
      await stripe.paymentIntents.cancel(paymentIntent.id)
      return new Response(
        JSON.stringify({ error: 'Failed to create purchase record' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        purchaseId: purchase.id,
        amount: product.price,
        currency: 'usd',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})