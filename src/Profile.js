import { useState } from "react";
import { auth } from "./firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut } from "firebase/auth";

const CORES_DARK = { bg:"#0d1117", card:"#161b22", border:"#21262d", surface:"#1c2128", text:"#c9d1d9", textSub:"#8b949e", primary:"#2188c9", green:"#3fb950", red:"#f85149" };
const CORES_LIGHT = { bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", surface:"#f6f8fa", text:"#1f2328", textSub:"#57606a", primary:"#0969da", green:"#1a7f37", red:"#d1242f" };

export function ModalPerfil({ onClose, dark, onOpenEditar }) {
  const user = auth.currentUser;
  const C = dark ? CORES_DARK : CORES_LIGHT;
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:16, padding:20, width:"100%", maxWidth:320, border:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h3 style={{ fontSize:"0.95rem", fontWeight:800, margin:0, color:C.text }}>Minha conta</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.textSub, fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
        </div>

        {/* Email */}
        <div style={{ background:C.surface, borderRadius:10, padding:"12px 14px", marginBottom:14, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", fontWeight:800, color:"#fff", flexShrink:0 }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:"0.72rem", color:C.textSub, marginBottom:1 }}>Email</div>
            <div style={{ fontSize:"0.82rem", fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</div>
          </div>
        </div>

        {/* Botão editar cadastro */}
        <button onClick={()=>{ onClose(); onOpenEditar(); }} style={{ width:"100%", padding:"11px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.text, fontWeight:600, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit", marginBottom:10, textAlign:"left", display:"flex", alignItems:"center", gap:10 }}>
          <span>⚙️</span> Editar cadastro e aparência
        </button>

        {/* Botão sair */}
        {!confirmandoSaida ? (
          <button onClick={()=>setConfirmandoSaida(true)} style={{ width:"100%", padding:"11px", borderRadius:10, border:`1px solid ${C.red}33`, background:"transparent", color:C.red, fontWeight:600, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit" }}>
            🚪 Sair da conta
          </button>
        ) : (
          <div style={{ background:`${C.red}11`, borderRadius:10, padding:"12px", border:`1px solid ${C.red}33` }}>
            <p style={{ color:C.red, fontSize:"0.78rem", margin:"0 0 10px", textAlign:"center" }}>Tem certeza que deseja sair?</p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setConfirmandoSaida(false)} style={{ flex:1, padding:"9px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>Cancelar</button>
              <button onClick={()=>signOut(auth)} style={{ flex:1, padding:"9px", borderRadius:8, border:"none", background:C.red, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>Sair</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TelaEditar({ onClose, dark, setDark, onSalvarPreferencias }) {
  const user = auth.currentUser;
  const C = dark ? CORES_DARK : CORES_LIGHT;
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [temaDark, setTemaDark] = useState(dark);

  const inp = { width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:"0.85rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  const salvarSenha = async () => {
    setErro(""); setMsg(""); setLoading(true);
    if (!senhaAtual) { setErro("Informe sua senha atual"); setLoading(false); return; }
    if (!novaSenha) { setErro("Informe a nova senha"); setLoading(false); return; }
    if (novaSenha !== confirmarSenha) { setErro("As senhas não coincidem"); setLoading(false); return; }
    if (novaSenha.length < 6) { setErro("Nova senha deve ter pelo menos 6 caracteres"); setLoading(false); return; }
    try {
      const cred = EmailAuthProvider.credential(user.email, senhaAtual);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, novaSenha);
      setMsg("Senha atualizada com sucesso!");
      setSenhaAtual(""); setNovaSenha(""); setConfirmarSenha("");
    } catch(e) {
      setErro(e.code==="auth/wrong-password"?"Senha atual incorreta":"Erro: "+e.message);
    }
    setLoading(false);
  };

  const salvarAparencia = async () => {
    setDark(temaDark);
    await onSalvarPreferencias({ dark: temaDark });
    setMsg("Preferências salvas!");
    setTimeout(()=>setMsg(""),2000);
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <button onClick={onClose} style={{ background:"none", border:"none", color:C.textSub, cursor:"pointer", fontSize:"1.1rem", padding:0 }}>←</button>
        <h2 style={{ fontSize:"0.95rem", fontWeight:800, margin:0, color:C.text }}>Editar cadastro</h2>
      </div>

      {/* Info da conta */}
      <div style={{ background:C.card, borderRadius:12, padding:"12px 14px", marginBottom:14, border:`1px solid ${C.border}` }}>
        <div style={{ fontSize:"0.65rem", color:C.textSub, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Conta</div>
        <div style={{ fontSize:"0.85rem", color:C.text, fontWeight:600 }}>{user?.email}</div>
      </div>

      {/* Alterar senha */}
      <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.border}`, marginBottom:14 }}>
        <div style={{ fontSize:"0.65rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700, marginBottom:12 }}>🔒 Alterar senha</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <input type="password" placeholder="Senha atual" value={senhaAtual} onChange={e=>setSenhaAtual(e.target.value)} style={inp}/>
          <input type="password" placeholder="Nova senha" value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} style={inp}/>
          <input type="password" placeholder="Confirmar nova senha" value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)} style={inp}/>
          {erro&&<div style={{ fontSize:"0.76rem", color:C.red, padding:"8px 10px", background:`${C.red}11`, borderRadius:8 }}>{erro}</div>}
          {msg&&<div style={{ fontSize:"0.76rem", color:C.green, padding:"8px 10px", background:`${C.green}11`, borderRadius:8 }}>{msg}</div>}
          <button onClick={salvarSenha} disabled={loading} style={{ padding:"11px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit", opacity:loading?0.7:1 }}>
            {loading?"Salvando...":"Salvar nova senha"}
          </button>
        </div>
      </div>

      {/* Aparência */}
      <div style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${C.border}` }}>
        <div style={{ fontSize:"0.65rem", color:C.primary, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700, marginBottom:12 }}>🎨 Aparência</div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {[
            { val:true, label:"🌙 Escuro", desc:"Fundo escuro" },
            { val:false, label:"☀️ Claro", desc:"Fundo claro" },
          ].map(o=>(
            <button key={String(o.val)} onClick={()=>setTemaDark(o.val)} style={{ flex:1, padding:"12px 8px", borderRadius:10, border:`1px solid ${temaDark===o.val?C.primary:C.border}`, background:temaDark===o.val?C.primary+"22":"transparent", cursor:"pointer", fontFamily:"inherit", textAlign:"center", transition:"all 0.2s" }}>
              <div style={{ fontSize:"0.9rem", marginBottom:3 }}>{o.label}</div>
              <div style={{ fontSize:"0.62rem", color:C.textSub }}>{o.desc}</div>
            </button>
          ))}
        </div>
        <button onClick={salvarAparencia} style={{ width:"100%", padding:"11px", borderRadius:8, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit" }}>
          Salvar preferências
        </button>
      </div>

      {/* WhatsApp */}
      <button onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent("https://financontrol.vercel.app")}`,"_blank")} style={{ width:"100%", marginTop:12, padding:"11px", borderRadius:10, border:"none", background:"#166534", color:"#fff", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit" }}>
        📲 Convidar amigos pelo WhatsApp
      </button>
    </div>
  );
}
