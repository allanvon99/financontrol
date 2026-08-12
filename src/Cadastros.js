import { useState } from "react";
import { BANCOS_DISPONIVEIS } from "./ModalNovoCartao";

const CATEGORIAS_PADRAO = [
  { id:"alimentacao", nome:"Alimentação", emoji:"🍔", cor:"#e06c1a" },
  { id:"transporte", nome:"Transporte", emoji:"🚗", cor:"#2188c9" },
  { id:"saude", nome:"Saúde", emoji:"🏥", cor:"#3fb950" },
  { id:"educacao", nome:"Educação", emoji:"📚", cor:"#a78bfa" },
  { id:"lazer", nome:"Lazer", emoji:"🎮", cor:"#f472b6" },
  { id:"moradia", nome:"Moradia", emoji:"🏠", cor:"#d29922" },
  { id:"vestuario", nome:"Vestuário", emoji:"👕", cor:"#58a6ff" },
  { id:"assinaturas", nome:"Assinaturas", emoji:"📱", cor:"#fb923c" },
  { id:"viagem", nome:"Viagem", emoji:"✈️", cor:"#34d399" },
  { id:"outros", nome:"Outros", emoji:"📦", cor:"#8b949e" },
];

export default function Cadastros({ cartoes, setCartoes, categorias, setCategorias, saudeConfig, setSaudeConfig, dark=true, planoAtivo="pro", podeAdicionar=()=>true, setShowUpgrade=()=>{} }) {
  const C = dark ? {
    bg:"#0d1117", card:"#161b22", border:"#21262d", surface:"#1c2128",
    text:"#c9d1d9", textSub:"#8b949e", primary:"#2188c9", primaryLight:"#58a6ff",
    green:"#3fb950", red:"#f85149", yellow:"#d29922", orange:"#e06c1a", purple:"#a78bfa",
  } : {
    bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", surface:"#f6f8fa",
    text:"#1f2328", textSub:"#57606a", primary:"#0969da", primaryLight:"#0969da",
    green:"#1a7f37", red:"#d1242f", yellow:"#9a6700", orange:"#bc4c00", purple:"#6639ba",
  };

  const [aba, setAba] = useState("cartoes");
  const [showFormCartao, setShowFormCartao] = useState(false);
  const [buscaBanco, setBuscaBanco] = useState("");
  const [nomeCustom, setNomeCustom] = useState("");
  const [confirmRemoverCartao, setConfirmRemoverCartao] = useState(null);
  const [novaCategoria, setNovaCategoria] = useState({ nome:"", emoji:"", cor:"#8b949e" });
  const [confirmRemoverCat, setConfirmRemoverCat] = useState(null);
  const [editandoSaude, setEditandoSaude] = useState(false);
  const [saudeTemp, setSaudeTemp] = useState(saudeConfig);

  const inp = { width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:"0.82rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const btnPri = { background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, border:"none", borderRadius:8, color:"#fff", padding:"9px 16px", fontSize:"0.82rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" };

  const abas = [
    { k:"cartoes", icon:"💳", label:"Cartões" },
    { k:"categorias", icon:"🏷️", label:"Categorias" },
    { k:"saude", icon:"💚", label:"Saúde financeira" },
  ];

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      {/* Modal confirm remover cartão */}
      {confirmRemoverCartao && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={()=>setConfirmRemoverCartao(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:16, padding:24, width:"100%", maxWidth:320, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:"1.5rem", textAlign:"center", marginBottom:12 }}>🗑️</div>
            <h3 style={{ fontSize:"0.95rem", fontWeight:800, color:C.text, margin:"0 0 8px", textAlign:"center" }}>Remover cartão?</h3>
            <p style={{ fontSize:"0.82rem", color:C.textSub, textAlign:"center", margin:"0 0 20px", lineHeight:1.5 }}>
              Deseja remover <strong style={{ color:C.text }}>{confirmRemoverCartao}</strong>? As parcelas vinculadas serão removidas.
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setConfirmRemoverCartao(null)} style={{ flex:1, padding:"11px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>Cancelar</button>
              <button onClick={()=>{ setCartoes(prev=>prev.filter(c=>c.nome!==confirmRemoverCartao)); setConfirmRemoverCartao(null); }}
                style={{ flex:1, padding:"11px", borderRadius:10, border:"none", background:C.red, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirm remover categoria */}
      {confirmRemoverCat && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={()=>setConfirmRemoverCat(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:16, padding:24, width:"100%", maxWidth:320, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:"1.5rem", textAlign:"center", marginBottom:12 }}>🗑️</div>
            <h3 style={{ fontSize:"0.95rem", fontWeight:800, color:C.text, margin:"0 0 8px", textAlign:"center" }}>Remover categoria?</h3>
            <p style={{ fontSize:"0.82rem", color:C.textSub, textAlign:"center", margin:"0 0 20px" }}>
              Deseja remover <strong style={{ color:C.text }}>{confirmRemoverCat.nome}</strong>?
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setConfirmRemoverCat(null)} style={{ flex:1, padding:"11px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>Cancelar</button>
              <button onClick={()=>{ setCategorias(prev=>prev.filter(c=>c.id!==confirmRemoverCat.id)); setConfirmRemoverCat(null); }}
                style={{ flex:1, padding:"11px", borderRadius:10, border:"none", background:C.red, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>Remover</button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ fontSize:"0.95rem", fontWeight:700, marginBottom:14, color:C.text }}>Cadastros</h2>

      {/* Sub-abas */}
      <div style={{ display:"flex", gap:0, background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:16 }}>
        {abas.map(a => (
          <button key={a.k} onClick={()=>setAba(a.k)} style={{ flex:1, padding:"9px 4px", border:"none", fontSize:"0.72rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:aba===a.k?C.primary:"transparent", color:aba===a.k?"#fff":C.textSub, transition:"all 0.2s", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span style={{ fontSize:"1rem" }}>{a.icon}</span>
            <span style={{ fontSize:"0.6rem" }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* CARTÕES */}
      {aba==="cartoes" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:"0.72rem", color:C.textSub }}>{cartoes.length} cartão(ões) cadastrado(s)</div>
            <button onClick={()=>setShowFormCartao(true)} style={{ ...btnPri, padding:"7px 12px", fontSize:"0.75rem" }}>+ Novo cartão</button>
          </div>
          {showFormCartao && (
            <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.primary}55`, marginBottom:14 }}>
              <div style={{ fontSize:"0.66rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>Adicionar cartão</div>
              <input placeholder="Buscar banco..." value={buscaBanco} onChange={e=>setBuscaBanco(e.target.value)} style={{ ...inp, marginBottom:12 }}/>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
                {BANCOS_DISPONIVEIS.filter(b=>!cartoes.find(c2=>c2.nome===b.nome) && b.nome.toLowerCase().includes(buscaBanco.toLowerCase())).map(b=>(
                  <button key={b.nome} onClick={()=>{ if(!podeAdicionar(planoAtivo,"cartoes",cartoes.length)){ setShowUpgrade("cartoes"); return; } setCartoes(p=>[...p,b]); setShowFormCartao(false); setBuscaBanco(""); }}
                    style={{ background:C.surface, borderRadius:12, padding:"12px 6px", border:`1px solid ${C.border}`, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:7, fontFamily:"inherit" }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:b.bg, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                      <img src={b.logo} alt={b.nome} style={{ width:"75%", height:"75%", objectFit:"contain" }}
                        onError={e=>{ e.target.style.display="none"; e.target.parentNode.innerHTML=`<span style="color:#fff;font-size:16px;font-weight:800">${b.nome[0]}</span>`; }}/>
                    </div>
                    <span style={{ fontSize:"0.62rem", fontWeight:600, color:C.text, textAlign:"center", lineHeight:1.2 }}>{b.nome}</span>
                  </button>
                ))}
              </div>
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                <div style={{ fontSize:"0.66rem", color:C.textSub, marginBottom:6 }}>Ou cadastre outro cartão</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8 }}>
                  <input placeholder="Nome do cartão" value={nomeCustom} onChange={e=>setNomeCustom(e.target.value)} style={inp}/>
                  <button onClick={()=>{ if(!nomeCustom.trim())return; if(!podeAdicionar(planoAtivo,"cartoes",cartoes.length)){ setShowUpgrade("cartoes"); return; } setCartoes(p=>[...p,{nome:nomeCustom.trim(),logo:null,bg:"#444"}]); setNomeCustom(""); setShowFormCartao(false); }}
                    style={{ ...btnPri, opacity: nomeCustom.trim()?1:0.4 }}>Adicionar</button>
                </div>
              </div>
            </div>
          )}

          {cartoes.length===0 ? (
            <div style={{ textAlign:"center", color:C.textSub, padding:"40px 0" }}>
              <p style={{ fontSize:"2rem", margin:"0 0 8px" }}>💳</p>
              <p style={{ fontSize:"0.85rem" }}>Nenhum cartão cadastrado</p>
              <button onClick={()=>setShowFormCartao(true)} style={{ ...btnPri, marginTop:12 }}>+ Adicionar primeiro cartão</button>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {cartoes.map(c => (
                <div key={c.nome} style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:c.bg||"#444", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                    {c.logo ? <img src={c.logo} alt={c.nome} style={{ width:"75%", height:"75%", objectFit:"contain" }} onError={e=>{ e.target.style.display="none"; e.target.parentNode.innerHTML=`<span style="color:#fff;font-size:16px;font-weight:800">${c.nome[0]}</span>`; }}/> : <span style={{ color:"#fff", fontSize:"1rem", fontWeight:800 }}>{c.nome[0]}</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.88rem", fontWeight:700, color:C.text }}>{c.nome}</div>
                  </div>
                  <button onClick={()=>setConfirmRemoverCartao(c.nome)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:"1rem", padding:"4px" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORIAS */}
      {aba==="categorias" && (
        <div>
          <div style={{ fontSize:"0.72rem", color:C.textSub, marginBottom:12 }}>{categorias.length} categoria(s) · algumas são padrão do sistema</div>

          {/* Form nova categoria */}
          <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.border}`, marginBottom:14 }}>
            <div style={{ fontSize:"0.68rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>+ Nova categoria</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr auto", gap:8, alignItems:"center" }}>
              <input value={novaCategoria.emoji} maxLength={2} onChange={e=>setNovaCategoria(x=>({...x,emoji:e.target.value}))}
                style={{ ...inp, width:52, textAlign:"center", fontSize:"1.2rem" }}/>
              <input placeholder="Nome da categoria" value={novaCategoria.nome} onChange={e=>setNovaCategoria(x=>({...x,nome:e.target.value}))} style={inp}/>
              <input type="color" value={novaCategoria.cor} onChange={e=>setNovaCategoria(x=>({...x,cor:e.target.value}))}
                style={{ width:40, height:38, borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", cursor:"pointer", padding:2 }}/>
            </div>
            <button onClick={()=>{
              if (!novaCategoria.nome) return;
              setCategorias(prev=>[...prev,{ ...novaCategoria, emoji: novaCategoria.emoji || "🏷️", id:Date.now().toString() }]);
              setNovaCategoria({ nome:"", emoji:"", cor:"#8b949e" });
            }} style={{ ...btnPri, width:"100%", marginTop:8 }}>Adicionar</button>
          </div>

          {/* Lista */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {categorias.map(cat => (
              <div key={cat.id} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:cat.cor+"22", border:`1px solid ${cat.cor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>{cat.emoji}</div>
                <span style={{ fontSize:"0.78rem", fontWeight:600, color:C.text, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat.nome}</span>
                {!CATEGORIAS_PADRAO.find(p=>p.id===cat.id) && (
                  <button onClick={()=>setConfirmRemoverCat(cat)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:"0.85rem", padding:"2px", flexShrink:0 }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SAÚDE FINANCEIRA */}
      {aba==="saude" && (
        <div>
          {/* Toggle ativar/desativar */}
          <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${saudeConfig.ativos!==false ? C.primary+"44" : C.border}`, marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"0.88rem", fontWeight:700, color:C.text }}>
                  {saudeConfig.ativos!==false ? "🔔 Alertas ativados" : "🔕 Alertas desativados"}
                </div>
                <div style={{ fontSize:"0.73rem", color:C.textSub, marginTop:3, lineHeight:1.5 }}>
                  {saudeConfig.ativos!==false
                    ? "Você recebe avisos quando os gastos passam do limite"
                    : "Nenhum aviso automático será enviado"}
                </div>
              </div>
              <button onClick={()=>setSaudeConfig(s=>({...s, ativos: s.ativos===false }))}
                style={{ width:48, height:27, borderRadius:14, border:"none", cursor:"pointer", flexShrink:0, position:"relative",
                  background: saudeConfig.ativos!==false ? C.green : C.border, transition:"background 0.2s" }}>
                <span style={{ position:"absolute", top:3, left: saudeConfig.ativos!==false ? 24 : 3, width:21, height:21, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
              </button>
            </div>
          </div>

          {saudeConfig.ativos!==false ? (
            <>
              <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.border}`, marginBottom:14 }}>
                <div style={{ fontSize:"0.72rem", color:C.textSub, lineHeight:1.5, marginBottom:12 }}>
                  Define os limites de comprometimento da renda para classificar a saúde financeira do mês.
                </div>

                {!editandoSaude ? (
                  <div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
                      {[
                        { label:"💚 Saudável", desc:`Até ${saudeConfig.saudavel}% da renda comprometida`, cor:C.green },
                        { label:"🟡 Atenção", desc:`Entre ${saudeConfig.saudavel}% e ${saudeConfig.atencao}%`, cor:C.yellow },
                        { label:"🔴 Crítico", desc:`Acima de ${saudeConfig.atencao}% da renda`, cor:C.red },
                      ].map(s => (
                        <div key={s.label} style={{ background:s.cor+"15", borderRadius:10, padding:"10px 12px", border:`1px solid ${s.cor}33` }}>
                          <div style={{ fontSize:"0.82rem", fontWeight:700, color:s.cor, marginBottom:2 }}>{s.label}</div>
                          <div style={{ fontSize:"0.72rem", color:C.textSub }}>{s.desc}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>{ setEditandoSaude(true); setSaudeTemp({...saudeConfig}); }} style={{ ...btnPri, width:"100%" }}>✏️ Editar limites</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:12 }}>
                      <div>
                        <div style={{ fontSize:"0.72rem", color:C.green, fontWeight:700, marginBottom:4 }}>💚 Limite saudável</div>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <input type="range" min={30} max={85} value={saudeTemp.saudavel}
                            onChange={e=>{ const v=parseInt(e.target.value); setSaudeTemp(x=>({...x, saudavel:v, atencao: Math.max(v+5, x.atencao)})); }}
                            style={{ flex:1, accentColor:C.green }}/>
                          <span style={{ fontSize:"0.88rem", fontWeight:800, color:C.green, minWidth:44 }}>{saudeTemp.saudavel}%</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:"0.72rem", color:C.yellow, fontWeight:700, marginBottom:4 }}>🟡 Limite de atenção</div>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <input type="range" min={saudeTemp.saudavel+5} max={99} value={saudeTemp.atencao}
                            onChange={e=>setSaudeTemp(x=>({...x,atencao:parseInt(e.target.value)}))}
                            style={{ flex:1, accentColor:C.yellow }}/>
                          <span style={{ fontSize:"0.88rem", fontWeight:800, color:C.yellow, minWidth:44 }}>{saudeTemp.atencao}%</span>
                        </div>
                      </div>
                      <div style={{ fontSize:"0.7rem", color:C.textSub, background:C.surface, borderRadius:8, padding:"8px 10px" }}>
                        Acima de {saudeTemp.atencao}% = 🔴 Crítico
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>{ setSaudeConfig(s=>({...saudeTemp, ativos: s.ativos})); setEditandoSaude(false); }} style={{ flex:2, ...btnPri, padding:"10px" }}>✓ Salvar</button>
                      <button onClick={()=>setEditandoSaude(false)} style={{ flex:1, padding:"10px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ background:C.surface, borderRadius:12, padding:"24px 16px", border:`1px solid ${C.border}`, textAlign:"center" }}>
              <div style={{ fontSize:"2rem", marginBottom:10, opacity:0.6 }}>🔕</div>
              <div style={{ fontSize:"0.88rem", color:C.text, fontWeight:700, marginBottom:6 }}>Alertas desativados</div>
              <div style={{ fontSize:"0.78rem", color:C.textSub, lineHeight:1.55, maxWidth:280, margin:"0 auto" }}>
                Você ainda vê o indicador de saúde no topo do app, mas não recebe avisos automáticos. Ative acima quando quiser.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}