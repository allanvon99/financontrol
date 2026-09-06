import { useState, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const CATEGORIAS_FALLBACK = [{ id:"outros", nome:"Outros", emoji:"📦" }];

const fmt = (v) => Number(v||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

function pareceValor(str) {
  if (str == null || str === "") return false;
  const s = String(str).trim();
  return /^[R$\s]*-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s) || /^-?\d+([.,]\d+)?$/.test(s);
}
function parseValor(raw) {
  if (typeof raw === "number") return raw;
  if (!raw) return null;
  let s = String(raw).trim().replace(/[R$\s]/g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const gerarMeses = () => {
  const now = new Date();
  const mes = now.getMonth(), ano = now.getFullYear();
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return Array.from({ length:18 }, (_,i) => {
    const m = (mes+i)%12, a = ano+Math.floor((mes+i)/12);
    return { label:`${nomes[m]}/${a}`, mes:m, ano:a, idx:i };
  });
};
const MESES = gerarMeses();

const TIPOS = [
  { id:"gasto", label:"Gasto do mês", icon:"🧾" },
  { id:"fixo", label:"Gasto fixo", icon:"📌" },
  { id:"parcela", label:"Parcela", icon:"💳" },
  { id:"ignorar", label:"Ignorar", icon:"🚫" },
];

export default function ImportarPlanilha({ categorias, cartoes, fixos, setFixos, parcelas, setParcelas, extras, setExtras, planoAtualObj, podeAdicionar, onLimiteAtingido, onVoltar, C, inp: inpProp, btnPri }) {
  const cats = categorias?.length ? categorias : CATEGORIAS_FALLBACK;
  const inp = inpProp || (() => ({
    width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${C.border}`,
    background:C.surface, color:C.grayLight, fontSize:"0.82rem", fontFamily:"inherit", outline:"none", boxSizing:"border-box"
  }));

  const [etapa, setEtapa] = useState("upload");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [linhasBrutas, setLinhasBrutas] = useState([]);
  const [temCabecalho, setTemCabecalho] = useState(true);
  const [colDescricao, setColDescricao] = useState(0);
  const [colValor, setColValor] = useState(1);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const inputRef = useRef(null);

  const processarLinhas = (linhas) => {
    const limpo = linhas
      .map((l) => (Array.isArray(l) ? l : Object.values(l)))
      .filter((l) => l.some((c) => String(c || "").trim() !== ""));
    if (limpo.length === 0) { setErro("Não encontramos nenhuma linha com dados nessa planilha."); return; }

    const primeira = limpo[0];
    const pareceCabecalho = primeira.every((c) => !pareceValor(c));
    setTemCabecalho(pareceCabecalho);
    setLinhasBrutas(limpo);

    const amostra = pareceCabecalho ? limpo.slice(1, 8) : limpo.slice(0, 8);
    const nCols = Math.max(...limpo.map((l) => l.length));
    let melhorColValor = -1, melhorScore = -1;
    for (let c = 0; c < nCols; c++) {
      const score = amostra.filter((l) => pareceValor(l[c])).length;
      if (score > melhorScore) { melhorScore = score; melhorColValor = c; }
    }
    let melhorColDesc = melhorColValor === 0 ? 1 : 0;
    for (let c = 0; c < nCols; c++) {
      if (c === melhorColValor) continue;
      if (amostra.some((l) => l[c] && String(l[c]).trim().length > 2 && !pareceValor(l[c]))) { melhorColDesc = c; break; }
    }
    setColValor(melhorColValor >= 0 ? melhorColValor : 1);
    setColDescricao(melhorColDesc);
    setErro("");
    setEtapa("mapeamento");
  };

  const handleArquivo = (file) => {
    if (!file) return;
    setNomeArquivo(file.name);
    setErro("");
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, { complete: (res) => processarLinhas(res.data), error: () => setErro("Não conseguimos ler esse arquivo CSV.") });
    } else if (["xlsx","xls"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type:"array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          processarLinhas(XLSX.utils.sheet_to_json(sheet, { header:1, defval:"" }));
        } catch { setErro("Não conseguimos ler esse arquivo. Confere se é uma planilha válida."); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErro("Formato não suportado. Envie um arquivo .csv, .xlsx ou .xls.");
    }
  };

  const baixarModeloXlsx = () => {
    const dados = [["Descrição","Valor"], ["Supermercado", 342.50], ["Uber", 28.90], ["Netflix", 39.90]];
    const ws = XLSX.utils.aoa_to_sheet(dados);
    ws['!cols'] = [{ wch:28 }, { wch:14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    XLSX.writeFile(wb, "modelo-von-finance.xlsx");
  };

  const confirmarMapeamento = () => {
    const dados = temCabecalho ? linhasBrutas.slice(1) : linhasBrutas;
    const novosItens = dados.map((linha, i) => {
      const valor = parseValor(linha[colValor]);
      const descricao = String(linha[colDescricao] ?? "").trim();
      return {
        id:i, descricao: descricao || `Item ${i+1}`, valor,
        tipo:null, categoria:null, cartao:"", mesIdx:0, parcelasTotal:"", dataPrimeira:"",
        selecionado: valor !== null,
      };
    });
    setItens(novosItens);
    setEtapa("revisao");
  };

  const atualizarItem = (id, campo, valor) => setItens((p) => p.map((it) => (it.id===id ? { ...it, [campo]:valor } : it)));

  const reiniciar = () => {
    setEtapa("upload"); setLinhasBrutas([]); setItens([]); setErro(""); setNomeArquivo(""); setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const selecionados = itens.filter((i) => i.selecionado && i.tipo && i.tipo !== "ignorar");
  const totalSelecionado = selecionados.reduce((s,i) => s + (i.valor||0), 0);
  const prontosParaImportar = selecionados.every(i =>
    i.categoria && (i.tipo!=="parcela" || (i.cartao && i.parcelasTotal))
  );

  const confirmarImportacao = () => {
    const fixosSel = selecionados.filter(i=>i.tipo==="fixo");
    const parcelasSel = selecionados.filter(i=>i.tipo==="parcela");
    const gastosSel = selecionados.filter(i=>i.tipo==="gasto");

    // ===== Limites de plano: importa até onde couber, avisa o que ficou de fora =====
    const espacoLivre = (atual, novos, limite) => limite==null ? novos.length : Math.max(0, limite-atual);

    const cabemFixos = espacoLivre(fixos.length, fixosSel, planoAtualObj?.limites?.fixos);
    const fixosQueEntram = fixosSel.slice(0, cabemFixos);
    const fixosDeFora = fixosSel.length - fixosQueEntram.length;

    const cabemParcelas = espacoLivre(parcelas.length, parcelasSel, planoAtualObj?.limites?.parcelas);
    const parcelasQueEntram = parcelasSel.slice(0, cabemParcelas);
    const parcelasDeFora = parcelasSel.length - parcelasQueEntram.length;

    // gastos do mês: limite é POR MÊS, então agrupa por mês antes de checar
    const porMes = {};
    gastosSel.forEach(i => { (porMes[i.mesIdx] = porMes[i.mesIdx]||[]).push(i); });
    let gastosQueEntram = [], gastosDeFora = 0;
    Object.entries(porMes).forEach(([mesIdx, itensDoMes]) => {
      const m = MESES[mesIdx];
      const existentesNesseMes = extras.filter(e => e.mesReal===m.mes && e.anoReal===m.ano).length;
      const cabe = espacoLivre(existentesNesseMes, itensDoMes, planoAtualObj?.limites?.extras);
      gastosQueEntram = gastosQueEntram.concat(itensDoMes.slice(0, cabe));
      gastosDeFora += itensDoMes.length - cabe;
    });

    // ===== Grava de verdade =====
    if (fixosQueEntram.length) {
      setFixos(prev => [...prev, ...fixosQueEntram.map(i => ({
        id: Date.now()+Math.random(), nome:i.descricao, valor:parseFloat(i.valor), categoria:i.categoria, cartao:i.cartao||"",
      }))]);
    }
    if (parcelasQueEntram.length) {
      setParcelas(prev => [...prev, ...parcelasQueEntram.map(i => {
        const n = parseInt(i.parcelasTotal)||1;
        const valorParcela = Math.floor((parseFloat(i.valor)/n)*100)/100;
        const dataCadastro = i.dataPrimeira ? new Date(i.dataPrimeira).toISOString() : new Date().toISOString();
        return {
          id: Date.now()+Math.random(), nome:i.descricao, categoria:i.categoria, grupo:i.cartao,
          valor:valorParcela, valorTotalOriginal:parseFloat(i.valor), parcelas:n, parcelasOriginal:n, dataCadastro,
        };
      })]);
    }
    if (gastosQueEntram.length) {
      setExtras(prev => [...prev, ...gastosQueEntram.map(i => {
        const m = MESES[i.mesIdx];
        return { id: Date.now()+Math.random(), nome:i.descricao, valor:parseFloat(i.valor), categoria:i.categoria, cartao:i.cartao||"", mesReal:m.mes, anoReal:m.ano };
      })]);
    }

    setResultado({
      total: fixosQueEntram.length+parcelasQueEntram.length+gastosQueEntram.length,
      valor: [...fixosQueEntram,...parcelasQueEntram,...gastosQueEntram].reduce((s,i)=>s+Number(i.valor),0),
      porTipo: { gasto:gastosQueEntram.length, fixo:fixosQueEntram.length, parcela:parcelasQueEntram.length },
      deFora: { fixo:fixosDeFora, parcela:parcelasDeFora, gasto:gastosDeFora },
    });
    setEtapa("concluido");
  };

  const nCols = linhasBrutas.length ? Math.max(...linhasBrutas.map((l) => l.length)) : 0;
  const amostraPreview = (temCabecalho ? linhasBrutas.slice(1) : linhasBrutas).slice(0, 5);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif", padding:"16px 16px 40px" }}>
      <div style={{ maxWidth:480, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <button onClick={onVoltar} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.grayLight, width:34, height:34, cursor:"pointer", fontSize:"1rem" }}>←</button>
          <h1 style={{ fontSize:"1rem", fontWeight:800, color:C.grayLight, margin:0 }}>📥 Importar da planilha</h1>
        </div>

        <div style={{ display:"flex", gap:4, marginBottom:20 }}>
          {["upload","mapeamento","revisao","concluido"].map((e,i) => {
            const ordem = ["upload","mapeamento","revisao","concluido"];
            const ativo = i <= ordem.indexOf(etapa);
            return <div key={e} style={{ flex:1, height:3, borderRadius:2, background: ativo ? C.primary : C.border }}/>;
          })}
        </div>

        {etapa === "upload" && (
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ background:C.card, border:`1px solid rgba(33,136,201,0.35)`, borderRadius:12, padding:14, marginBottom:14 }}>
              <p style={{ fontSize:"0.76rem", color:C.grayLight, lineHeight:1.55, margin:0 }}>
                💡 Só precisa informar <strong>descrição</strong> e <strong>valor</strong> de cada gasto. Depois de enviar, você decide aqui dentro se cada um é gasto do mês, fixo ou parcela — e em qual categoria, cartão e mês ele entra.
              </p>
            </div>

            <button onClick={baixarModeloXlsx} style={{ width:"100%", padding:12, borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:C.grayLight, fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit", marginBottom:10 }}>
              ⬇ Baixar modelo (.xlsx)
            </button>

            <div
              onDragOver={(e)=>{e.preventDefault(); setArrastando(true);}}
              onDragLeave={()=>setArrastando(false)}
              onDrop={(e)=>{e.preventDefault(); setArrastando(false); handleArquivo(e.dataTransfer.files[0]);}}
              onClick={()=>inputRef.current?.click()}
              style={{ background:C.card, border:`2px dashed ${arrastando?C.primary:C.border}`, borderRadius:14, padding:"28px 16px", textAlign:"center", cursor:"pointer" }}
            >
              <div style={{ fontSize:"1.8rem", marginBottom:8 }}>{arrastando?"📂":"📤"}</div>
              <div style={{ fontSize:"0.85rem", fontWeight:700, color:C.grayLight, marginBottom:3 }}>Enviar planilha preenchida</div>
              <div style={{ fontSize:"0.7rem", color:C.gray }}>Toque ou arraste &middot; .csv, .xlsx ou .xls</div>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e)=>handleArquivo(e.target.files[0])} style={{ display:"none" }}/>
            </div>

            {erro && <div style={{ marginTop:12, background:`${C.red}18`, border:`1px solid ${C.red}44`, borderRadius:10, padding:"10px 14px", fontSize:"0.78rem", color:C.red }}>{erro}</div>}
          </div>
        )}

        {etapa === "mapeamento" && (
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ fontSize:"0.78rem", color:C.gray, marginBottom:14 }}>📄 <strong style={{ color:C.grayLight }}>{nomeArquivo}</strong> · {linhasBrutas.length} linha(s)</div>
            <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}`, marginBottom:14 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, cursor:"pointer" }}>
                <input type="checkbox" checked={temCabecalho} onChange={(e)=>setTemCabecalho(e.target.checked)} style={{ accentColor:C.primary, width:15, height:15 }}/>
                <span style={{ fontSize:"0.78rem", color:C.grayLight }}>A primeira linha é um cabeçalho</span>
              </label>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:"0.68rem", color:C.gray, marginBottom:5, textTransform:"uppercase" }}>Qual coluna é a descrição?</div>
                <select value={colDescricao} onChange={(e)=>setColDescricao(Number(e.target.value))} style={inp()}>
                  {Array.from({length:nCols},(_,i)=>(<option key={i} value={i}>Coluna {i+1}{temCabecalho && linhasBrutas[0]?.[i]?` — "${linhasBrutas[0][i]}"`:""}</option>))}
                </select>
              </div>
              <div>
                <div style={{ fontSize:"0.68rem", color:C.gray, marginBottom:5, textTransform:"uppercase" }}>Qual coluna é o valor?</div>
                <select value={colValor} onChange={(e)=>setColValor(Number(e.target.value))} style={inp()}>
                  {Array.from({length:nCols},(_,i)=>(<option key={i} value={i}>Coluna {i+1}{temCabecalho && linhasBrutas[0]?.[i]?` — "${linhasBrutas[0][i]}"`:""}</option>))}
                </select>
              </div>
            </div>
            <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}`, marginBottom:16 }}>
              <div style={{ fontSize:"0.68rem", color:C.primary, textTransform:"uppercase", fontWeight:700, marginBottom:10 }}>Pré-visualização</div>
              {amostraPreview.map((linha,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 10px", background:C.surface, borderRadius:8, fontSize:"0.78rem", marginBottom:5 }}>
                  <span style={{ color:C.grayLight, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginRight:8 }}>{String(linha[colDescricao] ?? "—")}</span>
                  <span style={{ color: pareceValor(linha[colValor])?C.green:C.red, fontWeight:700, flexShrink:0 }}>{pareceValor(linha[colValor]) ? fmt(parseValor(linha[colValor])) : "valor inválido"}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={reiniciar} style={{ flex:1, padding:12, borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:C.gray, fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit" }}>Voltar</button>
              <button onClick={confirmarMapeamento} style={{ flex:2, padding:12, borderRadius:11, border:"none", background:`linear-gradient(135deg,#1d6fa4,${C.primary})`, color:"#fff", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit" }}>Continuar →</button>
            </div>
          </div>
        )}

        {etapa === "revisao" && (
          <div style={{ animation:"fadeIn 0.25s ease" }}>
            <div style={{ background:C.card, borderRadius:14, padding:"14px 16px", border:`1px solid ${C.primary}55`, marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"0.68rem", color:C.gray, textTransform:"uppercase" }}>{selecionados.length} de {itens.length} selecionado(s)</div>
                <div style={{ fontSize:"1.1rem", fontWeight:800, color:C.primary }}>{fmt(totalSelecionado)}</div>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {itens.map((item) => (
                <div key={item.id} style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, opacity:item.selecionado?1:0.45, overflow:"hidden" }}>
                  <div style={{ padding:"10px 12px", display:"flex", alignItems:"center", gap:10 }}>
                    <input type="checkbox" checked={item.selecionado} onChange={(e)=>atualizarItem(item.id,"selecionado",e.target.checked)} style={{ accentColor:C.primary, width:16, height:16, flexShrink:0 }}/>
                    <input value={item.descricao} onChange={(e)=>atualizarItem(item.id,"descricao",e.target.value)} style={{ flex:1, background:"transparent", border:"none", color:C.grayLight, fontSize:"0.84rem", fontWeight:600, fontFamily:"inherit", outline:"none", minWidth:0 }}/>
                    <span style={{ color:item.valor==null?C.red:C.green, fontWeight:800, fontSize:"0.85rem", flexShrink:0 }}>{item.valor==null?"sem valor":fmt(item.valor)}</span>
                  </div>
                  {item.selecionado && (
                    <div style={{ padding:"0 12px 12px", display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", gap:6 }}>
                        {TIPOS.map((t)=>(
                          <button key={t.id} onClick={()=>atualizarItem(item.id,"tipo",t.id)}
                            style={{ flex:1, padding:"7px 4px", borderRadius:8, border:`1px solid ${item.tipo===t.id?C.primary:C.border}`, background:item.tipo===t.id?`${C.primary}22`:"transparent", color:item.tipo===t.id?C.primary:C.gray, fontSize:"0.65rem", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>

                      {item.tipo && item.tipo !== "ignorar" && (
                        <>
                          <select value={item.categoria||""} onChange={(e)=>atualizarItem(item.id,"categoria",e.target.value)} style={inp()}>
                            <option value="" disabled>Escolha a categoria...</option>
                            {cats.map((c)=>(<option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>))}
                          </select>

                          {item.tipo === "gasto" && (
                            <select value={item.mesIdx} onChange={(e)=>atualizarItem(item.id,"mesIdx",parseInt(e.target.value))} style={inp()}>
                              {MESES.map((m)=>(<option key={m.idx} value={m.idx}>{m.label}</option>))}
                            </select>
                          )}

                          {(item.tipo === "fixo" || item.tipo === "gasto") && (
                            <select value={item.cartao||""} onChange={(e)=>atualizarItem(item.id,"cartao",e.target.value)} style={inp()}>
                              <option value="">Sem cartão (opcional)</option>
                              {(cartoes||[]).map((c)=>(<option key={c.nome} value={c.nome}>{c.nome}</option>))}
                            </select>
                          )}

                          {item.tipo === "parcela" && (
                            <>
                              <select value={item.cartao||""} onChange={(e)=>atualizarItem(item.id,"cartao",e.target.value)} style={inp()}>
                                <option value="" disabled>Escolha o cartão...</option>
                                {(cartoes||[]).map((c)=>(<option key={c.nome} value={c.nome}>{c.nome}</option>))}
                              </select>
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                                <input type="number" min="2" placeholder="Total de parcelas" value={item.parcelasTotal} onChange={(e)=>atualizarItem(item.id,"parcelasTotal",e.target.value)} style={inp()}/>
                                <input type="date" value={item.dataPrimeira} onChange={(e)=>atualizarItem(item.id,"dataPrimeira",e.target.value)} style={inp()}/>
                              </div>
                              {item.parcelasTotal && (
                                <div style={{ fontSize:"0.7rem", color:C.primary, padding:"6px 9px", background:C.surface, borderRadius:8, fontWeight:600 }}>
                                  {item.parcelasTotal}x de {fmt(Math.floor((parseFloat(item.valor)/parseInt(item.parcelasTotal))*100)/100)}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display:"flex", gap:10, marginTop:18 }}>
              <button onClick={()=>setEtapa("mapeamento")} style={{ flex:1, padding:13, borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:C.gray, fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit" }}>Voltar</button>
              <button onClick={confirmarImportacao} disabled={selecionados.length===0 || !prontosParaImportar}
                style={{ flex:2, padding:13, borderRadius:11, border:"none", background:(selecionados.length && prontosParaImportar)?`linear-gradient(135deg,#1d6fa4,${C.primary})`:C.border, color:"#fff", fontWeight:700, fontSize:"0.85rem", cursor:(selecionados.length && prontosParaImportar)?"pointer":"not-allowed", fontFamily:"inherit" }}>
                Importar {selecionados.length} item(ns)
              </button>
            </div>
            {selecionados.length>0 && !prontosParaImportar && (
              <p style={{ fontSize:"0.7rem", color:C.orange, textAlign:"center", marginTop:8 }}>Preenche categoria (e cartão + parcelas, se for parcela) em todos os itens selecionados pra continuar.</p>
            )}
          </div>
        )}

        {etapa === "concluido" && resultado && (
          <div style={{ animation:"fadeIn 0.25s ease", textAlign:"center", paddingTop:20 }}>
            <div style={{ fontSize:"2.6rem", marginBottom:10 }}>🎉</div>
            <h2 style={{ fontSize:"1.1rem", fontWeight:800, color:C.grayLight, margin:"0 0 6px" }}>Importado!</h2>
            <p style={{ fontSize:"0.82rem", color:C.gray, marginBottom:20 }}>{resultado.total} gasto(s) organizado(s), somando {fmt(resultado.valor)}</p>

            <div style={{ background:C.card, borderRadius:14, padding:16, border:`1px solid ${C.border}`, textAlign:"left", marginBottom:14 }}>
              {[["🧾","Gastos do mês","gasto"],["📌","Gastos fixos","fixo"],["💳","Parcelas","parcela"]].map(([icon,label,key])=> resultado.porTipo[key]>0 && (
                <div key={key} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:"0.82rem" }}>
                  <span style={{ color:C.grayLight }}>{icon} {label}</span>
                  <span style={{ color:C.gray, fontWeight:700 }}>{resultado.porTipo[key]}</span>
                </div>
              ))}
            </div>

            {(resultado.deFora.fixo>0 || resultado.deFora.parcela>0 || resultado.deFora.gasto>0) && (
              <div style={{ background:`${C.orange}18`, border:`1px solid ${C.orange}44`, borderRadius:10, padding:"12px 14px", fontSize:"0.76rem", color:C.orange, textAlign:"left", marginBottom:14, lineHeight:1.5 }}>
                ⚠️ O plano gratuito tem limite de cadastros — {resultado.deFora.fixo+resultado.deFora.parcela+resultado.deFora.gasto} item(ns) não couberam e ficaram de fora. Assine o Pro pra importar sem limite.
              </div>
            )}

            <button onClick={onVoltar} style={{ width:"100%", padding:13, borderRadius:11, border:"none", background:`linear-gradient(135deg,#1d6fa4,${C.primary})`, color:"#fff", fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit", marginBottom:10 }}>Concluir</button>
            <button onClick={reiniciar} style={{ width:"100%", padding:12, borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:C.gray, fontWeight:700, fontSize:"0.85rem", cursor:"pointer", fontFamily:"inherit" }}>Importar outra planilha</button>
          </div>
        )}
      </div>
    </div>
  );
}
