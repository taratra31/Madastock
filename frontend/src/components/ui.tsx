import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { X, AlertTriangle, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400';

export const cardCls = 'bg-white rounded-xl border border-slate-200 shadow-sm';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'dark';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white shadow-sm shadow-green-500/20',
  outline: 'border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white',
  dark: 'bg-dark-900 hover:bg-dark-800 disabled:bg-slate-300 text-white',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors whitespace-nowrap',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', className)}>
      {children}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(cardCls, className)}>{children}</div>;
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputCls, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputCls, 'min-h-[90px]', className)} {...props} />;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-dark-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full bg-white rounded-2xl shadow-2xl my-4 sm:my-8', sizes[size])}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h3 className="text-lg font-bold text-dark-900">{title}</h3>
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'En cours...' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </span>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-400" />
        <div>
          <h2 className="text-2xl font-bold text-dark-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Rechercher...'}
        className={cn(inputCls, 'pl-9')}
      />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-12">
      <p className="font-medium text-slate-600">{title}</p>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-400">
      <span className="w-5 h-5 border-2 border-slate-300 border-t-green-600 rounded-full animate-spin mr-2" />
      Chargement...
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">{message}</div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  gradient = 'from-emerald-500 to-teal-500',
  sub,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  gradient?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 truncate">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md shadow-black/5`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}