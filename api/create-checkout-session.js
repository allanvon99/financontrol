let erroInicializacao = null;
let stripe = null;
let admin = null;

try {
  const Stripe = require('stripe');
  admin = require('firebase-admin');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }

  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} catch (e) {
  erroInicializacao = e.message;
}

module.exports = async (req, res) => {
  if (erroInicializacao) {
    return res.status(500).json({ error: `Erro na inicialização: ${erroInicializacao}` });
  }
  return res.status(200).json({ teste: "inicializou sem erro" });
};
