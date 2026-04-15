/**
 * UX/UI Animation Library
 * Premium animations and transitions for wow factor
 */

// Animation Timings
export const timing = {
  instant: "100ms",
  fast: "200ms",
  normal: "300ms",
  slow: "500ms",
  verySlow: "800ms",
};

// Easing Functions
export const easing = {
  // Standard Material Design easings
  standard: "cubic-bezier(0.4, 0.0, 0.2, 1)",
  decelerate: "cubic-bezier(0.0, 0.0, 0.2, 1)",
  accelerate: "cubic-bezier(0.4, 0.0, 1, 1)",
  sharp: "cubic-bezier(0.4, 0.0, 0.6, 1)",

  // Premium easings for wow factor
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  smooth: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  elegant: "cubic-bezier(0.23, 1, 0.32, 1)",
  snappy: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
};

// Keyframe Animations
export const keyframes = {
  // Entrance Animations
  fadeIn: {
    "@keyframes fadeIn": {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
  },

  fadeInUp: {
    "@keyframes fadeInUp": {
      from: {
        opacity: 0,
        transform: "translateY(20px)",
      },
      to: {
        opacity: 1,
        transform: "translateY(0)",
      },
    },
  },

  fadeInDown: {
    "@keyframes fadeInDown": {
      from: {
        opacity: 0,
        transform: "translateY(-20px)",
      },
      to: {
        opacity: 1,
        transform: "translateY(0)",
      },
    },
  },

  fadeInLeft: {
    "@keyframes fadeInLeft": {
      from: {
        opacity: 0,
        transform: "translateX(-20px)",
      },
      to: {
        opacity: 1,
        transform: "translateX(0)",
      },
    },
  },

  fadeInRight: {
    "@keyframes fadeInRight": {
      from: {
        opacity: 0,
        transform: "translateX(20px)",
      },
      to: {
        opacity: 1,
        transform: "translateX(0)",
      },
    },
  },

  scaleIn: {
    "@keyframes scaleIn": {
      from: {
        opacity: 0,
        transform: "scale(0.8)",
      },
      to: {
        opacity: 1,
        transform: "scale(1)",
      },
    },
  },

  // Loading Animations
  shimmer: {
    "@keyframes shimmer": {
      "0%": {
        backgroundPosition: "-200% 0",
      },
      "100%": {
        backgroundPosition: "200% 0",
      },
    },
  },

  pulse: {
    "@keyframes pulse": {
      "0%, 100%": {
        opacity: 1,
      },
      "50%": {
        opacity: 0.5,
      },
    },
  },

  spin: {
    "@keyframes spin": {
      from: { transform: "rotate(0deg)" },
      to: { transform: "rotate(360deg)" },
    },
  },

  // Interactive Animations
  bounce: {
    "@keyframes bounce": {
      "0%, 100%": {
        transform: "translateY(0)",
      },
      "50%": {
        transform: "translateY(-8px)",
      },
    },
  },

  shake: {
    "@keyframes shake": {
      "0%, 100%": { transform: "translateX(0)" },
      "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
      "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
    },
  },

  // Success/Error Animations
  checkmark: {
    "@keyframes checkmark": {
      "0%": {
        transform: "scale(0) rotate(45deg)",
        opacity: 0,
      },
      "50%": {
        transform: "scale(1.2) rotate(45deg)",
        opacity: 1,
      },
      "100%": {
        transform: "scale(1) rotate(45deg)",
        opacity: 1,
      },
    },
  },

  // Gradient Animation
  gradientShift: {
    "@keyframes gradientShift": {
      "0%, 100%": {
        backgroundPosition: "0% 50%",
      },
      "50%": {
        backgroundPosition: "100% 50%",
      },
    },
  },

  // Number Counter Animation
  countUp: {
    "@keyframes countUp": {
      from: {
        transform: "translateY(20px)",
        opacity: 0,
      },
      to: {
        transform: "translateY(0)",
        opacity: 1,
      },
    },
  },
};

// Pre-built Animation Styles
export const animations = {
  // Card Entrance
  cardEntrance: (delay = 0) => ({
    animation: `fadeInUp 0.6s ${easing.bounce} ${delay}ms both`,
    ...keyframes.fadeInUp,
  }),

  // Card Hover
  cardHover: {
    transition: `all ${timing.normal} ${easing.elegant}`,
    "&:hover": {
      transform: "translateY(-8px)",
    },
  },

  // Shimmer Loading
  shimmerLoading: {
    background: "linear-gradient(90deg, #f0f0f0 0%, #ffffff 50%, #f0f0f0 100%)",
    backgroundSize: "200% 100%",
    animation: `shimmer 2s infinite ${easing.standard}`,
    ...keyframes.shimmer,
  },

  // Pulse Effect
  pulseEffect: {
    animation: `pulse 2s ${easing.standard} infinite`,
    ...keyframes.pulse,
  },

  // Spin Loading
  spinLoading: {
    animation: `spin 1s linear infinite`,
    ...keyframes.spin,
  },

  // Success Checkmark
  successCheckmark: {
    animation: `checkmark 0.5s ${easing.bounce} forwards`,
    ...keyframes.checkmark,
  },
};

// Glassmorphism Effect
export const glassmorphism = (blur = 10, alphaVal = 0.7, dark = false) => ({
  background: dark ? `rgba(30, 24, 20, ${alphaVal})` : `rgba(255, 255, 255, ${alphaVal})`,
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`, // Safari support
  border: dark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(255, 255, 255, 0.3)",
  boxShadow: dark ? "0 8px 32px rgba(0, 0, 0, 0.4)" : "0 8px 32px rgba(31, 38, 135, 0.15)",
});

// Neumorphism Effect
export const neumorphism = (theme, pressed = false) => ({
  background: theme.palette.background.default,
  boxShadow: pressed
    ? "inset 2px 2px 5px rgba(0, 0, 0, 0.1), inset -2px -2px 5px rgba(255, 255, 255, 0.7)"
    : "6px 6px 12px rgba(0, 0, 0, 0.1), -6px -6px 12px rgba(255, 255, 255, 0.7)",
  transition: `all ${timing.fast} ${easing.standard}`,
});

// Enhanced Shadows
export const shadows = {
  soft: "0 2px 8px rgba(0, 0, 0, 0.08)",
  medium: "0 4px 16px rgba(0, 0, 0, 0.12)",
  large: "0 8px 32px rgba(0, 0, 0, 0.16)",
  floating: "0 12px 48px rgba(0, 0, 0, 0.20)",
  glow: (color) => `0 0 20px ${color}`,
};

// Stagger Animation Helper
export const staggerChildren = (baseDelay = 0, increment = 100) => {
  return (index) => animations.cardEntrance(baseDelay + index * increment);
};

export default {
  timing,
  easing,
  keyframes,
  animations,
  glassmorphism,
  neumorphism,
  shadows,
  staggerChildren,
};
