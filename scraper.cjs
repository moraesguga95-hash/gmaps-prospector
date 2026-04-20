const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 [GOD'S EYE v35.0] INICIANDO DIAGNÓSTICO FINAL...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=pt-BR,pt'] 
  });
  
  const page = await browser.newPage();
  const auditor = await browser.newPage();

  const queries = (process.env.QUERIES || 'Pizzarias em Pouso Alegre').split(',');

  for (const query of queries) {
    const target = query.trim();
    console.log(`🔎 Alvo: ${target}`);
    const url = `https://www.google.com/maps/search/${encodeURIComponent(target)}`;
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 5000));

      // Rolagem profunda
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
            const photoBtn = document.querySelector('button[aria-label*="Fotos"], button[aria-label*="Photos"]');
            
            return { 
                phone, 
                website, 
                rating: parseFloat(ratingStr.replace(',', '.')), 
                reviews: parseInt(reviewStr),
                hasPhotos: !!photoBtn
            };
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
            // Lógica de HEALTH SCORE (0-100)
            let score = 100;
            if (!info.website) score -= 30;
            if (info.website && !hasPixel) score -= 20;
            if (loadTime > 3) score -= 15;
            if (info.reviews < 15) score -= 20;
            if (!info.hasPhotos) score -= 15;

            await supabase.from('leads').upsert({
              name: lead.name,
              phone: info.phone.startsWith('55') ? info.phone : '55' + info.phone,
              website: info.website,
              rating: info.rating,
              category: target.split(' ')[0],
              score: score, // Agora o score é a Saúde Real
              upsell_stage: 0,
              has_pixel: hasPixel,
              has_ads: loadTime > 3,
              owner_name: info.reviews < 10 ? "RECÉM-ABERTO" : "" 
            }, { onConflict: 'name' });
          }
        } catch (e) {}
      }
    } catch (err) {}
  }

  await browser.close();
}

scrape();
