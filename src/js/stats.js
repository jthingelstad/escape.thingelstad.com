import { initNav } from './data.js';

const chartColors = {
  gold: '#e8924f',
  teal: '#43e6d0',
  green: '#48d989',
  red: '#f06060',
  purple: '#9b7bff',
  blue: '#5a8bff',
  cyan: '#2de2ff',
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

function init() {
  initNav();
  const data = JSON.parse(document.getElementById('chart-data').textContent);
  renderRoomsPerYear(data.roomsPerYear);
  renderMonthlyDistribution(data.monthly);
  renderStateChart(data.states);
  renderCountryChart(data.countries);
  renderCompanyChart(data.companies);
  renderTimeLeftChart(data.timeLeft);
}

function renderRoomsPerYear(data) {
  new Chart(document.getElementById('chart-rooms-year'), {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Escaped',
          data: data.escaped,
          backgroundColor: chartColors.green,
          borderRadius: 3
        },
        {
          label: 'Try Again',
          data: data.tryAgain,
          backgroundColor: chartColors.red,
          borderRadius: 3
        },
        {
          label: 'Completed',
          data: data.completed,
          backgroundColor: chartColors.gray,
          borderRadius: 3
        },
        {
          label: 'Scheduled',
          data: data.scheduled,
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

function renderMonthlyDistribution(months) {
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

function renderStateChart(data) {
  new Chart(document.getElementById('chart-states'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Rooms',
        data: data.map(d => d.count),
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

function renderCountryChart(data) {
  new Chart(document.getElementById('chart-countries'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Rooms',
        data: data.map(d => d.count),
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

function renderCompanyChart(data) {
  new Chart(document.getElementById('chart-companies'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Rooms',
        data: data.map(d => d.count),
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

function createStripedPattern(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 10;
  canvas.height = 10;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 10, 10);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(10, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(2, -2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 12);
  ctx.lineTo(12, 8);
  ctx.stroke();
  return ctx.createPattern(canvas, 'repeat');
}

function renderTimeLeftChart(data) {
  const chartCanvas = document.getElementById('chart-times');
  const chartCtx = chartCanvas.getContext('2d');
  const stripedRed = createStripedPattern(chartColors.red);

  new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.x),
      datasets: [{
        label: 'Time Left (min)',
        data: data.map(d => d.y),
        backgroundColor: data.map(d => {
          if (d.clamped) return stripedRed;
          return d.y >= 0 ? chartColors.teal : chartColors.red;
        }),
        borderRadius: 3
      }]
    },
    options: {
      ...defaultChartOptions,
      onHover: (event, elements) => {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      onClick: (event, elements) => {
        if (elements.length) {
          const point = data[elements[0].index];
          window.location.href = `/room/${point.slug}/`;
        }
      },
      scales: {
        x: {
          ...defaultChartOptions.scales.x,
          ticks: {
            ...defaultChartOptions.scales.x.ticks,
            maxRotation: 45
          }
        },
        y: {
          ...defaultChartOptions.scales.y,
          title: {
            display: true,
            text: 'Minutes Left',
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
              const abs = Math.abs(point.raw).toFixed(1);
              return point.raw >= 0
                ? `${point.label}: ${abs} min left`
                : `${point.label}: ${abs} min over`;
            }
          }
        },
        legend: { display: false }
      }
    }
  });
}

init();
