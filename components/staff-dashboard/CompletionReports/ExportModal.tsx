import React, { useState, useEffect } from "react";
import { ExportConfiguration } from "../types/analytics.types";

interface ExportModalProps {
  onClose: () => void;
  onExport: (config: ExportConfiguration) => void;
}

export default function ExportModal({ onClose, onExport }: ExportModalProps) {
  const [config, setConfig] = useState<ExportConfiguration>({
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 7 days ago
      end: new Date().toISOString().split("T")[0], // today
    },
    includeData: {
      customerInfo: true,
      processingResults: true,
      directoryDetails: true,
      timingInfo: true,
      revenueData: true,
      processingLogs: false,
    },
    format: "CSV",
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isGenerating) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, isGenerating]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleDataToggle = (key: keyof typeof config.includeData) => {
    setConfig((prev) => ({
      ...prev,
      includeData: {
        ...prev.includeData,
        [key]: !prev.includeData[key],
      },
    }));
  };

  const handleDatePreset = (preset: "today" | "week" | "month" | "quarter") => {
    const end = new Date().toISOString().split("T")[0];
    let start: string;

    switch (preset) {
      case "today":
        start = end;
        break;
      case "week":
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        break;
      case "month":
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        break;
      case "quarter":
        start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        break;
      default:
        return;
    }

    setConfig((prev) => ({
      ...prev,
      dateRange: { start, end },
    }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);

    try {
      // Simulate export progress
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      onExport(config);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const calculateEstimatedRecords = () => {
    const days = Math.ceil(
      (new Date(config.dateRange.end).getTime() -
        new Date(config.dateRange.start).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return Math.max(1, Math.floor(days * 15)); // Rough estimate of 15 records per day
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-secondary-800 rounded-xl border border-secondary-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-secondary-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center">
              📊 Generate CSV Export
            </h3>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="text-secondary-400 hover:text-white transition-colors disabled:opacity-50"
            >
              ❌
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Date Range */}
          <div>
            <label className="block text-white font-medium mb-3">
              Date Range
            </label>

            {/* Preset Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { key: "today", label: "Today" },
                { key: "week", label: "Week" },
                { key: "month", label: "Month" },
                { key: "quarter", label: "3 Months" },
              ].map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handleDatePreset(preset.key as any)}
                  className="bg-secondary-700 hover:bg-secondary-600 text-secondary-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-secondary-400 text-sm mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={config.dateRange.start}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value },
                    }))
                  }
                  className="w-full bg-secondary-900 border border-secondary-600 text-white px-3 py-2 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-secondary-400 text-sm mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={config.dateRange.end}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value },
                    }))
                  }
                  className="w-full bg-secondary-900 border border-secondary-600 text-white px-3 py-2 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Include Data */}
          <div>
            <label className="block text-white font-medium mb-3">
              Include Data
            </label>
            <div className="space-y-2">
              {Object.entries(config.includeData).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center space-x-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() =>
                      handleDataToggle(key as keyof typeof config.includeData)
                    }
                    className="form-checkbox h-4 w-4 text-volt-500 bg-secondary-900 border-secondary-600 rounded focus:ring-volt-500"
                  />
                  <span className="text-secondary-300">
                    {key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="block text-white font-medium mb-3">Format</label>
            <div className="flex space-x-3">
              {(["CSV", "Excel", "JSON"] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setConfig((prev) => ({ ...prev, format }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    config.format === format
                      ? "bg-volt-500 text-secondary-900"
                      : "bg-secondary-700 hover:bg-secondary-600 text-secondary-300 hover:text-white"
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Size */}
          <div className="bg-secondary-900/50 rounded-lg p-4">
            <div className="text-secondary-400 text-sm mb-1">
              Estimated Export
            </div>
            <div className="text-white font-medium">
              ~{calculateEstimatedRecords().toLocaleString()} records •
              {Math.ceil(calculateEstimatedRecords() * 0.05)}KB
            </div>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">
                  Generating export...
                </span>
                <span className="text-volt-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-secondary-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-volt-500 to-volt-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex space-x-3">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 border-2 border-secondary-600 hover:border-secondary-500 text-secondary-300 hover:text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ❌ Cancel
          </button>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex-1 bg-gradient-to-r from-volt-500 to-volt-600 text-secondary-900 py-3 px-4 rounded-lg font-bold transition-all duration-200 hover:from-volt-400 hover:to-volt-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary-900"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <span>📁</span>
                <span>Generate Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
