"use client";

import React from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export const containerStaggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const itemStaggerVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

interface MotionStaggerContainerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function MotionStaggerContainer({
  children,
  className = "",
  ...props
}: MotionStaggerContainerProps) {
  return (
    <motion.div
      variants={containerStaggerVariants}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface MotionStaggerItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function MotionStaggerItem({
  children,
  className = "",
  ...props
}: MotionStaggerItemProps) {
  return (
    <motion.div variants={itemStaggerVariants} className={className} {...props}>
      {children}
    </motion.div>
  );
}
