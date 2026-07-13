"use client";

import { ApolloApiError } from "@/lib/apollo/api";

interface Props {
  error: ApolloApiError | Error | null;
  onDismiss?: () => void;
}

function titleFor(err: ApolloApiError | Error): string {
  if (!(err instanceof ApolloApiError)) return "Something went wrong";
  switch (err.errorCode) {
    case "parser_could_not_extract":
      return "I didn't understand that";
    case "filter_rejected":
      return "Apollo's response was blocked";
    case "malformed_equation":
      return "One of your equations couldn't be read";
    case "no_matching_concept":
      return "Apollo doesn't cover this topic yet";
    case "pool_exhausted":
      return "No more problems at that difficulty";
    case "session_frozen":
      return "This session is frozen";
    default:
      return "Something went wrong";
  }
}

function detailFor(err: ApolloApiError | Error): string {
  if (!(err instanceof ApolloApiError)) return err.message;
  const { errorCode, extra, message } = err;
  switch (errorCode) {
    case "parser_could_not_extract":
      return `Could you rephrase what you said more precisely? We couldn't turn "${extra.utterance ?? ""}" into a structured knowledge entry.`;
    case "filter_rejected":
      return `Apollo tried to use "${extra.rejected_term ?? "a term"}" which you hadn't introduced. Please rephrase your last message and we'll try again.`;
    case "malformed_equation":
      return `The equation you taught as "${extra.symbolic ?? ""}" (labeled "${extra.entry_id ?? ""}") couldn't be parsed: ${extra.parse_error ?? ""}.`;
    case "no_matching_concept":
      return "The topic in your Hoot conversation isn't one Apollo has problems for yet. Go back to Hoot and keep studying.";
    case "pool_exhausted":
      return `Apollo has no more ${extra.difficulty ?? ""} problems for ${extra.concept_cluster_id ?? "this topic"}. Pick a different difficulty or end the session.`;
    case "session_frozen":
      return "This session has already been finalized; you can't make changes.";
    default:
      return message;
  }
}

export default function ApolloErrorSurface({ error, onDismiss }: Props) {
  if (!error) return null;
  return (
    <div role="alert" className="notice" data-tone="danger">
      <strong>{titleFor(error)}</strong>
      <p>{detailFor(error)}</p>
      {onDismiss && (
        <div>
          <button
            onClick={onDismiss}
            type="button"
            className="ui-button ui-button--small"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
