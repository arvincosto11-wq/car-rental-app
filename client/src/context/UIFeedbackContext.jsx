import { createContext, useContext, useState, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

const UIFeedbackContext = createContext(null);

let idCounter = 0;

export const UIFeedbackProvider = ({ children }) => {
  const { isDark } = useTheme();
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((message, type) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), 4000);
  }, [dismissToast]);

  const toast = {
    success: (message) => pushToast(message, 'success'),
    error: (message) => pushToast(message, 'error'),
    info: (message) => pushToast(message, 'info'),
  };

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve, ...options });
    });
  }, []);

  const resolveConfirm = (result) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const typeStyles = {
    success: { border: isDark ? '#16a34a' : '#86efac', text: isDark ? '#86efac' : '#16a34a' },
    error: { border: isDark ? '#dc2626' : '#fca5a5', text: isDark ? '#fca5a5' : '#dc2626' },
    info: { border: isDark ? GOLD_DARK : GOLD, text: isDark ? GOLD_DARK : GOLD },
  };

  const s = {
    toastStack: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 3000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: 'min(360px, calc(100vw - 40px))',
    },
    toast: (type) => ({
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderLeft: `4px solid ${typeStyles[type].border}`,
      borderRadius: '8px',
      padding: '12px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      fontSize: '13px',
      lineHeight: '1.5',
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      animation: 'toast-in 0.25s ease',
    }),
    toastClose: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: isDark ? '#94a3b8' : '#9ca3af',
      fontSize: '16px',
      lineHeight: 1,
      padding: 0,
      flexShrink: 0,
    },
    confirmOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      padding: '20px',
    },
    confirmCard: {
      background: isDark ? '#1e293b' : '#fff',
      borderRadius: '12px',
      padding: '24px',
      maxWidth: '400px',
      width: '100%',
    },
    confirmMessage: {
      fontSize: '14px',
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      marginBottom: '20px',
      lineHeight: '1.5',
    },
    confirmActions: { display: 'flex', gap: '10px' },
    confirmCancelBtn: {
      flex: 1, padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151',
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500',
    },
    confirmOkBtn: (danger) => ({
      flex: 1, padding: '10px',
      background: danger ? '#dc2626' : (isDark ? GOLD_DARK : GOLD),
      color: danger ? '#fff' : ON_GOLD,
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600',
    }),
  };

  return (
    <UIFeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div style={s.toastStack}>
        {toasts.map((t) => (
          <div key={t.id} style={s.toast(t.type)}>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button style={s.toastClose} onClick={() => dismissToast(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div style={s.confirmOverlay}>
          <div style={s.confirmCard}>
            <p style={s.confirmMessage}>{confirmState.message}</p>
            <div style={s.confirmActions}>
              <button style={s.confirmCancelBtn} onClick={() => resolveConfirm(false)}>
                {confirmState.cancelLabel || 'Cancel'}
              </button>
              <button style={s.confirmOkBtn(confirmState.danger)} onClick={() => resolveConfirm(true)}>
                {confirmState.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIFeedbackContext.Provider>
  );
};

export const useUIFeedback = () => useContext(UIFeedbackContext);
