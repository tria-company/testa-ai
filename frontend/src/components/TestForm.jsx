import { useState } from 'react';

const initialForm = {
  agentWhatsappNumber: '',
  agentPrompt: '',
  messageCount: 10,
  evolutionApiUrl: '',
  evolutionInstanceName: '',
  evolutionApiKey: '',
};

export default function TestForm({ onStart, disabled }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.agentWhatsappNumber || !form.agentPrompt || !form.evolutionApiUrl || !form.evolutionInstanceName || !form.evolutionApiKey) {
      setError('Preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      await onStart(form);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Numero do Agente (WhatsApp)
        </label>
        <input
          type="text"
          name="agentWhatsappNumber"
          value={form.agentWhatsappNumber}
          onChange={handleChange}
          placeholder="5511999999999"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Prompt / Instrucoes do Agente
        </label>
        <textarea
          name="agentPrompt"
          value={form.agentPrompt}
          onChange={handleChange}
          placeholder="Cole aqui o prompt completo do seu agente..."
          rows={6}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Quantidade de Mensagens
        </label>
        <input
          type="number"
          name="messageCount"
          value={form.messageCount}
          onChange={handleChange}
          min={1}
          max={50}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={disabled}
        />
      </div>

      <div className="border-t border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Evolution API</h3>
        <div className="space-y-3">
          <input
            type="text"
            name="evolutionApiUrl"
            value={form.evolutionApiUrl}
            onChange={handleChange}
            placeholder="URL da API (https://evo.exemplo.com)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
          />
          <input
            type="text"
            name="evolutionInstanceName"
            value={form.evolutionInstanceName}
            onChange={handleChange}
            placeholder="Nome da instancia"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
          />
          <input
            type="password"
            name="evolutionApiKey"
            value={form.evolutionApiKey}
            onChange={handleChange}
            placeholder="API Key"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled}
          />
        </div>
      </div>


      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
      >
        {loading ? 'Iniciando teste...' : 'Iniciar Teste'}
      </button>
    </form>
  );
}
