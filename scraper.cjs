const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 [RASTRADOR SOCIAL v32.0] INICIANDO...");
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=pt-BR,pt'] 
  });
  const page = await browser.newPage();
  const auditor = await browser.newPage();

  const query = process.env.QUERIES || 'Pizzarias em Pouso Alegre';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));

    const leads = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.hfpxzc')).map(a => ({
        name: a.getAttribute('aria-label'),
        url: a.href
      })).slice(0, 30);
    });

    for (const lead of leads) {
      try {
        await page.goto(lead.url, { waitUntil: 'networkidle2', timeout: 25000 });
        
        const info = await page.evaluate(() => {
          const phone = document.querySelector('button[aria-label*="Telefone"], button[aria-label*="Phone"]')?.getAttribute('aria-label').replace(/[^0-9]/g, '') || "";
          const website = document.querySelector('a[aria-label*="Website"], a[aria-label*="website"]')?.href || "";
          const rating = document.querySelector('span.ceNzR')?.innerText || "4.5";
          const reviews = document.querySelector('div.F7609b div.fontBodyMedium span[aria-label*="avalia"]')?.ariaLabel || "0";
          return { phone, website, rating: parseFloat(rating.replace(',', '.')), reviews };
        });

        let insta = "";
        let fb = "";
        let hasPixel = false;

        // AUDITORIA SOCIAL E TÉCNICA
        if (info.website) {
          try {
            await auditor.goto(info.website, { waitUntil: 'networkidle0', timeout: 12000 });
            const content = await auditor.content();
            hasPixel = content.includes('fbevents.js');
            
            // Procura links sociais
            const links = await auditor.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href));
            insta = links.find(l => l.includes('instagram.com')) || "";
            fb = links.find(l => l.includes('facebook.com')) || "";
          } catch (e) {}
        }

        if (info.phone) {
          // Lógica LEAD DE OURO: Nota alta + Sem tecnologia
          const isGold = (info.rating >= 4.5 && (!info.website || !hasPixel));

          await supabase.from('leads').upsert({
            name: lead.name,
            phone: info.phone.startsWith('55') ? info.phone : '55' + info.phone,
            website: info.website,
            rating: info.rating,
            category: query.split(' ')[0],
            score: isGold ? 100 : 50, // 100 = OURO
            upsell_stage: 0,
            has_pixel: hasPixel,
            owner_name: insta // Guardamos o insta aqui por enquanto para não mexer na tabela
          }, { onConflict: 'name' });
        }
      } catch (e) {}
    }
  } finally {
    await browser.close();
  }
}

scrape();
