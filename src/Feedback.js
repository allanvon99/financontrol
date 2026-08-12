import { useState } from "react";
import { auth, db } from "./firebase";
import { doc, setDoc, addDoc, collection } from "firebase/firestore";
import { registrarEvento } from "./monitoramento";

const OPCOES = [
  { nota:1, emoji:"😞", label:"Ruim" },
  { nota:2, emoji:"🙁", label:"Fraco" },
  { nota:3, emoji:"😐", label:"Ok" },
  { nota:4, emoji:"🙂", label:"Bom" },
  { nota:5, emoji:"😍", label:"Ótimo" },
];

export default function Feedback({ C, onFechar }) {
  const TXT = C.grayLight || C.text;
  const SUB = C.gray || C.textSub;
  const [nota, setNota] = useState(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const marcarRespondido = async (dados) => {
    if (!auth.currentUser) return;
    await setDoc(doc(db,"usuarios",auth.currentUser.uid), {
      feedback: { respondido:true, data:new Date().toISOString(), nota: dados.nota }
    }, { merge:true });
  };

  const enviar = async () => {
    if (!nota) return;
    setEnviando(true);
    try {
      await addDoc(collection(db,"feedbacks"), {
        uid: auth.currentUser?.uid || null,
        email: auth.currentUser?.email || null,
        nota,
        comentario: comentario.trim() || null,
        data: new Date().toISOString(),
      });
      await marcarRespondido({ nota });
      registrarEvento("feedback_enviado", { nota, tem_comentario: !!comentario.trim() });
      setEnviado(true);
      setTimeout(()=>onFechar(true), 1600);
    } catch(e) {
      console.error(e);
      setEnviando(false);
    }
  };

  const dispensar = async () => {
    registrarEvento("feedback_dispensado");
    try {
      if (auth.currentUser) {
        await setDoc(doc(db,"usuarios",auth.currentUser.uid), {
          feedback: { adiadoEm: new Date().toISOString() }
        }, { merge:true });
      }
    } catch(e) { console.error(e); }
    onFechar(false);
  };

  if (enviado) return (
    <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.green}44`, padding:"20px 16px", marginBottom:14, textAlign:"center", animation:"fadeIn 0.3s ease" }}>
      <div style={{ fontSize:"2rem", marginBottom:8 }}>🙏</div>
      <div style={{ fontSize:"0.9rem", fontWeight:800, color:TXT, marginBottom:4 }}>Obrigado pelo retorno!</div>
      <div style={{ fontSize:"0.78rem", color:SUB }}>Sua opinião ajuda a melhorar o app.</div>
    </div>
  );

  return (
    <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.primary}44`, overflow:"hidden", marginBottom:14, animation:"fadeIn 0.3s ease" }}>
      <div style={{ height:3, background:`linear-gradient(90deg,${C.primary},${C.purple||C.primary})` }}/>
      <div style={{ padding:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:"0.92rem", fontWeight:800, color:TXT, marginBottom:3 }}>
              Como está sendo sua experiência?
            </div>
            <div style={{ fontSize:"0.73rem", color:SUB }}>Leva 10 segundos e ajuda muito</div>
          </div>
          <button onClick={dispensar} style={{ background:"none", border:"none", color:SUB, cursor:"pointer", fontSize:"1rem", padding:"0 0 0 10px", lineHeight:1 }}>✕</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, marginBottom: nota ? 14 : 0 }}>
          {OPCOES.map(o=>(
            <button key={o.nota} onClick={()=>setNota(o.nota)}
              style={{ background: nota===o.nota ? `${C.primary}1f` : C.surface,
                border:`1px solid ${nota===o.nota ? C.primary : C.border}`,
                borderRadius:12, padding:"11px 4px", cursor:"pointer", fontFamily:"inherit",
                display:"flex", flexDirection:"column", alignItems:"center", gap:4, transition:"all 0.15s",
                transform: nota===o.nota ? "scale(1.06)" : "scale(1)" }}>
              <span style={{ fontSize:"1.35rem", lineHeight:1 }}>{o.emoji}</span>
              <span style={{ fontSize:"0.58rem", fontWeight:600, color: nota===o.nota ? C.primaryLight : SUB }}>{o.label}</span>
            </button>
          ))}
        </div>

        {nota && (
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <textarea
              placeholder={nota >= 4 ? "O que você mais gostou? (opcional)" : "O que podemos melhorar? (opcional)"}
              value={comentario}
              onChange={e=>setComentario(e.target.value)}
              rows={3}
              maxLength={500}
              style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1px solid ${C.border}`,
                background:C.surface, color:TXT, fontSize:"0.83rem", fontFamily:"inherit",
                outline:"none", boxSizing:"border-box", resize:"none", marginBottom:10 }}
            />
            <button onClick={enviar} disabled={enviando}
              style={{ width:"100%", padding:"12px", borderRadius:11, border:"none",
                background:"linear-gradient(135deg,#1d6fa4,#2188c9)", color:"#fff",
                fontWeight:700, fontSize:"0.86rem", cursor:"pointer", fontFamily:"inherit",
                opacity: enviando ? 0.6 : 1 }}>
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
