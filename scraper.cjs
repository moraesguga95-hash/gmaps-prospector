const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 INICIANDO VARREDURA ULTRA v18.0...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });
  const page = await browser.newPage();
  
  const baseQuery = process.env.QUERIES || 'Dentistas em Pouso Alegre';
  const queries = [baseQuery];

  for (const query of queries) {
    console.log(`🔎 Mapeando: ${query}...`);
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 60000 });

    // Aguarda a lista de resultados aparecer
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    } catch (e) {
      console.log("⚠️ Lista de resultados demorou a carregar ou não existe.");
    }

    // SCROLL PROFUNDO
    console.log("📜 Iniciando rolagem profunda para capturar todos os leads...");
    await page.evaluate(async () => {
      const container = document.querySelector('div[role="feed"]');
      if (!container) return;
      
      let lastHeight = 0;
      for(let i=0; i<15; i++) { // Tenta rolar 15 vezes
        container.scrollBy(0, 1000);
        await new Promise(r => setTimeout(r, 1500));
        let newHeight = container.scrollHeight;
        if (newHeight === lastHeight) break;
        lastHeight = newHeight;
      }
    });

    console.log("🧬 Extraindo dados com novos seletores...");
    const leads = await page.evaluate(() => {
      // Novas classes identificadas em 2026
      return Array.from(document.querySelectorAll('div.Nv2Y3c, .Nv2Yp')).map(el => {
        const name = el.querySelector('div.fontHeadlineSmall')?.innerText || el.querySelector('.qBF1Pd')?.innerText;
        const rating = el.querySelector('span.MW4etd')?.innerText || el.querySelector('.MW4etd')?.innerText;
        const website = el.querySelector('a.lcr4fd')?.href || el.querySelector('a[aria-label*="Website"]')?.href;
        
        // O telefone geralmente está em um span específico ou dentro de um bloco de texto
        const phone = el.querySelector('span.Us7fWe')?.innerText || el.innerText.match(/\(\d{2}\)\s\d{4,5}-\d{4}/)?.[0];

        const category = el.innerText.split('\n')[2] || "Empresa";

        return { name, phone, rating: parseFloat(rating || '0'), website, category };
      }).filter(l => l.name);
    });

    console.log(`✅ ${leads.length} leads encontrados para: ${query}`);

    for (const lead of leads) {
      let score = 20;
      if (!lead.website) score += 40; 
      if (lead.rating < 4.5 && lead.rating > 0) score += 20;
      if (!lead.phone) score = 0;

      const { error } = await supabase.from('leads').upsert({
        name: lead.name,
        phone: lead.phone,
        rating: lead.rating,
        website: lead.website,
        category: lead.category,
        score: score,
        upsell_stage: 0
      }, { onConflict: 'name' });

      if (error) console.error("❌ Erro no Supabase:", error.message);
    }
  }

  await browser.close();
  console.log("🏁 VARREDURA CONCLUÍDA COM SUCESSO!");
}

scrape();
