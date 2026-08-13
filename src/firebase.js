import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_7xCosABAtKClwFoBPM3NqbS2rwRbVG4",
  authDomain: "finapp-b28c0.firebaseapp.com",
  projectId: "finapp-b28c0",
  storageBucket: "finapp-b28c0.firebasestorage.app",
  messagingSenderId: "524326559600",
  appId: "1:524326559600:web:5b3e8ddada5235b03379b5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = "pt-BR"; // emails de verificação/redefinição de senha saem em português
export const db = getFirestore(app);
