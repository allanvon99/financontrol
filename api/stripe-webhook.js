const Stripe = require('stripe');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = admin.firestore();

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let event;
  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook com assinatura inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.client_reference_id || session.metadata?.uid;
        if (uid) {
          await db.collection('usuarios').doc(uid).set({
            plano: 'pro',
            assinaturaId: session.subscription,
          }, { merge: true });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const uid = sub.metadata?.uid;
        if (uid) {
          const ativo = sub.status === 'active' || sub.status === 'trialing';
          await db.collection('usuarios').doc(uid).set({
            plano: ativo ? 'pro' : 'free',
          }, { merge: true });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const uid = sub.metadata?.uid;
        if (uid) {
          await db.collection('usuarios').doc(uid).set({
            plano: 'free',
          }, { merge: true });
        }
        break;
      }
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Erro processando evento do webhook:', err);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
};

module.exports.config = { api: { bodyParser: false } };
