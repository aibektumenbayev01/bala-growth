import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import type {
  Child,
  ChildGrowthInsights,
  Measurement,
} from "@bala/shared";

type GrowthReportButtonProps = {
  child: Child;
  measurements: Measurement[];
  insights: ChildGrowthInsights | null;
};

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString();
}

export default function GrowthReportButton({
  child,
  measurements,
  insights,
}: GrowthReportButtonProps) {
async function generatePdf() {
  const pdf = new jsPDF();

  const pageWidth = pdf.internal.pageSize.getWidth();

  let y = 20;

  // Header
  pdf.setFillColor(8, 145, 178);
  pdf.roundedRect(15, 12, pageWidth - 30, 28, 4, 4, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.text("Bala Growth Report", 20, 25);

  pdf.setFontSize(10);
  pdf.text("Pediatric growth monitoring summary", 20, 33);

  y = 52;

  // Child information
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(15);
  pdf.text(child.name, 20, y);

  y += 8;

  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);

  pdf.text(
    `Birth date: ${formatDate(child.birthDate)}`,
    20,
    y
  );

  y += 6;

  pdf.text(
    `Gender: ${child.gender === "male" ? "Male" : "Female"}`,
    20,
    y
  );

  y += 15;

  // Assessment section
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(14);
  pdf.text("Growth Assessment", 20, y);

  y += 8;

  if (insights) {
    const requiresAttention =
      insights.status === "requires_attention";

    const belowExpected =
      insights.status === "below_expected_growth";

    if (requiresAttention) {
      pdf.setFillColor(254, 226, 226);
    } else if (belowExpected) {
      pdf.setFillColor(254, 243, 199);
    } else {
      pdf.setFillColor(209, 250, 229);
    }

    pdf.roundedRect(
      20,
      y,
      pageWidth - 40,
      32,
      4,
      4,
      "F"
    );

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(10);

    pdf.text(
      `WHO percentile: ${insights.latestPercentileBand}`,
      26,
      y + 9
    );

    pdf.text(
      `Z-score: ${
        insights.latestZScore !== null
          ? insights.latestZScore.toFixed(2)
          : "-"
      }`,
      26,
      y + 17
    );

    pdf.text(
      `Status: ${
        requiresAttention
          ? "Requires attention"
          : belowExpected
            ? "Below expected growth"
            : "Normal trend"
      }`,
      26,
      y + 25
    );

    y += 40;

    const summaryLines = pdf.splitTextToSize(
      insights.summary,
      pageWidth - 40
    );

    pdf.setTextColor(71, 85, 105);
    pdf.text(summaryLines, 20, y);

    y += summaryLines.length * 5 + 12;
  }

  // Measurement history
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(14);
  pdf.text("Measurement History", 20, y);

  y += 8;

  const sortedMeasurements = [...measurements].sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );

  // Table header
  pdf.setFillColor(241, 245, 249);
  pdf.rect(20, y, pageWidth - 40, 9, "F");

  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);

  pdf.text("Date", 24, y + 6);
  pdf.text("Height", 90, y + 6);
  pdf.text("Weight", 140, y + 6);

  y += 12;

  sortedMeasurements.forEach((measurement) => {
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }

    pdf.setTextColor(15, 23, 42);

    pdf.text(
      formatDate(measurement.date),
      24,
      y
    );

    pdf.text(
      `${measurement.height} cm`,
      90,
      y
    );

    pdf.text(
      `${measurement.weight} kg`,
      140,
      y
    );

    pdf.setDrawColor(226, 232, 240);
    pdf.line(20, y + 3, pageWidth - 20, y + 3);

    y += 9;
  });

  y += 10;

  // WHO Growth Chart
const chartElement = document.getElementById("who-growth-chart");

if (chartElement) {
  if (y > 170) {
    pdf.addPage();
    y = 20;
  }

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(14);
  pdf.text("WHO Height-for-age Chart", 20, y);

  y += 8;

  const canvas = await html2canvas(chartElement, {
    scale: 2,
    backgroundColor: "#f8fafc",
  });

  const chartImage = canvas.toDataURL("image/png");

  const imageWidth = pageWidth - 40;
  const imageHeight =
    (canvas.height * imageWidth) / canvas.width;

  pdf.addImage(
    chartImage,
    "PNG",
    20,
    y,
    imageWidth,
    imageHeight
  );

  y += imageHeight + 12;
}

  // Prediction
  if (insights?.predictionMessage) {
    if (y > 245) {
      pdf.addPage();
      y = 20;
    }

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(14);
    pdf.text("Prediction", 20, y);

    y += 8;

    const predictionLines = pdf.splitTextToSize(
      insights.predictionMessage,
      pageWidth - 40
    );

    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(predictionLines, 20, y);

    y += predictionLines.length * 5 + 12;
  }

  // Warning signals
  if (insights && insights.anomalies.length > 0) {
    if (y > 230) {
      pdf.addPage();
      y = 20;
    }

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(14);
    pdf.text("Warning Signals", 20, y);

    y += 8;

    pdf.setFontSize(10);

    insights.anomalies.forEach((anomaly) => {
      pdf.setTextColor(220, 38, 38);

      pdf.text(
        `• ${anomaly.flag}`,
        24,
        y
      );

      y += 6;

      const explanationLines =
        pdf.splitTextToSize(
          anomaly.explanation,
          pageWidth - 50
        );

      pdf.setTextColor(71, 85, 105);
      pdf.text(explanationLines, 28, y);

      y += explanationLines.length * 5 + 5;
    });
  }

  // Disclaimer
  if (insights?.disclaimer) {
    if (y > 260) {
      pdf.addPage();
      y = 20;
    }

    y += 8;

    pdf.setDrawColor(226, 232, 240);
    pdf.line(20, y, pageWidth - 20, y);

    y += 7;

    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);

    const disclaimerLines = pdf.splitTextToSize(
      insights.disclaimer,
      pageWidth - 40
    );

    pdf.text(disclaimerLines, 20, y);
  }

  pdf.save(
    `${child.name
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()}-growth-report.pdf`
  );
}

  return (
    <button
      type="button"
      onClick={generatePdf}
      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
    >
      Download Growth Report
    </button>
  );
}