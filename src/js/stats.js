import { initNav } from './data.js';

const chartColors = {
  gold: '#FFB703',
  teal: '#5AA9FF',
  green: '#4CAF50',
  red: '#EF4444',
  purple: '#A78BFA',
  blue: '#5AA9FF',
  cyan: '#5AA9FF',
  gray: '#6B7280',
  text: '#AAB3C2',
  grid: 'rgba(170, 179, 194, 0.08)'
};

const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: chartColors.text,
        font: { family: 'Inter, system-ui, sans-serif' }
      }
    }
  },
  scales: {
    x: {
      ticks: { color: chartColors.text, font: { family: 'Inter, system-ui, sans-serif' } },
      grid: { color: chartColors.grid }
    },
    y: {
      ticks: { color: chartColors.text, font: { family: 'Inter, system-ui, sans-serif' } },
      grid: { color: chartColors.grid }
    }
  }
};

function horizontalBarOptions() {
  return {
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
  };
}

function init() {
  initNav();
  const data = JSON.parse(document.getElementById('chart-data').textContent);
  renderCumulativeStreak(data.cumulativeStreak);
  renderRoomsPerYear(data.roomsPerYear);
  renderMonthlyDistribution(data.monthly);
  renderStateChart(data.states);
  renderCountryChart(data.countries);
  renderPlayerChart(data.players);
  renderThemeChart(data.themes);
  renderAwardChart(data.awards);
  renderRatingDistribution(data.ratingDistribution);
  renderTimeLeftChart(data.timeLeft);
  renderStateChoropleth(data.states);
  renderChoropleth(data.countries);
}

