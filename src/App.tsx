import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UploadAtestado from './pages/UploadAtestado';
import AtestadosList from './pages/AtestadosList';
import PainelMedico from './pages/PainelMedico';
import GestaoRH from './pages/GestaoRH';
import SuperAdminCompanies from './pages/SuperAdminCompanies';
import Analytics from './pages/Analytics';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="medcontrol-theme">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<UploadAtestado />} />
              <Route path="/meus-atestados" element={<AtestadosList />} />
              <Route path="/painel-medico" element={<PainelMedico />} />
              <Route path="/gestao-rh" element={<GestaoRH />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/meu-plano" element={<Subscription />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/admin/empresas" element={<SuperAdminCompanies />} />
              {/* Outras rotas serão adicionadas aqui */}
              <Route path="*" element={<div className="p-4">Página não encontrada</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
