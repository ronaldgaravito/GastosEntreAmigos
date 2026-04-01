-- Crear tabla de grupos
CREATE TABLE groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Crear tabla de amigos
CREATE TABLE friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Crear tabla de gastos
CREATE TABLE expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    paid_by UUID REFERENCES friends(id) ON DELETE
    SET NULL,
        group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
        category TEXT DEFAULT 'Otros',
        created_at TIMESTAMPTZ DEFAULT now()
);
-- Crear tabla de repartición (splits)
CREATE TABLE expense_splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES friends(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========= POLÍTICAS DE SEGURIDAD (RLS) =========
-- Habilitar RLS en las tablas
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- Políticas para groups: El usuario solo ve los grupos que él creó
CREATE POLICY "Manage own groups" ON groups FOR ALL USING (auth.uid() = user_id);

-- Políticas para friends: El usuario puede gestionar amigos de sus grupos
CREATE POLICY "Manage friends in own groups" ON friends FOR ALL USING (
    EXISTS (SELECT 1 FROM groups WHERE groups.id = friends.group_id AND groups.user_id = auth.uid())
);

-- Políticas para expenses: El usuario puede gestionar gastos de sus grupos
CREATE POLICY "Manage expenses in own groups" ON expenses FOR ALL USING (
    EXISTS (SELECT 1 FROM groups WHERE groups.id = expenses.group_id AND groups.user_id = auth.uid())
);

-- Políticas para expense_splits: El usuario puede gestionar reparticiones de sus gastos
CREATE POLICY "Manage splits in own groups" ON expense_splits FOR ALL USING (
    EXISTS (
        SELECT 1 FROM expenses 
        JOIN groups ON expenses.group_id = groups.id 
        WHERE expenses.id = expense_splits.expense_id AND groups.user_id = auth.uid()
    )
);

-- Crear tabla de pagos (liquidaciones)
CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    from_id UUID REFERENCES friends(id) ON DELETE CASCADE,
    to_id UUID REFERENCES friends(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Políticas para payments: El usuario puede gestionar pagos de sus grupos
CREATE POLICY "Manage payments in own groups" ON payments FOR ALL USING (
    EXISTS (SELECT 1 FROM groups WHERE groups.id = payments.group_id AND groups.user_id = auth.uid())
);