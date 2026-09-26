"use client";

import { useState, useTransition } from "react";
import { CUSTOMS_STATUS_LABEL } from "@/lib/status";
import { changeCustomsStatus } from "@/server/services/po";

export function CustomsStatusSelect({ poId, value }: { poId: string; value: keyof typeof CUSTOMS_STATUS_LABEL }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <select
        aria-label="Customs status"
        className="input w-auto! min-h-0! py-1! text-xs"
        disabled={pending}
        defaultValue={value}
        onChange={(e) =>
          start(async () => {
            const r = await changeCustomsStatus(poId, e.target.value);
            setError(r.ok ? null : r.error);
          })
        }
      >
        {Object.entries(CUSTOMS_STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-fg">{error}</span>}
    </span>
  );
}
