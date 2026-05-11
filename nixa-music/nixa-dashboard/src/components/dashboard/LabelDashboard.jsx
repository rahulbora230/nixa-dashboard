import React, { useState, useEffect } from 'react';
import StatCard from '../ui/StatCard';
import Card from '../ui/Card';
import EnhancedDataTable from '../ui/EnhancedDataTable';
import EnhancedEmptyState from '../ui/EnhancedEmptyState';
import Button from '../ui/Button';
import '../styles/design-system.css';

const LabelDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [artists, setArtists] = useState([]);
  const [releases, setReleases] = useState([]);
  const [teamOverview, setTeamOverview] = useState({});

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setStats({
        totalArtists: 24,
        activeArtists: 18,
        totalReleases: 347,
        totalRevenue: '$1,247,893',
        monthlyRevenue: '$124,789',
        revenueSplit: '65/35',
        pendingApprovals: 5
      });
      
      setArtists([
        { id: 1, name: 'The Waves', status: 'Active', releases: 12, revenue: '$45,234', monthlyGrowth: '+12.4%' },
        { id: 2, name: 'Luna Star', status: 'Active', releases: 8, revenue: '$32,156', monthlyGrowth: '+8.7%' },
        { id: 3, name: 'City Lights', status: 'Active', releases: 15, revenue: '$28,945', monthlyGrowth: '+15.2%' },
        { id: 4, name: 'Urban Dreams', status: 'Inactive', releases: 6, revenue: '$12,789', monthlyGrowth: '-2.1%' }
      ]);
      
      setReleases([
        { id: 1, title: 'Summer Vibes', artist: 'The Waves', status: 'Live', releaseDate: '2024-01-15', streams: '145K' },
        { id: 2, title: 'Midnight Sessions', artist: 'Luna Star', status: 'Live', releaseDate: '2024-01-10', streams: '98K' },
        { id: 3, title: 'Urban Dreams', artist: 'City Lights', status: 'In Review', releaseDate: '2024-01-08', streams: '-' },
        { id: 4, title: 'Acoustic Sessions', artist: 'The Waves', status: 'Draft', releaseDate: '2024-01-05', streams: '-' }
      ]);
      
      setTeamOverview({
        totalMembers: 8,
        activeMembers: 6,
        pendingInvites: 2,
        roles: { admin: 2, manager: 3, artist: 24 }
      });
      
      setLoading(false);
    }, 1500);
  }, []);

  const artistsColumns = [
    { key: 'name', title: 'Artist Name', sortable: true },
    { 
      key: 'status', 
      title: 'Status', 
      sortable: true,
      render: (status) => (
        <span className={`badge badge-${status === 'Active' ? 'success' : 'warning'}`}>
          {status}
        </span>
      )
    },
    { key: 'releases', title: 'Releases', sortable: true },
    { key: 'revenue', title: 'Revenue', sortable: true },
    { 
      key: 'monthlyGrowth', 
      title: 'Monthly Growth', 
      sortable: true,
      render: (growth) => (
        <span className={`font-medium ${growth.startsWith('+') ? 'text-success' : 'text-error'}`}>
          {growth}
        </span>
      )
    }
  ];

  const releasesColumns = [
    { key: 'title', title: 'Release Title', sortable: true },
    { key: 'artist', title: 'Artist', sortable: true },
    { 
      key: 'status', 
      title: 'Status', 
      sortable: true,
      render: (status) => (
        <span className={`badge badge-${status === 'Live' ? 'success' : status === 'In Review' ? 'warning' : 'info'}`}>
          {status}
        </span>
      )
    },
    { key: 'releaseDate', title: 'Release Date', sortable: true },
    { key: 'streams', title: 'Streams', sortable: true }
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
        <h2 className="text-3xl font-bold text-primary mb-6">Label Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Total Artists" 
            value={stats.totalArtists}
            change="+3"
            changeType="positive"
            trend="up"
            icon="🎤"
            subtitle="Signed artists"
          />
          <StatCard 
            title="Active Artists" 
            value={stats.activeArtists}
            change="+2"
            changeType="positive"
            trend="up"
            icon="✅"
            subtitle="Currently active"
          />
          <StatCard 
            title="Total Releases" 
            value={stats.totalReleases}
            change="+12"
            changeType="positive"
            trend="up"
            icon="🎵"
            subtitle="All releases"
          />
          <StatCard 
            title="Total Revenue" 
            value={stats.totalRevenue}
            change="+15.7%"
            changeType="positive"
            trend="up"
            icon="💰"
            subtitle="All time earnings"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Monthly Revenue" 
            value={stats.monthlyRevenue}
            change="+18.2%"
            changeType="positive"
            trend="up"
            icon="📈"
            subtitle="This month"
          />
          <StatCard 
            title="Revenue Split" 
            value={stats.revenueSplit}
            icon="📊"
            subtitle="Label/Artist split"
          />
          <StatCard 
            title="Pending Approvals" 
            value={stats.pendingApprovals}
            change="+2"
            changeType="positive"
            trend="up"
            icon="⏳"
            subtitle="Awaiting review"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button variant="primary" className="w-full">
                👥 Invite Artist
              </Button>
              <Button variant="secondary" className="w-full">
                📊 View Analytics
              </Button>
              <Button variant="secondary" className="w-full">
                💳 Process Payouts
              </Button>
              <Button variant="secondary" className="w-full">
                📤 Export Reports
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Artists Overview */}
        <section>
          <Card>
            <div className="card-header">
              <h3 className="text-xl font-semibold text-primary">Artists Overview</h3>
            </div>
            <div className="card-body">
              <EnhancedDataTable 
                data={artists}
                columns={artistsColumns}
                pagination={false}
                className="text-sm"
              />
            </div>
          </Card>
        </section>

        {/* Recent Releases */}
        <section>
          <Card>
            <div className="card-header">
              <h3 className="text-xl font-semibold text-primary">Recent Releases</h3>
            </div>
            <div className="card-body">
              <EnhancedDataTable 
                data={releases}
                columns={releasesColumns}
                pagination={false}
                className="text-sm"
              />
            </div>
          </Card>
        </section>
      </div>

      {/* Team Overview */}
      <section>
        <Card>
          <div className="card-header">
            <h3 className="text-xl font-semibold text-primary">Team Overview</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary mb-2">{teamOverview.totalMembers}</div>
                <div className="text-sm text-secondary">Total Members</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success mb-2">{teamOverview.activeMembers}</div>
                <div className="text-sm text-secondary">Active Members</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning mb-2">{teamOverview.pendingInvites}</div>
                <div className="text-sm text-secondary">Pending Invites</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-info mb-2">{teamOverview.roles.artist}</div>
                <div className="text-sm text-secondary">Total Artists</div>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-primary mb-4">Role Distribution</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-secondary rounded-lg">
                  <div className="text-xl font-bold text-primary">{teamOverview.roles.admin}</div>
                  <div className="text-sm text-secondary">Admins</div>
                </div>
                <div className="text-center p-4 bg-secondary rounded-lg">
                  <div className="text-xl font-bold text-primary">{teamOverview.roles.manager}</div>
                  <div className="text-sm text-secondary">Managers</div>
                </div>
                <div className="text-center p-4 bg-secondary rounded-lg">
                  <div className="text-xl font-bold text-primary">{teamOverview.roles.artist}</div>
                  <div className="text-sm text-secondary">Artists</div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default LabelDashboard;
