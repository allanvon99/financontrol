let resultado = {};

try {
  const Stripe = require('stripe');
  resultado.passo1_require_stripe = "ok";

  const admin = require('firebase-admin');
  resultado.passo2_require_admin = "ok";

  resultado.passo3_env_vars = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "presente (" + process.env.FIREBASE_PROJECT_ID.length + " chars)" : "AUSENTE",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "presente (" + process.env.FIREBASE_CLIENT_EMAIL.length + " chars)" : "AUSENTE",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "presente (" + process.env.FIREBASE_PRIVATE_KEY.length + " chars)" : "AUSENTE",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? "presente (" + process.env.STRIPE_SECRET_KEY.length + " chars)" : "AUSENTE",
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID ? "presente (" + process.env.STRIPE_PRICE_ID.length + " chars)" : "AUSENTE",
  };

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  resultado.passo4_firebase_init = "ok";

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  resultado.passo5_stripe_init = "ok";

} catch (e) {
  resultado.erro = e.message;
  resultado.erro_stack = e.stack;
}

module.exports = async (req, res) => {
  return res.status(200).json(resultado);
};
