// ---------- Theme-aware chart defaults ----------
Chart.defaults.font.family = `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial`;
Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#e5e7eb";

Chart.defaults.plugins.legend.labels.boxWidth = 14;
Chart.defaults.plugins.legend.labels.boxHeight = 14;
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(0,0,0,0.75)";
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.titleFont = {weight: "600"};

Chart.defaults.elements.bar.borderRadius = 8;
Chart.defaults.elements.bar.borderSkipped = false;

// Helper: get CSS variable
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------- Expenses by Category (Pie / Doughnut) ----------
const catCtx = document.getElementById("catChart").getContext("2d");
const catChart = new Chart(catCtx, {
  type: "doughnut",
  data: {
    labels: ["Food", "Rent", "Transport", "Utilities", "Fun"],
    datasets: [
      {
        data: [500, 1200, 300, 150, 200],
        backgroundColor: [
          cssVar("--accent"),
          cssVar("--accent-2"),
          "#f59e0b",
          "#a78bfa",
          "#f472b6",
        ],
        borderWidth: 0,
      },
    ],
  },
  options: {
    responsive: true,
    cutout: "60%",
    plugins: {
      legend: { position: "bottom" },
    },
  },
});

// ---------- Monthly Cash Flow (Bar Chart) ----------
const flowCtx = document.getElementById("flowChart").getContext("2d");
const flowChart = new Chart(flowCtx, {
  type: "bar",
  data: {
    labels: [
      "Sep", "Oct", "Nov", "Dec", "Jan", "Feb",
      "Mar", "Apr", "May", "Jun", "Jul", "Aug",
    ],
    datasets: [
      {
        label: "Income",
        data: [2000, 2200, 2100, 2300, 2500, 2400, 2600, 2550, 2700, 2800, 2900, 3000],
        backgroundColor: cssVar("--accent"),
      },
      {
        label: "Expenses",
        data: [1800, 1900, 2000, 1950, 2100, 2050, 2150, 2200, 2250, 2300, 2400, 2450],
        backgroundColor: cssVar("--accent-2"),
      },
    ],
  },
  options: {
    responsive: true,
    scales: {
      y: {
        grid: { color: "rgba(150,150,150,0.1)" },
        beginAtZero: true,
      },
      x: {
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        position: "top",
        labels: { font: { weight: "600" } },
      },
    },
  },
});
