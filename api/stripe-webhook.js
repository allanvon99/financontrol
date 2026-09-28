const Stripe = require('stripe');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
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

// A Stripe passou a expor current_period_end dentro de items.data[] em vez do nível
// raiz da assinatura em versões mais recentes da API — tenta os dois formatos.
function getCurrentPeriodEnd(subscription) {
  if (subscription && subscription.current_period_end) return subscription.current_period_end;
  const item = subscription && subscription.items && subscription.items.data && subscription.items.data[0];
  return (item && item.current_period_end) || null;
}


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
          const dadosPlano = {
            plano: 'pro',
            assinaturaId: session.subscription,
            assinouEm: Date.now(), // usado pra calcular a janela de 7 dias de arrependimento (CDC art. 49)
          };
          // Busca a data de renovação diretamente na assinatura recém-criada,
          // já que o evento de checkout não traz current_period_end.
          if (session.subscription) {
            try {
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              const periodEnd = getCurrentPeriodEnd(subscription);
              if (periodEnd) {
                dadosPlano.renovacaoEm = periodEnd * 1000;
              }
            } catch (e) {
              console.error('Não foi possível buscar a assinatura para pegar a data de renovação:', e.message);
            }
          }
          await db.collection('usuarios').doc(uid).set(dadosPlano, { merge: true });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const uid = sub.metadata?.uid;
        if (uid) {
          const ativo = sub.status === 'active' || sub.status === 'trialing';
          const periodEndUpdated = getCurrentPeriodEnd(sub);
          await db.collection('usuarios').doc(uid).set({
            plano: ativo ? 'pro' : 'free',
            renovacaoEm: ativo && periodEndUpdated ? periodEndUpdated * 1000 : null,
            canceladoNoFimDoPeriodo: ativo ? !!sub.cancel_at_period_end : false,
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
            renovacaoEm: null,
            assinouEm: null,
            canceladoNoFimDoPeriodo: false,
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
