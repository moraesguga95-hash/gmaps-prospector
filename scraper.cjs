const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) 
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY) 
  : null;

async function scrape() {
  console.log("🚀 [RAIO-X v19.0] INICIANDO VARREDURA...");
  
  if (!supabase) {
    console.error("❌ ERRO: Chaves do Supabase não encontradas nos Secrets do GitHub!");
    return;
  }

  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const query = process.env.QUERIES || 'Dentistas em Pouso Alegre';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  
  console.log(`🔎 Visitando: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Diagnóstico inicial
    const title = await page.title();
    console.log(`📄 Título da página: ${title}`);
    
    if (title.includes("Before you continue") || title.includes("Consent")) {
      console.log("⚠️ Página de consentimento detectada. Tentando aceitar...");
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text.includes("Accept all") || text.includes("Aceitar tudo")) {
          await btn.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2' });
          break;
        }
      }
    }

    // Espera a lista de resultados
    console.log("⏳ Aguardando carregamento dos resultados...");
    await new Promise(r => setTimeout(r, 5000));

    // ROLAGEM FORÇADA
    console.log("📜 Rolando a lista...");
    await page.evaluate(async () => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) {
        for(let i=0; i<10; i++) {
          feed.scrollBy(0, 1000);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    });

    // EXTRAÇÃO MULTI-SELETOR
    const leads = await page.evaluate(() => {
      // Tenta achar todos os blocos de empresa
      const blocks = document.querySelectorAll('div.Nv2Y3c, div.Nv2Yp, div.UaMeBe, [role="article"]');
      
      return Array.from(blocks).map(el => {
        // Tenta vários seletores para o nome
        const name = el.querySelector('.fontHeadlineSmall')?.innerText || 
                     el.querySelector('.qBF1Pd')?.innerText || 
                     el.querySelector('a')?.getAttribute('aria-label') || 
                     "Empresa sem nome";

        // Tenta vários seletores para o site
        const website = el.querySelector('a[href*="http"]')?.href || "";
        
        // Tenta vários seletores para a nota
        const ratingMatch = el.innerText.match(/(\d[.,]\d)\s?\(/);
        const rating = ratingMatch ? ratingMatch[1].replace(',', '.') : "0";

        // Busca telefone no texto interno (padrão brasileiro)
        const phoneMatch = el.innerText.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : "";

        const category = el.innerText.split('\n')[2] || "Nicho não identificado";

        return { name, phone, rating: parseFloat(rating), website, category };
      }).filter(l => l.name && l.name !== "Empresa sem nome");
    });

    console.log(`📊 O Raio-X detectou ${leads.length} blocos de empresas na tela.`);

    if (leads.length === 0) {
      console.log("❌ NENHUM lead extraído. Verificando se há links diretos...");
      const linksCount = await page.evaluate(() => document.querySelectorAll('a[href*="/maps/place/"]').length);
      console.log(`🔗 Links de lugares encontrados: ${linksCount}`);
    }

    for (const lead of leads) {
      let score = 20;
      if (!lead.website) score += 40;
      if (lead.rating < 4.5 && lead.rating > 0) score += 20;
      if (!lead.phone) score = 0;

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

    console.log("🏁 VARREDURA FINALIZADA.");
    
  } catch (err) {
    console.error("💥 ERRO CRÍTICO DURANTE A VARREDURA:", err.message);
  } finally {
    await browser.close();
  }
}

scrape();
