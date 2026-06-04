"use client";

import { useLocale, useTranslations } from "next-intl";
import { startAnalysisAction } from "@/app/[locale]/actions";
import { PropertyPicker } from "@/components/PropertyPicker";

export function BuyerForm() {
  const t = useTranslations("form");
  const locale = useLocale();

  const labels = {
    street: t("street"),
    streetPlaceholder: t("streetPlaceholder"),
    number: t("number"),
    find: t("find"),
    finding: t("finding"),
    selectUnit: t("selectUnit"),
    noRecords: t("noRecords"),
    manualSummary: t("manualSummary"),
    askingPrice: t("askingPrice"),
    email: t("email"),
    emailHint: t("emailHint"),
    selected: t("selected"),
    submit: t("submit"),
  };

  return (
    <PropertyPicker
      action={startAnalysisAction}
      labels={labels}
      withEmail
      extraHidden={{ locale, source: "buyer" }}
    />
  );
}
