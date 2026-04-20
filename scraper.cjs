const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 [SNIPER v28.0 - ESCALA MÁXIMA] INICIANDO...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=pt-BR,pt'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 1500 }); // Altura maior para ver mais

  const query = process.env.QUERIES || 'Pizzarias em Pouso Alegre';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // ROLAGEM AGRESSIVA (Para carregar MUITOS leads)
    console.log("📜 Rolando a cidade inteira...");
    await page.evaluate(async () => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) {
          for(let i=0; i<15; i++) { // Rola 15 vezes para baixo
            feed.scrollBy(0, 2000);
            await new Promise(r => setTimeout(r, 1200));
          }
        }
    });

    const leads = await page.evaluate(() => {
      // Pega até 100 links de uma vez
      return Array.from(document.querySelectorAll('a.hfpxzc')).map(a => ({
        name: a.getAttribute('aria-label'),
        url: a.href
      })).slice(0, 100); 
    });

    console.log(`🎯 Alvos encontrados: ${leads.length}. Iniciando captura...`);

    for (const lead of leads) {
      console.log(`🔭 Sniper em: ${lead.name}...`);
      try {
        await page.goto(lead.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        const info = await page.evaluate(() => {
          const phoneBtn = document.querySelector('button[aria-label*="Telefone"], button[aria-label*="Phone"], button[data-item-id*="phone"]');
          let phone = phoneBtn ? phoneBtn.getAttribute('aria-label').replace('Telefone: ', '').replace('Phone: ', '').trim() : "";
          if(!phone) {
             const m = document.body.innerText.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/);
             phone = m ? m[0] : "";
          }
          const websiteBtn = document.querySelector('a[aria-label*="Website"], a[aria-label*="website"]');
          return { phone, website: websiteBtn ? websiteBtn.href : "", rating: document.querySelector('span.ceNzR')?.innerText || "4.0" };
        });

        if (info.phone && info.phone.length > 8) {
          console.log(`✅ ${info.phone}`);
          await supabase.from('leads').upsert({
            name: lead.name,
            phone: info.phone,
            website: info.website,
            rating: parseFloat(info.rating.replace(',', '.')),
            category: query.split(' ')[0],
            score: info.website ? 40 : 80,
            upsell_stage: 0
          }, { onConflict: 'name' });
        }
      } catch (e) {}
    }
  } finally {
    await browser.close();
    console.log("🏁 PROCESSO CONCLUÍDO.");
  }
}

scrape();
