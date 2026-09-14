// Front/back photo upload for a driver's license, shown only when the
// license ISN'T also the user's chosen Valid ID (in that case ValidIdUpload
// already covers it) — so License Number/Expiry aren't just self-reported
// text with nothing backing them up. Same controlled-component shape as
// ValidIdUpload, minus the type dropdown (a license is always a license).
const LicensePhotoUpload = ({
  styles, idPrefix = 'license',
  frontPreview, onFrontChange,
  backPreview, onBackChange,
}) => (
  <div className="responsive-row-2" style={styles.row}>
    <div style={styles.field}>
      <label style={styles.label} htmlFor={`${idPrefix}-front`}>License — Front</label>
      <div style={styles.upload}>
        {frontPreview ? (
          <img src={frontPreview} alt="License front preview" style={styles.uploadPreview} />
        ) : (
          <div style={styles.uploadPlaceholder}>
            <span style={{ fontSize: '26px' }}>🪪</span>
            <p style={styles.uploadHint}>Click to upload a photo</p>
          </div>
        )}
        <input
          id={`${idPrefix}-front`}
          type="file"
          accept="image/*"
          style={styles.fileInput}
          onChange={(e) => { const f = e.target.files[0]; if (f) onFrontChange(f); }}
        />
      </div>
    </div>
    <div style={styles.field}>
      <label style={styles.label} htmlFor={`${idPrefix}-back`}>License — Back</label>
      <div style={styles.upload}>
        {backPreview ? (
          <img src={backPreview} alt="License back preview" style={styles.uploadPreview} />
        ) : (
          <div style={styles.uploadPlaceholder}>
            <span style={{ fontSize: '26px' }}>🪪</span>
            <p style={styles.uploadHint}>Click to upload a photo</p>
          </div>
        )}
        <input
          id={`${idPrefix}-back`}
          type="file"
          accept="image/*"
          style={styles.fileInput}
          onChange={(e) => { const f = e.target.files[0]; if (f) onBackChange(f); }}
        />
      </div>
    </div>
  </div>
);

export default LicensePhotoUpload;
