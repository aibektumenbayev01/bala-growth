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
  return new Date(value).toLocaleDateString();
}

export default function GrowthReportButton({
  child,
  measurements,
  insights,
}: GrowthReportButtonProps) {
  async function generatePdf() {
    try {
      const pdf = new jsPDF();

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 20;
      const contentWidth = pageWidth - margin * 2;

      let y = 20;

      // =========================================================
      // HELPERS
      // =========================================================

      function addPage() {
        pdf.addPage();
        y = 20;
      }

      function ensureSpace(requiredHeight: number) {
        if (y + requiredHeight > pageHeight - 22) {
          addPage();
        }
      }

      function drawSectionTitle(title: string) {
        ensureSpace(15);

        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");

        pdf.text(title, margin, y);

        pdf.setFont("helvetica", "normal");

        y += 9;
      }

      // =========================================================
      // DATA
      // =========================================================

      const sortedMeasurements = [...measurements].sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      );

      const latestMeasurement =
        sortedMeasurements.at(-1);

      // =========================================================
      // HEADER
      // =========================================================

      pdf.setFillColor(8, 145, 178);

      pdf.roundedRect(
        15,
        12,
        pageWidth - 30,
        30,
        5,
        5,
        "F"
      );

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);

      pdf.text(
        "Bala Growth Report",
        margin,
        26
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      pdf.text(
        "Pediatric growth monitoring summary",
        margin,
        34
      );

      y = 52;

      // =========================================================
      // CHILD CARD
      // =========================================================

      pdf.setFillColor(248, 250, 252);

      pdf.roundedRect(
        margin,
        y,
        contentWidth,
        30,
        4,
        4,
        "F"
      );

      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);

      pdf.text(
        child.name,
        margin + 6,
        y + 10
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);

      pdf.text(
        `Birth date: ${formatDate(child.birthDate)}`,
        margin + 6,
        y + 20
      );

      pdf.text(
        `Gender: ${
          child.gender === "male"
            ? "Male"
            : "Female"
        }`,
        margin + 70,
        y + 20
      );

      pdf.text(
        `Report date: ${new Date().toLocaleDateString()}`,
        margin + 120,
        y + 20
      );

      y += 40;

      // =========================================================
      // KPI CARDS
      // =========================================================

      const cardGap = 3;
      const cardWidth =
        (contentWidth - cardGap * 3) / 4;

      const cardHeight = 25;

      function drawMetricCard(
        index: number,
        label: string,
        value: string
      ) {
        const x =
          margin +
          index * (cardWidth + cardGap);

        pdf.setFillColor(248, 250, 252);

        pdf.roundedRect(
          x,
          y,
          cardWidth,
          cardHeight,
          3,
          3,
          "F"
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 116, 139);

        pdf.text(
          label,
          x + 4,
          y + 7
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);

        pdf.text(
          value,
          x + 4,
          y + 18
        );
      }

      drawMetricCard(
        0,
        "LATEST HEIGHT",
        latestMeasurement
          ? `${latestMeasurement.height} cm`
          : "-"
      );

      drawMetricCard(
        1,
        "LATEST WEIGHT",
        latestMeasurement
          ? `${latestMeasurement.weight} kg`
          : "-"
      );

      drawMetricCard(
        2,
        "WHO PERCENTILE",
        insights?.latestPercentileBand ?? "-"
      );

      drawMetricCard(
        3,
        "Z-SCORE",
        insights?.latestZScore !== null &&
          insights?.latestZScore !== undefined
          ? insights.latestZScore.toFixed(2)
          : "-"
      );

      y += cardHeight + 14;

      // =========================================================
      // GROWTH ASSESSMENT
      // =========================================================

      drawSectionTitle("Growth Assessment");

      if (insights) {
        const requiresAttention =
          insights.status ===
          "requires_attention";

        const belowExpected =
          insights.status ===
          "below_expected_growth";

        if (requiresAttention) {
          pdf.setFillColor(254, 226, 226);
        } else if (belowExpected) {
          pdf.setFillColor(254, 243, 199);
        } else {
          pdf.setFillColor(209, 250, 229);
        }

        pdf.roundedRect(
          margin,
          y,
          contentWidth,
          38,
          4,
          4,
          "F"
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);

        pdf.text(
          `WHO percentile: ${insights.latestPercentileBand}`,
          margin + 6,
          y + 10
        );

        pdf.text(
          `Z-score: ${
            insights.latestZScore !== null
              ? insights.latestZScore.toFixed(2)
              : "-"
          }`,
          margin + 6,
          y + 19
        );

        pdf.setFont("helvetica", "bold");

        pdf.text(
          `Status: ${
            requiresAttention
              ? "Requires attention"
              : belowExpected
                ? "Below expected growth"
                : "Normal trend"
          }`,
          margin + 6,
          y + 29
        );

        pdf.setFont("helvetica", "normal");

        y += 46;

        const summaryLines =
          pdf.splitTextToSize(
            insights.summary,
            contentWidth
          );

        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);

        pdf.text(
          summaryLines,
          margin,
          y
        );

        y +=
          summaryLines.length * 5 + 13;
      } else {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139);

        pdf.text(
          "Growth assessment is not available.",
          margin,
          y
        );

        y += 15;
      }

      // =========================================================
      // MEASUREMENT HISTORY
      // =========================================================

      drawSectionTitle(
        "Measurement History"
      );

      pdf.setFillColor(241, 245, 249);

      pdf.roundedRect(
        margin,
        y,
        contentWidth,
        10,
        2,
        2,
        "F"
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);

      pdf.text(
        "DATE",
        margin + 5,
        y + 7
      );

      pdf.text(
        "HEIGHT",
        margin + 72,
        y + 7
      );

      pdf.text(
        "WEIGHT",
        margin + 120,
        y + 7
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      y += 15;

      for (const measurement of sortedMeasurements) {
        if (y > pageHeight - 28) {
          addPage();
        }

        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);

        pdf.text(
          formatDate(measurement.date),
          margin + 5,
          y
        );

        pdf.text(
          `${measurement.height} cm`,
          margin + 72,
          y
        );

        pdf.text(
          `${measurement.weight} kg`,
          margin + 120,
          y
        );

        pdf.setDrawColor(
          226,
          232,
          240
        );

        pdf.line(
          margin,
          y + 4,
          pageWidth - margin,
          y + 4
        );

        y += 10;
      }

      y += 8;

      // =========================================================
      // WHO CHART
      // =========================================================

      const chartElement =
        document.getElementById(
          "who-growth-chart"
        );

      if (chartElement) {
        // Give the chart its own page when necessary.
        if (y > 145) {
          addPage();
        }

        drawSectionTitle(
          "WHO Height-for-age Chart"
        );

        const svgElement =
          chartElement.querySelector("svg");

        if (svgElement) {
          const serializer =
            new XMLSerializer();

          const svgString =
            serializer.serializeToString(
              svgElement
            );

          const svgBlob = new Blob(
            [svgString],
            {
              type: "image/svg+xml;charset=utf-8",
            }
          );

          const url =
            URL.createObjectURL(svgBlob);

          try {
            const image = new Image();

            await new Promise<void>(
              (resolve, reject) => {
                image.onload = () =>
                  resolve();

                image.onerror = () =>
                  reject(
                    new Error(
                      "Failed to render WHO chart"
                    )
                  );

                image.src = url;
              }
            );

            const canvas =
              document.createElement(
                "canvas"
              );

            const svgWidth =
              svgElement.clientWidth || 800;

            const svgHeight =
              svgElement.clientHeight || 300;

            canvas.width =
              svgWidth * 2;

            canvas.height =
              svgHeight * 2;

            const context =
              canvas.getContext("2d");

            if (!context) {
              throw new Error(
                "Canvas is not available"
              );
            }

            context.fillStyle =
              "#f8fafc";

            context.fillRect(
              0,
              0,
              canvas.width,
              canvas.height
            );

            context.drawImage(
              image,
              0,
              0,
              canvas.width,
              canvas.height
            );

            const chartImage =
              canvas.toDataURL(
                "image/png"
              );

            const imageWidth =
              contentWidth;

            let imageHeight =
              (canvas.height *
                imageWidth) /
              canvas.width;

            // Prevent an unusually tall chart
            // from overflowing the PDF page.
            const maxChartHeight = 105;

            if (
              imageHeight >
              maxChartHeight
            ) {
              imageHeight =
                maxChartHeight;
            }

            pdf.addImage(
              chartImage,
              "PNG",
              margin,
              y,
              imageWidth,
              imageHeight
            );

            y += imageHeight + 7;

            // Legend
            pdf.setFontSize(7.5);
            pdf.setTextColor(
              100,
              116,
              139
            );

            pdf.text(
              "Observed measurements  |  WHO reference curves  |  Prediction  |  What-if simulation",
              margin,
              y
            );

            y += 13;
          } finally {
            URL.revokeObjectURL(url);
          }
        }
      }

      // =========================================================
      // PREDICTION
      // =========================================================

      if (insights?.predictionMessage) {
        ensureSpace(40);

        drawSectionTitle("Prediction");

        pdf.setFillColor(
          239,
          246,
          255
        );

        const predictionLines =
          pdf.splitTextToSize(
            insights.predictionMessage,
            contentWidth - 12
          );

        const predictionBoxHeight =
          Math.max(
            25,
            predictionLines.length *
              5 +
              12
          );

        pdf.roundedRect(
          margin,
          y,
          contentWidth,
          predictionBoxHeight,
          4,
          4,
          "F"
        );

        pdf.setFontSize(9);
        pdf.setTextColor(
          51,
          65,
          85
        );

        pdf.text(
          predictionLines,
          margin + 6,
          y + 9
        );

        y +=
          predictionBoxHeight + 12;
      }

      // =========================================================
      // WARNING SIGNALS
      // =========================================================

      if (
        insights &&
        insights.anomalies.length > 0
      ) {
        ensureSpace(45);

        drawSectionTitle(
          "Warning Signals"
        );

        for (const anomaly of insights.anomalies) {
          ensureSpace(30);

          const explanationLines =
            pdf.splitTextToSize(
              anomaly.explanation,
              contentWidth - 12
            );

          const warningHeight =
            Math.max(
              26,
              explanationLines.length *
                5 +
                16
            );

          pdf.setFillColor(
            254,
            242,
            242
          );

          pdf.roundedRect(
            margin,
            y,
            contentWidth,
            warningHeight,
            4,
            4,
            "F"
          );

          pdf.setFont(
            "helvetica",
            "bold"
          );

          pdf.setFontSize(9);
          pdf.setTextColor(
            185,
            28,
            28
          );

          pdf.text(
            anomaly.flag,
            margin + 6,
            y + 9
          );

          pdf.setFont(
            "helvetica",
            "normal"
          );

          pdf.setFontSize(8.5);
          pdf.setTextColor(
            71,
            85,
            105
          );

          pdf.text(
            explanationLines,
            margin + 6,
            y + 17
          );

          y += warningHeight + 7;
        }
      }

      // =========================================================
      // DISCLAIMER
      // =========================================================

      if (insights?.disclaimer) {
        ensureSpace(30);

        y += 3;

        pdf.setDrawColor(
          226,
          232,
          240
        );

        pdf.line(
          margin,
          y,
          pageWidth - margin,
          y
        );

        y += 7;

        pdf.setFontSize(7.5);
        pdf.setTextColor(
          100,
          116,
          139
        );

        const disclaimerLines =
          pdf.splitTextToSize(
            insights.disclaimer,
            contentWidth
          );

        pdf.text(
          disclaimerLines,
          margin,
          y
        );
      }

      // =========================================================
      // PAGE FOOTERS
      // =========================================================

      const pageCount =
        pdf.getNumberOfPages();

      for (
        let page = 1;
        page <= pageCount;
        page++
      ) {
        pdf.setPage(page);

        pdf.setDrawColor(
          226,
          232,
          240
        );

        pdf.line(
          margin,
          pageHeight - 14,
          pageWidth - margin,
          pageHeight - 14
        );

        pdf.setFontSize(7.5);
        pdf.setTextColor(
          148,
          163,
          184
        );

        pdf.text(
          "Bala Growth",
          margin,
          pageHeight - 8
        );

        pdf.text(
          `Page ${page} of ${pageCount}`,
          pageWidth - margin,
          pageHeight - 8,
          {
            align: "right",
          }
        );
      }

      // =========================================================
      // SAVE
      // =========================================================

      const safeName = child.name
        .trim()
        .replace(/\s+/g, "-")
        .replace(
          /[^a-zA-Z0-9-_]/g,
          ""
        )
        .toLowerCase();

      pdf.save(
        `${
          safeName || "child"
        }-growth-report.pdf`
      );
    } catch (error) {
      console.error(
        "PDF generation failed:",
        error
      );

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