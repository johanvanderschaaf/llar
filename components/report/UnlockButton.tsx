"use client";

import { useTransition } from "react";
import { createCheckoutAction } from "@/app/[locale]/actions";

/** Buyer's unlock CTA → starts Stripe Checkout for this report. */
export function UnlockButton({
  reportId,
  locale,
  label,
  pendingLabel,
}: {
  reportId: string;
  locale: string;
  label: string;
  pendingLabel: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-primary btn-unlock"
      disabled={pending}
      onClick={() => start(() => createCheckoutAction(reportId, locale))}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
