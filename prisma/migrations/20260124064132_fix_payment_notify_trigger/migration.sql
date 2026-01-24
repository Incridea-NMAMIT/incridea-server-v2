-- Function to notify on payment success
CREATE OR REPLACE FUNCTION notify_payment_success()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify only if status is SUCCESS
  -- AND (It is a new insert OR (It is an update AND old status was NOT success))
  IF NEW.status = 'SUCCESS' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'SUCCESS') THEN
    PERFORM pg_notify('payment_success', NEW."orderId");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
-- (Recreating trigger to ensure it uses the updated function if needed, though replace function mainly does it)
-- Note: Logic is in the function, so just replacing function is enough, but to be sure:
DROP TRIGGER IF EXISTS payment_success_trigger ON "PaymentOrder";
CREATE TRIGGER payment_success_trigger
AFTER INSERT OR UPDATE ON "PaymentOrder"
FOR EACH ROW
EXECUTE FUNCTION notify_payment_success();