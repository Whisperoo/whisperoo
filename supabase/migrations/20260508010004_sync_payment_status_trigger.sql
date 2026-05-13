-- This trigger ensures that when a purchase is marked as completed (e.g. by Stripe Webhook),
-- the associated consultation booking automatically updates its payment_status to 'paid'.

CREATE OR REPLACE FUNCTION sync_consultation_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act if the status changed to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE consultation_bookings
    SET payment_status = CASE 
      WHEN NEW.amount > 0 THEN 'paid'
      ELSE 'free'
    END
    WHERE purchase_id = NEW.id;
  END IF;
  
  -- Handle refunds
  IF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    UPDATE consultation_bookings
    SET payment_status = 'refunded'
    WHERE purchase_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_consultation_payment ON purchases;
CREATE TRIGGER trigger_sync_consultation_payment
AFTER UPDATE OF status ON purchases
FOR EACH ROW
EXECUTE PROCEDURE sync_consultation_payment_status();
