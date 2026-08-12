/**
 * @fileoverview Layout principal para paginas do painel administrativo.
 * Combina Sidebar e Header em uma estrutura responsiva com area de conteudo.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

/**
 * Componente de layout wrapper para todas as rotas administrativas.
 * Estrutura: sidebar fixo a esquerda (w-64) com area de conteudo a direita.
 * Em telas menores, o sidebar fica oculto e pode ser ativado via botao hamburger.
 *
 * @returns {JSX.Element} Layout administrativo com sidebar e header
 */
const AdminLayout = () => {
  /** @type {[boolean, Function]} Controla visibilidade do sidebar em mobile */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * Alterna a visibilidade do sidebar em telas pequenas.
   */
  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  /**
   * Fecha o sidebar (usado em mobile ao navegar).
   */
  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      {/* Sidebar de navegacao */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Area de conteudo principal */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Header superior */}
        <Header onMenuToggle={toggleSidebar} showMenuButton={true} />

        {/* Conteudo das rotas filhas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
