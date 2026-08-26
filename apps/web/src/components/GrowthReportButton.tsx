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
  function generatePdf() {
    const pdf = new jsPDF();

    let y = 20;

    pdf.setFontSize(20);
    pdf.text("Bala Growth - Growth Report", 20, y);

    y += 15;

    pdf.setFontSize(12);
    pdf.text(`Child: ${child.name}`, 20, y);

    y += 8;
    pdf.text(
      `Birth date: ${formatDate(child.birthDate)}`,
      20,
      y
    );

    y += 8;
    pdf.text(
      `Gender: ${
        child.gender === "male" ? "Male" : "Female"
      }`,
      20,
      y
    );

    y += 15;

    pdf.setFontSize(16);
    pdf.text("Growth Assessment", 20, y);

    y += 10;

    pdf.setFontSize(11);

    if (insights) {
      pdf.text(
        `WHO percentile: ${insights.latestPercentileBand}`,
        20,
        y
      );

      y += 7;

      pdf.text(
        `Z-score: ${
          insights.latestZScore !== null
            ? insights.latestZScore.toFixed(2)
            : "-"
        }`,
        20,
        y
      );

      y += 7;

      pdf.text(
        `Status: ${insights.status}`,
        20,
        y
      );

      y += 10;

      const summaryLines = pdf.splitTextToSize(
        insights.summary,
        170
      );

      pdf.text(summaryLines, 20, y);

      y += summaryLines.length * 6 + 10;
    } else {
      pdf.text(
        "Growth insights are not available.",
        20,
        y
      );

      y += 12;
    }

    pdf.setFontSize(16);
    pdf.text("Measurement History", 20, y);

    y += 10;

    pdf.setFontSize(11);

    const sortedMeasurements = [...measurements].sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );

    sortedMeasurements.forEach((measurement) => {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(
        `${formatDate(measurement.date)} - ${measurement.height} cm - ${measurement.weight} kg`,
        20,
        y
      );

      y += 7;
    });

    y += 10;

    if (insights?.predictionMessage) {
      if (y > 250) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(16);
      pdf.text("Prediction", 20, y);

      y += 10;

      pdf.setFontSize(11);

      const predictionLines = pdf.splitTextToSize(
        insights.predictionMessage,
        170
      );

      pdf.text(predictionLines, 20, y);

      y += predictionLines.length * 6 + 10;
    }

    if (insights?.disclaimer) {
      if (y > 260) {
        pdf.addPage();
        y = 20;
      }

      pdf.setFontSize(9);

      const disclaimerLines = pdf.splitTextToSize(
        insights.disclaimer,
        170
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