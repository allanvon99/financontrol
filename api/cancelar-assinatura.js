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

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); }
    });
  });
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

    const body = req.body && Object.keys(req.body).length ? req.body : await readBody(req);
    const action = body.action === 'reativar' ? 'reativar' : 'cancelar';

    const ref = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Usuário não encontrado' });
    const d = snap.data();

    if (d.plano !== 'pro' || !d.assinaturaId) {
      return res.status(400).json({ error: 'Você não tem uma assinatura ativa' });
    }

    const cancelAtPeriodEnd = action === 'cancelar';
    const subscription = await stripe.subscriptions.update(d.assinaturaId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    await ref.set({
      canceladoNoFimDoPeriodo: cancelAtPeriodEnd,
      renovacaoEm: subscription.current_period_end ? subscription.current_period_end * 1000 : (d.renovacaoEm || null),
    }, { merge: true });

    return res.status(200).json({ ok: true, canceladoNoFimDoPeriodo: cancelAtPeriodEnd });
  } catch (e) {
    console.error('Erro ao alterar cancelamento da assinatura:', e);
    return res.status(500).json({ error: 'Não foi possível concluir. Tente novamente em instantes.' });
  }
};
