import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import { driverProblem, tidyPhone, isWorking } from '../../utils/drivers';
import DriverAvatar from '../../components/DriverAvatar';
import api from '../../api';

// The people who drive, for a booking made with a driver.
//
// A name, a number, and whether they are driving for us at the moment.
// Nothing else — no licence, no ID, no photograph. See utils/drivers.js for
// why, and for the rules this form and the server both apply.
const ManageDrivers = () => {
  usePageTitle('Drivers');
  const { isDark } = useTheme();
  const { toast, confirm } = useUIFeedback();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // The id being edited, or 'new' while adding one.
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', note: '', image: '', imageFileId: '' });
  const [uploading, setUploading] = useState(false);

  const load = () => api.get('/drivers')
    .then(({ data }) => setDrivers(data))
    .catch(() => toast.error('Could not load the drivers.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startNew = () => {
    setEditing('new');
    setForm({ name: '', phone: '', note: '', image: '', imageFileId: '' });
  };

  const startEdit = (driver) => {
    setEditing(driver._id);
    setForm({
      name: driver.name,
      phone: driver.phone,
      note: driver.note || '',
      image: driver.image || '',
      imageFileId: driver.imageFileId || '',
    });
  };

  // Straight to ImageKit, the same way a vehicle photo goes, so the picture
  // never passes through our own server. It is put on the form rather than
  // saved on its own: somebody who uploads a photo and then presses Cancel
  // has not changed the driver.
  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: auth } = await api.get('/imagekit/auth');
      const body = new FormData();
      body.append('file', file);
      body.append('fileName', file.name);
      body.append('token', auth.token);
      body.append('expire', auth.expire);
      body.append('signature', auth.signature);
      body.append('publicKey', auth.publicKey);
      const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body });
      const uploaded = await res.json();
      if (!uploaded?.url) throw new Error(uploaded?.message || 'Upload failed');
      setForm((f) => ({ ...f, image: uploaded.url, imageFileId: uploaded.fileId || '' }));
    } catch (err) {
      toast.error(err.message || 'Could not upload that photo.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const problem = driverProblem(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/drivers', form);
      else await api.put(`/drivers/${editing}`, form);
      toast.success(editing === 'new' ? 'Driver added.' : 'Saved.');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save that.');
    } finally {
      setSaving(false);
    }
  };

  // Somebody who has left, or is off for the foreseeable future. Not the
  // same as a day off — that is a date, and it belongs on their calendar.
  const toggleWorking = async (driver) => {
    try {
      await api.put(`/drivers/${driver._id}`, { active: !isWorking(driver) });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change that.');
    }
  };

  const remove = async (driver) => {
    const ok = await confirm(
      `Remove ${driver.name} from the list for good? If they have driven for you before, `
      + 'switching them to "not working" is usually better — it keeps their name on the bookings they drove.',
      { confirmLabel: 'Remove', cancelLabel: 'Keep them' },
    );
    if (!ok) return;
    try {
      await api.delete(`/drivers/${driver._id}`);
      toast.success('Removed.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove that.');
    }
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    title: { fontSize: '22px', fontWeight: '700', marginBottom: '4px', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '20px' },
    card: {
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '18px', marginBottom: '18px',
    },
    h2: { fontSize: '14px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: '0 0 2px' },
    sub: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 14px', lineHeight: 1.5 },
    row: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap',
      padding: '14px 0', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
    },
    name: { fontSize: '13.5px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    meta: { fontSize: '12.5px', color: isDark ? '#b0b3b8' : '#4b5563', marginTop: '3px' },
    note: { fontSize: '11.5px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '3px' },
    actions: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
    btn: (tone) => ({
      fontSize: '12px', fontWeight: '700', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
      border: `1px solid ${tone === 'gold' ? gold : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: tone === 'gold' ? gold : 'transparent',
      color: tone === 'gold' ? ON_GOLD : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    tag: (working) => ({
      fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px',
      background: working
        ? (isDark ? 'rgba(232,161,0,0.14)' : 'rgba(184,121,10,0.1)')
        : (isDark ? '#3a3b3c33' : '#f3f4f6'),
      color: working ? goldInk(isDark) : (isDark ? '#8a8d91' : '#6b7280'),
    }),
    label: { display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: isDark ? '#e4e6eb' : '#374151' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' },
    input: {
      width: '100%', padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    hint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '4px' },
    photoRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' },
    photoBtn: {
      display: 'inline-block', fontSize: '12px', fontWeight: '700', padding: '6px 12px', borderRadius: '8px',
      cursor: 'pointer', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      color: isDark ? '#b0b3b8' : '#6b7280',
    },
    fileInput: { position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' },
    empty: { padding: '28px', textAlign: 'center', color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '13.5px' },
  };

  if (loading) {
    return <AdminLayout activePage="Drivers"><Skeleton height="380px" radius="12px" isDark={isDark} /></AdminLayout>;
  }

  const working = drivers.filter(isWorking);
  const resting = drivers.filter((d) => !isWorking(d));

  const editor = (
    <div style={{ ...s.card, borderColor: gold }}>
      <h2 style={s.h2}>{editing === 'new' ? 'New driver' : 'Edit driver'}</h2>
      <p style={s.sub}>A name and a number you can ring on the morning they are driving. Nothing else is kept.</p>
      <div style={s.photoRow}>
        <DriverAvatar driver={form} isDark={isDark} size={64} />
        <div>
          <label style={s.photoBtn} htmlFor="dr-photo">
            {uploading ? 'Uploading…' : (form.image ? 'Change photo' : 'Add a photo')}
          </label>
          <input id="dr-photo" type="file" accept="image/*" style={s.fileInput} onChange={uploadPhoto} />
          {form.image && (
            <button
              type="button"
              style={{ ...s.btn(), marginLeft: '8px' }}
              onClick={() => setForm({ ...form, image: '', imageFileId: '' })}
            >
              Remove
            </button>
          )}
          <p style={s.hint}>Customers see this when they pick a driver, and again when their booking is on.</p>
        </div>
      </div>

      <div style={s.grid}>
        <div>
          <label style={s.label} htmlFor="dr-name">Name</label>
          <input id="dr-name" style={s.input} value={form.name} maxLength={80}
            placeholder="e.g. Juan Dela Cruz"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label style={s.label} htmlFor="dr-phone">Mobile number</label>
          <input id="dr-phone" style={s.input} value={form.phone} inputMode="tel"
            placeholder="e.g. 09171234567"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <p style={s.hint}>Only you see this. Customers are shown the name alone.</p>
        </div>
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label style={s.label} htmlFor="dr-note">Note for the office (optional)</label>
        <input id="dr-note" style={s.input} value={form.note} maxLength={300}
          placeholder="e.g. prefers long trips, no motorcycles"
          onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div style={s.actions}>
        <button type="button" style={s.btn('gold')} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" style={s.btn()} onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </div>
  );

  const line = (driver) => (
    <div key={driver._id} style={s.row}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <DriverAvatar driver={driver} isDark={isDark} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={s.name}>{driver.name}</div>
          <div style={s.meta}>{tidyPhone(driver.phone)}</div>
          {driver.note ? <div style={s.note}>{driver.note}</div> : null}
        </div>
      </div>
      <div style={s.actions}>
        <span style={s.tag(isWorking(driver))}>{isWorking(driver) ? 'Driving' : 'Not working'}</span>
        <button type="button" style={s.btn()} onClick={() => startEdit(driver)}>Edit</button>
        <button type="button" style={s.btn()} onClick={() => toggleWorking(driver)}>
          {isWorking(driver) ? 'Mark not working' : 'Back to driving'}
        </button>
        <button type="button" style={s.btn()} onClick={() => remove(driver)}>Remove</button>
      </div>
    </div>
  );

  return (
    <AdminLayout activePage="Drivers">
      <h1 style={s.title}>Drivers</h1>
      <p style={s.subtitle}>The people who drive for you, for bookings made with a driver.</p>

      {editing ? editor : (
        <button type="button" style={{ ...s.btn('gold'), marginBottom: '18px' }} onClick={startNew}>
          Add a driver
        </button>
      )}

      <div style={s.card}>
        <h2 style={s.h2}>Driving</h2>
        <p style={s.sub}>These are the names a customer can choose from when they book with a driver.</p>
        {working.length === 0
          ? <p style={s.empty}>Nobody on the list yet.</p>
          : working.map(line)}
      </div>

      {resting.length > 0 && (
        <div style={s.card}>
          <h2 style={s.h2}>Not working</h2>
          <p style={s.sub}>
            Kept rather than deleted — somebody who has left is still the driver on the bookings they drove.
            They are not offered to anybody while they are here.
          </p>
          {resting.map(line)}
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageDrivers;
