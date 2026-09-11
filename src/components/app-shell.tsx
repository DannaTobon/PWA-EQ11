import Link from 'next/link';
import { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      {/* Header - Accesibilidad: banner landmark */}
      <header className="app-header" role="banner">
        <div className="app-header-inner">
          <Link href="/" className="app-brand">
            Inspecciones UTT
          </Link>
          
          {/* Navegación - Accesibilidad: navigation landmark */}
          <nav aria-label="Navegación principal">
            <ul className="app-nav-list">
              <li>
                <Link href="/inspections" className="app-nav-link">
                  Inspecciones
                </Link>
              </li>
              <li>
                <Link href="/maintenance" className="app-nav-link">
                  Mantenimiento
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main - Accesibilidad: main landmark */}
      <div id="main-content" className="app-main" role="main">
        {children}
      </div>

      {/* Footer - Accesibilidad: contentinfo landmark */}
      <footer className="app-footer" role="contentinfo">
        <div className="app-footer-inner">
          <p>
            &copy; {new Date().getFullYear()} DMI-EQ11C · Aplicaciones Web Progresivas
          </p>
        </div>
      </footer>
    </div>
  );
}
