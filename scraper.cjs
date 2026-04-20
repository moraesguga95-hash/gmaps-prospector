const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 [GHOST MESSENGER v44.0] INICIANDO OPERAÇÃO FANTASMA...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=pt-BR,pt'] 
  });
  
  const page = await browser.newPage();
  const auditor = await browser.newPage();

  const queries = (process.env.QUERIES || 'Pizzarias em Pouso Alegre').split(',');
  const webhookUrl = process.env.WEBHOOK_URL; // URL PARA DISPARO AUTOMÁTICO

  for (const query of queries) {
    const target = query.trim();
    console.log(`🔎 Alvo: ${target}`);
    const url = `https://www.google.com/maps/search/${encodeURIComponent(target)}`;
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));

      await page.evaluate(async () => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) { for(let i=0; i<8; i++) { feed.scrollBy(0, 2000); await new Promise(r => setTimeout(r, 1000)); } }
      });

      const leads = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a.hfpxzc')).map(a => ({
          name: a.getAttribute('aria-label'),
          url: a.href
        })).slice(0, 40);
      });

      for (const lead of leads) {
        try {
          await page.goto(lead.url, { waitUntil: 'networkidle2', timeout: 25000 });
          
          const info = await page.evaluate(() => {
            const phone = document.querySelector('button[aria-label*="Telefone"], button[aria-label*="Phone"]')?.getAttribute('aria-label').replace(/[^0-9]/g, '') || "";
            const website = document.querySelector('a[aria-label*="Website"], a[aria-label*="website"]')?.href || "";
            const ratingStr = document.querySelector('span.ceNzR')?.innerText || "4.0";
            const reviewStr = document.querySelector('span[aria-label*="avalia"]')?.innerText.replace(/[^0-9]/g, '') || "0";
            return { phone, website, rating: parseFloat(ratingStr.replace(',', '.')), reviews: parseInt(reviewStr) };
          });

          let hasPixel = false;
          let loadTime = 0;

          if (info.website) {
            try {
              const s = Date.now();
              await auditor.goto(info.website, { waitUntil: 'load', timeout: 12000 });
              loadTime = (Date.now() - s) / 1000;
              const content = await auditor.content();
              hasPixel = content.includes('fbevents.js');
            } catch (e) {}
          }

          if (info.phone) {
            const cleanPhone = info.phone.startsWith('55') ? info.phone : '55' + info.phone;
            
            // Lógica de Saúde
            let score = 100;
            if (!info.website) score -= 30;
            if (info.website && !hasPixel) score -= 20;
            if (loadTime > 3) score -= 15;
            
            const leadData = {
              name: lead.name,
              phone: cleanPhone,
              website: info.website,
              rating: info.rating,
              category: target,
              score: score,
              has_pixel: hasPixel,
              has_ads: loadTime > 3
            };

            // 1. SALVA NO BANCO
            await supabase.from('leads').upsert(leadData, { onConflict: 'name' });

            // 2. DISPARO AUTOMÁTICO (O CORAÇÃO DA v44.0)
            if (webhookUrl && score < 50) {
              console.log(`📡 Enviando lead ${leadData.name} para DISPARO AUTOMÁTICO...`);
              try {
                // Import dinâmico do fetch se necessário ou use uma lib local
                await fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(leadData)
                });
              } catch (err) { console.log("⚠️ Erro no webhook, mas lead salvo."); }
            }
          }
        } catch (e) {}
      }
    } catch (err) {}
  }
  await browser.close();
}

scrape();
