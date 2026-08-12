import { useMemo, useState } from "react";

const fmt = (v) => Number(v||0).toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });
const pctFmt = (v) => `${Math.round(v)}%`;

function Donut({ dados, size=170, stroke=25, C, centroValor }) {
  const total = dados.reduce((s,d)=>s+d.valor,0);
  const r = (size-stroke)/2;
  const circ = 2*Math.PI*r;
  let acc = 0;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.surface} strokeWidth={stroke}/>
        {dados.map((d,i)=>{
          const frac = total>0 ? d.valor/total : 0;
          const dash = frac*circ;
          const el = (
            <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={d.cor} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-acc}
              style={{ transition:"stroke-dasharray 0.5s ease" }}/>
          );
          acc += dash;
          return el;
        })}
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:"0.58rem", color:C.gray||C.textSub, marginBottom:2 }}>Total</div>
        <div style={{ fontSize:"0.9rem", fontWeight:800, color:C.grayLight||C.text }}>{centroValor}</div>
      </div>
    </div>
  );
}

export default function RaioXMes({ C, mes, dados, categorias, cartoes, onVoltar }) {
  const [visao, setVisao] = useState("categoria");
  const [catAberta, setCatAberta] = useState(null);
  const TXT = C.grayLight || C.text;
  const SUB = C.gray || C.textSub;

  const catDe = (id) => categorias.find(c=>c.id===id) || { id:"outros", nome:"Sem categoria", emoji:"📦", cor:SUB };

  // Monta lista unificada do mês
  const TODOS = useMemo(()=>{
    const fixos = (dados.fixos||[]).map(f=>({ ...f, tipo:"fixo", valor:Number(f.valor) }));
    const parcs = (dados.parcelasMes||[]).map(p=>({ ...p, tipo:"parcela", valor:Number(p.valor) }));
    const gastos = (dados.gastosMes||[]).map(g=>({ ...g, tipo:"gasto", valor:Number(g.valor) }));
    return [...fixos,...parcs,...gastos];
  },[dados]);

  const totalGasto = TODOS.reduce((s,i)=>s+i.valor,0);
  const receita = Number(dados.receita||0);
  const sobra = receita - totalGasto;
  const pctComprometido = receita>0 ? (totalGasto/receita)*100 : 0;

  const porCategoria = useMemo(()=>{
    const map = {};
    TODOS.forEach(i=>{
      const cid = i.categoria || "outros";
      if (!map[cid]) map[cid] = { valor:0, itens:[] };
      map[cid].valor += i.valor;
      map[cid].itens.push(i);
    });
    return Object.entries(map).map(([cid,d])=>({
      ...catDe(cid), valor:d.valor, itens:d.itens.sort((a,b)=>b.valor-a.valor)
    })).sort((a,b)=>b.valor-a.valor);
  },[TODOS,categorias]);

  const porTipo = useMemo(()=>[
    { id:"fixo", nome:"Gastos fixos", emoji:"📌", cor:C.orange, valor:(dados.fixos||[]).reduce((s,i)=>s+Number(i.valor),0) },
    { id:"parcela", nome:"Parcelas", emoji:"🧾", cor:C.primary, valor:(dados.parcelasMes||[]).reduce((s,i)=>s+Number(i.valor),0) },
    { id:"gasto", nome:"Gastos do mês", emoji:"🗓️", cor:C.purple, valor:(dados.gastosMes||[]).reduce((s,i)=>s+Number(i.valor),0) },
  ].filter(t=>t.valor>0).sort((a,b)=>b.valor-a.valor),[dados,C]);

  const porCartao = useMemo(()=>{
    const map = {};
    TODOS.forEach(i=>{
      const k = i.cartao || i.grupo || "__sem__";
      map[k] = (map[k]||0) + i.valor;
    });
    return Object.entries(map).map(([k,v])=>{
      const c = cartoes.find(x=>x.nome===k);
      return { id:k, nome: k==="__sem__" ? "Sem cartão" : k, valor:v, cor: c?.bg || SUB, emoji:"💳" };
    }).sort((a,b)=>b.valor-a.valor);
  },[TODOS,cartoes]);

  const dadosVisao = visao==="categoria" ? porCategoria : visao==="tipo" ? porTipo : porCartao;
  const maxValor = Math.max(...dadosVisao.map(d=>d.valor), 1);

  const insights = useMemo(()=>{
    const out = [];
    if (!TODOS.length) return out;
    const top = porCategoria[0];
    if (top && top.valor>0) out.push({
      tipo:"info", icone:top.emoji,
      titulo:`${top.nome} é seu maior gasto`,
      texto:`${fmt(top.valor)} este mês — ${pctFmt((top.valor/totalGasto)*100)} de tudo que você gasta.`
    });
    const parcTotal = porTipo.find(t=>t.id==="parcela")?.valor || 0;
    if (receita>0 && parcTotal/receita > 0.15) out.push({
      tipo:"alerta", icone:"🧾",
      titulo:`Parcelas consomem ${pctFmt((parcTotal/receita)*100)} da renda`,
      texto:`São ${fmt(parcTotal)} por mês travados em compras passadas.`
    });
    const gastoLivre = porTipo.find(t=>t.id==="gasto")?.valor || 0;
    if (gastoLivre>0) out.push({
      tipo:"dica", icone:"💡",
      titulo:"Onde você tem mais controle",
      texto:`${fmt(gastoLivre)} são gastos do dia a dia — a parte mais fácil de ajustar se precisar economizar.`
    });
    const semCat = porCategoria.find(c=>c.id==="outros");
    if (semCat && semCat.valor/totalGasto > 0.3) out.push({
      tipo:"dica", icone:"🏷️",
      titulo:"Muitos lançamentos sem categoria",
      texto:`${fmt(semCat.valor)} não estão categorizados. Categorize para enxergar melhor para onde vai seu dinheiro.`
    });
    return out;
  },[porCategoria,porTipo,totalGasto,receita,TODOS]);

  const corSobra = sobra<0 ? C.red : pctComprometido>80 ? C.orange : pctComprometido>60 ? C.yellow : C.green;
  const gastoLivre = porTipo.find(t=>t.id==="gasto")?.valor || 0;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, animation:"slideIn 0.25s ease" }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onVoltar} style={{ background:"none", border:"none", color:TXT, fontSize:"1.3rem", cursor:"pointer", padding:0, lineHeight:1 }}>←</button>
          <div>
            <div style={{ fontSize:"1rem", fontWeight:800, color:TXT }}>Raio-X de {mes.label}</div>
            <div style={{ fontSize:"0.68rem", color:SUB }}>{TODOS.length} lançamento(s) analisado(s)</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"16px" }}>

        {TODOS.length===0 ? (
          <div style={{ textAlign:"center", padding:"70px 20px", color:SUB }}>
            <div style={{ fontSize:"2.4rem", marginBottom:12, opacity:0.6 }}>📊</div>
            <div style={{ fontSize:"0.9rem", fontWeight:600, color:TXT, marginBottom:5 }}>Sem lançamentos neste mês</div>
            <div style={{ fontSize:"0.78rem", lineHeight:1.5 }}>Cadastre gastos, parcelas ou contas fixas<br/>para ver a análise completa.</div>
          </div>
        ) : (
          <>
            {/* Resumo */}
            <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:14 }}>
              <div style={{ height:3, background:`linear-gradient(90deg,${corSobra},${corSobra}44)` }}/>
              <div style={{ padding:16 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                  {[
                    { l:"Receita", v:fmt(receita), c:C.green },
                    { l:"Total gasto", v:fmt(totalGasto), c:TXT },
                    { l:"Saldo restante", v:fmt(sobra), c:corSobra, d:true },
                    { l:"Comprometido", v:pctFmt(pctComprometido), c:corSobra, d:true },
                  ].map(x=>(
                    <div key={x.l} style={{ background:C.surface, borderRadius:10, padding:"10px 12px", border:`1px solid ${x.d?corSobra+"33":C.border}` }}>
                      <div style={{ fontSize:"0.62rem", color:SUB, marginBottom:3 }}>{x.l}</div>
                      <div style={{ fontSize:"0.95rem", fontWeight:800, color:x.c }}>{x.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:"0.62rem", color:SUB, marginBottom:6 }}>Composição dos gastos</div>
                <div style={{ display:"flex", height:11, borderRadius:6, overflow:"hidden", background:C.surface, marginBottom:8 }}>
                  {porTipo.map(t=>(
                    <div key={t.id} style={{ width:`${(t.valor/totalGasto)*100}%`, background:t.cor, transition:"width 0.5s ease" }}/>
                  ))}
                </div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                  {porTipo.map(t=>(
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:5, fontSize:"0.66rem", color:SUB }}>
                      <span style={{ width:8, height:8, borderRadius:2, background:t.cor }}/>
                      {t.nome} · {pctFmt((t.valor/totalGasto)*100)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Insights */}
            {insights.length>0 && (
              <>
                <div style={{ fontSize:"0.66rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>O que os números dizem</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
                  {insights.map((ins,i)=>{
                    const cor = ins.tipo==="alerta" ? C.orange : ins.tipo==="dica" ? C.primary : SUB;
                    return (
                      <div key={i} style={{ background:C.card, borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}`, borderLeft:`3px solid ${cor}`, display:"flex", gap:11, alignItems:"flex-start" }}>
                        <span style={{ fontSize:"1.05rem", flexShrink:0 }}>{ins.icone}</span>
                        <div>
                          <div style={{ fontSize:"0.82rem", fontWeight:700, color:TXT, marginBottom:2 }}>{ins.titulo}</div>
                          <div style={{ fontSize:"0.75rem", color:SUB, lineHeight:1.5 }}>{ins.texto}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Visões */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:"0.66rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Distribuição</div>
              <div style={{ display:"flex", background:C.surface, borderRadius:9, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                {[{k:"categoria",l:"Categoria"},{k:"tipo",l:"Tipo"},{k:"cartao",l:"Cartão"}].map(v=>(
                  <button key={v.k} onClick={()=>{setVisao(v.k);setCatAberta(null);}}
                    style={{ padding:"6px 11px", border:"none", fontSize:"0.68rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                      background: visao===v.k ? C.primary : "transparent", color: visao===v.k ? "#fff" : SUB, transition:"all 0.2s" }}>
                    {v.l}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background:C.card, borderRadius:16, padding:18, border:`1px solid ${C.border}`, marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:18 }}>
                <Donut C={C} dados={dadosVisao} centroValor={fmt(totalGasto)}/>
              </div>
              {dadosVisao.map(d=>(
                <div key={d.id||d.nome} style={{ marginBottom:13 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:5 }}>
                    <div style={{ width:26, height:26, borderRadius:8, background:d.cor+"22", border:`1px solid ${d.cor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.8rem", flexShrink:0 }}>{d.emoji}</div>
                    <span style={{ fontSize:"0.8rem", fontWeight:600, color:TXT, flex:1, minWidth:0 }}>{d.nome}</span>
                    <div style={{ fontSize:"0.82rem", fontWeight:800, color:d.cor, flexShrink:0 }}>{fmt(d.valor)}</div>
                  </div>
                  <div style={{ height:7, borderRadius:4, background:C.surface, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(d.valor/maxValor)*100}%`, background:d.cor, borderRadius:4, transition:"width 0.5s ease" }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Detalhe por categoria */}
            {visao==="categoria" && (
              <>
                <div style={{ fontSize:"0.66rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>Detalhe de cada categoria</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
                  {porCategoria.map(cat=>{
                    const aberta = catAberta===cat.id;
                    return (
                      <div key={cat.id} style={{ background:C.card, borderRadius:13, border:`1px solid ${aberta?cat.cor+"44":C.border}`, overflow:"hidden" }}>
                        <div onClick={()=>setCatAberta(aberta?null:cat.id)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:11 }}>
                          <div style={{ width:34, height:34, borderRadius:10, background:cat.cor+"22", border:`1px solid ${cat.cor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>{cat.emoji}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:"0.85rem", fontWeight:700, color:TXT }}>{cat.nome}</div>
                            <div style={{ fontSize:"0.66rem", color:SUB }}>{cat.itens.length} lançamento(s) · {pctFmt((cat.valor/totalGasto)*100)} do total</div>
                          </div>
                          <div style={{ fontSize:"0.88rem", fontWeight:800, color:cat.cor, flexShrink:0 }}>{fmt(cat.valor)}</div>
                          <span style={{ color:SUB, fontSize:"0.7rem" }}>{aberta?"▲":"▼"}</span>
                        </div>
                        {aberta && (
                          <div style={{ padding:"0 14px 12px", animation:"fadeIn 0.2s ease" }}>
                            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:"flex", flexDirection:"column", gap:5 }}>
                              {cat.itens.map(item=>{
                                const ti = { fixo:{l:"Fixo",c:C.orange}, parcela:{l:item.parcelaLabel||"Parcela",c:C.primary}, gasto:{l:item.data||"Gasto",c:C.purple} }[item.tipo];
                                return (
                                  <div key={item.tipo+item.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", background:C.surface, borderRadius:9, border:`1px solid ${C.border}` }}>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontSize:"0.78rem", color:TXT, fontWeight:500 }}>{item.nome}</div>
                                      <div style={{ display:"flex", gap:7, marginTop:3, alignItems:"center", flexWrap:"wrap" }}>
                                        <span style={{ fontSize:"0.6rem", color:ti.c, background:ti.c+"1a", borderRadius:20, padding:"1px 7px", fontWeight:600 }}>{ti.l}</span>
                                        {(item.cartao||item.grupo) && <span style={{ fontSize:"0.6rem", color:SUB }}>💳 {item.cartao||item.grupo}</span>}
                                      </div>
                                    </div>
                                    <div style={{ fontSize:"0.82rem", fontWeight:700, color:TXT, flexShrink:0 }}>{fmt(item.valor)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Top 5 */}
            <div style={{ fontSize:"0.66rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>Top 5 maiores lançamentos</div>
            <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:20 }}>
              {[...TODOS].sort((a,b)=>b.valor-a.valor).slice(0,5).map((item,i,arr)=>{
                const cat = catDe(item.categoria);
                return (
                  <div key={item.tipo+item.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"12px 14px", borderBottom: i<arr.length-1?`1px solid ${C.border}`:"none" }}>
                    <div style={{ width:24, height:24, borderRadius:"50%", background:C.surface, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.66rem", fontWeight:800, color:SUB, flexShrink:0 }}>{i+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"0.82rem", fontWeight:600, color:TXT }}>{item.nome}</div>
                      <div style={{ fontSize:"0.65rem", color:SUB, marginTop:2 }}>{cat.emoji} {cat.nome} · {pctFmt((item.valor/totalGasto)*100)} do mês</div>
                    </div>
                    <div style={{ fontSize:"0.88rem", fontWeight:800, color:cat.cor, flexShrink:0 }}>{fmt(item.valor)}</div>
                  </div>
                );
              })}
            </div>

            {/* Simulação */}
            {gastoLivre>0 && (
              <div style={{ background:`${C.primary}0d`, border:`1px solid ${C.primary}33`, borderRadius:14, padding:16, marginBottom:20 }}>
                <div style={{ fontSize:"0.78rem", fontWeight:700, color:C.primaryLight, marginBottom:8 }}>
                  💡 E se você cortasse 20% dos gastos do dia a dia?
                </div>
                <div style={{ fontSize:"0.75rem", color:SUB, lineHeight:1.55, marginBottom:12 }}>
                  Reduzindo {fmt(gastoLivre*0.2)} nos gastos variáveis, seu saldo do mês passaria de {fmt(sobra)} para <strong style={{color:C.green}}>{fmt(sobra + gastoLivre*0.2)}</strong>.
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                  <div style={{ background:C.card, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:"0.6rem", color:SUB, marginBottom:3 }}>Economia no ano</div>
                    <div style={{ fontSize:"0.9rem", fontWeight:800, color:C.green }}>{fmt(gastoLivre*0.2*12)}</div>
                  </div>
                  <div style={{ background:C.card, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:"0.6rem", color:SUB, marginBottom:3 }}>Novo comprometimento</div>
                    <div style={{ fontSize:"0.9rem", fontWeight:800, color:C.primary }}>{receita>0?pctFmt(((totalGasto-gastoLivre*0.2)/receita)*100):"—"}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
