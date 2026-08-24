/**
 * eSIM Revenue & Sales Monitoring Dashboard Script
 * Fetches real-time JSON data from Supabase RPC API
 */

const API_URL = 'https://asfjsompzbptcbhlcueq.supabase.co/rest/v1/rpc/get_sales_dashboard';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZmpzb21wemJwdGNiaGxjdWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxOTI1ODAsImV4cCI6MjEwMjc2ODU4MH0.Yb88dYaeAg7irOFJtwVMz2LaDEsT0U6LWot5WDkgq1w';

// Data State
let rawDashboardData = null;
let currentSelectedDate = '2026-05-31';

// Chart Instances
let dailyChartInstance = null;
let destinationChartInstance = null;
let monthlyChartInstance = null;

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  fetchDashboardData();
});

function setupEventListeners() {
  const datePicker = document.getElementById('datePicker');
  if (datePicker) {
    datePicker.addEventListener('change', (e) => {
      currentSelectedDate = e.target.value;
      updateDashboardForDate(currentSelectedDate);
    });
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchDashboardData();
    });
  }

  const toggleBtns = document.querySelectorAll('.toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const metric = btn.getAttribute('data-metric');
      updateDailyChartMetric(metric);
    });
  });

  const simFilter = document.getElementById('simTypeFilter');
  if (simFilter) {
    simFilter.addEventListener('change', (e) => {
      renderDestinationsChart(e.target.value);
    });
  }

  const searchInput = document.getElementById('searchLeaderboard');
  const sortSelect = document.getElementById('sortLeaderboard');
  if (searchInput) searchInput.addEventListener('input', () => renderLeaderboard());
  if (sortSelect) sortSelect.addEventListener('change', () => renderLeaderboard());
}

async function fetchDashboardData() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        report_date: currentSelectedDate
      })
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();

    if (Array.isArray(data) && data[0] && data[0].dashboard_data) {
      rawDashboardData = data[0].dashboard_data;
    } else if (data.dashboard_data) {
      rawDashboardData = data.dashboard_data;
    } else {
      rawDashboardData = data;
    }

    renderDashboard();
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
  }
}

function renderDashboard() {
  if (!rawDashboardData) return;
  renderFixedKPIs();
  updateDashboardForDate(currentSelectedDate);
  renderDailyRevenueChart();
  renderDestinationsChart('all');
  renderMonthlyPerformanceChart();
  renderLeaderboard();
}

