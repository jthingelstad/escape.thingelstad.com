import {
  getRooms, escapeTimeMinutes, initNav
} from './data.js';

const chartColors = {
  gold: '#e6b84f',
  teal: '#4fd1c5',
  green: '#48d989',
  red: '#f06060',
  purple: '#a78bfa',
  blue: '#60a5fa',
  cyan: '#22d3ee',
  gray: '#9a97a8',
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
        font: { family: 'Space Grotesk' }
      }
    }
  },
  scales: {
    x: {
      ticks: { color: chartColors.text, font: { family: 'Space Grotesk' } },
      grid: { color: chartColors.grid }
    },
    y: {
      ticks: { color: chartColors.text, font: { family: 'Space Grotesk' } },
      grid: { color: chartColors.grid }
    }
  }
};

async function init() {
  initNav();
  await loadCharts();
}

async function loadCharts() {
  const allRooms = await getRooms();
  const played = allRooms.filter(r => r.status !== 'Scheduled');

  renderRoomsPerYear(allRooms);
  renderMonthlyDistribution(played);
  renderStateChart(played);
  renderCountryChart(played);
  renderCompanyChart(played);
  renderEscapeTimesChart(played);
}

function renderRoomsPerYear(allRooms) {
  const yearData = {};
  allRooms.forEach(r => {
    const year = r.date.substring(0, 4);
    if (!yearData[year]) yearData[year] = { escaped: 0, tryAgain: 0, completed: 0, scheduled: 0 };
    switch (r.status) {
      case 'Escaped': yearData[year].escaped++; break;
      case 'Try again': yearData[year].tryAgain++; break;
      case 'Completed': yearData[year].completed++; break;
      case 'Scheduled': yearData[year].scheduled++; break;
    }
  });

  const sortedYears = Object.keys(yearData).sort();

  new Chart(document.getElementById('chart-rooms-year'), {
    type: 'bar',
    data: {
      labels: sortedYears,
      datasets: [
        {
          label: 'Escaped',
          data: sortedYears.map(y => yearData[y].escaped),
          backgroundColor: chartColors.green,
          borderRadius: 3
        },
        {
          label: 'Try Again',
          data: sortedYears.map(y => yearData[y].tryAgain),
          backgroundColor: chartColors.red,
          borderRadius: 3
        },
        {
          label: 'Completed',
          data: sortedYears.map(y => yearData[y].completed),
          backgroundColor: chartColors.gray,
          borderRadius: 3
        },
        {
          label: 'Scheduled',
          data: sortedYears.map(y => yearData[y].scheduled),
          backgroundColor: chartColors.blue,
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

function renderMonthlyDistribution(played) {
  const months = Array(12).fill(0);
  played.forEach(r => {
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

function renderStateChart(played) {
  const states = {};
  played.forEach(r => {
    if (r.location && r.location.country === 'United States' && r.location.region) {
      states[r.location.region] = (states[r.location.region] || 0) + 1;
    }
  });

  const sorted = Object.entries(states)
    .sort((a, b) => b[1] - a[1]);

  new Chart(document.getElementById('chart-states'), {
    type: 'bar',
    data: {
      labels: sorted.map(([state]) => state),
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

function renderCountryChart(played) {
  const countries = {};
  played.forEach(r => {
    if (r.location && r.location.country) {
      countries[r.location.country] = (countries[r.location.country] || 0) + 1;
    }
  });

  const sorted = Object.entries(countries)
    .sort((a, b) => b[1] - a[1]);

  new Chart(document.getElementById('chart-countries'), {
    type: 'bar',
    data: {
      labels: sorted.map(([country]) => country),
      datasets: [{
        label: 'Rooms',
        data: sorted.map(([, count]) => count),
        backgroundColor: chartColors.teal,
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

function renderCompanyChart(played) {
  const companies = {};
  played.forEach(r => {
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

function renderEscapeTimesChart(played) {
  const data = played
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
