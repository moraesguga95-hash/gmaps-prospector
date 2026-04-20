const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pauyzimjlrjoncbvgkdh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdXl6aW1qbHJqb25jYnZna2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDI2NDksImV4cCI6MjA5MjAxODY0OX0.XUO9j9AYMcB4n-1DpFh5HGLAdah-rVv94BGE3KE7XBE'
);

async function testInsert() {
  // Tenta inserir um lead de teste para ver se a tabela existe
  const { data, error } = await supabase.from('leads').select('*').limit(1);
  if (error) {
    console.log('❌ Tabela leads NÃO existe no Supabase.');
    console.log('Erro:', error.message);
    console.log('\n========================================');
    console.log('AÇÃO NECESSÁRIA: Criar a tabela manualmente');
    console.log('========================================');
    console.log('1. Acesse: https://supabase.com/dashboard');
    console.log('2. Abra seu projeto');
    console.log('3. Clique em "SQL Editor" no menu lateral');
    console.log('4. Cole e execute este SQL:\n');
    console.log(`CREATE TABLE public.leads (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  phone TEXT,
  website TEXT,
  rating REAL,
  score INT DEFAULT 0,
  status TEXT DEFAULT 'Pendente',
  category TEXT,
  reviews INT,
  competitor TEXT,
  "competitorRating" REAL,
  "avgRatingNiche" TEXT,
  "lastUpdated" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.leads FOR ALL USING (true) WITH CHECK (true);`);
  } else {
    console.log('✅ Tabela leads EXISTE! Dados:', data);
  }
}

testInsert();
