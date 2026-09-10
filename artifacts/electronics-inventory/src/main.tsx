import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { AuthGate } from './auth';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import './ui-polish.css';
import './ui-upgrade.css';

const root = document.getElementById('root');
if (!root) throw new Error('Electronics Inventory: #root element was not found.');

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }
  interface WindowEventMap { beforeinstallprompt: BeforeInstallPromptEvent; }
}

function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferred(event);
    };
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  if (!deferred || installed) return null;
  return <button
    onClick={async () => {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    }}
    className="fixed bottom-24 right-4 z-50 rounded-full bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] shadow-xl transition hover:-translate-y-0.5"
  >Install Inventory</button>;
}

createRoot(root).render(
  <ErrorBoundary>
    <AuthGate>
      <App />
      <InstallPrompt />
    </AuthGate>
  </ErrorBoundary>,
);
