import { React, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import api from "../api";
import { getSession } from "../utils/auth";

// Progress bar component
const ProgressBar = ({ percentage }) => {
  return (
    <div className="progress-bar-container">
        <div className="progress-container">
            <div className="progress-bar" style={{ width: `${percentage}%` }}></div>
        </div>
        {percentage.toFixed(0)}%
    </div>
  );
};

export default function BrowseClubs() {
  const session = getSession();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [status, setStatus] = useState("all"); // full, notFull, all
  const [orderBy, setOrderBy] = useState("membersAsc"); // nameAsc, nameDesc, membersDesc
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(6);

  const mappedOrder = () => {
    switch (orderBy) {
      case "nameAsc":
        return { orderBy: "clubName", order: "asc" };
      case "nameDesc":
        return { orderBy: "clubName", order: "desc" };
      case "membersDesc":
        return { orderBy: "memberCount", order: "desc" };
      case "membersAsc":
      default:
        return { orderBy: "memberCount", order: "asc" };
    }
  };

  const { data: clubsData, isLoading, isError } = useQuery({
    queryKey: ['clubs', { search, status, orderBy, currentPage, limit }],
    queryFn: async () => {
      const { orderBy: ob, order } = mappedOrder();
      const res = await api.get("/clubs", {
        params: {
          q: search,
          status,
          orderBy: ob,
          order,
          page: currentPage,
          limit
        }
      });
      return res.data;
    },
    placeholderData: keepPreviousData
  });

  const clubs = clubsData?.data || clubsData || [];
  const meta = {
    page: clubsData?.page || 1,
    pages: clubsData?.pages || Math.max(1, Math.ceil((clubsData?.total || clubs.length) / limit)),
    total: clubsData?.total || clubs.length
  };

  return (
    <div className="browse-page">
      {/* Top bar */}
      <div className="top-bar">
        <input
          name="searchClubs"
          type="text"
          placeholder="Search clubs..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setCurrentPage(1)
          }}
        />
        <button onClick={() => setFilterOpen(!filterOpen)}>≡</button>
      </div>

      {isError && <div className="alert error">Failed to load clubs.</div>}

      {/* Filter panel */}
      {filterOpen && (
        <div className="filter-panel">
          <label>
            Status:
            <select value={status} onChange={(e) => {
              setStatus(e.target.value)
              setCurrentPage(1)
            }}>
              <option value="all">Any</option>
              <option value="full">Full</option>
              <option value="notFull">Not full</option>
            </select>
          </label>

          <label>
            Order by:
            <select value={orderBy} onChange={(e) => {
              setOrderBy(e.target.value)
              setCurrentPage(1)
            }}>
              <option value="membersAsc">Members ↑</option>
              <option value="membersDesc">Members ↓</option>
              <option value="nameAsc">Name a-z</option>
              <option value="nameDesc">Name z-a</option>
            </select>
          </label>
          <label>
            Per page:
            <select value={limit} onChange={(e) => {
              setLimit(Number(e.target.value))
              setCurrentPage(1)
            }}>
              <option value={3}>3</option>
              <option value={6}>6</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
            </select>
          </label>
        </div>
      )}

      {isLoading && <p style={{ textAlign: "center", opacity: 0.6 }}>Loading...</p>}

      {/* Clubs grid */}
      <div className="clubs-grid">
        {clubs.map((club) => {
          // Check if user has membership in this club
          const myMembership = session?.memberships?.find(m => m.clubName === club.clubName);
          const isMyClub = !!myMembership;
          const isSA = session?.isAdmin === true;
          // Check if user is a Club Leader of any club (CL cannot join other clubs)
          const isClubLeaderAnywhere = session?.memberships?.some(m => m.role === 'CL') || false;
          const bannerStyle = club.bannerImage 
            ? { backgroundImage: `url(${club.bannerImage})` }
            : { backgroundColor: club.bannerColor || '#38bdf8' };
          return (
            <div className="club card" key={club.clubName}>
              <div className="club-banner" style={bannerStyle}></div>
              <div className="club-content">
                <h2>{club.clubName}</h2>
                <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(club.description) }}></p>
                <p>Members: {club.memberCount} / {club.memberMax}</p>
                <ProgressBar percentage={(club.memberCount / club.memberMax) * 100} />
                <div className="club-actions">
                  <Link className="btn" to={`/ClubPage/${club.clubName}`}>View Club</Link>
                  {!isSA && !isMyClub && !isClubLeaderAnywhere && club.memberCount < club.memberMax && (
                    <button className="btn" onClick={async () => {
                      try {
                        await api.put(`/joinClubs/${club.clubName}`);
                        alert('Join request submitted! Please wait for approval.');
                        window.location.reload();
                      } catch (err) {
                        alert(err.response?.data?.message || 'Failed to join club');
                      }
                    }}>Join</button>
                  )}
                  {!isSA && !isMyClub && isClubLeaderAnywhere && (
                    <span className="btn btn-muted" title="Club Leaders cannot join other clubs">CL restricted</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="pagination">
        {(() => {
          const current = currentPage;
          const total = meta.pages;
          const pages = [];
          
          if (total <= 5) {
            for (let i = 1; i <= total; i++) pages.push(i);
          } else {
            pages.push(1);
            if (current > 3) pages.push('...');
            for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
              if (!pages.includes(i)) pages.push(i);
            }
            if (current < total - 2) pages.push('...');
            if (!pages.includes(total)) pages.push(total);
          }
          
          return pages.map((page, idx) => 
            page === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 0.5rem' }}>...</span>
            ) : (
              <button
                key={page}
                className={current === page ? "active" : ""}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            )
          );
        })()}
        <span className="pagination-meta">{meta.total} results</span>
      </div>
    </div>
  );
}
