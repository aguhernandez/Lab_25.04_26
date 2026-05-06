import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getMenuForRole } from '../lib/navigation';

interface LayoutProps {
  children: ReactNode;
  currentView?: string;
  onNavigate?: (path: string) => void;
}

function getIconSVG(iconName: string, isMobile = false) {
  const sizeClass = isMobile ? 'w-6 h-6' : 'w-5 h-5';
  const icons: { [key: string]: JSX.Element } = {
    LayoutDashboard: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    Users: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    Activity: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    UserCog: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    Settings: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    TrendingUp: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    User: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    FileText: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    Ruler: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M9 11h6M9 15h6" />
      </svg>
    ),
    Droplets: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    Flame: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
      </svg>
    ),
    Thermometer: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
      </svg>
    ),
    FlaskConical: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6M9 3v7l-4.5 9.5A1 1 0 005.4 21h13.2a1 1 0 00.9-1.5L15 10V3" />
      </svg>
    ),
    FileDown: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h1M9 13h6M9 17h6" />
      </svg>
    ),
    Zap: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    BookOpen: (
      <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  };
  return icons[iconName] || icons.LayoutDashboard;
}

export default function Layout({ children, currentView, onNavigate }: LayoutProps) {
  const { user, profile, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  const rawRole = profile?.role || user?.role || 'athlete';
  const normalizedRole = rawRole === 'trainer' ? 'coach' : rawRole;
  const menuItems = getMenuForRole(normalizedRole as 'admin' | 'coach' | 'athlete');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleMenuClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-20 hover:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col transition-all duration-300 group z-50">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 h-[100px] flex items-center justify-center overflow-hidden">
          <img
            src="/favicon.svg"
            alt="Asciende"
            className="w-12 h-12 object-contain block group-hover:hidden flex-shrink-0"
          />
          <img
            src="/logo_transp.png"
            alt="Asciende Logo"
            className="w-48 h-auto object-contain hidden group-hover:block"
          />
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {menuItems.map((item, index) => {
            const isActive = currentView === item.path || currentView === item.path.substring(1);
            const prevItem = index > 0 ? menuItems[index - 1] : null;
            const showSectionHeader = item.section && item.section !== prevItem?.section;
            return (
              <div key={item.path}>
                {showSectionHeader && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity px-3 pt-3 pb-1">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider font-body truncate">{item.section}</p>
                  </div>
                )}
                <button
                  onClick={() => handleMenuClick(item.path)}
                  className={`w-full flex items-center justify-center group-hover:justify-start gap-3 px-3 py-3 mb-1 rounded-lg transition-all font-body font-medium text-sm ${
                    isActive
                      ? 'bg-[#fdda36] text-[#514163]'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {getIconSVG(item.icon)}
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">{t(item.labelKey)}</span>
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <div className="opacity-0 group-hover:opacity-100 flex items-center flex-col group-hover:flex-row justify-center gap-2 mb-3 transition-opacity">
            <button
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-body text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{language === 'es' ? 'ES' : 'EN'}</span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-body text-sm"
            >
              {theme === 'dark' ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t('layout.light')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t('layout.dark')}</span>
                </>
              )}
            </button>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center group-hover:justify-start gap-3 px-3 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all font-body text-sm"
          >
            <div className="flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">{t('layout.logout')}</span>
          </button>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center group-hover:justify-start gap-2">
              <div className="w-10 h-10 rounded-full bg-[#fdda36] flex items-center justify-center text-[#514163] font-semibold text-sm flex-shrink-0">
                {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden">
                <p className="text-xs font-body text-gray-900 dark:text-white truncate">{profile?.full_name || user?.email || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-body truncate capitalize">{profile?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center justify-around px-2 py-2 safe-bottom">
          {menuItems.slice(0, 4).map((item) => {
            const isActive = currentView === item.path || currentView === item.path.substring(1);
            return (
              <button
                key={item.path}
                onClick={() => handleMenuClick(item.path)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all min-w-[64px] ${
                  isActive
                    ? 'bg-[#fdda36] text-[#514163]'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {getIconSVG(item.icon, true)}
                <span className="text-xs font-body font-medium">{t(item.labelKey)}</span>
              </button>
            );
          })}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 min-w-[64px]"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="19" cy="12" r="2"/>
              </svg>
              <span className="text-xs font-body font-medium">{t('layout.more')}</span>
            </button>

            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="fixed bottom-20 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg border-t border-gray-200 dark:border-gray-700 py-2 z-50 max-h-[60vh] overflow-y-auto animate-slideUp">
                  {menuItems.slice(4).map((item) => {
                    const isActive = currentView === item.path || currentView === item.path.substring(1);
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          handleMenuClick(item.path);
                          setShowMoreMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left font-body font-medium text-sm ${
                          isActive
                            ? 'bg-[#fdda36] text-[#514163]'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {getIconSVG(item.icon)}
                        <span>{t(item.labelKey)}</span>
                      </button>
                    );
                  })}

                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

                  <button
                    onClick={() => {
                      setLanguage(language === 'es' ? 'en' : 'es');
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-body text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{language === 'es' ? t('layout.english') : t('layout.spanish')}</span>
                  </button>

                  <button
                    onClick={() => {
                      toggleTheme();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-body text-sm"
                  >
                    {theme === 'dark' ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>{t('layout.lightMode')}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                        <span>{t('layout.darkMode')}</span>
                      </>
                    )}
                  </button>

                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

                  <button
                    onClick={() => {
                      logout();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 font-body text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>{t('layout.logout')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-40">
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          <img
            src="/logo_transp.png"
            alt="Asciende Logo"
            className="h-8 w-auto object-contain"
          />
          <div className="text-center">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('app.title')}
            </h1>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-body">
              {t('app.subtitle')}
            </p>
          </div>
        </div>
      </div>

      <main className="pb-20 lg:pb-0 pt-20 lg:pt-0 lg:ml-20">
        {children}
      </main>
    </div>
  );
}
