import { React, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import api from "../api"
import { getSession } from "../utils/auth"

const Notifications = () => {
  const session = getSession()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 })
  const [filters, setFilters] = useState({ search: "", orderBy: "created", order: "desc", page: 1, limit: 6 })

  const updateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: field === "page" ? value : 1 }))
  }

  const fetchNotifications = async (page = filters.page) => {
    if (!session) return
    try {
      const res = await api.get("/notifications", {
        params: {
          q: filters.search,
          orderBy: filters.orderBy,
          order: filters.order,
          limit: filters.limit,
          page
        }
      })
      const payload = res.data.data ? res.data.data : res.data
      setItems(payload)
      setMeta({
        page: res.data.page || page,
        pages: res.data.pages || Math.max(1, Math.ceil((res.data.total || payload.length) / filters.limit)),
        total: res.data.total || payload.length
      })
    } catch (err) {
      console.error(err)
      alert("Unable to load notifications")
    }
  }

  useEffect(() => { fetchNotifications(filters.page) }, [filters])

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      fetchNotifications(meta.page)
    } catch (err) {
      console.error(err)
      alert("Unable to mark notification")
    }
  }

  const markUnread = async (id) => {
    try {
      await api.put(`/notifications/${id}/unread`)
      fetchNotifications(meta.page)
    } catch (err) {
      console.error(err)
      alert("Unable to update notification")
    }
  }

  if (!session) return <p style={{ textAlign: "center" }}>Login to view notifications.</p>

  return (
    <div className="notifications-page">
      <div className="section-header">
        <h1>Notifications</h1>
        <div className="inline-filters">
          <input
            type="text"
            placeholder="Search notifications"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
          <select value={filters.orderBy} onChange={(e) => updateFilter("orderBy", e.target.value)}>
            <option value="created">Date</option>
            <option value="type">Type</option>
            <option value="read">Read/Unread</option>
          </select>
          <select value={filters.order} onChange={(e) => updateFilter("order", e.target.value)}>
            <option value="desc">Newest</option>
            <option value="asc">Oldest</option>
          </select>
          <select value={filters.limit} onChange={(e) => updateFilter("limit", Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </select>
        </div>
      </div>

      <div className="notifications-list">
        {items.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.7 }}>No notifications.</p>
        ) : items.map(n => (
          <div key={n.notificationid} className={`notification-card ${n.isRead ? 'read' : 'unread'}`}>
            <div className="notification-head">
              <span className="badge">{n.type}</span>
              <span className="notification-date">{new Date(n.createdAt).toLocaleString('en-GB')}</span>
            </div>
            <div className="notification-body">
              {n.message}
            </div>
            <div className="notification-actions">
              {n.link && <Link className="btn" to={n.link}>Open</Link>}
              {!n.isRead ? (
                <button onClick={() => markRead(n.notificationid)}>Mark read</button>
              ) : (
                <button className="btn-ghost" onClick={() => markUnread(n.notificationid)}>Mark unread</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pagination">
        {Array.from({ length: meta.pages }, (_, i) => (
          <button
            key={i}
            className={meta.page === i + 1 ? "active" : ""}
            onClick={() => updateFilter("page", i + 1)}
          >
            {i + 1}
          </button>
        ))}
        <span className="pagination-meta">{meta.total} results</span>
      </div>
    </div>
  )
}

export default Notifications
