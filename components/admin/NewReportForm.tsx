"use client";

import { createReportAction } from "@/app/admin/actions";
import { PropertyPicker } from "@/components/PropertyPicker";

const labels = {
  street: "Street (Barcelona)",
  streetPlaceholder: "Start typing, e.g. Sors",
  number: "Number",
  find: "Find units",
  finding: "Searching…",
  selectUnit: "Select the unit",
  noRecords:
    "No Catastro records at that street/number. Check the number, or enter a cadastral reference below.",
  manualSummary: "Or enter a cadastral reference directly",
  askingPrice: "Asking price (€)",
  selected: "Selected:",
  submit: "Generate report →",
};

export function NewReportForm() {
  return (
    <PropertyPicker
      action={createReportAction}
      labels={labels}
      showExtras
      extraHidden={{ source: "operator" }}
    />
  );
}
