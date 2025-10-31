import React from "react";
import { FailureAnalysis } from "../types/analytics.types";

interface SuccessFailureChartProps {
  failureAnalysis: FailureAnalysis[];
  totalSubmissions: number;
  successfulSubmissions: number;
}

export default function SuccessFailureChart({
  failureAnalysis,
  totalSubmissions,
  successfulSubmissions,
}: SuccessFailureChartProps) {
  const successRate =
    totalSubmissions > 0 ? (successfulSubmissions / totalSubmissions) * 100 : 0;
  const failureRate = 100 - successRate;

  const getTrendIcon = (trend: "increasing" | "decreasing" | "stable") => {
    switch (trend) {
      case "increasing":
        return "📈";
      case "decreasing":
        return "📉";
      case "stable":
        return "➖";
      default:
        return "📊";
    }
  };

  const getTrendColor = (trend: "increasing" | "decreasing" | "stable") => {
    switch (trend) {
      case "increasing":
        return "text-red-400"; // Bad for failures
      case "decreasing":
        return "text-green-400"; // Good for failures
      case "stable":
        return "text-volt-400";
      default:
        return "text-secondary-400";
    }
  };

  return (
    <div className="bg-secondary-800 rounded-xl border border-secondary-700 p-6">
      <h3 className="text-lg font-bold text-white mb-6">
        📊 Success/Failure Analysis
      </h3>

      {/* Overall Success Rate */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white font-medium">Overall Success Rate</span>
          <span className="text-volt-400 font-bold text-lg">
            {successRate.toFixed(1)}%
          </span>
        </div>

        <div className="relative">
          <div className="w-full bg-secondary-700 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-green-500 to-green-400 h-4 rounded-full transition-all duration-1000"
              style={{ width: `${successRate}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-secondary-400 mt-1">
            <span>{successfulSubmissions.toLocaleString()} successful</span>
            <span>
              {(totalSubmissions - successfulSubmissions).toLocaleString()}{" "}
              failed
            </span>
          </div>
        </div>
      </div>

      {/* Top Performing Directories */}
      <div className="mb-6">
        <h4 className="text-white font-bold mb-3 flex items-center">
          📈 Top Performing Directories
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-green-600/10 rounded-lg">
            <span className="text-green-300">📈 Google My Business</span>
            <div className="text-right">
              <div className="text-green-400 font-bold">98.2%</div>
              <div className="text-xs text-secondary-400">523 submissions</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 bg-green-600/10 rounded-lg">
            <span className="text-green-300">📈 LinkedIn Company</span>
            <div className="text-right">
              <div className="text-green-400 font-bold">96.7%</div>
              <div className="text-xs text-secondary-400">489 submissions</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 bg-green-600/10 rounded-lg">
            <span className="text-green-300">📈 Facebook Business</span>
            <div className="text-right">
              <div className="text-green-400 font-bold">94.1%</div>
              <div className="text-xs text-secondary-400">445 submissions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Problem Directories */}
      <div className="mb-6">
        <h4 className="text-white font-bold mb-3 flex items-center">
          ⚠️ Problem Directories
        </h4>
        <div className="space-y-2">
          <div className="p-3 bg-red-600/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-300 font-medium">⚠️ Yelp Business</span>
              <div className="text-right">
                <div className="text-red-400 font-bold">67.3%</div>
                <div className="text-xs text-secondary-400">
                  234 submissions
                </div>
              </div>
            </div>
            <div className="text-xs text-red-300">
              Common failures: Captcha, Duplicate listings
            </div>
          </div>

          <div className="p-3 bg-red-600/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-300 font-medium">⚠️ Yellow Pages</span>
              <div className="text-right">
                <div className="text-red-400 font-bold">71.2%</div>
                <div className="text-xs text-secondary-400">
                  198 submissions
                </div>
              </div>
            </div>
            <div className="text-xs text-red-300">
              Common failures: Form changes, Login required
            </div>
          </div>
        </div>
      </div>

      {/* Failure Reasons */}
      <div>
        <h4 className="text-white font-bold mb-3 flex items-center">
          🔍 Failure Reasons
        </h4>
        <div className="space-y-3">
          {failureAnalysis.map((reason, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-secondary-900/50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">
                  {reason.reason.includes("Captcha")
                    ? "🤖"
                    : reason.reason.includes("Login")
                      ? "🔒"
                      : reason.reason.includes("Form")
                        ? "📝"
                        : reason.reason.includes("Site")
                          ? "🌐"
                          : reason.reason.includes("Duplicate")
                            ? "📋"
                            : "❓"}
                </span>
                <div>
                  <div className="text-white font-medium">{reason.reason}</div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-secondary-400">
                      {reason.count} failures
                    </span>
                    <span className={getTrendColor(reason.trend)}>
                      {getTrendIcon(reason.trend)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-red-400 font-bold">{reason.percentage}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
