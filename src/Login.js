import { useState } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { POLITICA_PRIVACIDADE, TERMOS_USO, VERSAO_DOCS } from "./legal";

const DARK = {
  bg:"#0d1117", card:"#161b22", border:"#21262d", surface:"#1c2128",
  text:"#c9d1d9", textSub:"#8b949e", primary:"#2188c9", primaryLight:"#58a6ff",
  green:"#3fb950", red:"#f85149",
};
const LIGHT = {
  bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", surface:"#f6f8fa",
  text:"#1f2328", textSub:"#57606a", primary:"#0969da", primaryLight:"#0969da",
  green:"#1a7f37", red:"#d1242f",
};

const inp = (C, ov={}) => ({
  width:"100%", padding:"11px 13px", borderRadius:9,
  border:`1px solid ${C.border}`, background:C.surface, color:C.text,
  fontSize:"0.87rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box", ...ov
});

const btnPri = (ov={}) => ({
  width:"100%", padding:"12px", borderRadius:11, border:"none",
  background:"linear-gradient(135deg,#1d6fa4,#2188c9)", color:"#fff",
  fontWeight:700, fontSize:"0.9rem", cursor:"pointer", fontFamily:"inherit", ...ov
});

export default function Login() {
  const [dark] = useState(() => {
    try {
      const match = document.cookie.match(/finan_tema=([^;]+)/);
      return match ? match[1] === "true" : true;
    } catch { return true; }
  });
  const C = dark ? DARK : LIGHT;

  const [modo, setModo] = useState("cadastro");
  const [aceito, setAceito] = useState(false);
  const [form, setForm] = useState({ nome:"", sobrenome:"", email:"", senha:"", confirmar:"" });
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);
  const [docLegal, setDocLegal] = useState(null);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const senhasOk = !form.confirmar || form.senha === form.confirmar;
  const podeCadastrar = aceito && form.nome.trim() && form.sobrenome.trim() && form.email && form.senha && form.senha===form.confirmar;

  const handle = async () => {
    setErro(""); setAviso("");
    if (modo === "cadastro" && !podeCadastrar) return;
    setLoading(true);
    try {
      if (modo === "login") {
        await signInWithEmailAndPassword(auth, form.email, form.senha);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.senha);
        const agora = new Date();
        const trialFim = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
        await setDoc(doc(db, "usuarios", cred.user.uid), {
          nome: form.nome.trim(),
          sobrenome: form.sobrenome.trim(),
          criadoEm: agora.toISOString(),
          trialFim: trialFim.toISOString(),
          onboardingConcluido: false,
          plano: "free",
          termosAceitos: { versao: VERSAO_DOCS, aceitoEm: agora.toISOString() },
        }, { merge: true });
      }
    } catch (e) {
      setErro(e.code === "auth/invalid-credential" ? "Email ou senha incorretos" :
              e.code === "auth/email-already-in-use" ? "Email já cadastrado" :
              e.code === "auth/weak-password" ? "Senha fraca (mín. 6 caracteres)" : e.message);
    }
    setLoading(false);
  };

  const handleEsqueciSenha = async () => {
    setErro(""); setAviso("");
    if (!form.email) { setErro("Digite seu email primeiro"); return; }
    try {
      await sendPasswordResetEmail(auth, form.email);
      setAviso("Enviamos um link de redefinição para seu email");
    } catch (e) {
      setErro(e.code === "auth/user-not-found" ? "Não encontramos essa conta" : e.message);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, padding:"20px 20px 18px", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`html,body{background:${C.bg};margin:0;padding:0;}`}</style>
      {docLegal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setDocLegal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:16, padding:"20px 20px 24px", width:"100%", maxWidth:460, maxHeight:"78vh", overflowY:"auto", border:`1px solid ${C.border}` }}>
            <h3 style={{ fontSize:"1rem", fontWeight:800, color:C.text, margin:"0 0 14px" }}>
              {docLegal==="termos" ? "Termos de Uso" : "Política de Privacidade"}
            </h3>
            <div style={{ fontSize:"0.8rem", color:C.textSub, lineHeight:1.65 }}>
              {(docLegal==="termos" ? TERMOS_USO : POLITICA_PRIVACIDADE).map((s,i)=>(
                <div key={i} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:"0.84rem", fontWeight:700, color:C.text, marginBottom:6 }}>{i+1}. {s.t}</div>
                  {s.p.map((par,j)=>(<p key={j} style={{ margin:"0 0 7px", lineHeight:1.6 }}>{par}</p>))}
                </div>
              ))}
            </div>
            <button onClick={()=>setDocLegal(null)} style={btnPri({ marginTop:16 })}>Fechar</button>
          </div>
        </div>
      )}

      <div style={{ maxWidth:400, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", marginBottom:14 }}>
          <img src="/logo512.png" alt="Von Finance" style={{ height:36, display:"block" }}/>
        </div>

        {modo==="cadastro" && (
          <>
            <h1 style={{ fontSize:"1.3rem", fontWeight:800, color:C.text, margin:"0 0 6px", lineHeight:1.25 }}>
              Tenha o controle real do seu dinheiro
            </h1>
            <p style={{ color:C.textSub, fontSize:"0.78rem", margin:"0 0 12px", lineHeight:1.4 }}>
              Veja quanto sobra de verdade nos próximos meses, considerando todos os seus gastos.
            </p>

            <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
              {[
                { i:"📊", t:"Projeção mês a mês" },
                { i:"🧾", t:"Todas as parcelas organizadas" },
                { i:"💸", t:"Simulador de amortização" },
              ].map(b=>(
                <div key={b.t} style={{ display:"flex", alignItems:"center", gap:8, fontSize:"0.76rem", color:C.textSub }}>
                  <span style={{ fontSize:"0.9rem" }}>{b.i}</span>
                  <span>{b.t}</span>
                  <span style={{ marginLeft:"auto", color:C.green, fontSize:"0.76rem" }}>✓</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {modo==="cadastro" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <input placeholder="Nome" value={form.nome} onChange={e=>set("nome",e.target.value)} style={inp(C)}/>
                <input placeholder="Sobrenome" value={form.sobrenome} onChange={e=>set("sobrenome",e.target.value)} style={inp(C)}/>
              </div>
            )}

            <input placeholder="seu@email.com" type="email" value={form.email} onChange={e=>set("email",e.target.value)} style={inp(C)}/>
            <input placeholder={modo==="cadastro"?"Crie uma senha":"Senha"} type="password" value={form.senha}
              onChange={e=>set("senha",e.target.value)} onKeyDown={e=>e.key==="Enter"&&modo==="login"&&handle()} style={inp(C)}/>

            {modo==="cadastro" && (
              <>
                <input placeholder="Confirmar senha" type="password" value={form.confirmar} onChange={e=>set("confirmar",e.target.value)}
                  style={inp(C, senhasOk ? {} : { border:`1px solid ${C.red}` })}/>
                {!senhasOk && <span style={{ fontSize:"0.7rem", color:C.red }}>As senhas não coincidem</span>}
              </>
            )}

            {modo==="login" && (
              <button onClick={handleEsqueciSenha} style={{ background:"none", border:"none", color:C.primaryLight, fontSize:"0.75rem", cursor:"pointer", textAlign:"right", fontFamily:"inherit", padding:0 }}>
                Esqueci minha senha
              </button>
            )}

            {modo==="cadastro" && (
              <label style={{ display:"flex", alignItems:"flex-start", gap:8, cursor:"pointer", padding:"2px 0" }}>
                <input type="checkbox" checked={aceito} onChange={e=>setAceito(e.target.checked)}
                  style={{ marginTop:2, accentColor:C.primary, width:15, height:15, flexShrink:0 }}/>
                <span style={{ fontSize:"0.7rem", color:C.textSub, lineHeight:1.5 }}>
                  Aceito os{" "}
                  <span onClick={(e)=>{ e.preventDefault(); setDocLegal("termos"); }} style={{ color:C.primaryLight, textDecoration:"underline", cursor:"pointer" }}>Termos de Uso</span>
                  {" "}e a{" "}
                  <span onClick={(e)=>{ e.preventDefault(); setDocLegal("privacidade"); }} style={{ color:C.primaryLight, textDecoration:"underline", cursor:"pointer" }}>Política de Privacidade</span>
                </span>
              </label>
            )}

            {erro && <p style={{ color:C.red, fontSize:"0.78rem", margin:0 }}>{erro}</p>}
            {aviso && <p style={{ color:C.green, fontSize:"0.78rem", margin:0 }}>{aviso}</p>}

            <button onClick={handle} disabled={loading || (modo==="cadastro" && !podeCadastrar)}
              style={btnPri({ opacity: loading || (modo==="cadastro" && !podeCadastrar) ? 0.45 : 1 })}>
              {loading ? "Aguarde..." : modo==="cadastro" ? "Começar grátis →" : "Entrar"}
            </button>

            <p style={{ textAlign:"center", fontSize:"0.68rem", color:C.textSub, margin:"4px 0 0" }}>
              30 dias de Pro grátis · Sem cartão de crédito
            </p>
          </div>
        </div>

        <p style={{ textAlign:"center", fontSize:"0.78rem", color:C.textSub, marginTop:12 }}>
          {modo==="cadastro" ? "Já tem conta? " : "Não tem conta? "}
          <button onClick={()=>{ setModo(modo==="cadastro"?"login":"cadastro"); setErro(""); setAviso(""); }}
            style={{ background:"none", border:"none", color:C.primaryLight, fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:"0.8rem", padding:0 }}>
            {modo==="cadastro" ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </div>
    </div>
  );
}
