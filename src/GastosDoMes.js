import { useState } from "react";

const fmt = (v) => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

const fmtData = (d) => {
  if (!d) return "";
  const [ano, mes, dia] = d.split("-").map(Number);
  const dt = new Date(ano, mes-1, dia);
  return dt.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" });
};

export default function GastosDoMes({
  extras, setExtras, fixos, setFixos,
  cartoes, categorias, MESES,
  editandoExtra, setEditandoExtra, salvarExtra,
  editandoFixo, setEditandoFixo, salvarFixo,
  C, inp, btnPri, CartaoLogo,
  planoAtualObj, podeAdicionar, onLimiteAtingido, onLimiteAtingidoFixo,
  onImportar, onPedirRemocao,
}) {
  const [mesSel, setMesSel] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [tipoNovo, setTipoNovo] = useState("mes"); // "mes" | "fixo"
  const [novoItem, setNovoItem] = useState({ nome:"", valor:"", cartao:"", categoria:"", data:"" });
  const [filtroTipo, setFiltroTipo] = useState("todos"); // "todos" | "fixo" | "mes"
  const [expandidosGrupo, setExpandidosGrupo] = useState({});

  const toggleGrupo = (k) => setExpandidosGrupo(p=>({...p,[k]:!p[k]}));

  const mesAtual = MESES[mesSel];

  const extrasMes = extras
    .filter(e => e.mesReal !== undefined && e.anoReal !== undefined
      ? (e.mesReal === mesAtual.mes && e.anoReal === mesAtual.ano)
      : e.mes === mesSel);

  const totalFixos = fixos.reduce((s,f)=>s+Number(f.valor),0);
  const totalExtrasMes = extrasMes.reduce((s,e)=>s+Number(e.valor),0);
  const totalGeral = totalFixos + totalExtrasMes;

  const itensUnificados = [
    ...fixos.map(f => ({ ...f, __tipo:"fixo" })),
    ...extrasMes.map(e => ({ ...e, __tipo:"mes" })),
  ];

  const itensFiltrados = filtroTipo === "todos" ? itensUnificados : itensUnificados.filter(i => i.__tipo === filtroTipo);
  const totalItensExibidos = itensFiltrados.length;

  const grupos = {};
  itensFiltrados.forEach(i => {
    const key = i.cartao || "__sem_cartao__";
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(i);
  });
  Object.values(grupos).forEach(lista => lista.sort((a,b)=>{
    if (a.__tipo !== b.__tipo) return a.__tipo === "fixo" ? -1 : 1;
    if (a.__tipo === "mes") {
      if (a.data && b.data) return new Date(a.data) - new Date(b.data);
      if (a.data) return -1;
      if (b.data) return 1;
    }
    return 0;
  }));

  const ordemGrupos = [
    ...cartoes.map(c=>c.nome).filter(n=>grupos[n]),
    ...(grupos["__sem_cartao__"] ? ["__sem_cartao__"] : [])
  ];

  const categoriaLabel = (id) => {
    const cat = categorias.find(c=>c.id===id);
    return cat ? `${cat.emoji} ${cat.nome}` : null;
  };

  const adicionar = () => {
    if (!novoItem.nome || !novoItem.valor) return;
    if (tipoNovo === "fixo") {
      if (podeAdicionar && !podeAdicionar(planoAtualObj, "fixos", fixos.length)) { onLimiteAtingidoFixo && onLimiteAtingidoFixo(); return; }
      setFixos(f=>[...f, { nome:novoItem.nome, valor:parseFloat(novoItem.valor), cartao:novoItem.cartao, categoria:novoItem.categoria, id:Date.now() }]);
    } else {
      if (podeAdicionar && !podeAdicionar(planoAtualObj, "extras", extrasMes.length)) { onLimiteAtingido && onLimiteAtingido(); return; }
      // Se for o "mês atual" (mesSel 0), usa a data real de agora em vez do array MESES
      // (calculado uma única vez quando a página carrega — se a aba ficar aberta de
      // um dia pro outro sem recarregar, esse array fica desatualizado e o gasto
      // seria salvo com o mês errado, ficando "perdido" depois do próximo refresh).
      const hoje = new Date();
      const mesRealAlvo = mesSel === 0 ? hoje.getMonth() : mesAtual.mes;
      const anoRealAlvo = mesSel === 0 ? hoje.getFullYear() : mesAtual.ano;
      setExtras(e=>[...e, {
        nome:novoItem.nome, valor:parseFloat(novoItem.valor), cartao:novoItem.cartao, categoria:novoItem.categoria, data:novoItem.data,
        id:Date.now(), mesReal:mesRealAlvo, anoReal:anoRealAlvo
      }]);
    }
    setNovoItem({ nome:"", valor:"", cartao:"", categoria:"", data:"" });
    setShowForm(false);
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:0, color:C.grayLight }}>Gastos</h2>
        <button onClick={()=>{
          if (!showForm) {
            const semLimiteAtingido = tipoNovo === "fixo"
              ? !podeAdicionar || podeAdicionar(planoAtualObj, "fixos", fixos.length)
              : !podeAdicionar || podeAdicionar(planoAtualObj, "extras", extrasMes.length);
            if (!semLimiteAtingido) { (tipoNovo === "fixo" ? onLimiteAtingidoFixo : onLimiteAtingido)?.(); return; }
          }
          setShowForm(!showForm);
        }} style={{ ...btnPri, padding:"7px 12px", fontSize:"0.75rem" }}>
          {showForm?"✕ Fechar":"+ Adicionar"}
        </button>
      </div>
      {onImportar && (
        <div onClick={onImportar} style={{ display:"flex", alignItems:"center", gap:5, fontSize:"0.72rem", color:C.gray, marginBottom:14, cursor:"pointer", width:"fit-content" }}>
          📥 ou <span style={{ color:C.primary, textDecoration:"underline", fontWeight:600 }}>importe de uma planilha</span>
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, background:C.card, borderRadius:12, padding:"10px 12px", border:`1px solid ${C.border}` }}>
        <button onClick={()=>setMesSel(m=>Math.max(0,m-1))} disabled={mesSel===0}
          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesSel===0?C.border:C.gray, width:32, height:32, cursor:mesSel===0?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>‹</button>
        <div style={{ flex:1, textAlign:"center" }}>
          <div style={{ fontSize:"0.92rem", fontWeight:800, color:C.grayLight }}>{mesAtual.label}</div>
          <div style={{ fontSize:"0.65rem", color:C.gray }}>{fmt(totalGeral)} · {itensUnificados.length} gasto(s)</div>
        </div>
        <button onClick={()=>setMesSel(m=>Math.min(MESES.length-1,m+1))} disabled={mesSel===MESES.length-1}
          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesSel===MESES.length-1?C.border:C.gray, width:32, height:32, cursor:mesSel===MESES.length-1?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>›</button>
      </div>

      {showForm && (
        <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.primary}55`, marginBottom:14, animation:"fadeIn 0.2s ease" }}>
          <div style={{ display:"flex", gap:8, marginBottom:12, background:C.surface, borderRadius:10, padding:4, border:`1px solid ${C.border}` }}>
            <div onClick={()=>setTipoNovo("mes")} style={{ flex:1, textAlign:"center", padding:"9px 4px", borderRadius:8, fontSize:"0.76rem", fontWeight:700, cursor:"pointer", background: tipoNovo==="mes" ? C.purple+"22" : "transparent", color: tipoNovo==="mes" ? C.purple : C.gray }}>📅 Do mês</div>
            <div onClick={()=>setTipoNovo("fixo")} style={{ flex:1, textAlign:"center", padding:"9px 4px", borderRadius:8, fontSize:"0.76rem", fontWeight:700, cursor:"pointer", background: tipoNovo==="fixo" ? C.orange+"22" : "transparent", color: tipoNovo==="fixo" ? C.orange : C.gray }}>🔁 Fixo</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <input placeholder="Descrição" value={novoItem.nome} onChange={e=>setNovoItem(x=>({...x,nome:e.target.value}))} style={inp()}/>
              <input type="number" placeholder="Valor (R$)" value={novoItem.valor} onChange={e=>setNovoItem(x=>({...x,valor:e.target.value}))} style={inp()}/>
            </div>
            <select value={novoItem.cartao||""} onChange={e=>setNovoItem(x=>({...x,cartao:e.target.value}))} style={inp()}>
              <option value="">Sem cartão (opcional)</option>
              {cartoes.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
            </select>
            {tipoNovo === "mes" && (
              <div>
                <div style={{ fontSize:"0.62rem", color:C.gray, marginBottom:3 }}>📅 Data do gasto (opcional)</div>
                <div style={{ position:"relative", overflow:"hidden", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface }}>
                  <input type="date" value={novoItem.data||""}
                    onChange={e=>setNovoItem(x=>({...x,data:e.target.value}))}
                    style={{ width:"100%", padding:"9px 12px", background:"transparent", border:"none", color:novoItem.data?C.grayLight:C.gray, fontSize:"0.82rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              </div>
            )}
            <select value={novoItem.categoria||""} onChange={e=>setNovoItem(x=>({...x,categoria:e.target.value}))} style={inp()}>
              <option value="">Categoria (opcional)</option>
              {categorias.map(cat=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.nome}</option>)}
            </select>
            <div style={{ fontSize:"0.68rem", color: tipoNovo==="fixo" ? C.orange : C.purple, marginTop:-4 }}>
              {tipoNovo==="fixo"
                ? "Esse valor vai se repetir todo mês a partir de agora, até você editar ou remover."
                : `Vale só pra ${mesAtual.label} — não repete em outros meses.`}
            </div>
            <button onClick={adicionar} style={{ ...btnPri, padding:"10px" }}>
              {tipoNovo==="fixo" ? "Adicionar gasto fixo" : "Adicionar gasto do mês"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[
          { k:"todos", l:"Todos" },
          { k:"fixo", l:"🔁 Fixos" },
          { k:"mes", l:"📅 Do mês" },
        ].map(f=>{
          const ativo = filtroTipo===f.k;
          const cor = f.k==="fixo" ? C.orange : f.k==="mes" ? C.purple : C.primaryLight;
          return (
            <div key={f.k} onClick={()=>setFiltroTipo(f.k)} style={{ flex:1, textAlign:"center", padding:"9px 4px", borderRadius:9, fontSize:"0.73rem", fontWeight:700, cursor:"pointer", border:`1px solid ${ativo?cor+"55":C.border}`, background: ativo ? cor+"22" : C.surface, color: ativo ? cor : C.gray }}>
              {f.l}
            </div>
          );
        })}
      </div>

      {totalItensExibidos === 0 ? (
        <div style={{ textAlign:"center", color:C.gray, padding:"50px 0" }}>
          <p style={{ fontSize:"2rem", margin:"0 0 8px" }}>🗓️</p>
          <p style={{ fontSize:"0.85rem" }}>Nenhum gasto {filtroTipo!=="todos" ? "dessa categoria " : ""}em {mesAtual.label}</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {ordemGrupos.map(key => {
            const itens = grupos[key] || [];
            const totalGrupo = itens.reduce((s,i)=>s+Number(i.valor),0);
            const qtdFixo = itens.filter(i=>i.__tipo==="fixo").length;
            const qtdMes = itens.filter(i=>i.__tipo==="mes").length;
            const aberto = expandidosGrupo[key] === true;
            const nomeGrupo = key === "__sem_cartao__" ? "Sem cartão" : key;
            const subLabel = [qtdFixo && `${qtdFixo} fixo(s)`, qtdMes && `${qtdMes} do mês`].filter(Boolean).join(" · ");

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
                    <div style={{ fontSize:"0.62rem", color:C.gray }}>{subLabel}</div>
                  </div>
                  <div style={{ textAlign:"right", marginRight:8 }}>
                    <div style={{ fontSize:"0.88rem", fontWeight:800, color:C.grayLight }}>{fmt(totalGrupo)}</div>
                  </div>
                  <span style={{ color:C.gray, fontSize:"0.72rem" }}>{aberto?"▲":"▼"}</span>
                </div>

                {aberto && (
                  <div style={{ padding:"0 12px 12px", animation:"fadeIn 0.2s ease" }}>
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, display:"flex", flexDirection:"column", gap:4 }}>
                      {itens.map(i => {
                        const ehFixo = i.__tipo === "fixo";
                        const corTipo = ehFixo ? C.orange : C.purple;
                        const emEdicao = ehFixo ? editandoFixo?.id===i.id : editandoExtra?.id===i.id;

                        return (
                          <div key={`${i.__tipo}_${i.id}`} style={{ background:C.surface, borderRadius:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                            {emEdicao ? (
                              ehFixo ? (
                                <div style={{ padding:"10px 12px" }}>
                                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                    <input value={editandoFixo.nome} onChange={ev=>setEditandoFixo(x=>({...x,nome:ev.target.value}))} style={inp()}/>
                                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                                      <input type="number" value={editandoFixo.valor} onChange={ev=>setEditandoFixo(x=>({...x,valor:ev.target.value}))} style={inp()}/>
                                      <select value={editandoFixo.cartao||""} onChange={ev=>setEditandoFixo(x=>({...x,cartao:ev.target.value}))} style={inp()}>
                                        <option value="">Sem cartão</option>
                                        {cartoes.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
                                      </select>
                                    </div>
                                    <select value={editandoFixo.categoria||""} onChange={ev=>setEditandoFixo(x=>({...x,categoria:ev.target.value}))} style={inp()}>
                                      <option value="">Categoria (opcional)</option>
                                      {categorias.map(cat=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.nome}</option>)}
                                    </select>
                                    <div style={{ display:"flex", gap:6 }}>
                                      <button onClick={salvarFixo} style={{ flex:2,...btnPri,padding:"8px" }}>✓ Salvar</button>
                                      <button onClick={()=>setEditandoFixo(null)} style={{ flex:1,padding:"8px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.gray,cursor:"pointer",fontFamily:"inherit" }}>Cancelar</button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
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
                              )
                            ) : (
                              <div style={{ padding:"9px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:"0.82rem", color:C.grayLight, fontWeight:500 }}>{i.nome}</div>
                                  <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap", alignItems:"center" }}>
                                    <span style={{ fontSize:"0.6rem", fontWeight:700, padding:"1px 7px", borderRadius:20, background:corTipo+"22", color:corTipo }}>
                                      {ehFixo ? "🔁 Fixo" : "📅 Do mês"}
                                    </span>
                                    {!ehFixo && i.data && <span style={{ fontSize:"0.62rem", color:C.gray }}>📅 {fmtData(i.data)}</span>}
                                    {categoriaLabel(i.categoria) && <span style={{ fontSize:"0.62rem", color:C.gray }}>{categoriaLabel(i.categoria)}</span>}
                                  </div>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                                  <span style={{ fontSize:"0.85rem", color:corTipo, fontWeight:700 }}>{fmt(i.valor)}</span>
                                  <button onClick={()=> ehFixo ? setEditandoFixo({...i}) : setEditandoExtra({...i})} style={{ background:"none",border:"none",color:C.gray,cursor:"pointer",fontSize:"0.85rem",padding:"4px" }}>✏️</button>
                                  <button onClick={()=>onPedirRemocao({tipo: ehFixo ? "fixo" : "extra", id:i.id, nome:i.nome})} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:"1rem",padding:"4px" }}>✕</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ background:C.surface, borderRadius:10, padding:"11px 14px", border:`1px solid ${C.border}`, marginTop:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:"0.84rem", fontWeight:700, color:C.grayLight }}>Total {mesAtual.label}</span>
              <span style={{ fontSize:"0.88rem", color:C.grayLight, fontWeight:800 }}>{fmt(totalGeral)}</span>
            </div>
            <div style={{ fontSize:"0.66rem", color:C.gray, marginTop:4 }}>
              🔁 {fmt(totalFixos)} fixos &nbsp;·&nbsp; 📅 {fmt(totalExtrasMes)} do mês
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
