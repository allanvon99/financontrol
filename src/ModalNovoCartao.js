import { useState } from "react";

const BANCOS_DISPONIVEIS = [
  { nome:"Nubank", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Nubank_logo_2021.svg/1200px-Nubank_logo_2021.svg.png", bg:"#8A05BE" },
  { nome:"Itaú", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Banco_Ita%C3%BA_logo.svg/1200px-Banco_Ita%C3%BA_logo.svg.png", bg:"#EC7000" },
  { nome:"Bradesco", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Bradesco_logo.svg/1200px-Bradesco_logo.svg.png", bg:"#CC092F" },
  { nome:"Santander", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Santander_logo.svg/1200px-Santander_logo.svg.png", bg:"#EA1D25" },
  { nome:"Caixa", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Caixa_Econ%C3%B4mica_Federal_logo.svg/1200px-Caixa_Econ%C3%B4mica_Federal_logo.svg.png", bg:"#0070AF" },
  { nome:"Banco do Brasil", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Banco_do_Brasil_logo.svg/1200px-Banco_do_Brasil_logo.svg.png", bg:"#FFCC00" },
  { nome:"Inter", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Banco_inter_logo.svg/1200px-Banco_inter_logo.svg.png", bg:"#FF7A00" },
  { nome:"C6 Bank", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/C6_Bank.svg/1200px-C6_Bank.svg.png", bg:"#242424" },
  { nome:"PicPay", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/PicPay_logo.svg/1200px-PicPay_logo.svg.png", bg:"#11C76F" },
  { nome:"Carrefour", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Carrefour.svg/1200px-Carrefour.svg.png", bg:"#003CB5" },
  { nome:"Mercado Pago", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Mercado_Pago_logo.svg/1200px-Mercado_Pago_logo.svg.png", bg:"#009EE3" },
  { nome:"Leroy Merlin", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Leroy_Merlin.svg/1200px-Leroy_Merlin.svg.png", bg:"#67A318" },
  { nome:"Americanas", logo:"https://upload.wikimedia.org/wikipedia/commons/thumb/6/sixty/Logo_Americanas.svg/1200px-Logo_Americanas.svg.png", bg:"#E30613" },
];

export { BANCOS_DISPONIVEIS };

export default function ModalNovoCartao({ onClose, onAdd, C, cartoesJaCadastrados = [] }) {
  const [step, setStep] = useState(1);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState(null);
  const [nomeCustom, setNomeCustom] = useState("");
  const [custom, setCustom] = useState(false);

  const disponiveis = BANCOS_DISPONIVEIS.filter(b =>
    !cartoesJaCadastrados.includes(b.nome) &&
    b.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const confirmar = () => {
    if (custom && nomeCustom.trim()) {
      onAdd({ nome: nomeCustom.trim(), logo: null, bg: "#444" });
      onClose();
    } else if (selecionado) {
      onAdd(selecionado);
      onClose();
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, borderRadius:"20px 20px 0 0", padding:"16px 16px 32px", width:"100%", maxWidth:500, maxHeight:"80vh", display:"flex", flexDirection:"column", animation:"slideUp 0.3s ease" }}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

        <div style={{ width:40, height:4, borderRadius:2, background:C.border, margin:"0 auto 16px" }}/>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ fontSize:"1rem", fontWeight:800, color:C.text, margin:0 }}>
            {step===1 ? "Adicionar cartão" : `Confirmar: ${selecionado?.nome || nomeCustom}`}
          </h3>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.textSub, fontSize:"1.3rem", cursor:"pointer" }}>✕</button>
        </div>

        {step===1 && (
          <>
            <input
              placeholder="🔍 Buscar banco..."
              value={busca}
              onChange={e=>setBusca(e.target.value)}
              autoFocus
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:"0.85rem", fontFamily:"inherit", outline:"none", marginBottom:12, boxSizing:"border-box" }}
            />
            <div style={{ overflowY:"auto", flex:1 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                {disponiveis.map(b => (
                  <div key={b.nome} onClick={()=>{ setSelecionado(b); setCustom(false); setStep(2); }}
                    style={{ background:C.surface, borderRadius:12, padding:"12px 8px", border:`1px solid ${C.border}`, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:8, transition:"all 0.15s" }}>
                    <div style={{ width:44, height:44, borderRadius:10, background:b.bg, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                      <img src={b.logo} alt={b.nome} style={{ width:"75%", height:"75%", objectFit:"contain" }}
                        onError={e=>{ e.target.style.display="none"; e.target.parentNode.innerHTML=`<span style="color:#fff;font-size:18px;font-weight:800">${b.nome[0]}</span>`; }}/>
                    </div>
                    <span style={{ fontSize:"0.65rem", fontWeight:600, color:C.text, textAlign:"center", lineHeight:1.2 }}>{b.nome}</span>
                  </div>
                ))}
              </div>
              <div onClick={()=>{ setCustom(true); setSelecionado(null); setStep(2); }}
                style={{ background:C.surface, borderRadius:12, padding:"12px 14px", border:`2px dashed ${C.border}`, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>➕</div>
                <div>
                  <div style={{ fontSize:"0.82rem", fontWeight:700, color:C.text }}>Outro banco / cartão</div>
                  <div style={{ fontSize:"0.68rem", color:C.textSub }}>Digite o nome manualmente</div>
                </div>
              </div>
            </div>
          </>
        )}

        {step===2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {!custom && selecionado && (
              <div style={{ display:"flex", alignItems:"center", gap:12, background:C.surface, borderRadius:12, padding:"14px", border:`1px solid ${C.border}` }}>
                <div style={{ width:52, height:52, borderRadius:12, background:selecionado.bg, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                  <img src={selecionado.logo} alt={selecionado.nome} style={{ width:"75%", height:"75%", objectFit:"contain" }}
                    onError={e=>{ e.target.style.display="none"; e.target.parentNode.innerHTML=`<span style="color:#fff;font-size:22px;font-weight:800">${selecionado.nome[0]}</span>`; }}/>
                </div>
                <div>
                  <div style={{ fontSize:"1rem", fontWeight:800, color:C.text }}>{selecionado.nome}</div>
                  <div style={{ fontSize:"0.72rem", color:C.textSub }}>Pronto para adicionar ✓</div>
                </div>
              </div>
            )}
            {custom && (
              <div>
                <div style={{ fontSize:"0.72rem", color:C.textSub, marginBottom:6 }}>Nome do cartão</div>
                <input
                  placeholder="Ex: Sicoob, Agibank..."
                  value={nomeCustom}
                  onChange={e=>setNomeCustom(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&confirmar()}
                  autoFocus
                  style={{ width:"100%", padding:"12px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:"0.9rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                />
              </div>
            )}
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button onClick={()=>setStep(1)} style={{ flex:1, padding:"12px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>← Voltar</button>
              <button onClick={confirmar} disabled={custom && !nomeCustom.trim()} style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit", fontSize:"0.88rem", opacity: custom && !nomeCustom.trim() ? 0.5 : 1 }}>
                ✓ Adicionar cartão
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
