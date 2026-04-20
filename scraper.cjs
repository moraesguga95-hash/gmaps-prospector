const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });
  const page = await browser.newPage();
  
  // Lista de variações para cercar todos os leads da cidade
  const baseQuery = process.env.QUERIES || 'Dentistas em Pouso Alegre';
  const queries = [
    baseQuery,
    baseQuery.replace('Dentistas', 'Clinica Odontologica'),
    baseQuery.replace('Dentistas', 'Odontologia')
  ];

  console.log(`🚀 INICIANDO VARREDURA PROFUNDA EM: ${baseQuery}`);

  for (const query of queries) {
    console.log(`🔎 Mapeando: ${query}...`);
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: 'networkidle2' });

    // SCROLL PROFUNDO: Rola até o final real da lista
    await page.evaluate(async () => {
      const container = document.querySelector('.m6QErb[aria-label*="Resultados"]');
      if (!container) return;
      
      let lastHeight = 0;
      while (true) {
        container.scrollBy(0, 1500);
        await new Promise(r => setTimeout(r, 2000));
        let newHeight = container.scrollHeight;
        if (newHeight === lastHeight) break; // Chegou no fim da lista
        lastHeight = newHeight;
      }
    });

    const leads = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.Nv2Yp')).map(el => {
        const name = el.querySelector('.qBF1Pd')?.innerText;
        const phone = el.querySelector('.Us7f9b')?.innerText || el.querySelector('.W4Efsd [style*="color"]')?.innerText;
        const rating = el.querySelector('.MW4etd')?.innerText;
        const website = el.querySelector('a[aria-label*="Website"]')?.href;
        const category = el.querySelector('.W4Efsd:last-child')?.innerText;

        return { name, phone, rating: parseFloat(rating || '0'), website, category };
      }).filter(l => l.name);
    });

    console.log(`✅ ${leads.length} leads encontrados nesta variação.`);

    for (const lead of leads) {
      // Score Inteligente v5.0
      let score = 20;
      if (!lead.website) score += 40; // Oportunidade GIGANTE
      if (lead.rating < 4.5 && lead.rating > 0) score += 20; // Gestão de Reputação
      if (!lead.phone) score = 0; // Se não tem contato, score baixo

      await supabase.from('leads').upsert({
        name: lead.name,
        phone: lead.phone,
        rating: lead.rating,
        website: lead.website,
        category: lead.category,
        score: score,
        upsell_stage: 0
      }, { onConflict: 'name' });
    }
  }

  await browser.close();
  console.log("🏁 VARREDURA CONCLUÍDA! Todos os leads foram sincronizados no seu comando.");
}

scrape();
