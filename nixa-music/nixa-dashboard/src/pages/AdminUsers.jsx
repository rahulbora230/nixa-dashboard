import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { createUser, getUsers } from "../api/authApi";
import "./AdminUsers.css";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "artist",
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState("");

  const loadUsers = async () => {
    try {
      setFetching(true);
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
      setMessage("Failed to load users");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!form.name || !form.email || !form.password || !form.role) {
      setMessage("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      await createUser(form);

      setMessage("User created successfully");

      setForm({
        name: "",
        email: "",
        password: "",
        role: "artist",
      });

      loadUsers();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-users-layout">
      <Sidebar />

      <main className="admin-users-main">
        <Topbar />

        <section className="admin-users-header">
          <div>
            <p className="eyebrow">Admin Control</p>
            <h1>User Management</h1>
            <p>Create artist, label, accountant, and admin accounts.</p>
          </div>

          <div className="header-stat">
            <span>Total Users</span>
            <strong>{users.length}</strong>
          </div>
        </section>

        <section className="admin-users-grid">
          <div className="user-card create-user-card">
            <div className="card-title">
              <h2>Create New User</h2>
              <p>Admin can create login access manually.</p>
            </div>

            {message && <div className="form-message">{message}</div>}

            <form onSubmit={handleSubmit} className="user-form">
              <div className="input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Enter user name"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="example@nixamusic.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <input
                  type="text"
                  name="password"
                  placeholder="Create temporary password"
                  value={form.password}
                  onChange={handleChange}
                />
              </div>

              <div className="input-group">
                <label>User Role</label>
                <select name="role" value={form.role} onChange={handleChange}>
                  <option value="artist">Artist</option>
                  <option value="label">Label</option>
                  <option value="accountant">Accountant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button className="create-btn" disabled={loading}>
                {loading ? "Creating..." : "Create User"}
              </button>
            </form>
          </div>

          <div className="user-card users-list-card">
            <div className="card-title">
              <h2>Existing Users</h2>
              <p>All users created by admin.</p>
            </div>

            {fetching ? (
              <div className="empty-state">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="empty-state">No users found</div>
            ) : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-cell">
                            <div className="avatar">
                              {user.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <span>{user.name}</span>
                          </div>
                        </td>

                        <td>{user.email}</td>

                        <td>
                          <span className={`role-pill ${user.role}`}>
                            {user.role}
                          </span>
                        </td>

                        <td>
                          <span className={`status-pill ${user.status}`}>
                            {user.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminUsers;