"use client";

import { pageHeader, pageHeaderActions, pageTitle, pageSubtitle } from "@/lib/theme";

type Props = {
  title: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, icon, actions }: Props) {
  return (
    <div className={pageHeader}>
      <div className="min-w-0">
        <h1 className={`${pageTitle} flex items-center gap-2 flex-wrap`}>
          {icon}
          <span className="break-words">{title}</span>
        </h1>
        {subtitle && <p className={pageSubtitle}>{subtitle}</p>}
      </div>
      {actions ? <div className={pageHeaderActions}>{actions}</div> : null}
    </div>
  );
}
