import { useState, useEffect } from 'react';
import { getTunnelInfo } from '../services/api';

export default function TunnelStatus() {
  const [tunnel, setTunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let interval;

    const fetch = async () => {
      try {
        const data = await getTunnelInfo();
        setTunnel(data);
        if (data.status === 'connected') {
          setLoading(false);
          clearInterval(interval);
        }
      } catch {
        // backend still starting
      }
    };

    fetch();
    interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !tunnel) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-sm text-yellow-300">Criando tunel publico...</span>
        </div>
      </div>
    );
  }

  if (tunnel.status === 'disconnected') {
    return (
      <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-sm text-red-300">Tunel nao conectado. Configure WEBHOOK_BASE_URL no .env do backend.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-sm text-emerald-300">Tunel ativo</span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">URL Publica</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-gray-800 text-emerald-300 px-2 py-1 rounded flex-1 truncate">
              {tunnel.url}
            </code>
            <button
              onClick={() => handleCopy(tunnel.url)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors shrink-0"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Webhook Endpoint</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-gray-800 text-blue-300 px-2 py-1 rounded flex-1 truncate">
              {tunnel.webhookEndpoint}
            </code>
            <button
              onClick={() => handleCopy(tunnel.webhookEndpoint)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors shrink-0"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
