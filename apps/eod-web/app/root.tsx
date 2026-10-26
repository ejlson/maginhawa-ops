import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from 'react-router';
import type { ReactNode } from 'react';
import { AuthProvider } from './lib/auth';
import './styles.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <title>Maginhawa Ops</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// SPA mode: the build only renders this fallback; everything else runs in the browser.
export async function clientLoader() {
  return null;
}

export function HydrateFallback() {
  return <div className="page" aria-busy="true" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const message = isRouteErrorResponse(error) ? (error.status === 404 ? 'That page does not exist.' : error.statusText) : 'Something went wrong. Your report is still saved on this device.';
  return (
    <main className="page">
      <div className="body" style={{ paddingTop: 56 }}>
        <div className="titleblock"><h1>Sorry</h1><p className="lead">{message}</p></div>
        <a className="btn b1" href="/">Go to home</a>
      </div>
    </main>
  );
}
