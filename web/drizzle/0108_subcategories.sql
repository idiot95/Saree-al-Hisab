-- Subcategories: one level, and the budget line is the parent's. Then
-- scope: what a category is for, and what may file under it.
--
-- Every rule here looks at another row, so every one is a trigger rather
-- than a CHECK.
-- A category may sit under one that stands on its own — never under another
-- child, and never while it has children of its own. And a budget is written
-- against a parent only: a child's spending rolls up into the parent's line,
-- so a line of its own would count the same rupee twice. Rows a category
-- earned before it moved under a parent are left as they were; they roll up
-- with the rest, so no month changes value.

CREATE OR REPLACE FUNCTION category_one_level() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM category WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'a category sits under one that stands on its own, not under another child';
    END IF;
    IF EXISTS (SELECT 1 FROM category WHERE parent_id = NEW.id) THEN
      RAISE EXCEPTION 'a category with children of its own cannot move under another';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS category_one_level_check ON category;
CREATE TRIGGER category_one_level_check
  BEFORE INSERT OR UPDATE OF parent_id ON category
  FOR EACH ROW EXECUTE FUNCTION category_one_level();

CREATE OR REPLACE FUNCTION budget_on_parent() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM category WHERE id = NEW.category_id AND parent_id IS NOT NULL) THEN
    RAISE EXCEPTION 'a budget line belongs to the parent category; the child rolls up into it';
  END IF;
  -- A budget is a limit on spending; a category that only takes income has
  -- nothing to limit.
  IF EXISTS (SELECT 1 FROM category WHERE id = NEW.category_id AND scope = 'income') THEN
    RAISE EXCEPTION 'a budget line is for spending; this category is for income';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS budget_on_parent_check ON budget;
CREATE TRIGGER budget_on_parent_check
  BEFORE INSERT OR UPDATE OF category_id ON budget
  FOR EACH ROW EXECUTE FUNCTION budget_on_parent();

-- Scope. A category is for spending ('expense'), for income ('income'), or
-- for either ('both'). Salary is not a place rent goes, and Groceries is not
-- a place a salary lands: an income entry or schedule wears an income or
-- both category, and everything else — spending, a refund of it, money laid
-- out for someone — wears an expense or both category. The category row
-- says which; the entry's kind is on another table; so: triggers.
--
-- A child wears its parent's scope, whatever it was told, and follows the
-- parent when the parent changes. A scope may only narrow where nothing
-- already filed under it contradicts the narrower reading — a category with
-- spending in it cannot become "income only" — so no entry is ever left
-- wearing a category that would refuse it today.

CREATE OR REPLACE FUNCTION category_scope_family() RETURNS trigger AS $$
DECLARE
  family uuid[];
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT scope INTO NEW.scope FROM category WHERE id = NEW.parent_id;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.scope <> OLD.scope AND NEW.scope <> 'both' THEN
    family := ARRAY(SELECT id FROM category WHERE id = NEW.id OR parent_id = NEW.id);
    IF NEW.scope = 'income' AND (
         EXISTS (SELECT 1 FROM txn WHERE category_id = ANY(family) AND kind <> 'income')
      OR EXISTS (SELECT 1 FROM schedule WHERE category_id = ANY(family) AND kind <> 'income')
      OR EXISTS (SELECT 1 FROM budget WHERE category_id = ANY(family))) THEN
      RAISE EXCEPTION 'spending is filed under this category, so it cannot be for income only';
    END IF;
    IF NEW.scope = 'expense' AND (
         EXISTS (SELECT 1 FROM txn WHERE category_id = ANY(family) AND kind = 'income')
      OR EXISTS (SELECT 1 FROM schedule WHERE category_id = ANY(family) AND kind = 'income')) THEN
      RAISE EXCEPTION 'income is filed under this category, so it cannot be for spending only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS category_scope_family_check ON category;
CREATE TRIGGER category_scope_family_check
  BEFORE INSERT OR UPDATE OF scope, parent_id ON category
  FOR EACH ROW EXECUTE FUNCTION category_scope_family();

CREATE OR REPLACE FUNCTION category_scope_cascade() RETURNS trigger AS $$
BEGIN
  UPDATE category SET scope = NEW.scope WHERE parent_id = NEW.id AND scope <> NEW.scope;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS category_scope_cascade_after ON category;
CREATE TRIGGER category_scope_cascade_after
  AFTER UPDATE OF scope ON category
  FOR EACH ROW WHEN (OLD.scope IS DISTINCT FROM NEW.scope)
  EXECUTE FUNCTION category_scope_cascade();

