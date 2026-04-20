const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

const supabaseUrl = 'https://pauyzimjlrjoncbvgkdh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdXl6aW1qbHJqb25jYnZna2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDI2NDksImV4cCI6MjA5MjAxODY0OX0.XUO9j9AYMcB4n-1DpFh5HGLAdah-rVv94BGE3KE7XBE';
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS aberto para qualquer origem (Vercel, celular, etc.)
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'bypass-tunnel-reminder'] }));
app.use(express.json());

// Health check - para testar se o servidor está vivo
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// Rota: Buscar leads do Supabase
app.get('/api/leads', async (req, res) => {
  const { data, error } = await supabase.from('leads').select('*').order('score', { ascending: false });
  if (error) return res.status(500).json(error);
  res.json(data || []);
});

// Rota: Iniciar Scraper e Sincronizar com Nuvem
app.post('/api/scrape', (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query necessária' });

  console.log(`🚀 Iniciando varredura: ${query}`);
  res.json({ message: 'Varredura iniciada!', query });

  exec(`node scraper.cjs "${query}"`, { cwd: __dirname }, async (error, stdout, stderr) => {
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
            .upsert(lead, { onConflict: 'name' });
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
  const { error } = await supabase.from('leads').update({ status }).eq('name', name);
  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`\n🚀 ============================================`);
  console.log(`   PROSPECTOR SERVER ONLINE na porta ${port}`);
  console.log(`   Aguardando comandos de varredura...`);
  console.log(`🚀 ============================================\n`);
});
