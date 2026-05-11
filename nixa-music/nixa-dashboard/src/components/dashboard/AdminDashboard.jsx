import React, { useState, useEffect } from 'react';
import StatCard from '../ui/StatCard';
import Card from '../ui/Card';
import EnhancedDataTable from '../ui/EnhancedDataTable';
import EnhancedEmptyState from '../ui/EnhancedEmptyState';
import Button from '../ui/Button';
import '../styles/design-system.css';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setStats({
        totalReleases: 1247,
        activeArtists: 89,
        totalRevenue: '$2,847,392',
        monthlyGrowth: '+12.4%',
        pendingImports: 3,
        failedImports: 1,
        activeUsers: 156,
        systemHealth: '98.5%'
      });
      
      setRecentActivity([
        { id: 1, action: 'New Release', user: 'John Doe', time: '2 min ago', status: 'success' },
        { id: 2, action: 'Revenue Import', user: 'System', time: '15 min ago', status: 'success' },
        { id: 3, action: 'User Registration', user: 'Jane Smith', time: '1 hour ago', status: 'info' },
        { id: 4, action: 'Failed Import', user: 'Admin', time: '2 hours ago', status: 'error' }
      ]);
      
      setPendingApprovals([
        { id: 1, title: 'Summer Vibes', artist: 'The Waves', submitted: '2024-01-15', priority: 'high' },
        { id: 2, title: 'Midnight Sessions', artist: 'Luna Star', submitted: '2024-01-14', priority: 'medium' },
        { id: 3, title: 'Urban Dreams', artist: 'City Lights', submitted: '2024-01-13', priority: 'low' }
      ]);
      
      setLoading(false);
    }, 1500);
  }, []);

  const activityColumns = [
    { key: 'action', title: 'Action', sortable: true },
    { key: 'user', title: 'User', sortable: true },
    { key: 'time', title: 'Time', sortable: true },
    { 
      key: 'status', 
      title: 'Status', 
      sortable: true,
      render: (status) => (
        <span className={`badge badge-${status === 'success' ? 'success' : status === 'error' ? 'error' : 'info'}`}>
          {status}
        </span>
      )
    }
  ];

  const approvalsColumns = [
    { key: 'title', title: 'Release Title', sortable: true },
    { key: 'artist', title: 'Artist', sortable: true },
    { key: 'submitted', title: 'Submitted', sortable: true },
    { 
      key: 'priority', 
      title: 'Priority', 
      sortable: true,
      render: (priority) => (
        <span className={`badge badge-${priority === 'high' ? 'error' : priority === 'medium' ? 'warning' : 'info'}`}>
          {priority}
        </span>
      )
    },
    { 
      key: 'actions', 
      title: 'Actions',
      render: (_, row) => (
        <div className="flex space-x-2">
          <Button size="sm" variant="primary">Review</Button>
          <Button size="sm" variant="secondary">Reject</Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatCard key={i} loading />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Section */}
      <section>
        <h2 className="text-3xl font-bold text-primary mb-6">Dashboard Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Total Releases" 
            value={stats.totalReleases}
            change="+23"
            changeType="positive"
            trend="up"
            icon="🎵"
            subtitle="Last 30 days"
          />
          <StatCard 
            title="Active Artists" 
            value={stats.activeArtists}
            change="+5"
            changeType="positive"
            trend="up"
            icon="🎤"
            subtitle="Currently active"
          />
          <StatCard 
            title="Total Revenue" 
            value={stats.totalRevenue}
            change="+12.4%"
            changeType="positive"
            trend="up"
            icon="💰"
            subtitle="All time"
          />
          <StatCard 
            title="Monthly Growth" 
            value={stats.monthlyGrowth}
            change="+2.1%"
            changeType="positive"
            trend="up"
            icon="📈"
            subtitle="vs last month"
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <Card>
          <div className="card-header">
            <h3 className="text-xl font-semibold text-primary">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="primary" className="w-full">
                📤 Upload Revenue
              </Button>
              <Button variant="secondary" className="w-full">
                👥 Manage Users
              </Button>
              <Button variant="secondary" className="w-full">
                📊 View Analytics
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Approvals */}
        <section>
          <Card>
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-primary">Pending Approvals</h3>
                <span className="badge badge-warning">{pendingApprovals.length}</span>
              </div>
            </div>
            <div className="card-body">
              {pendingApprovals.length > 0 ? (
                <EnhancedDataTable 
                  data={pendingApprovals}
                  columns={approvalsColumns}
                  pagination={false}
                  className="text-sm"
                />
              ) : (
                <EnhancedEmptyState 
                  variant="releases"
                  message="No pending approvals"
                  actionText="View All Releases"
                />
              )}
            </div>
          </Card>
        </section>

        {/* Recent Activity */}
        <section>
          <Card>
            <div className="card-header">
              <h3 className="text-xl font-semibold text-primary">Recent Activity</h3>
            </div>
            <div className="card-body">
              <EnhancedDataTable 
                data={recentActivity}
                columns={activityColumns}
                pagination={false}
                className="text-sm"
              />
            </div>
          </Card>
        </section>
      </div>

      {/* System Status */}
      <section>
        <Card>
          <div className="card-header">
            <h3 className="text-xl font-semibold text-primary">System Health</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-success mb-2">{stats.pendingImports}</div>
                <div className="text-sm text-secondary">Pending Imports</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-error mb-2">{stats.failedImports}</div>
                <div className="text-sm text-secondary">Failed Imports</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success mb-2">{stats.systemHealth}</div>
                <div className="text-sm text-secondary">System Health</div>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default AdminDashboard;
