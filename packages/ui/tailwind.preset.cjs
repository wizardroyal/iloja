/**
 * Shared Tailwind preset for all Iloja apps. Wires the design tokens into
 * Tailwind's color / font / shadow scales.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1A3C34',
          deep: '#0D2E22',
          night: '#0D2420',
        },
        grove: {
          DEFAULT: '#2D6A4F',
          light: '#3D8060',
        },
        sage: '#4A8E6C',
        meadow: '#52A679',
        mint: '#A8D5B5',
        cream: '#F7F4EE',
        parchment: '#EDE9E0',
        oat: '#E8E4DA',
        ink: {
          DEFAULT: '#1A1A18',
          muted: '#5C5C54',
          subtle: '#7A7A70',
        },
        line: {
          DEFAULT: '#E0DDD5',
          soft: '#C8C4B8',
        },
        success: { tint: '#EAF3DE' },
        warning: { DEFAULT: '#C9921A', deep: '#7A5008', tint: '#FEF3D7' },
        danger: '#E05A2B',
        info: { DEFAULT: '#2D7DD2', deep: '#4A7FB5' },
        premium: '#6B4FBF',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['var(--font-dm-sans)', 'DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        pill: '999px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(26, 60, 52, 0.08)',
        'card-hover': '0 6px 24px rgba(26, 60, 52, 0.14)',
        modal: '0 12px 40px rgba(13, 46, 34, 0.18)',
      },
      maxWidth: {
        mobile: '390px',
      },
    },
  },
};
