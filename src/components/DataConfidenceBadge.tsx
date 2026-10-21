import { useLanguage } from '../contexts/LanguageContext';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'no-data';

interface Props {
  level: ConfidenceLevel;
  reason: string;
}

export default function DataConfidenceBadge({ level, reason }: Props) {
  const { language } = useLanguage();
  const es = language === 'es';
  const labels: Record<ConfidenceLevel, string> = {
    high: es ? 'Confianza alta' : 'High confidence',
    medium: es ? 'Confianza media' : 'Medium confidence',
    low: es ? 'Confianza baja' : 'Low confidence',
    'no-data': es ? 'Sin dato' : 'No data',
  };
  const styles: Record<ConfidenceLevel, string> = {
    high: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
    medium: 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
    low: 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    'no-data': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };
  return <span title={reason} aria-label={`${labels[level]}: ${reason}`} tabIndex={0} className={`inline-flex cursor-help items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[level]}`}>{labels[level]}</span>;
}
