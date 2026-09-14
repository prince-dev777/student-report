import React, { useState, useEffect } from 'react';
import { getStudentPhotoUrl } from '../utils/api';

/**
 * StudentAvatar — Resilient Offline-First Student Profile Avatar
 * 
 * Features:
 * - Automatically routes via local offline proxy (/api/media/photo) in desktop app
 * - Smooth fallback to styled Initials avatar on load error (NO broken image icons ever)
 * - Auto-retries loading photo when network reconnects without manual page refresh
 */
export default function StudentAvatar({
  student,
  size = 38,
  style = {},
  className = '',
  idx = 0
}) {
  const [hasError, setHasError] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);

  // Auto-retry when network comes back online without requiring manual page refresh
  useEffect(() => {
    const handleOnline = () => {
      setHasError(false);
      setPhotoKey(prev => prev + 1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Reset error state if student photo URL changes
  useEffect(() => {
    setHasError(false);
  }, [student?.photo]);

  const getInitials = (name) => {
    if (!name) return 'ST';
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarClass = (index) => `av-${(index % 6) + 1}`;

  const photoUrl = student?.photo ? getStudentPhotoUrl(student.photo, student) : null;

  if (photoUrl && !hasError) {
    return (
      <img
        key={photoKey}
        src={photoUrl}
        alt={student?.name || 'Student'}
        className={`student-avatar ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--border-color)',
          display: 'block',
          ...style
        }}
        onError={() => setHasError(true)}
      />
    );
  }

  const dimensionStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: typeof size === 'number' ? `${Math.round(size * 0.38)}px` : '0.85rem',
    fontWeight: 700,
    ...style
  };

  return (
    <div
      className={`student-avatar ${getAvatarClass(idx)} ${className}`}
      style={dimensionStyle}
      title={student?.name || 'Student'}
    >
      {getInitials(student?.name)}
    </div>
  );
}
