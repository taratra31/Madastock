import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Tags } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, Loading, PageHeader, ErrorMessage } from '../components/ui';

interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
}

export default function Categories() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data as Category[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await api.post('/categories', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Catégorie créée');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setName('');
      setDescription('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Catégorie supprimée');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erreur'),
  });

  return (
    <div>
      <PageHeader
        title="Catégories"
        subtitle="Organisez votre catalogue de produits"
        actions={
          <Button onClick={() => createMutation.mutate({ name, description: description || undefined })} disabled={!name.trim() || createMutation.isPending}>
            <Plus className="w-4 h-4" />
            Nouvelle catégorie
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold text-dark-900 mb-4">Vos catégories</h3>
          {error ? (
            <ErrorMessage message={(error as any).response?.data?.error ?? 'Erreur de chargement'} />
          ) : isLoading ? (
            <Loading />
          ) : !categories || categories.length === 0 ? (
            <EmptyState title="Aucune catégorie" description="Créez votre première catégorie." />
          ) : (
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                      <Tags className="w-4 h-4 text-green-600" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-dark-900 truncate">{c.name}</p>
                      {c.description && <p className="text-xs text-slate-400 truncate">{c.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                      {c._count?.products ?? 0} produit(s)
                    </span>
                    <Button variant="ghost" size="sm" className="hover:text-red-600" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 h-fit">
          <h3 className="font-semibold text-dark-900 mb-4">Ajouter une catégorie</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ name: name.trim(), description: description.trim() || undefined });
            }}
            className="space-y-4"
          >
            <Field label="Nom" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex : Épicerie" />
            </Field>
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionnel" />
            </Field>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer'}
            </Button>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer la catégorie"
        message={`Voulez-vous vraiment supprimer « ${deleteTarget?.name} » ?`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}