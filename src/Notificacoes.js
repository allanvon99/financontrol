import { useMemo } from "react";

const fmt = (v) => Number(v||0).toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });

export function SinoIcon({ size=20, cor="#8b949e" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

// Gera notificações a partir dos dados reais do usuário
export function gerarNotificacoes({ projecao, saudeConfig, parcelas, fixos, salario, lidas={} }) {
  const ativos = saudeConfig?.ativos !== false;
  if (!ativos || !projecao?.length) return [];

  const lim = { saudavel: saudeConfig?.saudavel ?? 60, atencao: saudeConfig?.atencao ?? 80 };
  const notifs = [];

  // ── 1) Uma única notificação sobre o mês atual ──
  const atual = projecao[0];
  if (atual?.receita) {
    const pct = Math.round((atual.gastos / atual.receita) * 100);

    // Quantos meses futuros também estouram (para o complemento)
    const futurosRuins = projecao.slice(1, 12).filter(m => {
      if (!m.receita) return false;
      return m.sobra < 0 || (m.gastos / m.receita) * 100 > lim.atencao;
    });

    // O que mais pesa no mês
    const totalFixos = (fixos||[]).reduce((s,f)=>s+Number(f.valor||0),0);
    const totalParc = atual.totalParc || 0;
    const totalExtra = atual.totalExtra || 0;
    let vilao = null;
    const maior = Math.max(totalFixos, totalParc, totalExtra);
    if (maior > 0) {
      if (maior === totalParc) vilao = { nome:"parcelas", valor:totalParc, recorrente:true };
      else if (maior === totalFixos) vilao = { nome:"gastos fixos", valor:totalFixos, recorrente:true };
      else vilao = { nome:"gastos do mês", valor:totalExtra, recorrente:false };
    }

    let tipo, titulo, texto;

    if (atual.sobra < 0) {
      tipo = "critico";
      titulo = `${atual.label} está no vermelho`;
      texto = `Sua projeção fecha com ${fmt(Math.abs(atual.sobra))} negativos.`;
    } else if (pct > lim.atencao) {
      tipo = "critico";
      titulo = `${pct}% da sua renda comprometida`;
      texto = `Em ${atual.label} você passou do limite crítico de ${lim.atencao}% que definiu. Sobram ${fmt(atual.sobra)}.`;
    } else if (pct > lim.saudavel) {
      tipo = "atencao";
      titulo = `${pct}% da sua renda comprometida`;
      texto = `Em ${atual.label} você passou do limite de atenção de ${lim.saudavel}%. Sobram ${fmt(atual.sobra)}.`;
    } else {
      tipo = "saudavel";
      titulo = "Seu mês está saudável";
      texto = `${atual.label} tem ${fmt(atual.sobra)} de sobra prevista, com ${pct}% da renda comprometida.`;
    }

    // Complemento: o que puxa e se impacta o futuro
    if (tipo !== "saudavel" && vilao) {
      texto += ` O que mais pesa são as ${vilao.nome} (${fmt(vilao.valor)}).`;
      if (vilao.recorrente && futurosRuins.length > 0) {
        texto += ` Como esse valor se repete, os próximos ${futurosRuins.length} mês(es) também ficam apertados.`;
      } else if (vilao.recorrente) {
        texto += ` Esse valor se repete nos próximos meses.`;
      }
    }

    const id = `mes-${atual.mes}-${atual.ano}-${tipo}-${pct}`;
    notifs.push({ id, tipo, titulo, texto, ordem:0, lida: !!lidas[id] });
  }

  // ── 2) Parcelas terminando (agrupadas em uma só) ──
  const terminando = (parcelas||[]).filter(p=>{
    const r = Number(p.parcelasRestantes ?? p.parcelas);
    return r > 0 && r <= 2;
  });

  if (terminando.length > 0) {
    const libera = terminando.reduce((s,p)=>s+Number(p.valor||0),0);
    const id = `parc-fim-${terminando.map(p=>p.id).join("-")}`;
    notifs.push({
      id, tipo:"info",
      titulo: terminando.length === 1 ? "Uma parcela está acabando" : `${terminando.length} parcelas estão acabando`,
      texto: terminando.length === 1
        ? `${terminando[0].nome} (${terminando[0].grupo}) tem ${Number(terminando[0].parcelasRestantes ?? terminando[0].parcelas)} parcela(s) restante(s). Em breve você libera ${fmt(libera)} por mês.`
        : `Em breve você libera ${fmt(libera)} por mês no seu orçamento.`,
      ordem:1, lida: !!lidas[id],
    });
  }

  return notifs;
}

export default function Notificacoes({ C, notificacoes, alertasAtivos, onVoltar, onMarcarLida, onMarcarTodas, onIrCadastros }) {
  const TXT = C.grayLight || C.text;
  const SUB = C.gray || C.textSub;

  const estilos = {
    critico:  { cor:C.red,     icone:"⚠️" },
    atencao:  { cor:C.yellow,  icone:"🟡" },
    info:     { cor:C.primary, icone:"ℹ️" },
    saudavel: { cor:C.green,   icone:"✅" },
  };

  const naoLidas = notificacoes.filter(n=>!n.lida).length;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, animation:"slideIn 0.25s ease" }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:600, margin:"0 auto", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onVoltar} style={{ background:"none", border:"none", color:TXT, fontSize:"1.3rem", cursor:"pointer", padding:0, lineHeight:1 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"1rem", fontWeight:800, color:TXT }}>Notificações</div>
            {naoLidas>0 && <div style={{ fontSize:"0.68rem", color:SUB }}>{naoLidas} não lida(s)</div>}
          </div>
          {naoLidas>0 && (
            <button onClick={onMarcarTodas} style={{ background:"none", border:"none", color:C.primaryLight, fontSize:"0.73rem", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
              Marcar todas
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"16px" }}>
        {!alertasAtivos && (
          <div style={{ background:`${C.yellow}12`, border:`1px solid ${C.yellow}44`, borderRadius:13, padding:"14px 16px", marginBottom:16, display:"flex", gap:12, alignItems:"flex-start" }}>
            <span style={{ fontSize:"1.1rem" }}>🔕</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"0.82rem", fontWeight:700, color:C.yellow, marginBottom:3 }}>Alertas desativados</div>
              <div style={{ fontSize:"0.75rem", color:SUB, lineHeight:1.5, marginBottom:10 }}>
                Você optou por não receber avisos de saúde financeira. Ative para ser notificado quando o mês apertar.
              </div>
              <button onClick={onIrCadastros} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:TXT, padding:"7px 12px", fontSize:"0.73rem", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                Configurar alertas
              </button>
            </div>
          </div>
        )}

        {notificacoes.length===0 ? (
          <div style={{ textAlign:"center", padding:"70px 20px", color:SUB }}>
            <div style={{ marginBottom:14, opacity:0.5, display:"flex", justifyContent:"center" }}><SinoIcon size={44} cor={SUB}/></div>
            <div style={{ fontSize:"0.9rem", fontWeight:600, color:TXT, marginBottom:5 }}>Nenhuma notificação</div>
            <div style={{ fontSize:"0.78rem", lineHeight:1.5 }}>Quando algo precisar da sua atenção,<br/>avisamos por aqui.</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {notificacoes.map(n=>{
              const e = estilos[n.tipo] || estilos.info;
              return (
                <div key={n.id} onClick={()=>onMarcarLida(n.id)}
                  style={{ background:C.card, borderRadius:13, border:`1px solid ${n.lida ? C.border : e.cor+"55"}`, padding:"14px 15px", cursor:"pointer", position:"relative", overflow:"hidden" }}>
                  {!n.lida && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:e.cor }}/>}
                  <div style={{ display:"flex", gap:11, alignItems:"flex-start" }}>
                    <div style={{ width:36, height:36, borderRadius:11, background:`${e.cor}1a`, border:`1px solid ${e.cor}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>
                      {e.icone}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
                        <span style={{ fontSize:"0.86rem", fontWeight: n.lida?600:800, color:TXT }}>{n.titulo}</span>
                        {!n.lida && <span style={{ width:6, height:6, borderRadius:"50%", background:e.cor, flexShrink:0 }}/>}
                      </div>
                      <div style={{ fontSize:"0.76rem", color:SUB, lineHeight:1.55 }}>{n.texto}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
