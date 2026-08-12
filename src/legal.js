export const VERSAO_DOCS = "1.0";
export const DATA_VIGENCIA = "6 de agosto de 2026";
export const EMAIL_CONTATO = "allanvon99@gmail.com";

export const POLITICA_PRIVACIDADE = [
  { t:"Quem somos", p:[
    `O Von Finance é um aplicativo de organização financeira pessoal. Esta política explica como tratamos seus dados, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).`,
    `Encarregado pelo tratamento de dados: ${EMAIL_CONTATO}`,
  ]},
  { t:"Dados que coletamos", p:[
    `Cadastro: nome, sobrenome e email.`,
    `Financeiros: os valores que você mesmo informa — renda, parcelas, gastos fixos, gastos do mês, apelidos de cartões e categorias.`,
    `Uso: páginas acessadas, ações realizadas no app e dados técnicos do dispositivo (navegador, sistema, idioma), de forma agregada.`,
    `Erros: quando o app falha, registramos o erro técnico para correção.`,
  ]},
  { t:"O que NÃO coletamos", p:[
    `Nunca solicitamos número de cartão, código de segurança, senha bancária, CPF ou qualquer credencial de instituição financeira.`,
    `Não acessamos suas contas bancárias e não temos integração com bancos. Os apelidos de cartão servem apenas para você organizar seus lançamentos.`,
  ]},
  { t:"Por que tratamos seus dados", p:[
    `Execução de contrato: para fornecer as funcionalidades do app que você contratou.`,
    `Consentimento: para o aceite destes termos no momento do cadastro.`,
    `Legítimo interesse: para corrigir falhas, melhorar o produto e prevenir fraudes.`,
    `Obrigação legal: para guardar registros de acesso conforme o Marco Civil da Internet.`,
  ]},
  { t:"Com quem compartilhamos", p:[
    `Google Firebase (Google LLC): autenticação e banco de dados.`,
    `Vercel Inc.: hospedagem da aplicação.`,
    `Sentry e Google Analytics: monitoramento de erros e uso, com dados despersonalizados.`,
    `Processadora de pagamento: apenas quando você contrata um plano pago; o pagamento ocorre no ambiente da processadora e não armazenamos dados do seu cartão.`,
    `Não vendemos, alugamos ou cedemos seus dados para fins publicitários.`,
  ]},
  { t:"Transferência internacional", p:[
    `Alguns fornecedores mantêm servidores fora do Brasil. Essas transferências seguem cláusulas contratuais padrão e garantias de proteção equivalentes às da LGPD.`,
  ]},
  { t:"Por quanto tempo guardamos", p:[
    `Enquanto sua conta existir. Ao excluir a conta, seus dados financeiros e cadastrais são apagados permanentemente.`,
    `Registros de acesso são mantidos por 6 meses, conforme exigência legal.`,
    `Dados de pagamento e faturamento são mantidos por 5 anos, por obrigação fiscal.`,
  ]},
  { t:"Segurança", p:[
    `Comunicação criptografada (HTTPS), senhas armazenadas com hash pelo Firebase Authentication e regras de acesso que impedem um usuário de ler dados de outro.`,
    `Em caso de incidente de segurança relevante, comunicaremos você e a ANPD nos prazos legais.`,
  ]},
  { t:"Seus direitos", p:[
    `Confirmar a existência de tratamento, acessar, corrigir, anonimizar, portar ou excluir seus dados, além de revogar o consentimento.`,
    `Acesso, correção e exclusão você faz direto no app, em Gerenciar conta. Para os demais pedidos, escreva para ${EMAIL_CONTATO}. Respondemos em até 15 dias.`,
  ]},
  { t:"Cookies", p:[
    `Usamos armazenamento local apenas para manter você conectado e lembrar sua preferência de tema. Não usamos cookies de publicidade.`,
  ]},
  { t:"Menores de idade", p:[
    `O app não se destina a menores de 18 anos e não coletamos dados dessa faixa etária intencionalmente.`,
  ]},
  { t:"Alterações", p:[
    `Podemos atualizar esta política. Mudanças relevantes serão avisadas no app. Versão ${VERSAO_DOCS}, vigente desde ${DATA_VIGENCIA}.`,
  ]},
];

export const TERMOS_USO = [
  { t:"Objeto", p:[
    `O Von Finance é uma ferramenta de organização financeira pessoal. Os valores exibidos são projeções calculadas a partir dos dados que você informa.`,
  ]},
  { t:"Não somos consultoria financeira", p:[
    `O app não presta consultoria de investimentos, crédito ou assessoria financeira. As sugestões e simulações têm caráter informativo.`,
    `Decisões sobre suas finanças são de sua exclusiva responsabilidade. Não nos responsabilizamos por prejuízos decorrentes de decisões tomadas com base nas projeções.`,
  ]},
  { t:"Sua conta", p:[
    `Você deve ter ao menos 18 anos e fornecer informações verdadeiras.`,
    `É responsável por manter a senha em sigilo e por toda atividade realizada na sua conta.`,
    `Cada email pode estar vinculado a apenas uma conta.`,
  ]},
  { t:"Uso adequado", p:[
    `É proibido usar o app para fins ilícitos, tentar acessar dados de terceiros, aplicar engenharia reversa, sobrecarregar a infraestrutura ou reproduzir o serviço.`,
    `Podemos suspender contas que violem estas regras.`,
  ]},
  { t:"Planos e pagamento", p:[
    `Oferecemos um plano gratuito com funcionalidades limitadas e planos pagos com recursos adicionais.`,
    `Assinaturas são renovadas automaticamente ao fim de cada ciclo, salvo cancelamento prévio. Você pode cancelar a qualquer momento e continuará com acesso até o fim do período já pago.`,
    `Conforme o Código de Defesa do Consumidor, você pode desistir da contratação em até 7 dias, com reembolso integral.`,
    `Preços podem mudar, com aviso prévio de 30 dias; alterações não afetam ciclos já pagos.`,
  ]},
  { t:"Disponibilidade", p:[
    `Trabalhamos para manter o serviço no ar, mas não garantimos funcionamento ininterrupto. Podem ocorrer manutenções e instabilidades de terceiros.`,
    `Recomendamos exportar seus dados periodicamente, função disponível em Gerenciar conta.`,
  ]},
  { t:"Propriedade intelectual", p:[
    `A marca, o código e o design do Von Finance nos pertencem. Os dados que você insere continuam sendo seus.`,
  ]},
  { t:"Encerramento", p:[
    `Você pode excluir sua conta a qualquer momento pelo app, o que remove permanentemente seus dados.`,
    `Podemos encerrar o serviço mediante aviso prévio de 30 dias, garantindo a exportação dos seus dados.`,
  ]},
  { t:"Foro e legislação", p:[
    `Estes termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio do consumidor para dirimir controvérsias.`,
    `Dúvidas: ${EMAIL_CONTATO}. Versão ${VERSAO_DOCS}, vigente desde ${DATA_VIGENCIA}.`,
  ]},
];
