import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

interface CalendarPickerProps {
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  availableDates: string[]; // YYYY-MM-DD
  isOpen: boolean;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarPicker({
  selectedDate,
  onSelect,
  availableDates,
  isOpen,
  onClose,
}: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = selectedDate || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: (Date | null)[] = [];

    // Dias do mês anterior
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, daysInPrevMonth - i));
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push(new Date(year, month, i));
    }

    // Completar até 42 dias (6 semanas)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  }, [currentMonth]);

  const isDateAvailable = useCallback((date: Date) => {
    const key = date.toISOString().split('T')[0];
    return availableSet.has(key);
  }, [availableSet]);

  const isSameDay = (a: Date | null, b: Date | null) => {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  };

  const handleDayClick = useCallback((date: Date | null) => {
    if (!date) return;
    if (!isDateAvailable(date)) return;
    onSelect(date);
    onClose();
  }, [isDateAvailable, onSelect, onClose]);

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const monthLabel = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  if (!isOpen) return null;

  return (
    <div className="calendar-backdrop" onClick={onClose}>
      <div className="calendar-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="calendar-header">
          <button
            onClick={goToPrevMonth}
            aria-label="Mês anterior"
            className="calendar-nav-btn"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="calendar-month-label">{monthLabel}</span>
          <button
            onClick={goToNextMonth}
            aria-label="Próximo mês"
            className="calendar-nav-btn"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="calendar-weekdays">
          {DAY_NAMES.map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="calendar-days">
          {daysInMonth.map((date, index) => {
            if (!date) return <div key={index} />;
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const available = isCurrentMonth && isDateAvailable(date);
            const selected = isSameDay(date, selectedDate);
            const today = new Date();
            const isToday = date.getDate() === today.getDate() &&
              date.getMonth() === today.getMonth() &&
              date.getFullYear() === today.getFullYear();

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDayClick(date)}
                disabled={!available}
                aria-label={date.toLocaleDateString('pt-BR')}
                aria-selected={selected}
                className={`calendar-day ${selected ? 'selected' : ''} ${available ? 'available' : 'unavailable'} ${isToday && available ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="calendar-legend">
          <span className="legend-item">
            <span className="legend-color selected" />
            Selecionado
          </span>
          <span className="legend-item">
            <span className="legend-color today" />
            Hoje
          </span>
          <span className="legend-item">
            <span className="legend-color unavailable" />
            Sem dados
          </span>
        </div>
      </div>
    </div>
  );
}