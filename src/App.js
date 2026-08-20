import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import Login from "./Login";
import { ModalPerfil, TelaEditar } from "./Profile";
import Receita from "./Receita";
import ModalNovoCartao from "./ModalNovoCartao";
import Cartoes from "./Cartoes";
import Cadastros from "./Cadastros";
import Onboarding from "./Onboarding";
import GuiaTela from "./GuiaTela";
import Notificacoes, { SinoIcon, gerarNotificacoes } from "./Notificacoes";
import GerenciarConta from "./GerenciarConta";
import RaioXMes from "./RaioXMes";
import Feedback from "./Feedback";
import { iniciarMonitoramento, identificarUsuario, limparUsuario, registrarTela, registrarEvento, registrarErro } from "./monitoramento";
import { carregarPlanos, PLANOS_PADRAO, podeAdicionar, fmtPreco } from "./planos";
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

// Cálculo de amortização — prioriza QUITAR dívidas inteiras
function calcularAmortizacao(parcelas, valorDisponivel, tipo) {
  if (!parcelas?.length || !valorDisponivel) return null;

  const lista = parcelas.map(p => ({
    id: p.id, nome: p.nome, grupo: p.grupo,
    valorParcela: Number(p.valor),
    restantes: Number(p.parcelasRestantes ?? p.parcelas),
    totalOriginal: Number(p.parcelasOriginal || p.parcelas),
  })).filter(p => p.restantes > 0 && p.valorParcela > 0)
    .map(p => ({ ...p, custoQuitar: p.valorParcela * p.restantes }));

  // ── ETAPA 1: melhor combinação de dívidas que dá pra QUITAR inteiras ──
  const quitaveis = lista.filter(p => p.custoQuitar <= valorDisponivel);
  let melhorCombo = [];

  if (quitaveis.length) {
    const pontuar = (combo) => {
      if (tipo === "mensal") {
        // libera mais dinheiro por mês
        return combo.reduce((s,p)=>s+p.valorParcela,0);
      }
      // prazo: elimina as dívidas mais longas
      return combo.reduce((s,p)=>s+p.restantes,0);
    };

    // Busca exaustiva se poucos itens, guloso se muitos
    if (quitaveis.length <= 14) {
      const n = quitaveis.length;
      for (let mask = 1; mask < (1 << n); mask++) {
        const combo = [];
        let custo = 0;
        for (let i = 0; i < n; i++) {
          if (mask & (1 << i)) { combo.push(quitaveis[i]); custo += quitaveis[i].custoQuitar; }
        }
        if (custo > valorDisponivel) continue;
        if (pontuar(combo) > pontuar(melhorCombo)) melhorCombo = combo;
      }
    } else {
      const ordenado = [...quitaveis].sort((a,b)=>{
        const ea = (tipo === "mensal" ? a.valorParcela : a.restantes) / a.custoQuitar;
        const eb = (tipo === "mensal" ? b.valorParcela : b.restantes) / b.custoQuitar;
        return eb - ea;
      });
      let saldoG = valorDisponivel;
      for (const p of ordenado) {
        if (p.custoQuitar <= saldoG) { melhorCombo.push(p); saldoG -= p.custoQuitar; }
      }
    }
  }

  let saldo = valorDisponivel;
  const acoes = [];
  const idsQuitados = new Set(melhorCombo.map(p=>p.id));

  // Ordena as quitações pelo objetivo
  const combosOrdenados = [...melhorCombo].sort((a,b)=>
    tipo === "mensal" ? b.valorParcela - a.valorParcela : b.restantes - a.restantes
  );

  for (const p of combosOrdenados) {
    saldo -= p.custoQuitar;
    acoes.push({
      ...p, abatidas: p.restantes, gasto: p.custoQuitar,
      sobramDepois: 0, quitouTudo: true,
      liberaPorMes: p.valorParcela, mesesAntecipados: p.restantes,
    });
  }

  // ── ETAPA 2: com o troco, adianta parcelas das demais ──
  const restantesLista = lista
    .filter(p => !idsQuitados.has(p.id))
    .sort((a,b)=> tipo === "prazo"
      ? b.restantes - a.restantes || b.valorParcela - a.valorParcela
      : b.valorParcela - a.valorParcela || b.restantes - a.restantes
    );

  for (const p of restantesLista) {
    if (saldo < p.valorParcela) continue;
    const abatidas = Math.min(Math.floor(saldo / p.valorParcela), p.restantes);
    if (abatidas <= 0) continue;
    const gasto = abatidas * p.valorParcela;
    saldo -= gasto;
    acoes.push({
      ...p, abatidas, gasto,
      sobramDepois: p.restantes - abatidas,
      quitouTudo: abatidas >= p.restantes,
      liberaPorMes: abatidas >= p.restantes ? p.valorParcela : 0,
      mesesAntecipados: abatidas,
    });
    if (saldo <= 0) break;
  }

  if (!acoes.length) {
    const menor = lista.length ? Math.min(...lista.map(p=>p.valorParcela)) : 0;
    return { semAcao: true, valorDisponivel, sobra: valorDisponivel, menorParcela: menor, tipo };
  }

  const totalUsado = acoes.reduce((s,a)=>s+a.gasto,0);
  const totalParcelasAbatidas = acoes.reduce((s,a)=>s+a.abatidas,0);
  const quitadas = acoes.filter(a=>a.quitouTudo);
  const liberaPorMes = quitadas.reduce((s,a)=>s+a.valorParcela,0);
  const dividaAntes = lista.reduce((s,p)=>s+p.custoQuitar,0);
  const maiorPrazoAntes = Math.max(...lista.map(p=>p.restantes), 0);
  const restantesDepois = lista.map(p=>{
    const a = acoes.find(x=>x.id===p.id);
    return a ? a.sobramDepois : p.restantes;
  });

  return {
    tipo, acoes, valorDisponivel, totalUsado,
    sobra: valorDisponivel - totalUsado,
    totalParcelasAbatidas,
    quitadasCount: quitadas.length,
    liberaPorMes,
    dividaAntes,
    dividaDepois: dividaAntes - totalUsado,
    maiorPrazoAntes,
    maiorPrazoDepois: Math.max(...restantesDepois, 0),
    mesesEconomizados: maiorPrazoAntes - Math.max(...restantesDepois, 0),
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
  const [modoSeguranca, setModoSeguranca] = useState(false);
  const [avisoEmailFechado, setAvisoEmailFechado] = useState(false);
  const dadosBrutosCarregados = useRef(null); // snapshot exato do que veio do Firestore ao entrar
  const primeiroSalvamentoDaSessao = useRef(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [showProfile, setShowProfile] = useState(false);
  const [showEditar, setShowEditar] = useState(false);
  const [showNovaParcela, setShowNovaParcela] = useState(false);
  const [showNovoFixo, setShowNovoFixo] = useState(false);
  const [novaParc, setNovaParc] = useState({ grupo:"", nome:"", valor:"", parcelas:"", dataInicio:"" });
  const [novoFixo, setNovoFixo] = useState({ nome:"", valor:"", cartao:"" });
  const [novoExtra, setNovoExtra] = useState({ nome:"", valor:"", mes:0, cartao:"" });
  const [expandidosProj, setExpandidosProj] = useState({});
  const [expandidosCartMes, setExpandidosCartMes] = useState({});
  const [expandidosCart, setExpandidosCart] = useState({});
  const [expandidosParcela, setExpandidosParcela] = useState({});
  const [mesParcelas, setMesParcelas] = useState(0); // índice em MESES
  const [confirmRemover, setConfirmRemover] = useState(null);
  const [categorias, setCategorias] = useState([
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
  ]);
  const [saudeConfig, setSaudeConfig] = useState({ saudavel:60, atencao:80, ativos:true });
  const [onboardingConcluido, setOnboardingConcluido] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [guiasVistos, setGuiasVistos] = useState({});
  const [guiaAtivo, setGuiaAtivo] = useState(null);
  const [telaEspecial, setTelaEspecial] = useState(null); // "notificacoes" | "conta"
  const [menuPerfil, setMenuPerfil] = useState(false);
  const [abaConta, setAbaConta] = useState("dados");
  const [raioXMes, setRaioXMes] = useState(null);
  const [vvOffset, setVvOffset] = useState(0);
  const [mostrarFeedback, setMostrarFeedback] = useState(false);

  useEffect(()=>{
    const vv = window.visualViewport;
    if (!vv) return;
    const onChange = () => {
      const off = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      setVvOffset(off);
    };
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    onChange();
    return ()=>{ vv.removeEventListener("resize", onChange); vv.removeEventListener("scroll", onChange); };
  },[]);
  const [notifLidas, setNotifLidas] = useState({});
  const [sobrenomeUsuario, setSobrenomeUsuario] = useState("");
  const [planosConfig, setPlanosConfig] = useState(PLANOS_PADRAO);
  const [criadoEm, setCriadoEm] = useState(null);
  const [trialUsadoAnteriormente, setTrialUsadoAnteriormente] = useState(false);
  const [planoDb, setPlanoDb] = useState("free");
  const [showUpgrade, setShowUpgrade] = useState(null);
  const [abaContaInicial, setAbaContaInicial] = useState(null); // "cartoes" | "parcelas" | "fixos" | null

  useEffect(()=>{ iniciarMonitoramento(); },[]);
  useEffect(()=>{ carregarPlanos().then(setPlanosConfig); },[]);
  useEffect(()=>{
    if (new URLSearchParams(window.location.search).get("testarSentry") === "1") {
      registrarErro(new Error("Teste manual de monitoramento — pode ignorar"), { origem: "teste_manual" });
    }
  }, []);
  const [mesOffset, setMesOffset] = useState(0); // offset para meses retroativos
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

  useEffect(() => {
    document.body.style.background = C.bg;
    document.documentElement.style.background = C.bg;
  }, [C.bg]);
  const grupos = useMemo(()=>[...new Set(parcelas.map(p=>p.grupo).filter(Boolean))],[parcelas]);

  const parcelasComRestante = useMemo(()=>parcelas.map(p=>({
    ...p, parcelasRestantes: calcParcelasRestantes(p),
  })).filter(p=>p.parcelasRestantes>0),[parcelas]);

  const totalParcelasRestantes = useMemo(()=>
    parcelasComRestante.reduce((s,p)=>s+Number(p.valor)*p.parcelasRestantes,0),[parcelasComRestante]);

  // Total das parcelas só do mês atual
  const totalParcelasMesAtual = useMemo(()=>
    parcelasComRestante.reduce((s,p)=>s+(p.parcelasRestantes>0?Number(p.valor):0),0),[parcelasComRestante]);



  // Calcula o mês mais antigo disponível para consulta (data de início mais antiga)
  const mesMinParcelas = useMemo(()=>{
    let minOffset = 0;
    parcelas.forEach(p=>{
      if (p.dataCadastro) {
        const cadastro = new Date(p.dataCadastro);
        const agora = getNow();
        const diff = (agora.getFullYear()-cadastro.getFullYear())*12+(agora.getMonth()-cadastro.getMonth());
        if (-diff < minOffset) minOffset = -diff;
      }
    });
    return minOffset; // negativo = meses no passado
  },[parcelas]);

  const parcelasNoMesSel = useMemo(()=>{
    // mesParcelas pode ser negativo (meses passados) ou positivo (futuros)
    const offset = mesParcelas; // índice relativo ao mês atual
    return parcelas.map(p=>{
      const totalP = Number(p.parcelasOriginal||p.parcelas);
      let mesesDecorridos = 0;
      if (p.dataCadastro) {
        const cadastro = new Date(p.dataCadastro);
        const agora = getNow();
        mesesDecorridos = (agora.getFullYear()-cadastro.getFullYear())*12+(agora.getMonth()-cadastro.getMonth());
      }
      // Parcela atual no mês selecionado
      const parcelaAtualNoMes = mesesDecorridos + offset + 1;
      const restantesNoMes = totalP - parcelaAtualNoMes + 1;
      if (parcelaAtualNoMes < 1 || parcelaAtualNoMes > totalP) return null;
      return { ...p, restantesNoMes: Math.max(0,restantesNoMes), parcelaAtualNoMes, totalP };
    }).filter(Boolean);
  },[parcelas, mesParcelas]);

  const totalParcelasNoMesSel = useMemo(()=>
    parcelasNoMesSel.reduce((s,p)=>s+Number(p.valor),0),[parcelasNoMesSel]);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      try {
        setUser(u);
        setLoadStatus("loading"); // evita mostrar dado de uma conta anterior enquanto a nova carrega
        if (u) {
          primeiroSalvamentoDaSessao.current = true;
          dadosBrutosCarregados.current = null;
          setParcelas([]);
          setFixos([]);
          setExtras([]);
          setSalario(0);
          setExtrasReceita([]);
          setCartoes([]);
          try {
            let snap = await getDoc(doc(db,"usuarios",u.uid));
            for (let tentativa=0; tentativa<3 && !snap.exists(); tentativa++) {
              await new Promise(r=>setTimeout(r, 600*(tentativa+1)));
              snap = await getDoc(doc(db,"usuarios",u.uid));
            }
            if (snap.exists()) {
              const d = snap.data();

              // TRAVA DE SEGURANÇA: conta já existe (tem outros dados salvos, ex. criadoEm/nome/plano)
              // mas NENHUM campo financeiro reconhecido foi encontrado. Isso indica um schema
              // incompatível/desconhecido — NUNCA prosseguir com estado vazio, pois o autosave
              // sobrescreveria os dados reais do usuário com valores em branco.
              const contaJaExistia = d.onboardingConcluido === true;
              const temCampoFinanceiroReconhecido = d.parcelas !== undefined || d.fixos !== undefined || d.extras !== undefined || d.cartoes !== undefined || d.salario !== undefined || d.extrasReceita !== undefined;
              if (contaJaExistia && !temCampoFinanceiroReconhecido) {
                registrarErro(new Error("Schema não reconhecido no documento do usuário — autosave bloqueado"), { origem: 'trava_seguranca', uid: u.uid, camposEncontrados: Object.keys(d).join(",") });
                setModoSeguranca(true);
                setLoadStatus("loaded");
                return;
              }

              // Backup bruto no momento da leitura: cópia fiel de exatamente o que veio do banco,
              // antes de qualquer processamento/migração local. Existe independente de qualquer
              // bug que venha a acontecer depois nesta sessão.
              setDoc(doc(db,"usuarios",u.uid,"backups",`carregamento_${new Date().toISOString()}`), d).catch(()=>{});

              dadosBrutosCarregados.current = d;

              if (d.parcelas) setParcelas(d.parcelas);
              if (d.fixos) setFixos(d.fixos);
              if (d.extras) {
            // Migra gastos antigos que usam índice para mes+ano real
            const agora = new Date();
            const extrasMigrados = d.extras.map(e => {
              if (e.mesReal !== undefined && e.anoReal !== undefined) return e;
              // Converte índice relativo para mes/ano absoluto
              // Usa data de criação se disponível, senão assume mês atual
              const idxMes = e.mes ?? 0;
              const d2 = new Date(agora.getFullYear(), agora.getMonth() + idxMes, 1);
              return { ...e, mesReal: d2.getMonth(), anoReal: d2.getFullYear() };
            });
            setExtras(extrasMigrados);
          }
              if (d.salario) setSalario(d.salario);
              if (d.extrasReceita) {
            const ag = new Date();
            setExtrasReceita(d.extrasReceita.map(e=>{
              if (e.mesReal!==undefined && e.anoReal!==undefined) return e;
              const off = e.offset ?? e.mes ?? 0;
              const d2 = new Date(ag.getFullYear(), ag.getMonth()+off, 1);
              return { ...e, mesReal:d2.getMonth(), anoReal:d2.getFullYear() };
            }));
          }
              if (d.cartoes) setCartoes(d.cartoes);
          if (d.categorias) setCategorias(d.categorias);
          if (d.saudeConfig) setSaudeConfig(d.saudeConfig);
          if (d.nome) setNomeUsuario(d.nome);
          if (d.sobrenome) setSobrenomeUsuario(d.sobrenome);
          if (d.criadoEm) setCriadoEm(d.criadoEm?.toDate ? d.criadoEm.toDate() : new Date(d.criadoEm));
          setTrialUsadoAnteriormente(d.trialUsadoAnteriormente === true);
          if (d.plano) setPlanoDb(d.plano);
          setNotifLidas(d.notifLidas || {});
          setOnboardingConcluido(d.onboardingConcluido === true);
          identificarUsuario(u.uid, d.plano || 'free');
          setGuiasVistos(d.guiasVistos || {});

          const fb = d.feedback || {};
          const criado = d.criadoEm ? (d.criadoEm?.toDate ? d.criadoEm.toDate() : new Date(d.criadoEm)) : null;
          const diasDeConta = criado ? (Date.now() - criado.getTime()) / 86400000 : 0;
          const dias = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : 999;
          const INTERVALO = 7;
          if (diasDeConta >= 7 && dias(fb.data) >= INTERVALO && dias(fb.adiadoEm) >= INTERVALO) {
            setMostrarFeedback(true);
          }
              if (d.preferencias?.dark !== undefined) {
                setDark(d.preferencias.dark);
                try { document.cookie = `finan_tema=${d.preferencias.dark};max-age=31536000;path=/`; } catch {}
              }
            } else {
              // Documento não existe: conta de auth sem dado no Firestore (cadastro recém-criado
              // ainda propagando, ou documento removido manualmente). Trata como conta nova —
              // nunca assume onboarding concluído nesse caso.
              setOnboardingConcluido(false);
            }
          } catch(firestoreErr) {
            registrarErro(firestoreErr, { origem: 'carregar_dados' });
          }
          try { sessionStorage.removeItem("cadastroRecente"); } catch {}
          setLoadStatus("loaded");
        } else {
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
    if (modoSeguranca) return; // trava: nunca sobrescrever com estado que pode estar incompleto

    // TRAVA DO PRIMEIRO SALVAMENTO: na primeiríssima gravação da sessão, é fisicamente
    // impossível o usuário ter esvaziado categorias inteiras de propósito (não deu tempo).
    // Se isso aconteceria, é sinal de bug de carregamento — bloqueia e entra em modo de segurança
    // em vez de escrever por cima dos dados reais.
    if (primeiroSalvamentoDaSessao.current) {
      primeiroSalvamentoDaSessao.current = false;
      const brutos = dadosBrutosCarregados.current;
      if (brutos) {
        const esvaziou = (campoBruto, novoValor) => Array.isArray(campoBruto) && campoBruto.length > 0 && Array.isArray(novoValor) && novoValor.length === 0;
        const suspeito = esvaziou(brutos.parcelas, parc) || esvaziou(brutos.fixos, fix) || esvaziou(brutos.extras, ext) ||
          esvaziou(brutos.cartoes, carts) || esvaziou(brutos.extrasReceita, extRec) ||
          (Number(brutos.salario) > 0 && Number(sal) === 0);
        if (suspeito) {
          registrarErro(new Error("Primeira gravação da sessão esvaziaria dados existentes — bloqueado"), { origem: 'trava_primeiro_salvamento', uid: auth.currentUser.uid });
          setModoSeguranca(true);
          return;
        }
      }
    }

    setSaveStatus("saving");
    try {
      const payload = {
        parcelas:parc, fixos:fix, extras:ext, salario:sal,
        extrasReceita:extRec, cartoes:carts, categorias:categorias, saudeConfig:saudeConfig,
        ...(prefs !== undefined ? { preferencias:prefs } : {})
      };
      await setDoc(doc(db,"usuarios",auth.currentUser.uid), payload, { merge:true });
      // Backup automático: mantém uma cópia versionada a cada salvamento, independente do plano do Firebase
      setDoc(doc(db,"usuarios",auth.currentUser.uid,"backups",new Date().toISOString()), payload).catch(()=>{});
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
    setTimeout(()=>setSaveStatus("idle"),3000);
  },[modoSeguranca]);

  useEffect(()=>{
    if (loadStatus!=="loaded" || modoSeguranca) return;
    const t = setTimeout(()=>handleSave(parcelas,fixos,extras,salario,extrasReceita,cartoes),800); // categorias e saudeConfig salvos via useEffect separado
    return ()=>clearTimeout(t);
  },[parcelas,fixos,extras,salario,extrasReceita,cartoes,loadStatus,handleSave]);

  const salvarPreferencias = async (prefs) => {
    try { document.cookie = `finan_tema=${prefs.dark};max-age=31536000;path=/`; } catch {}
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db,"usuarios",auth.currentUser.uid),{ preferencias:prefs },{ merge:true });
    } catch(e) { console.error("Erro ao salvar preferências:", e); }
  };

  // Salva categorias e saúde quando mudam
  useEffect(()=>{
    if (loadStatus!=="loaded") return;
    const t = setTimeout(()=>{
      if (!auth.currentUser) return;
      setDoc(doc(db,"usuarios",auth.currentUser.uid),{ categorias, saudeConfig },{ merge:true });
    },800);
    return ()=>clearTimeout(t);
  },[categorias,saudeConfig,loadStatus]);

  const totalFixos = useMemo(()=>fixos.reduce((s,f)=>s+Number(f.valor),0),[fixos]);

  const receitaMes = useCallback((idx)=>{
    const m = MESES[idx];
    if (!m) return salario;
    const ext = extrasReceita.filter(e=>{
      if (e.mesReal!==undefined && e.anoReal!==undefined) return e.mesReal===m.mes && e.anoReal===m.ano;
      const off = e.offset ?? e.mes ?? 0;
      return off === idx;
    }).reduce((s,e)=>s+Number(e.valor||0),0);
    return salario + ext;
  },[salario,extrasReceita]);

  const projecao = useMemo(()=>MESES.map((m,i)=>{
    const totalParc = parcelasComRestante.reduce((s,p)=>s+(i<p.parcelasRestantes?Number(p.valor):0),0);
    // Filtra extras pelo mes+ano real
    const totalExtra = extras.filter(e=>{
      if (e.mesReal!==undefined && e.anoReal!==undefined) {
        return e.mesReal===m.mes && e.anoReal===m.ano;
      }
      return e.mes===i; // fallback dados antigos
    }).reduce((s,e)=>s+Number(e.valor),0);
    const gastos = totalFixos+totalParc+totalExtra;
    const receita = receitaMes(i);
    return { ...m, totalParc, totalExtra, gastos, sobra:receita-gastos, receita };
  }),[parcelasComRestante,fixos,extras,totalFixos,receitaMes]);

  // Indicador de saúde financeira
  const indicadorSaude = useMemo(()=>{
    const receita = receitaMes(0);
    if (!receita) return null;
    const gastos = totalFixos + totalParcelasMesAtual;
    const pct = Math.round((gastos/receita)*100);
    if (pct<=saudeConfig.saudavel) return { label:"Saudável", emoji:"💚", cor:C.green, pct };
    if (pct<=saudeConfig.atencao) return { label:"Atenção", emoji:"🟡", cor:C.yellow, pct };
    return { label:"Crítico", emoji:"🔴", cor:C.red, pct };
  },[totalFixos,totalParcelasMesAtual,saudeConfig,receitaMes,C]);

  const inp = (ov={})=>({ width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, color:C.grayLight, fontSize:"0.82rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box", ...ov });
  const btnPri = { background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, border:"none", borderRadius:8, color:"#fff", padding:"10px 18px", fontSize:"0.82rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" };
  const saveBtnStyle = { display:"inline-flex", alignItems:"center", gap:6, border:"none", borderRadius:8, color:"#fff", padding:"7px 14px", fontSize:"0.78rem", fontWeight:700, cursor:saveStatus==="saving"?"not-allowed":"pointer", fontFamily:"inherit", transition:"all 0.3s", background:saveStatus==="saved"?"#1a4a2e":saveStatus==="error"?"#4a1a1a":`linear-gradient(135deg,#1d6fa4,#2188c9)`, opacity:saveStatus==="saving"?0.75:1 };

  const trialFimCalculado = criadoEm ? new Date(criadoEm.getTime() + 30*24*60*60*1000) : null;
  const trialAtivo = !trialUsadoAnteriormente && trialFimCalculado ? trialFimCalculado > new Date() : false;
  const planoAtivo = (planoDb === "pro" || trialAtivo) ? "pro" : "free";
  const planoAtualObj = planosConfig[planoAtivo];
  const diasTrialRestantes = trialAtivo ? Math.ceil((trialFimCalculado - new Date()) / 86400000) : 0;
  const mesMaxProjecao = (planoAtualObj?.limites?.mesesProjecao ?? 18) - 1;

  const setCartoesComLimite = (atualizador) => {
    setCartoes(atual => {
      const novo = typeof atualizador === "function" ? atualizador(atual) : atualizador;
      if (Array.isArray(novo) && novo.length > atual.length && !podeAdicionar(planoAtualObj, "cartoes", atual.length)) {
        setShowUpgrade("cartoes");
        return atual;
      }
      return novo;
    });
  };

  const alertasAtivos = saudeConfig?.ativos !== false;

  const TelaUpgrade = showUpgrade ? (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setShowUpgrade(null)}>
      <div onClick={e=>e.stopPropagation()} style={{ background: dark ? "#1a1a2e" : "#fff", borderRadius:16, padding:24, maxWidth:340, textAlign:"center" }}>
        <div style={{ fontSize:"1.6rem", marginBottom:8 }}>🔒</div>
        <div style={{ fontSize:"1rem", fontWeight:800, marginBottom:8, color: dark ? "#fff" : "#111" }}>
          {showUpgrade === "simulador" || showUpgrade === "projecao" ? "Recurso exclusivo do plano Pro" : "Limite do plano gratuito atingido"}
        </div>
        <div style={{ fontSize:"0.85rem", color: dark ? "#aaa" : "#555", marginBottom:16, lineHeight:1.5 }}>
          {showUpgrade === "simulador"
            ? "O simulador de amortização está disponível no plano Pro. Assine pra desbloquear."
            : showUpgrade === "projecao"
            ? `O plano gratuito mostra até ${mesMaxProjecao+1} meses de projeção. Assine o Pro para ver até ${MESES.length} meses.`
            : showUpgrade === "extras"
            ? "O plano gratuito permite até 5 gastos por mês. Assine o Pro para lançar sem limites."
            : "Assine o plano Pro para cadastrar sem limites, ou continue no gratuito removendo algum item existente."}
        </div>
        <button onClick={()=>{ setShowUpgrade(null); setAbaConta("plano"); setTelaEspecial("conta"); }} style={{ width:"100%", padding:"12px", borderRadius:10, background:"#6366f1", color:"#fff", border:"none", fontWeight:700, marginBottom:8 }}>Ver planos</button>
        <button onClick={()=>setShowUpgrade(null)} style={{ width:"100%", padding:"10px", borderRadius:10, background:"transparent", color: dark ? "#aaa" : "#555", border:"none" }}>Agora não</button>
      </div>
    </div>
  ) : null;

  const notificacoes = useMemo(()=>gerarNotificacoes({
    projecao, saudeConfig, parcelas: parcelasComRestante, salario, lidas: notifLidas
  }), [projecao, saudeConfig, parcelasComRestante, salario, notifLidas]);

  const naoLidas = notificacoes.filter(n=>!n.lida).length;

  const salvarLidas = async (novas) => {
    setNotifLidas(novas);
    try {
      if (auth.currentUser) await setDoc(doc(db,"usuarios",auth.currentUser.uid), { notifLidas: novas }, { merge:true });
    } catch(e){ console.error(e); }
  };
  const marcarLida = (id) => salvarLidas({ ...notifLidas, [id]: true });
  const marcarTodasLidas = () => {
    const novas = { ...notifLidas };
    notificacoes.forEach(n=>{ novas[n.id] = true; });
    salvarLidas(novas);
  };

  const abrirRaioX = (m, idx) => {
    const parcelasMes = parcelasComRestante
      .filter(p=>idx < p.parcelasRestantes)
      .map(p=>{
        const totalP = Number(p.parcelasOriginal||p.parcelas);
        const atual = totalP - p.parcelasRestantes + idx + 1;
        return { ...p, parcelaLabel:`${atual}/${totalP}` };
      });
    const gastosMes = extras.filter(e=>{
      if (e.mesReal!==undefined && e.anoReal!==undefined) return e.mesReal===m.mes && e.anoReal===m.ano;
      return e.mes===idx;
    });
    registrarEvento('raiox_aberto', { mes_offset: idx });
    setRaioXMes({ mes:m, dados:{ receita:m.receita, fixos, parcelasMes, gastosMes } });
  };

  const finalizarOnboarding = async (cfg) => {
    if (cfg.salario) setSalario(cfg.salario);
    if (cfg.cartoes?.length) setCartoes(cfg.cartoes);
    if (cfg.saudeConfig) setSaudeConfig(cfg.saudeConfig);
    setAba("projecao");
    setOnboardingConcluido(true);
    registrarEvento('onboarding_concluido', { tem_renda: !!cfg.salario, qtd_cartoes: (cfg.cartoes||[]).length, alertas: cfg.saudeConfig?.ativos !== false });
    try {
      if (auth.currentUser) {
        await setDoc(doc(db,"usuarios",auth.currentUser.uid), {
          salario: cfg.salario || 0,
          cartoes: cfg.cartoes || [],
          saudeConfig: cfg.saudeConfig,
          situacao: cfg.situacao || null,
          preferencias: { dark: cfg.dark },
          onboardingConcluido: true,
        }, { merge:true });
      }
    } catch(e) { console.error(e); }
  };

  const marcarGuiaVisto = async (tipo) => {
    const novos = { ...guiasVistos, [tipo]: true };
    setGuiasVistos(novos);
    setGuiaAtivo(null);
    try {
      if (auth.currentUser) {
        await setDoc(doc(db,"usuarios",auth.currentUser.uid), { guiasVistos: novos }, { merge:true });
      }
    } catch(e) { console.error(e); }
  };

  const irParaAba = (k) => {
    if (k === "amortizacao" && !planoAtualObj?.recursos?.simulador) {
      setShowUpgrade("simulador");
      return;
    }
    setShowEditar(false);
    setAba(k);
    registrarTela(k);
    if (onboardingConcluido && !guiasVistos[k]) setGuiaAtivo(k);
  };

  const salvarFixo = ()=>{ if(!editandoFixo?.nome||!editandoFixo?.valor)return; const eh_novo = !fixos.some(f=>f.id===editandoFixo.id); if(eh_novo && !podeAdicionar(planoAtualObj,"fixos",fixos.length)){ setShowUpgrade("fixos"); return; } setFixos(p=>p.map(f=>f.id===editandoFixo.id?{...editandoFixo,valor:parseFloat(editandoFixo.valor)}:f)); setEditandoFixo(null); };
  const salvarExtra = ()=>{ if(!editandoExtra?.nome||!editandoExtra?.valor)return; setExtras(p=>p.map(e=>e.id===editandoExtra.id?{...editandoExtra,valor:parseFloat(editandoExtra.valor)}:e)); setEditandoExtra(null); };
  const salvarParcela = ()=>{ if(!editandoParcela?.nome||!editandoParcela?.valor)return; const eh_novo = !parcelas.some(x=>x.id===editandoParcela.id); if(eh_novo && !podeAdicionar(planoAtualObj,"parcelas",parcelas.length)){ setShowUpgrade("parcelas"); return; } setParcelas(p=>p.map(x=>x.id===editandoParcela.id?{...editandoParcela,valor:parseFloat(editandoParcela.valor),parcelas:parseInt(editandoParcela.parcelas),parcelasOriginal:parseInt(editandoParcela.parcelas)}:x)); setEditandoParcela(null); };

  if (authLoading||loadStatus==="loading") return (
    <div style={{ minHeight:"100vh", background:CORES.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:36, height:36, border:`3px solid ${CORES.border}`, borderTop:`3px solid ${CORES.primary}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <p style={{ color:CORES.gray, fontSize:"0.82rem", fontFamily:"sans-serif" }}>{(()=>{ try { return sessionStorage.getItem("cadastroRecente")==="1" ? "Preparando sua conta..." : "Carregando..."; } catch { return "Carregando..."; } })()}</p>
    </div>
  );

  if (!user) return <Login/>;

  if (modoSeguranca) return (
    <div style={{ minHeight:"100vh", background:CORES.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ maxWidth:380, textAlign:"center" }}>
        <div style={{ fontSize:"2rem", marginBottom:12 }}>🔒</div>
        <h2 style={{ fontSize:"1.05rem", fontWeight:800, color:CORES.grayLight, margin:"0 0 10px" }}>Não conseguimos carregar seus dados com segurança</h2>
        <p style={{ fontSize:"0.85rem", color:CORES.gray, lineHeight:1.6, margin:"0 0 18px" }}>
          Detectamos que sua conta tem um formato de dados que o app não reconheceu. Para proteger suas informações, pausamos qualquer salvamento automático nesta sessão.
        </p>
        <p style={{ fontSize:"0.8rem", color:CORES.gray, lineHeight:1.6, margin:"0 0 18px" }}>
          Seus dados originais continuam intactos no banco. Entre em contato com o suporte (allanvon99@gmail.com) antes de continuar usando o app nesta conta.
        </p>
        <button onClick={()=>signOut(auth)} style={{ padding:"12px 20px", borderRadius:10, border:"none", background:CORES.primary, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Sair</button>
      </div>
    </div>
  );

  if (!onboardingConcluido) return (
    <Onboarding C={C} dark={dark} setDark={setDark} nome={nomeUsuario} onFinalizar={finalizarOnboarding} trialUsadoAnteriormente={trialUsadoAnteriormente}/>
  );
  const mesAtual = projecao[0];

  if (raioXMes) return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <RaioXMes C={C} mes={raioXMes.mes} dados={raioXMes.dados}
        categorias={categorias} cartoes={cartoes}
        onVoltar={()=>setRaioXMes(null)}/>
    </div>
  );

  if (telaEspecial === "notificacoes") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <Notificacoes
        C={C} notificacoes={notificacoes} alertasAtivos={alertasAtivos}
        onVoltar={()=>setTelaEspecial(null)}
        onMarcarLida={marcarLida} onMarcarTodas={marcarTodasLidas}
        onIrCadastros={()=>{ setTelaEspecial(null); setAba("cadastros"); }}
      />
    </div>
  );

  if (telaEspecial === "conta") return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <GerenciarConta
        C={C} onVoltar={()=>setTelaEspecial(null)} abaInicial={abaConta}
        dadosApp={{ parcelas, fixos, extras, salario, extrasReceita, cartoes, categorias, saudeConfig }}
        planoAtivo={planoAtivo} trialAtivo={trialAtivo} diasTrialRestantes={diasTrialRestantes}
      />
    </div>
  );

  return (
    <div onClick={()=>menuPerfil && setMenuPerfil(false)} style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',sans-serif", color:C.grayLight, transition:"background 0.3s" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes drop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#21262d;border-radius:4px}
      `}</style>

      {/* Aviso de email não confirmado — nunca bloqueia, só lembra */}
      {user && !user.emailVerified && !avisoEmailFechado && (
        <div style={{ background:C.orange+"20", borderBottom:`1px solid ${C.orange}55`, padding:"9px 14px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:"0.78rem", color:C.orange, flex:1 }}>
            📧 Confirme seu email pra garantir acesso caso precise recuperar a senha.
          </span>
          <button onClick={()=>{ sendEmailVerification(user).catch(()=>{}); setAvisoEmailFechado(true); }}
            style={{ background:"none", border:`1px solid ${C.orange}`, borderRadius:6, color:C.orange, padding:"4px 8px", fontSize:"0.68rem", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>Reenviar</button>
          <button onClick={()=>setAvisoEmailFechado(true)} style={{ background:"none", border:"none", color:C.orange, cursor:"pointer", fontSize:"0.9rem", padding:"2px" }}>✕</button>
        </div>
      )}

      {/* Modal confirmação remoção */}
      {confirmRemover && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={()=>setConfirmRemover(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:16, padding:24, width:"100%", maxWidth:320, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:"1.5rem", textAlign:"center", marginBottom:12 }}>🗑️</div>
            <h3 style={{ fontSize:"0.95rem", fontWeight:800, color:C.grayLight, margin:"0 0 8px", textAlign:"center" }}>Confirmar remoção</h3>
            <p style={{ fontSize:"0.82rem", color:C.gray, textAlign:"center", margin:"0 0 20px", lineHeight:1.5 }}>
              Deseja remover <strong style={{ color:C.grayLight }}>{confirmRemover.nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setConfirmRemover(null)} style={{ flex:1, padding:"11px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.gray, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>Cancelar</button>
              <button onClick={()=>{
                if (confirmRemover.tipo==="parcela") setParcelas(x=>x.filter(i=>i.id!==confirmRemover.id));
                if (confirmRemover.tipo==="fixo") setFixos(x=>x.filter(i=>i.id!==confirmRemover.id));
                if (confirmRemover.tipo==="extra") setExtras(x=>x.filter(i=>i.id!==confirmRemover.id));
                setConfirmRemover(null);
              }} style={{ flex:1, padding:"11px", borderRadius:10, border:"none", background:C.red, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>Remover</button>
            </div>
          </div>
        </div>
      )}

      {guiaAtivo && (
        <GuiaTela C={C} tipo={guiaAtivo}
          onFechar={()=>setGuiaAtivo(null)}
          onNaoMostrar={()=>marcarGuiaVisto(guiaAtivo)}/>
      )}

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
          <div>
            <img src="/logo512.png" alt="Von Finance" style={{ height:38, display:"block" }}/>
          </div>

          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={()=>setTelaEspecial("notificacoes")}
              style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", position:"relative" }}>
              <SinoIcon size={19} cor={C.gray}/>
              {naoLidas>0 && (
                <span style={{ position:"absolute", top:5, right:5, minWidth:15, height:15, borderRadius:8, background:C.red, color:"#fff", fontSize:"0.58rem", fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px", border:`2px solid ${C.card}` }}>
                  {naoLidas}
                </span>
              )}
            </button>

            <div style={{ position:"relative" }} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setMenuPerfil(v=>!v)}
                style={{ background:"linear-gradient(135deg,#1d6fa4,#2188c9)", border:"none", borderRadius:"50%", width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#fff", fontWeight:800, fontSize:"0.78rem" }}>
                {(nomeUsuario[0]||user.email[0]||"?").toUpperCase()}{(sobrenomeUsuario[0]||"").toUpperCase()}
              </button>

              {menuPerfil && (
                <div style={{ position:"absolute", top:46, right:0, width:250, background:C.card, borderRadius:14, border:`1px solid ${C.border}`, boxShadow:"0 12px 32px rgba(0,0,0,0.35)", overflow:"hidden", animation:"drop 0.16s ease", zIndex:200 }}>
                  <div style={{ padding:"14px 15px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:11, alignItems:"center" }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#1d6fa4,#2188c9)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:"0.85rem", flexShrink:0 }}>
                      {(nomeUsuario[0]||user.email[0]||"?").toUpperCase()}{(sobrenomeUsuario[0]||"").toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:"0.85rem", fontWeight:700, color:C.grayLight }}>
                        {nomeUsuario ? `${nomeUsuario} ${sobrenomeUsuario}`.trim() : "Minha conta"}
                      </div>
                      <div style={{ fontSize:"0.68rem", color:C.gray, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email}</div>
                    </div>
                  </div>

                  <div style={{ padding:6 }}>
                    {[
                      { i:"⚙️", l:"Gerenciar conta", a:()=>{ setAbaConta("dados"); setTelaEspecial("conta"); setMenuPerfil(false); } },
                      { i:"⭐", l:"Ver planos", a:()=>{ registrarEvento("ver_planos", { origem: "menu_perfil" }); setAbaConta("plano"); setTelaEspecial("conta"); setMenuPerfil(false); }, destaque:true },
                      { i:dark?"☀️":"🌙", l:dark?"Tema claro":"Tema escuro", a:()=>{ const novo=!dark; setDark(novo); salvarPreferencias({dark:novo}); } },
                      { i:"📲", l:"Convidar amigos", a:()=>{ window.open(`https://wa.me/?text=${encodeURIComponent("Conheça o Von Finance: https://von-finance-six.vercel.app")}`,"_blank"); setMenuPerfil(false); } },
                    ].map(o=>(
                      <button key={o.l} onClick={o.a}
                        style={{ width:"100%", background:"none", border:"none", padding:"10px 9px", borderRadius:9, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10, textAlign:"left", color: o.destaque ? C.primaryLight : C.grayLight, fontSize:"0.8rem", fontWeight: o.destaque?700:500 }}>
                        <span style={{ fontSize:"0.9rem", width:18 }}>{o.i}</span>{o.l}
                      </button>
                    ))}
                  </div>

                  <div style={{ padding:6, borderTop:`1px solid ${C.border}` }}>
                    <button onClick={()=>{ registrarEvento('logout'); limparUsuario(); signOut(auth); }}
                      style={{ width:"100%", background:"none", border:"none", padding:"10px 9px", borderRadius:9, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10, color:C.red, fontSize:"0.8rem", fontWeight:600 }}>
                      <span style={{ fontSize:"0.9rem", width:18 }}>🚪</span>Sair da conta
                    </button>
                  </div>
                </div>
              )}
            </div>
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
              {mostrarFeedback && <Feedback C={C} onFechar={()=>setMostrarFeedback(false)} />}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:0, color:C.grayLight }}>Projeção</h2>
              </div>
            {/* MENSAL */}
            {true && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {projecao.slice(0, mesMaxProjecao+1).map((m,i)=>{
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
                      <div onClick={()=>abrirRaioX(m,i)} style={{ padding:"16px", cursor:"pointer" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                          <Donut pct={pct} cor={cor} C={C} size={80} stroke={8}/>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                              <span style={{ fontSize:"1rem", fontWeight:800, color:C.grayLight }}>{m.label}</span>
                              <span style={{ color:C.primaryLight, fontSize:"0.68rem", fontWeight:700, whiteSpace:"nowrap" }}>Ver detalhes ›</span>
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
                {mesMaxProjecao < MESES.length-1 && (
                  <div onClick={()=>setShowUpgrade("projecao")} style={{ background:C.card, borderRadius:14, border:`1px dashed ${C.border}`, padding:"16px", textAlign:"center", cursor:"pointer" }}>
                    <div style={{ fontSize:"0.82rem", fontWeight:700, color:C.primaryLight, marginBottom:2 }}>🔒 Veja até {MESES.length} meses de projeção</div>
                    <div style={{ fontSize:"0.72rem", color:C.gray }}>Disponível no plano Pro</div>
                  </div>
                )}
              </div>
            )}

            {/* POR CARTÃO — mês a mês com total, expandindo mostra cada cartão */}
            
          </div>
        )}

        {/* PARCELAS */}
        {!showEditar && aba==="parcelas"&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:0, color:C.grayLight }}>Parcelas</h2>
              <button onClick={()=>{
                if(!showNovaParcela && !podeAdicionar(planoAtualObj,"parcelas",parcelas.length)){ setShowUpgrade("parcelas"); return; }
                setShowNovaParcela(!showNovaParcela);
              }} style={{ ...btnPri, padding:"7px 12px", fontSize:"0.75rem" }}>
                {showNovaParcela?"✕ Fechar":"+ Nova parcela"}
              </button>
            </div>

            {/* Form nova parcela */}
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
                  <input type="number" placeholder="Total de parcelas" value={novaParc.parcelas} onChange={e=>setNovaParc(p=>({...p,parcelas:e.target.value}))} style={inp()}/>
                  <div>
                    <div style={{ fontSize:"0.62rem", color:C.gray, marginBottom:3 }}>📅 Data da 1ª parcela</div>
                    <div style={{ position:"relative", overflow:"hidden", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface }}>
                      <input type="date" value={novaParc.dataInicio||""}
                        onChange={e=>setNovaParc(p=>({...p,dataInicio:e.target.value}))}
                        style={{ width:"100%", padding:"9px 12px", background:"transparent", border:"none", color:novaParc.dataInicio?C.grayLight:C.gray, fontSize:"0.82rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                      />
                    </div>
                  </div>
                  <select value={novaParc.categoria||""} onChange={e=>setNovaParc(p=>({...p,categoria:e.target.value}))} style={inp()}>
                    <option value="">Categoria (opcional)</option>
                    {categorias.map(cat=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.nome}</option>)}
                  </select>
                  <div style={{ fontSize:"0.65rem", color:C.gray, padding:"6px 8px", background:C.surface, borderRadius:6 }}>
                    📅 A data de início define quando a primeira parcela foi cobrada
                  </div>
                  <button onClick={()=>{
                    if(!novaParc.nome||!novaParc.valor||!novaParc.parcelas||!novaParc.grupo)return;
                    const dataInicio = novaParc.dataInicio ? new Date(novaParc.dataInicio).toISOString() : new Date().toISOString();
                    if(!podeAdicionar(planoAtualObj,"parcelas",parcelas.length)){ setShowUpgrade("parcelas"); return; }
                    setParcelas(p=>[...p,{
                      ...novaParc,
                      id:Date.now(),
                      valor:parseFloat(novaParc.valor),
                      parcelas:parseInt(novaParc.parcelas),
                      parcelasOriginal:parseInt(novaParc.parcelas),
                      dataCadastro: dataInicio,
                    }]);
                    setNovaParc(prev=>({grupo:prev.grupo,nome:"",valor:"",parcelas:"",dataInicio:""}));
                    setShowNovaParcela(false);
                  }} style={btnPri}>Adicionar</button>
                </div>
              </div>
            )}

            {/* Seletor de mês */}
            {parcelasComRestante.length>0&&(
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, background:C.card, borderRadius:12, padding:"10px 12px", border:`1px solid ${C.border}` }}>
                <button onClick={()=>setMesParcelas(m=>m-1)} disabled={mesParcelas<=mesMinParcelas}
                  style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesParcelas<=mesMinParcelas?C.border:C.gray, width:32, height:32, cursor:mesParcelas<=mesMinParcelas?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>‹</button>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:"0.88rem", fontWeight:800, color:C.grayLight }}>
                    {(()=>{
                      const agora = getNow();
                      const d = new Date(agora.getFullYear(), agora.getMonth()+mesParcelas, 1);
                      return d.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
                    })()}
                    {mesParcelas < 0 && <span style={{ fontSize:"0.6rem", color:C.orange, marginLeft:6 }}>passado</span>}
                  </div>
                  <div style={{ fontSize:"0.62rem", color:C.gray }}>{parcelasNoMesSel.length} parcela(s) ativas</div>
                </div>
                <button onClick={()=>setMesParcelas(m=>Math.min(mesMaxProjecao,m+1))} disabled={mesParcelas>=mesMaxProjecao}
                  style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:mesParcelas>=mesMaxProjecao?C.border:C.gray, width:32, height:32, cursor:mesParcelas>=mesMaxProjecao?"not-allowed":"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>›</button>
              </div>
            )}

            {/* Total do mês selecionado */}
            {parcelasNoMesSel.length>0&&(
              <div style={{ background:C.card, borderRadius:10, padding:"12px 14px", marginBottom:14, display:"flex", justifyContent:"space-between", border:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:"0.82rem", fontWeight:700, color:C.grayLight }}>
                    {mesParcelas<0?"Total pago neste mês":"Total restante neste mês"}
                  </div>
                  <div style={{ fontSize:"0.62rem", color:C.gray, marginTop:2 }}>
                    {parcelasNoMesSel.length} parcela(s) · {mesParcelas===0?"mês atual":mesParcelas<0?"histórico":"projeção"}
                  </div>
                </div>
                <span style={{ color:C.primary, fontWeight:800, fontSize:"0.9rem", alignSelf:"center" }}>{fmt(totalParcelasNoMesSel)}</span>
              </div>
            )}

            {parcelasNoMesSel.length===0?(
              <div style={{ textAlign:"center", color:C.gray, padding:"50px 0" }}>
                <p style={{ fontSize:"2rem", margin:"0 0 8px" }}>🧾</p>
                <p style={{ fontSize:"0.85rem" }}>
                  {parcelasComRestante.length===0?"Nenhuma parcela cadastrada":`Nenhuma parcela ativa em ${MESES[mesParcelas]?.label}`}
                </p>
              </div>
            ):[...new Set(parcelasNoMesSel.map(p=>p.grupo))].map(grupo=>{
              const parcsGrupo = parcelasNoMesSel.filter(p=>p.grupo===grupo);
              if(parcsGrupo.length===0)return null;
              const aberto = expandidosCart[grupo]!==false;
              const totalGrupo = parcsGrupo.reduce((s,p)=>s+Number(p.valor)*p.restantesNoMes,0);
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
                      <div style={{ fontSize:"0.6rem", color:C.gray }}>restante</div>
                    </div>
                    <span style={{ color:C.gray, fontSize:"0.72rem" }}>{aberto?"▲":"▼"}</span>
                  </div>
                  {aberto&&(
                    <div style={{ padding:"0 12px 12px" }}>
                      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, display:"flex", flexDirection:"column", gap:6 }}>
                        {parcsGrupo.map(p=>{
                          const expandido = expandidosParcela[p.id];
                          return (
                            <div key={p.id} style={{ background:C.surface, borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                              {editandoParcela?.id===p.id?(
                                <div style={{ padding:"12px" }}>
                                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                                    <input value={editandoParcela.nome} onChange={e=>setEditandoParcela(x=>({...x,nome:e.target.value}))} style={inp()}/>
                                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                                      <input type="number" placeholder="Valor" value={editandoParcela.valor} onChange={e=>setEditandoParcela(x=>({...x,valor:e.target.value}))} style={inp()}/>
                                      <input type="number" placeholder="Total parcelas" value={editandoParcela.parcelas} onChange={e=>setEditandoParcela(x=>({...x,parcelas:e.target.value}))} style={inp()}/>
                                    </div>
                                    <div style={{ position:"relative", overflow:"hidden", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface }}>
                                      <input type="date" value={editandoParcela.dataInicio?.split("T")[0]||""}
                                        onChange={e=>setEditandoParcela(x=>({...x,dataInicio:e.target.value}))}
                                        style={{ width:"100%", padding:"9px 12px", background:"transparent", border:"none", color:editandoParcela.dataInicio?C.grayLight:C.gray, fontSize:"0.82rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                                      />
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
                                      <span style={{ background:C.primary+"22", color:C.primary, borderRadius:20, padding:"1px 8px", fontSize:"0.62rem", fontWeight:700 }}>{p.parcelaAtualNoMes}/{Number(p.parcelasOriginal||p.parcelas)}</span>
                                    </div>
                                    <div style={{ textAlign:"right", flexShrink:0 }}>
                                      <div style={{ fontSize:"0.95rem", fontWeight:800, color:C.primary }}>{fmt(p.valor)}</div>
                                      <div style={{ fontSize:"0.6rem", color:C.gray }}>por mês</div>
                                    </div>
                                    <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:10 }}>
                                      <button onClick={e=>{e.stopPropagation();setEditandoParcela({...p,parcelas:p.parcelasRestantes});}} style={{ background:"none",border:"none",color:C.gray,cursor:"pointer",fontSize:"0.85rem",padding:"4px" }}>✏️</button>
                                      <button onClick={e=>{e.stopPropagation();setConfirmRemover({tipo:"parcela",id:p.id,nome:p.nome});}} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:"1rem",padding:"4px" }}>✕</button>
                                      <span style={{ color:C.gray, fontSize:"0.7rem" }}>{expandido?"▲":"▼"}</span>
                                    </div>
                                  </div>
                                  {expandido&&(
                                    <div style={{ padding:"0 12px 10px" }}>
                                      <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                                        {[
                                          { l:"Valor/mês", v:fmt(p.valor), c:C.primary },
                                          { l:`Restam em ${MESES[mesParcelas]?.label.split("/")[0]}`, v:`${p.restantesNoMes}x`, c:C.grayLight },
                                          { l:"Total restante", v:fmt(Number(p.valor)*p.restantesNoMes), c:C.orange },
                                        ].map(({l,v,c})=>(
                                          <div key={l} style={{ background:C.card, borderRadius:8, padding:"7px 10px", border:`1px solid ${C.border}` }}>
                                            <div style={{ fontSize:"0.58rem", color:C.gray, marginBottom:2 }}>{l}</div>
                                            <div style={{ fontSize:"0.8rem", fontWeight:700, color:c }}>{v}</div>
                                          </div>
                                        ))}
                                      </div>
                                      {p.dataInicio&&(
                                        <div style={{ marginTop:6, fontSize:"0.65rem", color:C.gray, textAlign:"center" }}>
                                          📅 Início: {new Date(p.dataInicio).toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
                                        </div>
                                      )}
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

        {/* CADASTROS */}
        {!showEditar && aba==="cadastros"&&(
          <Cadastros
            cartoes={cartoes} setCartoes={setCartoesComLimite}
            categorias={categorias} setCategorias={setCategorias}
            saudeConfig={saudeConfig} setSaudeConfig={setSaudeConfig}
            dark={dark}
            planoAtivo={planoAtualObj} podeAdicionar={podeAdicionar} setShowUpgrade={setShowUpgrade}
          />
        )}

        {/* FIXOS */}
        {!showEditar && aba==="fixos"&&(
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:0, color:C.grayLight }}>Gastos Fixos</h2>
              <button onClick={()=>{
                if(!showNovoFixo && !podeAdicionar(planoAtualObj,"fixos",fixos.length)){ setShowUpgrade("fixos"); return; }
                setShowNovoFixo(!showNovoFixo);
              }} style={{ ...btnPri, padding:"7px 12px", fontSize:"0.75rem" }}>
                {showNovoFixo?"✕ Fechar":"+ Adicionar"}
              </button>
            </div>
            {showNovoFixo && (
            <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.primary}55`, marginBottom:12, animation:"fadeIn 0.2s ease" }}>
              <div style={{ fontSize:"0.68rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>Novo gasto fixo</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <input placeholder="Descrição" value={novoFixo.nome} onChange={e=>setNovoFixo(f=>({...f,nome:e.target.value}))} style={inp()}/>
                  <input type="number" placeholder="Valor (R$)" value={novoFixo.valor} onChange={e=>setNovoFixo(f=>({...f,valor:e.target.value}))} style={inp()}/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <select value={novoFixo.cartao||""} onChange={e=>setNovoFixo(f=>({...f,cartao:e.target.value}))} style={inp()}>
                    <option value="">Sem cartão (opcional)</option>
                    {cartoes.map(c=><option key={c.nome} value={c.nome}>{c.nome}</option>)}
                  </select>
                  <select value={novoFixo.categoria||""} onChange={e=>setNovoFixo(f=>({...f,categoria:e.target.value}))} style={inp()}>
                    <option value="">Categoria</option>
                    {categorias.map(cat=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.nome}</option>)}
                  </select>
                </div>
                <button onClick={()=>{ if(!novoFixo.nome||!novoFixo.valor)return; if(!podeAdicionar(planoAtualObj,"fixos",fixos.length)){ setShowUpgrade("fixos"); return; } setFixos(f=>[...f,{...novoFixo,id:Date.now(),valor:parseFloat(novoFixo.valor)}]); setNovoFixo({nome:"",valor:"",cartao:"",categoria:""}); setShowNovoFixo(false); }} style={btnPri}>Adicionar</button>
              </div>
            </div>
            )}
            {fixos.length===0 ? (
              <div style={{ textAlign:"center", color:C.gray, padding:"50px 0" }}>
                <p style={{ fontSize:"2rem", margin:"0 0 8px" }}>📌</p>
                <p style={{ fontSize:"0.85rem" }}>Nenhum gasto fixo cadastrado</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {(()=>{
                  const grupos = {};
                  fixos.forEach(f=>{
                    const k = f.cartao || "__sem__";
                    if(!grupos[k]) grupos[k]=[];
                    grupos[k].push(f);
                  });
                  const ordem = [...cartoes.map(x=>x.nome).filter(n=>grupos[n]), ...(grupos["__sem__"]?["__sem__"]:[])];
                  return ordem.map(k=>{
                    const itens = grupos[k]||[];
                    const totalG = itens.reduce((s,f)=>s+Number(f.valor),0);
                    const aberto = expandidosCart["fixo_"+k]!==false;
                    const nomeG = k==="__sem__" ? "Sem cartão" : k;
                    return (
                      <div key={k} style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                        <div onClick={()=>setExpandidosCart(p=>({...p,["fixo_"+k]:p["fixo_"+k]===false}))}
                          style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                          {k!=="__sem__"
                            ? <CartaoLogo grupo={k} cartoes={cartoes} size={32}/>
                            : <div style={{ width:32, height:32, borderRadius:8, background:C.surface, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>📌</div>}
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:"0.85rem", fontWeight:700, color:C.grayLight }}>{nomeG}</div>
                            <div style={{ fontSize:"0.62rem", color:C.gray }}>{itens.length} gasto(s) fixo(s)</div>
                          </div>
                          <div style={{ fontSize:"0.88rem", fontWeight:800, color:C.orange, marginRight:8 }}>{fmt(totalG)}</div>
                          <span style={{ color:C.gray, fontSize:"0.72rem" }}>{aberto?"▲":"▼"}</span>
                        </div>
                        {aberto && (
                          <div style={{ padding:"0 12px 12px" }}>
                            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, display:"flex", flexDirection:"column", gap:5 }}>
                              {itens.map(f=>(
                                <div key={f.id} style={{ background:C.surface, borderRadius:9, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                                  {editandoFixo?.id===f.id?(
                                    <div style={{ padding:"11px" }}>
                                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                                          <input value={editandoFixo.nome} onChange={e=>setEditandoFixo(x=>({...x,nome:e.target.value}))} style={inp()}/>
                                          <input type="number" value={editandoFixo.valor} onChange={e=>setEditandoFixo(x=>({...x,valor:e.target.value}))} style={inp()}/>
                                        </div>
                                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                                          <select value={editandoFixo.cartao||""} onChange={e=>setEditandoFixo(x=>({...x,cartao:e.target.value}))} style={inp()}>
                                            <option value="">Sem cartão</option>
                                            {cartoes.map(x=><option key={x.nome} value={x.nome}>{x.nome}</option>)}
                                          </select>
                                          <select value={editandoFixo.categoria||""} onChange={e=>setEditandoFixo(x=>({...x,categoria:e.target.value}))} style={inp()}>
                                            <option value="">Categoria</option>
                                            {categorias.map(cat=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.nome}</option>)}
                                          </select>
                                        </div>
                                        <div style={{ display:"flex", gap:8 }}>
                                          <button onClick={salvarFixo} style={{ flex:2,...btnPri,padding:"9px" }}>✓ Salvar</button>
                                          <button onClick={()=>setEditandoFixo(null)} style={{ flex:1,padding:"9px",borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",color:C.gray,cursor:"pointer",fontFamily:"inherit" }}>Cancelar</button>
                                        </div>
                                      </div>
                                    </div>
                                  ):(
                                    <div style={{ padding:"10px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                      <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:"0.82rem", fontWeight:500, color:C.grayLight }}>{f.nome}</div>
                                        {f.categoria&&(()=>{ const cat=categorias.find(x=>x.id===f.categoria); return cat?<span style={{ fontSize:"0.6rem", color:cat.cor, background:cat.cor+"22", borderRadius:20, padding:"1px 6px", marginTop:3, display:"inline-block" }}>{cat.emoji} {cat.nome}</span>:null; })()}
                                      </div>
                                      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                                        <span style={{ fontSize:"0.85rem", color:C.orange, fontWeight:700 }}>{fmt(f.valor)}</span>
                                        <button onClick={()=>setEditandoFixo({...f})} style={{ background:"none",border:"none",color:C.gray,cursor:"pointer",fontSize:"0.85rem",padding:"4px" }}>✏️</button>
                                        <button onClick={()=>setConfirmRemover({tipo:"fixo",id:f.id,nome:f.nome})} style={{ background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:"1rem",padding:"4px" }}>✕</button>
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
                  });
                })()}
                <div style={{ background:C.surface, borderRadius:10, padding:"11px 14px", display:"flex", justifyContent:"space-between", border:`1px solid ${C.border}`, marginTop:4 }}>
                  <span style={{ fontSize:"0.84rem", fontWeight:700, color:C.grayLight }}>Total/mês</span>
                  <span style={{ fontSize:"0.88rem", color:C.orange, fontWeight:800 }}>{fmt(totalFixos)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GASTOS DO MÊS */}
        {!showEditar && aba==="gastos"&&(
          <GastosDoMes
            extras={extras} setExtras={setExtras}
            cartoes={cartoes} categorias={categorias} MESES={MESES}
            editandoExtra={editandoExtra} setEditandoExtra={setEditandoExtra}
            salvarExtra={salvarExtra} C={C} inp={inp} btnPri={btnPri}
            CartaoLogo={CartaoLogo}
            planoAtualObj={planoAtualObj} podeAdicionar={podeAdicionar}
            onLimiteAtingido={()=>setShowUpgrade("extras")}
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
                      registrarEvento("simulacao_amortizacao", { tipo: o.tipo, valor: parseFloat(amorValor)||0 });
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

                {amorResultado.semAcao ? (
                  <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.orange}44`, padding:20, textAlign:"center" }}>
                    <div style={{ fontSize:"2rem", marginBottom:12 }}>🤔</div>
                    <div style={{ fontSize:"0.95rem", fontWeight:800, color:C.grayLight, marginBottom:8 }}>Valor insuficiente</div>
                    <div style={{ fontSize:"0.8rem", color:C.gray, lineHeight:1.6 }}>
                      Com {fmt(amorResultado.valorDisponivel)} não dá para abater nenhuma parcela inteira.
                      A menor parcela que você tem é de <strong style={{color:C.grayLight}}>{fmt(amorResultado.menorParcela)}</strong>.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Resumo */}
                    <div style={{ background:C.card, borderRadius:16, border:`1px solid ${amorResultado.tipo==="prazo"?C.green:C.primary}44`, overflow:"hidden", marginBottom:12 }}>
                      <div style={{ height:4, background:`linear-gradient(90deg,${amorResultado.tipo==="prazo"?C.green:C.primary},${amorResultado.tipo==="prazo"?C.green:C.primary}44)` }}/>
                      <div style={{ padding:16 }}>
                        <div style={{ fontSize:"0.88rem", fontWeight:800, color:amorResultado.tipo==="prazo"?C.green:C.primary, marginBottom:3 }}>
                          {amorResultado.tipo==="prazo" ? "⏱️ Plano para terminar antes" : "💸 Plano para sobrar mais por mês"}
                        </div>
                        <div style={{ fontSize:"0.68rem", color:C.gray, marginBottom:14 }}>
                          Abatendo {amorResultado.totalParcelasAbatidas} parcela(s) em {amorResultado.acoes.length} dívida(s)
                        </div>

                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                          {[
                            { l:"Você tem", v:fmt(amorResultado.valorDisponivel), c:C.grayLight },
                            { l:"Vai usar", v:fmt(amorResultado.totalUsado), c:C.primary, d:true },
                            { l:"Parcelas abatidas", v:`${amorResultado.totalParcelasAbatidas}x`, c:amorResultado.tipo==="prazo"?C.green:C.grayLight, d:amorResultado.tipo==="prazo" },
                            amorResultado.tipo==="mensal"
                              ? { l:"Libera por mês", v:fmt(amorResultado.liberaPorMes), c:C.green, d:true }
                              : { l:"Meses a menos", v:`${amorResultado.mesesEconomizados}`, c:C.green, d:true },
                          ].map(x=>(
                            <div key={x.l} style={{ background:C.surface, borderRadius:9, padding:"9px 11px", border:`1px solid ${x.d?(amorResultado.tipo==="prazo"?C.green:C.primary)+"44":C.border}` }}>
                              <div style={{ fontSize:"0.6rem", color:C.gray, marginBottom:2 }}>{x.l}</div>
                              <div style={{ fontSize:"0.88rem", fontWeight:800, color:x.c }}>{x.v}</div>
                            </div>
                          ))}
                        </div>

                        {amorResultado.sobra > 0 && (
                          <div style={{ marginTop:10, background:`${C.yellow}12`, border:`1px solid ${C.yellow}33`, borderRadius:9, padding:"9px 11px", fontSize:"0.74rem", color:C.gray, lineHeight:1.5 }}>
                            💰 Sobram <strong style={{color:C.yellow}}>{fmt(amorResultado.sobra)}</strong> do valor informado — não dá para abater mais nenhuma parcela inteira.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Plano de ação */}
                    <div style={{ fontSize:"0.66rem", color:C.gray, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:9 }}>O que fazer</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                      {amorResultado.acoes.map((a,idx)=>(
                        <div key={a.id} style={{ background:C.card, borderRadius:13, border:`1px solid ${a.quitouTudo?C.green+"44":C.border}`, padding:"13px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9 }}>
                            <div style={{ width:22, height:22, borderRadius:"50%", background:C.surface, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.62rem", fontWeight:800, color:C.gray, flexShrink:0 }}>{idx+1}</div>
                            <CartaoLogo grupo={a.grupo} cartoes={cartoes} size={26}/>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:"0.84rem", fontWeight:700, color:C.grayLight }}>{a.nome}</div>
                              <div style={{ fontSize:"0.63rem", color:C.gray }}>{a.grupo} · {fmt(a.valorParcela)}/mês</div>
                            </div>
                            {a.quitouTudo && <span style={{ fontSize:"0.6rem", fontWeight:800, color:C.green, background:`${C.green}1a`, borderRadius:20, padding:"3px 8px", flexShrink:0 }}>QUITA</span>}
                          </div>

                          <div style={{ background:C.surface, borderRadius:9, padding:"10px 12px", fontSize:"0.78rem", color:C.grayLight, lineHeight:1.6 }}>
                            {a.quitouTudo ? (
                              <>Pague <strong style={{color:C.primary}}>{fmt(a.gasto)}</strong> e quite as <strong>{a.abatidas} parcelas</strong> restantes. Essa dívida acaba agora e libera <strong style={{color:C.green}}>{fmt(a.valorParcela)}</strong> todo mês.</>
                            ) : (
                              <>Pague <strong style={{color:C.primary}}>{fmt(a.gasto)}</strong> e adiante <strong>{a.abatidas} de {a.restantes} parcelas</strong>. Ainda restarão <strong style={{color:C.orange}}>{a.sobramDepois} parcelas</strong> de {fmt(a.valorParcela)}.</>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Antes e depois */}
                    <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:16, marginBottom:14 }}>
                      <div style={{ fontSize:"0.66rem", color:C.gray, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:12 }}>Antes e depois</div>
                      {[
                        { l:"Dívida total", a:fmt(amorResultado.dividaAntes), d:fmt(amorResultado.dividaDepois) },
                        { l:"Último pagamento em", a:`${amorResultado.maiorPrazoAntes} meses`, d:`${amorResultado.maiorPrazoDepois} meses` },
                      ].map((r,i,arr)=>(
                        <div key={r.l} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom: i<arr.length-1?`1px solid ${C.border}`:"none" }}>
                          <span style={{ fontSize:"0.76rem", color:C.gray, flex:1 }}>{r.l}</span>
                          <span style={{ fontSize:"0.78rem", color:C.gray, textDecoration:"line-through", opacity:0.7 }}>{r.a}</span>
                          <span style={{ color:C.gray, fontSize:"0.7rem" }}>→</span>
                          <span style={{ fontSize:"0.82rem", fontWeight:800, color:C.green }}>{r.d}</span>
                        </div>
                      ))}
                    </div>

                    {/* Dica */}
                    <div style={{ background:C.surface, borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}`, borderLeft:`3px solid ${amorResultado.tipo==="prazo"?C.green:C.primary}` }}>
                      <div style={{ fontSize:"0.65rem", color:C.gray, marginBottom:4 }}>💡 Por que essa ordem?</div>
                      <p style={{ fontSize:"0.77rem", color:C.grayLight, margin:0, lineHeight:1.55 }}>
                        {amorResultado.tipo==="prazo"
                          ? "Priorizamos as dívidas que ainda vão durar mais tempo, para encurtar o prazo até você ficar livre de tudo."
                          : "Priorizamos as parcelas de maior valor mensal, porque cada uma quitada devolve mais dinheiro ao seu orçamento todo mês."}
                      </p>
                    </div>
                  </>
                )}

                <button onClick={()=>{setAmorStep("menu");setAmorValor("");setAmorResultado(null);}} style={{ width:"100%", marginTop:12, padding:"12px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.gray, cursor:"pointer", fontFamily:"inherit", fontSize:"0.82rem" }}>
                  Fazer outra simulação
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BARRA FLUTUANTE */}
      <div style={{ position:"fixed", bottom:16+vvOffset, left:"50%", transform:"translateX(-50%)", willChange:"transform", background:dark?"rgba(22,27,34,0.95)":"rgba(255,255,255,0.95)", backdropFilter:"blur(20px)", borderRadius:28, border:`1px solid ${C.border}`, boxShadow:"0 8px 32px rgba(0,0,0,0.2)", display:"flex", zIndex:200, padding:"6px 6px", gap:1, width:"calc(100% - 32px)", maxWidth:560 }}>
        {[
          { k:"projecao", icon:"📊", label:"Projeção" },
          { k:"parcelas", icon:"🧾", label:"Parcelas" },
          { k:"cadastros", icon:"⚙️", label:"Cadastros" },
          { k:"fixos", icon:"📌", label:"Fixos" },
          { k:"gastos", icon:"🗓️", label:"Gastos" },
          { k:"receita", icon:"💰", label:"Receita" },
          { k:"amortizacao", icon:"💸", label:"Simular" },
        ].map(({k,icon,label})=>(
          <button key={k} onClick={()=>irParaAba(k)} style={{ flex:1, padding:"8px 2px 6px", border:"none", cursor:"pointer", fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", gap:2, borderRadius:20, background:aba===k&&!showEditar?C.primary+"22":"transparent", color:aba===k&&!showEditar?C.primaryLight:C.gray, transition:"all 0.2s" }}>
            <span style={{ fontSize:"1rem" }}>{icon}</span>
            <span style={{ fontSize:"0.52rem", fontWeight:aba===k&&!showEditar?700:400 }}>{label}</span>
          </button>
        ))}
      </div>

      {TelaUpgrade}
    </div>
  );
}
