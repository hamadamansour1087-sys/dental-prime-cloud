
-- ============== SUPPLIERS ==============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  opening_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read suppliers" ON public.suppliers FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "lab members insert suppliers" ON public.suppliers FOR INSERT WITH CHECK (is_lab_member(lab_id));
CREATE POLICY "lab members update suppliers" ON public.suppliers FOR UPDATE USING (is_lab_member(lab_id));
CREATE POLICY "managers delete suppliers" ON public.suppliers FOR DELETE USING (is_lab_manager_or_admin(lab_id));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== INVENTORY ITEMS ==============
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  unit text NOT NULL DEFAULT 'قطعة',
  category text,
  current_stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read items" ON public.inventory_items FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "lab members insert items" ON public.inventory_items FOR INSERT WITH CHECK (is_lab_member(lab_id));
CREATE POLICY "lab members update items" ON public.inventory_items FOR UPDATE USING (is_lab_member(lab_id));
CREATE POLICY "managers delete items" ON public.inventory_items FOR DELETE USING (is_lab_manager_or_admin(lab_id));
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== PURCHASE INVOICES ==============
CREATE TABLE public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read pinv" ON public.purchase_invoices FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "lab members insert pinv" ON public.purchase_invoices FOR INSERT WITH CHECK (is_lab_member(lab_id));
CREATE POLICY "lab members update pinv" ON public.purchase_invoices FOR UPDATE USING (is_lab_member(lab_id));
CREATE POLICY "managers delete pinv" ON public.purchase_invoices FOR DELETE USING (is_lab_manager_or_admin(lab_id));
CREATE TRIGGER trg_pinv_updated BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.purchase_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read pinv_items" ON public.purchase_invoice_items FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "lab members insert pinv_items" ON public.purchase_invoice_items FOR INSERT WITH CHECK (is_lab_member(lab_id));
CREATE POLICY "lab members update pinv_items" ON public.purchase_invoice_items FOR UPDATE USING (is_lab_member(lab_id));
CREATE POLICY "lab members delete pinv_items" ON public.purchase_invoice_items FOR DELETE USING (is_lab_member(lab_id));

-- ============== INVENTORY MOVEMENTS ==============
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in','out','adjust')),
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  reference_type text,
  reference_id uuid,
  notes text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read mv" ON public.inventory_movements FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "lab members insert mv" ON public.inventory_movements FOR INSERT WITH CHECK (is_lab_member(lab_id));
CREATE POLICY "managers delete mv" ON public.inventory_movements FOR DELETE USING (is_lab_manager_or_admin(lab_id));

-- Auto-update inventory_items.current_stock from movements
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type = 'in' THEN
      UPDATE inventory_items SET current_stock = current_stock + NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.movement_type = 'out' THEN
      UPDATE inventory_items SET current_stock = current_stock - NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.movement_type = 'adjust' THEN
      UPDATE inventory_items SET current_stock = NEW.quantity WHERE id = NEW.item_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.movement_type = 'in' THEN
      UPDATE inventory_items SET current_stock = current_stock - OLD.quantity WHERE id = OLD.item_id;
    ELSIF OLD.movement_type = 'out' THEN
      UPDATE inventory_items SET current_stock = current_stock + OLD.quantity WHERE id = OLD.item_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_apply_mv AFTER INSERT OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();

-- ============== SUPPLIER PAYMENTS ==============
CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  notes text,
  cash_account_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read sp" ON public.supplier_payments FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "lab members insert sp" ON public.supplier_payments FOR INSERT WITH CHECK (is_lab_member(lab_id));
CREATE POLICY "lab members update sp" ON public.supplier_payments FOR UPDATE USING (is_lab_member(lab_id));
CREATE POLICY "managers delete sp" ON public.supplier_payments FOR DELETE USING (is_lab_manager_or_admin(lab_id));
CREATE TRIGGER trg_sp_updated BEFORE UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== CASH ACCOUNTS (الخزن) ==============
CREATE TABLE public.cash_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash','bank','wallet')),
  currency text NOT NULL DEFAULT 'EGP',
  opening_balance numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read ca" ON public.cash_accounts FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "managers insert ca" ON public.cash_accounts FOR INSERT WITH CHECK (is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers update ca" ON public.cash_accounts FOR UPDATE USING (is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers delete ca" ON public.cash_accounts FOR DELETE USING (is_lab_manager_or_admin(lab_id));
CREATE TRIGGER trg_ca_updated BEFORE UPDATE ON public.cash_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add FK for supplier_payments.cash_account_id now that table exists
ALTER TABLE public.supplier_payments ADD CONSTRAINT supplier_payments_cash_account_fk
  FOREIGN KEY (cash_account_id) REFERENCES public.cash_accounts(id) ON DELETE SET NULL;

-- Add cash_account_id to existing payments table (doctor payments)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS cash_account_id uuid REFERENCES public.cash_accounts(id) ON DELETE SET NULL;

-- ============== EXPENSE CATEGORIES ==============
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read ec" ON public.expense_categories FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "managers manage ec" ON public.expense_categories FOR ALL USING (is_lab_manager_or_admin(lab_id)) WITH CHECK (is_lab_manager_or_admin(lab_id));

-- ============== EXPENSES ==============
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  cash_account_id uuid REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read exp" ON public.expenses FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "lab members insert exp" ON public.expenses FOR INSERT WITH CHECK (is_lab_member(lab_id));
CREATE POLICY "managers update exp" ON public.expenses FOR UPDATE USING (is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers delete exp" ON public.expenses FOR DELETE USING (is_lab_manager_or_admin(lab_id));
CREATE TRIGGER trg_exp_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== VOUCHERS (سندات قبض/صرف) ==============
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  voucher_type text NOT NULL CHECK (voucher_type IN ('receipt','payment')),
  voucher_number text NOT NULL,
  voucher_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  cash_account_id uuid REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
  party_type text CHECK (party_type IN ('doctor','supplier','other')),
  party_doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  party_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  party_name text,
  description text NOT NULL,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab members read vch" ON public.vouchers FOR SELECT USING (is_lab_member(lab_id));
CREATE POLICY "lab members insert vch" ON public.vouchers FOR INSERT WITH CHECK (is_lab_member(lab_id));
CREATE POLICY "managers update vch" ON public.vouchers FOR UPDATE USING (is_lab_manager_or_admin(lab_id));
CREATE POLICY "managers delete vch" ON public.vouchers FOR DELETE USING (is_lab_manager_or_admin(lab_id));
CREATE TRIGGER trg_vch_updated BEFORE UPDATE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_suppliers_lab ON public.suppliers(lab_id);
CREATE INDEX idx_items_lab ON public.inventory_items(lab_id);
CREATE INDEX idx_pinv_lab ON public.purchase_invoices(lab_id, invoice_date DESC);
CREATE INDEX idx_pinv_supplier ON public.purchase_invoices(supplier_id);
CREATE INDEX idx_mv_item ON public.inventory_movements(item_id, movement_date DESC);
CREATE INDEX idx_sp_supplier ON public.supplier_payments(supplier_id, payment_date DESC);
CREATE INDEX idx_exp_lab ON public.expenses(lab_id, expense_date DESC);
CREATE INDEX idx_vch_lab ON public.vouchers(lab_id, voucher_date DESC);
