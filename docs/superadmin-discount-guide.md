# Super Admin Guide: Discount & Promo Codes

This guide explains how to create and use discount codes in Whisperoo without any technical setup.

## What This Feature Does

- Lets Super Admins create promo codes (example: `MOM25`).
- Applies either:
  - **Percentage discount** (for example, 25% off), or
  - **Fixed discount** (for example, $20 off).
- Applies the discount during Stripe checkout before the customer pays.
- Tracks usage count automatically.

## Where To Manage Codes

1. Open **Super Admin Portal**.
2. Go to the **Discounts** tab.
3. Use the form at the top to create or edit a code.

## Fields Explained (Simple)

- **Code**: The promo code users type at checkout (for example `WELCOME10`).
- **Type**:
  - `Percentage` means percent off.
  - `Fixed` means fixed USD amount off.
- **Amount**:
  - If Percentage: use numbers like `10`, `25`, `50`.
  - If Fixed: use dollar amount like `5`, `20`, `40`.
- **Max uses** (optional): total number of times this code can be used.
- **Valid from** (optional): code starts working at this date/time.
- **Valid until** (optional): code stops working after this date/time.
- **Active code**:
  - On = users can use it (if dates/limits are valid).
  - Off = users cannot use it.

## Typical Workflow

1. Create code (example: `SPRING20`).
2. Set Type = Percentage, Amount = 20.
3. Set optional end date.
4. Keep Active enabled.
5. Share this code with users.

## What Happens at Checkout

1. User enters promo code and clicks **Apply**.
2. System validates:
   - code exists,
   - code is active,
   - current date is inside allowed window,
   - usage limit not exceeded.
3. If valid, discounted total is used to create Stripe PaymentIntent.
4. Purchase record stores discount info for audit/reporting.

## Stripe Notes

- Discounts are applied in Whisperoo backend before Stripe charge is created.
- Stripe receives the final discounted amount.
- If discount makes total `0`, purchase is completed as a free purchase (no card charge).

## Common Mistakes To Avoid

- Percentage above 100 (not allowed).
- Code inactive by mistake.
- End date already passed.
- Max uses too low for campaign size.

## Quick Troubleshooting

- **“Invalid code”**: check spelling and active status.
- **“Code expired”**: extend valid-until date or create new code.
- **“Usage limit reached”**: increase limit or create a new code.
- **Payment form error**: check Stripe key mode (test vs live) consistency.
