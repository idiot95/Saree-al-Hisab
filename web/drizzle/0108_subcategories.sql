-- Subcategories: one level, and the budget line is the parent's.
--
-- Both rules look at another row, so both are triggers rather than CHECKs.
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS budget_on_parent_check ON budget;
CREATE TRIGGER budget_on_parent_check
  BEFORE INSERT OR UPDATE OF category_id ON budget
  FOR EACH ROW EXECUTE FUNCTION budget_on_parent();
