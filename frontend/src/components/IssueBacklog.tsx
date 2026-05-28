
import { OpenIssue } from "../types/stream";

type SortKey = "none" | "complexity-asc" | "points-asc" | "points-desc";

const COMPLEXITY_ORDER: Record<OpenIssue["complexity"], number> = {
  Trivial: 0,
  Medium: 1,
  High: 2,
};

interface IssueBacklogProps {
  issues: OpenIssue[];
  loading?: boolean;
}

type SortOption = "points-desc" | "points-asc" | "complexity" | "title";

const complexityRank: Record<OpenIssue["complexity"], number> = {
  Trivial: 0,
  Medium: 1,
  High: 2,
};

export function IssueBacklog({ issues, loading }: IssueBacklogProps) {


  if (loading) {
    return (
      <div className="card">
        <h2>Maintainer Backlog</h2>
        <div className="activity-feed">
          {[1, 2, 3].map((i) => (

          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Maintainer Backlog</h2>

      </div>

      {visibleIssues.length === 0 ? (
        <p className="muted">No backlog issues match this label.</p>
      ) : (
        <div className="issue-list">
          {visibleIssues.map((issue) => (
            <article key={issue.id} className="issue-item">
              <h3>{issue.title}</h3>
              <p>{issue.summary}</p>
              <p className="muted">
                Complexity: {issue.complexity} | Points: {issue.points}
              </p>
              <div className="chip-row">
                {issue.labels.map((label) => (
                  <span key={label} className="chip">
                    {label}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
