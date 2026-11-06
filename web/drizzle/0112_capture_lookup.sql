/* How the SMS capture endpoint finds the household a bearer token belongs to.

   capture_token is under a plain household policy (0109): unscoped, the app
   role sees, changes and deletes none of it. But the endpoint holds only the
   token, so it cannot name a household yet. This function is that one door: it
   takes the SHA-256 hex of the token and returns at most one row, id, user and
   household, for a token that has not been revoked. It returns nothing else
   (no label, no hash, no other household's token), and an unknown or revoked
   hash returns no row.

   SECURITY DEFINER, so it runs as the owner, which bypasses row security.
   search_path is pinned so a caller cannot shadow a table or operator. Execute
   is for saree_app only, not PUBLIC.

   last_used_at is deliberately NOT written from here. The endpoint (Task 21)
   scopes its transaction to the household this returns, then updates
   last_used_at under the normal policy, so the definer function stays a
   read-only lookup. Idempotent. */
CREATE OR REPLACE FUNCTION capture_lookup(p_hash text)
RETURNS TABLE (id uuid, user_id uuid, household_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id, t.user_id, t.household_id
  FROM capture_token t
  WHERE t.token_hash = p_hash AND t.revoked_at IS NULL
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION capture_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_lookup(text) TO saree_app;
