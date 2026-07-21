import { useState, useMemo, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Login from "./Login";
import { ModalPerfil, TelaEditar } from "./Profile";
import Receita from "./Receita";
import ModalNovoCartao from "./ModalNovoCartao";
import Cartoes from "./Cartoes";
import GastosDoMes from "./GastosDoMes";

const CORES = {
  bg:"#0d1117", card:"#161b22", border:"#21262d", primary:"#2188c9",
  primaryLight:"#58a6ff", orange:"#e06c1a", gray:"#8b949e",
  grayLight:"#c9d1d9", green:"#3fb950", red:"#f85149",
  yellow:"#d29922", surface:"#1c2128", purple:"#a78bfa",
};

const CORES_LIGHT = {
  bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", primary:"#0969da",
  primaryLight:"#0969da", orange:"#bc4c00", gray:"#57606a",
  grayLight:"#1f2328", green:"#1a7f37", red:"#d1242f",
  yellow:"#9a6700", surface:"#f6f8fa", purple:"#6639ba",
};

const fmt = (v) => Number(v).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const getNow = () => new Date();

const gerarMeses = () => {
  const now = getNow();
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

const calcParcelasRestantes = (p) => {
  if (!p.dataCadastro) return Number(p.parcelas);
  const agora = getNow();
  const cadastro = new Date(p.dataCadastro);
  const mesesPassados = (agora.getFullYear()-cadastro.getFullYear())*12+(agora.getMonth()-cadastro.getMonth());
  return Math.max(0, Number(p.parcelasOriginal||p.parcelas)-mesesPassados);
};

const corSobra = (s,C) => s>=2000?C.green:s>=500?C.yellow:s>=0?C.orange:C.red;

function CartaoLogo({ grupo, cartoes, size=32 }) {
  const cartao = cartoes.find(c=>c.nome===grupo);
  if (cartao?.logo) return (
    <div style={{ width:size, height:size, borderRadius:size*0.25, background:cartao.bg||"#333", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.25)" }}>
      <img src={cartao.logo} alt={grupo} style={{ width:"75%", height:"75%", objectFit:"contain" }}
        onError={e=>{ e.target.style.display="none"; e.target.parentNode.innerHTML=`<span style="color:#fff;font-size:${size*0.45}px;font-weight:800">${grupo?.[0]||"?"}</span>`; }}/>
    </div>
  );
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.25, background:cartao?.bg||"#444", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.45, fontWeight:800, color:"#fff", flexShrink:0, boxShadow:"0 2px 8px rgba(0,0,0,0.25)" }}>
      {grupo?.[0]?.toUpperCase()||"?"}
    </div>
  );
}

function Donut({ pct, cor, C, size=80, stroke=8 }) {
  const r = (size-stroke)/2;
  const circ = 2*Math.PI*r;
  const dash = Math.max(0,Math.min(1,pct/100))*circ;
  return (
    <svg width={size} height={size} style={{ flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.surface} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cor} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition:"stroke-dasharray 0.6s ease" }}/>
      <text x={size/2} y={size/2-4} textAnchor="middle" fill={cor} fontSize={13} fontWeight="800">{Math.round(pct)}%</text>
      <text x={size/2} y={size/2+10} textAnchor="middle" fill={C.gray} fontSize={7}>livre</text>
    </svg>
  );
}

