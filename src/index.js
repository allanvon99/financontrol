import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Timeout de segurança — se travar por mais de 8 segundos, mostra erro
const timeout = setTimeout(() => {
  document.getElementById('root').innerHTML = `
    <div style="color:#fff;padding:24px;font-family:sans-serif;background:#0d1117;min-height:100vh">
      <h2 style="color:#f85149">⚠️ App travado no carregamento</h2>
      <p style="color:#8b949e">Possível problema de conexão com Firebase.</p>
      <p style="color:#8b949e">Verifique as regras do Firestore ou a conexão com internet.</p>
      <button onclick="location.reload()" style="margin-top:16px;padding:12px 24px;background:#2188c9;border:none;borderRadius:8px;color:#fff;cursor:pointer;font-size:1rem">
        Tentar novamente
      </button>
    </div>
  `;
}, 8000);

onAuthStateChanged(auth, () => clearTimeout(timeout));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
