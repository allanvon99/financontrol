import { useState } from "react";

const CORES_LIGHT = {
  bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", surface:"#f6f8fa",
  text:"#1f2328", textSub:"#57606a", primary:"#0969da", primaryLight:"#0969da",
  green:"#1a7f37", red:"#d1242f", orange:"#bc4c00", purple:"#8250df",
};
const CORES_DARK = {
  bg:"#0d1117", card:"#161b22", border:"#21262d", surface:"#1c2128",
  text:"#c9d1d9", textSub:"#8b949e", primary:"#2188c9", primaryLight:"#58a6ff",
  green:"#3fb950", red:"#f85149", orange:"#e06c1a", purple:"#a78bfa",
};

const fmt = (v) => Number(v||0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const gerarMeses = () => {
  const now = new Date();
  const mes = now.getMonth();
  const ano = now.getFullYear();
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return Array.from({ length:18 }, (_,i) => {
    const m = (mes+i)%12;
    const a = ano+Math.floor((mes+i)/12);
    return { label:`${nomes[m]}/${a}`, mes:m, ano:a, idx:i };
  });
};
const MESES = gerarMeses();

// ===== Helpers de renda variável (mesmo comportamento usado no App.js) =====
const chaveMes = (m) => `${m.ano}-${m.mes}`;

const rendaLiquidaDoMes = (rendasPorMes, m) => {
  const chave = chaveMes(m);
  if (rendasPorMes[chave] !== undefined) {
    const r = rendasPorMes[chave];
    const perc = r.perc || 0;
    return { valorBruto: r.valor, perc, valor: r.valor*(1-perc/100), definido: true };
  }
  let melhor = null;
  Object.keys(rendasPorMes).forEach(k => {
    const [ano,mes] = k.split("-").map(Number);
    const chaveNum = ano*12+mes;
    const alvoNum = m.ano*12+m.mes;
    if (chaveNum < alvoNum && (!melhor || chaveNum > melhor.chaveNum)) melhor = { chaveNum, ...rendasPorMes[k] };
  });
  if (melhor) {
    const perc = melhor.perc || 0;
    return { valorBruto: melhor.valor, perc, valor: melhor.valor*(1-perc/100), definido: false, origemChaveNum: melhor.chaveNum };
  }
  return { valorBruto: 0, perc: 0, valor: 0, definido: false };
};

const extraAplicaAoMes = (e, m) => {
  if (!e.recorrencia || e.recorrencia === "unico") {
    if (e.mesReal!==undefined && e.anoReal!==undefined) return e.mesReal===m.mes && e.anoReal===m.ano;
    const off = e.offset ?? e.mes ?? 0;
    return off === m.idx;
  }
  if (e.anoInicio===undefined || e.mesInicio===undefined) return false;
  const diff = (m.ano-e.anoInicio)*12 + (m.mes-e.mesInicio);
  if (e.recorrencia === "fixo") return diff >= 0;
  if (e.recorrencia === "parcelado") return diff >= 0 && diff < (e.parcelasTotal||1);
  return false;
};
const extraValorLiquido = (e) => Number(e.valor||0) * (1-(e.perc||0)/100);

const inpStyle = (C) => ({
  width:"100%", padding:"10px 12px", borderRadius:8,
  border:`1px solid ${C.border}`, background:C.surface,
  color:C.text, fontSize:"0.82rem", fontFamily:"inherit",
  outline:"none", boxSizing:"border-box"
});

export default function Receita({ rendasPorMes, setRendasPorMes, extrasReceita, setExtrasReceita, dark=true, onPedirRemocao }) {
  const C = dark ? CORES_DARK : CORES_LIGHT;
  const inp = inpStyle(C);

  const [mesSel, setMesSel] = useState(0);
  const [editandoRenda, setEditandoRenda] = useState(false);
  const [valorEditando, setValorEditando] = useState("");
  const [percAtiva, setPercAtiva] = useState(false);
  const [percEditando, setPercEditando] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editandoExtraId, setEditandoExtraId] = useState(null);
  const extraVazio = { descricao:"", valor:"", recorrencia:"unico", mesIdx:mesSel, parcelasTotal:"", percAtiva:false, perc:"" };
  const [novoExtra, setNovoExtra] = useState(extraVazio);

  const mesAtual = MESES[mesSel];
  const r = rendaLiquidaDoMes(rendasPorMes, mesAtual);

  const extrasDoMes = extrasReceita.filter(e => extraAplicaAoMes(e, mesAtual));
  const totalExtrasDoMes = extrasDoMes.reduce((s,e)=>s+extraValorLiquido(e),0);
  const totalMes = r.valor + totalExtrasDoMes;

  const mesOrigemLabel = (chaveNum) => {
    if (chaveNum===undefined) return "";
    const ano = Math.floor(chaveNum/12), mes = chaveNum%12;
    const encontrado = MESES.find(m=>m.ano===ano && m.mes===mes);
    return encontrado?.label || "";
  };

  const abrirEdicaoRenda = () => {
    setValorEditando(r.valorBruto || "");
    setPercEditando(r.perc || "");
    setPercAtiva(r.perc > 0);
    setEditandoRenda(true);
  };
  const salvarRenda = () => {
    const valor = parseFloat(valorEditando)||0;
    setRendasPorMes(prev => ({
      ...prev,
      [chaveMes(mesAtual)]: { valor, perc: percAtiva ? (parseFloat(percEditando)||0) : 0 },
    }));
    setEditandoRenda(false);
  };

  const abrirFormExtra = () => {
    setEditandoExtraId(null);
    setNovoExtra({ ...extraVazio, mesIdx:mesSel });
    setShowForm(true);
  };
  const fecharFormExtra = () => { setShowForm(false); setEditandoExtraId(null); };

  const editarExtra = (e) => {
    setEditandoExtraId(e.id);
    setNovoExtra({
      descricao: e.nome, valor: e.valor, recorrencia: e.recorrencia || "unico",
      mesIdx: e.recorrencia && e.recorrencia!=="unico"
        ? (MESES.findIndex(m=>m.ano===e.anoInicio && m.mes===e.mesInicio) ?? mesSel)
        : (MESES.findIndex(m=>m.ano===e.anoReal && m.mes===e.mesReal) ?? mesSel),
      parcelasTotal: e.parcelasTotal || "",
      percAtiva: (e.perc||0) > 0, perc: e.perc || "",
    });
    setShowForm(true);
  };

  const salvarExtra = () => {
    const n = novoExtra;
    if (!n.descricao || !n.valor) return;
    if (n.recorrencia==="parcelado" && !n.parcelasTotal) return;
    const mRef = MESES[n.mesIdx] ?? mesAtual;
    const dados = {
      nome: n.descricao, valor: parseFloat(n.valor),
      recorrencia: n.recorrencia,
      perc: n.percAtiva ? (parseFloat(n.perc)||0) : 0,
      ...(n.recorrencia === "unico"
        ? { mesReal: mRef.mes, anoReal: mRef.ano }
        : { mesInicio: mRef.mes, anoInicio: mRef.ano, ...(n.recorrencia==="parcelado" ? { parcelasTotal: parseInt(n.parcelasTotal) } : {}) }),
    };
    if (editandoExtraId) {
      setExtrasReceita(prev => prev.map(e => e.id===editandoExtraId ? { ...e, ...dados } : e));
    } else {
      setExtrasReceita(prev => [...prev, { id: Date.now(), ...dados }]);
    }
    fecharFormExtra();
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:"0 0 14px", color:C.text }}>💰 Receita</h2>

      {/* Seletor de mês */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, background:C.card, borderRadius:12, padding:"10px 12px", border:`1px solid ${C.border}` }}>
        <button onClick={()=>{ setMesSel(m=>Math.max(0,m-1)); setEditandoRenda(false); }} disabled={mesSel===0}
          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesSel===0?C.border:C.textSub, width:32, height:32, cursor:mesSel===0?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>‹</button>
        <div style={{ flex:1, textAlign:"center" }}>
          <div style={{ fontSize:"0.92rem", fontWeight:800, color:C.text }}>{mesAtual.label}</div>
        </div>
        <button onClick={()=>{ setMesSel(m=>Math.min(MESES.length-1,m+1)); setEditandoRenda(false); }} disabled={mesSel===MESES.length-1}
          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesSel===MESES.length-1?C.border:C.textSub, width:32, height:32, cursor:mesSel===MESES.length-1?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>›</button>
      </div>

      {/* Renda principal do mês */}
      <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}`, marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
          <div style={{ fontSize:"0.68rem", color:C.green, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Renda principal do mês</div>
          {!editandoRenda && (
            r.definido
              ? <span style={{ fontSize:"0.63rem", padding:"3px 8px", borderRadius:20, fontWeight:700, background:`${C.green}22`, color:C.green }}>✓ definido</span>
              : r.valor > 0
                ? <span style={{ fontSize:"0.63rem", padding:"3px 8px", borderRadius:20, fontWeight:700, background:`${C.textSub}22`, color:C.textSub }}>🔗 repetindo {mesOrigemLabel(r.origemChaveNum)}</span>
                : <span style={{ fontSize:"0.63rem", padding:"3px 8px", borderRadius:20, fontWeight:700, background:`${C.red}22`, color:C.red }}>sem valor ainda</span>
          )}
        </div>

        {editandoRenda ? (
          <div style={{ marginTop:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:"1.1rem", color:C.textSub }}>R$</span>
              <input type="number" autoFocus value={valorEditando} onChange={e=>setValorEditando(e.target.value)}
                placeholder="Valor bruto, se tiver imposto"
                style={{ fontSize:"1.3rem", fontWeight:800, background:"transparent", border:"none", borderBottom:`2px solid ${C.border}`, color:C.text, padding:"4px 0", outline:"none", width:"100%" }}/>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:8, marginTop:12, cursor:"pointer" }}>
              <input type="checkbox" checked={percAtiva} onChange={e=>setPercAtiva(e.target.checked)} style={{ width:15, height:15, accentColor:C.primary }}/>
              <span style={{ fontSize:"0.76rem", color:C.text }}>Esse valor tem imposto pra descontar?</span>
            </label>
            {percAtiva && (
              <div style={{ marginTop:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <input type="number" placeholder="Ex: 6" value={percEditando} onChange={e=>setPercEditando(e.target.value)} style={{ ...inp, width:80 }}/>
                  <span style={{ fontSize:"0.78rem", color:C.textSub }}>% de imposto</span>
                </div>
                {valorEditando && percEditando && (
                  <div style={{ marginTop:8, padding:"10px 12px", background:C.surface, borderRadius:8, fontSize:"0.76rem" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", color:C.textSub }}><span>Bruto</span><span>{fmt(valorEditando)}</span></div>
                    <div style={{ display:"flex", justifyContent:"space-between", color:C.red }}><span>Imposto ({percEditando}%)</span><span>-{fmt(valorEditando*percEditando/100)}</span></div>
                    <div style={{ display:"flex", justifyContent:"space-between", color:C.green, fontWeight:800, marginTop:4, paddingTop:4, borderTop:`1px solid ${C.border}` }}><span>Líquido</span><span>{fmt(valorEditando*(1-percEditando/100))}</span></div>
                  </div>
                )}
              </div>
            )}
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button onClick={salvarRenda} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,${C.primary})`, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✓ Salvar pra {mesAtual.label}</button>
              <button onClick={()=>setEditandoRenda(false)} style={{ padding:"10px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
              <span style={{ fontSize:"1.5rem", fontWeight:800, color: r.valor>0 ? C.green : C.textSub }}>{fmt(r.valor)}</span>
              <button onClick={abrirEdicaoRenda} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.textSub, padding:"7px 12px", fontSize:"0.75rem", cursor:"pointer", fontFamily:"inherit" }}>✏️ {r.definido ? "Editar" : "Ajustar este mês"}</button>
            </div>
            {r.perc > 0 && (
              <div style={{ fontSize:"0.66rem", color:C.textSub, marginTop:4 }}>Bruto {fmt(r.valorBruto)} · imposto {r.perc}% (-{fmt(r.valorBruto-r.valor)})</div>
            )}
          </>
        )}
      </div>

      {/* Total do mês */}
      <div style={{ background:C.card, borderRadius:10, padding:"12px 14px", marginBottom:14, display:"flex", justifyContent:"space-between", border:`1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:"0.82rem", fontWeight:700, color:C.text }}>Total de receitas no mês</div>
          <div style={{ fontSize:"0.62rem", color:C.textSub, marginTop:2 }}>Renda principal + {extrasDoMes.length} extra(s)</div>
        </div>
        <span style={{ color:C.green, fontWeight:800, fontSize:"0.95rem", alignSelf:"center" }}>{fmt(totalMes)}</span>
      </div>

      {/* Rendas extras */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontSize:"0.68rem", color:C.primaryLight, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700 }}>Rendas extras</div>
        <button onClick={()=> showForm ? fecharFormExtra() : abrirFormExtra()} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.primary, padding:"6px 12px", fontSize:"0.72rem", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>
          {showForm ? "✕ Fechar" : "+ Nova entrada"}
        </button>
      </div>

      {showForm && (
        <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.primary}55`, marginBottom:14, animation:"fadeIn 0.2s ease" }}>
          <input placeholder="Descrição (ex: Freela, cliente X...)" value={novoExtra.descricao} onChange={e=>setNovoExtra(x=>({...x,descricao:e.target.value}))} style={{ ...inp, marginBottom:8 }}/>
          <input type="number" placeholder="Valor (R$)" value={novoExtra.valor} onChange={e=>setNovoExtra(x=>({...x,valor:e.target.value}))} style={{ ...inp, marginBottom:8 }}/>

          <div style={{ fontSize:"0.66rem", color:C.textSub, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:700 }}>Isso se repete?</div>
          <div style={{ display:"flex", gap:6, marginBottom:8 }}>
            {[
              { id:"unico", label:"Só uma vez" },
              { id:"parcelado", label:"Parcelado" },
              { id:"fixo", label:"Fixo" },
            ].map(o=>(
              <button key={o.id} onClick={()=>setNovoExtra(x=>({...x,recorrencia:o.id}))}
                style={{ flex:1, padding:"8px 4px", borderRadius:8, border:`1px solid ${novoExtra.recorrencia===o.id?C.primary:C.border}`, background:novoExtra.recorrencia===o.id?`${C.primary}22`:"transparent", color:novoExtra.recorrencia===o.id?C.primaryLight:C.textSub, fontSize:"0.68rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {o.label}
              </button>
            ))}
          </div>

          {novoExtra.recorrencia==="unico" && (
            <select value={novoExtra.mesIdx} onChange={e=>setNovoExtra(x=>({...x,mesIdx:parseInt(e.target.value)}))} style={{ ...inp, marginBottom:8 }}>
              {MESES.map(m=><option key={m.idx} value={m.idx}>{m.label}</option>)}
            </select>
          )}

          {novoExtra.recorrencia==="parcelado" && (
            <div style={{ marginBottom:8 }}>
              <div style={{ display:"flex", gap:8 }}>
                <input type="number" min="2" placeholder="Quantas vezes?" value={novoExtra.parcelasTotal} onChange={e=>setNovoExtra(x=>({...x,parcelasTotal:e.target.value}))} style={{ ...inp, flex:1 }}/>
                <select value={novoExtra.mesIdx} onChange={e=>setNovoExtra(x=>({...x,mesIdx:parseInt(e.target.value)}))} style={{ ...inp, flex:1 }}>
                  {MESES.map(m=><option key={m.idx} value={m.idx}>{m.label}</option>)}
                </select>
              </div>
              <div style={{ fontSize:"0.68rem", color:C.textSub, marginTop:6, lineHeight:1.5 }}>Vai aparecer automaticamente por {novoExtra.parcelasTotal||"X"} meses seguidos, a partir do mês escolhido.</div>
            </div>
          )}

          {novoExtra.recorrencia==="fixo" && (
            <div style={{ marginBottom:8 }}>
              <select value={novoExtra.mesIdx} onChange={e=>setNovoExtra(x=>({...x,mesIdx:parseInt(e.target.value)}))} style={inp}>
                {MESES.map(m=><option key={m.idx} value={m.idx}>A partir de {m.label}</option>)}
              </select>
              <div style={{ fontSize:"0.68rem", color:C.textSub, marginTop:6, lineHeight:1.5 }}>Vai entrar automaticamente todo mês, sem precisar cadastrar de novo — ótimo pra clientes recorrentes.</div>
            </div>
          )}

          <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, cursor:"pointer" }}>
            <input type="checkbox" checked={novoExtra.percAtiva} onChange={e=>setNovoExtra(x=>({...x,percAtiva:e.target.checked}))} style={{ width:15, height:15, accentColor:C.primary }}/>
            <span style={{ fontSize:"0.76rem", color:C.text }}>Esse valor tem imposto pra descontar?</span>
          </label>
          {novoExtra.percAtiva && (
            <div style={{ marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <input type="number" placeholder="Ex: 6" value={novoExtra.perc} onChange={e=>setNovoExtra(x=>({...x,perc:e.target.value}))} style={{ ...inp, width:80 }}/>
                <span style={{ fontSize:"0.78rem", color:C.textSub }}>% de imposto</span>
              </div>
              {novoExtra.valor && novoExtra.perc && (
                <div style={{ marginTop:8, padding:"10px 12px", background:C.surface, borderRadius:8, fontSize:"0.76rem" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", color:C.textSub }}><span>Bruto</span><span>{fmt(novoExtra.valor)}</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between", color:C.red }}><span>Imposto ({novoExtra.perc}%)</span><span>-{fmt(novoExtra.valor*novoExtra.perc/100)}</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between", color:C.green, fontWeight:800, marginTop:4, paddingTop:4, borderTop:`1px solid ${C.border}` }}><span>Líquido</span><span>{fmt(novoExtra.valor*(1-novoExtra.perc/100))}</span></div>
                </div>
              )}
            </div>
          )}

          <button onClick={salvarExtra} style={{ width:"100%", padding:"10px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,${C.primary})`, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            {editandoExtraId ? "✓ Salvar alterações" : "Adicionar"}
          </button>
        </div>
      )}

      {extrasDoMes.length === 0 ? (
        <div style={{ textAlign:"center", color:C.textSub, padding:"24px 0" }}>
          <p style={{ fontSize:"1.6rem", margin:"0 0 6px" }}>💰</p>
          <p style={{ fontSize:"0.82rem" }}>Nenhuma renda extra em {mesAtual.label}</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {extrasDoMes.map(e=>{
            let badge = null;
            if (e.recorrencia==="fixo") badge = <span style={{ fontSize:"0.62rem", padding:"2px 7px", borderRadius:20, fontWeight:700, background:`${C.primary}22`, color:C.primaryLight }}>🔁 Fixo</span>;
            if (e.recorrencia==="parcelado") {
              const parc = (mesAtual.ano-e.anoInicio)*12 + (mesAtual.mes-e.mesInicio) + 1;
              badge = <span style={{ fontSize:"0.62rem", padding:"2px 7px", borderRadius:20, fontWeight:700, background:`${C.purple}22`, color:C.purple }}>📆 {parc}/{e.parcelasTotal}</span>;
            }
            return (
              <div key={e.id} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:"0.82rem", color:C.text, fontWeight:600 }}>{e.nome}</div>
                  <div style={{ display:"flex", gap:6, marginTop:4, alignItems:"center" }}>
                    {badge}
                    {e.perc>0 && <span style={{ fontSize:"0.62rem", color:C.textSub }}>Bruto {fmt(e.valor)} · imposto {e.perc}%</span>}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:"0.85rem", color:C.green, fontWeight:700 }}>{fmt(extraValorLiquido(e))}</span>
                  <button onClick={()=>editarExtra(e)} style={{ background:"none", border:"none", color:C.textSub, cursor:"pointer", fontSize:"0.85rem", padding:"2px" }}>✏️</button>
                  <button onClick={()=>onPedirRemocao({tipo:"extraReceita", id:e.id, nome:e.nome})} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:"0.95rem", padding:"2px" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
