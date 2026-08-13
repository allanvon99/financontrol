import { useState, useEffect } from "react";
import { carregarPlanos, PLANOS_PADRAO, fmtPreco } from "./planos";

const fmt = (v) => Number(v||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

const BANCOS = [
  { nome:"Nubank", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Nubank_logo_2021.svg/1200px-Nubank_logo_2021.svg.png", bg:"#8A05BE" },
  { nome:"Itaú", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Banco_Ita%C3%BA_logo.svg/1200px-Banco_Ita%C3%BA_logo.svg.png", bg:"#EC7000" },
  { nome:"Bradesco", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Bradesco_logo.svg/1200px-Bradesco_logo.svg.png", bg:"#CC092F" },
  { nome:"Santander", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Santander_logo.svg/1200px-Santander_logo.svg.png", bg:"#EA1D25" },
  { nome:"Inter", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Banco_inter_logo.svg/1200px-Banco_inter_logo.svg.png", bg:"#FF7A00" },
  { nome:"C6 Bank", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/C6_Bank.svg/1200px-C6_Bank.svg.png", bg:"#242424" },
  { nome:"PicPay", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/PicPay_logo.svg/1200px-PicPay_logo.svg.png", bg:"#11C76F" },
  { nome:"Caixa", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Caixa_Econ%C3%B4mica_Federal_logo.svg/1200px-Caixa_Econ%C3%B4mica_Federal_logo.svg.png", bg:"#0070AF" },
];

export default function Onboarding({ C, dark, setDark, nome, onFinalizar, trialUsadoAnteriormente }) {
  const [step, setStep] = useState(0);
  const [dados, setDados] = useState({
    situacao:null, salario:"", cartoes:[], alertasAtivos:true, alertas:{ saudavel:60, atencao:80 },
  });

  const [planoPro, setPlanoPro] = useState(PLANOS_PADRAO.pro);
  useEffect(()=>{ carregarPlanos().then(p=>setPlanoPro(p.pro)); },[]);

  const TOTAL = 5;
  const next = () => setStep(s=>s+1);
  const back = () => setStep(s=>s-1);

  const inp = (ov={}) => ({
    width:"100%", padding:"13px 14px", borderRadius:10,
    border:`1px solid ${C.border}`, background:C.surface, color:C.grayLight||C.text,
    fontSize:"0.9rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box", ...ov
  });
  const btnPri = (ov={}) => ({
    width:"100%", padding:"14px", borderRadius:12, border:"none",
    background:"linear-gradient(135deg,#1d6fa4,#2188c9)", color:"#fff",
    fontWeight:700, fontSize:"0.92rem", cursor:"pointer", fontFamily:"inherit", ...ov
  });
  const btnBack = { padding:"14px 20px", borderRadius:12, border:`1px solid ${C.border}`, background:"transparent", color:C.gray||C.textSub, cursor:"pointer", fontFamily:"inherit", fontWeight:600 };

  const TXT = C.grayLight || C.text;
  const SUB = C.gray || C.textSub;

  const toggleCartao = (b) => setDados(d=>({
    ...d, cartoes: d.cartoes.find(c=>c.nome===b.nome) ? d.cartoes.filter(c=>c.nome!==b.nome) : [...d.cartoes, b]
  }));

  const finalizar = () => onFinalizar({
    salario: dados.salario ? parseFloat(dados.salario) : 0,
    cartoes: dados.cartoes,
    saudeConfig: { ...dados.alertas, ativos: dados.alertasAtivos },
    situacao: dados.situacao,
    dark,
  });

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pop{0%{transform:scale(0.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
      `}</style>

      {step > 0 && step <= TOTAL && (
        <div style={{ padding:"16px 20px 0" }}>
          <div style={{ display:"flex", gap:5 }}>
            {Array.from({length:TOTAL}).map((_,i)=>(
              <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i < step ? C.primary : C.border, transition:"background 0.3s" }}/>
            ))}
          </div>
          <div style={{ fontSize:"0.65rem", color:SUB, marginTop:8, textAlign:"center" }}>Passo {step} de {TOTAL}</div>
        </div>
      )}

      <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"24px 20px 32px", maxWidth:440, margin:"0 auto", width:"100%", animation:"fadeIn 0.3s ease" }}>

        {step===0 && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <img src="/logo.png" alt="Von Finance" style={{ height:56, marginBottom:18, alignSelf:"flex-start" }}/>
            <h1 style={{ fontSize:"1.5rem", fontWeight:800, color:TXT, margin:"0 0 10px", lineHeight:1.3 }}>
              {nome ? `Bem-vindo, ${nome}!` : "Bem-vindo ao Von Finance"}
            </h1>
            <p style={{ color:SUB, fontSize:"0.88rem", lineHeight:1.6, margin:"0 0 22px" }}>
              O Von Finance mostra quanto vai sobrar do seu dinheiro nos próximos meses — considerando suas parcelas, contas fixas e gastos do dia a dia. Tudo em um lugar só, sem planilha.
            </p>

            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
              {[
                { i:"📊", t:"Projeção mensal", d:"Veja o saldo previsto de cada mês à frente" },
                { i:"🧾", t:"Controle de parcelas", d:"Saiba quanto falta e quando cada dívida acaba" },
                { i:"💸", t:"Simulador de amortização", d:"Descubra a melhor forma de usar um dinheiro extra" },
                { i:"🔔", t:"Alertas inteligentes", d:"Seja avisado quando o mês apertar" },
              ].map(f=>(
                <div key={f.t} style={{ display:"flex", gap:12, alignItems:"flex-start", background:C.card, borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:"1.2rem", flexShrink:0 }}>{f.i}</span>
                  <div>
                    <div style={{ fontSize:"0.85rem", fontWeight:700, color:TXT }}>{f.t}</div>
                    <div style={{ fontSize:"0.73rem", color:SUB, marginTop:2, lineHeight:1.45 }}>{f.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}`, marginBottom:24 }}>
              <div style={{ fontSize:"0.65rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Vamos configurar juntos</div>
              {["Escolher o tema do app","Entender seu momento financeiro","Informar sua renda mensal","Escolher quais cartões você acompanha","Definir quando você quer ser alertado"].map((t,i)=>(
                <div key={t} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0" }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", background:C.surface, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.62rem", color:SUB, flexShrink:0 }}>{i+1}</div>
                  <span style={{ fontSize:"0.82rem", color:SUB }}>{t}</span>
                </div>
              ))}
              <div style={{ fontSize:"0.7rem", color:SUB, marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}`, lineHeight:1.5 }}>
                🔒 Nunca pedimos número de cartão, senha do banco ou qualquer dado bancário. Você só escolhe os apelidos dos cartões para organizar seus gastos.
              </div>
            </div>

            <button onClick={next} style={btnPri()}>Vamos começar →</button>
            <button onClick={finalizar} style={{ background:"none", border:"none", color:SUB, fontSize:"0.78rem", cursor:"pointer", fontFamily:"inherit", marginTop:12, padding:8 }}>Pular configuração</button>
          </div>
        )}

        {step===1 && (
          <>
            <div style={{ flex:1 }}>
              <h2 style={{ fontSize:"1.3rem", fontWeight:800, color:TXT, margin:"0 0 6px", lineHeight:1.3 }}>Escolha a aparência do app</h2>
              <p style={{ fontSize:"0.82rem", color:SUB, margin:"0 0 22px" }}>Você pode trocar quando quiser nas configurações</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { v:true, label:"Escuro", desc:"Melhor à noite", bg:"#0d1117", cardBg:"#161b22", txt:"#c9d1d9" },
                  { v:false, label:"Claro", desc:"Melhor de dia", bg:"#f6f8fa", cardBg:"#ffffff", txt:"#1f2328" },
                ].map(o=>(
                  <button key={String(o.v)} onClick={()=>setDark(o.v)}
                    style={{ background: dark===o.v ? `${C.primary}1f` : C.card, border:`2px solid ${dark===o.v ? C.primary : C.border}`, borderRadius:14, padding:14, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
                    <div style={{ background:o.bg, borderRadius:9, padding:8, marginBottom:10, border:`1px solid ${C.border}` }}>
                      <div style={{ background:o.cardBg, borderRadius:6, padding:"7px 8px", marginBottom:5 }}>
                        <div style={{ width:"55%", height:5, borderRadius:3, background:o.txt, opacity:0.85, marginBottom:4 }}/>
                        <div style={{ width:"75%", height:4, borderRadius:3, background:o.txt, opacity:0.35 }}/>
                      </div>
                      <div style={{ background:o.cardBg, borderRadius:6, padding:"7px 8px" }}>
                        <div style={{ width:"40%", height:5, borderRadius:3, background:"#2188c9", marginBottom:4 }}/>
                        <div style={{ width:"65%", height:4, borderRadius:3, background:o.txt, opacity:0.35 }}/>
                      </div>
                    </div>
                    <div style={{ fontSize:"0.88rem", fontWeight:700, color: dark===o.v ? C.primaryLight : TXT }}>{o.v ? "🌙" : "☀️"} {o.label}</div>
                    <div style={{ fontSize:"0.68rem", color:SUB, marginTop:2 }}>{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:24 }}>
              <button onClick={back} style={btnBack}>←</button>
              <button onClick={next} style={btnPri({ flex:1 })}>Continuar</button>
            </div>
          </>
        )}

        {step===2 && (
          <>
            <div style={{ flex:1 }}>
              <h2 style={{ fontSize:"1.3rem", fontWeight:800, color:TXT, margin:"0 0 6px", lineHeight:1.3 }}>Como está sua vida financeira?</h2>
              <p style={{ fontSize:"0.82rem", color:SUB, margin:"0 0 22px" }}>Assim personalizamos as dicas para você</p>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  { id:"apertado", i:"😰", t:"Apertado", d:"Tenho muitas parcelas e mal sobra dinheiro" },
                  { id:"equilibrado", i:"😐", t:"Equilibrado", d:"Consigo pagar tudo, mas sem folga" },
                  { id:"tranquilo", i:"😊", t:"Tranquilo", d:"Sobra dinheiro, quero organizar melhor" },
                  { id:"investindo", i:"📈", t:"Quero investir", d:"Preciso saber quanto posso guardar" },
                ].map(o=>(
                  <button key={o.id} onClick={()=>setDados(d=>({...d,situacao:o.id}))}
                    style={{ background: dados.situacao===o.id ? `${C.primary}1f` : C.card, border:`1px solid ${dados.situacao===o.id ? C.primary : C.border}`, borderRadius:14, padding:"14px 16px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:13, transition:"all 0.2s" }}>
                    <span style={{ fontSize:"1.5rem", flexShrink:0 }}>{o.i}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"0.88rem", fontWeight:700, color: dados.situacao===o.id ? C.primaryLight : TXT }}>{o.t}</div>
                      <div style={{ fontSize:"0.72rem", color:SUB, marginTop:2 }}>{o.d}</div>
                    </div>
                    {dados.situacao===o.id && <span style={{ color:C.primary, fontSize:"1.1rem" }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:24 }}>
              <button onClick={back} style={btnBack}>←</button>
              <button onClick={next} disabled={!dados.situacao} style={btnPri({ flex:1, opacity: dados.situacao?1:0.4 })}>Continuar</button>
            </div>
          </>
        )}

        {step===3 && (
          <>
            <div style={{ flex:1 }}>
              <h2 style={{ fontSize:"1.3rem", fontWeight:800, color:TXT, margin:"0 0 6px", lineHeight:1.3 }}>Qual sua renda mensal?</h2>
              <p style={{ fontSize:"0.82rem", color:SUB, margin:"0 0 8px" }}>É a base do cálculo de quanto sobra</p>
              <div style={{ fontSize:"0.7rem", color:SUB, background:C.surface, borderRadius:8, padding:"9px 12px", border:`1px solid ${C.border}`, marginBottom:20 }}>
                🔒 Fica salvo apenas na sua conta, criptografado
              </div>
              <input type="number" placeholder="Ex: 4500" value={dados.salario}
                onChange={e=>setDados(d=>({...d,salario:e.target.value}))}
                style={inp({ fontSize:"1.3rem", fontWeight:700, textAlign:"center", padding:"18px" })}/>
              {dados.salario && (
                <div style={{ background:C.card, borderRadius:12, padding:"14px 16px", border:`1px solid ${C.border}`, marginTop:14, textAlign:"center", animation:"fadeIn 0.25s ease" }}>
                  <div style={{ fontSize:"0.68rem", color:SUB, marginBottom:3 }}>Sua renda mensal</div>
                  <div style={{ fontSize:"1.4rem", fontWeight:800, color:C.green }}>{fmt(dados.salario)}</div>
                </div>
              )}
              <p style={{ fontSize:"0.72rem", color:SUB, marginTop:14, lineHeight:1.5 }}>
                💡 Você pode adicionar entradas extras depois (13º, freelas, bônus)
              </p>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:24 }}>
              <button onClick={back} style={btnBack}>←</button>
              <button onClick={next} disabled={!dados.salario} style={btnPri({ flex:1, opacity: dados.salario?1:0.4 })}>Continuar</button>
            </div>
          </>
        )}

        {step===4 && (
          <>
            <div style={{ flex:1 }}>
              <h2 style={{ fontSize:"1.3rem", fontWeight:800, color:TXT, margin:"0 0 6px", lineHeight:1.3 }}>Onde você costuma gastar?</h2>
              <p style={{ fontSize:"0.82rem", color:SUB, margin:"0 0 12px" }}>Escolha os cartões que quer acompanhar</p>
              <div style={{ fontSize:"0.7rem", color:SUB, background:C.surface, borderRadius:8, padding:"9px 12px", border:`1px solid ${C.border}`, marginBottom:18, lineHeight:1.5 }}>
                🔒 É só o apelido, para organizar seus gastos. Nunca pedimos número, senha ou qualquer dado do cartão.
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                {BANCOS.map(b=>{
                  const sel = !!dados.cartoes.find(c=>c.nome===b.nome);
                  return (
                    <button key={b.nome} onClick={()=>toggleCartao(b)}
                      style={{ background: sel ? `${C.primary}1f` : C.card, border:`1px solid ${sel ? C.primary : C.border}`, borderRadius:12, padding:"12px 10px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:10, transition:"all 0.2s" }}>
                      <div style={{ width:32, height:32, borderRadius:9, background:b.bg, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                        <img src={b.logo} alt={b.nome} style={{ width:"75%", height:"75%", objectFit:"contain" }}
                          onError={e=>{ e.target.style.display="none"; e.target.parentNode.innerHTML=`<span style="color:#fff;font-size:14px;font-weight:800">${b.nome[0]}</span>`; }}/>
                      </div>
                      <span style={{ fontSize:"0.8rem", fontWeight:600, color: sel ? C.primaryLight : TXT, flex:1, textAlign:"left" }}>{b.nome}</span>
                      {sel && <span style={{ color:C.primary, fontSize:"0.85rem" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
              {dados.cartoes.length>0 && (
                <div style={{ marginTop:16, fontSize:"0.78rem", color:C.green, textAlign:"center", animation:"fadeIn 0.2s ease" }}>
                  ✓ {dados.cartoes.length} selecionado(s)
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:24 }}>
              <button onClick={back} style={btnBack}>←</button>
              <button onClick={next} style={btnPri({ flex:1 })}>{dados.cartoes.length ? "Continuar" : "Pular por agora"}</button>
            </div>
          </>
        )}

        {step===5 && (
          <>
            <div style={{ flex:1 }}>
              <h2 style={{ fontSize:"1.3rem", fontWeight:800, color:TXT, margin:"0 0 6px", lineHeight:1.3 }}>Quer receber alertas?</h2>
              <p style={{ fontSize:"0.82rem", color:SUB, margin:"0 0 20px" }}>Avisamos quando seus gastos passarem do limite que você definir</p>

              {/* Toggle principal */}
              <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${dados.alertasAtivos ? C.primary+"55" : C.border}`, marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.88rem", fontWeight:700, color:TXT }}>
                      {dados.alertasAtivos ? "🔔 Alertas ativados" : "🔕 Alertas desativados"}
                    </div>
                    <div style={{ fontSize:"0.73rem", color:SUB, marginTop:3, lineHeight:1.5 }}>
                      {dados.alertasAtivos
                        ? "Você será avisado quando o mês apertar"
                        : "Você não receberá nenhum aviso automático"}
                    </div>
                  </div>
                  <button onClick={()=>setDados(d=>({...d, alertasAtivos: !d.alertasAtivos}))}
                    style={{ width:48, height:27, borderRadius:14, border:"none", cursor:"pointer", flexShrink:0, position:"relative",
                      background: dados.alertasAtivos ? C.green : C.border, transition:"background 0.2s" }}>
                    <span style={{ position:"absolute", top:3, left: dados.alertasAtivos ? 24 : 3, width:21, height:21, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                  </button>
                </div>
              </div>

              {/* Sliders só se ativo */}
              {dados.alertasAtivos ? (
                <div style={{ animation:"fadeIn 0.25s ease" }}>
                  <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}`, marginBottom:14 }}>
                    <div style={{ fontSize:"0.66rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:14 }}>
                      Quanto da renda pode estar comprometida
                    </div>
                    <div style={{ marginBottom:18 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <span style={{ fontSize:"0.8rem", fontWeight:700, color:C.green }}>💚 Ainda saudável até</span>
                        <span style={{ fontSize:"0.95rem", fontWeight:800, color:C.green }}>{dados.alertas.saudavel}%</span>
                      </div>
                      <input type="range" min={30} max={85} value={dados.alertas.saudavel}
                        onChange={e=>{ const v=parseInt(e.target.value); setDados(d=>({...d, alertas:{ saudavel:v, atencao: Math.max(v+5, d.alertas.atencao) }})); }}
                        style={{ width:"100%", accentColor:C.green }}/>
                    </div>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <span style={{ fontSize:"0.8rem", fontWeight:700, color:C.yellow }}>🟡 Atenção até</span>
                        <span style={{ fontSize:"0.95rem", fontWeight:800, color:C.yellow }}>{dados.alertas.atencao}%</span>
                      </div>
                      <input type="range" min={dados.alertas.saudavel+5} max={99} value={dados.alertas.atencao}
                        onChange={e=>setDados(d=>({...d, alertas:{...d.alertas, atencao: parseInt(e.target.value)}}))}
                        style={{ width:"100%", accentColor:C.yellow }}/>
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                    {[
                      { l:"💚 Saudável", ex:`até ${dados.alertas.saudavel}%`, cor:C.green },
                      { l:"🟡 Atenção", ex:`${dados.alertas.saudavel}–${dados.alertas.atencao}%`, cor:C.yellow },
                      { l:"🔴 Crítico", ex:`+${dados.alertas.atencao}%`, cor:C.red },
                    ].map(s=>(
                      <div key={s.l} style={{ background:`${s.cor}15`, borderRadius:10, padding:"10px 8px", textAlign:"center", border:`1px solid ${s.cor}33` }}>
                        <div style={{ fontSize:"0.68rem", fontWeight:700, color:s.cor, marginBottom:3 }}>{s.l}</div>
                        <div style={{ fontSize:"0.62rem", color:SUB }}>{s.ex}</div>
                      </div>
                    ))}
                  </div>

                  {dados.salario && (
                    <div style={{ background:C.surface, borderRadius:10, padding:"11px 13px", border:`1px solid ${C.border}`, fontSize:"0.75rem", color:SUB, lineHeight:1.5 }}>
                      Com renda de <strong style={{ color:TXT }}>{fmt(dados.salario)}</strong>, você será alertado quando os gastos passarem de <strong style={{ color:C.yellow }}>{fmt(Number(dados.salario)*dados.alertas.saudavel/100)}</strong>.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background:C.surface, borderRadius:12, padding:"16px", border:`1px solid ${C.border}`, textAlign:"center", animation:"fadeIn 0.25s ease" }}>
                  <div style={{ fontSize:"1.6rem", marginBottom:8, opacity:0.6 }}>🔕</div>
                  <div style={{ fontSize:"0.82rem", color:TXT, fontWeight:600, marginBottom:5 }}>Sem alertas por enquanto</div>
                  <div style={{ fontSize:"0.75rem", color:SUB, lineHeight:1.5 }}>
                    Você ainda verá o indicador de saúde no topo do app. Pode ativar os alertas quando quiser em Cadastros.
                  </div>
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:24 }}>
              <button onClick={back} style={btnBack}>←</button>
              <button onClick={next} style={btnPri({ flex:1 })}>Finalizar</button>
            </div>
          </>
        )}

        {step===6 && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", textAlign:"center" }}>
            <div style={{ fontSize:"3.5rem", marginBottom:16, animation:"pop 0.5s ease" }}>🎉</div>
            <h1 style={{ fontSize:"1.5rem", fontWeight:800, color:TXT, margin:"0 0 10px" }}>Tudo pronto!</h1>
            <p style={{ color:SUB, fontSize:"0.88rem", lineHeight:1.6, margin:"0 0 28px" }}>
              Sua conta está configurada.<br/>Bora ver quanto sobra no seu mês?
            </p>
            <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}`, marginBottom:24, textAlign:"left" }}>
              <div style={{ fontSize:"0.65rem", color:SUB, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Resumo</div>
              {[
                { l:"Tema", v: dark ? "🌙 Escuro" : "☀️ Claro", c:TXT },
                { l:"Renda mensal", v: dados.salario ? fmt(dados.salario) : "Não informada", c: dados.salario ? C.green : SUB },
                { l:"Cartões", v: dados.cartoes.length ? `${dados.cartoes.length} selecionado(s)` : "Nenhum", c: dados.cartoes.length ? C.primary : SUB },
                { l:"Alertas", v: dados.alertasAtivos ? `A partir de ${dados.alertas.saudavel}%` : "Desativados", c: dados.alertasAtivos ? C.yellow : SUB },
              ].map((r,i,arr)=>(
                <div key={r.l} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom: i<arr.length-1 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize:"0.8rem", color:SUB }}>{r.l}</span>
                  <span style={{ fontSize:"0.82rem", fontWeight:700, color:r.c }}>{r.v}</span>
                </div>
              ))}
            </div>
            {!trialUsadoAnteriormente ? (
              <div style={{ background:`linear-gradient(135deg,${C.primary}18,${C.purple||C.primary}18)`, border:`1px solid ${C.primary}44`, borderRadius:14, padding:16, marginBottom:16, textAlign:"left" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:"1.1rem" }}>🎁</span>
                  <span style={{ fontSize:"0.86rem", fontWeight:800, color:C.primaryLight }}>30 dias grátis do plano Pro</span>
                </div>
                <div style={{ fontSize:"0.78rem", color:SUB, lineHeight:1.55, marginBottom:10 }}>
                  Você já pode usar tudo sem limite: cartões, parcelas, categorias, simulador e alertas ilimitados. Sem cobrança agora e sem cartão de crédito.
                </div>
                <div style={{ fontSize:"0.72rem", color:SUB, background:C.surface, borderRadius:9, padding:"8px 10px", lineHeight:1.5 }}>
                  Depois dos 30 dias, o plano Pro custa <strong style={{color:TXT}}>{fmtPreco(planoPro.precoMensal)}/mês</strong>. Se preferir, pode continuar no plano gratuito com uso limitado — sem cobrança nenhuma.
                </div>
              </div>
            ) : (
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:16, marginBottom:16, textAlign:"left" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:"1.1rem" }}>👋</span>
                  <span style={{ fontSize:"0.86rem", fontWeight:800, color:TXT }}>Você está no plano gratuito</span>
                </div>
                <div style={{ fontSize:"0.78rem", color:SUB, lineHeight:1.55 }}>
                  Já dá pra usar o essencial sem custo. Se quiser cartões, parcelas e recursos sem limite, o plano Pro custa <strong style={{color:TXT}}>{fmtPreco(planoPro.precoMensal)}/mês</strong> — pode assinar quando quiser em Gerenciar Conta.
                </div>
              </div>
            )}

            <div style={{ background:`${C.primary}12`, border:`1px solid ${C.primary}33`, borderRadius:12, padding:"12px 14px", marginBottom:24, textAlign:"left" }}>
              <div style={{ fontSize:"0.75rem", fontWeight:700, color:C.primaryLight, marginBottom:6 }}>💡 Dica</div>
              <div style={{ fontSize:"0.78rem", color:SUB, lineHeight:1.5 }}>
                Ao entrar em cada tela pela primeira vez, um guia rápido vai te explicar como usar.
              </div>
            </div>
            <button onClick={finalizar} style={btnPri()}>Ver minha projeção 🚀</button>
          </div>
        )}
      </div>
    </div>
  );
}
