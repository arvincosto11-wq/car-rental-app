import { useTheme } from '../context/ThemeContext';
import usePageTitle from '../hooks/usePageTitle';
import {
  SuccessIcon, MenuCloseIcon, PlayPauseIcon, LockUnlockIcon, CopiedIcon,
  AnimatedNotificationIcon, AnimatedHeartIcon, DownloadDoneIcon, SendIcon,
  ToggleIcon, EyeToggleIcon, VolumeIcon,
} from '../components/AnimatedStateIcons';

// Temporary preview page for the ported animated-icon set — not linked from
// any nav. Visit /icon-preview directly, then tell Claude which one(s) (if
// any) to actually wire into the app; safe to delete this file + its route
// once you've decided.
const ICONS = [
  { name: 'Success', Icon: SuccessIcon },
  { name: 'Menu', Icon: MenuCloseIcon },
  { name: 'Play/Pause', Icon: PlayPauseIcon },
  { name: 'Lock', Icon: LockUnlockIcon },
  { name: 'Copied', Icon: CopiedIcon },
  { name: 'Notification', Icon: AnimatedNotificationIcon },
  { name: 'Heart', Icon: AnimatedHeartIcon },
  { name: 'Download', Icon: DownloadDoneIcon },
  { name: 'Send', Icon: SendIcon },
  { name: 'Toggle', Icon: ToggleIcon },
  { name: 'Eye', Icon: EyeToggleIcon },
  { name: 'Volume', Icon: VolumeIcon },
];

const IconPreview = () => {
  usePageTitle('Icon Preview');
  const { isDark } = useTheme();

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#18191a' : '#f9fafb', padding: '64px 16px' },
    container: { maxWidth: '760px', margin: '0 auto', textAlign: 'center' },
    title: { fontSize: '26px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '8px' },
    subtitle: { fontSize: '14px', color: isDark ? '#b0b3b8' : '#6b7280', maxWidth: '460px', margin: '0 auto 48px' },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
      gap: '28px', justifyItems: 'center',
    },
    tile: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    box: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '80px', height: '80px', borderRadius: '16px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      background: isDark ? '#242526' : '#fff',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    label: { fontSize: '11px', fontWeight: '600', color: isDark ? '#b0b3b8' : '#6b7280', letterSpacing: '0.02em' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>Animated State Icons</h1>
        <p style={s.subtitle}>
          12 icons that morph between two meaningful states on a loop — loading→success, play→pause,
          lock→unlock. Ported from the shadcn version to plain JSX for this app.
        </p>
        <div style={s.grid}>
          {ICONS.map(({ name, Icon }) => (
            <div key={name} style={s.tile}>
              <div style={s.box}>
                <Icon size={36} />
              </div>
              <span style={s.label}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IconPreview;
