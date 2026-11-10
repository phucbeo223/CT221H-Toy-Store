CREATE TABLE IF NOT EXISTS support_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 2000),
  order_id uuid REFERENCES orders(id),
  request_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sender_id,request_key)
);
CREATE INDEX IF NOT EXISTS idx_support_customer ON support_messages(customer_id,id DESC);