function renderCumulativeStreak(data) {
  new Chart(document.getElementById('chart-cumulative'), {
    type: 'line',
    data: {
      datasets: [{
        label: 'Cumulative Rooms',
        data: data.map((entry) => ({ x: entry.x, y: entry.y })),
        pointRadius: data.map((entry) => entry.y % 25 === 0 ? 5 : 0),
        pointBackgroundColor: chartColors.gold,
        pointBorderColor: chartColors.gold,
        pointHitRadius: 6,
        borderWidth: 6,
        fill: false,
        segment: {
          borderColor: (ctx) => {
            const point = data[ctx.p1DataIndex];
            return point && point.win ? chartColors.green : chartColors.red;
          }
        }
      }]
    },
    options: {
      ...defaultChartOptions,
      plugins: {
        ...defaultChartOptions.plugins,
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = data[ctx.dataIndex];
              const status = point.win ? 'Win' : 'Loss';
              const streak = point.streak > 0 ? ` (streak: ${point.streak})` : '';
              return `Room ${point.y} — ${status}${streak}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'year' },
          ticks: { color: chartColors.text, font: { family: 'Inter, system-ui, sans-serif' } },
          grid: { color: chartColors.grid }
        },
        y: {
          ...defaultChartOptions.scales.y,
          beginAtZero: true
        }
      }
    }
  });
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
      plugins: {
        ...defaultChartOptions.plugins,
        legend: { display: false }
      },
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
      labels: data.map((entry) => entry.label),
      datasets: [{
        label: 'Rooms',
        data: data.map((entry) => entry.count),
        backgroundColor: chartColors.purple,
        borderRadius: 3
      }]
    },
    options: horizontalBarOptions()
  });
}

function renderCountryChart(data) {
  new Chart(document.getElementById('chart-countries'), {
    type: 'bar',
    data: {
      labels: data.map((entry) => entry.label),
      datasets: [{
        label: 'Rooms',
        data: data.map((entry) => entry.count),
        backgroundColor: chartColors.teal,
        borderRadius: 3
      }]
    },
    options: horizontalBarOptions()
  });
}

function renderPlayerChart(data) {
  new Chart(document.getElementById('chart-players'), {
    type: 'bar',
    data: {
      labels: data.map((entry) => entry.label),
      datasets: [{
        label: 'Rooms',
        data: data.map((entry) => entry.count),
        backgroundColor: chartColors.gold,
        borderRadius: 3
      }]
    },
    options: horizontalBarOptions()
  });
}

function renderThemeChart(data) {
  new Chart(document.getElementById('chart-themes'), {
    type: 'bar',
    data: {
      labels: data.map((entry) => entry.label),
      datasets: [{
        label: 'Rooms',
        data: data.map((entry) => entry.count),
        backgroundColor: chartColors.green,
        borderRadius: 3
      }]
    },
    options: horizontalBarOptions()
  });
}

function renderAwardChart(data) {
  new Chart(document.getElementById('chart-awards'), {
    type: 'bar',
    data: {
      labels: data.map((entry) => entry.label),
      datasets: [{
        label: 'Rooms',
        data: data.map((entry) => entry.count),
        backgroundColor: chartColors.gold,
        borderRadius: 3
      }]
    },
    options: horizontalBarOptions()
  });
}

async function renderChoroplethMap({ counts, nameMap, topoUrl, objectKey, canvasId, projection, color }) {
  const lookup = {};
  counts.forEach(({ label, count }) => {
    lookup[nameMap?.[label] || label] = count;
  });

  const res = await fetch(topoUrl);
  const topology = await res.json();
  const features = topojson.feature(topology, topology.objects[objectKey]).features;

  new Chart(document.getElementById(canvasId), {
    type: 'choropleth',
    data: {
      labels: features.map((d) => d.properties.name),
      datasets: [{
        label: 'Rooms',
        data: features.map((d) => ({
          feature: d,
          value: lookup[d.properties.name] || 0
        }))
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      showOutline: true,
      showGraticule: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const name = ctx.raw.feature?.properties?.name || ctx.label;
              const value = ctx.raw.value;
              return value > 0 ? `${name}: ${value} room${value === 1 ? '' : 's'}` : name;
            }
          }
        }
      },
      scales: {
        projection: {
          axis: 'x',
          projection
        },
        color: {
          axis: 'x',
          interpolate: (value) => {
            if (value === 0) return 'rgba(170, 179, 194, 0.08)';
            const alpha = 0.3 + value * 0.7;
            return `rgba(${color}, ${alpha})`;
          },
          legend: {
            display: false
          }
        }
      }
    }
  });
}

function renderStateChoropleth(stateCounts) {
  return renderChoroplethMap({
    counts: stateCounts,
    topoUrl: 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json',
    objectKey: 'states',
    canvasId: 'chart-state-choropleth',
    projection: 'albersUsa',
    color: '90, 169, 255'
  });
}

function renderChoropleth(countryCounts) {
  return renderChoroplethMap({
    counts: countryCounts,
    nameMap: { 'United States': 'United States of America' },
    topoUrl: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
    objectKey: 'countries',
    canvasId: 'chart-choropleth',
    projection: 'equalEarth',
    color: '255, 183, 3'
  });
}

function renderRatingDistribution(data) {
  new Chart(document.getElementById('chart-ratings'), {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Rooms',
        data: data.counts,
        backgroundColor: chartColors.purple,
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
        x: {
          ...defaultChartOptions.scales.x,
          title: {
            display: true,
            text: 'Rating',
            color: chartColors.text
          }
        },
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
  const stripedRed = createStripedPattern(chartColors.red);

  new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: data.map((entry) => entry.x),
      datasets: [{
        label: 'Time Left (min)',
        data: data.map((entry) => entry.y),
        backgroundColor: data.map((entry) => {
          if (entry.clamped) return stripedRed;
          return entry.y >= 0 ? chartColors.teal : chartColors.red;
        }),
        borderRadius: 3
      }]
    },
    options: {
      ...defaultChartOptions,
      plugins: {
        ...defaultChartOptions.plugins,
        legend: { display: false }
      },
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
          suggestedMin: -10
        }
      }
    }
  });
}

init();
