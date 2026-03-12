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