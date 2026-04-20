const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function scrape() {
  console.log("🚀 [BLINDADO v20.0] INICIANDO VARREDURA...");
  
  // Teste de conexão imediato
  const { data: test, error: testErr } = await supabase.from('leads').select('count', { count: 'exact', head: true });
  if (testErr) {
    console.error("❌ ERRO DE CONEXÃO COM SUPABASE:", testErr.message);
    return;
  }
  console.log("✅ Conexão com Supabase estabelecida com sucesso.");

  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  const query = process.env.QUERIES || 'Dentistas em Pouso Alegre';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  
  console.log(`🔎 Buscando leads em: ${query}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Rolagem simplificada mas eficaz
    await page.evaluate(async () => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) { feed.scrollBy(0, 5000); await new Promise(r => setTimeout(r, 3000)); }
    });

    const leads = await page.evaluate(() => {
      const blocks = document.querySelectorAll('div.Nv2Y3c, div.Nv2Yp, [role="article"]');
      return Array.from(blocks).map(el => {
        const name = el.querySelector('.fontHeadlineSmall')?.innerText || el.querySelector('.qBF1Pd')?.innerText;
        const website = el.querySelector('a[href*="http"]')?.href || "";
        const phoneMatch = el.innerText.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/);
        return { 
          name: name || "", 
          phone: phoneMatch ? phoneMatch[0] : "", 
          website: website,
          rating: 4.0, 
          category: "Prospecto" 
        };
      }).filter(l => l.name && l.name.length > 2);
    });

    console.log(`📊 Total de leads identificados: ${leads.length}`);

    // SALVAMENTO UM POR UM COM LOG DE ERRO
    let salvos = 0;
    for (const lead of leads) {
      const { error } = await supabase.from('leads').upsert({
        name: lead.name,
        phone: lead.phone,
        website: lead.website,
        rating: lead.rating,
        category: lead.category,
        score: lead.website ? 40 : 80,
        upsell_stage: 0
      }, { onConflict: 'name' });

      if (error) {
        console.log(`⚠️ Falha ao salvar lead [${lead.name}]: ${error.message}`);
      } else {
        salvos++;
      }
    }

    console.log(`✅ Varredura concluída! ${salvos} leads foram salvos/atualizados no banco.`);
    
  } catch (err) {
    console.error("💥 ERRO NO PROCESSO:", err.message);
  } finally {
    await browser.close();
  }
}

scrape();
