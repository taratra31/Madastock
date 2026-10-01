import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, ArrowRight, RotateCw } from 'lucide-react';
import api from '../lib/api';

interface Suggestion {
  type: string;
  title: string;
  message: string;
  actionPath: string;
}

export default function SuggestionsCard() {
  const navigate = useNavigate();

  // Geré via useQuery : invalidation automatique au changement de boutique.
  const { data, isFetching, refetch } = useQuery<Suggestion[]>({
    queryKey: ['ai-suggestions'],
    queryFn: async () => {
      const res = await api.get('/ai/suggestions');
      return (res.data as { suggestions: Suggestion[] }).suggestions;
    },
    retry: false,
  });

  const suggestions = data ?? [];
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-indigo-900">
          <span className="inline-flex w-7 h-7 rounded-lg bg-indigo-600 text-white items-center justify-center">
            <Lightbulb className="w-4 h-4" />
          </span>
          Suggestions intelligentes
        </p>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-100 transition-colors"
          title="Actualiser"
        >
          <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {suggestions.map((s) => (
          <button
            key={s.type + s.title}
            onClick={() => navigate(s.actionPath)}
            className="group text-left rounded-xl bg-white ring-1 ring-indigo-200 hover:ring-indigo-400 p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <p className="text-[13px] font-semibold text-dark-900 flex items-center gap-1.5">
              {s.title}
              <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            {s.message && <p className="mt-1 text-xs text-slate-500 leading-relaxed">{s.message}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}