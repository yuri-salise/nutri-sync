import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children directly under <body>. Page content sits in a stacking context below
 * the mobile bottom nav, so dialogs and the rest timer must escape it to appear on top.
 */
export const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);