CREATE OR REPLACE FUNCTION txn_category_scope() RETURNS trigger AS $$
DECLARE
  s text;
BEGIN
  IF NEW.category_id IS NULL THEN RETURN NEW; END IF;
  SELECT scope INTO s FROM category WHERE id = NEW.category_id;
  IF NEW.kind = 'income' AND s = 'expense' THEN
    RAISE EXCEPTION 'income files under a category for income, not one for spending';
  END IF;
  IF NEW.kind <> 'income' AND s = 'income' THEN
    RAISE EXCEPTION 'spending files under a category for spending, not one for income';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS txn_category_scope_check ON txn;
CREATE TRIGGER txn_category_scope_check
  BEFORE INSERT OR UPDATE OF category_id, kind ON txn
  FOR EACH ROW EXECUTE FUNCTION txn_category_scope();

CREATE OR REPLACE FUNCTION schedule_category_scope() RETURNS trigger AS $$
DECLARE
  s text;
BEGIN
  IF NEW.category_id IS NULL THEN RETURN NEW; END IF;
  SELECT scope INTO s FROM category WHERE id = NEW.category_id;
  IF NEW.kind = 'income' AND s = 'expense' THEN
    RAISE EXCEPTION 'income files under a category for income, not one for spending';
  END IF;
  IF NEW.kind <> 'income' AND s = 'income' THEN
    RAISE EXCEPTION 'spending files under a category for spending, not one for income';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS schedule_category_scope_check ON schedule;
CREATE TRIGGER schedule_category_scope_check
  BEFORE INSERT OR UPDATE OF category_id, kind ON schedule
  FOR EACH ROW EXECUTE FUNCTION schedule_category_scope();

-- Households from before scope existed, whose every category was born
-- 'expense'. Any category with income already filed under it becomes 'both'
-- (or 'income', where nothing else is filed there), so what was recorded
-- stays recordable; and each such household gets the income categories a
-- new one starts with, minus any name it already uses. Only a household
-- with no category yet marked anything but 'expense' qualifies, and after
-- this it has some — so it happens once per household and never touches a
-- scope somebody chose.
DO $$
DECLARE
  h record;
  c record;
  n int;
BEGIN
  FOR h IN
    SELECT id FROM household hh
    WHERE NOT EXISTS (SELECT 1 FROM category WHERE household_id = hh.id AND scope <> 'expense')
  LOOP
    FOR c IN
      SELECT k.id,
        EXISTS (SELECT 1 FROM txn t WHERE t.kind <> 'income'
                  AND t.category_id IN (SELECT id FROM category WHERE id = k.id OR parent_id = k.id)
                UNION ALL SELECT 1 FROM schedule s WHERE s.kind <> 'income'
                  AND s.category_id IN (SELECT id FROM category WHERE id = k.id OR parent_id = k.id)
                UNION ALL SELECT 1 FROM budget b WHERE b.category_id = k.id) AS spent
      FROM category k
      WHERE k.household_id = h.id AND k.parent_id IS NULL
        AND (EXISTS (SELECT 1 FROM txn t WHERE t.kind = 'income'
                       AND t.category_id IN (SELECT id FROM category WHERE id = k.id OR parent_id = k.id))
          OR EXISTS (SELECT 1 FROM schedule s WHERE s.kind = 'income'
                       AND s.category_id IN (SELECT id FROM category WHERE id = k.id OR parent_id = k.id)))
    LOOP
      UPDATE category SET scope = CASE WHEN c.spent THEN 'both' ELSE 'income' END WHERE id = c.id;
    END LOOP;

    SELECT coalesce(max(sort_order), -1) + 1 INTO n FROM category
    WHERE household_id = h.id AND parent_id IS NULL;
    INSERT INTO category (household_id, name, icon, tint, scope, sort_order)
    SELECT h.id, v.name, v.icon, v.tint, 'income', n + v.i
    FROM (VALUES
      ('Salary', 'salary', 'green', 0),
      ('Business', 'briefcase', 'blue', 1),
      ('Rent received', 'building', 'cyan', 2),
      ('Interest & dividends', 'percent', 'indigo', 3),
      ('Gifts received', 'gift', 'pink', 4),
      ('Other income', 'coin', 'orange', 5)) AS v(name, icon, tint, i)
    WHERE NOT EXISTS (SELECT 1 FROM category WHERE household_id = h.id AND name = v.name);
  END LOOP;
END;
$$;
