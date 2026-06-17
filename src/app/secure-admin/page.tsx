"use client";

import PageTransition from "@/components/admin/PageTransition";
import RoleDashboard from "@/components/admin/dashboards/RoleDashboard";

export default function Dashboard() {
  return (
    <PageTransition>
      <RoleDashboard />
    </PageTransition>
  );
}
