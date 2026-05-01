// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-11-17.clover',
})

interface CreatePaymentIntentRequest {
  product_id: string
  discount_code?: string
  gift_info?: { recipient_email: string; recipient_name: string; gift_message: string }
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

    const { product_id, discount_code, gift_info }: CreatePaymentIntentRequest = await req.json()

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

    let finalPrice = product.price
    let discountAmount = 0
    let appliedDiscountCodeId = null

    if (discount_code && finalPrice > 0) {
      const { data: discount, error: discountError } = await supabaseClient
        .from('discount_codes')
        .select('*')
        .eq('code', discount_code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle()

      if (!discountError && discount) {
        const now = new Date()
        const isNotExpired = !discount.valid_until || new Date(discount.valid_until) >= now
        const isStarted = !discount.valid_from || new Date(discount.valid_from) <= now
        const isUnderUseLimit = !discount.max_uses || discount.current_uses < discount.max_uses

        if (isNotExpired && isStarted && isUnderUseLimit) {
          if (discount.discount_type === 'percentage') {
            discountAmount = finalPrice * (discount.discount_amount / 100)
          } else if (discount.discount_type === 'fixed') {
            discountAmount = discount.discount_amount
          }
          finalPrice = Math.max(0, finalPrice - discountAmount)
          appliedDiscountCodeId = discount.id
        }
      }
    }

    // Since stripe does not support zero amount payments, we need to handle free purchases
    if (finalPrice <= 0) {
      // Just record a purchase
      const { data: purchase, error: purchaseError } = await supabaseClient
        .from('purchases')
        .insert({
          user_id: user.id,
          product_id: product.id,
          expert_id: product.expert_id,
          amount: 0,
          currency: 'usd',
          payment_method: 'free',
          status: 'completed',
          metadata: {
            product_type: product.product_type,
            product_title: product.title,
            discount_code,
            discount_amount: discountAmount,
            is_gift: !!gift_info,
            gift_recipient_email: gift_info?.recipient_email,
            gift_recipient_name: gift_info?.recipient_name,
            gift_message: gift_info?.gift_message,
          }
        })
        .select()
        .single()

      if (purchaseError) {
        return new Response(JSON.stringify({ error: 'Failed to create free purchase' }), { status: 500, headers: corsHeaders })
      }
      
      if (appliedDiscountCodeId) {
        // Increment use counter
        await supabaseClient.rpc('increment_discount_usage', { discount_id: appliedDiscountCodeId });
      }

      return new Response(JSON.stringify({
        clientSecret: null,
        paymentIntentId: 'free',
        purchaseId: purchase.id,
        amount: 0,
        currency: 'usd',
      }), { headers: corsHeaders, status: 200 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalPrice * 100),
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
        amount: finalPrice,
        currency: 'usd',
        payment_method: 'stripe',
        payment_intent_id: paymentIntent.id,
        status: 'pending',
        metadata: {
          product_type: product.product_type,
          product_title: product.title,
          discount_code,
          discount_amount: discountAmount,
          is_gift: !!gift_info,
          gift_recipient_email: gift_info?.recipient_email,
          gift_recipient_name: gift_info?.recipient_name,
          gift_message: gift_info?.gift_message,
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

    // Increment discount usage counter for paid purchases too
    if (appliedDiscountCodeId) {
      await supabaseClient.rpc('increment_discount_usage', { discount_id: appliedDiscountCodeId });
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        purchaseId: purchase.id,
        amount: finalPrice,
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