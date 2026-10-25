-- Job completion stock deduction + purchase without color updates material total

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION sync_material_total_stock(material_uuid UUID, owner_uuid UUID)
RETURNS void AS $$
BEGIN
  IF material_uuid IS NULL THEN
    RETURN;
  END IF;
  UPDATE materials m
  SET stock_grams = COALESCE((
    SELECT SUM(mc.stock_grams)::INTEGER
    FROM material_colors mc
    WHERE mc.material_id = material_uuid AND mc.user_id = owner_uuid
  ), 0)
  WHERE m.id = material_uuid AND m.user_id = owner_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION apply_purchase_stock_delta()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.material_color_id IS NOT NULL AND NEW.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
      PERFORM sync_material_total_stock(NEW.material_id, NEW.user_id);
    ELSIF NEW.material_color_id IS NULL AND NEW.grams > 0 THEN
      UPDATE materials
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.material_color_id IS NOT NULL AND OLD.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
      PERFORM sync_material_total_stock(OLD.material_id, OLD.user_id);
    ELSIF OLD.material_color_id IS NULL AND OLD.grams > 0 THEN
      UPDATE materials
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_id AND user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.material_color_id IS NOT NULL AND OLD.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
    END IF;
    IF OLD.material_color_id IS NULL AND OLD.grams > 0 THEN
      UPDATE materials
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_id AND user_id = OLD.user_id;
    END IF;
    IF NEW.material_color_id IS NOT NULL AND NEW.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
      PERFORM sync_material_total_stock(NEW.material_id, NEW.user_id);
    ELSIF NEW.material_color_id IS NULL AND NEW.grams > 0 THEN
      UPDATE materials
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION jobs_apply_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  grams INT;
BEGIN
  grams := COALESCE(NEW.grams_used, 0);

  IF TG_OP = 'UPDATE' AND OLD.stock_deducted AND NEW.status IS DISTINCT FROM 'completed' THEN
    IF OLD.material_color_id IS NOT NULL AND COALESCE(OLD.grams_used, 0) > 0 THEN
      UPDATE material_colors
      SET stock_grams = stock_grams + OLD.grams_used
      WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
      PERFORM sync_material_total_stock(OLD.material_id, OLD.user_id);
    END IF;
    NEW.stock_deducted := false;
  END IF;

  IF NEW.status = 'completed' AND NOT NEW.stock_deducted
     AND NEW.material_color_id IS NOT NULL AND grams > 0 THEN
    UPDATE material_colors
    SET stock_grams = GREATEST(0, stock_grams - grams)
    WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
    PERFORM sync_material_total_stock(NEW.material_id, NEW.user_id);
    NEW.stock_deducted := true;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.stock_deducted AND NEW.stock_deducted THEN
    IF OLD.material_color_id IS DISTINCT FROM NEW.material_color_id
       OR COALESCE(OLD.grams_used, 0) IS DISTINCT FROM COALESCE(NEW.grams_used, 0) THEN
      IF OLD.material_color_id IS NOT NULL AND COALESCE(OLD.grams_used, 0) > 0 THEN
        UPDATE material_colors
        SET stock_grams = stock_grams + OLD.grams_used
        WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
      END IF;
      IF NEW.material_color_id IS NOT NULL AND grams > 0 THEN
        UPDATE material_colors
        SET stock_grams = GREATEST(0, stock_grams - grams)
        WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
      ELSE
        NEW.stock_deducted := false;
      END IF;
      PERFORM sync_material_total_stock(NEW.material_id, NEW.user_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS jobs_stock_on_change ON jobs;
CREATE TRIGGER jobs_stock_on_change
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION jobs_apply_stock_change();