// Formatters
function formatINR(amount) {
  if (amount === undefined || amount === null) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

function formatNum(num) {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
}

// Render MTD & Performer KPIs
function renderFixedKPIs() {
  const mtd = rawDashboardData.month_mtd || { revenue: 0, orders: 0 };
  const mtdRevEl = document.getElementById('mtdRevenue');
  const mtdOrdersEl = document.getElementById('mtdOrders');

  if (mtdRevEl) mtdRevEl.textContent = formatINR(mtd.revenue);
  if (mtdOrdersEl) mtdOrdersEl.textContent = formatNum(mtd.orders);

  const leaderboard = rawDashboardData.daily_leaderboard || [];
  if (leaderboard.length > 0) {
    const sorted = [...leaderboard].sort((a, b) => b.target_percent - a.target_percent);
    const topRep = sorted[0];

    const performerName = document.getElementById('performerName');
    const performerTarget = document.getElementById('performerTarget');
    const performerMtdRev = document.getElementById('performerMtdRev');

    if (performerName) performerName.textContent = topRep.sales_rep;
    if (performerTarget) performerTarget.textContent = `${topRep.target_percent.toFixed(1)}% Target`;
    if (performerMtdRev) performerMtdRev.textContent = `MTD: ${formatINR(topRep.mtd_revenue)}`;
  }
}

// Update Selected Date KPIs
function updateDashboardForDate(dateStr) {
  if (!rawDashboardData) return;

  const dailySummary = rawDashboardData.daily_summary || [];
  const selectedDayData = dailySummary.find(item => item.date === dateStr);
  const prevMonthSameDay = rawDashboardData.prev_month_same_day || { revenue: 0, orders: 0 };

  const todayRevEl = document.getElementById('todayRevenue');
  const todayOrdersEl = document.getElementById('todayOrders');
  const todayRevLabel = document.getElementById('todayRevLabel');
  const todayOrdersLabel = document.getElementById('todayOrdersLabel');
  const todayRevPercentEl = document.getElementById('todayRevPercent');
  const todayOrdersPercentEl = document.getElementById('todayOrdersPercent');
  const todayRevTrendBadge = document.getElementById('todayRevTrend');
  const todayOrdersTrendBadge = document.getElementById('todayOrdersTrend');
  const todayAOVElements = document.getElementById('todayAOV');

  const d = new Date(dateStr);
  const formattedDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

  if (todayRevLabel) todayRevLabel.textContent = `Revenue (${formattedDate})`;
  if (todayOrdersLabel) todayOrdersLabel.textContent = `Orders (${formattedDate})`;

  let revenue = 0;
  let orders = 0;

  if (selectedDayData) {
    revenue = selectedDayData.revenue;
    orders = selectedDayData.orders;
  } else if (rawDashboardData.today_performance) {
    revenue = rawDashboardData.today_performance.revenue;
    orders = rawDashboardData.today_performance.orders;
  }

  if (todayRevEl) todayRevEl.textContent = formatINR(revenue);
  if (todayOrdersEl) todayOrdersEl.textContent = formatNum(orders);

  const aov = orders > 0 ? (revenue / orders) : 0;
  if (todayAOVElements) todayAOVElements.textContent = formatINR(aov);

  if (prevMonthSameDay && prevMonthSameDay.revenue > 0) {
    const revDiff = ((revenue - prevMonthSameDay.revenue) / prevMonthSameDay.revenue) * 100;
    if (todayRevPercentEl) todayRevPercentEl.textContent = `${revDiff >= 0 ? '+' : ''}${revDiff.toFixed(1)}%`;
    if (todayRevTrendBadge) {
      todayRevTrendBadge.className = revDiff >= 0 ? 'trend-badge positive' : 'trend-badge negative';
    }
  }

  if (prevMonthSameDay && prevMonthSameDay.orders > 0) {
    const orderDiff = ((orders - prevMonthSameDay.orders) / prevMonthSameDay.orders) * 100;
    if (todayOrdersPercentEl) todayOrdersPercentEl.textContent = `${orderDiff >= 0 ? '+' : ''}${orderDiff.toFixed(1)}%`;
    if (todayOrdersTrendBadge) {
      todayOrdersTrendBadge.className = orderDiff >= 0 ? 'trend-badge positive' : 'trend-badge negative';
    }
  }
}

// Daily Revenue Line Chart
function renderDailyRevenueChart() {
  const ctx = document.getElementById('dailyRevenueChart');
  if (!ctx) return;

  const dailySummary = rawDashboardData.daily_summary || [];
  const labels = dailySummary.map(item => item.date_label || item.date);
  const revenueData = dailySummary.map(item => item.revenue);
  const ordersData = dailySummary.map(item => item.orders);

  if (dailyChartInstance) dailyChartInstance.destroy();

  dailyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Revenue (₹)',
          data: revenueData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.05)',
          fill: true,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 3,
          yAxisID: 'y'
        },
        {
          label: 'Orders',
          data: ordersData,
          borderColor: '#0891b2',
          borderDash: [4, 4],
          fill: false,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (e, elements) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          if (dailySummary[idx]) {
            const selected = dailySummary[idx].date;
            currentSelectedDate = selected;
            const datePicker = document.getElementById('datePicker');
            if (datePicker) datePicker.value = selected;
            updateDashboardForDate(selected);
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { color: '#0f172a', font: { family: 'Inter', size: 11, weight: '600' } }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.datasetIndex === 0
                ? `Revenue: ${formatINR(context.raw)}`
                : `Orders: ${context.raw}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#e2e8f0' },
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }
        },
        y: {
          type: 'linear',
          position: 'left',
          grid: { color: '#e2e8f0' },
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
            callback: value => '₹' + (value / 1000).toFixed(0) + 'k'
          }
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#0891b2', font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });
}

function updateDailyChartMetric(metric) {
  if (!dailyChartInstance) return;
  if (metric === 'both') {
    dailyChartInstance.show(0);
    dailyChartInstance.show(1);
  } else if (metric === 'revenue') {
    dailyChartInstance.show(0);
    dailyChartInstance.hide(1);
  } else if (metric === 'orders') {
    dailyChartInstance.hide(0);
    dailyChartInstance.show(1);
  }
}

// Top Destinations Donut Chart
function renderDestinationsChart(filterType = 'all') {
  const ctx = document.getElementById('topDestinationsChart');
  if (!ctx) return;

  let destinations = rawDashboardData.top_destinations || [];

  if (filterType === 'esim') {
    destinations = destinations.filter(d => d.destination.toLowerCase().includes('esim'));
  } else if (filterType === 'plastic') {
    destinations = destinations.filter(d => d.destination.toLowerCase().includes('plastic'));
  }

  const topItems = destinations.slice(0, 6);
  const labels = topItems.map(item => item.destination.length > 25 ? item.destination.substring(0, 23) + '...' : item.destination);
  const dataValues = topItems.map(item => item.orders);

  if (destinationChartInstance) destinationChartInstance.destroy();

  const chartColors = ['#2563eb', '#0891b2', '#10b981', '#d97706', '#7c3aed', '#e11d48'];

  destinationChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: chartColors,
        borderWidth: 1,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: { color: '#0f172a', font: { family: 'Inter', size: 11 } }
        }
      },
      cutout: '65%'
    }
  });
}

// Monthly Performance Bar Graph
function renderMonthlyPerformanceChart() {
  const ctx = document.getElementById('monthlyPerformanceChart');
  if (!ctx) return;

  const monthlySummary = rawDashboardData.monthly_summary || [];
  const labels = monthlySummary.map(item => item.month_label || item.month);
  const revenueData = monthlySummary.map(item => item.revenue);
  const ordersData = monthlySummary.map(item => item.orders);

  if (monthlyChartInstance) monthlyChartInstance.destroy();

  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Revenue (₹)',
          data: revenueData,
          backgroundColor: '#2563eb',
          yAxisID: 'y'
        },
        {
          label: 'Orders',
          data: ordersData,
          backgroundColor: '#10b981',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { color: '#0f172a', font: { family: 'Inter', size: 11 } }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b' } },
        y: {
          type: 'linear',
          position: 'left',
          grid: { color: '#e2e8f0' },
          ticks: {
            color: '#64748b',
            callback: value => '₹' + (value / 1000).toFixed(0) + 'k'
          }
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#10b981' }
        }
      }
    }
  });
}

// Sales Team Leaderboard Table
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboardTbody');
  if (!tbody || !rawDashboardData) return;

  let leaderboard = rawDashboardData.daily_leaderboard || [];

  const searchVal = (document.getElementById('searchLeaderboard')?.value || '').toLowerCase();
  if (searchVal) {
    leaderboard = leaderboard.filter(rep => rep.sales_rep.toLowerCase().includes(searchVal));
  }

  const sortVal = document.getElementById('sortLeaderboard')?.value || 'target_percent';
  leaderboard.sort((a, b) => (b[sortVal] || 0) - (a[sortVal] || 0));

  tbody.innerHTML = '';

  if (leaderboard.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 20px;">No results match "${searchVal}"</td></tr>`;
    return;
  }

  leaderboard.forEach((rep, idx) => {
    const rank = idx + 1;
    const targetPct = rep.target_percent || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank-text">#${rank}</td>
      <td><strong>${rep.sales_rep}</strong></td>
      <td>${rep.day_orders}</td>
      <td>${formatINR(rep.day_revenue)}</td>
      <td>${rep.mtd_orders}</td>
      <td>${formatINR(rep.mtd_revenue)}</td>
      <td>${formatINR(rep.arpu)}</td>
      <td>
        <div>
          <strong>${targetPct.toFixed(1)}%</strong> <span style="color: #64748b; font-size: 0.75rem;">(Target: ${rep.target})</span>
          <div class="progress-bar-simple">
            <div class="progress-fill" style="width: ${Math.min(targetPct, 100)}%;"></div>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}