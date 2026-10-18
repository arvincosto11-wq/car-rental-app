import StarPicker from './StarPicker';
import DriverAvatar from './DriverAvatar';
import { CameraGlyph } from './Glyphs';
import { SCORES } from '../utils/ratingForm';

// The rating's fields, with no opinion about what they sit inside: My
// Bookings puts them in an inline panel, the Rate My Bookings page in a
// dialog. The state behind them is useRatingForm in utils/ratingForm.js.
export function RatingFormFields({ r, booking, isDark, surface }) {
  const muted = isDark ? '#b0b3b8' : '#5f5c55';
  const text = isDark ? '#e4e6eb' : '#1c1b19';
  const border = isDark ? '#3a3b3c' : '#e3e1dc';
  const field = surface || (isDark ? '#242526' : '#ffffff');

  const label = { display: 'block', fontSize: '12px', fontWeight: '600', color: muted };
  const textarea = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
    border: `1px solid ${border}`, background: field, color: text,
    fontSize: '13.5px', fontFamily: 'inherit', resize: 'vertical',
  };

  return (
    <>
      {SCORES.map(({ key, label: title }) => (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={label}>{title}</span>
          <StarPicker
            value={r.form[key]}
            onChange={(n) => r.setForm({ ...r.form, [key]: n })}
            isDark={isDark}
            label={title}
          />
        </div>
      ))}

      {/* The driver is a person, not a feature of the car. Rating them
          separately keeps a dirty vehicle from dragging down somebody's
          name, and a good driver from flattering a car nobody enjoyed.
          Optional, and it only appears when somebody actually drove. */}
      {booking.driver && (
        <div style={{ border: `1px solid ${border}`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DriverAvatar driver={booking.driver} isDark={isDark} size={38} />
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: text }}>{booking.driver.name}</div>
              <div style={{ fontSize: '11.5px', color: muted }}>Your driver — optional</div>
            </div>
          </div>
          <StarPicker
            value={r.driverScore}
            onChange={r.setDriverScore}
            isDark={isDark}
            label={`Rate ${booking.driver.name}`}
          />
          {r.driverScore > 0 && (
            <textarea
              id="driver-rating-comment"
              aria-label={`Comment about ${booking.driver.name}`}
              style={textarea}
              rows={2}
              value={r.driverComment}
              onChange={(e) => r.setDriverComment(e.target.value)}
              placeholder={`How was ${booking.driver.name}?`}
            />
          )}
        </div>
      )}

      <textarea
        id="rating-comment"
        aria-label="Comment about this trip"
        style={textarea}
        rows={2}
        value={r.form.comment}
        onChange={(e) => r.setForm({ ...r.form, comment: e.target.value })}
        placeholder="What went well, or what could be better? (optional)"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          position: 'relative', minHeight: '56px', border: `2px dashed ${border}`,
          borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: field,
        }}
        >
          <span style={{ fontSize: '12px', color: muted, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CameraGlyph /> Add photos (optional)
          </span>
          <input
            id="rating-photos"
            type="file"
            accept="image/*"
            multiple
            aria-label="Add photos"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            onChange={(e) => r.addPhotos(e.target.files)}
          />
        </div>
        {r.photos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '8px' }}>
            {r.photos.map((p, i) => (
              <div key={p.id} style={{ position: 'relative', width: '100%', height: '56px', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={p.preview || p.url} alt={`Review photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  className="icon-toggle-btn"
                  style={{
                    position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px',
                    borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: '12px', lineHeight: '18px', cursor: 'pointer', padding: 0,
                  }}
                  onClick={() => r.removePhoto(p.id)}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default RatingFormFields;
