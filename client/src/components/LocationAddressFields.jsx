import { useState, useEffect } from 'react';
import { regions, provinces, cities, barangays } from 'select-philippines-address';

// Cascading Region -> Province -> City/Municipality -> Barangay picker for
// Philippine addresses. Reports the combined address back to the parent as
// a single string so it slots into the existing `address` form field with
// no backend changes needed.
const LocationAddressFields = ({ styles, rowClassName = 'responsive-row-2', onChange, idPrefix = 'loc' }) => {
  const [street, setStreet] = useState('');
  const [regionList, setRegionList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [barangayList, setBarangayList] = useState([]);

  const [region, setRegion] = useState(null);
  const [province, setProvince] = useState(null);
  const [city, setCity] = useState(null);
  const [barangay, setBarangay] = useState(null);

  useEffect(() => {
    regions().then(setRegionList);
  }, []);

  useEffect(() => {
    if (!region) { setProvinceList([]); return; }
    provinces(region.region_code).then(setProvinceList);
  }, [region]);

  useEffect(() => {
    if (!province) { setCityList([]); return; }
    cities(province.province_code).then(setCityList);
  }, [province]);

  useEffect(() => {
    if (!city) { setBarangayList([]); return; }
    barangays(city.city_code).then(setBarangayList);
  }, [city]);

  useEffect(() => {
    const parts = [street, barangay?.brgy_name, city?.city_name, province?.province_name, region?.region_name].filter(Boolean);
    onChange(parts.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, barangay, city, province, region]);

  return (
    <>
      <div style={styles.field}>
        <label style={styles.label} htmlFor={`${idPrefix}-street`}>House/Unit No. & Street</label>
        <input
          id={`${idPrefix}-street`}
          style={styles.input}
          type="text"
          placeholder="e.g. 123 Rizal St."
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          required
        />
      </div>

      <div className={rowClassName} style={{ gap: '12px' }}>
        <div style={styles.field}>
          <label style={styles.label} htmlFor={`${idPrefix}-region`}>Region</label>
          <select
            id={`${idPrefix}-region`}
            style={styles.input}
            value={region?.region_code || ''}
            onChange={(e) => {
              const found = regionList.find((r) => r.region_code === e.target.value) || null;
              setRegion(found);
              setProvince(null);
              setCity(null);
              setBarangay(null);
            }}
            required
          >
            <option value="">Select region</option>
            {regionList.map((r) => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor={`${idPrefix}-province`}>Province</label>
          <select
            id={`${idPrefix}-province`}
            style={styles.input}
            value={province?.province_code || ''}
            onChange={(e) => {
              const found = provinceList.find((p) => p.province_code === e.target.value) || null;
              setProvince(found);
              setCity(null);
              setBarangay(null);
            }}
            disabled={!region}
            required
          >
            <option value="">{region ? 'Select province' : 'Select region first'}</option>
            {provinceList.map((p) => <option key={p.province_code} value={p.province_code}>{p.province_name}</option>)}
          </select>
        </div>
      </div>

      <div className={rowClassName} style={{ gap: '12px' }}>
        <div style={styles.field}>
          <label style={styles.label} htmlFor={`${idPrefix}-city`}>City / Municipality</label>
          <select
            id={`${idPrefix}-city`}
            style={styles.input}
            value={city?.city_code || ''}
            onChange={(e) => {
              const found = cityList.find((c) => c.city_code === e.target.value) || null;
              setCity(found);
              setBarangay(null);
            }}
            disabled={!province}
            required
          >
            <option value="">{province ? 'Select city/municipality' : 'Select province first'}</option>
            {cityList.map((c) => <option key={c.city_code} value={c.city_code}>{c.city_name}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor={`${idPrefix}-barangay`}>Barangay</label>
          <select
            id={`${idPrefix}-barangay`}
            style={styles.input}
            value={barangay?.brgy_code || ''}
            onChange={(e) => {
              const found = barangayList.find((b) => b.brgy_code === e.target.value) || null;
              setBarangay(found);
            }}
            disabled={!city}
            required
          >
            <option value="">{city ? 'Select barangay' : 'Select city first'}</option>
            {barangayList.map((b) => <option key={b.brgy_code} value={b.brgy_code}>{b.brgy_name}</option>)}
          </select>
        </div>
      </div>
    </>
  );
};

export default LocationAddressFields;
