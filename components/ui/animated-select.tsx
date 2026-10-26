"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

export interface AnimatedSelectOption<T extends string = string> {
  id: T;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface AnimatedSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: AnimatedSelectOption<T>[];
  label?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  menuClassName?: string;
  align?: "left" | "right";
  placeholder?: string;
}

export function AnimatedSelect<T extends string = string>({
  value,
  onChange,
  options,
  icon,
  ariaLabel,
  className = "",
  menuClassName = "",
  align = "left",
  placeholder = "Select...",
}: AnimatedSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left?: number;
    right?: number;
    width: number;
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position relative to viewport so it can float outside any parent stacking context
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (align === "right") {
      setCoords({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
        width: rect.width,
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen, align]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedTrigger = triggerRef.current && triggerRef.current.contains(target);
      const clickedMenu = menuRef.current && menuRef.current.contains(target);
      if (!clickedTrigger && !clickedMenu) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.id === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className="relative inline-block text-left select-none">
      {/* Trigger Button: Stable dimensions, zero layout shift */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel || displayLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`inline-flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer shadow-2xs ${
          isOpen
            ? "bg-white border-slate-400 ring-2 ring-slate-900/10 text-slate-900"
            : "bg-slate-50/90 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 hover:border-slate-300"
        } ${className}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && (
            <span className="text-slate-400 shrink-0">
              {icon}
            </span>
          )}
          <span className="truncate">{displayLabel}</span>
        </div>

        {/* Chevron with smooth 180° rotation */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-300 ease-in-out ${
            isOpen ? "rotate-180 text-slate-700" : "rotate-0"
          }`}
        />
      </button>

      {/* Dropdown Menu Container: Rendered via React Portal directly into document.body to guarantee z-index superiority & Zero CLS */}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && coords && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  ...(coords.left !== undefined ? { left: coords.left } : { right: coords.right }),
                  minWidth: Math.max(coords.width, 180),
                  zIndex: 9999,
                  willChange: "transform, opacity",
                  transformOrigin: align === "right" ? "top right" : "top left",
                }}
                role="listbox"
                className={`max-h-60 overflow-y-auto rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.14)] p-1.5 overscroll-contain ${menuClassName}`}
              >
                <div className="space-y-0.5">
                  {options.map((option, index) => {
                    const isSelected = option.id === value;
                    return (
                      <motion.div
                        key={option.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.22,
                          delay: index * 0.035,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        style={{ willChange: "transform, opacity" }}
                        onClick={() => {
                          onChange(option.id);
                          setIsOpen(false);
                        }}
                        role="option"
                        aria-selected={isSelected}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? "bg-slate-100 text-slate-900 font-semibold"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-normal"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {option.icon && (
                            <span className="shrink-0 text-slate-400 group-hover:text-slate-700">
                              {option.icon}
                            </span>
                          )}
                          <span className="truncate">{option.label}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {option.badge !== undefined && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 border border-slate-200/60">
                              {option.badge}
                            </span>
                          )}
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                          ) : (
                            <span className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
