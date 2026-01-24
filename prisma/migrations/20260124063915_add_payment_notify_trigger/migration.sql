-- Function to notify on payment success
CREATE OR REPLACE FUNCTION notify_payment_success()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUCCESS' THEN
    PERFORM pg_notify('payment_success', NEW."orderId");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
DROP TRIGGER IF EXISTS payment_success_trigger ON "PaymentOrder";
CREATE TRIGGER payment_success_trigger
AFTER INSERT OR UPDATE ON "PaymentOrder"
FOR EACH ROW
EXECUTE FUNCTION notify_payment_success();