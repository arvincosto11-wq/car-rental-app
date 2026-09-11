import { VALID_ID_TYPES, idTypeNeedsBack } from '../data/validIdTypes';

// Valid-ID section shared by Register and Consignment Register — a dropdown
// for which PH ID the user has, then one upload slot, or two (front/back)
// for IDs that carry real info on both sides (driver's license, national
// ID, UMID, postal ID). Fully controlled: the caller owns idType/files/
// previews since it needs the raw files for upload-to-ImageKit and the
// idType for its own step validation, not just for display here.
const ValidIdUpload = ({
  styles, idPrefix = 'valid-id', required = false,
  idType, onIdTypeChange,
  frontPreview, onFrontChange,
  backPreview, onBackChange,
}) => {
  const needsBack = idTypeNeedsBack(idType);

  return (
    <>
      <div style={styles.field}>
        <label style={styles.label} htmlFor={`${idPrefix}-type`}>Valid ID Type</label>
        <select
          id={`${idPrefix}-type`}
          style={styles.input}
          value={idType}
          onChange={(e) => onIdTypeChange(e.target.value)}
          required={required}
        >
          <option value="">Select the ID you'll use</option>
          {VALID_ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {idType && (
        <div className={needsBack ? 'responsive-row-2' : undefined} style={needsBack ? styles.row : undefined}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor={`${idPrefix}-front`}>{needsBack ? 'ID — Front' : 'ID Photo'}</label>
            <div style={styles.upload}>
              {frontPreview ? (
                <img src={frontPreview} alt="ID front preview" style={styles.uploadPreview} />
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

          {needsBack && (
            <div style={styles.field}>
              <label style={styles.label} htmlFor={`${idPrefix}-back`}>ID — Back</label>
              <div style={styles.upload}>
                {backPreview ? (
                  <img src={backPreview} alt="ID back preview" style={styles.uploadPreview} />
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
          )}
        </div>
      )}
    </>
  );
};

export default ValidIdUpload;
