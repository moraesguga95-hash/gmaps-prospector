const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 [CONQUEROR v34.0] INICIANDO EXPANSÃO REGIONAL...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=pt-BR,pt'] 
  });
  
  const page = await browser.newPage();
  const auditor = await browser.newPage();

  // MODO MULTI-BUSCAS: Divide as queries por vírgula
  const queries = (process.env.QUERIES || 'Dentistas em Pouso Alegre').split(',');
  console.log(`🌍 Planejando ataque em ${queries.length} frentes.`);

  for (const query of queries) {
    const target = query.trim();
    console.log(`🔎 Iniciando alvo: ${target}`);
    const url = `https://www.google.com/maps/search/${encodeURIComponent(target)}`;
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));

      // Rolagem profunda
      await page.evaluate(async () => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) { for(let i=0; i<10; i++) { feed.scrollBy(0, 2000); await new Promise(r => setTimeout(r, 1000)); } }
      });

      const leads = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a.hfpxzc')).map(a => ({
          name: a.getAttribute('aria-label'),
          url: a.href
        })).slice(0, 50); // 50 por cidade para ser veloz
      });

      for (const lead of leads) {
        try {
          await page.goto(lead.url, { waitUntil: 'networkidle2', timeout: 25000 });
          
          const info = await page.evaluate(() => {
            const phone = document.querySelector('button[aria-label*="Telefone"], button[aria-label*="Phone"]')?.getAttribute('aria-label').replace(/[^0-9]/g, '') || "";
            const website = document.querySelector('a[aria-label*="Website"], a[aria-label*="website"]')?.href || "";
            const rating = document.querySelector('span.ceNzR')?.innerText || "4.5";
            return { phone, website, rating: parseFloat(rating.replace(',', '.')) };
          });

          let hasPixel = false;
          let loadTime = 0;

          if (info.website) {
            try {
              const start = Date.now();
              await auditor.goto(info.website, { waitUntil: 'load', timeout: 12000 });
              loadTime = (Date.now() - start) / 1000;
              const content = await auditor.content();
              hasPixel = content.includes('fbevents.js');
            } catch (e) {}
          }

          if (info.phone) {
            const phoneFinal = info.phone.startsWith('55') ? info.phone : '55' + info.phone;
            const isGold = (info.rating >= 4.5 && (!info.website || !hasPixel || loadTime > 3));

            await supabase.from('leads').upsert({
              name: lead.name,
              phone: phoneFinal,
              website: info.website,
              rating: info.rating,
              category: target.split(' ')[0], // Captura o nicho da busca
              score: isGold ? 100 : 50,
              upsell_stage: 0,
              has_pixel: hasPixel,
              has_ads: loadTime > 3 ? true : false // Usamos o campo ads para marcar site lento por enquanto
            }, { onConflict: 'name' });
          }
        } catch (e) {}
      }
    } catch (err) { console.error(`🛑 Erro na query ${target}:`, err.message); }
  }

  await browser.close();
  console.log("🏁 CONQUISTA CONCLUÍDA.");
}

scrape();
