import { React, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import DOMPurify from 'dompurify';

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

export default function BrowseClubs({ clubs }) {
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [status, setStatus] = useState("all"); // full, notFull, all
  const [orderBy, setOrderBy] = useState("membersAsc"); // nameAsc, nameDesc, membersDesc
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6); // clubs per page

  // Filter and sort clubs
  const filteredClubs = useMemo(() => {
    let result = clubs.filter(club =>
      club.clubName.toLowerCase().includes(search.toLowerCase())
    );

    if (status === "full") result = result.filter(c => c.memberCount >= c.memberMax);
    if (status === "notFull") result = result.filter(c => c.memberCount < c.memberMax);

    switch (orderBy) {
      case "nameAsc":
        result.sort((a, b) => a.clubName.localeCompare(b.clubName));
        break;
      case "nameDesc":
        result.sort((a, b) => b.clubName.localeCompare(a.clubName));
        break;
      case "membersAsc":
        result.sort((a, b) => a.memberCount - b.memberCount);
        break;
      case "membersDesc":
        result.sort((a, b) => b.memberCount - a.memberCount);
        break;
    }

    return result;
  }, [clubs, search, status, orderBy]);

  // Pagination
  const totalPages = Math.ceil(filteredClubs.length / pageSize);
  const pagedClubs = filteredClubs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="browse-page">
      {/* Top bar */}
      <div className="top-bar">
        <input
          type="text"
          placeholder="Search clubs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => setFilterOpen(!filterOpen)}>≡</button>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="filter-panel">
          <label>
            Status:
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Any</option>
              <option value="full">Full</option>
              <option value="notFull">Not full</option>
            </select>
          </label>

          <label>
            Order by:
            <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)}>
              <option value="membersAsc">Members ↑</option>
              <option value="membersDesc">Members ↓</option>
              <option value="nameAsc">Name ↑</option>
              <option value="nameDesc">Name ↓</option>
            </select>
          </label>

          <label>
            Page size:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={6}>6</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
            </select>
          </label>
        </div>
      )}

      {/* Clubs grid */}
      <div className="clubs-grid">
        {pagedClubs.map((club) => (
          <div className="club card" key={club.clubName}>
            <h2>{club.clubName}</h2>
            <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(club.description) }}></p>
            <p>Members: {club.memberCount} / {club.memberMax}</p>
            <ProgressBar percentage={(club.memberCount / club.memberMax) * 100} />
            <Link className="btn" to={`/ClubPage/${club.clubName}`}>View Club</Link>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            className={currentPage === i + 1 ? "active" : ""}
            onClick={() => setCurrentPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
