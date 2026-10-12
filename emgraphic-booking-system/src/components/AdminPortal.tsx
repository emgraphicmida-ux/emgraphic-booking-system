import React, { useState, useEffect, useCallback } from 'react';
import { Lock, ArrowLeft, ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react';
import { EmgraphicLogo } from './EmgraphicLogo';
import { AdminPanel } from './AdminPanel';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { Booking } from '../types/booking';

interface AdminPortalProps {
  onExit?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onExit }) => {
  const [adminKey, setAdminKey] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlKey = urlParams.get('admin') || urlParams.get('key');
        if (urlKey) return urlKey;
        return (
          sessionStorage.getItem('emgraphic_admin_key') ||
          localStorage.getItem('emgraphic_admin_key') ||
          ''
        );
      }
      return '';
    } catch {
      return '';
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') || urlParams.get('key')) {
          return true;
        }
      }
      return (
        sessionStorage.getItem('emgraphic_admin_auth') === 'true' ||
        localStorage.getItem('emgraphic_admin_auth') === 'true'
      );
    } catch {
      return false;
    }
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const loadBookings = useCallback(async () => {
    const keyToUse = adminKey;
    if (!keyToUse) return;
    try {
      const list = await apiService.getAdminBookings(keyToUse);
      if (Array.isArray(list)) {
        setBookings(list);
      }
    } catch (err) {
      console.error('Error loading admin bookings:', err);
      const local = storageService.getBookings();
      setBookings(local);
    }
  }, [adminKey]);

  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;

    // Load immediately
    loadBookings();

    // Live auto-polling every 4 seconds so registrations from client phones update automatically
    const pollInterval = setInterval(() => {
      loadBookings();
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, adminKey, loadBookings]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const inputKey = password.trim();
    if (!inputKey) {
      setError('Zəhmət olmasa inzibatçı şifrəsini daxil edin.');
      return;
    }

    setIsLoading(true);

    try {
      // Verify admin password directly with backend
      const res = await fetch('/api/admin/bookings', {
        headers: {
          'x-admin-key': inputKey,
          'Cache-Control': 'no-cache',
        },
      });

      if (res.ok) {
        const data = await res.json();
        try {
          sessionStorage.setItem('emgraphic_admin_key', inputKey);
          sessionStorage.setItem('emgraphic_admin_auth', 'true');
        } catch {}
        setAdminKey(inputKey);
        setIsAuthenticated(true);
        setBookings(data.bookings || []);
      } else {
        setError('İcazə verilmədi. Daxil edilmiş şifrə yanlışdır.');
      }
    } catch (err) {
      setError('Serverlə əlaqə qurularkən xəta baş verdi. Zəhmət olmasa təkrar cəhd edin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('emgraphic_admin_key');
      sessionStorage.removeItem('emgraphic_admin_auth');
      localStorage.removeItem('emgraphic_admin_key');
      localStorage.removeItem('emgraphic_admin_auth');
    } catch {}
    setAdminKey('');
    setIsAuthenticated(false);
  };

  const handleGoToClientSite = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      url.searchParams.delete('key');
      window.history.replaceState({}, '', url.toString());
    } catch {}
    if (onExit) {
      onExit();
    } else {
      window.location.href = '/';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
        <header className="mx-auto w-full max-w-md flex items-center justify-between pt-4">
          <button
            onClick={handleGoToClientSite}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Müştəri Saytına Qayıt</span>
          </button>
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">
            Təhlükəsiz Giriş
          </span>
        </header>

        <main className="mx-auto w-full max-w-sm my-auto py-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col items-center text-center">
              <div className="bg-white p-3 rounded-2xl shadow-md mb-4">
                <EmgraphicLogo size="md" />
              </div>

              <div className="flex items-center gap-2 mt-1 text-slate-200">
                <ShieldCheck className="h-5 w-5 text-[#F37021]" />
                <h1 className="text-base sm:text-lg font-bold">
                  Studiya İnzibatçı Portalı
                </h1>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                Qeydiyyatları idarə etmək üçün təhlükəsiz şifrəni daxil edin
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">
                  Admin Şifrəsi:
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="İnzibatçı şifrəsini daxil edin"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-3 px-3 pl-9 pr-10 text-sm text-white placeholder-slate-500 focus:border-[#F37021] focus:ring-1 focus:ring-[#F37021] focus:outline-none"
                  />
                  <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-white cursor-pointer"
                    title={showPassword ? 'Şifrəni gizlə' : 'Şifrəni göstər'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/50 p-2.5 text-xs text-red-300 leading-relaxed">
                  {error}
                </div>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-[#F37021] hover:bg-[#e06216] py-3 text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Yoxlanılır...' : 'Portala Daxil Ol'}
                </button>
              </div>
            </form>
          </div>
        </main>

        <footer className="mx-auto w-full max-w-md pb-4 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} Emgraphic Studio Management System
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <EmgraphicLogo size="sm" />
            <span className="hidden sm:inline-block h-4 w-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
              İnzibatçı Portalı
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleGoToClientSite}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Müştəri Saytına Bax</span>
              <span className="sm:hidden">Sayta Bax</span>
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
            >
              Çıxış
            </button>
          </div>
        </div>
      </header>

      {/* Admin Panel Body */}
      <main className="mx-auto w-full max-w-6xl px-3 sm:px-6 py-6 flex-1">
        <AdminPanel
          bookings={bookings}
          onRefresh={loadBookings}
          onClose={handleGoToClientSite}
          adminKey={adminKey}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-4 text-center text-xs text-slate-500">
        Emgraphic Studio İdarəetmə Paneli • Rəsmi İnzibatçı Portalı
      </footer>
    </div>
  );
};
