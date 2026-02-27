ALTER TABLE clients
ADD COLUMN IF NOT EXISTS switch_satik BOOLEAN DEFAULT FALSE;

UPDATE clients
SET switch_satik = COALESCE(switch_satik, FALSE)
WHERE switch_satik IS NULL;
