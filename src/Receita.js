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

const getMesAtual = () => { const n = new Date(); return { mes:n.getMonth(), ano:n.getFullYear() }; };

const gerarMeses = () => {
  const { mes, ano } = getMesAtual();
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return Array.from({ length:18 }, (_,i) => {
    const m = (mes+i)%12;
    const a = ano+Math.floor((mes+i)/12);
    return { label:`${nomes[m]}/${a}`, mes:m, ano:a, idx:i };
  });
};

const MESES = gerarMeses();

export default function Receita({ salario, setSalario, extrasReceita, setExtrasReceita, dark=true }) {
  const C = dark ? CORES_DARK : CORES_LIGHT;
  const [editandoSalario, setEditandoSalario] = useState(false);
  const [salarioTemp, setSalarioTemp] = useState(salario);
  const [novoExtra, setNovoExtra] = useState({ nome:"", valor:"", mes:0 });
  const [editandoExtra, setEditandoExtra] = useState(null); // { id, nome, valor, mes }

  const inp = {
    width:"100%", padding:"10px 12px", borderRadius:8,
    border:`1px solid ${C.border}`, background:C.surface,
    color:C.text, fontSize:"0.82rem", fontFamily:"inherit",
    outline:"none", boxSizing:"border-box"
  };

  const totalMes = (idx) => {
    const ext = extrasReceita.filter(e=>e.mes===idx).reduce((s,e)=>s+Number(e.valor),0);
    return salario + ext;
  };

  const salvarExtra = () => {
    if (!editandoExtra?.nome||!editandoExtra?.valor) return;
    setExtrasReceita(prev => prev.map(e => e.id===editandoExtra.id ? { ...editandoExtra, valor:parseFloat(editandoExtra.valor) } : e));
    setEditandoExtra(null);
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <h2 style={{ fontSize:"0.95rem", fontWeight:700, marginBottom:4, color:C.text }}>💰 Receita</h2>
      <p style={{ fontSize:"0.75rem", color:C.textSub, marginBottom:16 }}>Salário fixo + entradas extras por mês</p>

      {/* Card salário */}
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

      {/* Adicionar entrada extra */}
      <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.border}`, marginBottom:14 }}>
        <div style={{ fontSize:"0.68rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>➕ Entrada Extra</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <input placeholder="Descrição (ex: Freelance, 13º...)" value={novoExtra.nome} onChange={e=>setNovoExtra(x=>({...x,nome:e.target.value}))} style={inp}/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <input type="number" placeholder="Valor (R$)" value={novoExtra.valor} onChange={e=>setNovoExtra(x=>({...x,valor:e.target.value}))} style={inp}/>
            <select value={novoExtra.mes} onChange={e=>setNovoExtra(x=>({...x,mes:parseInt(e.target.value)}))} style={inp}>
              {MESES.map((m,i)=><option key={i} value={i}>{m.label}</option>)}
            </select>
          </div>
          <button onClick={()=>{
            if (!novoExtra.nome||!novoExtra.valor) return;
            setExtrasReceita(e=>[...e,{...novoExtra,id:Date.now(),valor:parseFloat(novoExtra.valor)}]);
            setNovoExtra({nome:"",valor:"",mes:0});
          }} style={{ padding:"10px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            Adicionar entrada
          </button>
        </div>
      </div>

      {/* Resumo por mês — começa do mês atual */}
      <div style={{ fontSize:"0.68rem", color:C.textSub, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>Receita por mês</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {MESES.map((m,i) => {
          const extMes = extrasReceita.filter(e=>e.mes===i);
          const total = totalMes(i);
          return (
            <div key={i} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              <div style={{ padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"0.82rem", fontWeight:600, color:C.text }}>{m.label}</span>
                <span style={{ fontSize:"0.95rem", fontWeight:800, color:C.green }}>{fmt(total)}</span>
              </div>
              {extMes.length>0 && (
                <div style={{ padding:"0 14px 10px", borderTop:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:"0.65rem", color:C.textSub, margin:"8px 0 6px" }}>Entradas extras:</div>
                  {extMes.map(e=>(
                    <div key={e.id}>
                      {editandoExtra?.id===e.id ? (
                        /* Modo edição inline */
                        <div style={{ display:"flex", flexDirection:"column", gap:6, padding:"8px", background:C.surface, borderRadius:8, marginBottom:4, border:`1px solid ${C.primary}55` }}>
                          <input value={editandoExtra.nome} onChange={ev=>setEditandoExtra(x=>({...x,nome:ev.target.value}))} style={inp} placeholder="Descrição"/>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                            <input type="number" value={editandoExtra.valor} onChange={ev=>setEditandoExtra(x=>({...x,valor:ev.target.value}))} style={inp} placeholder="Valor"/>
                            <select value={editandoExtra.mes} onChange={ev=>setEditandoExtra(x=>({...x,mes:parseInt(ev.target.value)}))} style={inp}>
                              {MESES.map((mm,ii)=><option key={ii} value={ii}>{mm.label}</option>)}
                            </select>
                          </div>
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={salvarExtra} style={{ flex:2, padding:"8px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✓ Salvar</button>
                            <button onClick={()=>setEditandoExtra(null)} style={{ flex:1, padding:"8px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                          <span style={{ fontSize:"0.78rem", color:C.textSub }}>+ {e.nome}</span>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:"0.78rem", color:C.green, fontWeight:600 }}>{fmt(e.valor)}</span>
                            <button onClick={()=>setEditandoExtra({...e})} style={{ background:"none", border:"none", color:C.textSub, cursor:"pointer", fontSize:"0.8rem", padding:"2px" }}>✏️</button>
                            <button onClick={()=>setExtrasReceita(x=>x.filter(i=>i.id!==e.id))} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:"0.9rem", padding:"2px" }}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
