import { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

interface ExpectedFailure {
  title: string;
  project: string;
  reason: string;
}

class CustomReporter implements Reporter {
  private apiPassed = 0;
  private apiFailed = 0;
  private apiExpectedFailed = 0;
  private uiPassed = 0;
  private uiFailed = 0;
  private uiExpectedFailed = 0;
  
  // Track details of expected failures to display to stakeholders
  private expectedFailuresList: ExpectedFailure[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    // Determine test type based on its file path directory
    const filePath = test.location.file;
    const isApi = filePath.includes(path.join('tests', 'api'));

    const status = result.status;
    const expectedStatus = test.expectedStatus;

    if (isApi) {
      if (status === expectedStatus) {
        if (expectedStatus === 'failed') {
          this.apiExpectedFailed++;
          // Extract Playwright fail annotation description
          const failAnnotation = test.annotations.find(a => a.type === 'fail');
          const reason = failAnnotation?.description || 'Known application vulnerability';
          
          this.expectedFailuresList.push({
            title: test.titlePath().slice(2).join(' › '),
            project: test.parent.project()?.name || 'default',
            reason
          });
        } else {
          this.apiPassed++;
        }
      } else {
        this.apiFailed++;
      }
    } else {
      if (status === expectedStatus) {
        if (expectedStatus === 'failed') {
          this.uiExpectedFailed++;
          const failAnnotation = test.annotations.find(a => a.type === 'fail');
          const reason = failAnnotation?.description || 'Known application vulnerability';
          
          this.expectedFailuresList.push({
            title: test.titlePath().slice(2).join(' › '),
            project: test.parent.project()?.name || 'default',
            reason
          });
        } else {
          this.uiPassed++;
        }
      } else {
        this.uiFailed++;
      }
    }
  }

  async onEnd(result: FullResult) {
    const apiTotal = this.apiPassed + this.apiFailed + this.apiExpectedFailed;
    const uiTotal = this.uiPassed + this.uiFailed + this.uiExpectedFailed;
    const totalTests = apiTotal + uiTotal;

    const totalSuccess = this.apiPassed + this.apiExpectedFailed + this.uiPassed + this.uiExpectedFailed;
    const totalFailed = this.apiFailed + this.uiFailed;

    const reportsDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate table rows for expected failures
    let expectedFailuresRows = '';
    if (this.expectedFailuresList.length > 0) {
      // De-duplicate same test failure reasons across browser projects for cleaner stakeholder view
      const uniqueFailuresMap = new Map<string, { projects: string[], reason: string }>();
      for (const item of this.expectedFailuresList) {
        const key = item.title;
        if (!uniqueFailuresMap.has(key)) {
          uniqueFailuresMap.set(key, { projects: [item.project], reason: item.reason });
        } else {
          uniqueFailuresMap.get(key)!.projects.push(item.project);
        }
      }

      for (const [title, details] of uniqueFailuresMap.entries()) {
        expectedFailuresRows += `
          <tr>
            <td><span class="badge warning">Security Tracking</span></td>
            <td style="font-weight: 600;">${title}</td>
            <td><span style="font-family: monospace; font-size: 0.85rem;">${details.projects.join(', ')}</span></td>
            <td class="text-warning" style="font-size: 0.9rem; line-height: 1.4;">${details.reason}</td>
          </tr>
        `;
      }
    } else {
      expectedFailuresRows = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No known vulnerabilities or expected failures recorded in this execution run.
          </td>
        </tr>
      `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Automation Suite Analytics Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg-color: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #6366f1;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --info: #06b6d4;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      padding: 2rem;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    h1 {
      font-size: 2.25rem;
      font-weight: 700;
      background: linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .timestamp {
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2.5rem;
    }

    .stat-card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      border-color: var(--primary);
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background-color: var(--primary);
    }

    .stat-card.success::before { background-color: var(--success); }
    .stat-card.danger::before { background-color: var(--danger); }
    .stat-card.warning::before { background-color: var(--warning); }
    .stat-card.info::before { background-color: var(--info); }

    .stat-label {
      color: var(--text-muted);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 2.25rem;
      font-weight: 700;
    }

    /* Charts Grid */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 2rem;
      margin-bottom: 2.5rem;
    }

    @media (max-width: 768px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    .chart-container {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
    }

    .chart-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: var(--text-main);
      width: 100%;
      text-align: left;
    }

    .chart-wrapper {
      position: relative;
      width: 100%;
      height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Table Container */
    .table-container {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      margin-bottom: 2.5rem;
    }

    .table-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      color: var(--text-muted);
      font-weight: 600;
      padding: 1rem;
      border-bottom: 2px solid var(--card-border);
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
    }

    td {
      padding: 1.25rem 1rem;
      border-bottom: 1px solid var(--card-border);
      font-size: 0.95rem;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge.api { background-color: rgba(99, 102, 241, 0.15); color: #818cf8; }
    .badge.ui { background-color: rgba(6, 182, 212, 0.15); color: #22d3ee; }
    .badge.warning { background-color: rgba(245, 158, 11, 0.15); color: var(--warning); }
    
    .text-success { color: var(--success); font-weight: 600; }
    .text-danger { color: var(--danger); font-weight: 600; }
    .text-warning { color: var(--warning); font-weight: 600; }

    .nav-btn {
      background-color: var(--primary);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      transition: background-color 0.2s;
    }

    .nav-btn:hover {
      background-color: #4f46e5;
    }

    /* Warning Block */
    .warning-section {
      border: 1px solid rgba(245, 158, 11, 0.3);
      background-color: rgba(245, 158, 11, 0.05);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Test Suite Analytics Dashboard</h1>
        <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
      </div>
      <a href="index.html" class="nav-btn">View Detailed Playwright HTML Report</a>
    </header>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card info">
        <div class="stat-label">Total Test Cases</div>
        <div class="stat-value">${totalTests}</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">Total Passed</div>
        <div class="stat-value">${totalSuccess}</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-label">Total Failed</div>
        <div class="stat-value">${totalFailed}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Vulnerabilities Tracked</div>
        <div class="stat-value">${this.apiExpectedFailed + this.uiExpectedFailed}</div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="charts-grid">
      <div class="chart-container">
        <div class="chart-title">Test Distribution (API vs UI)</div>
        <div class="chart-wrapper">
          <canvas id="distributionChart"></canvas>
        </div>
      </div>
      <div class="chart-container">
        <div class="chart-title">Execution Results by Scope</div>
        <div class="chart-wrapper">
          <canvas id="resultsChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Details Table -->
    <div class="table-container">
      <div class="table-title">Execution Breakdown Metrics</div>
      <table>
        <thead>
          <tr>
            <th>Testing Scope</th>
            <th>Total Cases</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Expected Failures (Vulnerabilities)</th>
            <th>Success Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="badge api">API Scope</span></td>
            <td>${apiTotal}</td>
            <td class="text-success">${this.apiPassed}</td>
            <td class="${this.apiFailed > 0 ? 'text-danger' : ''}">${this.apiFailed}</td>
            <td class="text-warning">${this.apiExpectedFailed}</td>
            <td class="text-success">${apiTotal > 0 ? ((this.apiPassed + this.apiExpectedFailed) / apiTotal * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td><span class="badge ui">UI E2E Scope</span></td>
            <td>${uiTotal}</td>
            <td class="text-success">${this.uiPassed}</td>
            <td class="${this.uiFailed > 0 ? 'text-danger' : ''}">${this.uiFailed}</td>
            <td class="text-warning">${this.uiExpectedFailed}</td>
            <td class="text-success">${uiTotal > 0 ? ((this.uiPassed + this.uiExpectedFailed) / uiTotal * 100).toFixed(1) : 0}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Expected Failures / Vulnerabilities Details Table -->
    <div class="table-container warning-section">
      <div class="table-title" style="color: var(--warning); display: flex; align-items: center; gap: 0.5rem;">
        ⚠️ Known Vulnerabilities & Expected Failures Registry
      </div>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">
        The following test cases validate security vulnerabilities or unpatched application flaws. They are expected to fail in their assertions. A passing status in the stats indicates that they failed as expected, and are being actively logged and tracked.
      </p>
      <table>
        <thead>
          <tr>
            <th style="width: 15%;">Type</th>
            <th style="width: 35%;">Test Case Title</th>
            <th style="width: 15%;">Environment</th>
            <th style="width: 35%;">Vulnerability / Defect Rationale</th>
          </tr>
        </thead>
        <tbody>
          ${expectedFailuresRows}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    // Configuration options for charts
    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 12 }
          }
        }
      }
    };

    // 1. Distribution Pie Chart
    const distCtx = document.getElementById('distributionChart').getContext('2d');
    new Chart(distCtx, {
      type: 'doughnut',
      data: {
        labels: ['API Tests', 'UI Tests'],
        datasets: [{
          data: [${apiTotal}, ${uiTotal}],
          backgroundColor: ['#6366f1', '#06b6d4'],
          borderColor: '#1e293b',
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        ...commonOptions,
        cutout: '65%'
      }
    });

    // 2. Results Bar Graph
    const resCtx = document.getElementById('resultsChart').getContext('2d');
    new Chart(resCtx, {
      type: 'bar',
      data: {
        labels: ['API Scope', 'UI E2E Scope'],
        datasets: [
          {
            label: 'Passed',
            data: [${this.apiPassed}, ${this.uiPassed}],
            backgroundColor: '#10b981',
            borderRadius: 6
          },
          {
            label: 'Failed',
            data: [${this.apiFailed}, ${this.uiFailed}],
            backgroundColor: '#ef4444',
            borderRadius: 6
          },
          {
            label: 'Expected Failure',
            data: [${this.apiExpectedFailed}, ${this.uiExpectedFailed}],
            backgroundColor: '#f59e0b',
            borderRadius: 6
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
          },
          y: {
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8', font: { family: 'Outfit' }, stepSize: 1 }
          }
        }
      }
    });
  </script>
</body>
</html>
    `;

    const htmlPath = path.resolve(reportsDir, 'dashboard.html');
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    console.log(`\n📊 Dashboard Report Generated successfully: file://${htmlPath}`);
  }
}

export default CustomReporter;
