import { useState } from "react";

const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Assistente({ parcelas, fixos, extras, salario, extrasReceita, dark = true }) {
  const C = dark ? {
    bg:"#0d1117", card:"#161b22", border:"#21262d", surface:"#1c2128",
    text:"#c9d1d9", textSub:"#8b949e", primary:"#2188c9", primaryLight:"#58a6ff",
    green:"#3fb950", red:"#f85149", yellow:"#d29922", orange:"#e06c1a", purple:"#a78bfa",
  } : {
    bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", surface:"#f6f8fa",
    text:"#1f2328", textSub:"#57606a", primary:"#0969da", primaryLight:"#0969da",
    green:"#1a7f37", red:"#d1242f", yellow:"#9a6700", orange:"#bc4c00", purple:"#6639ba",
  };

  const [step, setStep] = useState("menu"); // menu | valor | tipo | resultado
  const [valor, setValor] = useState("");
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  const totalFixos = fixos.reduce((s, f) => s + Number(f.valor), 0);
  const totalParcelasMes = parcelas.reduce((s, p) => s + Number(p.valor), 0);
  const totalExtrasMes = extras.filter(e => e.mes === 0).reduce((s, e) => s + Number(e.valor), 0);
  const totalGastos = totalFixos + totalParcelasMes + totalExtrasMes;
  const saldoMes = salario - totalGastos;

  const chamarClaude = async (tipo) => {
    setLoading(true);
    setStep("resultado");

    const valorNum = parseFloat(valor);

    const parcelasInfo = parcelas.map(p => ({
      nome: p.nome,
      cartao: p.grupo,
      valorMensal: Number(p.valor),
      parcelasRestantes: Number(p.parcelas),
      totalRestante: Number(p.valor) * Number(p.parcelas),
    }));

    const contexto = `
Dados financeiros do usuário:
- Salário mensal: ${fmt(salario)}
- Total gastos fixos/mês: ${fmt(totalFixos)}
- Total parcelas/mês: ${fmt(totalParcelasMes)}
- Gastos extras do mês: ${fmt(totalExtrasMes)}
- Saldo estimado do mês: ${fmt(saldoMes)}
- Valor disponível para amortização: ${fmt(valorNum)}

Parcelas ativas:
${parcelasInfo.map(p => `- ${p.nome} (${p.cartao}): R$ ${p.valorMensal.toFixed(2)}/mês, ${p.parcelasRestantes} parcelas restantes, total restante: R$ ${p.totalRestante.toFixed(2)}`).join("\n")}

Objetivo do usuário: ${tipo === "prazo" ? "Terminar de pagar as parcelas que vão levar mais tempo — reduzir o prazo total das dívidas" : "Liberar mais dinheiro por mês imediatamente — reduzir o valor das parcelas mensais"}
`;

    const prompt = tipo === "prazo"
      ? `${contexto}

O usuário quer usar ${fmt(valorNum)} para amortizar parcelas com foco em REDUZIR O PRAZO (terminar de pagar mais rápido as que vão durar mais tempo).

Faça uma análise e responda em JSON com exatamente esta estrutura:
{
  "titulo": "string — título curto da recomendação",
  "recomendacao_principal": "string — qual parcela amortizar e por quê (2-3 frases diretas)",
  "cards": [
    {"label": "string", "valor": "string", "destaque": true/false},
    {"label": "string", "valor": "string", "destaque": false},
    {"label": "string", "valor": "string", "destaque": false},
    {"label": "string", "valor": "string", "destaque": false}
  ],
  "dica_final": "string — uma dica prática adicional (1-2 frases)"
}
Responda APENAS com o JSON, sem texto adicional.`
      : `${contexto}

O usuário quer usar ${fmt(valorNum)} para amortizar parcelas com foco em LIBERAR MAIS DINHEIRO POR MÊS IMEDIATAMENTE (reduzir o valor das parcelas mensais).

Faça uma análise e responda em JSON com exatamente esta estrutura:
{
  "titulo": "string — título curto da recomendação",
  "recomendacao_principal": "string — qual parcela amortizar e por quê (2-3 frases diretas)",
  "cards": [
    {"label": "string", "valor": "string", "destaque": true/false},
    {"label": "string", "valor": "string", "destaque": false},
    {"label": "string", "valor": "string", "destaque": false},
    {"label": "string", "valor": "string", "destaque": false}
  ],
  "dica_final": "string — uma dica prática adicional (1-2 frases)"
}
Responda APENAS com o JSON, sem texto adicional.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResultado({ ...parsed, cor: tipo === "prazo" ? C.green : C.primary });
    } catch (e) {
      setResultado({
        titulo: "Erro na análise",
        recomendacao_principal: "Não foi possível processar a análise. Verifique sua conexão e tente novamente.",
        cards: [],
        dica_final: "",
        cor: C.red,
      });
    }

    setLoading(false);
  };

  const voltar = () => {
    setStep("menu");
    setValor("");
    setResultado(null);
  };

  const inp = { width:"100%", padding:"14px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:"1rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const btnBack = { background:"none", border:"none", color:C.textSub, cursor:"pointer", fontSize:"0.8rem", fontFamily:"inherit", marginBottom:16, display:"flex", alignItems:"center", gap:4, padding:0 };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>

      {/* MENU */}
      {step==="menu" && (
        <div>
          {/* Card do assistente */}
          <div style={{ background:C.card, borderRadius:14, padding:"16px", border:`1px solid ${C.border}`, marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:48, height:48, borderRadius:"50%", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>🤖</div>
            <div>
              <div style={{ fontSize:"0.92rem", fontWeight:800, color:C.text }}>Assistente Financeiro</div>
              <div style={{ fontSize:"0.7rem", color:C.textSub, marginTop:2 }}>Análise personalizada com seus dados reais · Powered by Claude AI</div>
            </div>
          </div>

          <p style={{ fontSize:"0.8rem", color:C.textSub, marginBottom:12 }}>O que você quer calcular?</p>

          <button onClick={()=>setStep("valor")} style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 16px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:14, transition:"all 0.2s" }}>
            <div style={{ width:52, height:52, borderRadius:14, background:`${C.primary}22`, border:`1px solid ${C.primary}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.5rem", flexShrink:0 }}>💰</div>
            <div>
              <div style={{ fontSize:"0.9rem", fontWeight:700, color:C.text, marginBottom:4 }}>Amortização de Parcelas</div>
              <div style={{ fontSize:"0.72rem", color:C.textSub, lineHeight:1.5 }}>Simule o impacto de usar um valor disponível para quitar parte das suas dívidas e veja qual estratégia faz mais sentido para você.</div>
            </div>
            <span style={{ color:C.textSub, fontSize:"1.2rem", flexShrink:0 }}>›</span>
          </button>
        </div>
      )}

      {/* INSERIR VALOR */}
      {step==="valor" && (
        <div>
          <button onClick={voltar} style={btnBack}>← Voltar</button>

          <div style={{ background:C.card, borderRadius:14, padding:"16px", border:`1px solid ${C.border}`, marginBottom:16 }}>
            <div style={{ fontSize:"0.7rem", color:C.textSub, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Seu saldo estimado este mês</div>
            <div style={{ fontSize:"1.4rem", fontWeight:800, color:saldoMes>=0?C.green:C.red }}>{fmt(saldoMes)}</div>
          </div>

          <h3 style={{ fontSize:"0.92rem", fontWeight:800, color:C.text, marginBottom:4 }}>Quanto você tem para amortizar?</h3>
          <p style={{ fontSize:"0.76rem", color:C.textSub, marginBottom:14 }}>Informe o valor disponível — pode ser uma reserva, 13º, bônus ou qualquer entrada extra.</p>

          <input type="number" placeholder="Ex: 2.000" value={valor}
            onChange={e=>setValor(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&valor&&setStep("tipo")}
            style={inp}/>

          {valor && (
            <button onClick={()=>setStep("tipo")} style={{ width:"100%", marginTop:12, padding:"13px", borderRadius:10, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, fontSize:"0.88rem", cursor:"pointer", fontFamily:"inherit" }}>
              Continuar →
            </button>
          )}
        </div>
      )}

      {/* ESCOLHER ESTRATÉGIA */}
      {step==="tipo" && (
        <div>
          <button onClick={()=>setStep("valor")} style={btnBack}>← Voltar</button>

          <div style={{ background:C.card, borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}`, marginBottom:20, display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:"0.8rem", color:C.textSub }}>Valor para amortizar</span>
            <span style={{ fontSize:"0.88rem", fontWeight:800, color:C.primary }}>{fmt(parseFloat(valor))}</span>
          </div>

          <h3 style={{ fontSize:"0.92rem", fontWeight:800, color:C.text, marginBottom:4 }}>Qual é o seu objetivo?</h3>
          <p style={{ fontSize:"0.76rem", color:C.textSub, marginBottom:16 }}>Escolha a estratégia que faz mais sentido para o seu momento financeiro agora.</p>

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <button onClick={()=>chamarClaude("prazo")} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 16px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", gap:14, alignItems:"flex-start" }}>
              <div style={{ width:48, height:48, borderRadius:14, background:`${C.green}22`, border:`1px solid ${C.green}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", flexShrink:0 }}>⏱️</div>
              <div>
                <div style={{ fontSize:"0.88rem", fontWeight:800, color:C.text, marginBottom:4 }}>Quero terminar de pagar o mais rápido possível</div>
                <div style={{ fontSize:"0.72rem", color:C.textSub, lineHeight:1.5 }}>Foco em eliminar as parcelas que ainda vão durar mais tempo. Você fica livre das dívidas mais cedo, mesmo que a parcela mensal continue igual por agora.</div>
                <div style={{ marginTop:8, fontSize:"0.68rem", color:C.green, fontWeight:600 }}>✓ Ideal para quem quer se livrar das dívidas logo</div>
              </div>
            </button>

            <button onClick={()=>chamarClaude("mensal")} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 16px", cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", gap:14, alignItems:"flex-start" }}>
              <div style={{ width:48, height:48, borderRadius:14, background:`${C.primary}22`, border:`1px solid ${C.primary}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", flexShrink:0 }}>💸</div>
              <div>
                <div style={{ fontSize:"0.88rem", fontWeight:800, color:C.text, marginBottom:4 }}>Meu foco é sobrar mais dinheiro todo mês</div>
                <div style={{ fontSize:"0.72rem", color:C.textSub, lineHeight:1.5 }}>Foco em reduzir o valor que sai da conta mensalmente. Você sente o alívio no bolso já no próximo mês, com mais espaço no orçamento.</div>
                <div style={{ marginTop:8, fontSize:"0.68rem", color:C.primary, fontWeight:600 }}>✓ Ideal para quem precisa de fôlego imediato no orçamento</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ textAlign:"center", padding:"50px 0" }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width:40, height:40, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.primary}`, borderRadius:"50%", margin:"0 auto 16px", animation:"spin 0.8s linear infinite" }}/>
          <p style={{ color:C.text, fontSize:"0.88rem", fontWeight:600, marginBottom:4 }}>Claude está analisando...</p>
          <p style={{ color:C.textSub, fontSize:"0.75rem" }}>Calculando a melhor estratégia com seus dados reais</p>
        </div>
      )}

      {/* RESULTADO */}
      {step==="resultado" && resultado && !loading && (
        <div style={{ animation:"fadeIn 0.3s ease" }}>
          <button onClick={voltar} style={btnBack}>← Nova consulta</button>

          <div style={{ background:C.card, borderRadius:16, border:`1px solid ${resultado.cor}44`, overflow:"hidden" }}>
            <div style={{ height:4, background:`linear-gradient(90deg,${resultado.cor},${resultado.cor}44)` }}/>
            <div style={{ padding:"16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>🤖</div>
                <div>
                  <div style={{ fontSize:"0.88rem", fontWeight:800, color:resultado.cor }}>{resultado.titulo}</div>
                  <div style={{ fontSize:"0.65rem", color:C.textSub }}>Análise baseada nos seus dados reais</div>
                </div>
              </div>

              <p style={{ fontSize:"0.82rem", color:C.text, lineHeight:1.6, marginBottom:16 }}>{resultado.recomendacao_principal}</p>

              {resultado.cards?.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
                  {resultado.cards.map((card, i) => (
                    <div key={i} style={{ background:C.surface, borderRadius:10, padding:"10px 12px", border:`1px solid ${card.destaque?resultado.cor+"55":C.border}` }}>
                      <div style={{ fontSize:"0.62rem", color:C.textSub, marginBottom:3 }}>{card.label}</div>
                      <div style={{ fontSize:"0.85rem", fontWeight:card.destaque?800:600, color:card.destaque?resultado.cor:C.text }}>{card.valor}</div>
                    </div>
                  ))}
                </div>
              )}

              {resultado.dica_final && (
                <div style={{ background:C.surface, borderRadius:10, padding:"12px 14px", border:`1px solid ${C.border}`, borderLeft:`3px solid ${resultado.cor}` }}>
                  <div style={{ fontSize:"0.65rem", color:C.textSub, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>💡 Dica adicional</div>
                  <p style={{ fontSize:"0.78rem", color:C.text, margin:0, lineHeight:1.5 }}>{resultado.dica_final}</p>
                </div>
              )}
            </div>
          </div>

          <button onClick={voltar} style={{ width:"100%", marginTop:12, padding:"12px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit", fontSize:"0.82rem" }}>
            Fazer outra consulta
          </button>
        </div>
      )}
    </div>
  );
}
