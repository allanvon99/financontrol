import { useState } from "react";
import ModalNovoCartao from "./ModalNovoCartao";

export default function Cartoes({ cartoes, setCartoes, dark = true }) {
  const C = dark ? {
    bg:"#0d1117", card:"#161b22", border:"#21262d", surface:"#1c2128",
    text:"#c9d1d9", textSub:"#8b949e", primary:"#2188c9", primaryLight:"#58a6ff",
    green:"#3fb950", red:"#f85149",
  } : {
    bg:"#f6f8fa", card:"#ffffff", border:"#d0d7de", surface:"#f6f8fa",
    text:"#1f2328", textSub:"#57606a", primary:"#0969da", primaryLight:"#0969da",
    green:"#1a7f37", red:"#d1242f",
  };

  const [showModal, setShowModal] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(null);

  const removerCartao = (nome) => {
    setCartoes(prev => prev.filter(c => c.nome !== nome));
    setConfirmandoRemocao(null);
  };

  return (
    <div style={{ animation:"fadeIn 0.25s ease" }}>
      {showModal && (
        <ModalNovoCartao
          C={C}
          onClose={() => setShowModal(false)}
          cartoesJaCadastrados={cartoes.map(c => c.nome)}
          onAdd={(c) => setCartoes(prev => [...prev, c])}
        />
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ fontSize:"0.95rem", fontWeight:700, margin:0, color:C.text }}>Meus Cartões</h2>
        <button onClick={() => setShowModal(true)} style={{ background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, border:"none", borderRadius:8, color:"#fff", padding:"8px 14px", fontSize:"0.78rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          + Novo cartão
        </button>
      </div>

      {cartoes.length === 0 ? (
        <div style={{ textAlign:"center", color:C.textSub, padding:"60px 0" }}>
          <p style={{ fontSize:"2.5rem", margin:"0 0 10px" }}>💳</p>
          <p style={{ fontSize:"0.88rem", fontWeight:600, color:C.text, marginBottom:4 }}>Nenhum cartão cadastrado</p>
          <p style={{ fontSize:"0.76rem" }}>Adicione seus cartões para organizar parcelas e gastos</p>
          <button onClick={() => setShowModal(true)} style={{ marginTop:16, background:`linear-gradient(135deg,#1d6fa4,#2188c9)`, border:"none", borderRadius:10, color:"#fff", padding:"12px 24px", fontSize:"0.85rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            + Adicionar primeiro cartão
          </button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {cartoes.map(c => {
            const confirmando = confirmandoRemocao === c.nome;
            return (
              <div key={c.nome} style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  {/* Logo */}
                  <div style={{ width:44, height:44, borderRadius:11, background:c.bg||"#444", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0, boxShadow:"0 2px 8px rgba(0,0,0,0.25)" }}>
                    {c.logo ? (
                      <img src={c.logo} alt={c.nome} style={{ width:"75%", height:"75%", objectFit:"contain" }}
                        onError={e=>{ e.target.style.display="none"; e.target.parentNode.innerHTML=`<span style="color:#fff;font-size:18px;font-weight:800">${c.nome[0]}</span>`; }}/>
                    ) : (
                      <span style={{ color:"#fff", fontSize:"1.1rem", fontWeight:800 }}>{c.nome[0]}</span>
                    )}
                  </div>

                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.9rem", fontWeight:700, color:C.text }}>{c.nome}</div>
                    <div style={{ fontSize:"0.65rem", color:C.textSub, marginTop:2 }}>Cartão cadastrado</div>
                  </div>

                  {!confirmando ? (
                    <button onClick={() => setConfirmandoRemocao(c.nome)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.textSub, padding:"6px 10px", fontSize:"0.72rem", cursor:"pointer", fontFamily:"inherit" }}>
                      Remover
                    </button>
                  ) : null}
                </div>

                {confirmando && (
                  <div style={{ padding:"0 16px 14px" }}>
                    <div style={{ background:`${C.red}11`, borderRadius:8, padding:"10px 12px", border:`1px solid ${C.red}33` }}>
                      <p style={{ color:C.red, fontSize:"0.76rem", margin:"0 0 8px", textAlign:"center" }}>
                        Remover <strong>{c.nome}</strong>? As parcelas vinculadas serão removidas.
                      </p>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => setConfirmandoRemocao(null)} style={{ flex:1, padding:"8px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, cursor:"pointer", fontFamily:"inherit", fontWeight:600, fontSize:"0.78rem" }}>Cancelar</button>
                        <button onClick={() => removerCartao(c.nome)} style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:C.red, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:"0.78rem" }}>Remover</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
