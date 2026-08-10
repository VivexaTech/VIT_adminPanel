"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/admin/PageTransition";

/**
 * App Enquiries are merged into Inquiry Management.
 * Keep this route as a redirect so old bookmarks still work.
 */
export default function EnquiriesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/secure-admin/admission-enquiries");
  }, [router]);

  return (
    <PageTransition>
      <div className="flex justify-center items-center h-64 text-slate-500 text-sm">
        Redirecting to Inquiry Management…
      </div>
    </PageTransition>
  );
}
