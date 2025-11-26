import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [metricsRes, healthRes] = await Promise.all([
        fetch('/api/metrics').then(r => r.json()),
        fetch('/api/health').then(r => r.json())
      ]);

      setMetrics(metricsRes.metrics || {});
      setHealth(healthRes);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const triggerIncident = async (incident) => {
    if (!confirm(`Trigger "${incident}" incident?`)) return;

    try {
      const res = await fetch('/api/trigger-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident })
      });
      const data = await res.json();
      alert(data.message + '\n\nYour AI agent should now detect this in Vercel/Railway logs.');
      fetchData();
    } catch (error) {
      alert('Failed to trigger incident: ' + error.message);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading dashboard...</div>;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Analytics Dashboard</h1>
        <div style={styles.healthBadge}>
          <span style={{
            ...styles.statusDot,
            backgroundColor: health?.status === 'healthy' ? '#10b981' : '#ef4444'
          }} />
          {health?.status || 'unknown'}
        </div>
      </header>

      <div style={styles.grid}>
        {/* Metrics Cards */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Total Events</h3>
          <div style={styles.metricValue}>{metrics?.totalEvents || 0}</div>
          <div style={styles.cardFooter}>All time</div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Action Types</h3>
          <div style={styles.metricValue}>
            {Object.keys(metrics?.eventsByAction || {}).length}
          </div>
          <div style={styles.cardFooter}>Unique actions</div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Active Users</h3>
          <div style={styles.metricValue}>
            {Object.keys(metrics?.eventsByUser || {}).length}
          </div>
          <div style={styles.cardFooter}>Total users</div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Database</h3>
          <div style={styles.metricValue}>
            {health?.database === 'connected' ? 'Connected' : 'Disconnected'}
          </div>
          <div style={styles.cardFooter}>{health?.database || 'unknown'}</div>
        </div>
      </div>

      {/* Events by Action */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Events by Action</h2>
        <div style={styles.table}>
          {Object.entries(metrics?.eventsByAction || {}).length > 0 ? (
            Object.entries(metrics.eventsByAction)
              .sort((a, b) => b[1] - a[1])
              .map(([action, count]) => (
                <div key={action} style={styles.tableRow}>
                  <span style={styles.actionName}>{action}</span>
                  <span style={styles.actionCount}>{count}</span>
                </div>
              ))
          ) : (
            <div style={styles.emptyState}>
              No events yet. Send some events to see analytics!
            </div>
          )}
        </div>
      </div>

      {/* Incident Simulation */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Trigger Test Incidents</h2>
        <p style={styles.infoText}>
          Simulate failures to test your AI agent. Click a button below to trigger an incident.
          Your agent will detect it in Vercel/Railway logs and should remediate automatically.
        </p>
        <div style={styles.categorySection}>
          <h3 style={styles.categoryTitle}>Fixable by Agent (Restart/Rollback)</h3>
          <div style={styles.buttonGrid}>
            <button
              style={{...styles.incidentButton, backgroundColor: '#f59e0b'}}
              onClick={() => triggerIncident('stuck_worker')}
            >
              Stuck Worker
            </button>
            <button
              style={{...styles.incidentButton, backgroundColor: '#f59e0b'}}
              onClick={() => triggerIncident('high_error_rate')}
            >
              High Error Rate
            </button>
            <button
              style={{...styles.incidentButton, backgroundColor: '#f59e0b'}}
              onClick={() => triggerIncident('bad_deployment')}
            >
              Bad Deployment
            </button>
          </div>
        </div>

        <div style={styles.categorySection}>
          <h3 style={styles.categoryTitle}>Requires Developer Intervention</h3>
          <div style={styles.buttonGrid}>
            <button
              style={{...styles.incidentButton, backgroundColor: '#ef4444'}}
              onClick={() => triggerIncident('db_connection_loss')}
            >
              DB Connection Loss
            </button>
            <button
              style={{...styles.incidentButton, backgroundColor: '#ef4444'}}
              onClick={() => triggerIncident('persistent_errors')}
            >
              Persistent Errors
            </button>
          </div>
        </div>

        <div style={styles.incidentInfo}>
          <p><strong>What happens when you trigger an incident:</strong></p>

          <div style={styles.incidentList}>
            <div style={styles.incidentItem}>
              <strong>Stuck Worker (Fixable)</strong>
              <p>Creates 100 unprocessed events. Agent should restart worker pod.</p>
            </div>

            <div style={styles.incidentItem}>
              <strong>High Error Rate (Fixable)</strong>
              <p>Generates 20+ error logs. Agent should restart worker pod.</p>
            </div>

            <div style={styles.incidentItem}>
              <strong>Bad Deployment (Fixable)</strong>
              <p>Creates API errors in Vercel. Agent should rollback to previous deployment.</p>
            </div>

            <div style={styles.incidentItem}>
              <strong>DB Connection Loss (Escalate)</strong>
              <p>Database is down. Restart won't fix this. Agent should ping developer.</p>
            </div>

            <div style={styles.incidentItem}>
              <strong>Persistent Errors (Escalate)</strong>
              <p>Code-level bug. Restart won't fix. Agent should ping developer after 3 failed restart attempts.</p>
            </div>
          </div>

          <p style={styles.agentNote}>
            Your AI agent should monitor Vercel/Railway logs, detect these patterns, and take appropriate action using official platform APIs.
          </p>
        </div>
      </div>

      <footer style={styles.footer}>
        <p>Mini-Microservice Analytics Test App v1.0.0</p>
        <p>Built for testing AI on-call agents</p>
        <p style={styles.updated}>Last updated: {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f9fafb',
    minHeight: '100vh'
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#6b7280'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: '#111827'
  },
  healthBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  card: {
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  cardTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  metricValue: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#111827',
    margin: '8px 0'
  },
  cardFooter: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  section: {
    marginBottom: '30px',
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827'
  },
  infoText: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6'
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  tableRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px'
  },
  actionName: {
    fontWeight: '500',
    color: '#374151'
  },
  actionCount: {
    fontWeight: '600',
    color: '#6366f1'
  },
  categorySection: {
    marginBottom: '24px'
  },
  categoryTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px'
  },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    marginBottom: '12px'
  },
  incidentButton: {
    padding: '14px 20px',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  incidentInfo: {
    marginTop: '24px',
    padding: '20px',
    backgroundColor: '#fef3c7',
    borderLeft: '4px solid #f59e0b',
    borderRadius: '4px'
  },
  incidentList: {
    margin: '16px 0'
  },
  incidentItem: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #fde68a'
  },
  agentNote: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #fde68a',
    fontSize: '14px',
    fontWeight: '600',
    color: '#92400e'
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '14px'
  },
  footer: {
    marginTop: '40px',
    padding: '20px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '12px',
    borderTop: '1px solid #e5e7eb'
  },
  updated: {
    marginTop: '8px',
    fontSize: '11px',
    color: '#9ca3af'
  }
};
