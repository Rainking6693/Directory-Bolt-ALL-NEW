import React from "react";
import { QueueStats as QueueStatsType } from "../types/queue.types";

interface QueueStatsProps {
  stats: QueueStatsType;
}

export default function QueueStats({ stats }: QueueStatsProps) {
  const statCards = [
    {
      label: "High Priority",
      value: stats.highPriority,
      icon: "⚡",
      color: "text-red-400",
      bgColor: "bg-red-600/10",
    },
    {
      label: "Avg Wait Time",
      value: `${stats.averageWaitTime}h`,
      icon: "⏰",
      color: "text-volt-400",
      bgColor: "bg-volt-600/10",
    },
    {
      label: "Success Rate",
      value: `${stats.successRate}%`,
      icon: "📈",
      color: "text-green-400",
      bgColor: "bg-green-600/10",
    },
    {
      label: "Revenue Pending",
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: "💰",
      color: "text-volt-400",
      bgColor: "bg-volt-600/10",
    },
    {
      label: "Today's Goal",
      value: `${stats.todaysCompleted}/${stats.todaysGoal}`,
      icon: "🎯",
      color: "text-blue-400",
      bgColor: "bg-blue-600/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {statCards.map((card, index) => (
        <div
          key={index}
          className={`${card.bgColor} rounded-lg p-4 border border-secondary-700/50`}
        >
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-lg">{card.icon}</span>
            <span className="text-secondary-300 text-xs uppercase tracking-wide font-medium">
              {card.label}
            </span>
          </div>

          <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
