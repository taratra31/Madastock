import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import api from '../lib/api';

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'Comment créer un produit ?',
  'Comment encaisser une vente ?',
  'Comment faire une facture PDF ?',
  'Comment déclarer une caisse ?',
];

export default function AiAssistant({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      role: 'assistant',
      content: "Bonjour ! Je suis l'assistant MadaStock. Posez-moi une question sur un module (ventes, stock, factures, caisse…) et je vous guide pas à pas. 😊",
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setInput('');
    const history: UiMessage[] = [...messages, { role: 'user', content }];
    setMessages(history);
    setSending(true);
    try {
      const res = await api.post('/ai/chat', { messages: history });
      setMessages((prev) => [...prev, { role: 'assistant', content: (res.data as { reply: string }).reply }]);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const errorMsg =
        status === 503
          ? "L'assistant n'est pas encore activé sur ce serveur (clé Gemini manquante)."
          : status === 401 || status === 403
            ? 'Votre session a expiré. Reconnectez-vous puis réessayez.'
            : "Impossible de contacter l'assistant. Réessayez.";
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      {!open && (
        <button
          onClick={onOpen}
          aria-label="Assistant MadaStock"
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Panneau */}
      {open && (
        <div className="fixed inset-0 z-50 lg:inset-auto lg:bottom-5 lg:right-5 lg:w-96 lg:h-[540px] lg:max-h-[calc(100vh-6rem)] lg:rounded-2xl flex flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="shrink-0 flex items-center gap-2.5 px-4 h-14 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
            <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Assistant MadaStock</p>
              <p className="text-[11px] text-emerald-100 leading-tight">Posez une question sur un module</p>
            </div>
            <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-white/15">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 rounded-bl-md'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-white ring-1 ring-slate-200 px-3.5 py-2.5 text-slate-400 text-[13px]">
                  <Loader2 className="w-4 h-4 animate-spin" /> L'assistant écrit…
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 px-3 pb-2 pt-1 border-t border-slate-100 bg-white">
            <div className="flex gap-1.5 pb-2 overflow-x-auto">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Votre question…"
                className="flex-1 min-w-0 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Envoyer"
                className="w-10 h-10 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 enabled:hover:bg-emerald-700 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}