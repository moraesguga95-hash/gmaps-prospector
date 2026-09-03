const { createClient } = require('@supabase/supabase-js');

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_OWNER_USER_ID'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length) throw new Error(`Variaveis obrigatorias ausentes: ${missingEnv.join(', ')}`);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function checkDatabase() {
  const { data, error } = await supabase
    .from('leads')
    .select('id,user_id,name')
    .eq('user_id', process.env.SUPABASE_OWNER_USER_ID)
    .limit(1);

  if (error) {
    console.error('Falha ao consultar public.leads:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Tabela leads acessivel pelo backend; ${data.length} registro(s) de amostra.`);
  console.log('Execute a migration em supabase/migrations antes de publicar.');
}

checkDatabase();