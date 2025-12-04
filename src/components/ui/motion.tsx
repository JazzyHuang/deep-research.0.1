'use client';

import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

// ============================================
// Animation Variants
// ============================================

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ============================================
// Motion Components
// ============================================

/**
 * FadeIn - Simple fade-in animation
 */
export const FadeIn = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof motion.div> & {
    delay?: number;
    duration?: number;
  }
>(({ children, delay = 0, duration = 0.3, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration, delay, ease: 'easeOut' }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
));
FadeIn.displayName = 'FadeIn';

/**
 * FadeInUp - Fade in with upward slide
 */
export const FadeInUp = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof motion.div> & {
    delay?: number;
    duration?: number;
    distance?: number;
  }
>(({ children, delay = 0, duration = 0.4, distance = 20, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, y: distance }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -distance / 2 }}
    transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
));
FadeInUp.displayName = 'FadeInUp';

/**
 * SlideIn - Horizontal slide animation
 */
export const SlideIn = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof motion.div> & {
    delay?: number;
    duration?: number;
    direction?: 'left' | 'right';
    distance?: number;
  }
>(({ children, delay = 0, duration = 0.4, direction = 'right', distance = 50, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, x: direction === 'right' ? distance : -distance }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: direction === 'right' ? -distance / 2 : distance / 2 }}
    transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
));
SlideIn.displayName = 'SlideIn';

/**
 * ScaleIn - Scale-up animation
 */
export const ScaleIn = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof motion.div> & {
    delay?: number;
    duration?: number;
  }
>(({ children, delay = 0, duration = 0.3, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
));
ScaleIn.displayName = 'ScaleIn';

/**
 * StaggerList - Container for staggered animations
 */
export function StaggerList({
  children,
  className,
  staggerDelay = 0.1,
  ...props
}: ComponentPropsWithoutRef<typeof motion.div> & {
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        initial: {},
        animate: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
        exit: {
          transition: {
            staggerChildren: staggerDelay / 2,
            staggerDirection: -1,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem - Item within a StaggerList
 */
export const StaggerItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof motion.div>
>(({ children, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    variants={{
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -5 },
    }}
    className={className}
    {...props}
  >
    {children}
  </motion.div>
));
StaggerItem.displayName = 'StaggerItem';

/**
 * NumberTicker - Animated number counter
 */
export function NumberTicker({
  value,
  duration = 0.5,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('tabular-nums', className)}
      transition={{ duration }}
    >
      {value}
    </motion.span>
  );
}

/**
 * ProgressBar - Animated progress bar
 */
export function MotionProgress({
  value,
  max = 100,
  className,
  duration = 0.5,
}: {
  value: number;
  max?: number;
  className?: string;
  duration?: number;
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <motion.div
        className="h-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </div>
  );
}

/**
 * Pulse - Subtle pulsing animation
 */
export function Pulse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.02, 1],
        opacity: [1, 0.8, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Shake - Error shake animation
 */
export function Shake({
  children,
  className,
  trigger,
}: {
  children: React.ReactNode;
  className?: string;
  trigger?: boolean;
}) {
  return (
    <motion.div
      animate={trigger ? {
        x: [-5, 5, -5, 5, 0],
      } : {}}
      transition={{ duration: 0.4 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Re-export motion and AnimatePresence for convenience
export { motion, AnimatePresence };

