import { Link } from 'react-router-dom';
import type { AdminUserSocial } from '../../api/types';
import { formatNumber } from '../../lib/format';

export function SocialCard({ social }: { social: AdminUserSocial }) {
  return (
    <section className="card" aria-labelledby="social-title">
      <h2 id="social-title" className="card-label">
        Social
      </h2>
      <dl className="counts-grid social-grid">
        <div className="count">
          <dt>Friends</dt>
          <dd>{formatNumber(social.friends)}</dd>
        </div>
        <div className="count">
          <dt>Invites joined</dt>
          <dd>{formatNumber(social.invitesJoined)}</dd>
        </div>
        <div className="count">
          <dt>Users blocked</dt>
          <dd>{formatNumber(social.blockedCount)}</dd>
        </div>
        <div className="count count-wide">
          <dt>Invited by</dt>
          <dd className="count-text">
            {social.invitedBy ? (
              <Link to={`/users/${social.invitedBy.userId}`}>{social.invitedBy.email}</Link>
            ) : (
              <span className="muted">—</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
