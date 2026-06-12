import { useState, useMemo, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Login from "./Login";
import Profile from "./Profile";

const NOMES_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CORES = {
  bg: "#090d16",
  card: "#111625",
  surface: "#171e30",
  border: "#222d47",
  primary: "#1d6fa4",
  primaryLight: "#2188c9",
  orange: "#e06c1a",
  green: "#2ea043",
  greenLight: "#3fb950",
  red: "#f85149",
  yellow: "#d29922",
  gray: "#8b949e",
  grayLight: "#c9d1d9",
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [aba, setAba] = useState("projecao");
  
  // Estados de Finanças
  const [parcelas, setParcelas] = useState([]);
  const [fixos, setFixos] = useState([]);
  const [extras, setExtras] = useState([]);
  const [receitasFixas, setReceitasFixas] = useState([]);
  const [receitasExtras, setReceitasExtras] = useState([]);

  // Estados de Formulários
  const [novaParc, setNovaParc] = useState({ grupo:"", nome:"", valor:"", parcelas:"" });
  const [novoFixo, setNovoFixo] = useState({ nome:"", valor:"" });
  const [novoExtra, setNovoExtra] = useState({ nome:"", valor:"", mes:"" });
  const [novaReceitaFixa, setNovaReceitaFixa] = useState({ nome:"", valor:"" });
  const [novaReceitaExtra, setNovaReceitaExtra] = useState({ nome:"", valor:"", mes:"" });
  
  const [loadStatus, setLoadStatus] = useState("loading");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [showProfile, setShowProfile] = useState(false);
  const [expandidos, setExpandidos] = useState({});
  const [grupoCustom, setGrupoCustom] = useState("");
  const [showGrupoCustom, setShowGrupoCustom] = useState(false);

  // Captura o mês e ano atual do sistema de forma dinâmica
  const hoje = useMemo(() => new Date(), []);
  const refAno = useMemo(() => hoje.getFullYear(), [hoje]);
  const refMes = useMemo(() => hoje.getMonth(), [hoje]); // 0 = Jan, 11 = Dez

  // Gera a lista de 24 meses dinamicamente sempre olhando do mês atual para frente
  const MESES = useMemo(() => {
    const arr = [];
    let ano = refAno;
    let mes = refMes;
    for (let i = 0; i < 24; i++) {
      arr.push(`${NOMES_MESES[mes]}/${String(ano).slice(-2)}`);
      mes++;
      if (mes > 11) { mes = 0; ano++; }
    }
    return arr;
  }, [refAno, refMes]);

  const grupos = useMemo(() => [...new Set(parcelas.map(p => p.grupo).filter(Boolean))], [parcelas]);

  // Carrega os dados do Firebase adaptando dados antigos se houver
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        if (snap.exists()) {
          const d = snap.data();
          
          // Fallback de segurança para parcelas antigas não quebrarem (coloca o início no mês atual de referência)
          if (d.parcelas) {
            const migradas = d.parcelas.map(p => ({
              ...p,
              anoInicio: p.anoInicio !== undefined ? p.anoInicio : 2026,
              mesInicio: p.mesInicio !== undefined ? p.mesInicio : 5
            }));
            setParcelas(migradas);
          }
          if (d.fixos) setFixos(d.fixos);
          if (d.extras) setExtras(d.extras);
          if (d.receitasFixas) setReceitasFixas(d.receitasFixas);
          if (d.receitasExtras) setReceitasExtras(d.receitasExtras);
          
          // Migração da renda única antiga para receitas fixas se necessário
          if (d.renda && (!d.receitasFixas || d.receitasFixas.length === 0)) {
            setReceitasFixas([{ id: Date.now(), nome: "Renda Base", valor: d.renda }]);
          }
        }
        setLoadStatus("loaded");
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Salva os dados no Firebase
  const handleSave = useCallback(async (parc, fix, ext, recFix, recExt) => {
    if (!auth.currentUser) return;
    setSaveStatus("saving");
    try {
      await setDoc(doc(db, "usuarios", auth.currentUser.uid), { 
        parcelas: parc, fixos: fix, extras: ext, receitasFixas: recFix, receitasExtras: recExt 
      });
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
    setTimeout(() => setSaveStatus("idle"), 3000);
  }, []);

  useEffect(() => {
    if (loadStatus !== "loaded") return;
    const t = setTimeout(() => handleSave(parcelas, fixos, extras, receitasFixas, receitasExtras), 800);
    return () => clearTimeout(t);
  }, [parcelas, fixos, extras, receitasFixas, receitasExtras, loadStatus, handleSave]);

  // Totais Globais Baseados no Mês Atual (Dinâmicos)
  const totalFixos = useMemo(() => fixos.reduce((s,f) => s + Number(f.valor), 0), [fixos]);
  const totalReceitasFixas = useMemo(() => receitasFixas.reduce((s,r) => s + Number(r.valor), 0), [receitasFixas]);

  // Calcula o valor total restante das parcelas diminuindo mês a mês automaticamente
  const totalParcelasRestantes = useMemo(() => {
    return parcelas.reduce((s, p) => {
      const mesesPassados = (refAno * 12 + refMes) - (p.anoInicio * 12 + p.mesInicio);
      const restantes = p.parcelas - Math.max(0, mesesPassados);
      return restantes > 0 ? s + (Number(p.valor) * restantes) : s;
    }, 0);
  }, [parcelas, refAno, refMes]);

  // Projeção Mês a Mês Inteligente
  const projecao = useMemo(() => {
    let anoCorrente = refAno;
    let mesCorrente = refMes;

    return MESES.map((mesStr) => {
      // Verifica se a parcela está ativa neste mês específico da iteração
      const totalParc = parcelas.reduce((s, p) => {
        const delta = (anoCorrente * 12 + mesCorrente) - (p.anoInicio * 12 + p.mesInicio);
        if (delta >= 0 && delta < p.parcelas) {
          return s + Number(p.valor);
        }
        return s;
      }, 0);

      const totalExtraGasto = extras.filter(e => e.mes === mesStr).reduce((s,e) => s + Number(e.valor), 0);
      const totalExtraReceita = receitasExtras.filter(r => r.mes === mesStr).reduce((s,r) => s + Number(r.valor), 0);

      const gastos = totalFixos + totalParc + totalExtraGasto;
      const receitas = totalReceitasFixas + totalExtraReceita;
      const sobra = receitas - gastos;

      // Avança o cursor do mês para a próxima linha da projeção
      mesCorrente++;
      if (mesCorrente > 11) { mesCorrente = 0; anoCorrente++; }

      return { mes: mesStr, totalParc, totalExtraGasto, totalExtraReceita, gastos, receitas, sobra };
    });
  }, [MESES, parcelas, fixos, extras, receitasFixas, receitasExtras, totalFixos, totalReceitasFixas, refAno, refMes]);

  const toggleExpandido = (i) => setExpandidos(prev => ({ ...prev, [i]: !prev[i] }));

  // Estilos compartilhados e polidos (Premium UI)
  const inp = { width:"100%", padding:"12px 14px", borderRadius:12, border:`1px solid ${CORES.border}`, background:CORES.surface, color:CORES.grayLight, fontSize:"0.85rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const btnPrimary = { background:`linear-gradient(135deg,${CORES.primary},${CORES.primaryLight})`, border:"none", borderRadius:12, color:"#fff", padding:"12px 20px", fontSize:"0.85rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", boxShadow:"0 4px 12px rgba(29, 111, 164, 0.2)" };
  const saveBtnStyle = { display:"inline-flex", alignItems:"center", gap:6, border:"none", borderRadius:10, color:"#fff", padding:"8px 16px", fontSize:"0.82rem", fontWeight:700, cursor: saveStatus==="saving"?"not-allowed":"pointer", fontFamily:"inherit", transition:"all 0.3s", background: saveStatus==="saved"?"#1a4a2e":saveStatus==="error"?"#4a1a1a":CORES.surface, border:`1px solid ${CORES.border}` };

  const corSobra = (s) => s >= 2000 ? CORES.greenLight : s >= 500 ? CORES.yellow : s >= 0 ? CORES.orange : CORES.red;

  if (authLoading || loadStatus === "loading") return (
    <div style={{ minHeight:"100vh", background:CORES.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:40, height:40, border:`3px solid ${CORES.border}`, borderTop:`3px solid ${CORES.primary}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <p style={{ color:CORES.gray, fontSize:"0.85rem", fontFamily:"sans-serif" }}>Buscando seus dados...</p>
    </div>
  );

  if (!user) return <Login/>;

  return (
    <div style={{ minHeight:"100vh", background:CORES.bg, fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', color:CORES.grayLight, paddingBottom:100 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {showProfile && <Profile onClose={() => setShowProfile(false)} />}

      {/* HEADER LIMPO */}
      <div style={{ background:CORES.card, borderBottom:`1px solid ${CORES.border}`, padding:"16px", position:"sticky", top:0, zIndex:100, boxShadow:"0 4px 20px rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth:700, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:"1.15rem", fontWeight:800, color:"#fff", margin:0, display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ color:CORES.primaryLight }}>💳</span> FinanControl
            </h1>
            <p style={{ color:CORES.gray, fontSize:"0.7rem", margin:"2px 0 0" }}>{user.email}</p>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={() => handleSave(parcelas, fixos, extras, receitasFixas, receitasExtras)} disabled={saveStatus==="saving"} style={saveBtnStyle}>
              {saveStatus==="saving" && <span style={{ display:"inline-block", width:10, height:10, border:"2px solid #ffffff44", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>}
              {saveStatus==="saving" ? "Salvando..." : saveStatus==="saved" ? "✅ Salvo!" : saveStatus==="error" ? "❌ Erro" : "☁️ Salvar"}
            </button>
            <button onClick={() => setShowProfile(true)} style={{ background:CORES.surface, border:`1px solid ${CORES.border}`, borderRadius:10, color:CORES.grayLight, padding:"8px 12px", fontSize:"0.8rem", cursor:"pointer" }}>👤</button>
            <button onClick={() => signOut(auth)} style={{ background:CORES.surface, border:`1px solid ${CORES.border}`, borderRadius:10, color:CORES.grayLight, padding:"8px 12px", fontSize:"0.8rem", cursor:"pointer" }}>Sair</button>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div style={{ maxWidth:700, margin:"0 auto", padding:"20px 16px 0" }}>

        {/* TELA: PROJEÇÃO */}
        {aba==="projecao" && (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            
            {/* QUADROS EXCLUSIVOS DA TELA DE PROJEÇÃO (MÊS ATUAL) */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:20 }}>
              <div style={{ background:CORES.card, borderRadius:14, padding:"12px 14px", border:`1px solid ${CORES.border}`, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>
                <div style={{ fontSize:"0.65rem", color:CORES.gray, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.05em" }}>Gastos Fixos</div>
                <div style={{ fontSize:"1.05rem", fontWeight:800, color:CORES.orange, marginTop:4 }}>{fmt(totalFixos)}</div>
              </div>
              <div style={{ background:CORES.card, borderRadius:14, padding:"12px 14px", border:`1px solid ${CORES.border}`, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>
                <div style={{ fontSize:"0.65rem", color:CORES.gray, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.05em" }}>Parcelas ({MESES[0]})</div>
                <div style={{ fontSize:"1.05rem", fontWeight:800, color:CORES.primaryLight, marginTop:4 }}>{fmt(projecao[0]?.totalParc || 0)}</div>
              </div>
              <div style={{ background:CORES.card, borderRadius:14, padding:"12px 14px", border:`1px solid ${CORES.border}`, boxShadow:"0 4px 12px rgba(0,0,0,0.15)" }}>
                <div style={{ fontSize:"0.65rem", color:CORES.gray, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.05em" }}>Sobra Atual ({MESES[0]})</div>
                <div style={{ fontSize:"1.05rem", fontWeight:800, color:corSobra(projecao[0]?.sobra || 0), marginTop:4 }}>{fmt(projecao[0]?.sobra || 0)}</div>
              </div>
            </div>

            <h2 style={{ fontSize:"0.95rem", marginBottom:12, color:CORES.grayLight, fontWeight:700 }}>Projeção Mês a Mês</h2>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {projecao.map((m,i) => {
                const cor = corSobra(m.sobra);
                const aberto = expandidos[i];
                return (
                  <div key={i} style={{ background:CORES.card, borderRadius:12, border:`1px solid ${CORES.border}`, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.1)" }}>
                    <div onClick={() => toggleExpandido(i)} style={{ padding:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ fontSize:"0.85rem", fontWeight:800, color: i === 0 ? "#fff" : CORES.gray, minWidth:55 }}>{m.mes}</span>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          <span style={{ fontSize:"0.68rem", background:CORES.surface, borderRadius:6, padding:"2px 6px", color:CORES.greenLight }}>Rec. {fmt(m.receitas)}</span>
                          <span style={{ fontSize:"0.68rem", background:CORES.surface, borderRadius:6, padding:"2px 6px", color:CORES.orange }}>Gastos {fmt(m.gastos)}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:"0.95rem", fontWeight:800, color:cor }}>{fmt(m.sobra)}</span>
                        <span style={{ color:CORES.gray, fontSize:"0.75rem", transition:"transform 0.2s", transform: aberto?"rotate(180deg)":"rotate(0deg)" }}>▼</span>
                      </div>
                    </div>

                    {aberto && (
                      <div style={{ padding:"0 14px 14px", display:"flex", flexDirection:"column", gap:8, animation:"fadeIn 0.2s ease" }}>
                        {/* Detalhe de Receitas */}
                        <div style={{ background:CORES.surface, borderRadius:10, padding:"10px", borderLeft:`3px solid ${CORES.greenLight}` }}>
                          <div style={{ fontSize:"0.65rem", color:CORES.greenLight, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>💰 Receitas Disponíveis</div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.78rem", color:CORES.gray, marginBottom:2 }}>
                            <span>Receitas Fixas (Salários)</span><span>{fmt(totalReceitasFixas)}</span>
                          </div>
                          {receitasExtras.filter(r => r.mes === m.mes).map(r => (
                            <div key={r.id} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.78rem", color:CORES.gray, marginBottom:2 }}>
                              <span>{r.nome} (Extra)</span><span>{fmt(r.valor)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Detalhe de Gastos Fixos */}
                        <div style={{ background:CORES.surface, borderRadius:10, padding:"10px", borderLeft:`3px solid ${CORES.orange}` }}>
                          <div style={{ fontSize:"0.65rem", color:CORES.orange, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>📌 Gastos Fixos Regulares</div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.78rem", color:CORES.gray }}>
                            <span>Total fixos do mês</span><span>{fmt(totalFixos)}</span>
                          </div>
                        </div>

                        {/* Detalhe de Parcelas */}
                        {m.totalParc > 0 && (
                          <div style={{ background:CORES.surface, borderRadius:10, padding:"10px", borderLeft:`3px solid ${CORES.primaryLight}` }}>
                            <div style={{ fontSize:"0.65rem", color:CORES.primaryLight, textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>💳 Parcelas Ativas no Mês</div>
                            {parcelas.filter(p => {
                              const delta = (refAno * 12 + refMes + i) - (p.anoInicio * 12 + p.mesInicio);
                              return delta >= 0 && delta < p.parcelas;
                            }).map(p => {
                              const delta = (refAno * 12 + refMes + i) - (p.anoInicio * 12 + p.mesInicio);
                              return (
                                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.78rem", color:CORES.gray, marginBottom:2 }}>
                                  <span>{p.nome} <span style={{ color:CORES.border, fontSize:"0.65rem" }}>({p.parcelas - delta}x rest.)</span></span>
                                  <span>{fmt(p.valor)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Detalhe de Extras */}
                        {m.totalExtraGasto > 0 && (
                          <div style={{ background:CORES.surface, borderRadius:10, padding:"10px", borderLeft:"3px solid #a78bfa" }}>
                            <div style={{ fontSize:"0.65rem", color:"#a78bfa", textTransform:"uppercase", fontWeight:700, marginBottom:4 }}>➕ Gastos Extras do Mês</div>
                            {extras.filter(e => e.mes === m.mes).map(e => (
                              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.78rem", color:CORES.gray, marginBottom:2 }}>
                                <span>{e.nome}</span><span>{fmt(e.valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TELA: RECEITAS (NOVA!) */}
        {aba==="receitas" && (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            <h2 style={{ fontSize:"1rem", marginBottom:14, color:CORES.grayLight }}>Controle de Receitas</h2>
            
            {/* Cadastrar Receita Fixa */}
            <div style={{ background:CORES.card, borderRadius:14, padding:14, border:`1px solid ${CORES.border}`, marginBottom:16 }}>
              <h3 style={{ fontSize:"0.78rem", color:CORES.greenLight, marginBottom:10, textTransform:"uppercase" }}>+ Adicionar Receita Fixa (Mensal)</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8 }}>
                <input placeholder="Ex: Salário, Aluguel" value={novaReceitaFixa.nome} onChange={e=>setNovaReceitaFixa(r=>({...r,nome:e.target.value}))} style={inp}/>
                <input type="number" placeholder="Valor (R$)" value={novaReceitaFixa.valor} onChange={e=>setNovaReceitaFixa(r=>({...r,valor:e.target.value}))} style={inp}/>
                <button onClick={() => {
                  if (!novaReceitaFixa.nome || !novaReceitaFixa.valor) return;
                  setReceitasFixas(r => [...r, { ...novaReceitaFixa, id: Date.now(), valor: parseFloat(novaReceitaFixa.valor) }]);
                  setNovaReceitaFixa({ nome: "", valor: "" });
                }} style={btnPrimary}>Adicionar</button>
              </div>
            </div>

            {/* Cadastrar Receita Extra */}
            <div style={{ background:CORES.card, borderRadius:14, padding:14, border:`1px solid ${CORES.border}`, marginBottom:16 }}>
              <h3 style={{ fontSize:"0.78rem", color:"#a78bfa", marginBottom:10, textTransform:"uppercase" }}>+ Adicionar Receita Extra (Mês Específico)</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:8 }}>
                <input placeholder="Ex: Décimo Terceiro, Venda" value={novaReceitaExtra.nome} onChange={e=>setNovaReceitaExtra(r=>({...r,nome:e.target.value}))} style={inp}/>
                <input type="number" placeholder="Valor (R$)" value={novaReceitaExtra.valor} onChange={e=>setNovaReceitaExtra(r=>({...r,valor:e.target.value}))} style={inp}/>
                <select value={novaReceitaExtra.mes || MESES[0]} onChange={e=>setNovaReceitaExtra(r=>({...r,mes:e.target.value}))} style={inp}>
                  {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => {
                  if (!novaReceitaExtra.nome || !novaReceitaExtra.valor) return;
                  const mesDefinido = novaReceitaExtra.mes || MESES[0];
                  setReceitasExtras(r => [...r, { ...novaReceitaExtra, id: Date.now(), valor: parseFloat(novaReceitaExtra.valor), mes: mesDefinido }]);
                  setNovaReceitaExtra({ nome: "", valor: "", mes: "" });
                }} style={btnPrimary}>Adicionar</button>
              </div>
            </div>

            {/* Lista de Receitas Cadastradas */}
            <h3 style={{ fontSize:"0.85rem", marginBottom:8, color:CORES.gray }}>Minhas Fontes de Renda</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {receitasFixas.map(r => (
                <div key={r.id} style={{ background:CORES.card, borderRadius:10, padding:"12px", border:`1px solid ${CORES.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>💼 {r.nome} <span style={{ fontSize:"0.65rem", color:CORES.greenLight, background:"rgba(46,160,67,0.15)", padding:"2px 6px", borderRadius:4, marginLeft:6 }}>Fixo Mensal</span></span>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ color:CORES.greenLight, fontWeight:700 }}>{fmt(r.valor)}</span>
                    <button onClick={()=>setReceitasFixas(x=>x.filter(i=>i.id!==r.id))} style={{ background:"none", border:"none", color:CORES.red, cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              ))}
              
              {receitasExtras.map(r => (
                <div key={r.id} style={{ background:CORES.card, borderRadius:10, padding:"12px", border:`1px solid ${CORES.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>💰 {r.nome} <span style={{ fontSize:"0.65rem", color:"#a78bfa", background:"rgba(167,139,250,0.15)", padding:"2px 6px", borderRadius:4, marginLeft:6 }}>Extra em {r.mes}</span></span>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ color:CORES.greenLight, fontWeight:700 }}>{fmt(r.valor)}</span>
                    <button onClick={()=>setReceitasExtras(x=>x.filter(i=>i.id!==r.id))} style={{ background:"none", border:"none", color:CORES.red, cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TELA: PARCELAS */}
        {aba==="parcelas" && (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            <h2 style={{ fontSize:"1rem", marginBottom:14, color:CORES.grayLight }}>Gerenciar Parcelas</h2>
            
            <div style={{ background:CORES.card, borderRadius:14, padding:14, border:`1px solid ${CORES.border}`, marginBottom:16 }}>
              <h3 style={{ fontSize:"0.78rem", color:CORES.primaryLight, marginBottom:10, textTransform:"uppercase" }}>+ Adicionar cartão/parcela</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", gap:8 }}>
                  <select
                    value={showGrupoCustom ? "__novo__" : novaParc.grupo}
                    onChange={e => {
                      if (e.target.value === "__novo__") { setShowGrupoCustom(true); setNovaParc(p=>({...p,grupo:""})); }
                      else { setShowGrupoCustom(false); setNovaParc(p=>({...p,grupo:e.target.value})); }
                    }}
                    style={{ ...inp, flex:1 }}
                  >
                    <option value="">Selecione o cartão/grupo</option>
                    {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                    <option value="__novo__">➕ Adicionar novo cartão...</option>
                  </select>
                  {showGrupoCustom && (
                    <input placeholder="Nome do novo cartão" value={grupoCustom} onChange={e => { setGrupoCustom(e.target.value); setNovaParc(p=>({...p,grupo:e.target.value})); }} style={{ ...inp, flex:1 }} />
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <input placeholder="Descrição" value={novaParc.nome} onChange={e=>setNovaParc(p=>({...p,nome:e.target.value}))} style={inp}/>
                  <input type="number" placeholder="Valor da Parcela (R$)" value={novaParc.valor} onChange={e=>setNovaParc(p=>({...p,valor:e.target.value}))} style={inp}/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8 }}>
                  <input type="number" placeholder="Quantas parcelas faltam hoje?" value={novaParc.parcelas} onChange={e=>setNovaParc(p=>({...p,parcelas:e.target.value}))} style={inp}/>
                  <button onClick={() => {
                    if (!novaParc.nome||!novaParc.valor||!novaParc.parcelas||!novaParc.grupo) return;
                    setParcelas(p=>[...p,{
                      ...novaParc,
                      id:Date.now(),
                      valor:parseFloat(novaParc.valor),
                      parcelas:parseInt(novaParc.parcelas),
                      anoInicio: refAno, // Vincula inteligentemente o início à data atual
                      mesInicio: refMes
                    }]);
                    setNovaParc({grupo:novaParc.grupo,nome:"",valor:"",parcelas:""});
                    setShowGrupoCustom(false); setGrupoCustom("");
                  }} style={btnPrimary}>Adicionar</button>
                </div>
              </div>
            </div>

            {/* Totalizador Restante Dinâmico */}
            <div style={{ background:CORES.surface, borderRadius:12, padding:"12px 14px", marginBottom:16, display:"flex", justifyContent:"space-between", border:`1px solid ${CORES.border}` }}>
              <span style={{ fontSize:"0.85rem", fontWeight:700 }}>💰 Dívida Total Restante (A partir de {MESES[0]})</span>
              <span style={{ color:CORES.primaryLight, fontWeight:800, fontSize:"0.95rem" }}>{fmt(totalParcelasRestantes)}</span>
            </div>

            {grupos.map(grupo => (
              <div key={grupo} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:CORES.primaryLight }}/>
                  <span style={{ fontSize:"0.72rem", fontWeight:700, color:CORES.gray, textTransform:"uppercase" }}>{grupo}</span>
                </div>
                {parcelas.filter(p=>p.grupo===grupo).map(p => {
                  const mesesPassados = (refAno * 12 + refMes) - (p.anoInicio * 12 + p.mesInicio);
                  const restantes = p.parcelas - Math.max(0, mesesPassados);
                  
                  if (restantes <= 0) return null; // Oculta automaticamente se já foi totalmente paga no tempo real
                  
                  return (
                    <div key={p.id} style={{ background:CORES.card, borderRadius:10, padding:"12px", border:`1px solid ${CORES.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <div>
                        <div style={{ fontSize:"0.85rem", fontWeight:600, color:"#fff" }}>{p.nome}</div>
                        <div style={{ fontSize:"0.7rem", color:CORES.gray, marginTop:2 }}>{restantes}x de {fmt(p.valor)} restantes</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:"0.85rem", color:CORES.primaryLight, fontWeight:700 }}>{fmt(p.valor * restantes)}</div>
                          <div style={{ fontSize:"0.6rem", color:CORES.gray }}>saldo devedor</div>
                        </div>
                        <button onClick={()=>setParcelas(x=>x.filter(i=>i.id!==p.id))} style={{ background:"none", border:"none", color:CORES.red, cursor:"pointer" }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* TELA: GASTOS FIXOS */}
        {aba==="fixos" && (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            <h2 style={{ fontSize:"1rem", marginBottom:14, color:CORES.grayLight }}>Gastos Fixos Mensais</h2>
            <div style={{ background:CORES.card, borderRadius:14, padding:14, border:`1px solid ${CORES.border}`, marginBottom:16 }}>
              <h3 style={{ fontSize:"0.78rem", color:CORES.orange, marginBottom:10, textTransform:"uppercase" }}>+ Adicionar Gasto Fixo</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8 }}>
                <input placeholder="Ex: Netflix, Internet" value={novoFixo.nome} onChange={e=>setNovoFixo(f=>({...f,nome:e.target.value}))} style={inp}/>
                <input type="number" placeholder="Valor (R$)" value={novoFixo.valor} onChange={e=>setNovoFixo(f=>({...f,valor:e.target.value}))} style={inp}/>
                <button onClick={() => {
                  if (!novoFixo.nome||!novoFixo.valor) return;
                  setFixos(f=>[...f,{...novoFixo,id:Date.now(),valor:parseFloat(novoFixo.valor)}]);
                  setNovoFixo({nome:"",valor:""});
                }} style={btnPrimary}>Adicionar</button>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {fixos.map(f => (
                <div key={f.id} style={{ background:CORES.card, borderRadius:10, padding:"12px", border:`1px solid ${CORES.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"0.85rem", fontWeight:500 }}>📌 {f.nome}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:"0.85rem", color:CORES.orange, fontWeight:700 }}>{fmt(f.valor)}</span>
                    <button onClick={()=>setFixos(x=>x.filter(i=>i.id!==f.id))} style={{ background:"none", border:"none", color:CORES.red, cursor:"pointer" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TELA: GASTOS EXTRAS DO MÊS */}
        {aba==="extras" && (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            <h2 style={{ fontSize:"1rem", marginBottom:14, color:CORES.grayLight }}>Gastos Extras Planificados</h2>
            <div style={{ background:CORES.card, borderRadius:14, padding:14, border:`1px solid ${CORES.border}`, marginBottom:16 }}>
              <h3 style={{ fontSize:"0.78rem", color:"#a78bfa", marginBottom:10, textTransform:"uppercase" }}>+ Adicionar Gasto Extra</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:8 }}>
                <input placeholder="Ex: Viagem, Presente" value={novoExtra.nome} onChange={e=>setNovoExtra(x=>({...x,nome:e.target.value}))} style={inp}/>
                <input type="number" placeholder="Valor (R$)" value={novoExtra.valor} onChange={e=>setNovoExtra(x=>({...x,valor:e.target.value}))} style={inp}/>
                <select value={novoExtra.mes || MESES[0]} onChange={e=>setNovoExtra(x=>({...x,mes:e.target.value}))} style={inp}>
                  {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => {
                  if (!novoExtra.nome||!novoExtra.valor) return;
                  const mesDefinido = novoExtra.mes || MESES[0];
                  setExtras(e=>[...e,{...novoExtra,id:Date.now(),valor:parseFloat(novoExtra.valor),mes:mesDefinido}]);
                  setNovoExtra({nome:"",valor:"",mes:""});
                }} style={btnPrimary}>Adicionar</button>
              </div>
            </div>
            
            {MESES.map(mes => {
              const do_mes = extras.filter(e=>e.mes===mes);
              if (!do_mes.length) return null;
              return (
                <div key={mes} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:"0.72rem", fontWeight:700, color:CORES.gray, textTransform:"uppercase", marginBottom:6 }}>{mes}</div>
                  {do_mes.map(e => (
                    <div key={e.id} style={{ background:CORES.card, borderRadius:10, padding:"12px", border:`1px solid ${CORES.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:"0.84rem" }}>💸 {e.nome}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ fontSize:"0.84rem", color:"#a78bfa", fontWeight:700 }}>{fmt(e.valor)}</span>
                        <button onClick={()=>setExtras(x=>x.filter(i=>i.id!==e.id))} style={{ background:"none", border:"none", color:CORES.red, cursor:"pointer" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BARRA DE NAVEGAÇÃO INFERIOR COMPLETA */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:CORES.card, borderTop:`1px solid ${CORES.border}`, display:"flex", zIndex:200, boxShadow:"0 -4px 20px rgba(0,0,0,0.3)", paddingBottom:"env(safe-area-inset-bottom)" }}>
        {[
          { k:"projecao", icon:"📊", label:"Projeção" },
          { k:"receitas", icon:"💰", label:"Receitas" },
          { k:"parcelas", icon:"💳", label:"Parcelas" },
          { k:"fixos", icon:"📌", label:"Fixos" },
          { k:"extras", icon:"🗓️", label:"Gastos" },
        ].map(({k,icon,label}) => (
          <button key={k} onClick={() => setAba(k)} style={{
            flex:1, padding:"12px 2px 10px", border:"none", background:"transparent", cursor:"pointer", fontFamily:"inherit",
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            borderTop: aba===k ? `3px solid ${CORES.primaryLight}` : "3px solid transparent",
            color: aba===k ? CORES.primaryLight : CORES.gray,
            transition:"all 0.2s"
          }}>
            <span style={{ fontSize:"1.15rem" }}>{icon}</span>
            <span style={{ fontSize:"0.6rem", fontWeight: aba===k ? 700 : 400 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
