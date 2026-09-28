const Stripe = require('stripe');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = getFirestore();

const PRAZO_ARREPENDIMENTO_MS = 7 * 24 * 60 * 60 * 1000; // CDC art. 49

async function encontrarPaymentIntentId(subscription) {
  const invoiceRef = subscription.latest_invoice;
  const invoiceId = typeof invoiceRef === 'string' ? invoiceRef : invoiceRef && invoiceRef.id;
  if (!invoiceId) return null;

  try {
    const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payment_intent'] });
    if (invoice.payment_intent) {
      return typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent.id;
    }
  } catch (e) {
    console.error('Falha ao expandir payment_intent da invoice:', e.message);
  }

  try {
    const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payments.data.payment.payment_intent'] });
    const pagamento = invoice.payments && invoice.payments.data && invoice.payments.data[0] && invoice.payments.data[0].payment;
    const pi = pagamento && pagamento.payment_intent;
    if (pi) {
      return typeof pi === 'string' ? pi : pi.id;
    }
  } catch (e) {
    console.error('Falha ao buscar invoice.payments:', e.message);
  }

  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.replace('Bearer ', '');
    if (!idToken) return res.status(401).json({ error: 'Não autenticado' });
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const ref = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Usuário não encontrado' });
    const d = snap.data();

    if (d.plano !== 'pro' || !d.assinaturaId) {
      return res.status(400).json({ error: 'Você não tem uma assinatura ativa para cancelar' });
    }
    if (!d.assinouEm) {
      return res.status(400).json({ error: 'Não encontramos a data da sua assinatura. Fale com o suporte pelo email de contato.' });
    }

    const decorrido = Date.now() - Number(d.assinouEm);
    if (decorrido > PRAZO_ARREPENDIMENTO_MS) {
      return res.status(400).json({
        error: 'O prazo de 7 dias para arrependimento com reembolso integral já passou. Você ainda pode cancelar a renovação normalmente, mantendo acesso até o fim do período já pago.',
      });
    }

    const subscription = await stripe.subscriptions.retrieve(d.assinaturaId, { expand: ['latest_invoice'] });
    const paymentIntentId = await encontrarPaymentIntentId(subscription);

    if (!paymentIntentId) {
      console.error('Não foi possível localizar o pagamento para reembolso. uid=', uid, 'assinaturaId=', d.assinaturaId);
      return res.status(500).json({
        error: 'Não conseguimos localizar automaticamente o pagamento para reembolsar. Nada foi cancelado — fale com o suporte pelo email de contato pra concluirmos manualmente.',
      });
    }

    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
    } catch (e) {
      console.error('Erro ao criar reembolso na Stripe:', e.message);
      return res.status(500).json({
        error: 'Não conseguimos processar o reembolso automaticamente. Nada foi cancelado — fale com o suporte pelo email de contato pra concluirmos manualmente.',
      });
    }

    try {
      await stripe.subscriptions.cancel(d.assinaturaId);
    } catch (e) {
      console.error('Aviso ao cancelar assinatura (pode já estar cancelada):', e.message);
    }

    await ref.set({
      plano: 'free',
      renovacaoEm: null,
      assinouEm: null,
      reembolsoRealizadoEm: Date.now(),
      trialUsadoAnteriormente: true,
    }, { merge: true });

    return res.status(200).json({ ok: true, reembolsado: true });
  } catch (e) {
    console.error('Erro ao processar cancelamento com reembolso:', e);
    return res.status(500).json({ error: 'Erro ao processar o cancelamento. Tente novamente em instantes ou fale com o suporte.' });
  }
};
