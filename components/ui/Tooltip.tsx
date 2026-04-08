import React, { ReactNode, useRef, useState } from 'react';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const TooltipTrigger = React.forwardRef<HTMLDivElement, { children: ReactNode; asChild?: boolean; className?: string }>(
  ({ children, asChild, className }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, { ref, className } as any);
    }
    return <div ref={ref} className={className}>{children}</div>;
  }
);

TooltipTrigger.displayName = 'TooltipTrigger';

export function TooltipContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`absolute z-50 bg-gray-900 text-white p-2 rounded-md text-xs max-w-xs ${className}`}>
      {children}
    </div>
  );
}
