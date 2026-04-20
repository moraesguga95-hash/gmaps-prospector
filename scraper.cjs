const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 [GLOBAL SNIPER v27.0] INICIANDO...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--lang=pt-BR,pt' // Força o Google a falar Português
    ] 
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });

  const query = process.env.QUERIES || 'Dentistas em Pouso Alegre';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Carrega a lista
    await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollBy(0, 5000);
    });
    await new Promise(r => setTimeout(r, 4000));

    const leads = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.hfpxzc')).map(a => ({
        name: a.getAttribute('aria-label'),
        url: a.href
      })).slice(0, 20);
    });

    console.log(`🎯 Alvos: ${leads.length}`);

    for (const lead of leads) {
      console.log(`🔭 Extraindo: ${lead.name}...`);
      try {
        await page.goto(lead.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        const info = await page.evaluate(() => {
          const fullText = document.body.innerText;
          
          // Tenta achar o botão de telefone por vários nomes (pt e en)
          const phoneBtn = document.querySelector('button[aria-label*="Telefone"], button[aria-label*="Phone"], button[data-tooltip*="telefone"], button[data-item-id*="phone"]');
          let phone = phoneBtn ? phoneBtn.getAttribute('aria-label').replace(/[^0-9\s-()]/g, '').trim() : "";
          
          // Se falhou, tenta REGEX no texto todo
          if (!phone || phone.length < 8) {
            const match = fullText.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/);
            phone = match ? match[0] : "";
          }

          const websiteBtn = document.querySelector('a[aria-label*="Website"], a[aria-label*="website"], a[data-item-id*="authority"]');
          const website = websiteBtn ? websiteBtn.href : "";
          
          const rating = document.querySelector('span.ceNzR')?.innerText || "0";

          return { phone, website, rating: parseFloat(rating.replace(',', '.')) };
        });

        if (info.phone) {
          console.log(`✅ Sucesso: ${info.phone}`);
          await supabase.from('leads').upsert({
            name: lead.name,
            phone: info.phone,
            website: info.website,
            rating: info.rating || 4.0,
            category: "Prospecto",
            score: info.website ? 40 : 80,
            upsell_stage: 0
          }, { onConflict: 'name' });
        } else {
          console.log("❌ Telefone não encontrado.");
        }
      } catch (e) {
        console.log(`⚠️ Erro no lead: ${e.message}`);
      }
    }
  } catch (err) {
    console.error("💥 Erro Geral:", err.message);
  } finally {
    await browser.close();
    console.log("🏁 FIM DA VARREDURA.");
  }
}

scrape();
