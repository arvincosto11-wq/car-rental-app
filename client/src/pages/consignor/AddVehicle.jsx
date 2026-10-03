import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BookInspection from './BookInspection';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api';

// Adding another vehicle is the same journey as the first one.
//
// This page used to be a long form: details, a suggested price, photographs
// of the OR and CR. None of that is filled in online any more — every
// vehicle is looked at in person, against its papers, before it is listed.
// So "add a vehicle" and "book an inspection" became the same thing, and
// this is a second door into that one page rather than a second version of
// it.
const AddVehicle = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [stage, setStage] = useState(null);

  const load = () => api.get('/appointments/stage')
    .then((res) => setStage(res.data))
    .catch(() => navigate('/consignor'));

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stage) {
    return (
      <div style={{ minHeight: '100vh', background: isDark ? '#18191a' : '#f9fafb', padding: '32px 16px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Skeleton height="420px" radius="14px" isDark={isDark} />
        </div>
      </div>
    );
  }

  return <BookInspection stage={stage} onBooked={load} />;
};

export default AddVehicle;
