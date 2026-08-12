export const GUIAS = {
  parcelas: {
    icon:"🧾", titulo:"Parcelas",
    sub:"Suas compras parceladas em um só lugar",
    itens:[
      { i:"➕", t:"Cadastre suas parcelas", d:"Informe o valor da parcela, quantas faltam e a data da primeira cobrança." },
      { i:"🔄", t:"Atualiza sozinho", d:"A cada mês que passa, o contador anda automaticamente (3/12 vira 4/12)." },
      { i:"💳", t:"Agrupadas por cartão", d:"Toque no cartão para expandir e ver todas as parcelas dele." },
      { i:"📅", t:"Navegue pelos meses", d:"Use as setas para ver quanto você paga em cada mês." },
    ],
  },
  fixos: {
    icon:"📌", titulo:"Gastos Fixos",
    sub:"Aquilo que se repete todo mês",
    itens:[
      { i:"🏠", t:"Contas recorrentes", d:"Aluguel, internet, streaming, academia, plano de saúde." },
      { i:"♻️", t:"Cadastre uma vez só", d:"O valor é considerado automaticamente em todos os meses da projeção." },
      { i:"🏷️", t:"Use categorias", d:"Assim você descobre para onde vai a maior parte da sua renda." },
    ],
  },
  gastos: {
    icon:"🗓️", titulo:"Gastos do Mês",
    sub:"O dia a dia que sai do controle",
    itens:[
      { i:"🍔", t:"Gastos avulsos", d:"Restaurante, uber, mercado, farmácia — o que não se repete." },
      { i:"📅", t:"Data opcional", d:"Com data, o gasto vai para o mês certo. Sem data, entra no mês que você está vendo." },
      { i:"💳", t:"Vincule ao cartão", d:"Assim você vê o total real de cada cartão, somando parcelas e gastos." },
      { i:"◀▶", t:"Veja outros meses", d:"Navegue para consultar o histórico ou planejar o próximo mês." },
    ],
  },
  cadastros: {
    icon:"⚙️", titulo:"Cadastros",
    sub:"Configure a base do seu controle",
    itens:[
      { i:"💳", t:"Cartões", d:"Cadastre os apelidos dos seus cartões. Nunca pedimos número ou senha." },
      { i:"🏷️", t:"Categorias", d:"Já vêm algumas prontas. Crie as suas com emoji e cor personalizados." },
      { i:"💚", t:"Saúde financeira", d:"Defina a partir de qual % da renda comprometida você quer ser alertado." },
    ],
  },
  projecao: {
    icon:"📊", titulo:"Projeção",
    sub:"O futuro do seu dinheiro",
    itens:[
      { i:"📆", t:"Mês a mês", d:"Veja quanto sobra em cada um dos próximos meses, já descontando tudo." },
      { i:"🍩", t:"Toque no card", d:"Expanda para ver o detalhe de receita, gastos e parcelas do mês." },
      { i:"💳", t:"Visão por cartão", d:"Alterne no topo para ver quanto cada cartão pesa por mês." },
    ],
  },
  receita: {
    icon:"💰", titulo:"Receita",
    sub:"Tudo que entra no seu bolso",
    itens:[
      { i:"💼", t:"Salário fixo", d:"Cadastre uma vez e ele vale para todos os meses automaticamente." },
      { i:"➕", t:"Entradas extras", d:"13º, férias, freelas, bônus — some ao mês específico em que cair." },
      { i:"◀▶", t:"Navegue pelos meses", d:"Consulte o histórico ou planeje entradas futuras." },
    ],
  },
  amortizacao: {
    icon:"💸", titulo:"Simulador",
    sub:"Use um dinheiro extra da melhor forma",
    itens:[
      { i:"💵", t:"Informe o valor", d:"Reserva, 13º, bônus — qualquer valor que você tenha disponível." },
      { i:"⏱️", t:"Terminar mais rápido", d:"Elimina as parcelas que ainda vão durar mais tempo." },
      { i:"📉", t:"Sobrar mais por mês", d:"Reduz o valor que sai da conta todo mês, aliviando o orçamento." },
    ],
  },
};

export default function GuiaTela({ C, tipo, onFechar, onNaoMostrar }) {
  const g = GUIAS[tipo];
  if (!g) return null;

  const TXT = C.grayLight || C.text;
  const SUB = C.gray || C.textSub;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onFechar}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:C.card, borderRadius:"22px 22px 0 0", padding:"18px 20px 30px", width:"100%", maxWidth:460, maxHeight:"88vh", overflowY:"auto", animation:"slideUp 0.3s ease", border:`1px solid ${C.border}`, borderBottom:"none" }}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

        <div style={{ width:38, height:4, borderRadius:2, background:C.border, margin:"0 auto 18px" }}/>

        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
          <div style={{ width:44, height:44, borderRadius:13, background:C.surface, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>{g.icon}</div>
          <div>
            <div style={{ fontSize:"1.05rem", fontWeight:800, color:TXT }}>{g.titulo}</div>
            <div style={{ fontSize:"0.75rem", color:SUB }}>{g.sub}</div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8, margin:"18px 0 20px" }}>
          {g.itens.map(it=>(
            <div key={it.t} style={{ display:"flex", gap:12, alignItems:"flex-start", background:C.surface, borderRadius:12, padding:"12px 14px", border:`1px solid ${C.border}` }}>
              <span style={{ fontSize:"1.05rem", flexShrink:0 }}>{it.i}</span>
              <div>
                <div style={{ fontSize:"0.84rem", fontWeight:700, color:TXT }}>{it.t}</div>
                <div style={{ fontSize:"0.75rem", color:SUB, marginTop:3, lineHeight:1.5 }}>{it.d}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onFechar} style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#1d6fa4,#2188c9)", color:"#fff", fontWeight:700, fontSize:"0.92rem", cursor:"pointer", fontFamily:"inherit" }}>
          Entendi, vamos lá
        </button>
        <button onClick={onNaoMostrar} style={{ width:"100%", background:"none", border:"none", color:SUB, fontSize:"0.75rem", cursor:"pointer", fontFamily:"inherit", marginTop:10, padding:6 }}>
          Não mostrar novamente
        </button>
      </div>
    </div>
  );
}
