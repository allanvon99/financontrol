const Stripe = require('stripe');
const admin = require('firebase-admin');

const FALTANDO = [];
if (!process.env.FIREBASE_PROJECT_ID) FALTANDO.push('FIREBASE_PROJECT_ID');
if (!process.env.FIREBASE_CLIENT_EMAIL) FALTANDO.push('FIREBASE_CLIENT_EMAIL');
if (!process.env.FIREBASE_PRIVATE_KEY) FALTANDO.push('FIREBASE_PRIVATE_KEY');
if (!process.env.STRIPE_SECRET_KEY) FALTANDO.push('STRIPE_SECRET_KEY');
if (!process.env.STRIPE_PRICE_ID) FALTANDO.push('STRIPE_PRICE_ID');

if (!admin.apps.length && FALTANDO.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const stripe = FALTANDO.length === 0 ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  if (FALTANDO.length > 0) {
    console.error('Variáveis de ambiente faltando:', FALTANDO.join(', '));
    return res.status(500).json({ error: `Faltam variáveis de ambiente: ${FALTANDO.join(', ')}` });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.replace('Bearer ', '');
    if (!idToken) return res.status(401).json({ error: 'Não autenticado' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    const origin = req.headers.origin || 'https://vonfinance.vercel.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: uid,
      customer_email: email,
      success_url: `${origin}/?checkout=sucesso`,
      cancel_url: `${origin}/?checkout=cancelado`,
      metadata: { uid },
      subscription_data: { metadata: { uid } },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('Erro ao criar checkout session:', e);
    return res.status(500).json({ error: 'Erro ao criar sessão de checkout' });
  }
};
