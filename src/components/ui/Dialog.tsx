"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/** Modal built on <dialog>. `trigger` opens it; children get a `close` function. */
export function Dialog({
  trigger,
  title,
  children,
  width = 480,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: (open: () => void) => React.ReactNode;
  title: string;
  children: (close: () => void) => React.ReactNode;
  width?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInnerOpen(v));
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      {trigger?.(() => setOpen(true))}
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className="m-auto max-h-[90vh] w-[calc(100vw-32px)] overflow-y-auto rounded-card border border-line bg-white p-0 shadow-pop backdrop:bg-ink/30"
        style={{ maxWidth: width }}
        aria-label={title}
      >
        {open && (
          <div className="flex flex-col gap-4 p-[22px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="btn btn-ghost btn-icon size-8!">
                <X size={16} />
              </button>
            </div>
            {children(() => setOpen(false))}
          </div>
        )}
      </dialog>
    </>
  );
}
