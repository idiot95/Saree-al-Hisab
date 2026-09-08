ALTER TABLE account ADD COLUMN bank_key text;
ALTER TABLE account ADD COLUMN card_network text;

ALTER TABLE account DROP CONSTRAINT card_fields_only_on_credit;
ALTER TABLE account ADD CONSTRAINT card_fields_only_on_credit CHECK (
  kind = 'credit' OR (
    credit_limit IS NULL AND statement_day IS NULL AND due_day IS NULL
    AND bank_key IS NULL AND card_network IS NULL
  )
);
ALTER TABLE account ADD CONSTRAINT bank_key_is_named CHECK (
  bank_key IS NULL OR bank_key IN ('hdfc','icici','sbi','axis','other')
);
ALTER TABLE account ADD CONSTRAINT card_network_is_named CHECK (
  card_network IS NULL OR card_network IN ('visa','mastercard','amex','rupay')
);
