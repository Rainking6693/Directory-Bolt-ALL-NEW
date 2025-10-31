import React, { useState, useEffect } from "react";
import LiveDashboard from "./LiveDashboard";
import {
  ProcessingJob,
  SystemHealth,
  ActivityFeedItem,
} from "../types/processing.types";
import { useWebSocket } from "../../../hooks/useWebSocket";

export default function ProgressTracking() {
  const { isConnected } = useWebSocket("/api/ws/staff-dashboard");
  const [activeJobs, setActiveJobs] = useState<ProcessingJob[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    apiStatus: {
      "Google My Business": "operational",
      "LinkedIn Company": "operational",
      "Facebook Business": "operational",
      Yelp: "degraded",
      "Yellow Pages": "operational",
      "Local.com": "operational",
      CitySearch: "down",
    },
    processingCapacity: 85, // 85%
    queueDepth: 23,
    lastHealthCheck: new Date().toISOString(),
  });
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([
    {
      id: "activity-1",
      timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // 1 minute ago
      customerId: "DIR-2025-001234",
      directoryName: "Google My Business",
      status: "success",
      message: "Listing created successfully",
      icon: "✅",
    },
    {
      id: "activity-2",
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
      customerId: "DIR-2025-001235",
      directoryName: "Yelp",
      status: "failed",
      message: "Captcha verification required",
      icon: "❌",
    },
    {
      id: "activity-3",
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 minutes ago
      customerId: "DIR-2025-001234",
      directoryName: "LinkedIn Company",
      status: "success",
      message: "Company page updated",
      icon: "✅",
    },
    {
      id: "activity-4",
      timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(), // 4 minutes ago
      customerId: "DIR-2025-001236",
      directoryName: "Processing",
      status: "started",
      message: "Queue processing initiated",
      icon: "🚀",
    },
    {
      id: "activity-5",
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      customerId: "DIR-2025-001235",
      directoryName: "Facebook Business",
      status: "success",
      message: "Business page created",
      icon: "✅",
    },
  ]);

  // Fetch active jobs data
  useEffect(() => {
    const fetchActiveJobs = async () => {
      try {
        const response = await fetch("/api/autobolt/queue-status");
        const result = await response.json();

        if (result.success && result.data.isProcessing) {
          // Mock active job data - in real implementation this would come from API
          setActiveJobs([
            {
              customerId: "DIR-2025-001234",
              businessName: "TechStart Inc",
              packageType: "PRO",
              status: "processing",
              progress: 67,
              startedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
              elapsedTime: 12.5,
              currentActivity: "Submitting to Google My Business...",
              directoriesTotal: 200,
              directoriesCompleted: 134,
              directoriesSuccessful: 121,
              directoriesFailed: 13,
              directoriesRemaining: 66,
            },
            {
              customerId: "DIR-2025-001235",
              businessName: "Marketing Pro",
              packageType: "GROWTH",
              status: "processing",
              progress: 23,
              startedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
              elapsedTime: 4.2,
              currentActivity: "Processing LinkedIn Company page...",
              directoriesTotal: 100,
              directoriesCompleted: 23,
              directoriesSuccessful: 20,
              directoriesFailed: 3,
              directoriesRemaining: 77,
            },
          ]);
        } else {
          setActiveJobs([]);
        }
      } catch (error) {
        console.error("Failed to fetch active jobs:", error);
      }
    };

    fetchActiveJobs();

    // Refresh every 10 seconds
    const interval = setInterval(fetchActiveJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  // Simulate live activity updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Add a new random activity every 30 seconds
      const activities = [
        {
          directoryName: "Google My Business",
          status: "success" as const,
          message: "Listing updated successfully",
        },
        {
          directoryName: "Yelp",
          status: "failed" as const,
          message: "Rate limit exceeded",
        },
        {
          directoryName: "Facebook Business",
          status: "success" as const,
          message: "Page created successfully",
        },
        {
          directoryName: "LinkedIn Company",
          status: "processing" as const,
          message: "Submitting company information",
        },
      ];

      const randomActivity =
        activities[Math.floor(Math.random() * activities.length)];
      const newActivity: ActivityFeedItem = {
        id: `activity-${Date.now()}`,
        timestamp: new Date().toISOString(),
        customerId: `DIR-2025-${String(Math.floor(Math.random() * 1000)).padStart(6, "0")}`,
        directoryName: randomActivity.directoryName,
        status: randomActivity.status,
        message: randomActivity.message,
        icon:
          randomActivity.status === "success"
            ? "✅"
            : randomActivity.status === "failed"
              ? "❌"
              : "🔄",
      };

      setActivityFeed((prev) => [newActivity, ...prev.slice(0, 9)]); // Keep only 10 most recent
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <LiveDashboard
      activeJobs={activeJobs}
      systemHealth={systemHealth}
      activityFeed={activityFeed}
      isConnected={isConnected}
    />
  );
}
