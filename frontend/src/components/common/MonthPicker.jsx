import { useState } from "react";
import { motion } from "../../shared/ui";
import { C } from "../../shared/runtime";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * MonthPicker — allows selecting a month/year and a date range within it.
 * Emits onSelect({ year, month, fromDate, toDate })
 */
function MonthPicker({ onSelect, onClose }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0=Jan, 11=Dec
  const [selectedDate, setSelectedDate] = useState(null);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon, etc.

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const handleDateSelect = (day) => {
    if (!day) return;
    const fromDate = new Date(year, month, 1);
    const toDate = new Date(year, month, day, 23, 59, 59);
    onSelect({
      year,
      month: month + 1,
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      label: `${monthNames[month]} ${day}, ${year}`
    });
    if (onClose) onClose();
  };

  const handleMonthSelect = () => {
    const fromDate = new Date(year, month, 1);
    const toDate = new Date(year, month + 1, 0, 23, 59, 59);
    onSelect({
      year,
      month: month + 1,
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      label: `${monthNames[month]} ${year}`
    });
    if (onClose) onClose();
  };

  return (
    <motion.div
      className="edumanage-monthpicker"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        background: C.white,
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 10px 40px rgba(0,0,0,.2)',
        width: 320,
        maxWidth: 320,
        zIndex: 1000
      }}>
      {/* Month/Year Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMonth(m => m === 0 ? 11 : m - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft size={20} color={C.accent} />
        </motion.button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{monthNames[month]} {year}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            <motion.button
              type="button"
              whileHover={{ opacity: 0.7 }}
              onClick={() => setMonth(m => m === 0 ? 11 : m - 1)}
              style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              ← Prev
            </motion.button>
            <span style={{ margin: '0 8px' }}>|</span>
            <motion.button
              type="button"
              whileHover={{ opacity: 0.7 }}
              onClick={() => setMonth(m => m === 11 ? 0 : m + 1)}
              style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              Next →
            </motion.button>
          </div>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMonth(m => m === 11 ? 0 : m + 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronRight size={20} color={C.accent} />
        </motion.button>
      </div>

      {/* Day Labels */}
      <div className="edumanage-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.muted, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="edumanage-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
        {days.map((d, i) =>
          d ? (
            <motion.button
              key={i}
              type="button"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleDateSelect(d)}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: '1px solid ' + C.border,
                background: selectedDate === d ? C.accent : C.light,
                color: selectedDate === d ? '#fff' : C.dark,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .2s'
              }}>
              {d}
            </motion.button>
          ) : (
            <div key={i} />
          )
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleMonthSelect}
          style={{
            flex: 1,
            background: C.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer'
          }}>
          Select Full Month
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          style={{
            flex: 1,
            background: C.light,
            color: C.dark,
            border: '1px solid ' + C.border,
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer'
          }}>
          Cancel
        </motion.button>
      </div>
    </motion.div>
  );
}

export { MonthPicker };
