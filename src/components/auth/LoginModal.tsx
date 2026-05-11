import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const HUB_REGISTER_URL = 'https://hub.asciende.pro/register';

export default function LoginModal({ isOpen, onClose }: Props) {
  const { loginWithCredentials } = useAuth();
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const t = {
    title: language === 'es' ? 'Acceder al Laboratorio' : 'Access the Lab',
    subtitle: language === 'es'
      ? 'Ingresá con tu cuenta de Asciende Hub'
      : 'Sign in with your Asciende Hub account',
    email: language === 'es' ? 'Correo electrónico' : 'Email',
    password: language === 'es' ? 'Contraseña' : 'Password',
    submit: language === 'es' ? 'Ingresar' : 'Sign In',
    loading: language === 'es' ? 'Verificando...' : 'Verifying...',
    register: language === 'es' ? '¿No tenés cuenta? Registrarte en Hub' : "Don't have an account? Register on Hub",
    errorInvalid: language === 'es' ? 'Credenciales incorrectas. Verificá tu email y contraseña.' : 'Invalid credentials. Check your email and password.',
    errorNetwork: language === 'es' ? 'Error de conexión. Intentá de nuevo.' : 'Connection error. Please try again.',
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setTimeout(() => emailRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      await loginWithCredentials(email.trim(), password);
      // Success — AuthContext will update user state and App will re-render to authenticated view
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('401')) {
        setError(t.errorInvalid);
      } else {
        setError(t.errorNetwork);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-modal-in">
        {/* Glow */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

        <div className="relative bg-[#0d1117] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

          {/* Top accent line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

          <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <img src="/favicon.svg" alt="Asciende" className="w-7 h-7" />
                  <span className="text-xs text-white/30 uppercase tracking-widest font-medium">Asciende LAB</span>
                </div>
                <h2 className="text-xl font-bold text-white">{t.title}</h2>
                <p className="text-sm text-white/40 mt-1">{t.subtitle}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all flex-shrink-0 mt-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">
                  {t.email}
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all disabled:opacity-50"
                  placeholder="you@example.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">
                  {t.password}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 pr-11 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all disabled:opacity-50"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-rose-300">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full flex items-center justify-center gap-2 bg-white text-[#0d1117] font-semibold text-sm py-3.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t.loading}
                  </>
                ) : (
                  t.submit
                )}
              </button>
            </form>

            {/* Register link */}
            <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
              <a
                href={HUB_REGISTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/30 hover:text-white/60 transition-colors inline-flex items-center gap-1.5"
              >
                {t.register}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
