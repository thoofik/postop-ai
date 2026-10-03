import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatChartDate } from "./format";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

export type ChartPoint = {
  id: string;
  created_at: string;
  probability: number;
  risk_level: string;
};

function pointColor(level: string): string {
  if (level === "HIGH") return "#c62828";
  if (level === "MODERATE") return "#d97706";
  return "#2e7d46";
}

export function RiskChart({
  points,
  tall,
  onPoint,
}: {
  points: ChartPoint[];
  tall?: boolean;
  onPoint?: (id: string) => void;
}) {
  return (
    <div className={tall ? "chart-box tall" : "chart-box"}>
      <Line
        data={{
          labels: points.map((point) => formatChartDate(point.created_at)),
          datasets: [
            {
              label: "Risk probability",
              data: points.map((point) => Number((point.probability * 100).toFixed(1))),
              borderColor: "#2563eb",
              backgroundColor: "rgba(37, 99, 235, 0.12)",
              fill: true,
              tension: 0.35,
              pointBackgroundColor: points.map((point) => pointColor(point.risk_level)),
              pointBorderColor: "#ffffff",
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          onClick: (_event, elements) => {
            const hit = elements[0];
            if (hit && onPoint) onPoint(points[hit.index].id);
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => {
                  const point = points[item.dataIndex];
                  return `${point.risk_level} · ${item.parsed.y}%`;
                },
              },
            },
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              ticks: { color: "#a3a3a3", callback: (value) => `${value}%` },
              grid: { color: "#262626" },
            },
            x: { ticks: { color: "#a3a3a3" }, grid: { display: false } },
          },
        }}
      />
    </div>
  );
}
