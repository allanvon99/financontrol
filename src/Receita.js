import { useState } from "react";

const CORES_LIGHT = {
  bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", surface:"#f6f8fa",
  text:"#1f2328", textSub:"#57606a", primary:"#0969da",
  green:"#1a7f37", red:"#d1242f", orange:"#bc4c00",
};
const CORES_DARK = {
  bg:"#0d1117", card:"#161b22", border:"#21262d", surface:"#1c2128",
  text:"#c9d1d9", textSub:"#8b949e", primary:"#2188c9",
  green:"#3fb950", red:"#f85149", orange:"#e06c1a",
};

const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

const pertenceAoMes = (e, m, idx) => {
  if (e.mesReal !== undefined && e.anoReal !== undefined) return e.mesReal === m.mes && e.anoReal === m.ano;
  const off = e.offset ?? e.mes ?? 0;
  return off === idx;
};

export default function Receita({ salario, setSalario, extrasReceita, setExtrasReceita, dark=true }) {
  const C = dark ? CORES_DARK : CORES_LIGHT;
  const [editandoSalario, setEditandoSalario] = useState(false);
  const [salarioTemp, setSalarioTemp] = useState(salario);
  const [mesSel, setMesSel] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [novoExtra, setNovoExtra] = useState({ nome:"", valor:"" });
  const [editandoExtra, setEditandoExtra] = useState(null);

  const mesAtual = MESES[mesSel];

  const inp = {
    width:"100%", padding:"10px 12px", borderRadius:8,
    border:`1px solid ${C.border}`, background:C.surface,
    color:C.text, fontSize:"0.82rem", fontFamily:"inherit",
    outline:"none", boxSizing:"border-box"
  };

  const extrasDoMes = extrasReceita.filter(e => pertenceAoMes(e, mesAtual, mesSel));
  const totalExtrasDoMes = extrasDoMes.reduce((s,e)=>s+Number(e.valor||0),0);
  const totalMes = salario + totalExtrasDoMes;

  const salvarExtra = () => {
    if (!editandoExtra?.nome||!editandoExtra?.valor) return;
    setExtrasReceita(prev => prev.map(e => e.id===editandoExtra.id ? { ...e, nome:editandoExtra.nome, valor:parseFloat(editandoExtra.valor) } : e));
    setEditandoExtra(null);
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <h2 style={{ fontSize:"0.95rem", fontWeight:700, marginBottom:4, color:C.text }}>💰 Receita</h2>
      <p style={{ fontSize:"0.75rem", color:C.textSub, marginBottom:16 }}>Salário fixo + entradas extras por mês</p>

      <div style={{ background:C.card, borderRadius:12, padding:16, border:`1px solid ${C.border}`, marginBottom:12 }}>
        <div style={{ fontSize:"0.68rem", color:C.green, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>💼 Salário Fixo Mensal</div>
        {editandoSalario ? (
          <div style={{ display:"flex", gap:8 }}>
            <input type="number" value={salarioTemp} onChange={e=>setSalarioTemp(parseFloat(e.target.value)||0)} style={{ ...inp, fontSize:"1rem" }} autoFocus/>
            <button onClick={()=>{ setSalario(salarioTemp); setEditandoSalario(false); }}
              style={{ padding:"10px 16px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>✓ Salvar</button>
            <button onClick={()=>setEditandoSalario(false)}
              style={{ padding:"10px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:"1.6rem", fontWeight:800, color:C.green }}>{fmt(salario)}</span>
            <button onClick={()=>{ setEditandoSalario(true); setSalarioTemp(salario); }}
              style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.textSub, padding:"7px 12px", fontSize:"0.75rem", cursor:"pointer", fontFamily:"inherit" }}>✏️ Editar</button>
          </div>
        )}
        <p style={{ fontSize:"0.7rem", color:C.textSub, margin:"8px 0 0" }}>Aplicado automaticamente em todos os meses</p>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, background:C.card, borderRadius:12, padding:"10px 12px", border:`1px solid ${C.border}` }}>
        <button onClick={()=>setMesSel(m=>Math.max(0,m-1))} disabled={mesSel===0}
          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesSel===0?C.border:C.textSub, width:32, height:32, cursor:mesSel===0?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>‹</button>
        <div style={{ flex:1, textAlign:"center" }}>
          <div style={{ fontSize:"0.92rem", fontWeight:800, color:C.text }}>{mesAtual.label}</div>
          <div style={{ fontSize:"0.65rem", color:C.textSub }}>{fmt(totalMes)} total · {extrasDoMes.length} extra(s)</div>
        </div>
        <button onClick={()=>setMesSel(m=>Math.min(MESES.length-1,m+1))} disabled={mesSel===MESES.length-1}
          style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesSel===MESES.length-1?C.border:C.textSub, width:32, height:32, cursor:mesSel===MESES.length-1?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>›</button>
      </div>

      <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.border}`, marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:showForm?10:0 }}>
          <div style={{ fontSize:"0.68rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>➕ Entrada Extra em {mesAtual.label}</div>
          <button onClick={()=>setShowForm(!showForm)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.primary, padding:"5px 10px", fontSize:"0.72rem", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>
            {showForm?"✕ Fechar":"+ Adicionar"}
          </button>
        </div>
        {showForm && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <input placeholder="Descrição (ex: Freelance, 13º...)" value={novoExtra.nome} onChange={e=>setNovoExtra(x=>({...x,nome:e.target.value}))} style={inp}/>
            <input type="number" placeholder="Valor (R$)" value={novoExtra.valor} onChange={e=>setNovoExtra(x=>({...x,valor:e.target.value}))} style={inp}/>
            <button onClick={()=>{
              if (!novoExtra.nome||!novoExtra.valor) return;
              setExtrasReceita(e=>[...e,{
                id:Date.now(), nome:novoExtra.nome, valor:parseFloat(novoExtra.valor),
                mesReal:mesAtual.mes, anoReal:mesAtual.ano
              }]);
              setNovoExtra({nome:"",valor:""});
              setShowForm(false);
            }} style={{ padding:"10px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Adicionar entrada
            </button>
          </div>
        )}
      </div>

      {extrasDoMes.length === 0 ? (
        <div style={{ textAlign:"center", color:C.textSub, padding:"30px 0" }}>
          <p style={{ fontSize:"1.6rem", margin:"0 0 6px" }}>💰</p>
          <p style={{ fontSize:"0.82rem" }}>Nenhuma entrada extra em {mesAtual.label}</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {extrasDoMes.map(e=>(
            <div key={e.id} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {editandoExtra?.id===e.id ? (
                <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:6 }}>
                  <input value={editandoExtra.nome} onChange={ev=>setEditandoExtra(x=>({...x,nome:ev.target.value}))} style={inp} placeholder="Descrição"/>
                  <input type="number" value={editandoExtra.valor} onChange={ev=>setEditandoExtra(x=>({...x,valor:ev.target.value}))} style={inp} placeholder="Valor"/>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={salvarExtra} style={{ flex:2, padding:"8px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✓ Salvar</button>
                    <button onClick={()=>setEditandoExtra(null)} style={{ flex:1, padding:"8px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"0.82rem", color:C.text }}>{e.nome}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:"0.85rem", color:C.green, fontWeight:700 }}>{fmt(e.valor)}</span>
                    <button onClick={()=>setEditandoExtra({...e})} style={{ background:"none", border:"none", color:C.textSub, cursor:"pointer", fontSize:"0.85rem", padding:"2px" }}>✏️</button>
                    <button onClick={()=>setExtrasReceita(x=>x.filter(i=>i.id!==e.id))} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:"0.95rem", padding:"2px" }}>✕</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
