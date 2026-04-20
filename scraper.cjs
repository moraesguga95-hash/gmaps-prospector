const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 [SNIPER v26.0] INICIANDO VARREDURA PROFUNDA...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1366,768'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  const query = process.env.QUERIES || 'Dentistas em Pouso Alegre';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  
  console.log(`🔎 Alvo: ${query}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Rola a lista para carregar os primeiros leads
    console.log("📜 Carregando lista...");
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollBy(0, 3000);
    });
    await new Promise(r => setTimeout(r, 3000));

    // Pega todos os links de "lugares" na lista
    const leadLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.hfpxzc')).map(a => ({
        name: a.getAttribute('aria-label'),
        url: a.href
      })).slice(0, 15); // Pega os 15 primeiros para ser rápido e preciso
    });

    console.log(`🎯 Alvos identificados: ${leadLinks.length}. Iniciando extração individual...`);

    for (const lead of leadLinks) {
      console.log(`🔭 Analisando: ${lead.name}...`);
      
      try {
        // Clica no lead para abrir o painel lateral
        await page.goto(lead.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        // Extrai dados do painel lateral (Lugar onde o Google não esconde)
        const data = await page.evaluate(() => {
          const name = document.querySelector('h1.fontHeadlineLarge')?.innerText || "";
          
          // Busca telefone pelo ícone ou pelo aria-label que começa com "Telefone"
          const phoneBtn = document.querySelector('button[aria-label^="Telefone"]');
          const phone = phoneBtn ? phoneBtn.getAttribute('aria-label').replace('Telefone: ', '').trim() : "";
          
          const websiteBtn = document.querySelector('a[aria-label^="Website"], a[aria-label^="Website"]');
          const website = websiteBtn ? websiteBtn.href : "";
          
          const rating = document.querySelector('div.F7609b div.fontBodyMedium span[aria-hidden="true"]')?.innerText || "0";
          
          return { name, phone, website, rating: parseFloat(rating.replace(',', '.')) };
        });

        if (data.phone) {
          console.log(`✅ Telefone capturado: ${data.phone}`);
          
          // Salva no Supabase
          const { error } = await supabase.from('leads').upsert({
            name: data.name || lead.name,
            phone: data.phone,
            website: data.website,
            rating: data.rating,
            category: query.split(' ')[0],
            score: data.website ? 40 : 80,
            upsell_stage: 0
          }, { onConflict: 'name' });

          if (error) console.error("❌ Erro no Supabase:", error.message);
        } else {
          console.log(`⚠️ Telefone não disponível para: ${lead.name}`);
        }

      } catch (e) {
        console.log(`🛑 Erro ao detalhar ${lead.name}: ${e.message}`);
      }
    }

    console.log("🏁 VARREDURA SNIPER CONCLUÍDA!");
    
  } catch (err) {
    console.error("💥 ERRO CRÍTICO:", err.message);
  } finally {
    await browser.close();
  }
}

scrape();
