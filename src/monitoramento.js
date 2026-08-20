import * as Sentry from "@sentry/react";
import ReactGA from "react-ga4";

const SENTRY_DSN = "https://2918ba59ba4b101d9fff0547799da8e3@o4511865812680704.ingest.us.sentry.io/4511865824018432";
const GA_ID = "G-JVK0YD4DVQ";
const ehProducao = window.location.hostname !== "localhost";

export function iniciarMonitoramento() {
  if (!ehProducao) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: "production",
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
    // Não envia dados financeiros do usuário
    beforeSend(event) {
      if (event.request?.url) event.request.url = event.request.url.split("?")[0];
      return event;
    },
    ignoreErrors: ["ResizeObserver loop", "Non-Error promise rejection"],
  });

  ReactGA.initialize(GA_ID);
  ReactGA.send({ hitType: "pageview", page: "/" });

  // Exposto no console do navegador só pra facilitar teste manual do monitoramento.
  // Inofensivo deixar (o Sentry já roda no app inteiro de qualquer forma).
  window.Sentry = Sentry;
}

// Identifica o usuário (sem expor dados sensíveis)
export function identificarUsuario(uid, plano) {
  if (!ehProducao) return;
  Sentry.setUser({ id: uid });
  ReactGA.set({ userId: uid, user_properties: { plano: plano || "free" } });
}

export function limparUsuario() {
  if (!ehProducao) return;
  Sentry.setUser(null);
}

// Registra navegação entre telas
export function registrarTela(nome) {
  if (!ehProducao) return;
  ReactGA.send({ hitType: "pageview", page: `/${nome}`, title: nome });
}

// Registra ações importantes
export function registrarEvento(nome, params = {}) {
  if (!ehProducao) return;
  ReactGA.event(nome, params);
}

// Captura erro manualmente
export function registrarErro(erro, contexto = {}) {
  console.error(erro);
  if (!ehProducao) return;
  Sentry.captureException(erro, { extra: contexto });
}

export { Sentry };
