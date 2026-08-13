import { useState } from "react";

const fmt = (v) => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

const fmtData = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" });
};

export default function GastosDoMes({ extras, setExtras, cartoes, categorias, MESES, editandoExtra, setEditandoExtra, salvarExtra, C, inp, btnPri, CartaoLogo, planoAtualObj, podeAdicionar, onLimiteAtingido }) {
  const [mesSel, setMesSel] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [novoExtra, setNovoExtra] = useState({ nome:"", valor:"", cartao:"", categoria:"", data:"" });
  const [expandidosGrupo, setExpandidosGrupo] = useState({});

  const toggleGrupo = (k) => setExpandidosGrupo(p=>({...p,[k]:!p[k]}));

  const mesAtual = MESES[mesSel];
  const gastosMes = extras
    .filter(e => e.mesReal !== undefined && e.anoReal !== undefined
      ? (e.mesReal === mesAtual.mes && e.anoReal === mesAtual.ano)
      : e.mes === mesSel)
    .sort((a,b) => {
      if (a.data && b.data) return new Date(a.data) - new Date(b.data);
      if (a.data) return -1;
      if (b.data) return 1;
      return 0;
    });

  const totalMes = gastosMes.reduce((s,e)=>s+Number(e.valor),0);

  const grupos = {};
  gastosMes.forEach(e => {
    const key = e.cartao || "__sem_cartao__";
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(e);
  });

  const ordemGrupos = [
    ...cartoes.map(c=>c.nome).filter(n=>grupos[n]),
    ...(grupos["__sem_cartao__"] ? ["__sem_cartao__"] : [])
  ];

  const categoriaLabel = (id) => {
    const cat = categorias.find(c=>c.id===id);
    return cat ? `${cat.emoji} ${cat.nome}` : null;
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:0, color:C.grayLight }}>Gastos do Mês</h2>
        <button onClick={()=>{
          if (!showForm && podeAdicionar && !podeAdicionar(planoAtualObj, "extras", gastosMes.length)) {
            onLimiteAtingido && onLimiteAtingido();
            return;
          }
          setShowForm(!showForm);
        }} style={{ ...btnPri, padding:"7px 12px", fontSize:"0.75rem" }}>
          {showForm?"✕ Fechar":"+ Adicionar"}
        </button>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, background:C.card, borderRadius:12, padding:"10px 12px", border:`1px solid ${C.border}` }}>
        <button onClick={()=>setMesSel(m=>Math.max(0,m-1))} disabled={mesSel===0}
          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesSel===0?C.border:C.gray, width:32, height:32, cursor:mesSel===0?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>‹</button>
        <div style={{ flex:1, textAlign:"center" }}>
          <div style={{ fontSize:"0.92rem", fontWeight:800, color:C.grayLight }}>{mesAtual.label}</div>
          <div style={{ fontSize:"0.65rem", color:C.gray }}>{fmt(totalMes)} · {gastosMes.length} gasto(s)</div>
        </div>
        <button onClick={()=>setMesSel(m=>Math.min(MESES.length-1,m+1))} disabled={mesSel===MESES.length-1}
          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesSel===MESES.length-1?C.border:C.gray, width:32, height:32, cursor:mesSel===MESES.length-1?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>›</button>
      </div>

      {showForm && (
        <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.primary}55`, marginBottom:14, animation:"fadeIn 0.2s ease" }}>
          <div style={{ fontSize:"0.68rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>Novo gasto em {mesAtual.label}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <input placeholder="Descrição" value={novoExtra.nome} onChange={e=>setNovoExtra(x=>({...x,nome:e.target.value}))} style={inp()}/>
              <input type="number" placeholder="Valor (R$)" value={novoExtra.valor} onChange={e=>setNovoExtra(x=>({...x,valor:e.target.value}))} style={inp()}/>
            </div>
            <select value={novoExtra.cartao||""} onChange={e=>setNovoExtra(x=>({...x,cartao:e.target.value}))} style={inp()}>
              <option value="">Sem cartão (opcional)</option>
              {cartoes.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
            </select>
            <div>
              <div style={{ fontSize:"0.62rem", color:C.gray, marginBottom:3 }}>📅 Data do gasto (opcional)</div>
              <div style={{ position:"relative", overflow:"hidden", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface }}>
                <input type="date" value={novoExtra.data||""}
                  onChange={e=>setNovoExtra(x=>({...x,data:e.target.value}))}
                  style={{ width:"100%", padding:"9px 12px", background:"transparent", border:"none", color:novoExtra.data?C.grayLight:C.gray, fontSize:"0.82rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                />
              </div>
            </div>
            <select value={novoExtra.categoria||""} onChange={e=>setNovoExtra(x=>({...x,categoria:e.target.value}))} style={inp()}>
              <option value="">Categoria (opcional)</option>
              {categorias.map(cat=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.nome}</option>)}
            </select>
            <button onClick={()=>{
              if(!novoExtra.nome||!novoExtra.valor) return;
              if (podeAdicionar && !podeAdicionar(planoAtualObj, "extras", gastosMes.length)) {
                onLimiteAtingido && onLimiteAtingido();
                return;
              }
              setExtras(e=>[...e,{
                ...novoExtra, id:Date.now(), valor:parseFloat(novoExtra.valor),
                mesReal:mesAtual.mes, anoReal:mesAtual.ano
              }]);
              setNovoExtra({ nome:"", valor:"", cartao:"", categoria:"", data:"" });
              setShowForm(false);
            }} style={{ ...btnPri, padding:"10px" }}>Adicionar gasto</button>
          </div>
        </div>
      )}

      {gastosMes.length === 0 ? (
        <div style={{ textAlign:"center", color:C.gray, padding:"50px 0" }}>
          <p style={{ fontSize:"2rem", margin:"0 0 8px" }}>🗓️</p>
          <p style={{ fontSize:"0.85rem" }}>Nenhum gasto em {mesAtual.label}</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {ordemGrupos.map(key => {
            const itens = grupos[key] || [];
            const totalGrupo = itens.reduce((s,e)=>s+Number(e.valor),0);
            const aberto = expandidosGrupo[key] !== false;
            const nomeGrupo = key === "__sem_cartao__" ? "Sem cartão" : key;

            return (
              <div key={key} style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                <div onClick={()=>toggleGrupo(key)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                  {key !== "__sem_cartao__" ? (
                    <CartaoLogo grupo={key} cartoes={cartoes} size={32}/>
                  ) : (
                    <div style={{ width:32, height:32, borderRadius:8, background:C.surface, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>💳</div>
                  )}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.85rem", fontWeight:700, color:C.grayLight }}>{nomeGrupo}</div>
                    <div style={{ fontSize:"0.62rem", color:C.gray }}>{itens.length} gasto(s)</div>
                  </div>
                  <div style={{ textAlign:"right", marginRight:8 }}>
                    <div style={{ fontSize:"0.88rem", fontWeight:800, color:C.purple }}>{fmt(totalGrupo)}</div>
                  </div>
                  <span style={{ color:C.gray, fontSize:"0.72rem" }}>{aberto?"▲":"▼"}</span>
                </div>

                {aberto && (
                  <div style={{ padding:"0 12px 12px", animation:"fadeIn 0.2s ease" }}>
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, display:"flex", flexDirection:"column", gap:4 }}>
                      {itens.map(e => (
                        <div key={e.id} style={{ background:C.surface, borderRadius:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                          {editandoExtra?.id===e.id ? (
                            <div style={{ padding:"10px 12px" }}>
                              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                <input value={editandoExtra.nome} onChange={ev=>setEditandoExtra(x=>({...x,nome:ev.target.value}))} style={inp()}/>
                                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                                  <input type="number" value={editandoExtra.valor} onChange={ev=>setEditandoExtra(x=>({...x,valor:ev.target.value}))} style={inp()}/>
                                  <input type="date" value={editandoExtra.data||""} onChange={ev=>setEditandoExtra(x=>({...x,data:ev.target.value}))} style={inp()}/>
                                </div>
                                <select value={editandoExtra.cartao||""} onChange={ev=>setEditandoExtra(x=>({...x,cartao:ev.target.value}))} style={inp()}>
                                  <option value="">Sem cartão</option>
                                  {cartoes.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
                                </select>
                                <select value={editandoExtra.categoria||""} onChange={ev=>setEditandoExtra(x=>({...x,categoria:ev.target.value}))} style={inp()}>
                                  <option value="">Categoria (opcional)</option>
                                  {categorias.map(cat=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.nome}</option>)}
                                </select>
                                <div style={{ display:"flex", gap:6 }}>
                                  <button onClick={salvarExtra} style={{ flex:2,...btnPri,padding:"8px" }}>✓ Salvar</button>
                                  <button onClick={()=>setEditandoExtra(null)} style={{ flex:1,padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.gray,cursor:"pointer",fontFamily:"inherit" }}>Cancelar</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding:"9px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:"0.82rem", color:C.grayLight, fontWeight:500 }}>{e.nome}</div>
                                <div style={{ display:"flex", gap:8, marginTop:2 }}>
                                  {e.data && <div style={{ fontSize:"0.62rem", color:C.gray }}>📅 {fmtData(e.data)}</div>}
                                  {categoriaLabel(e.categoria) && <div style={{ fontSize:"0.62rem", color:C.gray }}>{categoriaLabel(e.categoria)}</div>}
                                </div>
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                                <span style={{ fontSize:"0.85rem", color:C.purple, fontWeight:700 }}>{fmt(e.valor)}</span>
                                <button onClick={()=>setEditandoExtra({...e})} style={{ background:"none",border:"none",color:C.gray,cursor:"pointer",fontSize:"0.85rem",padding:"4px" }}>✏️</button>
                                <button onClick={()=>setExtras(x=>x.filter(j=>j.id!==e.id))} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:"1rem",padding:"4px" }}>✕</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ background:C.surface, borderRadius:10, padding:"11px 14px", display:"flex", justifyContent:"space-between", border:`1px solid ${C.border}`, marginTop:4 }}>
            <span style={{ fontSize:"0.84rem", fontWeight:700, color:C.grayLight }}>Total {mesAtual.label}</span>
            <span style={{ fontSize:"0.88rem", color:C.purple, fontWeight:800 }}>{fmt(totalMes)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
