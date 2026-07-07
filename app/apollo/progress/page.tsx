import { Suspense } from "react";

import ProgressClient from "./ProgressClient";

export default function ApolloProgressPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading progress…</main>}>
      <ProgressClient />
    </Suspense>
  );
}
