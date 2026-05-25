import React from 'react';
import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { logOut } from '../lib/firebase';
import { CertificateIcon } from './CertificateIcon';
import { AnimatePresence, motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Upload, 
  Stethoscope, 
  Users, 
  LogOut,
  Menu,
  Sun,
  Moon,
  Monitor,
  Building,
  Activity,
  CreditCard,
  Settings as SettingsIcon
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const { user, profile, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['superadmin', 'admin', 'rh', 'medico', 'colaborador'] },
    { name: 'Enviar Atestado', href: '/upload', icon: Upload, roles: ['admin', 'rh', 'colaborador'] },
    { name: 'Meus Atestados', href: '/meus-atestados', icon: CertificateIcon, roles: ['superadmin', 'admin', 'rh', 'medico', 'colaborador'] },
    { name: 'Analytics', href: '/analytics', icon: Activity, roles: ['superadmin', 'admin', 'rh'] },
    { name: 'Painel Médico', href: '/painel-medico', icon: Stethoscope, roles: ['superadmin', 'admin', 'medico'] },
    { name: 'Gestão RH', href: '/gestao-rh', icon: Users, roles: ['superadmin', 'admin', 'rh'] },
    { name: 'Meu Plano', href: '/meu-plano', icon: CreditCard, roles: ['superadmin', 'admin', 'rh'] },
    { name: 'Configurações', href: '/configuracoes', icon: SettingsIcon, roles: ['superadmin', 'admin', 'rh'] },
    { name: 'Empresas (SaaS)', href: '/admin/empresas', icon: Building, roles: ['superadmin'] },
  ];

  const filteredNav = navigation.filter(item => profile?.role && item.roles.includes(profile.role));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 256 : 80 }}
        className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden whitespace-nowrap z-20"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
          <AnimatePresence mode="popLayout">
            {isSidebarOpen && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="font-bold text-xl text-indigo-600 dark:text-indigo-400 truncate"
              >
                MedControl
              </motion.span>
            )}
          </AnimatePresence>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 ml-auto">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  isActive 
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" 
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500")} />
                <AnimatePresence mode="popLayout">
                  {isSidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="font-medium"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className={cn("flex items-center gap-3 mb-4", !isSidebarOpen && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold flex-shrink-0">
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <AnimatePresence mode="popLayout">
              {isSidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{profile?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">{profile?.role}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={logOut}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors",
              !isSidebarOpen && "justify-center"
            )}
            title={!isSidebarOpen ? "Sair" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence mode="popLayout">
              {isSidebarOpen && (
                 <motion.span 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   transition={{ duration: 0.2 }}
                 >
                   Sair
                 </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {filteredNav.find(item => item.href === location.pathname)?.name || 'MedControl'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
              title="Alternar Tema"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : theme === 'light' ? <Moon className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8 text-gray-900 dark:text-gray-100 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
