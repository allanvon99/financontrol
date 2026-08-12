import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Valores padrão — usados se não houver config no Firestore
export const PLANOS_PADRAO = {
  free: {
    id:"free",
    nome:"Gratuito",
    precoMensal:0,
    limites:{ cartoes:2, parcelas:5, fixos:5, mesesProjecao:3 },
    recursos:{ simulador:false, categoriasCustom:false, alertas:false, exportarPdf:false },
  },
  trial: {
    id:"trial",
    nome:"Teste grátis",
    precoMensal:0,
    limites:{ cartoes:null, parcelas:null, fixos:null, mesesProjecao:18 },
    recursos:{ simulador:true, categoriasCustom:true, alertas:true, exportarPdf:true },
  },
  pro: {
    id:"pro",
    nome:"Pro",
    precoMensal:12.99,
    limites:{ cartoes:null, parcelas:null, fixos:null, mesesProjecao:18 },
    recursos:{ simulador:true, categoriasCustom:true, alertas:true, exportarPdf:true },
  },
};

// Carrega config de planos do Firestore (doc: config/planos)
export async function carregarPlanos() {
  try {
    const snap = await getDoc(doc(db, "config", "planos"));
    if (snap.exists()) {
      const d = snap.data();
      return {
        free:  { ...PLANOS_PADRAO.free,  ...(d.free||{}) },
        trial: { ...PLANOS_PADRAO.trial, ...(d.trial||{}) },
        pro:   { ...PLANOS_PADRAO.pro,   ...(d.pro||{}) },
      };
    }
  } catch(e) { console.error("Erro ao carregar planos:", e); }
  return PLANOS_PADRAO;
}

// Salva config (uso administrativo — rode no console do Firebase ou numa tela admin)
export async function salvarPlanos(planos) {
  await setDoc(doc(db, "config", "planos"), planos, { merge:true });
}

export const fmtPreco = (v) =>
  Number(v||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

// Verifica se usuário pode adicionar mais itens
export const podeAdicionar = (plano, tipo, qtdAtual) => {
  const limite = plano?.limites?.[tipo];
  if (limite === null || limite === undefined) return true; // ilimitado
  return qtdAtual < limite;
};
