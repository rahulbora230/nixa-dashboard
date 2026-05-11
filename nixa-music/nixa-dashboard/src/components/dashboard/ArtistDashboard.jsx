import React, { useState, useEffect } from 'react';
import StatCard from '../ui/StatCard';
import Card from '../ui/Card';
import EnhancedDataTable from '../ui/EnhancedDataTable';
import EnhancedEmptyState from '../ui/EnhancedEmptyState';
import Button from '../ui/Button';
import '../styles/design-system.css';

const ArtistDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [recentReleases, setRecentReleases] = useState([]);
  const [revenueData, setRevenueData] = useState([]);

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      setStats({
        totalRevenue: '$124,892',
        monthlyRevenue: '$12,485',
        totalStreams: '2.8M',
        monthlyStreams: '342K',
        pendingPayouts: '$8,234',
        activeReleases: 24,
        topPlatform: 'Spotify',
        monthlyGrowth: '+18.2%'
      });
      
      setRecentReleases([
        { id: 1, title: 'Summer Vibes', status: 'Live', streams: '145K', revenue: '$8,234', date: '2024-01-15' },
        { id: 2, title: 'Midnight Dreams', status: 'Live', streams: '98K', revenue: '$5,621', date: '2024-01-10' },
        { id: 3, title: 'Urban Lights', status: 'In Review', streams: '-', revenue: '-', date: '2024-01-08' },
        { id: 4, title: 'Acoustic Sessions', status: 'Draft', streams: '-', revenue: '-', date: '2024-01-05' }
      ]);
      
      setRevenueData([
        { month: 'Jan 2024', revenue: '$12,485', streams: '342K', growth: '+18.2%' },
        { month: 'Dec 2023', revenue: '$10,567', streams: '289K', growth: '+12.4%' },
        { month: 'Nov 2023', revenue: '$9,401', streams: '257K', growth: '+8.7%' },
        { month: 'Oct 2023', revenue: '$8,654', streams: '236K', growth: '+5.2%' }
      ]);
      
      setLoading(false);
    }, 1500);
  }, []);

  const releasesColumns = [
    { key: 'title', title: 'Release Title', sortable: true },
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
    { key: 'streams', title: 'Streams', sortable: true },
    { key: 'revenue', title: 'Revenue', sortable: true },
    { key: 'date', title: 'Release Date', sortable: true }
  ];

  const revenueColumns = [
    { key: 'month', title: 'Month', sortable: true },
    { key: 'revenue', title: 'Revenue', sortable: true },
    { key: 'streams', title: 'Streams', sortable: true },
    { 
      key: 'growth', 
      title: 'Growth', 
      sortable: true,
      render: (growth) => (
        <span className={`font-medium ${growth.startsWith('+') ? 'text-success' : 'text-error'}`}>
          {growth}
        </span>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCard key={i} loading />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <section className="text-center mb-8">
        <h1 className="text-4xl font-bold text-primary mb-4">
          Welcome back, Artist! 🎵
        </h1>
        <p className="text-xl text-secondary max-w-2xl mx-auto">
          Your music is reaching <span className="text-success font-semibold">2.8M streams</span> this month
        </p>
      </section>

      {/* Revenue Overview */}
      <section>
        <h2 className="text-2xl font-bold text-primary mb-6">Revenue Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatCard 
            title="Total Revenue" 
            value={stats.totalRevenue}
            change="+18.2%"
            changeType="positive"
            trend="up"
            icon="💰"
            subtitle="All time earnings"
          />
          <StatCard 
            title="Monthly Revenue" 
            value={stats.monthlyRevenue}
            change="+12.4%"
            changeType="positive"
            trend="up"
            icon="📈"
            subtitle="This month"
          />
          <StatCard 
            title="Pending Payouts" 
            value={stats.pendingPayouts}
            change="+$2,341"
            changeType="positive"
            trend="up"
            icon="💳"
            subtitle="Ready to withdraw"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Total Streams" 
            value={stats.totalStreams}
            change="+342K"
            changeType="positive"
            trend="up"
            icon="🎧"
            subtitle="All time streams"
          />
          <StatCard 
            title="Monthly Streams" 
            value={stats.monthlyStreams}
            change="+18.2%"
            changeType="positive"
            trend="up"
            icon="📊"
            subtitle="This month"
          />
          <StatCard 
            title="Top Platform" 
            value={stats.topPlatform}
            icon="🎵"
            subtitle="Best performing"
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
                🎵 New Release
              </Button>
              <Button variant="secondary" className="w-full">
                📊 View Analytics
              </Button>
              <Button variant="secondary" className="w-full">
                💳 Request Payout
              </Button>
              <Button variant="secondary" className="w-full">
                📤 Upload Music
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Releases */}
        <section>
          <Card>
            <div className="card-header">
              <h3 className="text-xl font-semibold text-primary">Recent Releases</h3>
            </div>
            <div className="card-body">
              {recentReleases.length > 0 ? (
                <EnhancedDataTable 
                  data={recentReleases}
                  columns={releasesColumns}
                  pagination={false}
                  className="text-sm"
                />
              ) : (
                <EnhancedEmptyState 
                  variant="releases"
                  message="No releases yet"
                  actionText="Create Your First Release"
                />
              )}
            </div>
          </Card>
        </section>

        {/* Revenue History */}
        <section>
          <Card>
            <div className="card-header">
              <h3 className="text-xl font-semibold text-primary">Revenue History</h3>
            </div>
            <div className="card-body">
              <EnhancedDataTable 
                data={revenueData}
                columns={revenueColumns}
                pagination={false}
                className="text-sm"
              />
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default ArtistDashboard;
