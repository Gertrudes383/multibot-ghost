/**
 * @fileoverview Componente de rodape da aplicacao.
 * Exibe informacoes de copyright e links uteis na parte inferior da pagina.
 */

import { Link } from 'react-router-dom';

/**
 * Componente Footer exibido na parte inferior das paginas publicas e de usuario.
 * Contém texto de copyright e links para termos e suporte.
 *
 * @returns {JSX.Element} Rodape da aplicacao
 */
const Footer = () => {
  /** @type {number} Ano atual para exibicao no copyright */
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-6 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Texto de copyright */}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          &copy; {currentYear} MultiBots. Todos os direitos reservados.
        </p>

        {/* Links do rodape */}
        <nav className="flex items-center gap-6">
          <Link
            to="/terms"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Termos de Uso
          </Link>
          <Link
            to="/privacy"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Privacidade
          </Link>
          <Link
            to="/support"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Suporte
          </Link>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
