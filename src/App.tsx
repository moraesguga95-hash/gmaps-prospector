import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, TrendingUp, Settings, MessageSquare, 
  Share2, BrainCircuit, Loader2, DollarSign,
  Target, Users, Search, Linkedin, Instagram, ArrowUpCircle, Award, Layout, Star,
  Trash2, Send, CheckSquare, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabase';

interface Lead {
  id?: number;
  name: string;
  phone?: string;
  website?: string;
  rating?: number;
  category?: string;
  score?: number;
  upsell_stage: number;
  owner_name?: string;
  contract_value?: number;
  has_pixel?: boolean;
}

// ===== MAIN APP =====
const App = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filter, setFilter] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [showMockup, setShowMockup] = useState(false);
  
  // Settings & Automation
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_key') || '');
  const [githubToken, setGithubToken] = useState(localStorage.getItem('github_token') || '');
  const [agencyName, setAgencyName] = useState(localStorage.getItem('agency_name') || 'AGENCIA ELITE');
  const [massMsg, setMassMsg] = useState('Olá! Vi sua empresa no Google e notei uma oportunidade incrível de atrair mais clientes para vocês. Podemos conversar 2 minutinhos?');

  // AI States
  const [aiData, setAiData] = useState({ script: '', loss: '', ads: '', reputation: '', owner: '' });
  const [loadingAi, setLoadingAi] = useState(false);

  // ===== DATA FETCHING =====
  const fetchData = async () => {
    if (!supabase) return;
    const { data } = await (supabase as any).from('leads').select('*').order('score', { ascending: false });
    if (data) setLeads(data);
  };
  useEffect(() => { fetchData(); const int = setInterval(fetchData, 15000); return () => clearInterval(int); }, []);

  // ===== CLOUD SCRAPER (FIXED) =====
  const handleScrape = async () => {
    const q = prompt("🔎 O que buscar? (Ex: Dentistas em Pouso Alegre)");
    if (!q) return;
    if (!githubToken) return alert("⚠️ Configure o Token GitHub no Setup primeiro!");
    setIsBotRunning(true);
    try {
      const res = await fetch('https://api.github.com/repos/moraesguga95/gmaps-prospector/actions/workflows/scrape.yml/dispatches', {
        method: 'POST', 
        headers: { 
          'Authorization': `Bearer ${githubToken.trim()}`, 
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: 'main', inputs: { queries: q } })
      });
      if (res.status === 204 || res.ok) {
        alert("✅ Robô disparado na nuvem! Aguarde 3-5 minutos para os leads aparecerem.");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`❌ Erro: ${err.message || 'Verifique se o Token tem permissão de workflow.'}`);
      }
    } catch (e) { alert("❌ Erro de conexão. Verifique seu Token GitHub."); }
    setTimeout(() => setIsBotRunning(false), 30000);
  };

  // ===== CLEAR DATABASE =====
  const handleClear = async () => {
    if (!window.confirm("⚠️ ATENÇÃO: Isso vai apagar TODOS os leads permanentemente. Continuar?")) return;
    await (supabase as any).from('leads').delete().neq('id', 0);
    setLeads([]);
    setSelectedLeads([]);
    alert("🗑️ Banco limpo!");
  };

  // ===== OMNI AI ENGINE =====
  const runOmniAI = async (lead: Lead) => {
    if (!geminiKey) return alert("Configure a Gemini Key no Setup!");
    setLoadingAi(true);
    setAiData({ script: '', loss: '', ads: '', reputation: '', owner: lead.owner_name || '' });
    try {
      const prompt = `Você é um consultor de marketing digital expert. Analise a empresa "${lead.name}" (categoria: ${lead.category}, nota Google: ${lead.rating}/5, ${lead.website ? 'TEM site' : 'NÃO tem site'}).
      
Retorne APENAS um JSON válido com estas chaves:
{
  "script": "mensagem de abordagem para WhatsApp em português, máximo 3 linhas, tom consultivo",
  "loss": "valor estimado em R$ que a empresa perde por mês por falta de presença digital",
  "ads": "ideia de anúncio Facebook/Instagram com headline + descrição curta",
  "reputation": "análise da reputação baseada na nota e sugestão de melhoria",
  "owner": "nome provável do proprietário baseado no nome da empresa e região de Pouso Alegre"
}`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey.trim()}`, { 
        method:'POST', headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}]}) 
      });
      const d = await res.json();
      const rawText = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) setAiData(JSON.parse(jsonMatch[0]));
    } catch (e) { console.error(e); }
    setLoadingAi(false);
  };

  // ===== AUTO STATUS: Mark as contacted when opening WA =====
  const handleWhatsApp = async (lead: Lead) => {
    if (!lead.phone) return alert("Sem telefone registrado.");
    const cleanPhone = lead.phone.replace(/\D/g, '');
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}`);
    // Auto-update status to "Contatado" (stage 1) if still at 0
    if (lead.upsell_stage === 0 && supabase) {
      await (supabase as any).from('leads').update({ upsell_stage: 1 }).eq('name', lead.name);
      fetchData();
    }
  };

  // ===== MARKET STATS =====
  const stats = useMemo(() => {
    const total = leads.length || 1;
    return {
      total: leads.length,
      noSite: ((leads.filter(l => !l.website).length / total) * 100).toFixed(0),
      noPixel: ((leads.filter(l => !l.has_pixel).length / total) * 100).toFixed(0),
      totalRevenue: leads.reduce((acc, l) => acc + (l.contract_value || 0), 0),
      goldLeads: leads.filter(l => (l.score || 0) >= 70).length,
      contacted: leads.filter(l => l.upsell_stage >= 1).length,
    };
  }, [leads]);

  // ===== TOP 5 "GOLD" LEADS =====
  const goldLeads = useMemo(() => {
    return leads.filter(l => (l.score || 0) >= 60).slice(0, 5);
  }, [leads]);

  const getStageLabel = (s: number) => {
    if (s === 0) return { text: 'Novo', color: '#94a3b8' };
    if (s === 1) return { text: 'Contatado', color: '#6366f1' };
    if (s === 2) return { text: 'Negociando', color: '#fbbf24' };
    return { text: 'Fechado', color: '#22c55e' };
  };

  return (
    <div className="app-container">
      {/* ===== SIDEBAR ===== */}
      <aside className="sidebar">
        <div className="logo">
          <Zap size={22} color="#6366f1" fill="#6366f1" /> 
          <span>{agencyName}</span>
        </div>
        <nav className="nav-links">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><Layout size={18} /> Painel</button>
          <button className={`nav-item ${activeTab === 'mass' ? 'active' : ''}`} onClick={() => setActiveTab('mass')}><Send size={18} /> Disparo</button>
          <button className={`nav-item ${activeTab === 'market' ? 'active' : ''}`} onClick={() => setActiveTab('market')}><BarChart2 size={18} /> Mercado</button>
          <button className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}><DollarSign size={18} /> Financeiro</button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}><Settings size={18} /> Setup</button>
        </nav>
        {isBotRunning && (
          <div className="bot-status-card animate-pulse">
            <Loader2 className="animate-spin" size={16} /> 
            <span>Robô varrendo a nuvem...</span>
          </div>
        )}
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="main-content">
        <header className="header">
          <div>
            <h1>Prospector v17.0</h1>
            <p style={{color:'var(--text-dim)', fontSize:'0.85rem', marginTop:'4px'}}>{stats.total} leads | {stats.goldLeads} ouro | {stats.contacted} contatados</p>
          </div>
          <div className="flex gap-4">
             <button className="btn-icon" onClick={fetchData} title="Atualizar"><RefreshCw size={16}/></button>
             <button className="btn-icon" onClick={handleClear} title="Limpar Banco" style={{color:'#f87171'}}><Trash2 size={16}/></button>
             <button className="action-btn" onClick={handleScrape} disabled={isBotRunning}>
               {isBotRunning ? <><Loader2 size={16} className="animate-spin"/> Aguarde...</> : <>🚀 Varredura Cloud</>}
             </button>
          </div>
        </header>

        {/* ===== PAINEL ===== */}
        {activeTab === 'dashboard' && (
           <div className="animate-fade">
              {/* Top 5 Gold Section */}
              {goldLeads.length > 0 && (
                <div style={{marginBottom:'2rem'}}>
                  <h3 style={{fontSize:'0.8rem', color:'var(--warning)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'1rem', display:'flex', alignItems:'center', gap:'8px'}}><Award size={16}/> Top Oportunidades</h3>
                  <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'0.8rem'}}>
                    {goldLeads.map((l, i) => (
                      <div key={i} className="card gold-lead" style={{padding:'1rem', cursor:'pointer', borderColor:'rgba(251,191,36,0.15)'}} onClick={() => { setSelectedLead(l); runOmniAI(l); }}>
                        <h4 style={{fontSize:'0.85rem', marginBottom:'4px'}}>{l.name}</h4>
                        <span className="gold-badge">Score {l.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter + Selection Bar */}
              <div style={{display:'flex', gap:'1rem', marginBottom:'1.5rem', alignItems:'center'}}>
                <input type="text" placeholder="🔍 Filtrar leads..." className="modal-input" style={{maxWidth:'300px', marginTop:0}} value={filter} onChange={e=>setFilter(e.target.value)} />
                {selectedLeads.length > 0 && (
                  <button className="action-btn" style={{background:'var(--success)', fontSize:'0.8rem', padding:'10px 16px'}} onClick={() => setActiveTab('mass')}>
                    Disparar {selectedLeads.length} selecionados
                  </button>
                )}
              </div>

              {/* Leads Grid */}
              <div className="leads-grid">
                {leads.filter(l => l.name.toLowerCase().includes(filter.toLowerCase())).map((lead, i) => {
                  const stage = getStageLabel(lead.upsell_stage);
                  return (
                    <div key={i} className={`lead-card ${(lead.score || 0) >= 70 ? 'gold-lead' : ''}`} style={{borderLeft:`5px solid ${stage.color}`}}>
                      <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                         <input type="checkbox" checked={selectedLeads.includes(lead.id || 0)} onChange={() => {
                            const id = lead.id || 0;
                            setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                         }} />
                         <div className="lead-info">
                            <h3>
                              {lead.name} 
                              {(lead.score || 0) >= 70 && <span className="gold-badge">OURO</span>}
                            </h3>
                            <p>{lead.category} · ⭐ {lead.rating} · <span style={{color: stage.color, fontWeight:600}}>{stage.text}</span></p>
                         </div>
                      </div>
                      <div className="lead-actions">
                         <button className="btn-icon" onClick={() => { setSelectedLead(lead); runOmniAI(lead); }} title="Dossiê IA"><BrainCircuit size={16}/></button>
                         <button className="btn-icon" onClick={() => { setSelectedLead(lead); setShowMockup(true); }} title="Ver Mockup"><ImageIcon size={16}/></button>
                         <button className="btn-icon" onClick={() => {
                            const url = `${window.location.origin}/?lead=${encodeURIComponent(lead.name)}`;
                            navigator.clipboard.writeText(url); alert("Link de Auditoria copiado!");
                         }} title="Copiar Link"><Share2 size={16}/></button>
                         <button className="btn-icon" style={{color:'var(--success)'}} onClick={() => handleWhatsApp(lead)} title="WhatsApp"><MessageSquare size={16}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
           </div>
        )}

        {/* ===== DISPARO EM MASSA ===== */}
        {activeTab === 'mass' && (
           <div className="animate-fade" style={{maxWidth:'600px'}}>
              <div className="card" style={{padding:'2.5rem'}}>
                <h2 style={{marginBottom:'0.5rem'}}>📡 Central de Disparo</h2>
                <p style={{color:'var(--text-dim)', marginBottom:'2rem'}}>{selectedLeads.length} leads prontos para receber sua mensagem.</p>
                <label style={{fontSize:'0.75rem', color:'var(--text-dim)', textTransform:'uppercase', fontWeight:700}}>Mensagem de Abordagem</label>
                <textarea className="modal-input" style={{height:'140px'}} value={massMsg} onChange={e=>setMassMsg(e.target.value)} />
                <button className="action-btn" style={{width:'100%', marginTop:'1.5rem', height:'50px', justifyContent:'center'}} onClick={() => {
                   if (selectedLeads.length === 0) return alert("Selecione leads no Painel primeiro!");
                   if (!window.confirm(`Disparar para ${selectedLeads.length} leads?`)) return;
                   selectedLeads.forEach((id, index) => {
                      const l = leads.find(x => x.id === id);
                      if(l?.phone) setTimeout(() => window.open(`https://api.whatsapp.com/send?phone=${l.phone?.replace(/\D/g, '')}&text=${encodeURIComponent(massMsg)}`), index * 2500);
                   });
                }}>
                  <Send size={18}/> Disparar para {selectedLeads.length} Leads
                </button>
              </div>
           </div>
        )}

        {/* ===== MERCADO ===== */}
        {activeTab === 'market' && (
           <div className="animate-fade">
             <div className="grid" style={{gridTemplateColumns:'repeat(3, 1fr)', gap:'1.5rem', marginBottom:'2rem'}}>
                <div className="stat-card">
                  <div className="stat-icon"><Globe2 size={28} color="#f87171"/></div>
                  <div className="stat-label">Sem Website</div>
                  <div className="stat-value" style={{color:'#f87171'}}>{stats.noSite}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><Target size={28} color="#fbbf24"/></div>
                  <div className="stat-label">Sem Ads/Pixel</div>
                  <div className="stat-value" style={{color:'#fbbf24'}}>{stats.noPixel}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><DollarSign size={28} color="#22c55e"/></div>
                  <div className="stat-label">Total Faturado</div>
                  <div className="stat-value" style={{color:'#22c55e'}}>R$ {stats.totalRevenue.toLocaleString()}</div>
                </div>
             </div>
             <div className="card" style={{padding:'2rem'}}>
               <h3 style={{marginBottom:'1rem'}}>📊 Resumo do Mercado</h3>
               <p style={{color:'var(--text-dim)', lineHeight:'1.7'}}>
                 {stats.noSite}% dos leads na sua região <strong>não possuem website</strong>. 
                 São <strong>{leads.filter(l => !l.website).length} empresas</strong> prontas para serem convertidas em clientes.
                 Se cada uma pagar R$ 997 por um site, você tem um potencial de <strong style={{color:'#22c55e'}}>R$ {(leads.filter(l => !l.website).length * 997).toLocaleString()}</strong> em cima da mesa.
               </p>
             </div>
           </div>
        )}

        {/* ===== FINANCEIRO ===== */}
        {activeTab === 'finance' && (
           <div className="animate-fade">
              <div className="grid" style={{gridTemplateColumns:'repeat(3, 1fr)', gap:'1.5rem', marginBottom:'2rem'}}>
                 <div className="stat-card" style={{borderBottom:'3px solid #6366f1'}}>
                    <div className="stat-label">Fase 1: Site</div>
                    <div className="stat-value" style={{color:'#6366f1'}}>{leads.filter(l=>l.upsell_stage===1).length}</div>
                 </div>
                 <div className="stat-card" style={{borderBottom:'3px solid #fbbf24'}}>
                    <div className="stat-label">Fase 2: Ads</div>
                    <div className="stat-value" style={{color:'#fbbf24'}}>{leads.filter(l=>l.upsell_stage===2).length}</div>
                 </div>
                 <div className="stat-card" style={{borderBottom:'3px solid #22c55e'}}>
                    <div className="stat-label">Fase 3: Elite VIP</div>
                    <div className="stat-value" style={{color:'#22c55e'}}>{leads.filter(l=>l.upsell_stage===3).length}</div>
                 </div>
              </div>
              <div className="card" style={{padding:'2rem', textAlign:'center'}}>
                <Award size={36} color="#fbbf24"/>
                <h3 style={{marginTop:'1rem'}}>Potencial Recorrente Mensal</h3>
                <p style={{fontSize:'2.5rem', fontWeight:900, color:'#22c55e', marginTop:'0.5rem'}}>
                  R$ {((leads.filter(l=>l.upsell_stage===1).length * 997) + (leads.filter(l=>l.upsell_stage===2).length * 1497) + (leads.filter(l=>l.upsell_stage===3).length * 2997)).toLocaleString()}
                </p>
                <p style={{color:'var(--text-dim)', marginTop:'0.5rem'}}>Baseado em R$ 997 (Site) + R$ 1.497 (Ads) + R$ 2.997 (Elite)</p>
              </div>
           </div>
        )}

        {/* ===== SETUP ===== */}
        {activeTab === 'settings' && (
           <div className="animate-fade" style={{maxWidth:'500px'}}>
              <div className="card" style={{padding:'2.5rem'}}>
                <h2 style={{marginBottom:'2rem'}}>⚙️ Configurações</h2>
                <div style={{marginBottom:'1.5rem'}}>
                  <label style={{fontSize:'0.75rem', color:'var(--text-dim)', textTransform:'uppercase', fontWeight:700, display:'flex', alignItems:'center', gap:'6px'}}><Target size={14}/> Token GitHub (para Varredura Cloud)</label>
                  <input className="modal-input" type="password" placeholder="ghp_xxxxxxxxxxxxx" value={githubToken} onChange={e=>setGithubToken(e.target.value)} />
                </div>
                <div style={{marginBottom:'1.5rem'}}>
                  <label style={{fontSize:'0.75rem', color:'var(--text-dim)', textTransform:'uppercase', fontWeight:700, display:'flex', alignItems:'center', gap:'6px'}}><BrainCircuit size={14}/> Chave Gemini AI</label>
                  <input className="modal-input" type="password" placeholder="AIzaSyXxxxxxxxxxxxxx" value={geminiKey} onChange={e=>setGeminiKey(e.target.value)} />
                </div>
                <div style={{marginBottom:'2rem'}}>
                  <label style={{fontSize:'0.75rem', color:'var(--text-dim)', textTransform:'uppercase', fontWeight:700}}>Nome da Agência</label>
                  <input className="modal-input" placeholder="Sua Agência" value={agencyName} onChange={e=>setAgencyName(e.target.value)} />
                </div>
                <button className="action-btn" style={{width:'100%', height:'50px', justifyContent:'center'}} onClick={()=>{
                   localStorage.setItem('github_token', githubToken.trim());
                   localStorage.setItem('gemini_key', geminiKey.trim());
                   localStorage.setItem('agency_name', agencyName);
                   alert("✅ Configurações salvas com sucesso!");
                }}>Salvar e Ativar</button>
              </div>
           </div>
        )}

        {/* ===== MODALS ===== */}
        <AnimatePresence>
          {selectedLead && (
             <motion.div className="modal-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => { setSelectedLead(null); setShowMockup(false); }}>
                <div className="modal animate-fade" onClick={e=>e.stopPropagation()} style={{
                  maxWidth: showMockup ? '900px' : '750px', width:'95%', 
                  background: showMockup ? '#fff' : 'var(--bg-card)', 
                  color: showMockup ? '#111' : 'var(--text-main)', 
                  padding: showMockup ? 0 : '2.5rem', overflow:'hidden'
                }}>
                   {/* ===== MOCKUP MODE ===== */}
                   {showMockup ? (
                      <div>
                         <div style={{background:'linear-gradient(135deg, #6366f1, #8b5cf6)', padding:'4rem 2rem', color:'#fff', textAlign:'center'}}>
                            <h1 style={{fontSize:'3rem', fontWeight:900, marginBottom:'0.5rem'}}>{selectedLead.name}</h1>
                            <p style={{fontSize:'1.1rem', opacity:0.9}}>A melhor experiência em {selectedLead.category} de Pouso Alegre</p>
                            <button style={{marginTop:'2rem', background:'#fff', color:'#6366f1', padding:'16px 40px', borderRadius:'12px', fontWeight:800, border:'none', fontSize:'1rem', cursor:'pointer'}}>
                              AGENDE AGORA
                            </button>
                         </div>
                         <div style={{padding:'4rem 2rem', textAlign:'center'}}>
                            <h2 style={{fontSize:'1.8rem', marginBottom:'2.5rem', color:'#1e293b'}}>Por que nos escolher?</h2>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1.5rem'}}>
                               <div style={{padding:'2rem', background:'#f8fafc', borderRadius:'20px'}}><Award size={36} color="#6366f1"/><h4 style={{marginTop:'8px'}}>Qualidade</h4><p style={{fontSize:'0.8rem', color:'#64748b'}}>Referência no segmento</p></div>
                               <div style={{padding:'2rem', background:'#f8fafc', borderRadius:'20px'}}><Users size={36} color="#6366f1"/><h4 style={{marginTop:'8px'}}>Atendimento</h4><p style={{fontSize:'0.8rem', color:'#64748b'}}>Foco total em você</p></div>
                               <div style={{padding:'2rem', background:'#f8fafc', borderRadius:'20px'}}><Star size={36} color="#6366f1"/><h4 style={{marginTop:'8px'}}>Avaliações</h4><p style={{fontSize:'0.8rem', color:'#64748b'}}>{selectedLead.rating} estrelas no Google</p></div>
                            </div>
                            <p style={{marginTop:'3rem', color:'#94a3b8', fontSize:'0.8rem'}}>© 2026 {selectedLead.name} · Desenvolvido por {agencyName}</p>
                         </div>
                         <button style={{position:'absolute', top:'15px', right:'15px', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', padding:'10px 18px', borderRadius:'10px', cursor:'pointer', fontWeight:600}} onClick={()=>setShowMockup(false)}>✕ Fechar Preview</button>
                      </div>
                   ) : (
                      /* ===== DOSSIÊ MODE ===== */
                      <>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2rem'}}>
                           <div>
                             <h2 style={{fontSize:'1.5rem', fontWeight:900}}>Dossiê Omni</h2>
                             <p style={{color:'var(--text-dim)', fontSize:'0.85rem'}}>{selectedLead.name}</p>
                           </div>
                           <button className="btn-icon" onClick={()=>{setSelectedLead(null); setShowMockup(false);}}>✕</button>
                        </div>

                        {/* Info Cards */}
                        <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem'}}>
                           <div className="card" style={{padding:'1.2rem'}}>
                              <p style={{fontSize:'0.65rem', color:'var(--text-dim)', textTransform:'uppercase', fontWeight:700}}>Proprietário Provável</p>
                              <h4 style={{color:'var(--primary)', marginTop:'4px', fontSize:'1.1rem'}}>{loadingAi ? '...' : (aiData.owner || '—')}</h4>
                              <div style={{display:'flex', gap:'6px', marginTop:'10px'}}>
                                <button className="btn-icon" style={{width:'auto', padding:'0 12px', height:'28px', fontSize:'0.7rem'}} onClick={() => window.open(`https://linkedin.com/search/results/people/?keywords=${aiData.owner}`)}>LinkedIn</button>
                                <button className="btn-icon" style={{width:'auto', padding:'0 12px', height:'28px', fontSize:'0.7rem'}} onClick={() => window.open(`https://google.com/search?q=cnpj+socio+${selectedLead.name}`)}>CNPJ</button>
                              </div>
                           </div>
                           <div className="card" style={{padding:'1.2rem'}}>
                              <p style={{fontSize:'0.65rem', color:'var(--text-dim)', textTransform:'uppercase', fontWeight:700}}>Lucro Perdido / Mês</p>
                              <h4 style={{color:'#f87171', marginTop:'4px', fontSize:'1.3rem', fontWeight:900}}>{loadingAi ? '...' : (aiData.loss || '—')}</h4>
                           </div>
                        </div>

                        {/* Script */}
                        <div className="ai-box" style={{marginBottom:'1.5rem'}}>
                          <h4 style={{color:'var(--primary)', marginBottom:'8px', fontSize:'0.75rem', textTransform:'uppercase'}}>💬 Script de Abordagem</h4>
                          <p>{loadingAi ? 'Gerando inteligência...' : (aiData.script || 'Analisando...')}</p>
                        </div>

                        {/* Actions */}
                        <div style={{display:'flex', gap:'10px'}}>
                           <button className="action-btn" style={{flex:1, justifyContent:'center'}} onClick={() => handleWhatsApp(selectedLead)}>📩 Abordar no WhatsApp</button>
                           <button className="btn-icon" onClick={() => setShowMockup(true)} title="Ver Mockup"><ImageIcon size={18}/></button>
                           <button className="btn-icon" onClick={async () => {
                              const n = (selectedLead.upsell_stage || 0) + 1;
                              if(n <= 3) { await (supabase as any).from('leads').update({ upsell_stage: n }).eq('name', selectedLead.name); fetchData(); alert("🎉 Cliente evoluído na esteira!"); }
                           }} title="Evoluir"><ArrowUpCircle size={18}/></button>
                        </div>
                      </>
                   )}
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

// ===== CUSTOM SVG ICONS (stable, no lib dependency issues) =====
const RefreshCw = ({size}: {size:number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>;
const BarChart2 = ({size}: {size:number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const Globe2 = ({size, color}: {size:number, color:string}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;

export default App;
