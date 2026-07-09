"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ApolloApiError,
  StudentProgressDetailed,
  getStudentProgressDetailed,
} from "@/lib/apollo/api";
import ApolloProgressCard from "@/components/apollo/ApolloProgressCard";
import ApolloErrorSurface from "@/components/apollo/ApolloErrorSurface";
import ApolloTopBar from "@/components/apollo/ApolloTopBar";

export default function ProgressClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = Number(searchParams.get("class"));
  const [data, setData] = useState<StudentProgressDetailed | null>(null);
  const [error, setError] = useState<ApolloApiError | Error | null>(null);

  useEffect(() => {
    if (!classId) return;
    getStudentProgressDetailed(classId)
      .then(setData)
      .catch((e) => setError(e as Error));
  }, [classId]);

  if (!classId) {
    return (
      <>
        <ApolloTopBar />
        <main className="apollo-progress-page">
          <p>Open your progress from the Apollo page so we know which course you&apos;re in.</p>
        </main>
      </>
    );
  }

  const detail = data?.detail;
  const isEmpty =
    detail !== undefined &&
    detail.mastery.length === 0 &&
    detail.recent_attempts.length === 0;

  return (
    <>
      <ApolloTopBar
        classId={classId}
        onBack={() => router.push(`/apollo?class=${classId}`)}
        backLabel="Back to Apollo"
        hideProgressLink
      />
      <main className="apollo-progress-page">
      <h1 className="apollo-progress-page__title">My progress</h1>
      <ApolloErrorSurface error={error} onDismiss={() => setError(null)} />
      <ApolloProgressCard progress={data} />

      {isEmpty && (
        <div className="apollo-progress-page__empty">
          Nothing here yet — teach Apollo your first problem and your progress
          will show up.
        </div>
      )}

      {detail && detail.mastery.length > 0 && (
        <section className="apollo-progress-page__section">
          <h2>Concept mastery</h2>
          <ul className="apollo-mastery">
            {detail.mastery.map((m) => (
              <li key={m.concept_id} className="apollo-mastery__row">
                <span className="apollo-mastery__name">{m.display_name}</span>
                <span className="apollo-mastery__bar">
                  <span
                    className="apollo-mastery__fill"
                    style={{ width: `${Math.round(m.mastery_avg * 100)}%` }}
                  />
                </span>
                <span className="apollo-mastery__pct">
                  {Math.round(m.mastery_avg * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail && detail.recent_attempts.length > 0 && (
        <section className="apollo-progress-page__section">
          <h2>Recent attempts</h2>
          <ul className="apollo-attempts">
            {detail.recent_attempts.map((a) => (
              <li key={a.attempt_id} className="apollo-attempts__row">
                <span className="apollo-attempts__concept">
                  {a.concept_display_name ?? "—"}
                </span>
                <span className="apollo-attempts__difficulty">{a.difficulty}</span>
                <span className="apollo-attempts__grade">
                  {a.letter ?? "?"}
                  {a.score !== null ? ` (${a.score})` : ""}
                </span>
                <span className="apollo-attempts__date">
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      </main>
    </>
  );
}
