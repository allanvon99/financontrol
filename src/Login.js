import { useState } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState("login");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setErro(""); setLoading(true);
    try {
      if (modo === "login") {
        await signInWithEmailAndPassword(auth, email, senha);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        const agora = new Date();
        const trialFim = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
        await setDoc(doc(db, "usuarios", cred.user.uid), {
          criadoEm: agora.toISOString(),
          trialFim: trialFim.toISOString(),
          onboardingConcluido: false,
          plano: "free",
        }, { merge: true });
      }
    } catch (e) {
      setErro(e.code === "auth/invalid-credential" ? "Email ou senha incorretos" :
              e.code === "auth/email-already-in-use" ? "Email já cadastrado" :
              e.code === "auth/weak-password" ? "Senha fraca (mín. 6 caracteres)" : e.message);
    }
    setLoading(false);
  };

  const inp = { width:"100%", padding:"12px 14px", borderRadius:8, border:"1px solid #334155", background:"#1e293b", color:"#e2e8f0", fontSize:"0.95rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0e1a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif" }}>
      <div style={{ background:"#111827", borderRadius:16, padding:32, width:"100%", maxWidth:380, border:"1px solid #1e293b" }}>
        <h1 style={{ textAlign:"center", fontSize:"1.8rem", fontWeight:800, background:"linear-gradient(90deg,#38bdf8,#818cf8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8 }}>Von Finance</h1>
        <p style={{ textAlign:"center", color:"#64748b", fontSize:"0.85rem", marginBottom:28 }}>Controle financeiro pessoal</p>

        <div style={{ display:"flex", marginBottom:20, background:"#1e293b", borderRadius:8, padding:4 }}>
          {["login","cadastro"].map(m => (
            <button key={m} onClick={() => setModo(m)} style={{ flex:1, padding:"8px", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:"0.85rem", fontFamily:"inherit", background: modo===m ? "linear-gradient(135deg,#38bdf8,#818cf8)" : "transparent", color: modo===m ? "#fff" : "#94a3b8", transition:"all 0.2s" }}>
              {m === "login" ? "Entrar" : "Cadastrar"}
            </button>
          ))}
        </div>

        {modo === "cadastro" && (
          <p style={{ textAlign:"center", color:"#38bdf8", fontSize:"0.78rem", marginBottom:16, marginTop:-8 }}>
            ✨ 30 dias grátis do plano Pro ao criar sua conta
          </p>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/>
          <input placeholder="Senha" type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} style={inp}/>
          {erro && <p style={{ color:"#f87171", fontSize:"0.82rem", margin:0 }}>{erro}</p>}
          <button onClick={handle} disabled={loading} style={{ padding:"12px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#38bdf8,#818cf8)", color:"#fff", fontWeight:700, fontSize:"0.95rem", cursor:"pointer", fontFamily:"inherit", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
