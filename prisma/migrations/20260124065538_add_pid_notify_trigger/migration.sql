-- Function to notify on PID generation
CREATE OR REPLACE FUNCTION notify_pid_generated()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify with UserID (easier to fetch user details or link back to payment)
  PERFORM pg_notify('pid_generated', NEW."userId"::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
DROP TRIGGER IF EXISTS pid_generated_trigger ON "PID";
CREATE TRIGGER pid_generated_trigger
AFTER INSERT ON "PID"
FOR EACH ROW
EXECUTE FUNCTION notify_pid_generated();