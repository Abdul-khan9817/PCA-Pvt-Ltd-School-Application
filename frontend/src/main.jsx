import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './responsive.css';

// Global Enter → next field navigation (entire project)
// When Enter is pressed inside any text-like input, move focus to the next
// focusable field in DOM order instead of submitting or doing nothing.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const tag = e.target.tagName;
  const type = (e.target.type || '').toLowerCase();
  // Only act on regular text-like inputs (not buttons, checkboxes, textareas, etc.)
  const skipTypes = ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'range', 'color'];
  if (tag !== 'INPUT' || skipTypes.includes(type)) return;
  // Collect all visible, enabled, focusable form fields
  const fields = Array.from(
    document.querySelectorAll(
      'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=image]):not([disabled]):not([readonly][type=number]), select:not([disabled]), textarea:not([disabled])'
    )
  ).filter(el => {
    // Must be visible in the viewport
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest('[style*="display: none"]') && !el.closest('[hidden]');
  });
  const idx = fields.indexOf(e.target);
  if (idx !== -1 && idx < fields.length - 1) {
    e.preventDefault();
    fields[idx + 1].focus();
    // Select existing text so user can overwrite immediately
    if (fields[idx + 1].select) fields[idx + 1].select();
  }
});

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

