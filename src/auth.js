import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, getAnalyticsIfSupported } from "./firebase";
import { isAdminUid } from "./services/roles";

function escapeHtml(str) {
  // Prefer global escapeHtml from legacy code if present.
  if (typeof window !== "undefined" && typeof window.escapeHtml === "function") return window.escapeHtml(str);
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML.replace(/"/g, "&quot;");
}

function renderAuthArea(user) {
  const el = document.getElementById("authArea");
  if (!el) return;

  if (!user) {
    el.innerHTML =
      '<button type="button" class="secondary" id="btnAuthOpen">Войти</button>' +
      '<small class="auth-hint">или продолжить как гость</small>';
    const btn = document.getElementById("btnAuthOpen");
    if (btn) btn.addEventListener("click", openAuthModal);
    return;
  }

  const label = user.displayName || user.email || "Пользователь";
  el.innerHTML =
    '<button type="button" class="auth-user auth-user--click" id="btnAuthProfile" aria-label="Открыть профиль">' +
    escapeHtml(label) +
    '</button><button type="button" class="secondary" id="btnAuthSignOut">Выйти</button>';
  const btnProfile = document.getElementById("btnAuthProfile");
  if (btnProfile)
    btnProfile.addEventListener("click", () => {
      if (typeof window !== "undefined" && window.Router && typeof window.Router.navigate === "function") {
        window.Router.navigate("#/me");
      } else {
        location.hash = "#/me";
      }
    });
  const btn = document.getElementById("btnAuthSignOut");
  if (btn) btn.addEventListener("click", () => signOut(auth));
}

function openAuthModal() {
  if (document.getElementById("authModalOverlay")) return;
  const overlay =
    '<div class="auth-overlay" id="authModalOverlay">' +
    '  <div class="auth-modal" role="dialog" aria-modal="true" aria-label="Вход">' +
    '    <div class="auth-modal-header">' +
    "      <h2>Вход</h2>" +
    '      <button type="button" class="secondary" id="btnAuthClose" aria-label="Закрыть">×</button>' +
    "    </div>" +
    '    <button type="button" id="btnAuthGoogle">Войти через Google</button>' +
    '    <div class="auth-divider">или</div>' +
    '    <label class="auth-label">Email<input type="email" id="authEmail" placeholder="you@example.com" autocomplete="email"></label>' +
    '    <label class="auth-label">Пароль<input type="password" id="authPass" placeholder="••••••••" autocomplete="current-password"></label>' +
    '    <div class="auth-actions">' +
    '      <button type="button" id="btnAuthEmailSignIn">Войти</button>' +
    '      <button type="button" class="secondary" id="btnAuthEmailSignUp">Регистрация</button>' +
    "    </div>" +
    '    <p class="auth-error" id="authError" aria-live="polite"></p>' +
    "  </div>" +
    "</div>";
  document.body.insertAdjacentHTML("beforeend", overlay);

  const close = () => {
    const o = document.getElementById("authModalOverlay");
    if (o && o.parentNode) o.parentNode.removeChild(o);
  };

  const btnClose = document.getElementById("btnAuthClose");
  if (btnClose) btnClose.addEventListener("click", close);
  const o = document.getElementById("authModalOverlay");
  if (o) o.addEventListener("click", (e) => (e.target === o ? close() : null));

  const setError = (msg) => {
    const e = document.getElementById("authError");
    if (e) e.textContent = msg || "";
  };

  const emailEl = document.getElementById("authEmail");
  const passEl = document.getElementById("authPass");
  const getCreds = () => ({
    email: emailEl ? String(emailEl.value || "").trim() : "",
    pass: passEl ? String(passEl.value || "") : "",
  });

  const btnGoogle = document.getElementById("btnAuthGoogle");
  if (btnGoogle)
    btnGoogle.addEventListener("click", async () => {
      setError("");
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        close();
      } catch (e) {
        setError("Не удалось войти через Google.");
        console.error(e);
      }
    });

  const btnSignIn = document.getElementById("btnAuthEmailSignIn");
  if (btnSignIn)
    btnSignIn.addEventListener("click", async () => {
      setError("");
      const { email, pass } = getCreds();
      if (!email || !pass) return setError("Введите email и пароль.");
      try {
        await signInWithEmailAndPassword(auth, email, pass);
        close();
      } catch (e) {
        setError("Не удалось войти. Проверьте данные.");
        console.error(e);
      }
    });

  const btnSignUp = document.getElementById("btnAuthEmailSignUp");
  if (btnSignUp)
    btnSignUp.addEventListener("click", async () => {
      setError("");
      const { email, pass } = getCreds();
      if (!email || !pass) return setError("Введите email и пароль.");
      if (pass.length < 6) return setError("Пароль должен быть минимум 6 символов.");
      try {
        await createUserWithEmailAndPassword(auth, email, pass);
        close();
      } catch (e) {
        setError("Не удалось зарегистрироваться.");
        console.error(e);
      }
    });
}

// Init
getAnalyticsIfSupported(); // fire-and-forget
onAuthStateChanged(auth, async (user) => {
  renderAuthArea(user);

  // Expose current user for legacy code (quiz stats, admin gate, etc.).
  if (typeof window !== "undefined") {
    window.__authUser = user || null;
    window.__isAdmin = false;
  }

  // Ensure user profile exists in Firestore for signed-in users.
  if (user) {
    try {
      const uid = user.uid;
      const userRef = doc(db, "users", uid);
      const exists = (await getDoc(userRef)).exists();
      const admin = await isAdminUid(uid);
      if (typeof window !== "undefined") window.__isAdmin = admin;
      if (!exists) {
        await setDoc(
          userRef,
          {
            role: admin ? "admin" : "student",
            createdAt: serverTimestamp(),
            displayName: user.displayName || null,
            email: user.email || null,
          },
          { merge: true }
        );
      }
    } catch (e) {
      // Don't break guest flow if Firestore not ready / blocked.
      console.warn("auth: failed to ensure user profile", e);
    }
  }
});

