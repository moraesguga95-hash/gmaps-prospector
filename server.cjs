const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_OWNER_USER_ID', 'APP_API_TOKEN'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length) throw new Error(`Variaveis obrigatorias ausentes: ${missingEnv.join(', ')}`);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ownerUserId = process.env.SUPABASE_OWNER_USER_ID;

// CORS restrito a origem configurada.
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || false, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Health check - para testar se o servidor está vivo
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

app.use('/api', (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (token !== process.env.APP_API_TOKEN) return res.status(401).json({ error: 'Nao autorizado' });
  next();
});

// Rota: Buscar leads do Supabase
app.get('/api/leads', async (req, res) => {
  const { data, error } = await supabase.from('leads').select('*').eq('user_id', ownerUserId).order('score', { ascending: false });
  if (error) return res.status(500).json(error);
  res.json(data || []);
});

// Rota: Iniciar Scraper e Sincronizar com Nuvem
app.post('/api/scrape', (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query necessária' });

  console.log(`🚀 Iniciando varredura: ${query}`);
  res.json({ message: 'Varredura iniciada!', query });

  execFile(process.execPath, ['scraper.cjs'], { cwd: __dirname, env: { ...process.env, QUERIES: query } }, async (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Erro no scraper:', error.message);
      return;
    }
    console.log(stdout);

    const leadsPath = path.join(__dirname, 'public', 'leads.json');
    if (fs.existsSync(leadsPath)) {
      try {
        const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
        console.log(`📤 Enviando ${leads.length} leads para o Supabase...`);

        for (const lead of leads) {
          const { error: upsertErr } = await supabase
            .from('leads')
            .upsert({ ...lead, user_id: ownerUserId }, { onConflict: 'user_id,name' });
          if (upsertErr) console.error('Erro upserting:', lead.name, upsertErr.message);
        }
        console.log('✅ Todos os leads sincronizados com o Supabase!');
      } catch (e) {
        console.error('Erro ao processar leads.json:', e.message);
      }
    }
  });
});

// Rota: Atualizar Status
app.post('/api/leads/update', async (req, res) => {
  const { name, status } = req.body;
  const { error } = await supabase.from('leads').update({ status }).eq('user_id', ownerUserId).eq('name', name);
  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`\n🚀 ============================================`);
  console.log(`   PROSPECTOR SERVER ONLINE na porta ${port}`);
  console.log(`   Aguardando comandos de varredura...`);
  console.log(`🚀 ============================================\n`);
});