// Cálculo de amortização sem IA
function calcularAmortizacao(parcelas, valorDisponivel, tipo) {
  if (!parcelas || parcelas.length === 0) return null;

  const sorted = [...parcelas].sort((a, b) => {
    if (tipo === "prazo") {
      // Prioriza quem tem mais parcelas restantes (vai durar mais)
      return Number(b.parcelasRestantes) - Number(a.parcelasRestantes);
    } else {
      // Prioriza quem tem maior valor mensal (libera mais por mês)
      return Number(b.valor) - Number(a.valor);
    }
  });

  const alvo = sorted[0];
  if (!alvo) return null;

  const valorMensal = Number(alvo.valor);
  const restantes = Number(alvo.parcelasRestantes);
  const totalDevido = valorMensal * restantes;
  const valorAmort = Math.min(valorDisponivel, totalDevido);
  const parcelasEliminadas = Math.floor(valorAmort / valorMensal);
  const novoTotal = Math.max(0, totalDevido - valorAmort);
  const novasParcelas = Math.ceil(novoTotal / valorMensal);
  const economiaMensal = tipo === "mensal" ? (valorMensal - (novoTotal > 0 ? novoTotal / novasParcelas : 0)) : 0;

  return {
    parcela: alvo,
    valorAmort,
    parcelasEliminadas,
    restantesAntes: restantes,
    restantesDepois: novasParcelas,
    totalDevido,
    novoTotal,
    economiaMensal: tipo === "mensal" ? (valorAmort / restantes) : 0,
    liberaPorMes: valorMensal,
    mesesAntecipados: tipo === "prazo" ? parcelasEliminadas : 0,
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [aba, setAba] = useState("projecao");
  const [parcelas, setParcelas] = useState([]);
  const [fixos, setFixos] = useState([]);
  const [extras, setExtras] = useState([]);
  const [salario, setSalario] = useState(0);
  const [extrasReceita, setExtrasReceita] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [showProfile, setShowProfile] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [showNovaParcela, setShowNovaParcela] = useState(false);
  const [novaParc, setNovaParc] = useState({ grupo:"", nome:"", valor:"", parcelas:"" });
  const [novoFixo, setNovoFixo] = useState({ nome:"", valor:"", cartao:"" });
  const [novoExtra, setNovoExtra] = useState({ nome:"", valor:"", mes:0, cartao:"" });
  const [expandidosProj, setExpandidosProj] = useState({});
  const [expandidosCartMes, setExpandidosCartMes] = useState({});
  const [expandidosCart, setExpandidosCart] = useState({});
  const [expandidosParcela, setExpandidosParcela] = useState({});
  const [viewCartao, setViewCartao] = useState(null);
  // Timeout de segurança — sai do loading após 10s mesmo se Firebase travar
  useEffect(() => {
    const t = setTimeout(() => {
      setAuthLoading(false);
      setLoadStatus("loaded");
    }, 10000);
    return () => clearTimeout(t);
  }, []);

  const [dark, setDark] = useState(() => {
    try {
      const match = document.cookie.match(/finan_tema=([^;]+)/);
      return match ? match[1] === "true" : true;
    } catch { return true; }
  });
  const [editandoFixo, setEditandoFixo] = useState(null);
  const [editandoExtra, setEditandoExtra] = useState(null);
  const [editandoParcela, setEditandoParcela] = useState(null);

  // Amortização
  const [amorStep, setAmorStep] = useState("menu");
  const [amorValor, setAmorValor] = useState("");
  const [amorResultado, setAmorResultado] = useState(null);

  const C = dark ? CORES : CORES_LIGHT;
  const grupos = useMemo(()=>[...new Set(parcelas.map(p=>p.grupo).filter(Boolean))],[parcelas]);

  const parcelasComRestante = useMemo(()=>parcelas.map(p=>({
    ...p, parcelasRestantes: calcParcelasRestantes(p),
  })).filter(p=>p.parcelasRestantes>0),[parcelas]);

  const totalParcelasRestantes = useMemo(()=>
    parcelasComRestante.reduce((s,p)=>s+Number(p.valor)*p.parcelasRestantes,0),[parcelasComRestante]);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      try {
        setUser(u);
        if (u) {
          setParcelas([]);
          setFixos([]);
          setExtras([]);
          setSalario(0);
          setExtrasReceita([]);
          setCartoes([]);
          try {
            const snap = await getDoc(doc(db,"usuarios",u.uid));
            if (snap.exists()) {
              const d = snap.data();
              if (d.parcelas) setParcelas(d.parcelas);
              if (d.fixos) setFixos(d.fixos);
              if (d.extras) setExtras(d.extras);
              if (d.salario) setSalario(d.salario);
              if (d.extrasReceita) setExtrasReceita(d.extrasReceita);
              if (d.cartoes) setCartoes(d.cartoes);
              if (d.preferencias?.dark !== undefined) {
                setDark(d.preferencias.dark);
                try { document.cookie = `finan_tema=${d.preferencias.dark};max-age=31536000;path=/`; } catch {}
              }
            }
          } catch(firestoreErr) {
            console.error("Erro Firestore:", firestoreErr);
          }
          setLoadStatus("loaded");
        }
      } catch(authErr) {
        console.error("Erro Auth:", authErr);
      } finally {
        setAuthLoading(false);
      }
    });
    return unsub;
  },[]);

  const handleSave = useCallback(async (parc,fix,ext,sal,extRec,carts,prefs)=>{
    if (!auth.currentUser) return;
    setSaveStatus("saving");
    try {
      await setDoc(doc(db,"usuarios",auth.currentUser.uid),{
        parcelas:parc, fixos:fix, extras:ext, salario:sal,
        extrasReceita:extRec, cartoes:carts,
        ...(prefs !== undefined ? { preferencias:prefs } : {})
      });
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
    setTimeout(()=>setSaveStatus("idle"),3000);
  },[]);

  useEffect(()=>{
    if (loadStatus!=="loaded") return;
    const t = setTimeout(()=>handleSave(parcelas,fixos,extras,salario,extrasReceita,cartoes),800);
    return ()=>clearTimeout(t);
  },[parcelas,fixos,extras,salario,extrasReceita,cartoes,loadStatus,handleSave]);

  const salvarPreferencias = async (prefs) => {
    try { document.cookie = `finan_tema=${prefs.dark};max-age=31536000;path=/`; } catch {}
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db,"usuarios",auth.currentUser.uid),{ preferencias:prefs },{ merge:true });
    } catch(e) { console.error("Erro ao salvar preferências:", e); }
  };

  const totalFixos = useMemo(()=>fixos.reduce((s,f)=>s+Number(f.valor),0),[fixos]);

  const receitaMes = useCallback((idx)=>{
    const ext = extrasReceita.filter(e=>e.mes===idx).reduce((s,e)=>s+Number(e.valor),0);
    return salario+ext;
  },[salario,extrasReceita]);

  const projecao = useMemo(()=>MESES.map((m,i)=>{
    const totalParc = parcelasComRestante.reduce((s,p)=>s+(i<p.parcelasRestantes?Number(p.valor):0),0);
    const totalExtra = extras.filter(e=>e.mes===i).reduce((s,e)=>s+Number(e.valor),0);
    const gastos = totalFixos+totalParc+totalExtra;
    const receita = receitaMes(i);
    return { ...m, totalParc, totalExtra, gastos, sobra:receita-gastos, receita };
  }),[parcelasComRestante,fixos,extras,totalFixos,receitaMes]);

  const inp = (ov={})=>({ width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, color:C.grayLight, fontSize:"0.82rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box", ...ov });
  const btnPri = { background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, border:"none", borderRadius:8, color:"#fff", padding:"10px 18px", fontSize:"0.82rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" };
  const saveBtnStyle = { display:"inline-flex", alignItems:"center", gap:6, border:"none", borderRadius:8, color:"#fff", padding:"7px 14px", fontSize:"0.78rem", fontWeight:700, cursor:saveStatus==="saving"?"not-allowed":"pointer", fontFamily:"inherit", transition:"all 0.3s", background:saveStatus==="saved"?"#1a4a2e":saveStatus==="error"?"#4a1a1a":`linear-gradient(135deg,#1d6fa4,#2188c9)`, opacity:saveStatus==="saving"?0.75:1 };

  const salvarFixo = ()=>{ if(!editandoFixo?.nome||!editandoFixo?.valor)return; setFixos(p=>p.map(f=>f.id===editandoFixo.id?{...editandoFixo,valor:parseFloat(editandoFixo.valor)}:f)); setEditandoFixo(null); };
  const salvarExtra = ()=>{ if(!editandoExtra?.nome||!editandoExtra?.valor)return; setExtras(p=>p.map(e=>e.id===editandoExtra.id?{...editandoExtra,valor:parseFloat(editandoExtra.valor)}:e)); setEditandoExtra(null); };
  const salvarParcela = ()=>{ if(!editandoParcela?.nome||!editandoParcela?.valor)return; setParcelas(p=>p.map(x=>x.id===editandoParcela.id?{...editandoParcela,valor:parseFloat(editandoParcela.valor),parcelas:parseInt(editandoParcela.parcelas),parcelasOriginal:parseInt(editandoParcela.parcelas)}:x)); setEditandoParcela(null); };

  if (authLoading||loadStatus==="loading") return (
    <div style={{ minHeight:"100vh", background:CORES.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:36, height:36, border:`3px solid ${CORES.border}`, borderTop:`3px solid ${CORES.primary}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <p style={{ color:CORES.gray, fontSize:"0.82rem", fontFamily:"sans-serif" }}>Carregando...</p>
    </div>
  );

  if (!user) return <Login/>;
  const mesAtual = projecao[0];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',sans-serif", color:C.grayLight, transition:"background 0.3s" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#21262d;border-radius:4px}
      `}</style>

      {showProfile && !showEditar && (
        <ModalPerfil
          onClose={()=>setShowProfile(false)}
          dark={dark}
          onOpenEditar={()=>{ setShowProfile(false); setShowEditar(true); }}
        />
      )}

      {/* HEADER */}
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"12px 16px", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:700, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h1 style={{ fontSize:"1.1rem", fontWeight:800, color:C.grayLight, margin:0 }}>
            <span style={{ color:C.primary }}>💳</span> FinanControl
          </h1>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={()=>setShowProfile(true)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.gray, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>👤</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:700, margin:"0 auto", padding:"16px 16px 120px" }}>

        {/* TELA DE EDITAR CADASTRO */}
        {showEditar && (
          <TelaEditar
            onClose={()=>setShowEditar(false)}
            dark={dark}
            setDark={setDark}
            onSalvarPreferencias={salvarPreferencias}
          />
        )}

        {/* PROJEÇÃO */}
        {!showEditar && aba==="projecao" && (
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:0, color:C.grayLight }}>Projeção</h2>
              <div style={{ display:"flex", background:C.surface, borderRadius:8, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                <button onClick={()=>setViewCartao(null)} style={{ padding:"6px 12px", border:"none", fontSize:"0.72rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:viewCartao===null?C.primary:"transparent", color:viewCartao===null?"#fff":C.gray }}>Mensal</button>
                <button onClick={()=>setViewCartao("cartao")} style={{ padding:"6px 12px", border:"none", fontSize:"0.72rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:viewCartao==="cartao"?C.primary:"transparent", color:viewCartao==="cartao"?"#fff":C.gray }}>Por cartão</button>
              </div>
            </div>

            {/* MENSAL */}
            {viewCartao===null && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {projecao.map((m,i)=>{
                  const cor = corSobra(m.sobra,C);
                  const pct = m.receita>0?Math.max(0,Math.min(100,(m.sobra/m.receita)*100)):0;
                  const aberto = expandidosProj[i];
                  const cats = [
                    { label:"Gastos Fixos", val:totalFixos, cor:C.orange },
                    { label:"Parcelas", val:m.totalParc, cor:C.primary },
                    { label:"Gastos do Mês", val:m.totalExtra, cor:C.purple },
                  ];
                  return (
                    <div key={i} style={{ background:C.card, borderRadius:16, border:`1px solid ${aberto?cor+"66":C.border}`, overflow:"hidden", transition:"all 0.2s", boxShadow:aberto?`0 4px 20px ${cor}22`:"none" }}>
                      <div style={{ height:3, background:`linear-gradient(90deg,${cor},${cor}44)` }}/>
                      <div onClick={()=>setExpandidosProj(p=>({...p,[i]:!p[i]}))} style={{ padding:"16px", cursor:"pointer" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                          <Donut pct={pct} cor={cor} C={C} size={80} stroke={8}/>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                              <span style={{ fontSize:"1rem", fontWeight:800, color:C.grayLight }}>{m.label}</span>
                              <span style={{ color:C.gray, fontSize:"0.7rem" }}>{aberto?"▲":"▼"}</span>
                            </div>
                            <div style={{ fontSize:"0.62rem", color:C.gray, marginBottom:2 }}>Saldo restante</div>
                            <div style={{ fontSize:"1.3rem", fontWeight:800, color:cor, lineHeight:1.1 }}>{fmt(m.sobra)}</div>
                            <div style={{ fontSize:"0.68rem", color:C.gray, marginBottom:12 }}>de {fmt(m.receita)} de receita</div>
                            <div style={{ display:"flex", gap:4 }}>
                              {cats.map(c=>(
                                <div key={c.label} style={{ flex:1, minWidth:0, background:C.surface, borderRadius:8, padding:"5px 6px", textAlign:"center", border:`1px solid ${C.border}`, overflow:"hidden" }}>
                                  <div style={{ fontSize:"0.5rem", color:C.gray, marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.label}</div>
                                  <div style={{ fontSize:"0.65rem", fontWeight:700, color:c.cor, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmt(c.val)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      {aberto&&(
                        <div style={{ padding:"0 16px 16px", animation:"fadeIn 0.2s ease" }}>
                          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:12 }}>
                              {[
                                { l:"💰 Receita", v:m.receita, c:C.green },
                                { l:"📊 Total gastos", v:m.gastos, c:C.gray },
                                { l:"💰 Saldo restante", v:m.sobra, c:cor },
                                { l:"📉 % Comprometido", v:`${Math.round(100-pct)}%`, c:C.red, isStr:true },
                              ].map(({l,v,c,isStr})=>(
                                <div key={l} style={{ background:C.surface, borderRadius:8, padding:"8px 10px", border:`1px solid ${C.border}` }}>
                                  <div style={{ fontSize:"0.6rem", color:C.gray, marginBottom:2 }}>{l}</div>
                                  <div style={{ fontSize:"0.85rem", fontWeight:700, color:c }}>{isStr?v:fmt(v)}</div>
                                </div>
                              ))}
                            </div>
                            {parcelasComRestante.filter(p=>i<p.parcelasRestantes).length>0&&(
                              <>
                                <div style={{ fontSize:"0.65rem", color:C.gray, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Parcelas deste mês</div>
                                {parcelasComRestante.filter(p=>i<p.parcelasRestantes).map(p=>{
                                  const totalP = Number(p.parcelasOriginal||p.parcelas);
                                  const parcAtual = totalP-p.parcelasRestantes+i+1;
                                  return (
                                    <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 8px", background:C.surface, borderRadius:8, marginBottom:4, border:`1px solid ${C.border}` }}>
                                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                        <CartaoLogo grupo={p.grupo} cartoes={cartoes} size={22}/>
                                        <span style={{ fontSize:"0.76rem", color:C.grayLight }}>{p.nome}</span>
                                        <span style={{ background:C.primary+"22", color:C.primary, borderRadius:20, padding:"1px 7px", fontSize:"0.62rem", fontWeight:700 }}>{parcAtual}/{totalP}</span>
                                      </div>
                                      <span style={{ fontSize:"0.78rem", color:C.primary, fontWeight:700 }}>{fmt(p.valor)}</span>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* POR CARTÃO — mês a mês com total, expandindo mostra cada cartão */}
            {viewCartao==="cartao" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {projecao.map((m,i)=>{
                  const aberto = expandidosCartMes[i];
                  // Total geral de todos os cartões neste mês
                  const totalMesGeral = cartoes.reduce((sum, cartao)=>{
                    const parcsCartao = parcelasComRestante.filter(p=>p.grupo===cartao.nome&&i<p.parcelasRestantes).reduce((s,p)=>s+Number(p.valor),0);
                    const gastosCartao = extras.filter(e=>e.cartao===cartao.nome&&e.mes===i).reduce((s,e)=>s+Number(e.valor),0);
                    return sum + parcsCartao + gastosCartao;
                  },0);

                  if (totalMesGeral===0&&!aberto) return null;

                  // Cartões com gasto neste mês
                  const cartoesComGasto = cartoes.map(cartao=>{
                    const parcsCartao = parcelasComRestante.filter(p=>p.grupo===cartao.nome&&i<p.parcelasRestantes).reduce((s,p)=>s+Number(p.valor),0);
                    const gastosCartao = extras.filter(e=>e.cartao===cartao.nome&&e.mes===i).reduce((s,e)=>s+Number(e.valor),0);
                    return { ...cartao, totalMes: parcsCartao+gastosCartao, parcelas: parcsCartao, gastos: gastosCartao };
                  }).filter(c=>c.totalMes>0);

                  if (cartoesComGasto.length===0) return null;

                  return (
                    <div key={i} style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                      <div onClick={()=>setExpandidosCartMes(p=>({...p,[i]:!p[i]}))} style={{ padding:"14px 16px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <div style={{ fontSize:"0.92rem", fontWeight:800, color:C.grayLight }}>{m.label}</div>
                          <div style={{ fontSize:"0.65rem", color:C.gray, marginTop:2 }}>{cartoesComGasto.length} cartão(ões) com gasto</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontSize:"0.95rem", fontWeight:800, color:C.primary }}>{fmt(totalMesGeral)}</div>
                            <div style={{ fontSize:"0.6rem", color:C.gray }}>total no mês</div>
                          </div>
                          <span style={{ color:C.gray, fontSize:"0.7rem" }}>{aberto?"▲":"▼"}</span>
                        </div>
                      </div>

                      {aberto&&(
                        <div style={{ padding:"0 16px 14px", animation:"fadeIn 0.2s ease" }}>
                          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:"flex", flexDirection:"column", gap:6 }}>
                            {cartoesComGasto.map(cartao=>(
                              <div key={cartao.nome} style={{ background:C.surface, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}` }}>
                                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: (cartao.parcelas>0&&cartao.gastos>0)?8:0 }}>
                                  <CartaoLogo grupo={cartao.nome} cartoes={cartoes} size={28}/>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:"0.82rem", fontWeight:700, color:C.grayLight }}>{cartao.nome}</div>
                                  </div>
                                  <div style={{ fontSize:"0.88rem", fontWeight:800, color:C.primary }}>{fmt(cartao.totalMes)}</div>
                                </div>
                                {/* Detalhe parcelas vs gastos do mês */}
                                {cartao.parcelas>0&&cartao.gastos>0&&(
                                  <div style={{ display:"flex", gap:8, paddingLeft:38 }}>
                                    <span style={{ fontSize:"0.65rem", color:C.primary }}>💳 Parcelas: {fmt(cartao.parcelas)}</span>
                                    <span style={{ fontSize:"0.65rem", color:C.purple }}>🗓️ Gastos: {fmt(cartao.gastos)}</span>
                                  </div>
                                )}
                                {cartao.parcelas>0&&cartao.gastos===0&&(
                                  <div style={{ paddingLeft:38, fontSize:"0.65rem", color:C.primary }}>💳 Parcelas: {fmt(cartao.parcelas)}</div>
                                )}
                                {cartao.gastos>0&&cartao.parcelas===0&&(
                                  <div style={{ paddingLeft:38, fontSize:"0.65rem", color:C.purple }}>🗓️ Gastos do mês: {fmt(cartao.gastos)}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PARCELAS */}
        {!showEditar && aba==="parcelas"&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:0, color:C.grayLight }}>Parcelas</h2>
              <button onClick={()=>setShowNovaParcela(!showNovaParcela)} style={{ ...btnPri, padding:"7px 12px", fontSize:"0.75rem" }}>
                {showNovaParcela?"✕ Fechar":"+ Nova parcela"}
              </button>
            </div>
            {showNovaParcela&&(
              <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.primary}55`, marginBottom:14, animation:"fadeIn 0.2s ease" }}>
                <div style={{ fontSize:"0.68rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>Nova parcela</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <select value={novaParc.grupo} onChange={e=>setNovaParc(p=>({...p,grupo:e.target.value}))} style={inp()}>
                    <option value="">Selecione o cartão</option>
                    {cartoes.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
                  </select>
                  {cartoes.length===0&&<div style={{ fontSize:"0.72rem", color:C.orange, textAlign:"center", padding:"6px", background:C.surface, borderRadius:8 }}>⚠️ Vá em Cartões para adicionar um primeiro.</div>}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <input placeholder="Descrição" value={novaParc.nome} onChange={e=>setNovaParc(p=>({...p,nome:e.target.value}))} style={inp()}/>
                    <input type="number" placeholder="Valor (R$)" value={novaParc.valor} onChange={e=>setNovaParc(p=>({...p,valor:e.target.value}))} style={inp()}/>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8 }}>
                    <input type="number" placeholder="Parcelas restantes" value={novaParc.parcelas} onChange={e=>setNovaParc(p=>({...p,parcelas:e.target.value}))} style={inp()}/>
                    <button onClick={()=>{
                      if(!novaParc.nome||!novaParc.valor||!novaParc.parcelas||!novaParc.grupo)return;
                      setParcelas(p=>[...p,{...novaParc,id:Date.now(),valor:parseFloat(novaParc.valor),parcelas:parseInt(novaParc.parcelas),parcelasOriginal:parseInt(novaParc.parcelas),dataCadastro:new Date().toISOString()}]);
                      setNovaParc(prev=>({grupo:prev.grupo,nome:"",valor:"",parcelas:""}));
                      setShowNovaParcela(false);
                    }} style={btnPri}>Adicionar</button>
                  </div>
                </div>
              </div>
            )}
            {parcelasComRestante.length>0&&(
              <div style={{ background:C.card, borderRadius:10, padding:"12px 14px", marginBottom:14, display:"flex", justifyContent:"space-between", border:`1px solid ${C.border}` }}>
                <span style={{ fontSize:"0.82rem", fontWeight:700, color:C.grayLight }}>Valor total de parcelas</span>
                <span style={{ color:C.primary, fontWeight:800, fontSize:"0.9rem" }}>{fmt(totalParcelasRestantes)}</span>
              </div>
            )}
            {grupos.length===0?(
              <div style={{ textAlign:"center", color:C.gray, padding:"50px 0" }}>
                <p style={{ fontSize:"2rem", margin:"0 0 8px" }}>🧾</p>
                <p style={{ fontSize:"0.85rem" }}>Nenhuma parcela cadastrada</p>
              </div>
            ):grupos.map(grupo=>{
              const parcsGrupo = parcelasComRestante.filter(p=>p.grupo===grupo);
              if(parcsGrupo.length===0)return null;
              const aberto = expandidosCart[grupo]!==false;
              const totalGrupo = parcsGrupo.reduce((s,p)=>s+Number(p.valor)*p.parcelasRestantes,0);
              return (
                <div key={grupo} style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:8 }}>
                  <div onClick={()=>setExpandidosCart(p=>({...p,[grupo]:p[grupo]===false}))} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                    <CartaoLogo grupo={grupo} cartoes={cartoes} size={36}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"0.88rem", fontWeight:700, color:C.grayLight }}>{grupo}</div>
                      <div style={{ fontSize:"0.65rem", color:C.gray }}>{parcsGrupo.length} parcela(s)</div>
                    </div>
                    <div style={{ textAlign:"right", marginRight:8 }}>
                      <div style={{ fontSize:"0.85rem", fontWeight:700, color:C.primary }}>{fmt(totalGrupo)}</div>
                      <div style={{ fontSize:"0.6rem", color:C.gray }}>total restante</div>
                    </div>
                    <span style={{ color:C.gray, fontSize:"0.72rem" }}>{aberto?"▲":"▼"}</span>
                  </div>
                  {aberto&&(
                    <div style={{ padding:"0 12px 12px" }}>
                      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:"flex", flexDirection:"column", gap:6 }}>
                        {parcsGrupo.map(p=>{
                          const expandido = expandidosParcela[p.id];
                          const totalP = Number(p.parcelasOriginal||p.parcelas);
                          const parcAtual = totalP-p.parcelasRestantes+1;
                          return (
                            <div key={p.id} style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                              {editandoParcela?.id===p.id?(
                                <div style={{ padding:"12px" }}>
                                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                                    <input value={editandoParcela.nome} onChange={e=>setEditandoParcela(x=>({...x,nome:e.target.value}))} style={inp()}/>
                                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                                      <input type="number" value={editandoParcela.valor} onChange={e=>setEditandoParcela(x=>({...x,valor:e.target.value}))} style={inp()}/>
                                      <input type="number" value={editandoParcela.parcelas} onChange={e=>setEditandoParcela(x=>({...x,parcelas:e.target.value}))} style={inp()}/>
                                    </div>
                                    <div style={{ display:"flex", gap:8 }}>
                                      <button onClick={salvarParcela} style={{ flex:2,...btnPri,padding:"9px" }}>✓ Salvar</button>
                                      <button onClick={()=>setEditandoParcela(null)} style={{ flex:1,padding:"9px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.gray,cursor:"pointer",fontFamily:"inherit" }}>Cancelar</button>
                                    </div>
                                  </div>
                                </div>
                              ):(
                                <>
                                  <div onClick={()=>setExpandidosParcela(prev=>({...prev,[p.id]:!prev[p.id]}))} style={{ padding:"10px 12px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontSize:"0.82rem", fontWeight:600, color:C.grayLight, marginBottom:3 }}>{p.nome}</div>
                                      <span style={{ background:C.primary+"22", color:C.primary, borderRadius:20, padding:"1px 8px", fontSize:"0.62rem", fontWeight:700 }}>{parcAtual}/{totalP}</span>
                                    </div>
                                    <div style={{ textAlign:"right", flexShrink:0 }}>
                                      <div style={{ fontSize:"0.95rem", fontWeight:800, color:C.primary }}>{fmt(p.valor)}</div>
                                      <div style={{ fontSize:"0.6rem", color:C.gray }}>por mês</div>
                                    </div>
                                    <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:10 }}>
                                      <button onClick={e=>{e.stopPropagation();setEditandoParcela({...p});}} style={{ background:"none",border:"none",color:C.gray,cursor:"pointer",fontSize:"0.85rem",padding:"4px" }}>✏️</button>
                                      <button onClick={e=>{e.stopPropagation();setParcelas(x=>x.filter(i=>i.id!==p.id));}} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:"1rem",padding:"4px" }}>✕</button>
                                      <span style={{ color:C.gray, fontSize:"0.7rem" }}>{expandido?"▲":"▼"}</span>
                                    </div>
                                  </div>
                                  {expandido&&(
                                    <div style={{ padding:"0 12px 10px" }}>
                                      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                                        {[
                                          { l:"Valor/mês", v:fmt(p.valor), c:C.primary },
                                          { l:"Restam", v:`${p.parcelasRestantes}x`, c:C.grayLight },
                                          { l:"Total restante", v:fmt(Number(p.valor)*p.parcelasRestantes), c:C.orange },
                                        ].map(({l,v,c})=>(
                                          <div key={l} style={{ background:C.card, borderRadius:8, padding:"7px 10px", border:`1px solid ${C.border}` }}>
                                            <div style={{ fontSize:"0.58rem", color:C.gray, marginBottom:2 }}>{l}</div>
                                            <div style={{ fontSize:"0.8rem", fontWeight:700, color:c }}>{v}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
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
          </div>
        )}

        {/* CARTÕES */}
        {!showEditar && aba==="cartoes"&&(
          <Cartoes cartoes={cartoes} setCartoes={setCartoes} dark={dark}/>
        )}

        {/* FIXOS */}
        {!showEditar && aba==="fixos"&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <h2 style={{ fontSize:"0.95rem", fontWeight:700, marginBottom:14, color:C.grayLight }}>Gastos Fixos</h2>
            <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.border}`, marginBottom:12 }}>
              <div style={{ fontSize:"0.68rem", color:C.orange, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>+ Adicionar fixo</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <input placeholder="Descrição" value={novoFixo.nome} onChange={e=>setNovoFixo(f=>({...f,nome:e.target.value}))} style={inp()}/>
                  <input type="number" placeholder="Valor (R$)" value={novoFixo.valor} onChange={e=>setNovoFixo(f=>({...f,valor:e.target.value}))} style={inp()}/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8 }}>
                  <select value={novoFixo.cartao||""} onChange={e=>setNovoFixo(f=>({...f,cartao:e.target.value}))} style={inp()}>
                    <option value="">Sem cartão (opcional)</option>
                    {cartoes.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
                  </select>
                  <button onClick={()=>{ if(!novoFixo.nome||!novoFixo.valor)return; setFixos(f=>[...f,{...novoFixo,id:Date.now(),valor:parseFloat(novoFixo.valor)}]); setNovoFixo({nome:"",valor:"",cartao:""}); }} style={btnPri}>+</button>
                </div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {fixos.length===0?(
                <div style={{ textAlign:"center", color:C.gray, padding:"50px 0" }}>
                  <p style={{ fontSize:"2rem", margin:"0 0 8px" }}>📌</p>
                  <p style={{ fontSize:"0.85rem" }}>Nenhum gasto fixo cadastrado</p>
                </div>
              ):fixos.map(f=>(
                <div key={f.id} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                  {editandoFixo?.id===f.id?(
                    <div style={{ padding:"12px" }}>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                          <input value={editandoFixo.nome} onChange={e=>setEditandoFixo(x=>({...x,nome:e.target.value}))} style={inp()}/>
                          <input type="number" value={editandoFixo.valor} onChange={e=>setEditandoFixo(x=>({...x,valor:e.target.value}))} style={inp()}/>
                        </div>
                        <select value={editandoFixo.cartao||""} onChange={e=>setEditandoFixo(x=>({...x,cartao:e.target.value}))} style={inp()}>
                          <option value="">Sem cartão (opcional)</option>
                          {cartoes.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
                        </select>
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={salvarFixo} style={{ flex:2,...btnPri,padding:"9px" }}>✓ Salvar</button>
                          <button onClick={()=>setEditandoFixo(null)} style={{ flex:1,padding:"9px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.gray,cursor:"pointer",fontFamily:"inherit" }}>Cancelar</button>
                        </div>
                      </div>
                    </div>
                  ):(
                    <div style={{ padding:"11px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:"0.84rem", fontWeight:500, color:C.grayLight }}>📌 {f.nome}</div>
                        {f.cartao&&(
                          <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:3 }}>
                            <CartaoLogo grupo={f.cartao} cartoes={cartoes} size={14}/>
                            <span style={{ fontSize:"0.62rem", color:C.gray }}>{f.cartao}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:"0.88rem", color:C.orange, fontWeight:700 }}>{fmt(f.valor)}</span>
                        <button onClick={()=>setEditandoFixo({...f})} style={{ background:"none",border:"none",color:C.gray,cursor:"pointer",fontSize:"0.85rem",padding:"4px" }}>✏️</button>
                        <button onClick={()=>setFixos(x=>x.filter(i=>i.id!==f.id))} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:"1rem",padding:"4px" }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {fixos.length>0&&(
                <div style={{ background:C.surface, borderRadius:10, padding:"11px 14px", display:"flex", justifyContent:"space-between", marginTop:4, border:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:"0.84rem", fontWeight:700, color:C.grayLight }}>Total/mês</span>
                  <span style={{ fontSize:"0.88rem", color:C.orange, fontWeight:800 }}>{fmt(totalFixos)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GASTOS DO MÊS */}
        {!showEditar && aba==="gastos"&&(
          <GastosDoMes
            extras={extras} setExtras={setExtras}
            cartoes={cartoes} MESES={MESES}
            editandoExtra={editandoExtra} setEditandoExtra={setEditandoExtra}
            salvarExtra={salvarExtra} C={C} inp={inp} btnPri={btnPri}
            CartaoLogo={CartaoLogo}
          />
        )}

        {/* RECEITA */}
        {!showEditar && aba==="receita"&&(
          <Receita salario={salario} setSalario={setSalario} extrasReceita={extrasReceita} setExtrasReceita={setExtrasReceita} dark={dark}/>
        )}

        {/* AMORTIZAÇÃO */}
        {!showEditar && aba==="amortizacao"&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <h2 style={{ fontSize:"0.95rem", fontWeight:700, marginBottom:14, color:C.grayLight }}>💰 Simulador de Amortização</h2>

            {amorStep==="menu"&&(
              <div>
                <div style={{ background:C.card, borderRadius:14, padding:"16px", border:`1px solid ${C.border}`, marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:48, height:48, borderRadius:"50%", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>💸</div>
                  <div>
                    <div style={{ fontSize:"0.88rem", fontWeight:700, color:C.grayLight }}>Simulador de Amortização</div>
                    <div style={{ fontSize:"0.7rem", color:C.gray, marginTop:2 }}>Calcule a melhor forma de usar um valor extra para quitar dívidas</div>
                  </div>
                </div>
                <button onClick={()=>setAmorStep("valor")} style={{ width:"100%", ...btnPri, padding:"14px", fontSize:"0.88rem", borderRadius:12 }}>
                  Começar simulação →
                </button>
              </div>
            )}

            {amorStep==="valor"&&(
              <div>
                <button onClick={()=>setAmorStep("menu")} style={{ background:"none", border:"none", color:C.gray, cursor:"pointer", fontSize:"0.8rem", fontFamily:"inherit", marginBottom:14, display:"flex", alignItems:"center", gap:4, padding:0 }}>← Voltar</button>
                <h3 style={{ fontSize:"0.92rem", fontWeight:800, color:C.grayLight, marginBottom:4 }}>Quanto você tem para amortizar?</h3>
                <p style={{ fontSize:"0.76rem", color:C.gray, marginBottom:14 }}>Informe o valor disponível — reserva, 13º, bônus ou qualquer entrada extra.</p>
                <input type="number" placeholder="Ex: 2.000" value={amorValor} onChange={e=>setAmorValor(e.target.value)} onKeyDown={e=>e.key==="Enter"&&amorValor&&setAmorStep("tipo")}
                  style={{ ...inp(), padding:"14px", fontSize:"1rem", marginBottom:12 }}/>
                {amorValor&&(
                  <button onClick={()=>setAmorStep("tipo")} style={{ width:"100%", ...btnPri, padding:"13px", borderRadius:10, fontSize:"0.88rem" }}>Continuar →</button>
                )}
              </div>
            )}

            {amorStep==="tipo"&&(
              <div>
                <button onClick={()=>setAmorStep("valor")} style={{ background:"none", border:"none", color:C.gray, cursor:"pointer", fontSize:"0.8rem", fontFamily:"inherit", marginBottom:14, display:"flex", alignItems:"center", gap:4, padding:0 }}>← Voltar</button>
                <div style={{ background:C.card, borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}`, marginBottom:16, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:"0.8rem", color:C.gray }}>Valor para amortizar</span>
                  <span style={{ fontSize:"0.88rem", fontWeight:800, color:C.primary }}>{fmt(parseFloat(amorValor))}</span>
                </div>
                <h3 style={{ fontSize:"0.92rem", fontWeight:800, color:C.grayLight, marginBottom:4 }}>Qual é o seu objetivo?</h3>
                <p style={{ fontSize:"0.76rem", color:C.gray, marginBottom:16 }}>Escolha a estratégia que faz mais sentido para o seu momento.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {[
                    { tipo:"prazo", icon:"⏱️", titulo:"Quero terminar de pagar o mais rápido possível", desc:"Elimina as parcelas que ainda vão durar mais tempo. Você fica livre das dívidas mais cedo.", cor:C.green },
                    { tipo:"mensal", icon:"💸", titulo:"Meu foco é sobrar mais dinheiro todo mês", desc:"Reduz o valor que sai da conta mensalmente. Sente o alívio no bolso já no próximo mês.", cor:C.primary },
                  ].map(o=>(
                    <button key={o.tipo} onClick={()=>{
                      const res = calcularAmortizacao(parcelasComRestante, parseFloat(amorValor), o.tipo);
                      setAmorResultado({ ...res, tipo:o.tipo, cor:o.cor });
                      setAmorStep("resultado");
                    }} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 16px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", gap:14, alignItems:"flex-start" }}>
                      <div style={{ width:48, height:48, borderRadius:14, background:`${o.cor}22`, border:`1px solid ${o.cor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", flexShrink:0 }}>{o.icon}</div>
                      <div>
                        <div style={{ fontSize:"0.88rem", fontWeight:800, color:C.grayLight, marginBottom:4 }}>{o.titulo}</div>
                        <div style={{ fontSize:"0.72rem", color:C.gray, lineHeight:1.5 }}>{o.desc}</div>
                        <div style={{ marginTop:8, fontSize:"0.68rem", color:o.cor, fontWeight:600 }}>✓ {o.tipo==="prazo"?"Ideal para quem quer se livrar das dívidas logo":"Ideal para quem precisa de fôlego imediato"}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {amorStep==="resultado"&&amorResultado&&(
              <div style={{ animation:"fadeIn 0.3s ease" }}>
                <button onClick={()=>{setAmorStep("menu");setAmorValor("");setAmorResultado(null);}} style={{ background:"none", border:"none", color:C.gray, cursor:"pointer", fontSize:"0.8rem", fontFamily:"inherit", marginBottom:14, display:"flex", alignItems:"center", gap:4, padding:0 }}>← Nova simulação</button>
                <div style={{ background:C.card, borderRadius:16, border:`1px solid ${amorResultado.cor}44`, overflow:"hidden" }}>
                  <div style={{ height:4, background:`linear-gradient(90deg,${amorResultado.cor},${amorResultado.cor}44)` }}/>
                  <div style={{ padding:"16px" }}>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:"0.88rem", fontWeight:800, color:amorResultado.cor, marginBottom:2 }}>
                        {amorResultado.tipo==="prazo"?"⏱️ Melhor opção para reduzir prazo":"💸 Melhor opção para liberar valor mensal"}
                      </div>
                      <div style={{ fontSize:"0.65rem", color:C.gray }}>Baseado nas suas parcelas cadastradas</div>
                    </div>

                    <div style={{ background:C.surface, borderRadius:10, padding:"12px 14px", marginBottom:14, border:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:"0.65rem", color:C.gray, marginBottom:4 }}>Parcela recomendada</div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <CartaoLogo grupo={amorResultado.parcela?.grupo} cartoes={cartoes} size={28}/>
                        <div>
                          <div style={{ fontSize:"0.88rem", fontWeight:700, color:C.grayLight }}>{amorResultado.parcela?.nome}</div>
                          <div style={{ fontSize:"0.68rem", color:C.gray }}>{amorResultado.parcela?.grupo} · {fmt(amorResultado.parcela?.valor)}/mês</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                      {amorResultado.tipo==="prazo"?[
                        { l:"Valor a amortizar", v:fmt(amorResultado.valorAmort), c:C.grayLight, d:true },
                        { l:"Parcelas eliminadas", v:`${amorResultado.parcelasEliminadas}x`, c:amorResultado.cor, d:true },
                        { l:"Parcelas antes", v:`${amorResultado.restantesAntes}x`, c:C.gray },
                        { l:"Parcelas depois", v:`${amorResultado.restantesDepois}x`, c:C.green },
                        { l:"Total antes", v:fmt(amorResultado.totalDevido), c:C.gray },
                        { l:"Total depois", v:fmt(amorResultado.novoTotal), c:C.green },
                      ]:[
                        { l:"Valor a amortizar", v:fmt(amorResultado.valorAmort), c:C.grayLight, d:true },
                        { l:"Economia/mês est.", v:fmt(amorResultado.economiaMensal), c:amorResultado.cor, d:true },
                        { l:"Total antes", v:fmt(amorResultado.totalDevido), c:C.gray },
                        { l:"Total depois", v:fmt(amorResultado.novoTotal), c:C.green },
                        { l:"Parcelas restantes", v:`${amorResultado.restantesDepois}x`, c:C.gray },
                        { l:"Parcela/mês atual", v:fmt(amorResultado.parcela?.valor), c:C.orange },
                      ].map(({l,v,c,d})=>(
                        <div key={l} style={{ background:C.surface, borderRadius:8, padding:"9px 10px", border:`1px solid ${d?amorResultado.cor+"44":C.border}` }}>
                          <div style={{ fontSize:"0.6rem", color:C.gray, marginBottom:2 }}>{l}</div>
                          <div style={{ fontSize:"0.85rem", fontWeight:d?800:600, color:c }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background:C.surface, borderRadius:10, padding:"12px 14px", border:`1px solid ${C.border}`, borderLeft:`3px solid ${amorResultado.cor}` }}>
                      <div style={{ fontSize:"0.65rem", color:C.gray, marginBottom:4 }}>💡 Dica</div>
                      <p style={{ fontSize:"0.78rem", color:C.grayLight, margin:0, lineHeight:1.5 }}>
                        {amorResultado.tipo==="prazo"
                          ? `Amortizando ${fmt(amorResultado.valorAmort)} nessa parcela, você elimina ${amorResultado.parcelasEliminadas} mês(es) de pagamento e fica livre dessa dívida mais cedo.`
                          : `Amortizando ${fmt(amorResultado.valorAmort)}, você reduz o saldo devedor e pode negociar uma parcela menor com ${amorResultado.parcela?.grupo}, liberando mais espaço no seu orçamento mensal.`
                        }
                      </p>
                    </div>
                  </div>
                </div>
                <button onClick={()=>{setAmorStep("menu");setAmorValor("");setAmorResultado(null);}} style={{ width:"100%", marginTop:12, padding:"12px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.gray, cursor:"pointer", fontFamily:"inherit", fontSize:"0.82rem" }}>
                  Fazer outra simulação
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BARRA FLUTUANTE */}
      <div style={{ position:"fixed", bottom:16, left:"50%", transform:"translateX(-50%)", background:dark?"rgba(22,27,34,0.95)":"rgba(255,255,255,0.95)", backdropFilter:"blur(20px)", borderRadius:28, border:`1px solid ${C.border}`, boxShadow:"0 8px 32px rgba(0,0,0,0.2)", display:"flex", zIndex:200, padding:"6px 6px", gap:1, width:"calc(100% - 32px)", maxWidth:560 }}>
        {[
          { k:"projecao", icon:"📊", label:"Projeção" },
          { k:"parcelas", icon:"🧾", label:"Parcelas" },
          { k:"cartoes", icon:"💳", label:"Cartões" },
          { k:"fixos", icon:"📌", label:"Fixos" },
          { k:"gastos", icon:"🗓️", label:"Gastos" },
          { k:"receita", icon:"💰", label:"Receita" },
          { k:"amortizacao", icon:"💸", label:"Simular" },
        ].map(({k,icon,label})=>(
          <button key={k} onClick={()=>{ setShowEditar(false); setAba(k); }} style={{ flex:1, padding:"8px 2px 6px", border:"none", cursor:"pointer", fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", gap:2, borderRadius:20, background:aba===k&&!showEditar?C.primary+"22":"transparent", color:aba===k&&!showEditar?C.primaryLight:C.gray, transition:"all 0.2s" }}>
            <span style={{ fontSize:"1rem" }}>{icon}</span>
            <span style={{ fontSize:"0.52rem", fontWeight:aba===k&&!showEditar?700:400 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
