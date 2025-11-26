export default function Home() {
  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '800px',
      margin: '50px auto',
      padding: '20px'
    }}>
      <h1>Mini-Microservice Analytics API</h1>
      <p>Welcome to the Analytics API service.</p>

      <h2>Available Endpoints</h2>
      <ul>
        <li>
          <strong>POST /api/events</strong> - Submit analytics events
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
{`curl -X POST /api/events \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "user_001", "action": "page_view"}'`}
          </pre>
        </li>
        <li>
          <strong>GET /api/metrics</strong> - View aggregated metrics
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
{`curl /api/metrics`}
          </pre>
        </li>
        <li>
          <strong>GET /api/health</strong> - Health check
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
{`curl /api/health`}
          </pre>
        </li>
      </ul>

      <h2>Documentation</h2>
      <p>
        For full documentation, setup instructions, and deployment guides,
        see the <a href="https://github.com/your-repo/README.md">README</a>.
      </p>

      <hr style={{ margin: '30px 0' }} />
      <p style={{ color: '#666', fontSize: '14px' }}>
        Mini-Microservice Analytics Test App v1.0.0
      </p>
    </div>
  );
}
