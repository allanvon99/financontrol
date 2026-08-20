import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  updatePassword, verifyBeforeUpdateEmail,
  reauthenticateWithCredential, EmailAuthProvider,
  deleteUser, signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { carregarPlanos, PLANOS_PADRAO, fmtPreco } from "./planos";
import { POLITICA_PRIVACIDADE, TERMOS_USO, VERSAO_DOCS, DATA_VIGENCIA } from "./legal";

function Bloco({ titulo, children, cor, C }) {
  return (
    <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}`, marginBottom:12 }}>
      {titulo && <div style={{ fontSize:"0.66rem", color:cor||C.primary, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:12 }}>{titulo}</div>}
      {children}
    </div>
  );
}

export default function GerenciarConta({ C, onVoltar, dadosApp, abaInicial, planoAtivo, trialAtivo, diasTrialRestantes }) {
  const user = auth.currentUser;
  const TXT = C.grayLight || C.text;
  const SUB = C.gray || C.textSub;

  const [aba, setAba] = useState(abaInicial || "dados");
  const [dados, setDados] = useState({ nome:"", sobrenome:"" });
  const [emailNovo, setEmailNovo] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [senhas, setSenhas] = useState({ atual:"", nova:"", confirmar:"" });
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [etapaDelete, setEtapaDelete] = useState(0);
  const [confirmTexto, setConfirmTexto] = useState("");
  const [senhaDelete, setSenhaDelete] = useState("");
  const [planos, setPlanos] = useState(PLANOS_PADRAO);
  const [planoUsuario, setPlanoUsuario] = useState("free");
  const [docLegal, setDocLegal] = useState(null);

  useEffect(()=>{
    (async()=>{
      setPlanos(await carregarPlanos());
      if (user) {
        try {
          const snap = await getDoc(doc(db,"usuarios",user.uid));
          if (snap.exists()) {
            const d = snap.data();
            setDados({ nome:d.nome||"", sobrenome:d.sobrenome||"" });
            setPlanoUsuario(d.plano || "free");
          }
        } catch(e){ console.error(e); }
      }
    })();
  },[user]);

  const flash = (setter, txt) => { setter(txt); setTimeout(()=>setter(""), 3500); };
  const inpBase = { width:"100%", padding:"12px 13px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, color:TXT, fontSize:"0.87rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const inp = (ov={}) => ({ ...inpBase, ...ov });
  const btnPri = (ov={}) => ({ width:"100%", padding:"13px", borderRadius:11, border:"none", background:"linear-gradient(135deg,#1d6fa4,#2188c9)", color:"#fff", fontWeight:700, fontSize:"0.88rem", cursor:"pointer", fontFamily:"inherit", ...ov });

  const traduz = (code) => ({
    "auth/wrong-password":"Senha incorreta",
    "auth/invalid-credential":"Senha incorreta",
    "auth/email-already-in-use":"Este email já está vinculado a outra conta",
    "auth/invalid-email":"Email inválido",
    "auth/weak-password":"A senha precisa ter ao menos 6 caracteres",
    "auth/requires-recent-login":"Por segurança, saia e entre novamente antes de fazer isso",
  }[code] || "Não foi possível concluir. Tente novamente");

  const reautenticar = async (senha) => {
    const cred = EmailAuthProvider.credential(user.email, senha);
    await reauthenticateWithCredential(user, cred);
  };

  const salvarDados = async () => {
    if (!dados.nome || !dados.sobrenome) return flash(setErro,"Preencha nome e sobrenome");
    setLoading(true);
    try {
      await setDoc(doc(db,"usuarios",user.uid), { nome:dados.nome.trim(), sobrenome:dados.sobrenome.trim() }, { merge:true });
      flash(setMsg,"Dados atualizados com sucesso!");
    } catch(e){ flash(setErro, traduz(e.code)); }
    setLoading(false);
  };

  const trocarEmail = async () => {
    if (!emailNovo) return flash(setErro,"Informe o novo email");
    if (emailNovo.trim().toLowerCase() === user.email.toLowerCase()) return flash(setErro,"O novo email é igual ao atual");
    if (!senhaConfirm) return flash(setErro,"Informe sua senha para confirmar");
    setLoading(true);
    try {
      await reautenticar(senhaConfirm);
      await verifyBeforeUpdateEmail(user, emailNovo.trim());
      flash(setMsg,`Link de confirmação enviado para ${emailNovo.trim()}. Confirme por lá para concluir a troca.`);
      setEmailNovo(""); setSenhaConfirm("");
    } catch(e){ flash(setErro, traduz(e.code)); }
    setLoading(false);
  };

  const trocarSenha = async () => {
    if (!senhas.atual || !senhas.nova) return flash(setErro,"Preencha todos os campos");
    if (senhas.nova.length < 6) return flash(setErro,"A nova senha precisa ter ao menos 6 caracteres");
    if (senhas.nova !== senhas.confirmar) return flash(setErro,"As senhas não coincidem");
    setLoading(true);
    try {
      await reautenticar(senhas.atual);
      await updatePassword(user, senhas.nova);
      flash(setMsg,"Senha alterada com sucesso!");
      setSenhas({atual:"",nova:"",confirmar:""});
    } catch(e){ flash(setErro, traduz(e.code)); }
    setLoading(false);
  };

  const exportarDados = () => {
    const blob = new Blob([JSON.stringify(dadosApp||{}, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `von-finance-meus-dados-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const excluirConta = async () => {
    if (confirmTexto !== "EXCLUIR") return;
    if (!senhaDelete) return flash(setErro,"Informe sua senha");
    setLoading(true);
    try {
      await reautenticar(senhaDelete);
      const backupsSnap = await getDocs(collection(db,"usuarios",user.uid,"backups"));
      await Promise.all(backupsSnap.docs.map(d=>deleteDoc(d.ref)));
      await deleteDoc(doc(db,"usuarios",user.uid));
      await deleteUser(user);
    } catch(e){ flash(setErro, traduz(e.code)); setLoading(false); }
  };

  const ABAS = [
    { k:"dados", l:"Dados", i:"👤" },
    { k:"acesso", l:"Acesso", i:"🔐" },
    { k:"plano", l:"Plano", i:"⭐" },
    { k:"conta", l:"Conta", i:"⚙️" },
  ];


  const pro = planos.pro;
  const free = planos.free;
  const ehPro = planoAtivo === "pro" || planoUsuario === "pro";
  const mostrarUpsell = !ehPro || trialAtivo;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, animation:"slideIn 0.25s ease" }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {docLegal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={()=>setDocLegal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:"22px 22px 0 0", padding:"18px 20px 30px", width:"100%", maxWidth:520, maxHeight:"88vh", overflowY:"auto" }}>
            <div style={{ width:38, height:4, borderRadius:2, background:C.border, margin:"0 auto 16px" }}/>
            <h3 style={{ fontSize:"1rem", fontWeight:800, color:TXT, margin:"0 0 14px" }}>
              {docLegal==="termos" ? "Termos de Uso" : "Política de Privacidade"}
            </h3>
            <div style={{ fontSize:"0.8rem", color:SUB, lineHeight:1.65 }}>
              {(docLegal==="termos" ? TERMOS_USO : POLITICA_PRIVACIDADE).map((s,i)=>(
                <div key={i} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:"0.84rem", fontWeight:700, color:TXT, marginBottom:6 }}>{i+1}. {s.t}</div>
                  {s.p.map((par,j)=>(<p key={j} style={{ margin:"0 0 7px", lineHeight:1.6 }}>{par}</p>))}
                </div>
              ))}
            </div>
            <button onClick={()=>setDocLegal(null)} style={btnPri({ marginTop:16 })}>Fechar</button>
          </div>
        </div>
      )}

      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onVoltar} style={{ background:"none", border:"none", color:TXT, fontSize:"1.3rem", cursor:"pointer", padding:0, lineHeight:1 }}>←</button>
          <div style={{ fontSize:"1rem", fontWeight:800, color:TXT }}>Gerenciar conta</div>
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"16px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:18 }}>
          {ABAS.map(a=>(
            <button key={a.k} onClick={()=>{setAba(a.k);setErro("");setMsg("");}}
              style={{ padding:"10px 4px", border:"none", cursor:"pointer", fontFamily:"inherit",
                background: aba===a.k ? C.primary : "transparent", color: aba===a.k ? "#fff" : SUB,
                display:"flex", flexDirection:"column", alignItems:"center", gap:3, transition:"all 0.2s" }}>
              <span style={{ fontSize:"0.95rem" }}>{a.i}</span>
              <span style={{ fontSize:"0.63rem", fontWeight: aba===a.k?700:500 }}>{a.l}</span>
            </button>
          ))}
        </div>

        {msg && <div style={{ background:`${C.green}15`, border:`1px solid ${C.green}44`, borderRadius:10, padding:"11px 13px", color:C.green, fontSize:"0.78rem", marginBottom:12, lineHeight:1.5 }}>{msg}</div>}
        {erro && <div style={{ background:`${C.red}15`, border:`1px solid ${C.red}44`, borderRadius:10, padding:"11px 13px", color:C.red, fontSize:"0.78rem", marginBottom:12, lineHeight:1.5 }}>{erro}</div>}

        {aba==="dados" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:13, background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}`, marginBottom:12 }}>
              <div style={{ width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#1d6fa4,#2188c9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.2rem", fontWeight:800, color:"#fff", flexShrink:0 }}>
                {(dados.nome[0]||"")}{(dados.sobrenome[0]||"")}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:"1rem", fontWeight:800, color:TXT }}>{dados.nome} {dados.sobrenome}</div>
                <div style={{ fontSize:"0.75rem", color:SUB, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user?.email}</div>
                <div style={{ fontSize:"0.66rem", color: ehPro ? C.primaryLight : C.green, marginTop:3 }}>
                  ● Plano {trialAtivo ? `${pro.nome} (Trial · ${diasTrialRestantes}d)` : ehPro ? pro.nome : free.nome}
                </div>
              </div>
            </div>

            <Bloco C={C} titulo="Informações pessoais">
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <label style={{ fontSize:"0.66rem", color:SUB, display:"block", marginBottom:4 }}>Nome</label>
                    <input value={dados.nome} onChange={e=>setDados(d=>({...d,nome:e.target.value}))} style={inp()}/>
                  </div>
                  <div>
                    <label style={{ fontSize:"0.66rem", color:SUB, display:"block", marginBottom:4 }}>Sobrenome</label>
                    <input value={dados.sobrenome} onChange={e=>setDados(d=>({...d,sobrenome:e.target.value}))} style={inp()}/>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:"0.66rem", color:SUB, display:"block", marginBottom:4 }}>Email de acesso</label>
                  <input value={user?.email||""} disabled style={inp({ opacity:0.6, cursor:"not-allowed" })}/>
                  <div style={{ fontSize:"0.66rem", color:SUB, marginTop:5 }}>Para trocar o email, use a aba <strong style={{color:TXT}}>Acesso</strong>.</div>
                </div>
                <button onClick={salvarDados} disabled={loading} style={btnPri({ marginTop:4, opacity:loading?0.6:1 })}>
                  {loading?"Salvando...":"Salvar alterações"}
                </button>
              </div>
            </Bloco>
          </div>
        )}

        {aba==="acesso" && (
          <div>
            <Bloco C={C} titulo="Alterar email">
              <div style={{ background:C.surface, borderRadius:9, padding:"10px 12px", border:`1px solid ${C.border}`, marginBottom:12 }}>
                <div style={{ fontSize:"0.66rem", color:SUB, marginBottom:2 }}>Email atual</div>
                <div style={{ fontSize:"0.84rem", fontWeight:600, color:TXT }}>{user?.email}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <input placeholder="Novo email" type="email" autoCapitalize="none" value={emailNovo} onChange={e=>setEmailNovo(e.target.value)} style={inp()}/>
                <input placeholder="Sua senha atual (para confirmar)" type="password" value={senhaConfirm} onChange={e=>setSenhaConfirm(e.target.value)} style={inp()}/>
                <div style={{ fontSize:"0.68rem", color:SUB, lineHeight:1.5, background:`${C.yellow}10`, border:`1px solid ${C.yellow}33`, borderRadius:9, padding:"10px 12px" }}>
                  ⚠️ Cada email pode estar vinculado a apenas uma conta. Enviaremos um link de confirmação para o novo endereço — a troca só é concluída após você confirmar por lá.
                </div>
                <button onClick={trocarEmail} disabled={loading} style={btnPri({ opacity:loading?0.6:1 })}>
                  {loading?"Aguarde...":"Alterar email"}
                </button>
              </div>
            </Bloco>

            <Bloco C={C} titulo="Alterar senha">
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <input placeholder="Senha atual" type="password" value={senhas.atual} onChange={e=>setSenhas(s=>({...s,atual:e.target.value}))} style={inp()}/>
                <input placeholder="Nova senha" type="password" value={senhas.nova} onChange={e=>setSenhas(s=>({...s,nova:e.target.value}))} style={inp()}/>
                <input placeholder="Confirmar nova senha" type="password" value={senhas.confirmar} onChange={e=>setSenhas(s=>({...s,confirmar:e.target.value}))}
                  style={inp(senhas.confirmar && senhas.nova!==senhas.confirmar ? { border:`1px solid ${C.red}` } : {})}/>
                {senhas.confirmar && senhas.nova!==senhas.confirmar && <span style={{ fontSize:"0.7rem", color:C.red }}>As senhas não coincidem</span>}
                <button onClick={trocarSenha} disabled={loading} style={btnPri({ opacity:loading?0.6:1 })}>
                  {loading?"Aguarde...":"Alterar senha"}
                </button>
              </div>
            </Bloco>
          </div>
        )}

        {aba==="plano" && (
          <div>
            <div style={{ background:C.card, borderRadius:14, border:`1px solid ${ehPro?C.primary+"55":C.border}`, overflow:"hidden", marginBottom:14 }}>
              <div style={{ height:3, background: ehPro ? `linear-gradient(90deg,${C.primary},${C.purple})` : `linear-gradient(90deg,${SUB},${C.border})` }}/>
              <div style={{ padding:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:"0.66rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>Seu plano atual</div>
                  <div style={{ fontSize:"1.15rem", fontWeight:800, color: ehPro?C.primaryLight:TXT }}>
                    {trialAtivo ? `${pro.nome} (Trial)` : ehPro ? pro.nome : free.nome}
                  </div>
                </div>
                <div style={{ background: trialAtivo ? `${C.orange}20` : C.surface, border:`1px solid ${trialAtivo?C.orange:C.border}`, borderRadius:20, padding:"5px 12px", fontSize:"0.7rem", color: trialAtivo?C.orange:SUB, fontWeight:600 }}>
                  {trialAtivo ? `${diasTrialRestantes} dia${diasTrialRestantes===1?"":"s"} restante${diasTrialRestantes===1?"":"s"}` : "Ativo"}
                </div>
              </div>
            </div>

            {!ehPro && (
              <Bloco C={C} titulo="Seu uso no plano gratuito">
                {[
                  { l:"Cartões", usado:(dadosApp?.cartoes||[]).length, limite:free.limites.cartoes },
                  { l:"Parcelas", usado:(dadosApp?.parcelas||[]).length, limite:free.limites.parcelas },
                  { l:"Gastos fixos", usado:(dadosApp?.fixos||[]).length, limite:free.limites.fixos },
                  { l:"Gastos do mês", usado:(dadosApp?.extras||[]).filter(e=>{ const hoje=new Date(); return e.mesReal===hoje.getMonth() && e.anoReal===hoje.getFullYear(); }).length, limite:free.limites.extras },
                ].map(u=>{
                  const pct = u.limite ? Math.min(100,(u.usado/u.limite)*100) : 0;
                  const cheio = u.limite && u.usado>=u.limite;
                  return (
                    <div key={u.l} style={{ marginBottom:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ fontSize:"0.78rem", color:TXT }}>{u.l}</span>
                        <span style={{ fontSize:"0.75rem", fontWeight:700, color: cheio ? C.orange : SUB }}>{u.usado}/{u.limite}</span>
                      </div>
                      <div style={{ height:5, borderRadius:3, background:C.surface, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background: cheio ? C.orange : C.primary, borderRadius:3, transition:"width 0.3s" }}/>
                      </div>
                    </div>
                  );
                })}
              </Bloco>
            )}

            <div style={{ fontSize:"0.66rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:10 }}>Compare os planos</div>
            <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1.4fr 0.8fr 0.8fr", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
                <div style={{ padding:"11px 13px", fontSize:"0.68rem", color:SUB, fontWeight:700 }}>Recurso</div>
                <div style={{ padding:"11px 6px", fontSize:"0.68rem", color:SUB, fontWeight:700, textAlign:"center" }}>{free.nome}</div>
                <div style={{ padding:"11px 6px", fontSize:"0.68rem", color:C.primaryLight, fontWeight:800, textAlign:"center" }}>{pro.nome}</div>
              </div>
              {[
                { r:"Cartões", f: free.limites.cartoes ?? "∞", p: pro.limites.cartoes ?? "Ilimitado" },
                { r:"Parcelas", f: free.limites.parcelas ?? "∞", p: pro.limites.parcelas ?? "Ilimitado" },
                { r:"Gastos fixos", f: free.limites.fixos ?? "∞", p: pro.limites.fixos ?? "Ilimitado" },
                { r:"Gastos do mês", f: free.limites.extras ? `${free.limites.extras}/mês` : "∞", p: pro.limites.extras ? `${pro.limites.extras}/mês` : "Ilimitado" },
                { r:"Projeção futura", f:`${free.limites.mesesProjecao} meses`, p:`${pro.limites.mesesProjecao} meses` },
                { r:"Simulador amortização", f: free.recursos.simulador?"✓":"—", p: pro.recursos.simulador?"✓":"—" },
                { r:"Categorias custom", f: free.recursos.categoriasCustom?"✓":"—", p: pro.recursos.categoriasCustom?"✓":"—" },
                { r:"Alertas configuráveis", f: free.recursos.alertas?"✓":"—", p: pro.recursos.alertas?"✓":"—" },
                { r:"Exportar PDF", f: free.recursos.exportarPdf?"✓":"—", p: pro.recursos.exportarPdf?"✓":"—" },
              ].map((row,i,arr)=>(
                <div key={row.r} style={{ display:"grid", gridTemplateColumns:"1.4fr 0.8fr 0.8fr", borderBottom: i<arr.length-1?`1px solid ${C.border}`:"none" }}>
                  <div style={{ padding:"10px 13px", fontSize:"0.76rem", color:TXT }}>{row.r}</div>
                  <div style={{ padding:"10px 6px", fontSize:"0.74rem", color:SUB, textAlign:"center" }}>{row.f}</div>
                  <div style={{ padding:"10px 6px", fontSize:"0.74rem", color: row.p==="✓"?C.green:C.primaryLight, fontWeight:700, textAlign:"center" }}>{row.p}</div>
                </div>
              ))}
            </div>

            {mostrarUpsell && (
              <>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
                  <div style={{ background:C.card, borderRadius:14, border:`1px solid ${trialAtivo?C.orange+"55":C.border}`, padding:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                      <div>
                        <div style={{ fontSize:"0.92rem", fontWeight:800, color:TXT }}>{pro.nome} Mensal</div>
                        <div style={{ fontSize:"0.68rem", color:SUB, marginTop:2 }}>
                          {trialAtivo ? "Garanta o acesso Pro quando o trial acabar" : "Cancele quando quiser"}
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:"1.25rem", fontWeight:800, color:TXT }}>{fmtPreco(pro.precoMensal)}</div>
                        <div style={{ fontSize:"0.63rem", color:SUB }}>por mês</div>
                      </div>
                    </div>
                    <button onClick={()=>flash(setMsg,"Em breve! O pagamento está sendo integrado.")}
                      style={{ width:"100%", padding:"12px", borderRadius:11, border:"none", background:C.primary, color:"#fff", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit" }}>
                      {trialAtivo ? "Assinar antes do trial acabar" : "Assinar plano Pro"}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize:"0.68rem", color:SUB, textAlign:"center", lineHeight:1.5 }}>
                  Pagamento seguro · Cancele a qualquer momento<br/>Sem fidelidade ou multa
                </div>
              </>
            )}
          </div>
        )}

        {aba==="conta" && (
          <div>
            <Bloco C={C} titulo="Exportar dados">
              <div style={{ fontSize:"0.75rem", color:SUB, lineHeight:1.5, marginBottom:12 }}>
                Baixe uma cópia de todos os seus dados financeiros em formato JSON. Direito garantido pela LGPD.
              </div>
              <button onClick={exportarDados} style={{ width:"100%", padding:"12px", borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:TXT, fontWeight:600, fontSize:"0.83rem", cursor:"pointer", fontFamily:"inherit" }}>
                📥 Baixar meus dados
              </button>
            </Bloco>

            <Bloco C={C} titulo="Documentos">
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  { k:"termos", l:"Termos de Uso", i:"📄" },
                  { k:"privacidade", l:"Política de Privacidade", i:"🔒" },
                ].map(d=>(
                  <button key={d.k} onClick={()=>setDocLegal(d.k)}
                    style={{ width:"100%", padding:"12px 13px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, color:TXT, cursor:"pointer", fontFamily:"inherit", fontSize:"0.83rem", display:"flex", alignItems:"center", gap:10, textAlign:"left" }}>
                    <span style={{ fontSize:"0.95rem" }}>{d.i}</span>
                    <span style={{ flex:1 }}>{d.l}</span>
                    <span style={{ color:SUB, fontSize:"1rem" }}>›</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize:"0.66rem", color:SUB, marginTop:10 }}>
                Versão {VERSAO_DOCS} · vigente desde {DATA_VIGENCIA}
              </div>
            </Bloco>

            <div style={{ background:`${C.red}08`, borderRadius:14, padding:16, border:`1px solid ${C.red}33` }}>
              <div style={{ fontSize:"0.66rem", color:C.red, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:12 }}>Zona de perigo</div>

              {etapaDelete===0 && (
                <>
                  <div style={{ fontSize:"0.84rem", fontWeight:700, color:TXT, marginBottom:5 }}>Excluir minha conta</div>
                  <div style={{ fontSize:"0.75rem", color:SUB, lineHeight:1.55, marginBottom:14 }}>
                    Todos os seus dados serão apagados permanentemente: parcelas, gastos, cartões, receitas e configurações. Esta ação não pode ser desfeita.
                  </div>
                  <button onClick={()=>setEtapaDelete(1)} style={{ width:"100%", padding:"12px", borderRadius:11, border:`1px solid ${C.red}55`, background:"transparent", color:C.red, fontWeight:700, fontSize:"0.83rem", cursor:"pointer", fontFamily:"inherit" }}>
                    Excluir minha conta
                  </button>
                </>
              )}

              {etapaDelete===1 && (
                <>
                  <div style={{ fontSize:"0.84rem", fontWeight:700, color:C.red, marginBottom:10 }}>O que será apagado:</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                    {["Todas as suas parcelas e gastos","Cartões e categorias cadastradas","Histórico de receitas e projeções","Sua conta de acesso"].map(t=>(
                      <div key={t} style={{ display:"flex", gap:8, alignItems:"center", fontSize:"0.76rem", color:SUB }}>
                        <span style={{ color:C.red }}>✕</span>{t}
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:9 }}>
                    <button onClick={()=>setEtapaDelete(0)} style={{ flex:1, padding:"12px", borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:SUB, fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:"0.83rem" }}>Cancelar</button>
                    <button onClick={()=>setEtapaDelete(2)} style={{ flex:1, padding:"12px", borderRadius:11, border:"none", background:C.red, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:"0.83rem" }}>Continuar</button>
                  </div>
                </>
              )}

              {etapaDelete===2 && (
                <>
                  <div style={{ fontSize:"0.8rem", color:TXT, marginBottom:10, lineHeight:1.55 }}>
                    Para confirmar, digite <strong style={{ color:C.red }}>EXCLUIR</strong> abaixo:
                  </div>
                  <input value={confirmTexto} onChange={e=>setConfirmTexto(e.target.value)} placeholder="EXCLUIR"
                    style={inp({ marginBottom:10, textAlign:"center", fontWeight:700, letterSpacing:"0.1em" })}/>
                  <input type="password" placeholder="Sua senha" value={senhaDelete} onChange={e=>setSenhaDelete(e.target.value)} style={inp({ marginBottom:12 })}/>
                  <div style={{ display:"flex", gap:9 }}>
                    <button onClick={()=>{setEtapaDelete(0);setConfirmTexto("");setSenhaDelete("");}} style={{ flex:1, padding:"12px", borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:SUB, fontWeight:600, cursor:"pointer", fontFamily:"inherit", fontSize:"0.83rem" }}>Cancelar</button>
                    <button onClick={excluirConta} disabled={confirmTexto!=="EXCLUIR"||loading}
                      style={{ flex:1, padding:"12px", borderRadius:11, border:"none", background:C.red, color:"#fff", fontWeight:700, cursor: confirmTexto==="EXCLUIR"?"pointer":"not-allowed", fontFamily:"inherit", fontSize:"0.83rem", opacity: confirmTexto==="EXCLUIR"&&!loading?1:0.4 }}>
                      {loading?"Excluindo...":"Excluir definitivamente"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
