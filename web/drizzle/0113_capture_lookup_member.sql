/* How the SMS capture endpoint finds the household a bearer token belongs to.
   (This was 0112 without the member check; folded in here so no run of the
   migrator ever has the weaker definition live, even for a moment.)

   capture_token is under a plain household policy (0109): unscoped, the app
   role sees, changes and deletes none of it. But the endpoint holds only the
   token, so it cannot name a household yet. This function is that one door: it
   takes the SHA-256 hex of the token and returns at most one row, id, user and
   household. It returns nothing else (no label, no hash, no other household's
   token).

   It answers every refusal the endpoint makes about who is asking in one
   query: the token is not revoked AND its person is still a member of that
   household AND not a viewer. An unknown, revoked, removed or viewer token all
   return no row alike, so the endpoint cannot be timed into saying which.

   SECURITY DEFINER, so it runs as the owner, which bypasses row security.
   search_path is pinned so a caller cannot shadow a table or operator. Execute
   is for saree_app only, not PUBLIC.

   last_used_at is deliberately NOT written from here. The endpoint scopes its
   transaction to the household this returns, then updates last_used_at under
   the normal policy, so the definer function stays a read-only lookup.
   Idempotent: same signature and return type, so CREATE OR REPLACE keeps the
   owner and the grants, which are restated anyway. */
CREATE OR REPLACE FUNCTION capture_lookup(p_hash text)
RETURNS TABLE (id uuid, user_id uuid, household_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id, t.user_id, t.household_id
  FROM capture_token t
  JOIN member m ON m.user_id = t.user_id AND m.household_id = t.household_id
  WHERE t.token_hash = p_hash AND t.revoked_at IS NULL AND m.role <> 'viewer'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION capture_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_lookup(text) TO saree_app;
