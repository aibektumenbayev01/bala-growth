import jsPDF from "jspdf";

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
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(date)
    .replace(/\//g, ".");
}

function prettyFlag(flag: string) {
  return flag
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status?: string | null) {
  if (status === "requires_attention") return "Requires attention";
  if (status === "below_expected_growth") return "Below expected growth";
  return "Normal growth";
}

function getAvatarPath(child: Child) {
  return child.gender === "male"
    ? "/avatars/boy-1.jpg"
    : "/avatars/girl-1.jpg";
}

async function imageToDataUrl(src: string) {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error(`Unable to load image: ${src}`);
  }

  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function GrowthReportButton({
  child,
  measurements,
  insights,
}: GrowthReportButtonProps) {
  async function generatePdf() {
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 11;
      const contentWidth = pageWidth - margin * 2;

      const NAVY: [number, number, number] = [14, 54, 92];
      const TEXT: [number, number, number] = [30, 41, 59];
      const MUTED: [number, number, number] = [91, 108, 132];
      const BORDER: [number, number, number] = [221, 229, 238];

      const TEAL: [number, number, number] = [10, 153, 164];
      const BLUE: [number, number, number] = [31, 132, 224];
      const PURPLE: [number, number, number] = [126, 87, 194];
      const RED: [number, number, number] = [224, 68, 77];
      const AMBER: [number, number, number] = [236, 157, 21];
      const GREEN: [number, number, number] = [28, 160, 103];

      const sortedMeasurements = [...measurements].sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const latestMeasurement = sortedMeasurements.at(-1);

      function roundedCard(
        x: number,
        y: number,
        width: number,
        height: number,
        fill: [number, number, number],
        border: [number, number, number] = BORDER,
        radius = 3
      ) {
        pdf.setFillColor(...fill);
        pdf.setDrawColor(...border);
        pdf.roundedRect(x, y, width, height, radius, radius, "FD");
      }

      function drawCircleIcon(
        cx: number,
        cy: number,
        radius: number,
        bg: [number, number, number],
        text: string,
        textColor: [number, number, number]
      ) {
        pdf.setFillColor(...bg);
        pdf.circle(cx, cy, radius, "F");

        pdf.setTextColor(...textColor);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(radius * 2.5);

        pdf.text(text, cx, cy + radius * 0.32, {
          align: "center",
        });
      }

      function metricCard(
        x: number,
        y: number,
        width: number,
        title: string,
        value: string,
        subtitle: string,
        accent: [number, number, number],
        iconText: string
      ) {
        const height = 31;

        roundedCard(x, y, width, height, [255, 255, 255]);

        const bg: [number, number, number] =
          accent === TEAL
            ? [232, 249, 250]
            : accent === BLUE
              ? [235, 245, 255]
              : accent === PURPLE
                ? [244, 239, 255]
                : [255, 238, 239];

        drawCircleIcon(
          x + 10,
          y + 15.5,
          6.2,
          bg,
          iconText,
          accent
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.4);
        pdf.setTextColor(...accent);
        pdf.text(title, x + 19, y + 8);

        pdf.setFontSize(13.2);
        pdf.setTextColor(...NAVY);
        pdf.text(value, x + 19, y + 18);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.4);
        pdf.setTextColor(...MUTED);
        pdf.text(subtitle, x + 19, y + 25.5);
      }

      // HEADER
      drawCircleIcon(
        margin + 8,
        16,
        8,
        [15, 169, 184],
        "G",
        [255, 255, 255]
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(21);
      pdf.setTextColor(...NAVY);
      pdf.text("Bala Growth Report", margin + 19, 14.8);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.2);
      pdf.setTextColor(...MUTED);
      pdf.text(
        "Pediatric growth monitoring summary",
        margin + 19,
        22
      );

      drawCircleIcon(
        pageWidth - margin - 31,
        15.5,
        5,
        [234, 249, 250],
        "D",
        TEAL
      );

      pdf.setFontSize(7);
      pdf.setTextColor(...MUTED);
      pdf.text("Report date", pageWidth - margin - 22, 13.4);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...NAVY);
      pdf.text(
        formatDate(new Date()),
        pageWidth - margin - 22,
        19.5
      );

      // CHILD PROFILE
      const childCardY = 31;
      roundedCard(
        margin,
        childCardY,
        contentWidth,
        31,
        [246, 251, 254],
        [232, 241, 247],
        4
      );

      let avatarAdded = false;

      try {
        const avatar = await imageToDataUrl(getAvatarPath(child));

        pdf.setFillColor(241, 248, 252);
        pdf.circle(margin + 14, childCardY + 15.5, 10.5, "F");

        pdf.addImage(
          avatar,
          "JPEG",
          margin + 5.8,
          childCardY + 7.3,
          16.4,
          16.4
        );

        pdf.setDrawColor(194, 222, 238);
        pdf.circle(margin + 14, childCardY + 15.5, 10.5, "S");

        avatarAdded = true;
      } catch {
        // Fallback below
      }

      if (!avatarAdded) {
        drawCircleIcon(
          margin + 14,
          childCardY + 15.5,
          10.5,
          [235, 247, 252],
          child.name.slice(0, 1).toUpperCase(),
          NAVY
        );
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13.8);
      pdf.setTextColor(...NAVY);
      pdf.text(child.name, margin + 29, childCardY + 10.5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.8);
      pdf.setTextColor(...TEXT);

      pdf.text(
        `Birth date: ${formatDate(child.birthDate)}`,
        margin + 29,
        childCardY + 19.2
      );

      pdf.text(
        `Gender: ${child.gender === "male" ? "Male" : "Female"}`,
        margin + 29,
        childCardY + 26
      );

      // KPI CARDS
      const metricsY = 68;
      const metricGap = 2.2;
      const metricWidth = (contentWidth - metricGap * 3) / 4;

      metricCard(
        margin,
        metricsY,
        metricWidth,
        "LATEST HEIGHT",
        latestMeasurement ? `${latestMeasurement.height} cm` : "-",
        latestMeasurement
          ? `Measured: ${formatDate(latestMeasurement.date)}`
          : "No measurements",
        TEAL,
        "H"
      );

      metricCard(
        margin + metricWidth + metricGap,
        metricsY,
        metricWidth,
        "LATEST WEIGHT",
        latestMeasurement ? `${latestMeasurement.weight} kg` : "-",
        latestMeasurement
          ? `Measured: ${formatDate(latestMeasurement.date)}`
          : "No measurements",
        BLUE,
        "W"
      );

      metricCard(
        margin + (metricWidth + metricGap) * 2,
        metricsY,
        metricWidth,
        "WHO PERCENTILE",
        insights?.latestPercentileBand ?? "-",
        "Height-for-age",
        PURPLE,
        "P"
      );

      metricCard(
        margin + (metricWidth + metricGap) * 3,
        metricsY,
        metricWidth,
        "Z-SCORE",
        insights?.latestZScore !== null &&
          insights?.latestZScore !== undefined
          ? insights.latestZScore.toFixed(2)
          : "-",
        "Height-for-age",
        RED,
        "Z"
      );

      // GROWTH ASSESSMENT
      const assessmentY = 105;
      const assessmentHeight = 42;

      const assessmentAccent =
        insights?.status === "requires_attention"
          ? RED
          : insights?.status === "below_expected_growth"
            ? AMBER
            : GREEN;

      const assessmentFill: [number, number, number] =
        insights?.status === "requires_attention"
          ? [255, 246, 246]
          : insights?.status === "below_expected_growth"
            ? [255, 250, 239]
            : [243, 252, 248];

      roundedCard(
        margin,
        assessmentY,
        contentWidth,
        assessmentHeight,
        assessmentFill,
        [239, 217, 174],
        4
      );

      drawCircleIcon(
        margin + 12,
        assessmentY + 13,
        7.7,
        assessmentAccent,
        "*",
        [255, 255, 255]
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.6);
      pdf.setTextColor(...NAVY);
      pdf.text(
        "Growth Assessment",
        margin + 26,
        assessmentY + 10.2
      );

      pdf.setFontSize(7.6);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...TEXT);

      pdf.text(
        `WHO percentile: ${insights?.latestPercentileBand ?? "-"}`,
        margin + 26,
        assessmentY + 19
      );

      pdf.text(
        `Z-score: ${
          insights?.latestZScore !== null &&
          insights?.latestZScore !== undefined
            ? insights.latestZScore.toFixed(2)
            : "-"
        }`,
        margin + 73,
        assessmentY + 19
      );

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...assessmentAccent);
      pdf.text(
        `Status: ${statusLabel(insights?.status)}`,
        margin + 111,
        assessmentY + 19
      );

      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...TEXT);
      pdf.setFontSize(7.2);

      const assessmentSummary =
        insights?.summary ??
        "Growth assessment is not available yet. Add more measurements to enable growth analytics.";

      const summaryLines = pdf.splitTextToSize(
        assessmentSummary,
        contentWidth - 17
      );

      pdf.text(
        summaryLines.slice(0, 3),
        margin + 8,
        assessmentY + 29
      );

      // HISTORY + CHART
      const lowerY = 154;
      const historyWidth = 62;
      const chartX = margin + historyWidth + 7;
      const chartWidth = contentWidth - historyWidth - 7;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...TEAL);
      pdf.text("Measurement History", margin, lowerY);

      pdf.setTextColor(...NAVY);
      pdf.text("WHO Height-for-age Chart", chartX, lowerY);

      const tableY = lowerY + 5;
      const tableHeight = 55;

      roundedCard(
        margin,
        tableY,
        historyWidth,
        tableHeight,
        [255, 255, 255]
      );

      pdf.setFillColor(239, 250, 251);
      pdf.roundedRect(
        margin,
        tableY,
        historyWidth,
        10,
        3,
        3,
        "F"
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.2);
      pdf.setTextColor(...TEAL);

      pdf.text("DATE", margin + 3, tableY + 6.5);
      pdf.text("HEIGHT", margin + 25, tableY + 6.5);
      pdf.text("WEIGHT", margin + 45, tableY + 6.5);

      const visibleMeasurements = sortedMeasurements.slice(-5);
      let rowY = tableY + 17;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);
      pdf.setTextColor(...TEXT);

      for (const measurement of visibleMeasurements) {
        pdf.text(formatDate(measurement.date), margin + 3, rowY);
        pdf.text(`${measurement.height}`, margin + 27, rowY);
        pdf.text(`${measurement.weight}`, margin + 47, rowY);

        pdf.setDrawColor(...BORDER);
        pdf.line(
          margin + 2,
          rowY + 3.3,
          margin + historyWidth - 2,
          rowY + 3.3
        );

        rowY += 8;
      }

      if (sortedMeasurements.length > 5) {
        pdf.setFontSize(5.8);
        pdf.setTextColor(...MUTED);
        pdf.text(
          `Showing latest 5 of ${sortedMeasurements.length} measurements`,
          margin + 3,
          tableY + tableHeight - 3
        );
      }

      const chartElement =
        document.getElementById("who-growth-chart");

      if (chartElement) {
        const svgElement = chartElement.querySelector("svg");

        if (svgElement) {
          const serializer = new XMLSerializer();
          const svgString = serializer.serializeToString(svgElement);

          const svgBlob = new Blob([svgString], {
            type: "image/svg+xml;charset=utf-8",
          });

          const url = URL.createObjectURL(svgBlob);

          try {
            const image = new Image();

            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () =>
                reject(new Error("Failed to render WHO chart"));
              image.src = url;
            });

            const canvas = document.createElement("canvas");

            const svgWidth = svgElement.clientWidth || 800;
            const svgHeight = svgElement.clientHeight || 320;

            canvas.width = svgWidth * 2;
            canvas.height = svgHeight * 2;

            const context = canvas.getContext("2d");

            if (!context) {
              throw new Error("Canvas is not available");
            }

            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);

            context.drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );

            const chartImage = canvas.toDataURL("image/png");

            const maxChartHeight = 52;
            let chartHeight =
              (canvas.height * chartWidth) / canvas.width;

            if (chartHeight > maxChartHeight) {
              chartHeight = maxChartHeight;
            }

            pdf.addImage(
              chartImage,
              "PNG",
              chartX,
              tableY + 1,
              chartWidth,
              chartHeight
            );
          } finally {
            URL.revokeObjectURL(url);
          }
        }
      } else {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(...MUTED);
        pdf.text(
          "Open the child's growth chart before generating the report.",
          chartX,
          tableY + 12
        );
      }

      // WARNING SIGNALS
      const warningY = 219;

      if (insights && insights.anomalies.length > 0) {
        const warning = insights.anomalies[0];

        roundedCard(
          margin,
          warningY,
          contentWidth,
          28,
          [255, 246, 246],
          [249, 204, 207],
          4
        );

        drawCircleIcon(
          margin + 10,
          warningY + 14,
          6.8,
          [244, 80, 88],
          "!",
          [255, 255, 255]
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.4);
        pdf.setTextColor(190, 31, 38);
        pdf.text("Warning Signals", margin + 23, warningY + 10);

        pdf.setFontSize(7.5);
        pdf.text(
          prettyFlag(warning.flag),
          margin + 64,
          warningY + 10
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.8);
        pdf.setTextColor(...TEXT);

        const warningLines = pdf.splitTextToSize(
          warning.explanation,
          contentWidth - 31
        );

        pdf.text(
          warningLines.slice(0, 2),
          margin + 23,
          warningY + 18
        );

        if (insights.anomalies.length > 1) {
          pdf.setFontSize(5.8);
          pdf.setTextColor(...MUTED);
          pdf.text(
            `+${insights.anomalies.length - 1} additional warning signal${
              insights.anomalies.length - 1 === 1 ? "" : "s"
            }`,
            pageWidth - margin - 4,
            warningY + 24,
            { align: "right" }
          );
        }
      } else {
        roundedCard(
          margin,
          warningY,
          contentWidth,
          28,
          [244, 252, 248],
          [203, 237, 219],
          4
        );

        drawCircleIcon(
          margin + 10,
          warningY + 14,
          6.8,
          [33, 168, 111],
          "OK",
          [255, 255, 255]
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.4);
        pdf.setTextColor(...GREEN);
        pdf.text("No Warning Signals", margin + 23, warningY + 10);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.8);
        pdf.setTextColor(...TEXT);
        pdf.text(
          "No growth warning signals are currently detected from the available measurements.",
          margin + 23,
          warningY + 18
        );
      }

      // DISCLAIMER
      const disclaimerY = 253;

      roundedCard(
        margin,
        disclaimerY,
        contentWidth,
        16,
        [245, 249, 255],
        [207, 225, 246],
        3
      );

      drawCircleIcon(
        margin + 6,
        disclaimerY + 8,
        3.1,
        [36, 126, 210],
        "i",
        [255, 255, 255]
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.3);
      pdf.setTextColor(...TEXT);

      const disclaimerText =
        insights?.disclaimer ??
        "For educational/demo purposes only. This report is not a medical diagnosis and does not replace professional evaluation.";

      const disclaimerLines = pdf.splitTextToSize(
        disclaimerText,
        contentWidth - 17
      );

      pdf.text(
        disclaimerLines.slice(0, 2),
        margin + 12,
        disclaimerY + 6.5
      );

      // FOOTER
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(...MUTED);

      pdf.text("Bala Growth", margin, pageHeight - 7);

      pdf.text(
        "Page 1 of 1",
        pageWidth - margin,
        pageHeight - 7,
        { align: "right" }
      );

      pdf.setDrawColor(...BORDER);
      pdf.line(
        pageWidth / 2,
        pageHeight - 10,
        pageWidth / 2,
        pageHeight - 6
      );

      // SAVE
      const safeName = child.name
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9-_]/g, "")
        .toLowerCase();

      pdf.save(`${safeName || "child"}-growth-report.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);

      alert(
        error instanceof Error
          ? `PDF generation failed: ${error.message}`
          : "PDF generation failed"
      );
    }
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
