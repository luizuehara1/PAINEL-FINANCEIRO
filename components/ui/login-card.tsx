"use client";

import React, { useState, useRef, MouseEvent, useEffect } from "react";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert,
  TrendingUp,
  Chrome,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  sendPasswordResetEmail, 
  signOut, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAllowedEmail } from "@/lib/auth";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export default function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);

  // Redireciona automaticamente se já estiver logado e autorizado
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && isAllowedEmail(user.email)) {
        window.history.pushState({}, "", "/dashboard");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    });
    return () => unsubscribe();
  }, []);

  // 3D Card Tilt State
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const addToast = (type: "success" | "error" | "info", message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Smooth rotation - limit tilt up to 6 degrees for standard desktop usability
    const rotateXValue = ((y - centerY) / centerY) * -6;
    const rotateYValue = ((x - centerX) / centerX) * 6;
    
    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      addToast("error", "Por favor, preencha o e-mail e a senha.");
      return;
    }

    setIsLoading(true);
    
    try {
      // Configura persistência com base no "Lembrar acesso"
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      if (!isAllowedEmail(user.email)) {
        await signOut(auth);
        addToast("error", "Você não tem permissão para acessar este painel.");
        setIsLoading(false);
        return;
      }
      
      addToast("success", "Login realizado com sucesso! Redirecionando...");
      
      setTimeout(() => {
        window.history.pushState({}, "", "/dashboard");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 1000);
    } catch (error: any) {
      console.error(error);
      let errorMsg = "Ocorreu um erro ao fazer login. Verifique suas credenciais.";
      if (error.code === "auth/unauthorized-domain" || (error.message && error.message.includes("unauthorized-domain"))) {
        setUnauthorizedDomain(window.location.hostname);
        errorMsg = "Erro: Domínio não autorizado no Firebase. Veja as instruções abaixo.";
      } else if (
        error.code === "auth/invalid-credential" || 
        error.code === "auth/user-not-found" || 
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-email"
      ) {
        errorMsg = "E-mail ou senha incorretos.";
      } else if (error.code === "auth/too-many-requests") {
        errorMsg = "Acesso temporariamente bloqueado devido a muitas tentativas. Tente mais tarde.";
      } else if (error.message) {
        errorMsg = error.message;
      }
      addToast("error", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Configura persistência com base no "Lembrar acesso"
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      if (!isAllowedEmail(user.email)) {
        await signOut(auth);
        addToast("error", "Você não tem permissão para acessar este painel.");
        setIsLoading(false);
        return;
      }
      
      addToast("success", "Login com Google realizado! Redirecionando...");
      
      setTimeout(() => {
        window.history.pushState({}, "", "/dashboard");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, 1000);
    } catch (error: any) {
      const isPopupClosed = error.code === "auth/popup-closed-by-user" || 
                            error.message?.includes("popup-closed-by-user") ||
                            error.message?.includes("auth/popup-closed-by-user");
      
      if (!isPopupClosed) {
        console.error(error);
      }
      
      if (error.code === "auth/unauthorized-domain" || (error.message && error.message.includes("unauthorized-domain"))) {
        setUnauthorizedDomain(window.location.hostname);
        addToast("error", "Erro: Domínio não autorizado no Firebase. Veja as instruções abaixo.");
      } else if (!isPopupClosed) {
        addToast("error", "Erro ao fazer login com o Google: " + (error.message || error.code || error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      addToast("error", "Por favor, digite seu e-mail no campo correspondente para enviar o link de recuperação.");
      return;
    }
    
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      addToast("success", `E-mail de recuperação enviado para ${email}. Verifique sua caixa de entrada.`);
    } catch (error: any) {
      console.error(error);
      let errorMsg = "Erro ao enviar e-mail de recuperação.";
      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-email") {
        errorMsg = "E-mail inválido ou não cadastrado.";
      }
      addToast("error", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-4 bg-black text-white overflow-hidden">
      
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-lime-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-40" />

      {/* Toasts List */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="pointer-events-auto"
            >
              <div className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl ${
                toast.type === "success" 
                  ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-300"
                  : toast.type === "error"
                  ? "bg-red-950/80 border-red-500/30 text-red-300"
                  : "bg-zinc-900/90 border-zinc-700/50 text-zinc-300"
              }`}>
                {toast.type === "success" && <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-400" />}
                {toast.type === "error" && <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-400" />}
                {toast.type === "info" && <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" />}
                
                <div className="flex-1 text-sm font-medium leading-relaxed">
                  {toast.message}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Container with Entrance Animation */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[460px] z-10"
      >
        {/* Brand Logo Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-lime-400 shadow-lg shadow-emerald-500/20 mb-3">
            <TrendingUp className="w-6 h-6 text-black stroke-[2.5]" />
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-tr from-emerald-600 to-lime-400 opacity-30 blur-sm animate-pulse" />
          </div>
          <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
            Painel Financeiro
          </span>
        </div>

        {/* 3D Animated Card Frame */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transition: rotateX === 0 && rotateY === 0 ? "transform 0.5s ease-out" : "none",
          }}
          className="relative rounded-3xl p-[1px] overflow-hidden group shadow-2xl transition-all duration-300"
        >
          {/* Animated Glowing border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-500 rounded-3xl opacity-40 blur-[2px] transition duration-1000 group-hover:opacity-70 group-hover:blur-[1px]" />
          
          <div className="absolute -inset-[50%] bg-[conic-gradient(from_0deg,transparent_40%,#10b981_50%,#84cc16_60%,transparent_70%)] rounded-3xl opacity-20 animate-[spin_6s_linear_infinite]" />

          {/* Glassmorphism Inner Card Content */}
          <div className="relative bg-zinc-950/85 backdrop-blur-xl rounded-[23px] px-8 py-10 md:px-10 md:py-12 border border-white/5 flex flex-col">
            
            {/* Header Texts */}
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Bem-vindo de volta
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Acesse seu Painel Financeiro
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300 tracking-wide block">
                  E-mail
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 w-5 h-5 text-zinc-500 pointer-events-none group-focus-within:text-emerald-400 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-zinc-900/60 hover:bg-zinc-900/80 focus:bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/20"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300 tracking-wide block">
                    Senha
                  </label>
                  <a
                    href="#"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Esqueci minha senha
                  </a>
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 w-5 h-5 text-zinc-500 pointer-events-none transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900/60 hover:bg-zinc-900/80 focus:bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:ring-1 focus:ring-emerald-500/20"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors outline-none"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center">
                <label className="relative flex items-center gap-2.5 cursor-pointer select-none text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                    disabled={isLoading}
                  />
                  <div className="w-5 h-5 bg-zinc-900 border border-zinc-800 rounded-md flex items-center justify-center transition-all peer-checked:bg-emerald-500 peer-checked:border-emerald-500">
                    <svg
                      className="w-3.5 h-3.5 text-black stroke-[3] scale-0 peer-checked:scale-100 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Lembrar acesso</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="relative w-full group/btn overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 text-black font-semibold text-sm py-3 px-4 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 outline-none cursor-pointer disabled:opacity-85 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Carregando...</span>
                  </div>
                ) : (
                  <>
                    <span>Entrar no painel</span>
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Separator */}
            <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-zinc-600 text-xs tracking-wider uppercase font-medium">
                ou continue com
              </span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            {/* Google OAuth Visual Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 font-medium text-sm py-3 px-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 outline-none cursor-pointer disabled:opacity-50"
            >
              <Chrome className="w-4 h-4 text-emerald-400" />
              <span>Entrar com Google</span>
            </button>

            {/* Unauthorized Domain Error Helpful Guide */}
            {unauthorizedDomain && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/20 text-amber-200 text-xs space-y-3 text-left"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="font-semibold text-amber-300">Domínio não autorizado</p>
                    <p className="mt-1 text-zinc-400 leading-relaxed">
                      Para permitir o login, você precisa adicionar este domínio na lista de domínios autorizados no seu Console do Firebase:
                    </p>
                  </div>
                </div>
                
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between font-mono text-[10px] select-all">
                  <span className="text-zinc-300 break-all">{unauthorizedDomain}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(unauthorizedDomain);
                      addToast("success", "Domínio copiado!");
                    }}
                    className="text-emerald-400 hover:text-emerald-300 ml-2 font-sans font-semibold shrink-0 cursor-pointer text-[11px]"
                  >
                    Copiar
                  </button>
                </div>

                <div className="text-[10px] text-zinc-400 space-y-1 bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <p className="font-semibold text-zinc-300">Instruções para resolver:</p>
                  <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed text-zinc-400">
                    <li>
                      Acesse as{" "}
                      <a 
                        href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "seu-projeto-id"}/authentication/settings`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-emerald-400 hover:underline font-semibold"
                      >
                        Configurações de Autenticação
                      </a>{" "}
                      no seu Console do Firebase.
                    </li>
                    <li>Navegue até a aba <strong>Settings</strong> (Configurações) &gt; <strong>Authorized domains</strong> (Domínios autorizados).</li>
                    <li>Clique em <strong>Add domain</strong> (Adicionar domínio) e cole o domínio copiado acima.</li>
                  </ol>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer Admin Note */}
        <p className="mt-8 text-center text-xs text-zinc-600 tracking-wide">
          Acesso restrito para administradores
        </p>
      </motion.div>
    </div>
  );
}
