import {
  getCompletedRooms, escapeTimeMinutes, initNav
} from './data.js';

const chartColors = {
  gold: '#e6b84f',
  teal: '#4fd1c5',
  green: '#48d989',
  red: '#f06060',
  purple: '#a78bfa',
  blue: '#60a5fa',
  cyan: '#22d3ee',
  text: '#9a97a8',
  textMuted: '#5c5a6b',
  grid: 'rgba(255, 255, 255, 0.05)',
  cardBg: '#111827'
};

const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      labels: {
        color: chartColors.text,
        font: { family: 'Raleway' }
      }
    }
  },
  scales: {
    x: {
      ticks: { color: chartColors.text, font: { family: 'Raleway' } },
      grid: { color: chartColors.grid }
    },
    y: {
      ticks: { color: chartColors.text, font: { family: 'Raleway' } },
      grid: { color: chartColors.grid }
    }
  }
};

const VAULT_CODE = 'THINGS';
const VAULT_STORAGE_KEY = 'escaping-things-stats-unlocked';

async function init() {
  initNav();
  setupVault();
}

function setupVault() {
  const vault = document.getElementById('stats-vault');
  const form = document.getElementById('vault-form');
  const input = document.getElementById('vault-code');
  const message = document.getElementById('vault-message');
  const lockPanel = document.getElementById('vault-lock-panel');
  const content = document.getElementById('vault-content');

  if (!vault || !form || !input || !message || !lockPanel || !content) {
    loadCharts();
    return;
  }

  const unlockVault = async (persist = false) => {
    vault.classList.remove('locked');
    vault.classList.add('unlocked');
    lockPanel.hidden = true;
    content.hidden = false;
    message.textContent = '';

    if (persist) {
      localStorage.setItem(VAULT_STORAGE_KEY, 'true');
    }

    await loadCharts();
  };

  if (localStorage.getItem(VAULT_STORAGE_KEY) === 'true') {
    unlockVault();
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = input.value.trim().toUpperCase();

    if (code === VAULT_CODE) {
      message.textContent = 'Vault unlocked. Welcome back, Escaping Things.';
      await unlockVault(true);
    } else {
      message.textContent = 'Nope. Try the second word of the team name.';
      vault.classList.add('shake');
      setTimeout(() => vault.classList.remove('shake'), 450);
    }
  });
}

async function loadCharts() {
  const completed = await getCompletedRooms();

  renderRoomsPerYear(completed);
  renderMonthlyDistribution(completed);
  renderLocationChart(completed);
  renderCompanyChart(completed);
  renderEscapeTimesChart(completed);
}

function renderRoomsPerYear(completed) {
  const yearData = {};
  completed.forEach(r => {
    const year = r.date.substring(0, 4);
    if (!yearData[year]) yearData[year] = { wins: 0, losses: 0 };
    if (r.win === true) yearData[year].wins++;
    else yearData[year].losses++;
  });

  const sortedYears = Object.keys(yearData).sort();

  new Chart(document.getElementById('chart-rooms-year'), {
    type: 'bar',
    data: {
      labels: sortedYears,
      datasets: [
        {
          label: 'Wins',
          data: sortedYears.map(y => yearData[y].wins),
          backgroundColor: chartColors.green,
          borderRadius: 3
        },
        {
          label: 'Losses',
          data: sortedYears.map(y => yearData[y].losses),
          backgroundColor: chartColors.red,
          borderRadius: 3
        }
      ]
    },
    options: {
      ...defaultChartOptions,
      scales: {
        ...defaultChartOptions.scales,
        x: { ...defaultChartOptions.scales.x, stacked: true },
        y: {
          ...defaultChartOptions.scales.y,
          stacked: true,
          beginAtZero: true,
          ticks: {
            ...defaultChartOptions.scales.y.ticks,
            stepSize: 1
          }
        }
      }
    }
  });
}

