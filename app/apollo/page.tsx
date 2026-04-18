import { Suspense } from "react";

import ApolloPageClient from "./ApolloPageClient";

export default function ApolloPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading session…</main>}>
      <ApolloPageClient />
    </Suspense>
  );
}
