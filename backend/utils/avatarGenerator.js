/**
 * Avatar Generation Utility
 * Generates consistent, beautiful avatars from user names
 * Used when user has no profile image
 */

/**
 * Generate a consistent color from a string (name)
 * Same name always produces same color
 */
function stringToColor(str) {
  if (!str) return '#6366f1'; // Default indigo

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate pleasant, vibrant colors
  const colors = [
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#a855f7', // purple
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Get initials from name
 * Examples:
 *   "John Doe" -> "JD"
 *   "Alice" -> "A"
 *   "Mary Jane Watson" -> "MW"
 */
function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return '?';
  }

  const cleaned = name.trim();
  if (!cleaned) return '?';

  const words = cleaned.split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();

  // First letter of first word + first letter of last word
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Generate avatar data object
 * Returns all information needed to display an avatar
 * 
 * @param {object} user - User object with full_name, username, email
 * @returns {object} Avatar data
 */
function generateAvatarData(user) {
  if (!user) {
    return {
      hasImage: false,
      imageUrl: null,
      initials: '?',
      backgroundColor: '#6366f1',
      textColor: '#ffffff',
    };
  }

  // If user has a profile image, return it
  if (user.profile_image_url) {
    return {
      hasImage: true,
      imageUrl: user.profile_image_url,
      initials: getInitials(user.full_name || user.username || user.email),
      backgroundColor: stringToColor(user.full_name || user.username || user.email),
      textColor: '#ffffff',
    };
  }

  // Generate avatar from name
  const displayName = user.full_name || user.username || user.email || 'User';
  const initials = getInitials(displayName);
  const backgroundColor = stringToColor(displayName);

  return {
    hasImage: false,
    imageUrl: null,
    initials,
    backgroundColor,
    textColor: '#ffffff',
  };
}

/**
 * Generate SVG avatar
 * Returns an SVG data URL that can be used directly in img src
 * 
 * @param {object} user - User object
 * @param {number} size - Avatar size in pixels (default: 40)
 * @returns {string} SVG data URL
 */
function generateAvatarSVG(user, size = 40) {
  const avatar = generateAvatarData(user);

  if (avatar.hasImage) {
    return avatar.imageUrl;
  }

  const fontSize = Math.floor(size * 0.4);

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${avatar.backgroundColor}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="${avatar.textColor}" font-family="system-ui, -apple-system, sans-serif" 
            font-size="${fontSize}" font-weight="600">
        ${avatar.initials}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Add avatar data to user object
 * Enriches user object with avatar information
 * 
 * @param {object} user - User object
 * @returns {object} User object with avatar data
 */
function enrichUserWithAvatar(user) {
  if (!user) return null;

  const avatarData = generateAvatarData(user);

  return {
    ...user,
    avatar: avatarData,
    // For backwards compatibility, also set avatarUrl
    avatarUrl: avatarData.hasImage ? avatarData.imageUrl : generateAvatarSVG(user),
  };
}

/**
 * Add avatar data to multiple users
 */
function enrichUsersWithAvatars(users) {
  if (!Array.isArray(users)) return [];
  return users.map(enrichUserWithAvatar);
}

module.exports = {
  stringToColor,
  getInitials,
  generateAvatarData,
  generateAvatarSVG,
  enrichUserWithAvatar,
  enrichUsersWithAvatars,
};