function renderMonthlyDistribution(completed) {
  const months = Array(12).fill(0);
  completed.forEach(r => {
    if (r.date) {
      const month = parseInt(r.date.substring(5, 7)) - 1;
      months[month]++;
    }
  });

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  new Chart(document.getElementById('chart-monthly'), {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [{
        label: 'Rooms',
        data: months,
        backgroundColor: chartColors.teal,
        borderRadius: 3
      }]
    },
    options: {
      ...defaultChartOptions,
      plugins: {
        ...defaultChartOptions.plugins,
        legend: { display: false }
      },
      scales: {
        ...defaultChartOptions.scales,
        y: {
          ...defaultChartOptions.scales.y,
          beginAtZero: true,
          ticks: {
            ...defaultChartOptions.scales.y.ticks,
            stepSize: 1
          }
        }
      }
    }
  });
}

function renderLocationChart(completed) {
  const locations = {};
  completed.forEach(r => {
    if (r.location) {
      const parts = [];
      if (r.location.region) parts.push(r.location.region);
      if (r.location.country) parts.push(r.location.country);
      const key = parts.join(', ') || 'Unknown';
      locations[key] = (locations[key] || 0) + 1;
    }
  });

  const sorted = Object.entries(locations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  new Chart(document.getElementById('chart-locations'), {
    type: 'bar',
    data: {
      labels: sorted.map(([loc]) => loc),
      datasets: [{
        label: 'Rooms',
        data: sorted.map(([, count]) => count),
        backgroundColor: chartColors.purple,
        borderRadius: 3
      }]
    },
    options: {
      ...defaultChartOptions,
      indexAxis: 'y',
      plugins: {
        ...defaultChartOptions.plugins,
        legend: { display: false }
      },
      scales: {
        x: {
          ...defaultChartOptions.scales.x,
          beginAtZero: true,
          ticks: {
            ...defaultChartOptions.scales.x.ticks,
            stepSize: 1
          }
        },
        y: {
          ...defaultChartOptions.scales.y,
          ticks: {
            ...defaultChartOptions.scales.y.ticks,
            autoSkip: false
          }
        }
      }
    }
  });
}

function renderCompanyChart(completed) {
  const companies = {};
  completed.forEach(r => {
    if (r.company) {
      companies[r.company] = (companies[r.company] || 0) + 1;
    }
  });

  const sorted = Object.entries(companies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  new Chart(document.getElementById('chart-companies'), {
    type: 'bar',
    data: {
      labels: sorted.map(([name]) => name),
      datasets: [{
        label: 'Rooms',
        data: sorted.map(([, count]) => count),
        backgroundColor: chartColors.gold,
        borderRadius: 3
      }]
    },
    options: {
      ...defaultChartOptions,
      indexAxis: 'y',
      plugins: {
        ...defaultChartOptions.plugins,
        legend: { display: false }
      },
      scales: {
        x: {
          ...defaultChartOptions.scales.x,
          beginAtZero: true,
          ticks: {
            ...defaultChartOptions.scales.x.ticks,
            stepSize: 1
          }
        },
        y: {
          ...defaultChartOptions.scales.y,
          ticks: {
            ...defaultChartOptions.scales.y.ticks,
            autoSkip: false
          }
        }
      }
    }
  });
}

function renderEscapeTimesChart(completed) {
  const data = completed
    .filter(r => r.escapeTime)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      x: r.date,
      y: escapeTimeMinutes(r.escapeTime),
      label: `#${r.id} ${r.game}`
    }));

  new Chart(document.getElementById('chart-times'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Escape Time (min)',
        data: data,
        backgroundColor: chartColors.cyan,
        borderColor: chartColors.cyan,
        pointRadius: 6,
        pointHoverRadius: 9
      }]
    },
    options: {
      ...defaultChartOptions,
      scales: {
        x: {
          ...defaultChartOptions.scales.x,
          type: 'category',
          labels: data.map(d => d.x),
          ticks: {
            ...defaultChartOptions.scales.x.ticks,
            maxRotation: 45
          }
        },
        y: {
          ...defaultChartOptions.scales.y,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Minutes',
            color: chartColors.text
          }
        }
      },
      plugins: {
        ...defaultChartOptions.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = data[ctx.dataIndex];
              return `${point.label}: ${point.y.toFixed(1)} min`;
            }
          }
        },
        legend: { display: false }
      }
    }
  });
}

init();
