import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { 
  getAvailableMonths, 
  formatMonthLabel, 
  getPreviousMonth, 
  getNextMonth 
} from '../../lib/monthUtils';

interface MonthSelectorProps {
  selectedMonth: string;
  onChange: (month: string) => void;
  transactions?: Array<{ date: string }>;
  allowAllOption?: boolean;
  className?: string;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onChange,
  transactions = [],
  allowAllOption = false,
  className = ''
}) => {
  const availableMonths = React.useMemo(() => {
    return getAvailableMonths(transactions, 'desc');
  }, [transactions]);

  const handlePrev = () => {
    if (selectedMonth === 'ALL') {
      if (availableMonths.length > 0) onChange(availableMonths[0]);
      return;
    }
    const prev = getPreviousMonth(selectedMonth);
    onChange(prev);
  };

  const handleNext = () => {
    if (selectedMonth === 'ALL') {
      if (availableMonths.length > 0) onChange(availableMonths[0]);
      return;
    }
    const next = getNextMonth(selectedMonth);
    onChange(next);
  };

  return (
    <div className={`flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-sm ${className}`}>
      <button
        type="button"
        onClick={handlePrev}
        title="Mês anterior"
        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="relative flex items-center">
        <Calendar className="w-3.5 h-3.5 text-blue-400 absolute left-2.5 pointer-events-none" />
        <select
          value={selectedMonth}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          {allowAllOption && (
            <option value="ALL">Todo o Histórico</option>
          )}

          {/* List all detected transaction months */}
          {availableMonths.map((ym) => (
            <option key={ym} value={ym}>
              {formatMonthLabel(ym, 'full')}
            </option>
          ))}

          {/* If the current selected month is not yet in availableMonths (e.g. manually set), include it */}
          {!availableMonths.includes(selectedMonth) && selectedMonth !== 'ALL' && (
            <option value={selectedMonth}>
              {formatMonthLabel(selectedMonth, 'full')}
            </option>
          )}
        </select>
        <div className="absolute right-2.5 pointer-events-none text-slate-400 text-[10px]">
          ▼
        </div>
      </div>

      <button
        type="button"
        onClick={handleNext}
        title="Próximo mês"
        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
