/* capture_lookup (0112) now answers every refusal the endpoint makes about who
   is asking in one query: the token is live AND its person is still a member
   of that household AND not a viewer. A token issued to someone since removed,
   or dropped to viewer, returns no row, exactly like an unknown or revoked one,
   so the endpoint cannot be timed into saying which it was.

   Same signature and return type, so CREATE OR REPLACE keeps the owner, the
   SECURITY DEFINER, and the grants 0112 made (execute for saree_app only).
   They are restated anyway so this file stands alone. Idempotent. */
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
